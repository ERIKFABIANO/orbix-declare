"use client";

import { OrbixSignature } from "@/components/orbix-signature";

/**
 * Tela de abertura (recriação em SVG/CSS de docs/Orbix Loading.mp4).
 *
 * Aparece a cada carregamento do site, por cima do app, enquanto as fontes e a sessão carregam;
 * depois some com fade e revela a página. Dura pelo menos 5 s na primeira visita neste navegador
 * (localStorage["orbix.splash"]) e 2,5 s nas seguintes. A barra acompanha etapas reais, distribuídas
 * ao longo desse tempo mínimo.
 *
 * - Não aparece em /v/* (verificação pública deve abrir direto).
 * - Clique, Esc, Enter ou espaço pulam a abertura.
 * - Logo 3D (splash-logo.tsx, public/od-logo.glb) no centro das órbitas: o download do modelo conta
 *   como etapa real (com teto de 3 s), dá uma volta no "Tudo pronto" e encolhe na saída.
 * - Com prefers-reduced-motion aparece a versão calma: órbitas, cometa e logo parados; a barra continua.
 *   (Não pular: no Windows, "efeitos de animação" desligados também ligam essa preferência.)
 */
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { SplashLogo, type LogoPhase } from "@/components/splash-logo";


export const SPLASH_KEY = "orbix.splash";
/** Duração mínima da abertura: primeira visita neste navegador e visitas seguintes. */
const FIRST_MS = 5000;
const REPEAT_MS = 2500;
/** Sequência final: do "sessão conhecida" até começar o fade, e o fade em si. */
const FINALE_MS = 1450;
const FADE_MS = 650;

/** Progresso visual contínuo até 99%; 100% só aparece quando tudo está pronto. */
export function splashProgressAt(elapsed: number, minimum: number) {
  return Math.min(99, Math.max(0, Math.round((elapsed / minimum) * 100)));
}

function isFirstVisit() {
  try {
    return window.localStorage.getItem(SPLASH_KEY) !== "seen";
  } catch {
    return false;
  }
}

type Timing = { start: number; min: number };
/** Início e duração mínima, definidos na primeira leitura no cliente (no servidor não há localStorage). */
function timingOf(ref: { current: Timing | null }): Timing {
  return (ref.current ??= { start: Date.now(), min: isFirstVisit() ? FIRST_MS : REPEAT_MS });
}

/** Etapas da barra; os textos vêm do dicionário (t.splash). */
const STEPS = [
  { pct: 0, key: null },
  { pct: 20, key: "connecting" },
  { pct: 62, key: "preparing" },
  { pct: 99, key: "opening" },
  { pct: 100, key: "ready" },
] as const;

/* ---------- Céu: estrelas determinísticas (mesmo resultado no servidor e no cliente) ---------- */

function stars(count: number, seed: number) {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.round(rnd() * 12800) / 10,
    y: Math.round(rnd() * 7200) / 10,
    r: Math.round((0.4 + rnd() * 0.9) * 100) / 100,
    o: Math.round((0.25 + rnd() * 0.6) * 100) / 100,
    twinkle: rnd() < 0.18,
    delay: Math.round(rnd() * 40) / 10,
  }));
}

/* Órbitas: elipses inclinadas como no vídeo (viewBox 1280×720). */
const OUTER = { cx: 640, cy: 299, rx: 508, ry: 150 };
const INNER = { cx: 640, cy: 299, rx: 286, ry: 84 };
const TILT = -10;
const ellipsePath = ({ cx, cy, rx, ry }: typeof OUTER) =>
  `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`;

const PLANETS = [
  { orbit: OUTER, dur: 22, begin: 0, r: 3.2 },
  { orbit: OUTER, dur: 22, begin: -9, r: 2.4 },
  { orbit: OUTER, dur: 22, begin: -16, r: 2.8 },
  { orbit: INNER, dur: 14, begin: -3, r: 2.6 },
  { orbit: INNER, dur: 14, begin: -10, r: 2.2 },
];


function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export function SplashGate() {
  const pathname = usePathname();
  const [done, setDone] = useState(false);
  if (done || pathname.startsWith("/v/")) return null;
  return <SplashScreen onDone={() => setDone(true)} />;
}

function SplashScreen({ onDone }: { onDone: () => void }) {
  const { status } = useSession();
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [logoSettled, setLogoSettled] = useState(false);
  const sky = useMemo(() => stars(150, 7), []);
  const timing = useRef<Timing | null>(null);

  // A barra avança continuamente durante o tempo mínimo; as etapas abaixo mudam apenas o texto.
  useEffect(() => {
    const { start, min } = timingOf(timing);
    const update = () => setProgress(splashProgressAt(Date.now() - start, min));
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, []);

  // Etapas: cada uma espera um evento real + uma fração do tempo mínimo, para a barra andar de forma legível.
  useEffect(() => {
    let alive = true;
    const { min } = timingOf(timing);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(min * 0.1);
      if (!alive) return;
      setStep(1); // conexão: a página hidratou
      await Promise.all([document.fonts?.ready ?? Promise.resolve(), wait(min * 0.2)]);
      if (!alive) return;
      setStep(2); // ambiente: fontes prontas
    })();
    return () => {
      alive = false;
    };
  }, []);

  // A logo 3D não pode segurar a abertura: depois de 1,5 s segue sem ela.
  useEffect(() => {
    const t = setTimeout(() => setLogoSettled(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Sequência final: dispara uma vez quando o ambiente, a logo e a sessão estão prontos.
  // Depende de `envReady` (não de `step`) para os próprios avanços de etapa não cancelarem os timers.
  const envReady = step >= 2;
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // Encerra uma única vez: marca como vista neste navegador, faz o fade e desmonta.
  const left = useRef(false);
  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    setLeaving(true);
    try {
      window.localStorage.setItem(SPLASH_KEY, "seen");
    } catch {
      /* storage bloqueado: a abertura só não fica lembrada */
    }
    setTimeout(() => onDoneRef.current(), FADE_MS);
  }, []);

  useEffect(() => {
    if (!envReady || !logoSettled || status === "loading") return;
    // Se tudo carregou antes do tempo mínimo, a sequência final espera para terminar nele.
    const { start, min } = timingOf(timing);
    const lead = Math.max(0, start + min - FINALE_MS - FADE_MS - Date.now());
    const timers = [
      setTimeout(() => setStep(3), lead + 250), // sessão conhecida
      setTimeout(() => setStep(4), lead + 500), // "Tudo pronto": a logo dá uma volta (800 ms)
      setTimeout(() => setExiting(true), lead + 1300), // logo encolhe
      setTimeout(() => leave(), lead + FINALE_MS), // a logo já está pela metade: o resto some em fade
    ];
    return () => timers.forEach(clearTimeout);
  }, [envReady, logoSettled, status, leave]);

  // Pular: clique ou Esc/Enter/espaço encerram a abertura na hora.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") leave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leave]);

  const { key } = STEPS[step];
  const pct = step >= 4 ? 100 : progress;
  const label = key ? t.splash[key] : "";
  const logoPhase: LogoPhase = exiting ? "exit" : step >= 4 ? "spin" : "idle";

  return (
    <div
      className={`splash fixed inset-0 z-[100] overflow-hidden bg-brand-night text-brand-paper transition-opacity duration-[650ms] ease-out ${leaving ? "pointer-events-none opacity-0" : "opacity-100"}`}
      role="status"
      aria-live="polite"
      onClick={leave}
      aria-label={label ? t.splash.progress(label, pct) : t.splash.loading}
    >
      {/* Nebulosas */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_48%_42%_at_42%_24%,#2a2d5e_0%,transparent_70%),radial-gradient(ellipse_30%_30%_at_78%_78%,#2f2849_0%,transparent_72%)]"
      />

      {/* Céu: estrelas cobrindo a tela inteira */}
      <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
        {sky.map((s) => (
          <circle
            key={s.id}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="#ffffff"
            opacity={s.o}
            className={s.twinkle && !reduced ? "splash-twinkle" : undefined}
            style={s.twinkle ? { animationDelay: `-${s.delay}s` } : undefined}
          />
        ))}
      </svg>

      {/*
        Órbitas: SVG próprio em 16:9. No horizontal cobre a tela (como o vídeo);
        no vertical fica centralizado e mais estreito, para as órbitas caberem acima do título.
      */}
      <div className="absolute top-1/2 left-1/2 aspect-video w-[max(100vw,177.78vh)] -translate-x-1/2 -translate-y-1/2 portrait:top-[38%] portrait:w-[165vw]">
        <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 1280 720">
          <defs>
            <radialGradient id="planet-glow">
              <stop offset="0%" stopColor="#c9bcf7" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#c9bcf7" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g transform={`rotate(${TILT} 640 299)`} fill="none" stroke="#8f8cc7" strokeWidth="1">
            <path d={ellipsePath(OUTER)} strokeOpacity="0.11" />
            <path d={ellipsePath(INNER)} strokeOpacity="0.14" />
            {PLANETS.map((p, i) => {
              const path = ellipsePath(p.orbit);
              const start = ((-p.begin / p.dur) % 1).toFixed(3);
              return (
                <g key={i} stroke="none">
                  {reduced ? (
                    // Parado: ponto fixo da órbita, calculado pela equação da elipse
                    <g
                      transform={`translate(${p.orbit.cx + p.orbit.rx * Math.cos(Number(start) * 2 * Math.PI)} ${p.orbit.cy + p.orbit.ry * Math.sin(Number(start) * 2 * Math.PI)})`}
                    >
                      <Planet r={p.r} />
                    </g>
                  ) : (
                    <g>
                      <Planet r={p.r} />
                      <animateMotion dur={`${p.dur}s`} begin={`${p.begin}s`} repeatCount="indefinite" path={path} />
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Logo 3D no centro das órbitas (cy 299 de 720 = 41,5%) */}
        <SplashLogo
          phase={logoPhase}
          reduced={reduced}
          onReady={() => setLogoSettled(true)}
          className="absolute top-[41.5%] left-1/2 aspect-square w-[min(30%,46vh)] -translate-x-1/2 -translate-y-1/2"
        />
      </div>

      {/* Cometa */}
      {!reduced && <div aria-hidden className="splash-comet absolute top-[22%] left-0 h-[2px] w-[220px]" />}

      {/* Marca + progresso */}
      <div className="absolute inset-x-0 top-[64%] flex flex-col items-center px-6 portrait:top-[58%]">
        <div className="splash-title flex flex-col items-center gap-2.5">
          <h1 className="m-0 font-display text-[clamp(34px,4.6vw,46px)] leading-none font-semibold tracking-[-0.015em]">
            <span className="text-gold">Orbix</span>{" "}<span className="text-[#b3a0f4]">Declare</span>
          </h1>
          <span className="font-mono text-[11px] tracking-[0.32em] text-brand-dim uppercase"><OrbixSignature text={t.common.byOrbix} /></span>
        </div>

        <div className="splash-bar mt-11 w-[min(400px,100%)]">
          <div className="relative h-px w-full bg-white/12">
            <div
              className="absolute inset-y-0 left-0 bg-linear-to-r from-transparent via-[#8b6ae8] to-[#c9bcf7] transition-[width] duration-150 ease-linear"
              style={{ width: `${pct}%` }}
            >
              <span className="absolute top-1/2 right-0 size-[6px] translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_3px_rgba(201,188,247,0.7)]" />
            </div>
          </div>
          <div className="mt-3.5 flex items-center justify-between text-[13px]">
            <span key={label} className="splash-label text-brand-lilac">
              {label}
            </span>
            <span className="font-mono text-xs text-brand-dim tabular-nums">{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Planet({ r }: { r: number }) {
  return (
    <>
      <circle r={r * 4.2} fill="url(#planet-glow)" />
      <circle r={r} fill="#e4dcff" />
    </>
  );
}
