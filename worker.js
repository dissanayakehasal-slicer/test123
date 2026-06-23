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

  try {
    const parsed = new URL(location, requestOrigin);
    const target = new URL(targetOrigin);

    if (parsed.host === target.host) {
      const proxiedPath = parsed.pathname === '/' ? `${PROXY_PREFIX}/` : `${PROXY_PREFIX}${parsed.pathname}`;
      return `${requestOrigin}${proxiedPath}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Ignore invalid URLs, fall back to relative rewrite.
  }

  if (location.startsWith('/')) {
    if (location.startsWith(`${PROXY_PREFIX}/`) || location === PROXY_PREFIX) {
      return location;
    }
    return `${requestOrigin}${location === '/' ? `${PROXY_PREFIX}/` : `${PROXY_PREFIX}${location}`}`;
  }

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

  if (requestUrl.pathname === PROXY_PREFIX || requestUrl.pathname === `${PROXY_PREFIX}/`) {
    target.pathname = '/';
  } else {
    const proxiedPath = requestUrl.pathname.slice(PROXY_PREFIX.length);
    target.pathname = proxiedPath.startsWith('/') ? proxiedPath : `/${proxiedPath}`;
  }
  target.search = requestUrl.search;

  return target;
}

async function proxyRequest(request, env) {
  const target = getProxyTarget(request, env);
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.delete('host');
  forwardedHeaders.set('x-forwarded-host', new URL(request.url).host);
  forwardedHeaders.set('x-forwarded-proto', new URL(request.url).protocol.replace(':', ''));
  forwardedHeaders.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || '');

  const proxyRequest = new Request(target.href, {
    method: request.method,
    headers: forwardedHeaders,
    body: request.body,
    redirect: 'manual',
  });

  const originResponse = await fetch(proxyRequest);
  const responseHeaders = new Headers();

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
      return Response.redirect(`${url.origin}${PROXY_PREFIX}/`, 302);
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
