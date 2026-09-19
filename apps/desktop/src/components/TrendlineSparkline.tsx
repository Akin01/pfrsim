import { Component, createMemo, Show } from "solid-js";

export interface TrendlineSparklineProps {
  data: (number | null | undefined)[];
  width?: number;
  height?: number;
  class?: string;
}

export const TrendlineSparkline: Component<TrendlineSparklineProps> = (props) => {
  const w = () => props.width ?? 78;
  const h = () => props.height ?? 24;

  const spark = createMemo(() => {
    const raw = props.data;
    if (!raw || raw.length === 0) return null;
    const valid = raw.filter((v): v is number => v != null && !isNaN(v) && isFinite(v));
    if (valid.length < 2) return null;

    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = max - min || 1;
    const pad = 3;
    const plotH = h() - pad * 2;
    const plotW = w() - pad * 2;

    const pts = valid.map((v, i) => {
      const x = pad + (i / (valid.length - 1)) * plotW;
      const y = pad + plotH - ((v - min) / range) * plotH;
      return { x, y };
    });

    const lineD = pts.reduce(
      (acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`,
      "",
    );
    const first = pts[0];
    const last = pts[pts.length - 1];
    const areaD = `${lineD} L ${last.x.toFixed(1)},${(h() - pad).toFixed(1)} L ${first.x.toFixed(1)},${(h() - pad).toFixed(1)} Z`;
    const isUp = last.y <= first.y;

    return {
      isUp,
      lineD,
      areaD,
      lastX: last.x,
      lastY: last.y,
      color: isUp ? "#10b981" : "#f43f5e",
      gradientId: `spark-grad-${Math.random().toString(36).slice(2, 8)}`,
    };
  });

  return (
    <Show when={spark()}>
      {(s) => (
        <svg
          width={w()}
          height={h()}
          viewBox={`0 0 ${w()} ${h()}`}
          class={`overflow-visible inline-block select-none ${props.class ?? ""}`}
        >
          <defs>
            <linearGradient id={s().gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color={s().color} stop-opacity="0.35" />
              <stop offset="100%" stop-color={s().color} stop-opacity="0.0" />
            </linearGradient>
          </defs>
          <path d={s().areaD} fill={`url(#${s().gradientId})`} />
          <path
            d={s().lineD}
            fill="none"
            stroke={s().color}
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx={s().lastX} cy={s().lastY} r="4.5" fill={s().color} opacity="0.3" />
          <circle
            cx={s().lastX}
            cy={s().lastY}
            r="2.2"
            fill={s().color}
            stroke="#ffffff"
            stroke-width="1"
          />
        </svg>
      )}
    </Show>
  );
};

export default TrendlineSparkline;
