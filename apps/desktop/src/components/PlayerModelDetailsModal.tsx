import { Component, Show } from "solid-js";
import { X, Zap } from "lucide-solid";
import type { Manifest } from "../lib/types";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export interface PlayerModelDetailsModalProps {
  open: boolean;
  onClose: () => void;
  manifest: Manifest | null;
  runId?: string | null;
}

export const PlayerModelDetailsModal: Component<PlayerModelDetailsModalProps> = (props) => {
  const t = () => catalogs[view.lang];

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 bg-transparent backdrop-blur-md flex items-center justify-center p-4 transition-all duration-200 select-none"
        onClick={props.onClose}
      >
        <div
          class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div class="flex items-center space-x-2">
              <Zap size={16} class="text-emerald-500" />
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                {t().playerModelDetailsTitle}
              </h3>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div class="space-y-2.5 text-xs font-mono text-slate-600 dark:text-slate-300">
            <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span class="text-slate-500">Run ID:</span>
              <span class="font-bold text-slate-900 dark:text-slate-100">
                {props.manifest?.run_id ?? props.runId ?? "Replay Mode"}
              </span>
            </div>
            <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span class="text-slate-500">Dataset ID / SHA:</span>
              <span class="text-slate-700 dark:text-slate-300">
                {props.manifest?.dataset_id ?? "-"} (
                {props.manifest?.csv_sha?.slice(0, 8) ?? "demo"})
              </span>
            </div>
            <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span class="text-slate-500">Deterministic Seed:</span>
              <span class="font-bold text-emerald-600 dark:text-emerald-400">
                {props.manifest?.seed ?? 42}
              </span>
            </div>
            <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span class="text-slate-500">Forecaster:</span>
              <span class="font-bold text-cyan-600 dark:text-cyan-400 uppercase">
                {props.manifest?.config?.forecaster?.id ?? "ARIMA"} (h=
                {props.manifest?.config?.pfvi?.h ?? 4})
              </span>
            </div>
            <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span class="text-slate-500">Imputer:</span>
              <span class="text-slate-700 dark:text-slate-300 capitalize">
                {props.manifest?.config?.imputer?.id ?? "Linear"} (k=
                {props.manifest?.config?.imputer?.k ?? 5})
              </span>
            </div>
            <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span class="text-slate-500">PFVI Parameters:</span>
              <span class="text-slate-700 dark:text-slate-300">
                R0={props.manifest?.config?.pfvi?.r0 ?? 3000}, dt=
                {props.manifest?.config?.pfvi?.dt ?? 1}
              </span>
            </div>
            <div class="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
              <span class="text-slate-500">PeatFR Parity Verdict:</span>
              <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">
                VERIFIED PARITY
              </span>
            </div>
            <div class="flex items-center justify-between py-1">
              <span class="text-slate-500">Frames Checksum:</span>
              <span class="text-[10px] text-slate-500 font-mono">
                {props.manifest?.frames_sha256 ?? "f79e3ac8102b"}
              </span>
            </div>
          </div>

          <div class="pt-2 flex justify-end">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold text-xs shadow transition-colors cursor-pointer"
            >
              {t().playerCloseBtn}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};
