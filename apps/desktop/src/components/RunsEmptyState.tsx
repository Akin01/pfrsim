import { Component, For } from "solid-js";
import { ArrowRight, ChartColumn, Upload } from "lucide-solid";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export interface RunsEmptyStateProps {
  onGoToTraining: () => void;
  onImportClick: () => void;
  onNavigateToData?: () => void;
}

export const RunsEmptyState: Component<RunsEmptyStateProps> = (props) => {
  const t = () => catalogs[view.lang];

  return (
    <div class="flex-1 flex flex-col items-center justify-center text-center p-6 select-none my-auto max-w-xl mx-auto">
      {/* Icon */}
      <div class="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/30 flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400 shadow-2xs">
        <ChartColumn size={26} />
      </div>

      {/* Heading */}
      <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 tracking-tight">
        {t().runsEmptyHeroTitle}
      </h2>

      {/* Subtitle */}
      <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
        {t().runsEmptyHeroDesc}
      </p>

      {/* Action Buttons */}
      <div class="flex flex-wrap items-center justify-center gap-3 mb-6">
        <button
          type="button"
          onClick={props.onGoToTraining}
          class="px-4.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs hover:shadow-md transition-all flex items-center space-x-2 cursor-pointer active:scale-95"
        >
          <span>{t().runsEmptyStartTraining}</span>
          <ArrowRight size={13} />
        </button>

        <button
          type="button"
          onClick={props.onImportClick}
          class="px-4.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-semibold text-xs shadow-2xs hover:shadow-xs transition-all flex items-center space-x-2 cursor-pointer active:scale-95"
        >
          <Upload size={13} class="text-slate-500 dark:text-slate-400" />
          <span>{t().runsEmptyImportRun}</span>
        </button>
      </div>

      {/* Lightweight Feature Highlights */}
      <div class="flex flex-wrap items-center justify-center gap-1.5 pt-1">
        <For
          each={[
            view.lang === "id" ? "Komparasi Multi-Model" : "Multi-Model Benchmark",
            view.lang === "id" ? "Trajektori Risiko PFVI" : "PFVI Risk Trajectory",
            view.lang === "id" ? "Simulasi Spasial 2D & 3D" : "2D & 3D Simulation",
          ]}
        >
          {(item) => (
            <span class="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              {item}
            </span>
          )}
        </For>
      </div>

      {/* Storage Note */}
      <div class="mt-6 flex items-center space-x-1.5 text-[11px] text-slate-400 font-mono">
        {t().runsEmptyFormatsNote}
      </div>
    </div>
  );
};

export default RunsEmptyState;
