// Bridge worker that delegates to the Nitro/Vite server build when available.
// It expects you to run `npm run build` which will produce `.output/server` and
// `.output/public` (Nitro-style output). When deployed via Wrangler this file
// will be bundled together with the built server code.

let serverPromise;

async function getServer() {
  if (!serverPromise) {
    // Defer dynamic import until runtime so local dev still works without build.
    // The Vite build in this repo outputs server bundles to `dist/server`.
    // Import that bundle when available.
    serverPromise = import('./dist/server/server.js')
      .then((m) => (m.default ?? m))
      .catch(() => null);
  }
  return serverPromise;
}

export default {
  async fetch(request, env, ctx) {
    // Serve static assets with the configured binding when possible.
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
