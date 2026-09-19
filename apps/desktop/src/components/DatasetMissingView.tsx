import { Component, For } from "solid-js";
import { Workflow } from "lucide-solid";
import type { DatasetPreview, DatasetSummary } from "../lib/types";
import { computeMissingPercent, getSeriesConfig } from "../utils/data";
import { view } from "../lib/store";

export interface DatasetMissingViewProps {
  currentDataset: DatasetSummary | undefined;
  preview: DatasetPreview | null;
}

export const DatasetMissingView: Component<DatasetMissingViewProps> = (props) => {
  const seriesCfg = () => getSeriesConfig(view.lang);
  const missingPercent = () => computeMissingPercent(props.currentDataset, props.preview);

  const hasMissingInBin = (indices: number[], start: number, end: number): boolean => {
    if (!indices || indices.length === 0) return false;
    let lo = 0;
    let hi = indices.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (indices[mid] < start) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo < indices.length && indices[lo] < end;
  };
  return (
    <div class="space-y-4 select-none">
      {/* Overview Card */}
      <div class="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            {view.lang === "id" ? "Ringkasan Kelengkapan Data" : "Data Completeness Summary"}
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {view.lang === "id"
              ? "Peta sebaran nilai kosong (NA) pada masing-masing variabel lingkungan"
              : "Missing data (NA) distribution mapped across environmental series"}
          </p>
        </div>
        <div class="flex items-center space-x-3 text-xs font-mono">
          <div class="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span class="text-slate-400">Total NA: </span>
            <strong class="text-amber-500 font-bold">{props.preview?.missing.total} cells</strong>
          </div>
          <div class="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span class="text-slate-400">Rate: </span>
            <strong class="text-slate-900 dark:text-slate-100 font-bold">
              {missingPercent()}%
            </strong>
          </div>
        </div>
      </div>

      {/* Per-Variable Missingness Timeline Bar */}
      <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <h4 class="text-xs font-bold font-mono text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          {view.lang === "id"
            ? "Peta Jalur Waktu Sel Kosong (Missing Timeline)"
            : "Missing Value Timeline Strips"}
        </h4>

        <div class="space-y-4">
          <For each={["wt", "sm", "rf", "temp"] as const}>
            {(k) => {
              const cfg = seriesCfg()[k];
              const miss = () => props.preview?.missing[k];
              const totalN = () => props.currentDataset?.n ?? 192;
              const indices = () => miss()?.indices ?? [];

              return (
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between text-xs font-mono">
                    <span class="font-bold text-slate-800 dark:text-slate-200">
                      {cfg.name} · {cfg.label}
                    </span>
                    <span class="text-[11px] text-slate-400">
                      {miss()?.count ?? 0} {view.lang === "id" ? "kosong" : "missing"}{" "}
                      {miss()?.count
                        ? `[t = ${miss()
                            ?.indices.map((i) => i + 1)
                            .slice(0, 10)
                            .join(", ")}${miss()!.indices.length > 10 ? "..." : ""}]`
                        : ""}
                    </span>
                  </div>

                  {/* 100-cell visual strip with O(log M) binary search */}
                  <div class="w-full h-3 rounded-md bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                    {Array.from({ length: Math.min(100, totalN()) }).map((_, colIdx) => {
                      const startT = Math.floor((colIdx / 100) * totalN());
                      const endT = Math.floor(((colIdx + 1) / 100) * totalN());
                      const hasMissing = hasMissingInBin(indices(), startT, endT);
                      return (
                        <div
                          class={`flex-1 h-full border-r border-slate-900/30 ${
                            hasMissing ? "bg-amber-400" : "bg-emerald-500/70"
                          }`}
                          title={
                            hasMissing
                              ? `Missing data detected around step ${startT + 1}`
                              : `Complete data`
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              );
            }}
          </For>
        </div>

        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-1.5">
              <span class="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
              <span>{view.lang === "id" ? "Data Lengkap" : "Complete Data"}</span>
            </div>
            <div class="flex items-center space-x-1.5">
              <span class="w-2.5 h-2.5 rounded-xs bg-amber-400" />
              <span>{view.lang === "id" ? "Nilai Kosong" : "Missing Value"}</span>
            </div>
          </div>
          <span>Timeline: t = 1 → {props.currentDataset?.n ?? 0}</span>
        </div>
      </div>

      {/* Recommendation Box */}
      <div class="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start space-x-3 text-xs">
        <div class="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
          <Workflow size={14} />
        </div>
        <div class="space-y-1">
          <span class="font-bold text-emerald-700 dark:text-emerald-300 font-mono">
            {view.lang === "id"
              ? "Rekomendasi Imputasi Algoritma"
              : "Recommended Imputation Strategy"}
          </span>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {view.lang === "id"
              ? (props.preview?.missing.total ?? 0) <= 10
                ? "Tingkat nilai hilang sangat rendah (<5%). Imputer kNN (k=5) direkomendasikan untuk mengisi sel kosong secara cepat dan deterministik sebelum optimasi PFVI."
                : "Terdapat pola nilai hilang berkelanjutan. Algoritma Spline atau Loess direkomendasikan untuk menjaga kontinuitas tren hidrologi gambut."
              : (props.preview?.missing.total ?? 0) <= 10
                ? "Low missingness rate (<5%). kNN imputer (k=5) is recommended for fast deterministic filling before Nelder-Mead PFVI calibration."
                : "Continuous missing patterns detected. Spline or Loess algorithm is recommended to preserve hydrological continuity."}
          </p>
        </div>
      </div>
    </div>
  );
};
