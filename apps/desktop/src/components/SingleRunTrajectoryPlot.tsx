import { Component, createMemo, createSignal, For, Show } from "solid-js";
import type { RunHorizonPoint } from "../utils/runs";

export interface SingleRunTrajectoryPlotProps {
  points: RunHorizonPoint[];
  h?: number;
}

export const SingleRunTrajectoryPlot: Component<SingleRunTrajectoryPlotProps> = (props) => {
  const [hovered, setHovered] = createSignal<{
    step: number;
    value: number;
    classCode: number;
    label: string;
    xPx: number;
    yPx: number;
  } | null>(null);

  const svgWidth = 700;
  const svgHeight = 160;
  const padLeft = 45;
  const padRight = 35;
  const padTop = 15;
  const padBottom = 25;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const maxVal = createMemo(() => {
    let mv = 100;
    for (const p of props.points) {
      if (p.value > mv) mv = p.value;
    }
    return mv + 15;
  });

  const horizonSteps = createMemo(() => props.h || props.points.length || 4);
  const getX = (idx: number) => padLeft + (idx / Math.max(1, horizonSteps() - 1)) * plotW;
  const getY = (val: number) => padTop + plotH - (Math.min(val, maxVal()) / maxVal()) * plotH;

  const pathD = createMemo(() => {
    return props.points.reduce((acc, p, i) => {
      const x = getX(i);
      const y = getY(p.value);
      return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, "");
  });

  const areaD = createMemo(() => {
    const pts = props.points;
    if (pts.length === 0) return "";
    const pD = pathD();
    return `${pD} L ${getX(pts.length - 1)} ${padTop + plotH} L ${getX(0)} ${padTop + plotH} Z`;
  });

  return (
    <div class="relative w-full overflow-visible trajectory-chart-container bg-slate-50/80 dark:bg-slate-950/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800/80">
      {/* Floating Reactive Tooltip */}
      <Show when={hovered()}>
        {(pt) => {
          const isNearTop = () => pt().yPx < 75;
          return (
            <div
              class={`absolute pointer-events-none z-30 px-3 py-2 rounded-xl bg-slate-900/95 dark:bg-slate-900/95 text-white border border-slate-700/80 shadow-2xl backdrop-blur-md transition-all duration-75 text-xs font-mono -translate-x-1/2 ${
                isNearTop() ? "translate-y-3" : "-translate-y-full mb-2.5"
              } min-w-35`}
              style={{
                left: `${Math.max(80, Math.min(620, pt().xPx))}px`,
                top: `${pt().yPx}px`,
              }}
            >
              <div class="flex items-center justify-between gap-3 text-[10px] pb-1 border-b border-slate-800 text-slate-400">
                <span>Step t=n+{pt().step}</span>
                <span
                  class={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                    pt().classCode === 3
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      : pt().classCode === 2
                        ? "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                        : pt().classCode === 1
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  }`}
                >
                  {pt().label}
                </span>
              </div>
              <div class="flex items-baseline space-x-1.5 pt-1">
                <span class="text-slate-400 text-[10px]">Predicted PFVI:</span>
                <span class="text-sm font-black text-cyan-400">{pt().value.toFixed(2)}</span>
              </div>
            </div>
          );
        }}
      </Show>

      <div class="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          class="w-full h-40 overflow-visible select-none"
        >
          <defs>
            <linearGradient id="horizonAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.35" />
              <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.0" />
            </linearGradient>
          </defs>

          {/* Shaded Risk Zones in Background */}
          <rect
            x={padLeft}
            y={getY(maxVal())}
            width={plotW}
            height={Math.max(0, getY(85) - getY(maxVal()))}
            fill="#f43f5e"
            fill-opacity="0.08"
          />
          <rect
            x={padLeft}
            y={getY(85)}
            width={plotW}
            height={Math.max(0, getY(60) - getY(85))}
            fill="#f97316"
            fill-opacity="0.06"
          />
          <rect
            x={padLeft}
            y={getY(60)}
            width={plotW}
            height={Math.max(0, getY(30) - getY(60))}
            fill="#f59e0b"
            fill-opacity="0.05"
          />
          <rect
            x={padLeft}
            y={getY(30)}
            width={plotW}
            height={Math.max(0, padTop + plotH - getY(30))}
            fill="#10b981"
            fill-opacity="0.05"
          />

          {/* Grid lines */}
          <line
            x1={padLeft}
            y1={getY(30)}
            x2={padLeft + plotW}
            y2={getY(30)}
            stroke="#10b981"
            stroke-opacity="0.25"
            stroke-dasharray="3,3"
          />
          <line
            x1={padLeft}
            y1={getY(60)}
            x2={padLeft + plotW}
            y2={getY(60)}
            stroke="#f59e0b"
            stroke-opacity="0.25"
            stroke-dasharray="3,3"
          />
          <line
            x1={padLeft}
            y1={getY(85)}
            x2={padLeft + plotW}
            y2={getY(85)}
            stroke="#f97316"
            stroke-opacity="0.25"
            stroke-dasharray="3,3"
          />

          {/* Area Fill */}
          <path d={areaD()} fill="url(#horizonAreaGrad)" />

          {/* Continuous Trajectory Line */}
          <path
            d={pathD()}
            fill="none"
            stroke="#06b6d4"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          {/* Interactive Data Points */}
          <For each={props.points}>
            {(p, i) => {
              const x = () => getX(i());
              const y = () => getY(p.value);
              const pointColor = () =>
                p.classCode === 3
                  ? "#f43f5e"
                  : p.classCode === 2
                    ? "#f97316"
                    : p.classCode === 1
                      ? "#f59e0b"
                      : "#10b981";

              const isHov = () => hovered()?.step === p.step;

              return (
                <g
                  class="cursor-pointer"
                  onMouseEnter={(e: MouseEvent) => {
                    const currentTarget = e.currentTarget as SVGElement;
                    const container = currentTarget.closest(
                      ".trajectory-chart-container",
                    ) as HTMLElement;
                    if (container) {
                      const containerRect = container.getBoundingClientRect();
                      const targetRect = currentTarget.getBoundingClientRect();
                      setHovered({
                        step: p.step,
                        value: p.value,
                        classCode: p.classCode,
                        label: p.label,
                        xPx: targetRect.left + targetRect.width / 2 - containerRect.left,
                        yPx: targetRect.top - containerRect.top,
                      });
                    }
                  }}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* Transparent enlarged hit target */}
                  <circle cx={x()} cy={y()} r="16" fill="transparent" />

                  {/* Outer pulse ring on hover */}
                  <Show when={isHov()}>
                    <circle cx={x()} cy={y()} r="11" fill={pointColor()} fill-opacity="0.3" />
                  </Show>

                  {/* Core dot */}
                  <circle
                    cx={x()}
                    cy={y()}
                    r={isHov() ? "7" : "5"}
                    fill={pointColor()}
                    stroke="#ffffff"
                    stroke-width="2"
                    class="transition-all duration-150"
                  />

                  {/* Value label */}
                  <text
                    x={x()}
                    y={y() - 10}
                    text-anchor="middle"
                    font-size="10"
                    font-family="monospace"
                    font-weight="bold"
                    fill={pointColor()}
                    class="transition-opacity duration-150 pointer-events-none"
                  >
                    {p.value.toFixed(1)}
                  </text>

                  {/* Step label on bottom axis */}
                  <text
                    x={x()}
                    y={padTop + plotH + 16}
                    text-anchor="middle"
                    font-size="10"
                    font-family="monospace"
                    fill="#64748b"
                  >
                    t=n+{p.step}
                  </text>
                </g>
              );
            }}
          </For>
        </svg>
      </div>
    </div>
  );
};
