Cloudflare Workers deployment (Nitro + Vite)

Steps to build and publish this app to Cloudflare Workers using Wrangler:

1. Install Wrangler (v2) if you haven't already:

```bash
npm install -g wrangler
```

2. Build the project (produces `.output/server` and `.output/public`):

```bash
npm run build
```

3. Publish with Wrangler:

```bash
wrangler publish --name live-launch-countdown
```

Notes:
- The repository includes `worker.js` which delegates runtime `fetch` to the
  Nitro server entry produced in `.output/server/index.mjs`.
- `wrangler.toml` is preconfigured to use the `.output/public` folder as the
  static site bucket. Set `account_id` in `wrangler.toml` if you want to publish
  to your account rather than `*.workers.dev`.
- If you prefer Cloudflare Pages for static-only deployments, you can skip the
  server build and publish the `dist` or `.output/public` folder via Pages.
