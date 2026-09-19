import { Component, createMemo } from "solid-js";
import { Search } from "lucide-solid";
import type { DatasetDetail, DatasetPreview, DatasetSummary } from "../lib/types";
import { allDatasetRows, filterDatasetRows } from "../utils/data";
import { VirtualPreviewTable } from "./VirtualPreviewTable";
import { view } from "../lib/store";

export interface DatasetTableViewProps {
  currentDataset: DatasetSummary | undefined;
  preview: DatasetPreview | null;
  detail: DatasetDetail | null;
  previewMode: "all" | "head" | "tail";
  onPreviewModeChange: (mode: "all" | "head" | "tail") => void;
  tableSearch: string;
  onTableSearchChange: (val: string) => void;
  selectedId: string | null;
}

export const DatasetTableView: Component<DatasetTableViewProps> = (props) => {
  const currentRows = createMemo(() => {
    const p = props.preview;
    if (!p) return [];
    const baseRows =
      props.previewMode === "all"
        ? allDatasetRows(p, props.detail)
        : props.previewMode === "head"
          ? p.head
          : p.tail;

    return filterDatasetRows(baseRows, props.tableSearch);
  });

  const totalRowCount = () => props.currentDataset?.n ?? props.preview?.head.length ?? 0;

  return (
    <div class="flex-1 flex flex-col min-h-0 space-y-3 select-none">
      {/* Table Toolbar */}
      <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 border border-slate-200 dark:border-slate-800 rounded-2xl shrink-0">
        <div class="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => props.onPreviewModeChange("all")}
            class={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              props.previewMode === "all"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            {view.lang === "id"
              ? `Semua Baris (${totalRowCount()})`
              : `All Rows (${totalRowCount()})`}
          </button>
          <button
            type="button"
            onClick={() => props.onPreviewModeChange("head")}
            class={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              props.previewMode === "head"
                ? "bg-slate-700 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            {view.lang === "id" ? "25 Baris Pertama" : "First 25 Rows"}
          </button>
          <button
            type="button"
            onClick={() => props.onPreviewModeChange("tail")}
            class={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              props.previewMode === "tail"
                ? "bg-slate-700 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            {view.lang === "id" ? "25 Baris Terakhir" : "Last 25 Rows"}
          </button>
        </div>

        {/* Search input */}
        <div class="relative min-w-50">
          <Search size={13} class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={view.lang === "id" ? "Cari baris data..." : "Filter rows..."}
            value={props.tableSearch}
            onInput={(e) => props.onTableSearchChange(e.currentTarget.value)}
            class="w-full pl-8 pr-3 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Virtualized Infinite Scroll Table */}
      <VirtualPreviewTable
        rows={currentRows()}
        datasetId={props.selectedId}
        totalDatasetRows={totalRowCount()}
        isAllMode={props.previewMode === "all"}
      />
    </div>
  );
};
