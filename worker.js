// Bridge worker that delegates to the Nitro/Vite server build when available.
// It expects you to run `npm run build` which will produce `.output/server` and
// `.output/public` (Nitro-style output). When deployed via Wrangler this file
// will be bundled together with the built server code.

let serverPromise;

async function getServer() {
  if (!serverPromise) {
    // Defer dynamic import until runtime so local dev still works without build.
    serverPromise = import('./.output/server/index.mjs')
      .then((m) => (m.default ?? m))
      .catch(() => null);
  }
  return serverPromise;
}

export default {
  async fetch(request, env, ctx) {
    const server = await getServer();
    if (server && typeof server.fetch === 'function') {
      return server.fetch(request, env, ctx);
    }

    // If the server build isn't present, return an informative response.
    return new Response('Server build missing — run `npm run build` before publishing.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
};
