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
    // Serve static assets from the Workers Sites binding first.
    if (env.__STATIC_CONTENT) {
      const staticResponse = await env.__STATIC_CONTENT.fetch(request);
      if (staticResponse.status !== 404) {
        return staticResponse;
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
