import { Component, Show } from "solid-js";
import {
  ChartLine,
  ChevronDown,
  CircleQuestionMark,
  Download,
  FileSpreadsheet,
  Globe,
  Info,
  RefreshCw,
  ShieldAlert,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-solid";
import type { Manifest, SimulationFrame } from "../lib/types";
import { fmt, riskClassColor } from "../utils/player";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export interface PlayerHeaderProps {
  manifest: Manifest | null;
  frames: SimulationFrame[];
  currentFrame: SimulationFrame | null;
  overlayFrame: SimulationFrame | null;
  t: number;
  totalN: number;
  playerMode: "trend" | "3d";
  onPlayerModeChange: (mode: "trend" | "3d") => void;
  isZoomed: boolean;
  zoomPercentage: number;
  onZoomBy: (factor: number) => void;
  onResetZoom: () => void;
  onZoomToForecast: () => void;
  onImportClick: () => void;
  onExportCsv: () => void;
  onDownloadFramesJson: () => void;
  isExporting: boolean;
  showExportMenu: boolean;
  onToggleExportMenu: () => void;
  showModelDetails: boolean;
  onToggleModelDetails: () => void;
  onClearOverlay: () => void;
  onOpenShortcuts: () => void;
  showPlaybook: boolean;
  onTogglePlaybook: () => void;
}
export const PlayerHeader: Component<PlayerHeaderProps> = (props) => {
  const t = () => catalogs[view.lang];

  return (
    <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/80 shrink-0 gap-2 flex-wrap">
      <div class="flex items-center space-x-2.5">
        <div class="flex items-center space-x-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h2 class="text-xs md:text-sm font-black tracking-tight text-slate-800 dark:text-slate-100 font-mono">
            {t().playerTitle}
          </h2>
        </div>

        {/* Determinism Badge with Clickable Popover */}
        <button
          type="button"
          onClick={props.onToggleModelDetails}
          class="px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-mono hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors flex items-center space-x-1.5 shadow-2xs cursor-pointer group"
          title="Inspect Model Parameters & Determinism Provenance"
        >
          <span class="text-emerald-600 dark:text-emerald-400 font-semibold group-hover:underline">
            seed={props.manifest?.seed ?? 42}
          </span>
          <span class="text-slate-400">·</span>
          <span class="text-slate-500 dark:text-slate-400">
            sha:{props.manifest?.frames_sha256?.slice(0, 8) ?? "replay"}
          </span>
          <span class="text-slate-400">·</span>
          <span class="text-cyan-600 dark:text-cyan-400 font-semibold">
            h={props.frames.filter((f) => f.is_forecast).length}
          </span>
          <Info size={11} class="text-slate-400 group-hover:text-emerald-500 transition-colors" />
        </button>

        {/* Overlay Run Tag (if active) */}
        <Show when={view.overlayFrames && view.overlayFrames.length > 0}>
          <div class="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-[11px] font-mono shadow-2xs">
            <span class="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>
              Overlay:{" "}
              <strong class="font-bold">
                {view.overlayRunId ? view.overlayRunId.slice(0, 8) : "Active"}
              </strong>
            </span>
            <button
              type="button"
              onClick={props.onClearOverlay}
              class="hover:text-rose-500 ml-1 p-0.5 rounded transition-colors"
              title="Clear Overlay Comparison"
            >
              <X size={12} />
            </button>
          </div>
        </Show>

        {/* Simulation View Mode Switcher: Trend Player vs 3D Land Heatmap */}
        <div class="flex items-center bg-slate-100 dark:bg-slate-900 rounded-xl p-0.5 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <button
            type="button"
            onClick={() => props.onPlayerModeChange("trend")}
            class={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
              props.playerMode === "trend"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold shadow-xs border border-slate-200/60 dark:border-slate-700/60"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <ChartLine size={13} class={props.playerMode === "trend" ? "text-emerald-500" : ""} />
            <span>{t().playerTrendMode}</span>
          </button>

          <button
            type="button"
            onClick={() => props.onPlayerModeChange("3d")}
            class={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center space-x-1.5 transition-all cursor-pointer ${
              props.playerMode === "3d"
                ? "bg-emerald-600 text-white font-bold shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Globe
              size={13}
              class={props.playerMode === "3d" ? "text-white" : "text-emerald-500"}
            />
            <span>{t().player3dMode}</span>
          </button>
        </div>
      </div>

      {/* Real-time Readout, Zoom Controls & Action Buttons */}
      <div class="flex items-center space-x-2 text-xs font-mono">
        {/* Active Frame Readout */}
        <Show when={props.currentFrame}>
          <div class="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1 rounded-lg shadow-2xs">
            <span class="text-slate-500 dark:text-slate-400 font-medium">
              t = {props.t}/{props.totalN}
            </span>
            <span class="text-slate-300 dark:text-slate-700">|</span>
            <span class="text-slate-700 dark:text-slate-300">
              PFVI:{" "}
              <strong class="text-slate-950 dark:text-white font-bold">
                {fmt(props.currentFrame?.pfvi, 1)}
              </strong>
            </span>
            <span
              class={`px-1.5 py-0.2 rounded text-[10px] font-semibold tracking-wide ${riskClassColor(
                props.currentFrame?.class,
              )}`}
            >
              {props.currentFrame?.class}
            </span>

            {/* Contextual Mitigation Playbook Button */}
            <button
              type="button"
              onClick={props.onTogglePlaybook}
              class={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all flex items-center space-x-1 cursor-pointer shadow-2xs ${
                props.showPlaybook
                  ? "bg-amber-500 text-white border-amber-600 shadow-amber-500/30"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
              }`}
              title={t().playerPlaybookBtn}
            >
              <ShieldAlert size={11} class={props.showPlaybook ? "text-white" : "text-amber-500"} />
              <span>{t().playerPlaybookBtn}</span>
            </button>
            <Show when={props.currentFrame?.is_forecast}>
              <span class="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[9px] font-bold">
                FORECAST
              </span>
            </Show>
            <Show when={props.overlayFrame && props.currentFrame}>
              <span class="text-[10px] text-slate-500 dark:text-slate-400 flex items-center space-x-1 pl-1 border-l border-slate-200 dark:border-slate-800">
                <span>ΔPFVI:</span>
                <strong
                  class={`font-mono font-bold ${
                    props.currentFrame!.pfvi - props.overlayFrame!.pfvi > 0
                      ? "text-rose-500"
                      : "text-emerald-500"
                  }`}
                >
                  {fmt(props.currentFrame!.pfvi - props.overlayFrame!.pfvi, 1)}
                </strong>
              </span>
            </Show>
          </div>
        </Show>

        {/* Zoom Controls & Import/Export Actions (Trend Player Mode only) */}
        <Show when={props.playerMode === "trend"}>
          {/* Zoom In / Zoom Out / Reset Buttons */}
          <div class="flex items-center space-x-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => props.onZoomBy(0.8)}
              class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
              title="Zoom In (Key +)"
            >
              <ZoomIn size={13} />
            </button>
            <button
              type="button"
              onClick={() => props.onZoomBy(1.25)}
              class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
              title="Zoom Out (Key -)"
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              onClick={props.onResetZoom}
              class={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                props.isZoomed
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              title="Reset Zoom to full 1..n+h range (Key 0)"
            >
              {props.isZoomed ? `Reset (${props.zoomPercentage}%)` : "Reset"}
            </button>
            <button
              type="button"
              onClick={props.onZoomToForecast}
              class="px-1.5 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono"
              title="Zoom into Forecast Horizon"
            >
              Zoom FC
            </button>
          </div>

          {/* Import Run Button */}
          <button
            type="button"
            onClick={props.onImportClick}
            class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800 text-xs font-mono transition-colors flex items-center space-x-1.5 shadow-2xs cursor-pointer"
            title="Import Run Simulation (.json / .csv)"
          >
            <Upload size={13} class="text-slate-500" />
            <span>{t().playerImportBtn}</span>
          </button>

          {/* Export Dropdown */}
          <div class="relative">
            <button
              type="button"
              onClick={props.onToggleExportMenu}
              class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800 text-xs font-mono transition-colors flex items-center space-x-1.5 shadow-2xs cursor-pointer"
            >
              <Show
                when={props.isExporting}
                fallback={<Download size={13} class="text-slate-500" />}
              >
                <RefreshCw size={13} class="animate-spin text-emerald-500" />
              </Show>
              <span>{t().playerExportBtn}</span>
              <ChevronDown size={12} class="text-slate-400" />
            </button>

            <Show when={props.showExportMenu}>
              <div
                class="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-50 text-xs font-sans animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={props.onExportCsv}
                  class="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center space-x-2 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet size={14} class="text-blue-500" />
                  <span>{t().playerExportCsv}</span>
                </button>
                <div class="h-px bg-slate-200 dark:bg-slate-800 my-1" />
                <button
                  type="button"
                  onClick={props.onDownloadFramesJson}
                  class="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center space-x-2 transition-colors cursor-pointer"
                >
                  <Download size={14} class="text-cyan-500" />
                  <span>{t().playerDownloadJson}</span>
                </button>
              </div>
            </Show>
          </div>
        </Show>

        {/* Keyboard Shortcuts Dialog trigger */}
        <button
          type="button"
          onClick={props.onOpenShortcuts}
          class="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-400 dark:border-slate-800 text-xs font-mono transition-colors shadow-2xs cursor-pointer"
          title="Keyboard Shortcuts Help (?)"
        >
          <CircleQuestionMark size={14} />
        </button>
      </div>
    </div>
  );
};
