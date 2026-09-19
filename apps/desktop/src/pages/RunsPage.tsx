import { Component, createEffect, createMemo, createSignal, For, onMount, Show } from "solid-js";
import { Check, Layers, Search, Sliders, Trash, Upload, X } from "lucide-solid";
import { datasetsList, runDelete, runGet, runImport, runsList } from "../lib/tauri";
import { mutationBus, useDatasetsVersion, useRunsVersion } from "../lib/mutation";
import { navigateTab, openSimulationTab, playback, setPlayback, view } from "../lib/store";
import { parseRunFile } from "../lib/runImporter";
import type { DatasetSummary, RunDetail, RunSummary } from "../lib/types";
import { toast } from "../lib/toast";
import { Dropdown } from "../components/Dropdown";
import { catalogs } from "../i18n/catalog";
import { COMPARE_COLORS } from "../utils/runs";
import { RunComparisonView } from "../components/RunComparisonView";
import { RunDetailView } from "../components/RunDetailView";
import { RunDeleteDialog } from "../components/RunDeleteDialog";
import { RunsEmptyState } from "../components/RunsEmptyState";
import { RunConfigureDialog } from "../components/RunConfigureDialog";

export interface RunsPageProps {
  isActive?: boolean;
}

export const RunsPage: Component<RunsPageProps> = (props) => {
  const t = () => catalogs[view.lang];

  const [runs, setRuns] = createSignal<RunSummary[]>([]);
  const [datasets, setDatasets] = createSignal<DatasetSummary[]>([]);
  const [filterDatasetId, setFilterDatasetId] = createSignal<string>("all");
  const [selectedRunDetail, setSelectedRunDetail] = createSignal<RunDetail | null>(null);
  const [selectedRunIds, setSelectedRunIds] = createSignal<string[]>([]);
  const [comparisonDetails, setComparisonDetails] = createSignal<RunDetail[]>([]);
  const [activeCompareRunIdx, setActiveCompareRunIdx] = createSignal<number | null>(null);
  const [metricsFilter, setMetricsFilter] = createSignal("");
  const [searchRunQuery, setSearchRunQuery] = createSignal("");
  const [copiedRunId, setCopiedRunId] = createSignal<string | null>(null);
  const [copiedMetricKey, setCopiedMetricKey] = createSignal<string | null>(null);
  const [runToDelete, setRunToDelete] = createSignal<string | null>(null);
  const [deleting, setDeleting] = createSignal(false);
  const [runToReconfigure, setRunToReconfigure] = createSignal<RunDetail | null>(null);

  const totalRunsCount = createMemo(() => {
    const dsTotal = datasets().reduce((acc, ds) => acc + (ds.run_count ?? 0), 0);
    return Math.max(dsTotal, runs().length);
  });

  let fileInputRef: HTMLInputElement | null = null;

  const handleImportRunClick = () => {
    fileInputRef?.click();
  };

  const handleFileSelected = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    try {
      const imported = await parseRunFile(file);
      const cleanName = imported.fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const res = await runImport(cleanName, imported.frames, imported.manifest.config);

      if (res.ok) {
        mutationBus.notifyRunMutated(res.data.run_id);
        await fetchRuns();

        // Open in simulation player tab!
        openSimulationTab(res.data.run_id, res.data.name);

        toast.success(t().runsImportSuccessToast(res.data.name, imported.frames.length));
      } else {
        toast.error(`Import failed: ${res.message}`);
      }
    } catch (err) {
      toast.error(`Import failed: ${String(err)}`);
    } finally {
      target.value = "";
    }
  };

  const fetchRuns = async () => {
    const dsId = filterDatasetId() === "all" ? undefined : filterDatasetId();
    const res = await runsList(50, 0, dsId);
    if (res.ok) {
      setRuns(res.data);
      if (playback.selectedRunId) {
        const found = res.data.find((r) => r.run_id === playback.selectedRunId);
        if (found) {
          inspectRun(found.run_id);
        } else if (!selectedRunDetail() && res.data.length > 0) {
          inspectRun(res.data[0].run_id);
        }
      } else if (!selectedRunDetail() && res.data.length > 0) {
        inspectRun(res.data[0].run_id);
      }
    } else {
      console.error("[RunsPage] Failed to fetch runs:", res);
    }
    const dsRes = await datasetsList();
    if (dsRes.ok) {
      setDatasets(dsRes.data);
    } else {
      console.error("[RunsPage] Failed to fetch datasets:", dsRes);
    }
  };

  void fetchRuns();

  onMount(() => {
    void fetchRuns();
  });

  const inspectRun = async (runId: string) => {
    const res = await runGet(runId);
    if (res.ok) {
      setSelectedRunDetail(res.data);
    }
  };

  createEffect(() => {
    useRunsVersion();
    useDatasetsVersion();
    void filterDatasetId();
    if (props.isActive !== false) {
      void fetchRuns();
    }
  });

  const toggleSelectRun = async (runId: string) => {
    const current = selectedRunIds();
    let next: string[];
    if (current.includes(runId)) {
      next = current.filter((id) => id !== runId);
    } else {
      if (current.length >= 10) {
        next = [...current.slice(1), runId];
      } else {
        next = [...current, runId];
      }
    }
    setSelectedRunIds(next);

    // Fetch comparison details
    const details: RunDetail[] = [];
    for (const id of next) {
      const r = await runGet(id);
      if (r.ok) details.push(r.data);
    }
    setComparisonDetails(details);
  };

  const handleLoadIntoPlayer = async (runId: string, runName?: string) => {
    openSimulationTab(runId, runName);
  };

  const handleConfirmDelete = async () => {
    const id = runToDelete();
    if (!id) return;
    setDeleting(true);
    try {
      const res = await runDelete(id);
      if (res.ok) {
        toast.success(t().runsDeletedToast);
        if (playback.selectedRunId === id) {
          setPlayback("selectedRunId", null);
        }
        if (selectedRunDetail()?.summary.run_id === id) {
          setSelectedRunDetail(null);
        }
        if (selectedRunIds().includes(id)) {
          setSelectedRunIds((prev) => prev.filter((x) => x !== id));
        }
        setRunToDelete(null);
        // Immediately remove from local state so list updates with 0 latency
        setRuns((prev) => prev.filter((r) => r.run_id !== id));
        mutationBus.notifyRunMutated(null);
        await fetchRuns();
      } else {
        toast.error(`Failed to delete run: ${res.message}`);
      }
    } finally {
      setDeleting(false);
    }
  };

  const filteredRuns = createMemo(() => {
    const q = searchRunQuery().toLowerCase().trim();
    const list = runs();
    if (!q) return list;
    return list.filter((r) => {
      const matchName = r.name.toLowerCase().includes(q);
      const matchId = r.run_id.toLowerCase().includes(q);
      const matchDs = (r.dataset_name ?? "").toLowerCase().includes(q);
      const matchImp = (r.imputer_id ?? "").toLowerCase().includes(q);
      const matchFc = (r.forecaster_id ?? "").toLowerCase().includes(q);
      return matchName || matchId || matchDs || matchImp || matchFc;
    });
  });

  const copyText = async (text: string, type: "run" | "metric") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "run") {
        setCopiedRunId(text);
        setTimeout(() => setCopiedRunId(null), 1500);
      } else {
        setCopiedMetricKey(text);
        setTimeout(() => setCopiedMetricKey(null), 1500);
      }
      toast.info(t().runsCopiedClipboard);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div class="h-full flex flex-col md:flex-row overflow-hidden bg-white dark:bg-slate-950">
      {/* Left List of Runs */}
      <div class="w-full md:w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 flex flex-col shrink-0">
        {/* Hidden File Input for Importing Run */}
        <input
          ref={(el) => (fileInputRef = el)}
          type="file"
          accept=".json,.csv,text/csv,application/json"
          class="hidden"
          onChange={handleFileSelected}
        />
        <div class="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 relative z-20">
          <h2 class="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider font-mono shrink-0">
            {t().runsListTitle}
          </h2>
          <Dropdown
            align="right"
            value={filterDatasetId()}
            onChange={(val) => {
              setFilterDatasetId(val);
              fetchRuns();
            }}
            options={[
              {
                value: "all",
                label: t().runsAllDatasets,
                badge: `${totalRunsCount()}`,
                badgeType: "neutral",
              },
              ...datasets().map((ds) => ({
                value: ds.id,
                label: ds.name,
                badge: `${ds.run_count ?? 0}`,
                badgeType: ((ds.run_count ?? 0) > 0 ? "emerald" : "neutral") as
                  | "emerald"
                  | "neutral",
              })),
            ]}
            size="sm"
            class="w-36 sm:w-44"
          />
        </div>

        {/* Search Runs Bar */}
        <div class="p-2 border-b border-slate-200 dark:border-slate-800 space-y-1.5">
          <div class="relative flex items-center">
            <Search
              size={13}
              class="absolute left-2.5 text-slate-400 dark:text-slate-500 pointer-events-none"
            />
            <input
              type="text"
              placeholder={t().runsSearchPlaceholder}
              value={searchRunQuery()}
              onInput={(e) => setSearchRunQuery(e.currentTarget.value)}
              disabled={runs().length === 0}
              class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-7.5 pr-7 py-1 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-2xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Show when={searchRunQuery()}>
              <button
                type="button"
                onClick={() => setSearchRunQuery("")}
                class="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={12} />
              </button>
            </Show>
          </div>

          {/* Import Run Action */}
          <button
            type="button"
            onClick={handleImportRunClick}
            class="w-full py-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800 text-xs font-mono font-medium flex items-center justify-center space-x-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <Upload size={12} />
            <span>{t().runsImportBtn}</span>
          </button>
        </div>

        {/* Active Comparison Counter & Clear Bar */}
        <Show when={selectedRunIds().length > 0}>
          <div class="px-3 py-1.5 bg-emerald-50/80 dark:bg-emerald-950/40 border-b border-emerald-200/70 dark:border-emerald-800/50 flex items-center justify-between text-[11px] font-mono transition-all">
            <span class="text-emerald-800 dark:text-emerald-300 font-bold flex items-center space-x-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t().runsSelectedForCompare(selectedRunIds().length)}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedRunIds([]);
                setComparisonDetails([]);
              }}
              class="text-[10px] text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 underline cursor-pointer"
            >
              {t().runsResetCompare}
            </button>
          </div>
        </Show>

        <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
          <Show
            when={filteredRuns().length > 0}
            fallback={
              <Show
                when={runs().length > 0}
                fallback={
                  <div class="p-6 text-center text-xs text-slate-400 dark:text-slate-500 space-y-1.5 font-medium select-none">
                    <Layers size={20} class="mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                    <p class="font-semibold text-slate-600 dark:text-slate-300">
                      {t().runsSidebarEmptyTitle}
                    </p>
                    <p class="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                      {t().runsSidebarEmptyDesc}
                    </p>
                  </div>
                }
              >
                <div class="p-6 text-center text-xs text-slate-400 dark:text-slate-500 space-y-2 font-medium select-none">
                  <Search size={18} class="mx-auto text-slate-300 dark:text-slate-600" />
                  <p class="font-semibold text-slate-600 dark:text-slate-300">
                    {t().runsSidebarNoFilterMatch}
                  </p>
                  <p class="text-[11px] text-slate-400">
                    {searchRunQuery()
                      ? t().runsNoRunsFilterDesc(searchRunQuery())
                      : t().runsNoRunsFound}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchRunQuery("");
                      setFilterDatasetId("all");
                      fetchRuns();
                    }}
                    class="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    {t().runsSidebarResetFilter}
                  </button>
                </div>
              </Show>
            }
          >
            <For each={filteredRuns()}>
              {(run) => {
                const isInspected = () => selectedRunDetail()?.summary.run_id === run.run_id;
                const isChecked = () => selectedRunIds().includes(run.run_id);
                const compareIdx = () => selectedRunIds().indexOf(run.run_id);
                const compareColor = () =>
                  compareIdx() !== -1 ? COMPARE_COLORS[compareIdx() % COMPARE_COLORS.length] : null;

                return (
                  <div
                    onClick={() => inspectRun(run.run_id)}
                    class={`group p-3 rounded-xl border cursor-pointer transition-all ${
                      isInspected()
                        ? "bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-500 text-slate-900 dark:text-slate-100 shadow-xs ring-1 ring-emerald-500/30"
                        : isChecked()
                          ? "bg-slate-50/90 dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                          : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div class="flex items-start justify-between mb-1.5 gap-2">
                      <div class="flex items-center space-x-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isChecked()}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectRun(run.run_id);
                          }}
                          class={`relative flex items-center justify-center w-4.5 h-4.5 rounded-md border transition-all duration-150 shrink-0 cursor-pointer ${
                            isChecked()
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-xs shadow-emerald-600/30 scale-100"
                              : "bg-white dark:bg-slate-800/90 border-slate-300 dark:border-slate-700 text-transparent hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800"
                          }`}
                          style={
                            isChecked() && compareColor()
                              ? {
                                  "box-shadow": `0 0 0 2px ${compareColor()}40`,
                                  "border-color": compareColor()!,
                                  "background-color": compareColor()!,
                                }
                              : {}
                          }
                          title={
                            isChecked()
                              ? t().runsRemoveFromCompareTooltip
                              : t().runsSelectToCompareTooltip
                          }
                        >
                          <Check
                            size={11}
                            stroke-width={3}
                            class={`transition-transform duration-150 text-white ${
                              isChecked() ? "scale-100 opacity-100" : "scale-50 opacity-0"
                            }`}
                          />
                        </button>
                        <span
                          class={`text-xs font-bold truncate ${
                            isInspected()
                              ? "text-emerald-950 dark:text-emerald-300"
                              : "text-slate-900 dark:text-slate-200"
                          }`}
                        >
                          {run.name}
                        </span>
                      </div>
                      <div class="flex items-center space-x-1 shrink-0">
                        <Show when={isChecked() && compareIdx() !== -1}>
                          <span
                            class="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full text-white shadow-2xs"
                            style={{ "background-color": compareColor()! }}
                            title={`Comparison Run #${compareIdx() + 1}`}
                          >
                            #{compareIdx() + 1}
                          </span>
                        </Show>
                        <span class="text-[10px] text-slate-500 font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          h={run.h}
                        </span>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const r = await runGet(run.run_id);
                            if (r.ok) {
                              setRunToReconfigure(r.data);
                            }
                          }}
                          class="text-slate-400 hover:text-purple-500 text-xs p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-0.5 cursor-pointer"
                          title={t().runsReconfigureBtn}
                        >
                          <Sliders size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRunToDelete(run.run_id);
                          }}
                          class="text-slate-400 hover:text-rose-500 text-xs p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-0.5 cursor-pointer"
                          title="Delete run"
                        >
                          <Trash size={12} />
                        </button>
                      </div>
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pl-7">
                      <span class="font-mono">
                        {run.imputer_id ?? "knn"} × {run.forecaster_id ?? "arima"}
                      </span>
                      <span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {run.best_pfvi_mse !== null ? `MSE ${run.best_pfvi_mse.toFixed(2)}` : "-"}
                      </span>
                    </div>
                  </div>
                );
              }}
            </For>
          </Show>
        </div>
      </div>

      {/* Right Detail / Comparison Area */}
      <div class="flex-1 min-w-0 flex flex-col overflow-hidden bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4 transition-colors">
        <Show
          when={comparisonDetails().length >= 2}
          fallback={
            <Show
              when={runs().length > 0}
              fallback={
                <RunsEmptyState
                  onGoToTraining={() => navigateTab("train")}
                  onImportClick={handleImportRunClick}
                  onNavigateToData={() => navigateTab("data")}
                />
              }
            >
              <Show
                when={filteredRuns().length > 0}
                fallback={
                  <div class="flex-1 flex flex-col items-center justify-center text-center p-6 select-none my-auto max-w-md mx-auto space-y-3">
                    <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
                      <Search size={22} />
                    </div>
                    <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">
                      {t().runsSidebarNoFilterMatch}
                    </h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                      {searchRunQuery()
                        ? t().runsNoRunsFilterDesc(searchRunQuery())
                        : t().runsNoRunsFound}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchRunQuery("");
                        setFilterDatasetId("all");
                        fetchRuns();
                      }}
                      class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
                    >
                      {t().runsSidebarResetFilter}
                    </button>
                  </div>
                }
              >
                <RunDetailView
                  detail={selectedRunDetail()}
                  copiedRunId={copiedRunId()}
                  copiedMetricKey={copiedMetricKey()}
                  metricsFilter={metricsFilter()}
                  setMetricsFilter={setMetricsFilter}
                  onCopyText={copyText}
                  onLoadIntoPlayer={handleLoadIntoPlayer}
                  onDeleteClick={(id) => setRunToDelete(id)}
                  onImportClick={handleImportRunClick}
                  onGoToTraining={() => navigateTab("train")}
                  onReconfigureClick={(detail) => setRunToReconfigure(detail)}
                />
              </Show>
            </Show>
          }
        >
          <RunComparisonView
            comparisonDetails={comparisonDetails()}
            activeCompareRunIdx={activeCompareRunIdx()}
            setActiveCompareRunIdx={setActiveCompareRunIdx}
            onClearComparison={() => {
              setSelectedRunIds([]);
              setComparisonDetails([]);
            }}
            onLoadIntoPlayer={handleLoadIntoPlayer}
          />
        </Show>
      </div>

      {/* Delete Confirmation Dialog */}
      <RunDeleteDialog
        runId={runToDelete()}
        deleting={deleting()}
        onClose={() => setRunToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Reconfigure and Run Dialog */}
      <RunConfigureDialog
        runDetail={runToReconfigure()}
        onClose={() => setRunToReconfigure(null)}
        onRunLaunched={() => fetchRuns()}
      />
    </div>
  );
};

export default RunsPage;
