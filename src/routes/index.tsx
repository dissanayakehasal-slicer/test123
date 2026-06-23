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
    () => new Date("2026-06-23T12:06:00.000Z").getTime(),
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
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <header className="mb-14 flex flex-col items-center text-center animate-reveal-up">
        <div className="mb-6 flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-gold">
          <span className="h-px w-10 bg-gold/50" />
          GMS · GEN-ZCIENCE
          <span className="h-px w-10 bg-gold/50" />
        </div>
        <h1 className="font-display text-4xl text-cream sm:text-5xl md:text-6xl">
          GEETHMUNASINGHE<span className="text-gold-gradient">.LK</span>
        </h1>
        <p className="mt-5 font-serif-italic text-lg text-muted-foreground sm:text-xl">
          A new chapter is about to be revealed
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

        <div className="grid grid-cols-4 gap-3 sm:gap-6">
          <TimeCell value={days} label="Days" />
          <TimeCell value={hours} label="Hours" />
          <TimeCell value={minutes} label="Minutes" />
          <TimeCell value={seconds} label="Seconds" />
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
    <div className="relative flex min-w-[72px] flex-col items-center sm:min-w-[120px]">
      <div className="ring-gold rounded-md bg-card/60 px-4 py-6 backdrop-blur-sm sm:px-8 sm:py-10">
        <div className="font-display text-5xl text-gold-gradient sm:text-7xl md:text-8xl tabular-nums">
          {padded}
        </div>
      </div>
      <div className="mt-3 text-[10px] uppercase tracking-[0.4em] text-muted-foreground sm:text-xs">
        {label}
      </div>
    </div>
  );
}

/* ---------- Cinematic 10s ---------- */

function CinematicCountdown({ remainingSec }: { remainingSec: number }) {
  const n = Math.max(1, Math.min(10, Math.ceil(remainingSec)));
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastPlayedRef = useRef<number | null>(null);

  // Initialize AudioContext on first mount
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log(`[Audio] Created Web Audio Context`);
    }
  }, []);

  // Play beep on each second transition
  useEffect(() => {
    if (lastPlayedRef.current !== n && n >= 1 && n <= 10) {
      lastPlayedRef.current = n;
      
      const ctx = audioContextRef.current;
      if (ctx) {
        try {
          // Resume context if suspended (required in some browsers)
          if (ctx.state === 'suspended') {
            ctx.resume();
          }

          // Create oscillator for beep
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          // Beep parameters
          osc.frequency.value = 1000; // 1kHz beep
          osc.type = 'sine';
          
          // Fade in and out to avoid clicks
          const now = ctx.currentTime;
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
          gain.gain.linearRampToValueAtTime(0, now + 0.2);
          
          osc.start(now);
          osc.stop(now + 0.2);
          
          console.log(`[Audio] Played beep for second ${n}`);
        } catch (err: any) {
          console.error(`[Audio] Failed to play beep:`, err?.message || err);
        }
      }
    }
  }, [n]);

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
      <div className="mb-6 flex items-center gap-3 text-xs uppercase tracking-[0.5em] text-gold animate-reveal-up">
        <span className="h-2 w-2 rounded-full bg-gold animate-slow-pulse" />
        Live Now
        <span className="h-2 w-2 rounded-full bg-gold animate-slow-pulse" />
      </div>

      <h1
        className="font-display text-cream leading-[0.95] animate-reveal-up"
        style={{ fontSize: "clamp(2.5rem, 9vw, 8rem)" }}
      >
        GEETHMUNASINGHE<span className="text-gold-gradient animate-gold-shimmer animate-neon-flicker">.LK</span>
      </h1>
      <div
        className="mt-2 font-serif-italic text-cream/80 animate-reveal-up"
        style={{ fontSize: "clamp(1.5rem, 4vw, 3rem)", animationDelay: "0.3s" }}
      >
        is live now
      </div>

      <a
        href={ENTER_URL}
        className="group relative mt-14 inline-flex items-center gap-4 overflow-hidden rounded-full border-2 border-gold/80 bg-gradient-to-b from-gold-bright/95 to-gold-deep px-12 py-5 font-display text-xl tracking-[0.4em] text-obsidian transition-all duration-500 hover:scale-[1.05] animate-reveal-up animate-neon-pulse animate-neon-cta animate-floating sm:text-2xl"
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
