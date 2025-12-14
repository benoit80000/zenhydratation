import { memo, useEffect, useRef, useState } from "react";

type ClockProps = {
  /** Intervalle en ms (par défaut 1000) */
  intervalMs?: number;
  /** Format d'affichage (par défaut HH:mm:ss) */
  formatter?: (d: Date) => string;
};

function ClockInner({ intervalMs = 1000, formatter }: ClockProps) {
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Important: effet monté une seule fois (pas de dépendances changeantes)
    intervalRef.current = window.setInterval(() => {
      // Update simple, ne touche qu'à ce composant
      setNow(Date.now());
    }, intervalMs);

    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [intervalMs]);

  const d = new Date(now);
  const text = formatter ? formatter(d) : d.toLocaleTimeString();

  return <span>{text}</span>;
}

export const Clock = memo(ClockInner);
