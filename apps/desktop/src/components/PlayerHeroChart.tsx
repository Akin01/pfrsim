import { Component, createMemo, Show } from "solid-js";
import type { SimulationFrame } from "../lib/types";
import {
  buildDiobsPath,
  buildOverlayPfviPath,
  buildOverviewSparkline,
  buildPfviPath,
  HERO_HEIGHT,
  OVERVIEW_SVG_HEIGHT,
  OVERVIEW_SVG_WIDTH,
  overviewTToX,
  PLOT_LEFT,
  PLOT_RIGHT,
  PLOT_WIDTH,
  SVG_WIDTH,
  tToX,
  yToHeroY,
} from "../utils/player";
import { view } from "../lib/store";
import { catalogs } from "../i18n/catalog";

export interface PlayerHeroChartProps {
  frames: SimulationFrame[];
  t: number;
  currentFrame: SimulationFrame | null;
  hoveredFrame: SimulationFrame | null;
  hoveredOverlayFrame: SimulationFrame | null;
  effectiveWindow: [number, number];
  isZoomed: boolean;
  zoomPercentage: number;
  holdoutRange: { startT: number; endT: number } | null;
  forecastStartT: number | null;
  zeroLineVisible: boolean;
  chartClipId: string;
  holdoutPatternId: string;
  cursorSvgX: number | null;
  hoverT: number | null;
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
  onMinimapMouseDown: (e: MouseEvent) => void;
  onResetZoom: () => void;
  minimapRef: (el: SVGSVGElement) => void;
}

export const PlayerHeroChart: Component<PlayerHeroChartProps> = (props) => {
  const tCatalog = () => catalogs[view.lang];
  const wMin = () => props.effectiveWindow[0];
  const wMax = () => props.effectiveWindow[1];
  const totalN = () => Math.max(1, props.frames.length);

  const overviewSparkline = createMemo(() => buildOverviewSparkline(props.frames, totalN()));

  return (
    <div class="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3 relative shadow-xs transition-colors space-y-2 select-none">
      <div class="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 px-1">
        <div class="flex items-center space-x-2">
          <span class="font-bold text-slate-800 dark:text-slate-200">
            {tCatalog().playerHeroTitle}
          </span>
          <span class="text-[10px] text-slate-400">{tCatalog().playerHeroFixedScale}</span>
        </div>

        {/* Chart Legend */}
        <div class="flex items-center space-x-3 text-[10px]">
          <span class="flex items-center space-x-1.5">
            <span class="w-3 h-0.5 bg-blue-500 inline-block rounded-full" />
            <span class="text-slate-700 dark:text-slate-300">PFVI (History)</span>
          </span>
          <span class="flex items-center space-x-1.5">
            <span class="w-3 h-0.5 bg-red-500 inline-block border-b border-dashed" />
            <span class="text-slate-700 dark:text-slate-300">PFVI (Forecast)</span>
          </span>
          <Show when={view.visibleSeries.diobs}>
            <span class="flex items-center space-x-1.5">
              <span class="w-3 h-0.5 bg-slate-500 dark:text-slate-400 inline-block border-b border-dotted" />
              <span class="text-slate-700 dark:text-slate-300">DIobs</span>
            </span>
          </Show>
          <Show when={view.overlayFrames}>
            <span class="flex items-center space-x-1.5 text-cyan-600 dark:text-cyan-400 font-mono">
              <span class="w-3 h-0.5 bg-cyan-400 inline-block border-b border-dashed" />
              <span>Overlay Model</span>
            </span>
          </Show>
          <Show when={view.visibleSeries.holdout && props.holdoutRange}>
            <span class="flex items-center space-x-1 text-purple-600 dark:text-purple-400">
              <span class="w-2.5 h-2 bg-purple-500/20 border border-purple-500/40 inline-block rounded-2xs" />
              <span>Holdout</span>
            </span>
          </Show>
        </div>
      </div>

      {/* Hero Chart SVG Plot */}
      <div class="relative h-56 bg-slate-50/70 dark:bg-slate-950/60 rounded-lg border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${HERO_HEIGHT}`}
          preserveAspectRatio="none"
          class="w-full h-full cursor-crosshair select-none"
          onMouseMove={(e) => props.onChartMouseMove(e, "hero", e.currentTarget)}
          onMouseDown={(e) => props.onChartMouseDown(e, "hero", e.currentTarget)}
          onMouseUp={props.onChartMouseUp}
          onMouseLeave={props.onChartMouseLeave}
          onWheel={props.onChartWheel}
        >
          {/* 4 Background Risk Bands with soft translucent colors */}
          {/* Low: 0..75 */}
          <rect
            x={PLOT_LEFT}
            y={yToHeroY(75)}
            width={PLOT_WIDTH}
            height={Math.max(0, yToHeroY(0) - yToHeroY(75))}
            fill="#22c55e"
            fill-opacity={view.theme === "light" ? "0.08" : "0.07"}
            clip-path={`url(#${props.chartClipId})`}
          />
          {/* Moderate: 75..150 */}
          <rect
            x={PLOT_LEFT}
            y={yToHeroY(150)}
            width={PLOT_WIDTH}
            height={Math.max(0, yToHeroY(75) - yToHeroY(150))}
            fill="#eab308"
            fill-opacity={view.theme === "light" ? "0.08" : "0.07"}
            clip-path={`url(#${props.chartClipId})`}
          />
          {/* High: 150..225 */}
          <rect
            x={PLOT_LEFT}
            y={yToHeroY(225)}
            width={PLOT_WIDTH}
            height={Math.max(0, yToHeroY(150) - yToHeroY(225))}
            fill="#f97316"
            fill-opacity={view.theme === "light" ? "0.09" : "0.08"}
            clip-path={`url(#${props.chartClipId})`}
          />
          {/* Extreme: 225..300 */}
          <rect
            x={PLOT_LEFT}
            y={yToHeroY(300)}
            width={PLOT_WIDTH}
            height={Math.max(0, yToHeroY(225) - yToHeroY(300))}
            fill="#ef4444"
            fill-opacity={view.theme === "light" ? "0.09" : "0.08"}
            clip-path={`url(#${props.chartClipId})`}
          />

          {/* Zero Level Reference Line */}
          <Show when={props.zeroLineVisible}>
            <line
              x1={PLOT_LEFT}
              y1={yToHeroY(0)}
              x2={PLOT_RIGHT}
              y2={yToHeroY(0)}
              stroke={view.theme === "light" ? "#94a3b8" : "#475569"}
              stroke-dasharray="3,3"
              stroke-width="1.2"
              clip-path={`url(#${props.chartClipId})`}
            />
          </Show>

          {/* Risk Level Threshold Lines */}
          <line
            x1={PLOT_LEFT}
            y1={yToHeroY(30)}
            x2={PLOT_RIGHT}
            y2={yToHeroY(30)}
            stroke="#22c55e"
            stroke-opacity="0.35"
            stroke-dasharray="2,3"
            clip-path={`url(#${props.chartClipId})`}
          />
          <line
            x1={PLOT_LEFT}
            y1={yToHeroY(60)}
            x2={PLOT_RIGHT}
            y2={yToHeroY(60)}
            stroke="#eab308"
            stroke-opacity="0.35"
            stroke-dasharray="2,3"
            clip-path={`url(#${props.chartClipId})`}
          />
          <line
            x1={PLOT_LEFT}
            y1={yToHeroY(85)}
            x2={PLOT_RIGHT}
            y2={yToHeroY(85)}
            stroke="#ef4444"
            stroke-opacity="0.35"
            stroke-dasharray="2,3"
            clip-path={`url(#${props.chartClipId})`}
          />

          {/* Holdout Region Shading */}
          <Show when={view.visibleSeries.holdout && props.holdoutRange}>
            <rect
              x={tToX(props.holdoutRange!.startT, wMin(), wMax())}
              y={10}
              width={Math.max(
                0,
                tToX(props.holdoutRange!.endT, wMin(), wMax()) -
                  tToX(props.holdoutRange!.startT, wMin(), wMax()),
              )}
              height={HERO_HEIGHT - 35}
              fill={`url(#${props.holdoutPatternId})`}
              clip-path={`url(#${props.chartClipId})`}
            />
          </Show>

          {/* Forecast Divider Line */}
          <Show when={props.forecastStartT && view.visibleSeries.divider}>
            <line
              x1={tToX(props.forecastStartT!, wMin(), wMax())}
              y1={10}
              x2={tToX(props.forecastStartT!, wMin(), wMax())}
              y2={HERO_HEIGHT - 25}
              stroke={view.theme === "light" ? "#64748b" : "#94a3b8"}
              stroke-width="1"
              stroke-dasharray="3,3"
              clip-path={`url(#${props.chartClipId})`}
            />
          </Show>

          {/* DIobs Curve */}
          <Show when={view.visibleSeries.diobs}>
            <path
              d={buildDiobsPath(props.frames, props.t, wMin(), wMax())}
              fill="none"
              stroke="#64748b"
              stroke-width="1.8"
              stroke-dasharray="2,3"
              stroke-linecap="round"
              stroke-linejoin="round"
              clip-path={`url(#${props.chartClipId})`}
            />
          </Show>

          {/* Overlay Comparison Run PFVI Curve */}
          <Show when={view.overlayFrames}>
            <path
              d={buildOverlayPfviPath(view.overlayFrames, props.t, wMin(), wMax())}
              fill="none"
              stroke="#38bdf8"
              stroke-width="1.8"
              stroke-dasharray="4,3"
              stroke-linecap="round"
              stroke-linejoin="round"
              clip-path={`url(#${props.chartClipId})`}
            />
          </Show>

          {/* History PFVI Curve with fill="none" */}
          <path
            d={buildPfviPath(props.frames, props.t, false, props.forecastStartT, wMin(), wMax())}
            fill="none"
            stroke="#3b82f6"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            clip-path={`url(#${props.chartClipId})`}
          />

          {/* Forecast PFVI Curve with fill="none" */}
          <path
            d={buildPfviPath(props.frames, props.t, true, props.forecastStartT, wMin(), wMax())}
            fill="none"
            stroke="#ef4444"
            stroke-width="2.2"
            stroke-dasharray="4,3"
            stroke-linecap="round"
            stroke-linejoin="round"
            clip-path={`url(#${props.chartClipId})`}
          />

          {/* Playhead Line (Vertical Indicator) */}
          <Show when={props.t >= wMin() && props.t <= wMax()}>
            <line
              x1={tToX(props.t, wMin(), wMax())}
              y1={10}
              x2={tToX(props.t, wMin(), wMax())}
              y2={HERO_HEIGHT - 25}
              stroke={view.theme === "light" ? "#0f172a" : "#ffffff"}
              stroke-width="1.6"
              clip-path={`url(#${props.chartClipId})`}
            />
          </Show>

          {/* Playhead Current Point Dot */}
          <Show when={props.currentFrame}>
            <circle
              cx={tToX(props.t, wMin(), wMax())}
              cy={yToHeroY(props.currentFrame!.pfvi)}
              r="4.5"
              fill={props.currentFrame!.is_forecast ? "#ef4444" : "#3b82f6"}
              stroke={view.theme === "light" ? "#0f172a" : "#ffffff"}
              stroke-width="1.8"
              clip-path={`url(#${props.chartClipId})`}
            />
          </Show>

          {/* Synced Hover Crosshair Line */}
          <Show when={props.cursorSvgX !== null}>
            <line
              x1={props.cursorSvgX!}
              y1={10}
              x2={props.cursorSvgX!}
              y2={HERO_HEIGHT - 25}
              stroke={view.theme === "light" ? "#64748b" : "#94a3b8"}
              stroke-width="1.2"
              stroke-dasharray="3,3"
              clip-path={`url(#${props.chartClipId})`}
              class="pointer-events-none"
            />
            <Show when={props.hoveredFrame}>
              <circle
                cx={props.cursorSvgX!}
                cy={yToHeroY(props.hoveredFrame!.pfvi)}
                r="4"
                fill={props.hoveredFrame!.is_forecast ? "#ef4444" : "#3b82f6"}
                stroke={view.theme === "light" ? "#ffffff" : "#0f172a"}
                stroke-width="1.5"
                clip-path={`url(#${props.chartClipId})`}
              />
            </Show>
            <Show when={props.hoveredOverlayFrame}>
              <circle
                cx={tToX(props.hoverT!, wMin(), wMax())}
                cy={yToHeroY(props.hoveredOverlayFrame!.pfvi)}
                r="3.5"
                fill="#38bdf8"
                stroke={view.theme === "light" ? "#ffffff" : "#0f172a"}
                stroke-width="1.2"
                clip-path={`url(#${props.chartClipId})`}
              />
            </Show>
          </Show>

          {/* Brush Zoom Drag Box */}
          <Show when={props.brushState?.isDragging && props.brushState?.chartName === "hero"}>
            <rect
              x={Math.min(props.brushState!.startX, props.brushState!.currentX)}
              y={10}
              width={Math.abs(props.brushState!.currentX - props.brushState!.startX)}
              height={HERO_HEIGHT - 35}
              fill="#3b82f6"
              fill-opacity="0.18"
              stroke="#3b82f6"
              stroke-width="1"
              stroke-dasharray="2,2"
            />
          </Show>
        </svg>
      </div>

      {/* DataZoom Overview Mini-Map Strip (Spec 04 §2.3) */}
      <div class="pt-1">
        <div class="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-1 px-1">
          <span>{tCatalog().playerMinimapTitle}</span>
          <span>
            {props.isZoomed
              ? `Window: t=${wMin()}..${wMax()} (${props.zoomPercentage}% span)`
              : tCatalog().playerMinimapDragHint}
          </span>
        </div>

        <div class="relative h-6 bg-slate-100 dark:bg-slate-950/80 rounded border border-slate-200 dark:border-slate-800 overflow-hidden cursor-ew-resize">
          <svg
            ref={props.minimapRef}
            viewBox={`0 0 ${OVERVIEW_SVG_WIDTH} ${OVERVIEW_SVG_HEIGHT}`}
            preserveAspectRatio="none"
            class="w-full h-full select-none"
            onMouseDown={props.onMinimapMouseDown}
            onDblClick={props.onResetZoom}
          >
            {/* Full PFVI Sparkline with fill="none" */}
            <path
              d={overviewSparkline()}
              fill="none"
              stroke="#64748b"
              stroke-width="1.2"
              stroke-opacity="0.7"
            />

            {/* Shaded Viewport Rectangle representing xWindow */}
            <rect
              x={overviewTToX(wMin(), totalN())}
              y={1}
              width={Math.max(6, overviewTToX(wMax(), totalN()) - overviewTToX(wMin(), totalN()))}
              height={OVERVIEW_SVG_HEIGHT - 2}
              fill="#3b82f6"
              fill-opacity="0.22"
              stroke="#3b82f6"
              stroke-width="1.2"
              class="cursor-grab active:cursor-grabbing"
            />

            {/* Left and Right Edge Handles for Easy Drag-to-Resize */}
            <line
              x1={overviewTToX(wMin(), totalN())}
              y1={0}
              x2={overviewTToX(wMin(), totalN())}
              y2={OVERVIEW_SVG_HEIGHT}
              stroke="#2563eb"
              stroke-width="2"
            />
            <line
              x1={overviewTToX(wMax(), totalN())}
              y1={0}
              x2={overviewTToX(wMax(), totalN())}
              y2={OVERVIEW_SVG_HEIGHT}
              stroke="#2563eb"
              stroke-width="2"
            />

            {/* Playhead Marker on Minimap */}
            <line
              x1={overviewTToX(props.t, totalN())}
              y1={0}
              x2={overviewTToX(props.t, totalN())}
              y2={OVERVIEW_SVG_HEIGHT}
              stroke="#ef4444"
              stroke-width="1.5"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
