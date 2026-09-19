import { Component, For, Show } from "solid-js";
import type { SimulationFrame } from "../lib/types";
import {
  buildStripPath,
  fmt,
  PLOT_LEFT,
  PLOT_RIGHT,
  PLOT_WIDTH,
  STRIP_HEIGHT,
  SVG_WIDTH,
  tToX,
  valToStripY,
} from "../utils/player";
import { setView, view } from "../lib/store";
import { catalogs } from "../i18n/catalog";

export interface PlayerEnvironmentalStripsProps {
  frames: SimulationFrame[];
  t: number;
  currentFrame: SimulationFrame | null;
  hoveredFrame: SimulationFrame | null;
  effectiveWindow: [number, number];
  isZoomed: boolean;
  holdoutRange: { startT: number; endT: number } | null;
  forecastStartT: number | null;
  zeroLineVisible: boolean;
  onToggleZeroLine: () => void;
  wtBounds: { min: number; max: number };
  smBounds: { min: number; max: number };
  rfBounds: { min: number; max: number };
  tempBounds: { min: number; max: number };
  holdoutPatternId: string;
  chartClipId: string;
  stripClipId: string;
  cursorSvgX: number | null;
  brushState: {
    isDragging: boolean;
    startT: number;
    currentT: number;
    startX: number;
    currentX: number;
    chartName: string;
  } | null;
  onChartMouseMove: (e: MouseEvent, chartName: string, el: SVGSVGElement) => void;
  onChartMouseDown: (e: MouseEvent, chartName: string, el: SVGSVGElement) => void;
  onChartMouseUp: () => void;
  onChartMouseLeave: () => void;
  onChartWheel: (e: WheelEvent) => void;
}

export const PlayerEnvironmentalStrips: Component<PlayerEnvironmentalStripsProps> = (props) => {
  const tCatalog = () => catalogs[view.lang];
  const wMin = () => props.effectiveWindow[0];
  const wMax = () => props.effectiveWindow[1];

  const stripList = () =>
    [
      {
        key: "wt",
        label: "WT",
        unit: "m",
        digits: 3,
        colorClass: "text-cyan-600 dark:text-cyan-400",
        strokeColor: "#06b6d4",
        forecastStrokeColor: "#38bdf8",
        bounds: props.wtBounds,
        accessor: (f: SimulationFrame) => f.wt,
        isImputed: (f: SimulationFrame) => Boolean(f.imputed?.wt),
        hasZeroLine: true,
      },
      {
        key: "sm",
        label: "SM",
        unit: "%",
        digits: 1,
        colorClass: "text-emerald-600 dark:text-emerald-400",
        strokeColor: "#10b981",
        forecastStrokeColor: "#34d399",
        bounds: props.smBounds,
        accessor: (f: SimulationFrame) => f.sm,
        isImputed: (f: SimulationFrame) => Boolean(f.imputed?.sm),
        hasZeroLine: false,
      },
      {
        key: "rf",
        label: "Rf",
        unit: "mm",
        digits: 5,
        colorClass: "text-blue-600 dark:text-blue-400",
        strokeColor: "#60a5fa",
        forecastStrokeColor: "#f87171",
        bounds: props.rfBounds,
        accessor: (f: SimulationFrame) => f.rf,
        isImputed: (f: SimulationFrame) => Boolean(f.imputed?.rf),
        hasZeroLine: false,
      },
      {
        key: "temp",
        label: "Temp",
        unit: "°C",
        digits: 1,
        colorClass: "text-rose-600 dark:text-rose-400",
        strokeColor: "#f43f5e",
        forecastStrokeColor: "#fb7185",
        bounds: props.tempBounds,
        accessor: (f: SimulationFrame) => f.temp,
        isImputed: (f: SimulationFrame) => Boolean(f.imputed?.temp),
        hasZeroLine: false,
      },
    ] as const;

  return (
    <div class="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs space-y-1.5 transition-colors">
      {/* Environmental Strips Header & Series Visibility Toggles */}
      <div class="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 px-1 pb-1 border-b border-slate-100 dark:border-slate-800/60">
        <div class="flex items-center space-x-2">
          <span class="font-bold text-slate-800 dark:text-slate-200">
            {tCatalog().playerEnvVariablesTitle}
          </span>
          <span class="text-[10px] text-slate-400">
            {props.isZoomed
              ? `[Range t: ${props.effectiveWindow[0]}..${props.effectiveWindow[1]}]`
              : "[Full Range]"}
          </span>
        </div>

        {/* Toggles */}
        <div class="flex items-center space-x-1.5 text-[10px]">
          <button
            type="button"
            onClick={() => setView("visibleSeries", "imputed", !view.visibleSeries.imputed)}
            class={`px-2 py-0.5 rounded border flex items-center space-x-1.5 transition-colors cursor-pointer ${
              view.visibleSeries.imputed
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 font-semibold"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"
            }`}
            title="Toggle Imputed Data Markers"
          >
            <span class="w-1.5 h-1.5 bg-amber-500 rotate-45 inline-block" />
            <span>{tCatalog().playerImputedToggle}</span>
          </button>

          <button
            type="button"
            onClick={() => setView("visibleSeries", "divider", !view.visibleSeries.divider)}
            class={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
              view.visibleSeries.divider
                ? "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 font-semibold"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"
            }`}
            title="Toggle Forecast Divider"
          >
            <span>{tCatalog().playerDividerToggle}</span>
          </button>

          <button
            type="button"
            onClick={() => setView("visibleSeries", "holdout", !view.visibleSeries.holdout)}
            class={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
              view.visibleSeries.holdout
                ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40 font-semibold"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"
            }`}
            title="Toggle Training Holdout Test Split Region"
          >
            <span>{tCatalog().playerHoldoutToggle}</span>
          </button>

          <button
            type="button"
            onClick={props.onToggleZeroLine}
            class={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
              props.zeroLineVisible
                ? "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 font-semibold"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"
            }`}
            title="Toggle Zero Level Reference Guide"
          >
            <span>{tCatalog().playerZeroGuideToggle}</span>
          </button>
        </div>
      </div>

      {/* SVG Defs for Holdout Diagonal Stripes Pattern and Clip Paths */}
      <svg
        style={{
          position: "absolute",
          width: "0",
          height: "0",
          overflow: "hidden",
          "pointer-events": "none",
        }}
        aria-hidden="true"
      >
        <defs>
          <pattern
            id={props.holdoutPatternId}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke="#a855f7"
              stroke-width="1.8"
              stroke-opacity="0.25"
            />
          </pattern>
          <clipPath id={props.chartClipId}>
            <rect x={PLOT_LEFT} y="0" width={PLOT_WIDTH} height={220} />
          </clipPath>
          <clipPath id={props.stripClipId}>
            <rect x={PLOT_LEFT} y="0" width={PLOT_WIDTH} height={STRIP_HEIGHT} />
          </clipPath>
        </defs>
      </svg>

      {/* 4 Environmental Strips Loop */}
      <For each={stripList()}>
        {(strip) => {
          const currentVal = () =>
            props.hoveredFrame
              ? strip.accessor(props.hoveredFrame)
              : props.currentFrame
                ? strip.accessor(props.currentFrame)
                : null;
          const isImputedVal = () =>
            (props.hoveredFrame ?? props.currentFrame)
              ? strip.isImputed(props.hoveredFrame ?? props.currentFrame!)
              : false;

          return (
            <div class="relative h-16 bg-slate-50/70 dark:bg-slate-950/50 rounded-lg border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden">
              <div class="absolute left-2.5 top-1 z-10 flex items-center space-x-2 text-[10px] font-mono pointer-events-none">
                <span class={`font-bold ${strip.colorClass}`}>
                  {strip.label}: {fmt(currentVal(), strip.digits)} {strip.unit}
                </span>
                <span class="text-slate-400 text-[9px]">
                  (min {fmt(strip.bounds.min, 2)} / max {fmt(strip.bounds.max, 2)})
                </span>
                <Show when={isImputedVal() && view.visibleSeries.imputed}>
                  <span class="px-1 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold text-[8px] border border-amber-500/30">
                    IMPUTED
                  </span>
                </Show>
              </div>

              <svg
                viewBox={`0 0 ${SVG_WIDTH} ${STRIP_HEIGHT}`}
                preserveAspectRatio="none"
                class="w-full h-full cursor-crosshair select-none"
                onMouseMove={(e) => props.onChartMouseMove(e, strip.key, e.currentTarget)}
                onMouseDown={(e) => props.onChartMouseDown(e, strip.key, e.currentTarget)}
                onMouseUp={props.onChartMouseUp}
                onMouseLeave={props.onChartMouseLeave}
                onWheel={props.onChartWheel}
              >
                {/* Holdout Region Shading */}
                <Show when={view.visibleSeries.holdout && props.holdoutRange}>
                  <rect
                    x={tToX(props.holdoutRange!.startT, wMin(), wMax())}
                    y={0}
                    width={Math.max(
                      0,
                      tToX(props.holdoutRange!.endT, wMin(), wMax()) -
                        tToX(props.holdoutRange!.startT, wMin(), wMax()),
                    )}
                    height={STRIP_HEIGHT}
                    fill={`url(#${props.holdoutPatternId})`}
                    clip-path={`url(#${props.stripClipId})`}
                  />
                </Show>

                {/* Zero Level Reference Line */}
                <Show when={strip.hasZeroLine && props.zeroLineVisible}>
                  <line
                    x1={PLOT_LEFT}
                    y1={valToStripY(0.0, strip.bounds.min, strip.bounds.max)}
                    x2={PLOT_RIGHT}
                    y2={valToStripY(0.0, strip.bounds.min, strip.bounds.max)}
                    stroke={view.theme === "light" ? "#94a3b8" : "#475569"}
                    stroke-dasharray="3,3"
                    stroke-width="1"
                  />
                </Show>

                {/* Forecast Divider Line */}
                <Show when={props.forecastStartT && view.visibleSeries.divider}>
                  <line
                    x1={tToX(props.forecastStartT!, wMin(), wMax())}
                    y1={0}
                    x2={tToX(props.forecastStartT!, wMin(), wMax())}
                    y2={STRIP_HEIGHT}
                    stroke={view.theme === "light" ? "#64748b" : "#94a3b8"}
                    stroke-width="1"
                    stroke-dasharray="3,3"
                    clip-path={`url(#${props.stripClipId})`}
                  />
                </Show>

                {/* History Curve with fill="none" */}
                <path
                  d={buildStripPath(
                    props.frames,
                    strip.accessor,
                    strip.bounds,
                    props.t,
                    false,
                    props.forecastStartT,
                    wMin(),
                    wMax(),
                  )}
                  fill="none"
                  stroke={strip.strokeColor}
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  clip-path={`url(#${props.stripClipId})`}
                />

                {/* Forecast Curve with fill="none" */}
                <path
                  d={buildStripPath(
                    props.frames,
                    strip.accessor,
                    strip.bounds,
                    props.t,
                    true,
                    props.forecastStartT,
                    wMin(),
                    wMax(),
                  )}
                  fill="none"
                  stroke={strip.forecastStrokeColor}
                  stroke-width="1.8"
                  stroke-dasharray="4,3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  clip-path={`url(#${props.stripClipId})`}
                />

                {/* Imputed Markers */}
                <Show when={view.visibleSeries.imputed}>
                  <For each={props.frames.slice(0, props.t)}>
                    {(f) =>
                      strip.isImputed(f) && (
                        <polygon
                          points={`${tToX(f.t, wMin(), wMax())},${
                            valToStripY(strip.accessor(f), strip.bounds.min, strip.bounds.max) - 3.5
                          } ${tToX(f.t, wMin(), wMax()) + 3.5},${valToStripY(
                            strip.accessor(f),
                            strip.bounds.min,
                            strip.bounds.max,
                          )} ${tToX(f.t, wMin(), wMax())},${
                            valToStripY(strip.accessor(f), strip.bounds.min, strip.bounds.max) + 3.5
                          } ${tToX(f.t, wMin(), wMax()) - 3.5},${valToStripY(
                            strip.accessor(f),
                            strip.bounds.min,
                            strip.bounds.max,
                          )}`}
                          fill="#f59e0b"
                          clip-path={`url(#${props.stripClipId})`}
                        />
                      )
                    }
                  </For>
                </Show>

                {/* Playhead Line (Vertical Indicator) */}
                <Show when={props.t >= wMin() && props.t <= wMax()}>
                  <line
                    x1={tToX(props.t, wMin(), wMax())}
                    y1={0}
                    x2={tToX(props.t, wMin(), wMax())}
                    y2={STRIP_HEIGHT}
                    stroke={view.theme === "light" ? "#0f172a" : "#ffffff"}
                    stroke-width="1.5"
                    clip-path={`url(#${props.stripClipId})`}
                  />
                </Show>

                {/* Synced Hover Crosshair Line */}
                <Show when={props.cursorSvgX !== null}>
                  <line
                    x1={props.cursorSvgX!}
                    y1={0}
                    x2={props.cursorSvgX!}
                    y2={STRIP_HEIGHT}
                    stroke={view.theme === "light" ? "#64748b" : "#94a3b8"}
                    stroke-width="1.2"
                    stroke-dasharray="3,3"
                    clip-path={`url(#${props.stripClipId})`}
                    class="pointer-events-none"
                  />
                  <Show when={props.hoveredFrame}>
                    <circle
                      cx={props.cursorSvgX!}
                      cy={valToStripY(
                        strip.accessor(props.hoveredFrame!),
                        strip.bounds.min,
                        strip.bounds.max,
                      )}
                      r="3.5"
                      fill={strip.strokeColor}
                      stroke={view.theme === "light" ? "#ffffff" : "#0f172a"}
                      stroke-width="1.5"
                      clip-path={`url(#${props.stripClipId})`}
                    />
                  </Show>
                </Show>

                {/* Brush Zoom Drag Box */}
                <Show
                  when={props.brushState?.isDragging && props.brushState?.chartName === strip.key}
                >
                  <rect
                    x={Math.min(props.brushState!.startX, props.brushState!.currentX)}
                    y={0}
                    width={Math.abs(props.brushState!.currentX - props.brushState!.startX)}
                    height={STRIP_HEIGHT}
                    fill={strip.strokeColor}
                    fill-opacity="0.18"
                    stroke={strip.strokeColor}
                    stroke-width="1"
                    stroke-dasharray="2,2"
                  />
                </Show>
              </svg>
            </div>
          );
        }}
      </For>
    </div>
  );
};
