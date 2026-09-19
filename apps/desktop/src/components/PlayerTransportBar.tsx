import { Component, Show } from "solid-js";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pause,
  Play,
  Repeat,
} from "lucide-solid";
import type { Manifest } from "../lib/types";
import { setView, type SpeedRate, type TransportState, view } from "../lib/store";
import { catalogs } from "../i18n/catalog";

export interface PlayerTransportBarProps {
  t: number;
  totalN: number;
  transport: TransportState;
  speed: SpeedRate;
  loop: boolean;
  manifest: Manifest | null;
  onScrub: (newT: number) => void;
  onStepBy: (delta: number) => void;
  onTogglePlayPause: () => void;
  onJumpToForecastStart: () => void;
  onToggleLoop: () => void;
  onSpeedChange: (newSpeed: SpeedRate) => void;
}

export const PlayerTransportBar: Component<PlayerTransportBarProps> = (props) => {
  const tCatalog = () => catalogs[view.lang];
  const hStep = () => props.manifest?.config?.pfvi?.h ?? 4;

  return (
    <div class="h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 flex items-center justify-between shrink-0 select-none shadow-xs transition-colors gap-2">
      {/* Playback Buttons */}
      <div class="flex items-center space-x-1">
        {/* Jump to Start */}
        <button
          type="button"
          onClick={() => props.onScrub(1)}
          class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-xs font-mono transition-colors cursor-pointer"
          title="Jump to Start (Home)"
        >
          <ChevronsLeft size={14} />
        </button>

        {/* Step -h */}
        <button
          type="button"
          onClick={() => props.onStepBy(-hStep())}
          class="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-[10px] font-mono transition-colors cursor-pointer"
          title="Step -h frames (Shift + ←)"
        >
          -{hStep()}
        </button>

        {/* Step -1 */}
        <button
          type="button"
          onClick={() => props.onStepBy(-1)}
          class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-xs font-mono transition-colors cursor-pointer"
          title="Step -1 frame (Left Arrow)"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Primary Play / Pause Button */}
        <button
          type="button"
          onClick={props.onTogglePlayPause}
          class="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md hover:shadow-emerald-500/20 transition-all cursor-pointer flex items-center space-x-1.5"
          title="Play / Pause (Space)"
        >
          <Show
            when={props.transport === "playing"}
            fallback={<Play size={13} class="fill-current" />}
          >
            <Pause size={13} class="fill-current" />
          </Show>
          <span>
            {props.transport === "playing" ? tCatalog().playerPauseBtn : tCatalog().playerPlayBtn}
          </span>
        </button>

        {/* Step +1 */}
        <button
          type="button"
          onClick={() => props.onStepBy(1)}
          class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-xs font-mono transition-colors cursor-pointer"
          title="Step +1 frame (Right Arrow)"
        >
          <ChevronRight size={14} />
        </button>

        {/* Step +h */}
        <button
          type="button"
          onClick={() => props.onStepBy(hStep())}
          class="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-[10px] font-mono transition-colors cursor-pointer"
          title="Step +h frames (Shift + →)"
        >
          +{hStep()}
        </button>

        {/* Jump to Forecast Start */}
        <button
          type="button"
          onClick={props.onJumpToForecastStart}
          class="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-[10px] font-mono transition-colors cursor-pointer"
          title="Jump to Forecast Start (Key F)"
        >
          {tCatalog().playerFcStartBtn}
        </button>

        {/* Jump to End */}
        <button
          type="button"
          onClick={() => props.onScrub(props.totalN)}
          class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-xs font-mono transition-colors cursor-pointer"
          title="Jump to End (End)"
        >
          <ChevronsRight size={14} />
        </button>

        {/* Loop Toggle */}
        <button
          type="button"
          onClick={props.onToggleLoop}
          class={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
            props.loop
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 font-bold"
              : "bg-slate-100 hover:bg-slate-200 text-slate-400 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-500 border-transparent"
          }`}
          title="Toggle Continuous Loop Playback (Key L)"
        >
          <Repeat size={14} />
        </button>
      </div>

      {/* Timeline Slider with Colored Segments */}
      <div class="flex-1 max-w-md mx-3 flex items-center space-x-2.5">
        <span class="text-[10px] text-slate-400 dark:text-slate-500 font-mono">1</span>
        <div class="flex-1 relative flex items-center">
          <input
            type="range"
            min={1}
            max={Math.max(1, props.totalN)}
            value={props.t}
            onInput={(e) => props.onScrub(parseInt(e.currentTarget.value) || 1)}
            class="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-600 dark:accent-emerald-500 focus:outline-none focus:ring-0 focus-visible:outline-none select-none"
          />
        </div>
        <span class="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{props.totalN}</span>
      </div>

      {/* Speed Selector & DIobs Toggle */}
      <div class="flex items-center space-x-2.5 text-xs font-mono">
        <div class="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            class={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
              props.speed === 1
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
            onClick={() => props.onSpeedChange(1)}
            title="1x Playback Speed (Key 1)"
          >
            1x
          </button>
          <button
            type="button"
            class={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
              props.speed === 2
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
            onClick={() => props.onSpeedChange(2)}
            title="2x Playback Speed (Key 2)"
          >
            2x
          </button>
          <button
            type="button"
            class={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
              props.speed === 4
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
            onClick={() => props.onSpeedChange(4)}
            title="4x Playback Speed (Key 3)"
          >
            4x
          </button>
          <button
            type="button"
            class={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
              props.speed === 8
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
            onClick={() => props.onSpeedChange(8)}
            title="8x Playback Speed (Key 4)"
          >
            8x
          </button>
        </div>

        <button
          type="button"
          onClick={() => setView("visibleSeries", "diobs", !view.visibleSeries.diobs)}
          class={`px-2.5 py-1 rounded-lg border text-[10px] font-mono transition-colors cursor-pointer ${
            view.visibleSeries.diobs
              ? "bg-slate-200 border-slate-300 text-slate-800 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 font-bold"
              : "bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-600"
          }`}
          title="Toggle DIobs (Drought/Fire Observed Series)"
        >
          DIobs
        </button>
      </div>
    </div>
  );
};
