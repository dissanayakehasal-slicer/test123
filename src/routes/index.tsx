import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLaunchInfo } from "@/lib/launch.functions";

// Where ENTER NOW sends users.
const ENTER_URL = "/enter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GEETHMUNASINGHE.LK — Going Live" },
      { name: "description", content: "GMS / GEN-ZCIENCE goes live. A controlled cinematic launch experience." },
      { property: "og:title", content: "GEETHMUNASINGHE.LK — Going Live" },
      { property: "og:description", content: "Countdown to the live launch of GMS / GEN-ZCIENCE." },
    ],
  }),
  component: LaunchPage,
});

function useServerSyncedNow() {
  const DEFAULT_LAUNCH_AT = useMemo(
    () => new Date("2026-06-22T11:10:00.000Z").getTime(),
    [],
  );

  const { data, refetch, isError } = useQuery({
    queryKey: ["launch-info"],
    queryFn: () => getLaunchInfo(),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const offsetRef = useRef(0);
  useEffect(() => {
    if (data?.serverNow) {
      offsetRef.current = new Date(data.serverNow).getTime() - Date.now();
    }
  }, [data?.serverNow]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(Date.now() + offsetRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return {
    now,
    launchAt: data?.launchAt ? new Date(data.launchAt).getTime() : DEFAULT_LAUNCH_AT,
    refetch,
    loaded: !!data || isError,
  };
}

function LaunchPage() {
  const { now, launchAt, loaded } = useServerSyncedNow();

  const remainingMs = launchAt != null ? launchAt - now : null;
  const remainingSec = remainingMs != null ? remainingMs / 1000 : null;

  // Phase logic
  const phase = useMemo<"loading" | "pre" | "cinematic" | "live">(() => {
    if (!loaded || remainingSec == null) return "loading";
    if (remainingSec <= 0) return "live";
    if (remainingSec <= 10) return "cinematic";
    return "pre";
  }, [loaded, remainingSec]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AmbientBackdrop intense={phase === "cinematic" || phase === "live"} />

      {phase === "loading" && <LoadingState />}
      {phase === "pre" && remainingMs != null && <PreLaunch remainingMs={remainingMs} />}
      {phase === "cinematic" && remainingSec != null && (
        <CinematicCountdown remainingSec={remainingSec} />
      )}
      {phase === "live" && <LiveState />}
    </main>
  );
}

/* ---------- Ambient backdrop ---------- */

function AmbientBackdrop({ intense }: { intense: boolean }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 -z-10 animate-vignette-pulse"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, color-mix(in oklab, var(--gold) 12%, transparent) 0%, transparent 60%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% 120%, color-mix(in oklab, var(--gold-deep) 18%, transparent), transparent 70%)",
        }}
      />
      {/* Subtle grain */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      {intense && (
        <div className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-700"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in oklab, var(--gold-bright) 18%, transparent), transparent 70%)",
          }}
        />
      )}
    </>
  );
}

/* ---------- Loading ---------- */

function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="font-serif-italic text-2xl text-muted-foreground animate-slow-pulse">
        Preparing the moment…
      </div>
    </div>
  );
}

/* ---------- Pre-launch ---------- */

function PreLaunch({ remainingMs }: { remainingMs: number }) {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return (
    <div className="relative overflow-hidden flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="pointer-events-none absolute left-4 top-24 h-24 w-24 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-28 h-16 w-16 rounded-full bg-cream/15 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-14 h-12 w-12 -translate-x-1/2 rounded-full bg-gold/15 blur-3xl" />
      <div className="pointer-events-none absolute right-8 bottom-32 h-20 w-20 rounded-full bg-gold/10 blur-3xl" />
      <header className="mb-14 flex flex-col items-center text-center animate-reveal-up">
        <div className="mb-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.35em] text-gold">
          <span className="h-px w-12 bg-gold/50" />
          GMS · GEN-ZCIENCE
          <span className="h-px w-12 bg-gold/50" />
        </div>
        <div className="mb-4 flex items-center justify-center gap-3 rounded-full border border-gold/15 bg-card/20 px-4 py-2 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-gold animate-neon-pulse" />
          Preparing the countdown
          <span className="h-2 w-2 rounded-full bg-gold animate-neon-pulse" />
        </div>
        <h1 className="font-display text-6xl text-cream sm:text-7xl md:text-8xl lg:text-[6.75rem]">
          GEETHMUNASINGHE<span className="text-gold-gradient">.LK</span>
        </h1>
        <p className="mt-5 max-w-2xl font-serif-italic text-xl text-muted-foreground sm:text-2xl">
          A new chapter is about to be revealed.
        </p>
      </header>

      <section className="flex flex-col items-center">
        <div className="mb-8 flex items-center gap-4">
          <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold/60" />
          <span className="font-display text-base uppercase tracking-[0.6em] text-gold-gradient animate-gold-shimmer">
            Going Live In
          </span>
          <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold/60" />
        </div>

        <div className="grid grid-cols-4 gap-6 sm:gap-10 xl:gap-12">
          <TimeCell value={days} label="Days" />
          <TimeCell value={hours} label="Hours" />
          <TimeCell value={minutes} label="Minutes" />
          <TimeCell value={seconds} label="Seconds" />
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-4 text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
          <span className="rounded-full border border-gold/15 bg-card/10 px-4 py-2">Shader pulse</span>
          <span className="rounded-full border border-gold/15 bg-card/10 px-4 py-2">Live feed ready</span>
          <span className="rounded-full border border-gold/15 bg-card/10 px-4 py-2">Atmospheric sync</span>
          <span className="rounded-full border border-gold/15 bg-card/10 px-4 py-2">Precision timing</span>
        </div>

        <div className="mt-14 max-w-md text-center font-serif-italic text-sm text-muted-foreground/80 sm:text-base">
          The final ten seconds will be displayed in full screen.
        </div>
      </section>

      <footer className="mt-auto pt-16 text-center text-[10px] uppercase tracking-[0.4em] text-muted-foreground/60">
        © Geeth Munasinghe — All eyes on the launch
      </footer>
    </div>
  );
}

function TimeCell({ value, label }: { value: number; label: string }) {
  const padded = String(Math.max(0, value)).padStart(2, "0");
  return (
    <div className="relative flex min-w-[96px] flex-col items-center sm:min-w-[150px]">
      <div className="relative overflow-hidden rounded-[2rem] border border-gold/10 bg-card/50 px-6 py-8 sm:px-10 sm:py-12">
        <span
          className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-40"
          style={{
            background: 'radial-gradient(circle at 50% 15%, rgba(255, 245, 175, 0.14), transparent 30%), radial-gradient(circle at 85% 80%, rgba(255, 205, 85, 0.08), transparent 45%)',
          }}
        />
        <span
          className="pointer-events-none absolute inset-x-6 top-5 h-1 rounded-full bg-gradient-to-r from-gold/60 via-transparent to-transparent blur-sm"
        />
        <span
          className="pointer-events-none absolute inset-x-6 bottom-5 h-1 rounded-full bg-gradient-to-l from-gold/60 via-transparent to-transparent blur-sm"
        />
        <div className="relative font-display text-[6.75rem] text-gold-gradient sm:text-[7.5rem] md:text-[8rem] lg:text-[8.5rem] tabular-nums tracking-[-0.05em] leading-none animate-neon-pulse animate-neon-flicker-fast">
          {padded}
        </div>
      </div>
      <div className="mt-4 text-[11px] uppercase tracking-[0.45em] text-muted-foreground sm:text-sm">
        {label}
      </div>
    </div>
  );
}

/* ---------- Cinematic 10s ---------- */

function CinematicCountdown({ remainingSec }: { remainingSec: number }) {
  const n = Math.max(1, Math.min(10, Math.ceil(remainingSec)));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <AmbientBackdrop intense />
      <div
        key={n}
        className="font-display text-gold-gradient animate-count-pop animate-gold-shimmer leading-none tabular-nums"
        style={{
          fontSize: "min(72vh, 60vw)",
          textShadow: "0 0 80px color-mix(in oklab, var(--gold) 50%, transparent)",
        }}
      >
        {n}
      </div>
    </div>
  );
}

/* ---------- LIVE ---------- */

function LiveState() {
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex items-center gap-3 text-xs uppercase tracking-[0.5em] text-gold animate-reveal-up animate-neon-flicker-fast">
        <span className="h-2 w-2 rounded-full bg-gold animate-neon-pulse" />
        Live Now
        <span className="h-2 w-2 rounded-full bg-gold animate-neon-pulse" />
      </div>

      <h1
        className="font-display text-cream leading-[0.95] animate-reveal-up animate-neon-flicker-fast"
        style={{ fontSize: "clamp(2.75rem, 9vw, 9rem)" }}
      >
        GEETHMUNASINGHE<span className="text-gold-gradient animate-gold-shimmer animate-neon-pulse">.LK</span>
      </h1>
      <div
        className="mt-2 font-serif-italic text-cream/80 animate-reveal-up"
        style={{ fontSize: "clamp(1.5rem, 4vw, 3rem)", animationDelay: "0.3s" }}
      >
        is live now
      </div>

      <a
        href={ENTER_URL}
        className="group relative mt-14 inline-flex items-center gap-4 overflow-hidden rounded-full border-2 border-gold/80 bg-gradient-to-b from-gold-bright/95 to-gold-deep px-12 py-5 font-display text-xl tracking-[0.4em] text-obsidian transition-all duration-500 hover:scale-[1.05] animate-reveal-up animate-neon-pulse animate-neon-flicker-fast animate-neon-cta sm:text-2xl"
        style={{ animationDelay: "0.6s" }}
      >
        <span className="relative z-10 animate-neon-flicker">Enter Now</span>
        <svg className="relative z-10 h-5 w-5 transition-transform duration-500 group-hover:translate-x-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
        <span className="pointer-events-none absolute inset-0 animate-neon-sweep bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      </a>

      <p className="mt-14 max-w-md font-serif-italic text-sm text-muted-foreground animate-reveal-up" style={{ animationDelay: "0.9s" }}>
        Welcome to the new era of GMS / GEN-ZCIENCE
      </p>
    </div>
  );
}
