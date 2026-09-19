import { Component } from "solid-js";
import type { DatasetPreview, DatasetSummary } from "../lib/types";
import { computeMissingPercent } from "../utils/data";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export interface DatasetKpiStripProps {
  currentDataset: DatasetSummary | undefined;
  preview: DatasetPreview | null;
}

export const DatasetKpiStrip: Component<DatasetKpiStripProps> = (props) => {
  const t = () => catalogs[view.lang];
  const missingPct = () => computeMissingPercent(props.currentDataset, props.preview);

  return (
    <div class="px-6 py-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-900/20 flex flex-wrap items-center gap-2.5 shrink-0 select-none">
      {/* N Rows */}
      <div class="px-3 py-1 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center space-x-2 shadow-2xs">
        <span class="text-[10px] uppercase font-mono font-bold text-slate-400">N</span>
        <span class="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
          {props.currentDataset?.n ?? props.preview?.head.length ?? 0} {t().dataKpiRows}
        </span>
      </div>

      {/* Series */}
      <div class="px-3 py-1 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center space-x-2 shadow-2xs">
        <span class="text-[10px] uppercase font-mono font-bold text-slate-400">
          {t().dataKpiSeriesLabel}
        </span>
        <span class="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
          {t().dataKpiSeriesValue}
        </span>
      </div>

      {/* Missing */}
      <div class="px-3 py-1 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center space-x-2 shadow-2xs">
        <span class="text-[10px] uppercase font-mono font-bold text-slate-400">
          {t().dataKpiMissingLabel}
        </span>
        <span
          class={`text-xs font-mono font-bold ${
            (props.preview?.missing.total ?? 0) > 0 ? "text-amber-500" : "text-emerald-500"
          }`}
        >
          {t().dataKpiMissingCells(props.preview?.missing.total ?? 0, missingPct())}
        </span>
      </div>

      {/* Timeline Horizon */}
      <div class="px-3 py-1 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center space-x-2 shadow-2xs">
        <span class="text-[10px] uppercase font-mono font-bold text-slate-400">
          {t().dataKpiTimelineLabel}
        </span>
        <span class="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
          t = 1 → {props.currentDataset?.n ?? 0}
        </span>
      </div>

      {/* Models Trained */}
      <div class="px-3 py-1 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center space-x-2 shadow-2xs">
        <span class="text-[10px] uppercase font-mono font-bold text-slate-400">
          {t().dataKpiModelsLabel}
        </span>
        <span class="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
          {t().dataKpiModelsTrained(props.currentDataset?.run_count ?? 0)}
        </span>
      </div>
    </div>
  );
};
