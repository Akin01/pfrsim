import { Component, Show } from "solid-js";
import { Portal } from "solid-js/web";
import type { SimulationFrame } from "../lib/types";
import { fmt, riskClassColor, riskTextColor } from "../utils/player";
import { view } from "../lib/store";

export interface PlayerHoverTooltipProps {
  tooltipCoords: { left: number; top: number } | null;
  hoveredFrame: SimulationFrame | null;
  hoveredOverlayFrame: SimulationFrame | null;
  totalN: number;
}

export const PlayerHoverTooltip: Component<PlayerHoverTooltipProps> = (props) => {
  return (
    <Show when={props.tooltipCoords && props.hoveredFrame}>
      <Portal>
        <div
          class="fixed z-50 pointer-events-none select-none"
          style={{
            transform: `translate3d(${props.tooltipCoords!.left}px, ${props.tooltipCoords!.top}px, 0)`,
            left: "0px",
            top: "0px",
            "will-change": "transform",
          }}
        >
          <div class="w-70 max-w-70 box-border overflow-hidden backdrop-blur-md bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 shadow-2xl space-y-2 text-xs font-sans">
            {/* Tooltip Header: Frame Index, Time Label, Forecast Status */}
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5 font-mono text-[11px]">
              <div class="flex items-center space-x-1.5">
                <span class="font-bold text-slate-800 dark:text-slate-200">
                  {props.hoveredFrame!.time_label ?? `Frame t = ${props.hoveredFrame!.t}`}
                </span>
                <span class="text-slate-400 text-[10px]">
                  (#{props.hoveredFrame!.t}/{props.totalN})
                </span>
              </div>
              <span
                class={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                  props.hoveredFrame!.is_forecast
                    ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                    : "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                }`}
              >
                {props.hoveredFrame!.is_forecast ? "FORECAST" : "HISTORY"}
              </span>
            </div>

            {/* PFVI Primary Metric & Risk Class */}
            <div class="flex items-center justify-between py-1 bg-slate-50 dark:bg-slate-950/60 px-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
              <div>
                <span class="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                  PFVI Vulnerability
                </span>
                <span
                  class={`text-lg font-black font-mono tracking-tight ${riskTextColor(
                    props.hoveredFrame!.class,
                  )}`}
                >
                  {fmt(props.hoveredFrame!.pfvi, 1)}
                </span>
              </div>
              <div class="text-right">
                <span
                  class={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${riskClassColor(
                    props.hoveredFrame!.class,
                  )}`}
                >
                  {props.hoveredFrame!.class}
                </span>
                <Show when={props.hoveredFrame!.diobs !== undefined && view.visibleSeries.diobs}>
                  <div class="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    DIobs: {fmt(props.hoveredFrame!.diobs, 1)}
                  </div>
                </Show>
              </div>
            </div>

            {/* Overlay comparison if active */}
            <Show when={props.hoveredOverlayFrame}>
              <div class="flex items-center justify-between text-[11px] font-mono px-1 text-cyan-600 dark:text-cyan-400">
                <span>Overlay PFVI: {fmt(props.hoveredOverlayFrame!.pfvi, 1)}</span>
                <span class="font-bold">
                  Δ: {fmt(props.hoveredFrame!.pfvi - props.hoveredOverlayFrame!.pfvi, 1)}
                </span>
              </div>
            </Show>

            {/* Environmental Variables 2x2 Grid */}
            <div class="grid grid-cols-2 gap-1.5 pt-0.5 font-mono text-[10px]">
              {/* Water Table */}
              <div class="p-1.5 rounded bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60">
                <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[9px]">
                  <span>Water Table</span>
                  <Show when={props.hoveredFrame!.imputed?.wt}>
                    <span class="text-amber-500 text-[8px] font-bold">IMP</span>
                  </Show>
                </div>
                <span class="font-bold text-cyan-600 dark:text-cyan-400 text-[11px]">
                  {fmt(props.hoveredFrame!.wt, 3)} m
                </span>
              </div>

              {/* Soil Moisture */}
              <div class="p-1.5 rounded bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60">
                <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[9px]">
                  <span>Soil Moisture</span>
                  <Show when={props.hoveredFrame!.imputed?.sm}>
                    <span class="text-amber-500 text-[8px] font-bold">IMP</span>
                  </Show>
                </div>
                <span class="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                  {fmt(props.hoveredFrame!.sm, 1)}%
                </span>
              </div>

              {/* Rainfall */}
              <div class="p-1.5 rounded bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60">
                <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[9px]">
                  <span>Rainfall</span>
                  <Show when={props.hoveredFrame!.imputed?.rf}>
                    <span class="text-amber-500 text-[8px] font-bold">IMP</span>
                  </Show>
                </div>
                <span class="font-bold text-blue-600 dark:text-blue-400 text-[11px]">
                  {fmt(props.hoveredFrame!.rf, 5)} mm
                </span>
              </div>

              {/* Temperature */}
              <div class="p-1.5 rounded bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60">
                <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[9px]">
                  <span>Temperature</span>
                  <Show when={props.hoveredFrame!.imputed?.temp}>
                    <span class="text-amber-500 text-[8px] font-bold">IMP</span>
                  </Show>
                </div>
                <span class="font-bold text-rose-600 dark:text-rose-400 text-[11px]">
                  {fmt(props.hoveredFrame!.temp, 1)}°C
                </span>
              </div>
            </div>

            {/* Sub-components / Physics decomposition */}
            <Show when={props.hoveredFrame!.water_depth !== undefined}>
              <div class="pt-1 border-t border-slate-200 dark:border-slate-800 text-[9px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between px-0.5">
                <span>D: {fmt(props.hoveredFrame!.water_depth, 2)}</span>
                <span>Wd: {fmt(props.hoveredFrame!.water_distribution, 2)}</span>
                <span>Re: {fmt(props.hoveredFrame!.rainfall_effect, 3)}</span>
                <span>Sf: {fmt(props.hoveredFrame!.soil_fluctuation, 2)}</span>
              </div>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  );
};
