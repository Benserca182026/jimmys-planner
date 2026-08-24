"use client";

const COLOR_LISTO = "#3b5bfd";
const COLOR_PROCESO = "#12b3a8";
const COLOR_TERMINADO = "#f0a13a";

export function Donut({
  listo,
  enProceso,
  terminado,
  tamano = 144,
}: {
  listo: number;
  enProceso: number;
  terminado: number;
  tamano?: number;
}) {
  const total = Math.max(listo + enProceso + terminado, 1);
  const R = 54;
  const C = 2 * Math.PI * R;
  const gap = 3;
  const seg = (v: number) => Math.max((v / total) * C - gap, 0);
  let offset = -C / 4;
  const segmentos = [
    { v: listo, color: COLOR_LISTO },
    { v: enProceso, color: COLOR_PROCESO },
    { v: terminado, color: COLOR_TERMINADO },
  ].map((s) => {
    const el = { ...s, dash: `${seg(s.v)} ${C}`, off: -offset };
    offset += (s.v / total) * C;
    return el;
  });
  return (
    <svg viewBox="0 0 140 140" style={{ width: tamano, height: tamano }}>
      {segmentos.map((s, i) => (
        <circle
          key={i}
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke={s.color}
          strokeWidth="16"
          strokeDasharray={s.dash}
          strokeDashoffset={s.off}
        />
      ))}
    </svg>
  );
}
