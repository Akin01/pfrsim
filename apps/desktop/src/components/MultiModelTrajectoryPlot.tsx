import { Component, createMemo, createSignal, For, Show } from "solid-js";
import type { RunDetail } from "../lib/types";
import { getRunHorizonPoints } from "../utils/runs";

export interface MultiModelTrajectoryPlotProps {
  runs: RunDetail[];
  colors: string[];
  activeRunIdx?: number | null;
}

export const MultiModelTrajectoryPlot: Component<MultiModelTrajectoryPlotProps> = (props) => {
  const [hovered, setHovered] = createSignal<{
    runName: string;
    color: string;
    step: number;
    value: number;
    classCode: number;
    label: string;
    xPx: number;
    yPx: number;
  } | null>(null);

  const svgW = 720;
  const svgH = 160;
  const padL = 45;
  const padR = 35;
  const padT = 15;
  const padB = 25;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const runsPoints = createMemo(() => props.runs.map((r) => getRunHorizonPoints(r)));

  const maxVal = createMemo(() => {
    let mv = 100;
    for (const pts of runsPoints()) {
      for (const p of pts) {
        if (p.value > mv) mv = p.value;
      }
    }
    return mv + 15;
  });

  const getX = (stepIdx: number, total: number) =>
    padL + (stepIdx / Math.max(1, total - 1)) * plotW;
  const getY = (val: number) => padT + plotH - (Math.min(val, maxVal()) / maxVal()) * plotH;

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
              } min-w-40`}
              style={{
                left: `${Math.max(90, Math.min(630, pt().xPx))}px`,
                top: `${pt().yPx}px`,
              }}
            >
              <div class="flex items-center space-x-1.5 pb-1 border-b border-slate-800 mb-1">
                <span
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ "background-color": pt().color }}
                />
                <span class="font-bold text-[11px] truncate max-w-40 text-slate-100">
                  {pt().runName}
                </span>
              </div>
              <div class="flex items-center justify-between text-[10px] text-slate-400">
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
                <span class="text-sm font-black text-emerald-400">{pt().value.toFixed(2)}</span>
              </div>
            </div>
          );
        }}
      </Show>

      <div class="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} class="w-full h-40 overflow-visible select-none">
          {/* Shaded Risk Zones */}
          <rect
            x={padL}
            y={getY(maxVal())}
            width={plotW}
            height={Math.max(0, getY(85) - getY(maxVal()))}
            fill="#f43f5e"
            fill-opacity="0.08"
          />
          <rect
            x={padL}
            y={getY(85)}
            width={plotW}
            height={Math.max(0, getY(60) - getY(85))}
            fill="#f97316"
            fill-opacity="0.06"
          />
          <rect
            x={padL}
            y={getY(60)}
            width={plotW}
            height={Math.max(0, getY(30) - getY(60))}
            fill="#f59e0b"
            fill-opacity="0.05"
          />
          <rect
            x={padL}
            y={getY(30)}
            width={plotW}
            height={Math.max(0, padT + plotH - getY(30))}
            fill="#10b981"
            fill-opacity="0.05"
          />

          {/* Threshold lines */}
          <line
            x1={padL}
            y1={getY(30)}
            x2={padL + plotW}
            y2={getY(30)}
            stroke="#10b981"
            stroke-opacity="0.25"
            stroke-dasharray="3,3"
          />
          <line
            x1={padL}
            y1={getY(60)}
            x2={padL + plotW}
            y2={getY(60)}
            stroke="#f59e0b"
            stroke-opacity="0.25"
            stroke-dasharray="3,3"
          />
          <line
            x1={padL}
            y1={getY(85)}
            x2={padL + plotW}
            y2={getY(85)}
            stroke="#f97316"
            stroke-opacity="0.25"
            stroke-dasharray="3,3"
          />

          {/* Lines and interactive data points for each model */}
          <For each={runsPoints()}>
            {(pts, rIdx) => {
              const color = () => props.colors[rIdx() % props.colors.length];
              const runName = () => props.runs[rIdx()]?.summary.name ?? `Model ${rIdx() + 1}`;
              const pathD = () =>
                pts.reduce((acc, p, i) => {
                  const x = getX(i, pts.length);
                  const y = getY(p.value);
                  return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
                }, "");

              const isDimmed = () =>
                props.activeRunIdx !== null &&
                props.activeRunIdx !== undefined &&
                props.activeRunIdx !== rIdx();
              const isHighlight = () => props.activeRunIdx === rIdx();

              return (
                <g class="transition-opacity duration-150" opacity={isDimmed() ? "0.2" : "1"}>
                  <path
                    d={pathD()}
                    fill="none"
                    stroke={color()}
                    stroke-width={isHighlight() ? "3.5" : "2.5"}
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <For each={pts}>
                    {(p, pIdx) => {
                      const x = () => getX(pIdx(), pts.length);
                      const y = () => getY(p.value);
                      const isPointHov = () =>
                        hovered()?.runName === runName() && hovered()?.step === p.step;

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
                                runName: runName(),
                                color: color(),
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
                          {/* Invisible enlarged hit target */}
                          <circle cx={x()} cy={y()} r="16" fill="transparent" />

                          {/* Outer pulse ring on hover */}
                          <Show when={isPointHov()}>
                            <circle cx={x()} cy={y()} r="11" fill={color()} fill-opacity="0.35" />
                          </Show>

                          {/* Core dot */}
                          <circle
                            cx={x()}
                            cy={y()}
                            r={isPointHov() ? "7" : "5"}
                            fill={color()}
                            stroke="#ffffff"
                            stroke-width="2"
                            class="transition-all duration-150"
                          />

                          {/* Step axis label on bottom */}
                          <Show when={rIdx() === 0}>
                            <text
                              x={x()}
                              y={padT + plotH + 16}
                              text-anchor="middle"
                              font-size="10"
                              font-family="monospace"
                              fill="#64748b"
                            >
                              t=n+{p.step}
                            </text>
                          </Show>
                        </g>
                      );
                    }}
                  </For>
                </g>
              );
            }}
          </For>
        </svg>
      </div>
    </div>
  );
};
