import { useEffect, useState } from 'react';

interface BreakTimerProps {
  /** ISO timestamp de cuándo empezó la colación */
  startedAt: string;
  /** Clase CSS adicional */
  className?: string;
  /** Si es true, muestra en formato grande (HH:MM:SS); si no, compacto (Xh Ym) */
  large?: boolean;
}

/**
 * Muestra el tiempo transcurrido desde startedAt.
 * Se actualiza cada 30 segundos.
 */
export function BreakTimer({ startedAt, className = '', large = false }: BreakTimerProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = formatElapsed(new Date(startedAt));

  if (large) {
    return <div className={`font-mono font-bold ${className}`}>{elapsed.large}</div>;
  }
  return <span className={`font-mono ${className}`}>{elapsed.short}</span>;
}

/**
 * Componente que muestra la duración de una colación ya finalizada.
 */
export function BreakDuration({
  startedAt,
  endedAt,
  className = '',
}: {
  startedAt: string;
  endedAt: string;
  className?: string;
}) {
  const elapsed = formatElapsed(new Date(startedAt), new Date(endedAt));
  return <span className={`font-mono ${className}`}>{elapsed.short}</span>;
}

function formatElapsed(start: Date, end: Date = new Date()): { short: string; large: string } {
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return { short: '0m', large: '00:00:00' };

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Formato grande: HH:MM:SS
  const large = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Formato corto: Xh Ym / Ym
  let short: string;
  if (hours > 0) {
    short = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    short = `${minutes}m`;
  } else {
    short = `${seconds}s`;
  }

  return { short, large };
}
