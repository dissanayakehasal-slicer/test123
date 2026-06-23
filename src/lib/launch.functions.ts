import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DEFAULT_LAUNCH_AT = process.env.DEFAULT_LAUNCH_AT ?? "2026-06-23T12:20:00.000Z";

function getD1FromContext(context: any) {
  // TanStack Start passes a `context` object into server functions. Try to read
  // the Cloudflare D1 binding from there; fall back to global for local tests.
  return (context?.env?.LAUNCH_DB ?? (globalThis as any).LAUNCH_DB) as any | undefined;
}

export const getLaunchInfo = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const d1 = getD1FromContext(context);
  if (!d1) {
    // No D1 binding available — fall back to the default configured launch time.
    return { launchAt: DEFAULT_LAUNCH_AT, serverNow: new Date().toISOString() };
  }

  const res = await d1.prepare("SELECT launch_at FROM launch_config WHERE id = 1").all();
  const row = res?.results?.[0] ?? null;
  return { launchAt: row?.launch_at ?? DEFAULT_LAUNCH_AT, serverNow: new Date().toISOString() };
});

const updateSchema = z.object({
  password: z.string().min(1),
  launchAt: z.string().min(1),
});

export const updateLaunchTime = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const expected = process.env.ADMIN_LAUNCH_PASSWORD;
    if (!expected || data.password !== expected) {
      throw new Error("Invalid admin password");
    }
    const when = new Date(data.launchAt);
    if (Number.isNaN(when.getTime())) {
      throw new Error("Invalid date");
    }

    const d1 = getD1FromContext(context);
    if (!d1) throw new Error("D1 database binding not available");

    // Upsert the launch time (D1 supports simple run/prepare APIs)
    // Use a UPSERT via INSERT ... ON CONFLICT
    const sql = `INSERT INTO launch_config (id, launch_at, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET launch_at = excluded.launch_at, updated_at = excluded.updated_at;`;
    await d1.prepare(sql).bind(when.toISOString()).run();

    return { success: true, launchAt: when.toISOString() };
  });

const verifySchema = z.object({ password: z.string().min(1) });

export const verifyAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => verifySchema.parse(data))
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_LAUNCH_PASSWORD;
    return { ok: !!expected && data.password === expected };
  });
