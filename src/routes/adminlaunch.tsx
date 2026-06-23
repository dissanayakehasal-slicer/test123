import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { updateLaunchTime, verifyAdminPassword, getLaunchInfo } from "@/lib/launch.functions";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/adminlaunch")({
  head: () => ({
    meta: [
      { title: "Launch Control — GMS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLaunch,
});

function AdminLaunch() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const verify = useServerFn(verifyAdminPassword);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);
    try {
      const res = await verify({ data: { password } });
      if (res.ok) setAuthed(true);
      else setAuthError("Incorrect password");
    } catch {
      setAuthError("Verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mb-3 text-[10px] uppercase tracking-[0.5em] text-gold">
            Launch Control
          </div>
          <h1 className="font-display text-4xl text-cream sm:text-5xl">
            GMS <span className="text-gold-gradient">/ Admin</span>
          </h1>
          <p className="mt-3 font-serif-italic text-muted-foreground">
            Set the moment the world goes live
          </p>
        </div>

        <div className="ring-gold rounded-xl bg-card/70 p-8 backdrop-blur-sm">
          {!authed ? (
            <form onSubmit={handleAuth} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Admin password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-md border border-border bg-input px-4 py-3 font-sans text-cream outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                />
              </label>
              {authError && (
                <p className="text-sm text-destructive">{authError}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-gradient-to-b from-gold-bright to-gold-deep px-4 py-3 font-display tracking-[0.3em] text-obsidian transition hover:brightness-110 disabled:opacity-50"
              >
                {submitting ? "Verifying…" : "Unlock"}
              </button>
            </form>
          ) : (
            <LaunchEditor />
          )}
        </div>

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.4em] text-muted-foreground/60">
          Times are stored in UTC and synced server-side
        </p>
      </div>
    </main>
  );
}

// All admin times are entered and displayed in Sri Lanka Standard Time (GMT+5:30).
const SLST_OFFSET_MIN = 5 * 60 + 30;
const SLST_LABEL = "Sri Lanka Time (GMT+5:30)";

function toSLSTInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  // Shift the absolute instant into a wall-clock that, when read as UTC, equals SLST.
  const shifted = new Date(d.getTime() + SLST_OFFSET_MIN * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

function slstInputToISO(local: string): string {
  // local is "YYYY-MM-DDTHH:mm" interpreted as SLST wall-clock.
  const [datePart, timePart] = local.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  return new Date(asUtc - SLST_OFFSET_MIN * 60_000).toISOString();
}

function formatSLST(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
    dateStyle: "full",
    timeStyle: "short",
  }) + " (GMT+5:30)";
}

function LaunchEditor() {
  const { data, refetch } = useQuery({
    queryKey: ["launch-info-admin"],
    queryFn: () => getLaunchInfo(),
  });
  const update = useServerFn(updateLaunchTime);

  const [value, setValue] = useState<string>("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const current = data?.launchAt ?? null;
  const currentLocal = toLocalInput(current);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const local = value || currentLocal;
      if (!local) throw new Error("Pick a date");
      const iso = new Date(local).toISOString();
      await update({ data: { password, launchAt: iso } });
      setMsg("Launch time updated");
      setPassword("");
      await refetch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="rounded-md border border-border/60 bg-background/50 p-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Current launch</div>
        <div className="mt-1 font-serif-italic text-lg text-cream">
          {current ? new Date(current).toLocaleString() : "Not set"}
        </div>
      </div>

      <label className="block">
        <span className="mb-2 block text-xs uppercase tracking-[0.3em] text-muted-foreground">
          New launch date & time (your local time)
        </span>
        <input
          type="datetime-local"
          value={value || currentLocal}
          onChange={(e) => setValue(e.target.value)}
          required
          className="w-full rounded-md border border-border bg-input px-4 py-3 font-sans text-cream outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Confirm admin password
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-md border border-border bg-input px-4 py-3 font-sans text-cream outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
      </label>

      {msg && <p className="text-sm text-gold">{msg}</p>}
      {err && <p className="text-sm text-destructive">{err}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-gradient-to-b from-gold-bright to-gold-deep px-4 py-3 font-display tracking-[0.3em] text-obsidian transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save Launch Time"}
      </button>
    </form>
  );
}
