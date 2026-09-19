import { Component, createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { RowPreview } from "../lib/types";
import { datasetGetRows } from "../lib/tauri";
import { view } from "../lib/store";

export interface VirtualPreviewTableProps {
  rows: RowPreview[];
  datasetId?: string | null;
  totalDatasetRows?: number;
  height?: number;
  rowHeight?: number;
  isAllMode?: boolean;
}

export const VirtualPreviewTable: Component<VirtualPreviewTableProps> = (props) => {
  let scrollContainerRef: HTMLDivElement | null = null;
  const rowHeight = () => props.rowHeight ?? 38;
  const [measuredHeight, setMeasuredHeight] = createSignal(480);

  onMount(() => {
    if (scrollContainerRef) {
      const updateHeight = () => {
        if (scrollContainerRef && scrollContainerRef.clientHeight > 50) {
          setMeasuredHeight(scrollContainerRef.clientHeight);
        }
      };
      updateHeight();
      const ro = new ResizeObserver(updateHeight);
      ro.observe(scrollContainerRef);
      onCleanup(() => ro.disconnect());
    }
  });

  const containerHeight = () => props.height ?? measuredHeight();

  const [scrollTop, setScrollTop] = createSignal(0);
  const [loadedCount, setLoadedCount] = createSignal(60);
  const [pagedRows, setPagedRows] = createSignal<RowPreview[]>([]);
  let isFetching = false;

  const totalAvailable = () => props.totalDatasetRows ?? props.rows.length;

  const allAvailableRows = () => {
    if (pagedRows().length > 0) return pagedRows();
    return props.rows;
  };

  const activeRows = () => {
    if (!props.isAllMode) return props.rows;
    const all = allAvailableRows();
    // If all rows are already in memory (e.g. small datasets <= 1000 rows like Sabangau or example8),
    // do not artificially cap at 60 rows! Virtual scrolling smoothly renders the visible slice.
    if (all.length >= totalAvailable()) {
      return all;
    }
    return all.slice(0, loadedCount());
  };
  const totalRows = () => activeRows().length;
  const totalHeight = () => totalRows() * rowHeight();

  const OVERSCAN = 8;

  const startIndex = () => Math.max(0, Math.floor(scrollTop() / rowHeight()) - OVERSCAN);
  const endIndex = () =>
    Math.min(totalRows(), Math.ceil((scrollTop() + containerHeight()) / rowHeight()) + OVERSCAN);

  const visibleRows = () => {
    const s = startIndex();
    const e = endIndex();
    return activeRows().slice(s, e);
  };

  const offsetY = () => startIndex() * rowHeight();

  const loadMore = () => {
    if (!props.isAllMode) return;
    const available = allAvailableRows().length;
    const total = totalAvailable();

    // Small/medium dataset with in-memory rows: reveal up to total
    if (available >= total) {
      if (loadedCount() < total) {
        setLoadedCount(total);
      }
      return;
    }

    // Large dataset: fetch next batch from backend via async spawn_blocking IPC
    if (props.datasetId && !isFetching) {
      isFetching = true;
      const offset = available;
      void datasetGetRows(props.datasetId, offset, 100).then((res) => {
        isFetching = false;
        if (res.ok && res.data.rows.length > 0) {
          setPagedRows((prev) => {
            const base = prev.length > 0 ? prev : props.rows;
            return [...base, ...res.data.rows];
          });
          setLoadedCount((prev) => prev + res.data.rows.length);
        }
      });
    }
  };

  const showAll = () => {
    if (props.rows.length >= totalAvailable()) {
      setLoadedCount(props.rows.length);
      return;
    }
    if (props.datasetId && !isFetching) {
      isFetching = true;
      void datasetGetRows(props.datasetId, 0, Math.min(totalAvailable(), 1000)).then((res) => {
        isFetching = false;
        if (res.ok) {
          setPagedRows(res.data.rows);
          setLoadedCount(res.data.rows.length);
        }
      });
    }
  };

  let scrollRafId: number | null = null;
  const handleScroll = (e: Event) => {
    const target = e.currentTarget as HTMLElement;
    const top = target.scrollTop;

    if (scrollRafId !== null) return;
    scrollRafId = requestAnimationFrame(() => {
      scrollRafId = null;
      setScrollTop(top);

      // Auto-load next batch when user scrolls within 300px of bottom
      if (props.isAllMode && top + target.clientHeight >= target.scrollHeight - 300) {
        loadMore();
      }
    });
  };

  onCleanup(() => {
    if (scrollRafId !== null) {
      cancelAnimationFrame(scrollRafId);
      scrollRafId = null;
    }
  });

  createEffect(() => {
    // Only reset state when switching datasets or toggling modes, NOT when props.rows updates
    void props.datasetId;
    void props.isAllMode;
    setLoadedCount(60);
    setPagedRows([]);
    setScrollTop(0);
    if (scrollContainerRef) scrollContainerRef.scrollTop = 0;
  });

  return (
    <div class="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/40 shadow-xs flex-1 flex flex-col min-h-0">
      <div class="overflow-x-auto flex-1 flex flex-col min-h-0">
        <div class="min-w-160 flex-1 flex flex-col min-h-0">
          {/* Sticky Table Header */}
          <div class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 sticky top-0 z-20 select-none shrink-0">
            <table class="w-full text-xs text-left font-mono table-fixed">
              <colgroup>
                <col class="w-16" />
                <col class="w-32" />
                <col class="w-28" />
                <col class="w-28" />
                <col class="w-32" />
                <col class="w-28" />
              </colgroup>
              <thead class="text-slate-600 dark:text-slate-400">
                <tr>
                  <th class="p-3">t</th>
                  <th class="p-3">{view.lang === "id" ? "Waktu" : "Time Label"}</th>
                  <th class="p-3">WT (m)</th>
                  <th class="p-3">SM (%)</th>
                  <th class="p-3">Rf (mm)</th>
                  <th class="p-3">Temp (°C)</th>
                </tr>
              </thead>
            </table>
          </div>

          {/* Virtual Scrolling Body Container */}
          <div
            ref={(el) => {
              scrollContainerRef = el;
            }}
            onScroll={handleScroll}
            style={props.height ? { height: `${props.height}px` } : undefined}
            class="overflow-y-auto relative scrollbar-thin flex-1 min-h-0"
          >
            {/* Full height spacer for native scrollbar geometry */}
            <div style={{ height: `${totalHeight()}px`, position: "relative", width: "100%" }}>
              {/* Visible window translated to current scroll offset */}
              <div
                style={{
                  transform: `translateY(${offsetY()}px)`,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                }}
              >
                <table class="w-full text-xs text-left font-mono table-fixed">
                  <colgroup>
                    <col class="w-16" />
                    <col class="w-32" />
                    <col class="w-28" />
                    <col class="w-28" />
                    <col class="w-32" />
                    <col class="w-28" />
                  </colgroup>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
                    <For each={visibleRows()}>
                      {(row) => (
                        <tr
                          style={{ height: `${rowHeight()}px` }}
                          class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td class="p-3 text-slate-400">{row.t}</td>
                          <td class="p-3 text-slate-700 dark:text-slate-300 font-medium truncate">
                            {row.time_label ?? "-"}
                          </td>
                          <td
                            class={`p-3 ${
                              row.wt === null
                                ? "text-amber-500 font-bold bg-amber-500/10"
                                : "text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            {row.wt !== null ? row.wt.toFixed(4) : "NA"}
                          </td>
                          <td
                            class={`p-3 ${
                              row.sm === null
                                ? "text-amber-500 font-bold bg-amber-500/10"
                                : "text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            {row.sm !== null ? row.sm.toFixed(3) : "NA"}
                          </td>
                          <td
                            class={`p-3 ${
                              row.rf === null
                                ? "text-amber-500 font-bold bg-amber-500/10"
                                : "text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            {row.rf !== null ? row.rf.toFixed(6) : "NA"}
                          </td>
                          <td
                            class={`p-3 ${
                              row.temp === null
                                ? "text-amber-500 font-bold bg-amber-500/10"
                                : "text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            {row.temp !== null ? row.temp.toFixed(2) : "NA"}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer bar showing row statistics & interactive lazy loading controls */}
          <div class="px-4 py-2 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2 select-none shrink-0">
            <span>
              {view.lang === "id"
                ? `Menampilkan ${Math.min(props.isAllMode ? loadedCount() : props.rows.length, totalAvailable())} dari ${totalAvailable()} baris ${props.isAllMode ? "(Jendela Virtual)" : ""}`
                : `Showing ${Math.min(props.isAllMode ? loadedCount() : props.rows.length, totalAvailable())} of ${totalAvailable()} rows ${props.isAllMode ? "(Virtual Windowed)" : ""}`}
            </span>

            <Show when={props.isAllMode && loadedCount() < totalAvailable()}>
              <div class="flex items-center space-x-2">
                <span class="text-slate-500 hidden sm:inline">
                  {totalAvailable() - loadedCount()} {view.lang === "id" ? "tersisa" : "remaining"}
                </span>
                <button
                  type="button"
                  onClick={loadMore}
                  class="px-2.5 py-1 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 transition-all cursor-pointer flex items-center space-x-1 shadow-2xs"
                >
                  <span>{view.lang === "id" ? "Muat Lebih Banyak (+60)" : "Show More (+60)"}</span>
                </button>
                <button
                  type="button"
                  onClick={showAll}
                  class="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold border border-slate-300 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
                >
                  <span>{view.lang === "id" ? "Tampilkan Semua" : "Show All"}</span>
                </button>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualPreviewTable;
