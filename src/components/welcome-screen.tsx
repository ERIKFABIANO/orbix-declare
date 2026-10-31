"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { WelcomeLogo, type WelcomePhase } from "@/components/welcome-logo";
import styles from "./welcome-screen.module.css";

const subscribeMotion = (callback: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};

// Stable coordinates keep SSR and hydration identical.
const STARS = Array.from({ length: 180 }, (_, index) => {
  const x = ((index * 7919 + 113) % 1280);
  const y = ((index * 3571 + 79) % 720);
  return { x, y, radius: 0.45 + (index % 4) * 0.2, opacity: 0.15 + (index % 6) * 0.08 };
});

export const WELCOME_KEY = "orbix.welcome";

/** Linha do tempo das boas-vindas, em ms desde que a tela abre. */
interface WelcomeTiming {
  total: number;
  arrivalAt: number;
  holdAt: number;
  exitAt: number;
  /** Duração das animações de chegada e de saída da logo. */
  arrival: number;
  exit: number;
}
/** Primeira vez neste navegador: 4 s, com a chegada completa. */
const FIRST: WelcomeTiming = { total: 4000, arrivalAt: 300, holdAt: 1500, exitAt: 3000, arrival: 1200, exit: 1000 };
/** Vezes seguintes: 1,8 s, mesma sequência comprimida. */
const REPEAT: WelcomeTiming = { total: 1800, arrivalAt: 50, holdAt: 650, exitAt: 1100, arrival: 600, exit: 700 };

/**
 * Duração das boas-vindas: 4 s na primeira vez neste navegador (localStorage) e 1,8 s nas seguintes.
 * Marca como vista ao decidir. Com redução de movimento toca a versão calma, com a mesma duração.
 */
export function welcomeDuration(): number {
  try {
    if (window.localStorage.getItem(WELCOME_KEY) === "seen") return REPEAT.total;
    window.localStorage.setItem(WELCOME_KEY, "seen");
  } catch {
    /* storage bloqueado: toca a versão completa, só não fica lembrada */
  }
  return FIRST.total;
}

/** Transição depois da sincronização (ver welcomeDuration); clique ou Esc/Enter/espaço pulam direto ao painel. */
export function WelcomeScreen({ duration = FIRST.total }: { duration?: number }) {
  const timing = duration === REPEAT.total ? REPEAT : FIRST;
  const router = useRouter();
  const { t } = useI18n();
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const [loaded, setLoaded] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<WelcomePhase>("loading");
  const heading = useRef<HTMLHeadingElement>(null);
  // Caixa onde a logo aparece em repouso; o canvas em si cobre a tela toda (sem corte no voo final).
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    router.prefetch("/painel");
  }, [router]);

  // A linha do tempo corre desde a abertura da tela: um modelo lento nunca segura o acesso ao painel
  // (a logo entra assim que carregar; até lá aparece o texto de reserva).
  useEffect(() => {
    if (loaded === null) return;
    const { total, arrivalAt, holdAt, exitAt } = timing;
    const timers = [
      setTimeout(() => setPhase("arrival"), reduced ? 0 : arrivalAt),
      setTimeout(() => setPhase("hold"), reduced ? 100 : holdAt),
      setTimeout(() => setPhase("exit"), reduced ? total - 300 : exitAt),
      setTimeout(() => router.replace("/painel"), total),
    ];
    return () => timers.forEach(clearTimeout);
  }, [loaded, timing, reduced, router]);

  // Pular: Esc/Enter/espaço (o clique está no <main>).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") router.replace("/painel");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <main
      className={styles.welcome}
      data-phase={phase}
      data-loaded={loaded === true}
      aria-busy="true"
      onClick={() => router.replace("/painel")}
      style={
        {
          "--welcome-fill": `${timing.total - timing.arrivalAt}ms`,
          "--welcome-arrival": `${timing.arrival}ms`,
          "--welcome-exit": `${timing.exit}ms`,
        } as React.CSSProperties
      }
    >
      <svg className={styles.sky} viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {STARS.map((star, index) => <g key={index} opacity={star.opacity}>
          <circle cx={star.x} cy={star.y} r={star.radius} fill="#e5dfff" />
          <line className={styles.ray} x1={star.x} y1={star.y} x2={star.x + (star.x - 640) * 0.28} y2={star.y + (star.y - 360) * 0.28} stroke="#c9bcf7" strokeWidth="0.65" />
        </g>)}
      </svg>
      <section className={styles.composition}>
        <h1 ref={heading} tabIndex={-1} className={styles.heading}>
          {t.welcome.title}<span className="sr-only"> Orbix Declare</span>
        </h1>
        <div className={styles.stage}>
          <svg className={styles.orbit} viewBox="0 0 900 320" aria-hidden="true">
            <g transform="rotate(-10 450 160)">
              <ellipse cx="450" cy="160" rx="418" ry="82" pathLength="1" className={styles.ring} />
              <g>
                <circle r="10" fill="#c9bcf7" opacity="0.06" />
                <circle r="3" fill="#e5dfff" />
                {reduced ? <animateTransform attributeName="transform" type="translate" values="868 160;868 160" dur="1s" fill="freeze" /> : <animateMotion dur="18s" repeatCount="indefinite" path="M868,160 a418,82 0 1,0 -836,0 a418,82 0 1,0 836,0" />}
              </g>
            </g>
          </svg>
          <div ref={frame} className={styles.model} aria-hidden="true" />
          {loaded !== true && <div className={styles.fallback} aria-hidden="true"><span>Orbix</span> Declare</div>}
        </div>
        <div className={styles.status} role="status" aria-live="polite">
          <div className={styles.track} aria-hidden="true"><span /></div>
          <p>{t.welcome.opening}</p>
        </div>
      </section>
      <div className={styles.canvas}>
        <WelcomeLogo
          frame={frame}
          phase={phase}
          reduced={reduced}
          arrivalSec={timing.arrival / 1000}
          exitSec={timing.exit / 1000}
          onReady={setLoaded}
        />
      </div>
    </main>
  );
}
