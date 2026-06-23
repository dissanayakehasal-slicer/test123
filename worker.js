// Bridge worker that delegates to the Nitro/Vite server build when available.
// It also implements a reverse proxy for /app/* and a /enter entrypoint.
// The proxy forwards requests to the origin application while keeping the
// browser URL on the public domain.

let serverPromise;
const PROXY_PREFIX = '/app';
const ENTRY_PATH = '/enter';
const DEFAULT_ORIGIN = 'https://remix-of-gen-z-science-hub.goyumgeeth43.workers.dev';

async function getServer() {
  if (!serverPromise) {
    serverPromise = import('./dist/server/server.js')
      .then((m) => (m.default ?? m))
      .catch(() => null);
  }
  return serverPromise;
}

function stripCookieDomain(setCookieValue) {
  return setCookieValue.replace(/;\s*Domain=[^;]+/gi, '');
}

function rewriteLocationHeader(location, requestOrigin, targetOrigin) {
  if (!location) return location;

  // Absolute URL pointing to the origin app: rewrite to /app/* on our domain.
  try {
    const parsed = new URL(location, requestOrigin);
    const target = new URL(targetOrigin);

    if (parsed.host === target.host) {
      // Avoid double-prefixing if the origin path already contains the proxy prefix.
      const path = parsed.pathname.startsWith(PROXY_PREFIX) ? parsed.pathname : `${PROXY_PREFIX}${parsed.pathname}`;
      return `${requestOrigin}${path}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // If URL parsing fails, fall back to relative handling below.
  }

  // Relative location (starts with '/'). If it already begins with the proxy
  // prefix, keep it; otherwise prefix it so navigation stays under /app.
  if (location.startsWith('/')) {
    if (location === '/' ) return `${requestOrigin}${PROXY_PREFIX}/`;
    if (location.startsWith(`${PROXY_PREFIX}/`) || location === PROXY_PREFIX) {
      return `${requestOrigin}${location}`;
    }
    return `${requestOrigin}${PROXY_PREFIX}${location}`;
  }

  // Leave other kinds of locations (hashes, relative fragments) untouched.
  return location;
}

function insertBaseHref(html) {
  if (/<base\s/i.test(html)) {
    return html;
  }
  return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}<base href="${PROXY_PREFIX}/">`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteHtml(html, targetOrigin) {
  const originHost = new URL(targetOrigin).host;
  let rewritten = insertBaseHref(html);

  const absoluteRegex = new RegExp(`https?:\\/\\/${escapeRegExp(originHost)}(/[^"'>\\s]*)?`, 'gi');
  rewritten = rewritten.replace(absoluteRegex, (_, path = '/') => {
    const normalizedPath = path === '/' ? '/' : path;
    return `/app${normalizedPath}`;
  });

  rewritten = rewritten.replace(/(href|src|action|formaction|poster|data-href)=(["']?)\/(?!app\/)/gi, `$1=$2${PROXY_PREFIX}/`);
  rewritten = rewritten.replace(/url\((['"]?)\/(?!app\/)/gi, `url($1${PROXY_PREFIX}/`);
  rewritten = rewritten.replace(/srcset=(["'])([^"']*)\1/gi, (match, quote, value) => {
    const rewrittenSrcset = value.replace(/(?:^|,\s*)(\/)(?!app\/)/g, `$1${PROXY_PREFIX}/`);
    return `srcset=${quote}${rewrittenSrcset}${quote}`;
  });

  return rewritten;
}

function getProxyTarget(request, env) {
  const origin = env.ORIGIN_APP || DEFAULT_ORIGIN;
  const target = new URL(origin);
  const requestUrl = new URL(request.url);
  // Preserve the /app prefix when forwarding so origin receives the same path.
  // Examples:
  //  - /app/        -> origin:/app/
  //  - /app/foo     -> origin:/app/foo
  // This avoids mapping top-level /app routes to origin root when the origin
  // application is mounted under /app.
  const path = requestUrl.pathname;
  const accept = (request.headers.get('accept') || '').toLowerCase();

  // Asset extensions that should be forwarded to the origin with the /app
  // prefix stripped (so /app/assets/... -> /assets/...).
  const assetExtRe = /\.(js|mjs|css|png|jpg|jpeg|svg|webp|gif|ico|woff2|woff|ttf|map)(?:\?|$)/i;

  // Strip the proxy prefix for asset requests so the origin serves them from
  // its normal static path.
  if (path === PROXY_PREFIX || path === `${PROXY_PREFIX}/`) {
    // Request the origin's /app entry (no trailing slash) for navigation.
    target.pathname = PROXY_PREFIX;
  } else if (path.startsWith(`${PROXY_PREFIX}/`)) {
    const withoutPrefix = path.slice(PROXY_PREFIX.length);
    // If this looks like an asset request, forward to the stripped path.
    if (assetExtRe.test(withoutPrefix)) {
      target.pathname = withoutPrefix.startsWith('/') ? withoutPrefix : `/${withoutPrefix}`;
    } else if (accept.includes('text/html')) {
      // Navigation: request the origin's /app entry so it returns the SPA HTML.
      target.pathname = PROXY_PREFIX;
    } else {
      // Default: forward with the prefix stripped.
      target.pathname = withoutPrefix.startsWith('/') ? withoutPrefix : `/${withoutPrefix}`;
    }
  } else {
    target.pathname = path;
  }

  target.search = requestUrl.search;

  return target;
}

async function proxyRequest(request, env) {
  const target = getProxyTarget(request, env);
  // Build a minimal, safe set of headers to forward to the origin. Avoid
  // proxy-specific headers that might change origin routing logic.
  const forwardedHeaders = new Headers();
  const incoming = request.headers;
  const copyKeys = ['accept', 'accept-language', 'user-agent', 'cookie', 'content-type', 'origin', 'referer'];
  for (const k of copyKeys) {
    const v = incoming.get(k);
    if (v) forwardedHeaders.set(k, v);
  }
  // Let the fetch API set the Host header automatically for the target.

  const proxyRequest = new Request(target.href, {
    method: request.method,
    headers: forwardedHeaders,
    body: request.body,
    redirect: 'manual',
  });

  const originResponse = await fetch(proxyRequest);
  const responseHeaders = new Headers();
  // Expose the actual proxied target for debugging (temporary).
  responseHeaders.set('x-proxy-target', target.href);

  for (const [key, value] of originResponse.headers) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'location') {
      responseHeaders.set('Location', rewriteLocationHeader(value, new URL(request.url).origin, env.ORIGIN_APP || DEFAULT_ORIGIN));
      continue;
    }
    if (lowerKey === 'set-cookie') {
      responseHeaders.append('Set-Cookie', stripCookieDomain(value));
      continue;
    }
    responseHeaders.append(key, value);
  }

  const contentType = originResponse.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const html = await originResponse.text();
    const proxiedHtml = rewriteHtml(html, env.ORIGIN_APP || DEFAULT_ORIGIN);
    return new Response(proxiedHtml, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: responseHeaders,
    });
  }

  return new Response(originResponse.body, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers: responseHeaders,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === ENTRY_PATH) {
      // Redirect to /app (no trailing slash) to match origin routing behavior.
      return Response.redirect(`${url.origin}${PROXY_PREFIX}`, 302);
    }

    if (url.pathname === PROXY_PREFIX || url.pathname.startsWith(`${PROXY_PREFIX}/`)) {
      return proxyRequest(request, env);
    }

    if (env.ASSETS) {
      try {
        const staticResponse = await env.ASSETS.fetch(request);
        if (staticResponse.status !== 404) {
          return staticResponse;
        }
      } catch {
        // If the assets binding is unavailable or fails, continue to SSR.
      }
    }

    const server = await getServer();
    if (server && typeof server.fetch === 'function') {
      return server.fetch(request, env, ctx);
    }

    return new Response('Server build missing — run `npm run build` before publishing.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
};
