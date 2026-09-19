import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  Index,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import {
  Activity,
  ArrowRight,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  Database,
  Flame,
  Layers,
  RotateCw,
  Search,
  ShieldCheck,
  SlidersVertical,
  Sparkles,
  Trash,
  TriangleAlert,
  X,
  Zap,
} from "lucide-solid";
import type { JobRecord } from "../lib/types";
import { TrainingStepper } from "./TrainingStepper";
import { catalogs } from "../i18n/catalog";
import { navigateTab, setPlayback, view } from "../lib/store";

export interface TrainJobsHistoryProps {
  jobs: JobRecord[];
  filteredJobs: JobRecord[];
  completedJobs: JobRecord[];
  jobStatusFilter: "all" | "running" | "done" | "error";
  onStatusFilterChange: (filter: "all" | "running" | "done" | "error") => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  expandedJobs: string[];
  onToggleExpandJob: (id: string) => void;
  copiedJobId: string | null;
  onCopyJobId: (id: string) => void;
  onDeleteJobClick: (id: string) => void;
  onCancelJob: (id: string) => void;
  onOpenClearFinishedModal: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  clearingCompleted: boolean;
  onOpenRun: (runId: string, runName?: string) => void;
}
interface ParsedJobConfig {
  datasetName: string;
  datasetId: string;
  imputerId: string;
  imputerName: string;
  k: number;
  span: number;
  forecasterId: string;
  forecasterName: string;
  device: "CPU" | "GPU";
  batchSize?: number;
  learningRate?: number;
  epochs?: number;
  lookBack?: number;
  units?: number;
  splitRatio: number;
  h: number;
  r0: number;
  dt: number;
  fc: number;
  sat: number;
  maxGridM: number;
  seed: number;
}

function parseJobConfig(job: JobRecord): ParsedJobConfig {
  let cfg: Record<string, any> = {};
  if (job.config_json) {
    try {
      cfg = JSON.parse(job.config_json);
    } catch {}
  }

  const datasetName = job.dataset_name || job.dataset_id;
  const imputerId = (cfg.imputer?.id || "knn").toUpperCase();
  const imputerK = cfg.imputer?.k ?? 5;
  const imputerSpan = cfg.imputer?.span ?? 0.5;
  const imputerName = `${imputerId} (k=${imputerK})`;

  const forecasterId = (cfg.forecaster?.id || "arima").toUpperCase();
  const nnCfg = cfg.forecaster?.lstm || cfg.forecaster?.gru;
  const device = (nnCfg?.device || "cpu").toUpperCase() as "CPU" | "GPU";

  return {
    datasetName,
    datasetId: job.dataset_id,
    imputerId,
    imputerName,
    k: imputerK,
    span: imputerSpan,
    forecasterId,
    forecasterName: forecasterId,
    device,
    batchSize: nnCfg?.batch_size,
    learningRate: nnCfg?.learning_rate ?? cfg.forecaster?.arima?.learning_rate,
    epochs: nnCfg?.epochs,
    lookBack: nnCfg?.look_back,
    units: Array.isArray(nnCfg?.layer_units)
      ? nnCfg.layer_units[0]
      : typeof nnCfg?.units === "number"
        ? nnCfg.units
        : undefined,
    splitRatio: cfg.forecaster?.arima?.test_split_ratio ?? 0.2,
    h: cfg.pfvi?.h ?? 4,
    r0: cfg.pfvi?.r0 ?? 2700,
    dt: cfg.pfvi?.dt ?? 1.0,
    fc: cfg.pfvi?.fc ?? 40.0,
    sat: cfg.pfvi?.sat ?? 70.0,
    maxGridM: cfg.pfvi?.max_grid_m ?? 2,
    seed: cfg.seed ?? job.seed,
  };
}
export const TrainJobsHistory: Component<TrainJobsHistoryProps> = (props) => {
  const t = () => catalogs[view.lang];

  const runningJobsCount = createMemo(
    () => props.jobs.filter((j) => j.status === "running" || j.status === "queued").length,
  );
  const doneJobsCount = createMemo(() => props.jobs.filter((j) => j.status === "done").length);
  const errorJobsCount = createMemo(() => props.jobs.filter((j) => j.status === "error").length);

  // Segmented control glider indicator
  const tabRefs: Record<string, HTMLButtonElement | undefined> = {};
  let tabContainerRef: HTMLDivElement | null = null;

  const [jobTabMap, setJobTabMap] = createSignal<Record<string, "progress" | "config">>({});
  const getJobTab = (jobId: string) => {
    return jobTabMap()[jobId] || "progress";
  };
  const setJobTab = (jobId: string, tab: "progress" | "config") => {
    setJobTabMap((prev) => ({ ...prev, [jobId]: tab }));
  };
  const [gliderReady, setGliderReady] = createSignal(false);
  const [gliderStyle, setGliderStyle] = createSignal({ left: 4, width: 72 });

  const updateGlider = () => {
    const el = tabRefs[props.jobStatusFilter];
    if (el) {
      setGliderStyle({ left: el.offsetLeft, width: el.offsetWidth });
      setGliderReady(true);
    }
  };

  createEffect(() => {
    void props.jobStatusFilter;
    void view.lang;
    void props.jobs.length;
    requestAnimationFrame(() => {
      updateGlider();
      requestAnimationFrame(updateGlider);
    });
  });

  onMount(() => {
    requestAnimationFrame(updateGlider);
    window.addEventListener("resize", updateGlider);

    let resizeObs: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      resizeObs = new ResizeObserver(() => {
        requestAnimationFrame(updateGlider);
      });
      if (tabContainerRef) resizeObs.observe(tabContainerRef);
      Object.values(tabRefs).forEach((btn) => {
        if (btn) resizeObs?.observe(btn);
      });
    }

    onCleanup(() => {
      window.removeEventListener("resize", updateGlider);
      if (resizeObs) resizeObs.disconnect();
    });
  });

  return (
    <div class="flex-1 min-w-0 flex flex-col overflow-hidden bg-white dark:bg-slate-950 p-6 transition-colors">
      {/* Header Bar */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3 shrink-0">
        <div>
          <div class="flex items-center space-x-2">
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
              {t().trainJobsHistoryTitle}
            </h2>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t().trainJobsHistorySubtitle}
          </p>
        </div>

        <div class="flex items-center space-x-2">
          <Show when={props.filteredJobs.length > 0}>
            <button
              type="button"
              id="clear-finished-jobs-btn"
              onClick={props.onOpenClearFinishedModal}
              disabled={props.clearingCompleted}
              class="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-300 dark:border-slate-700 transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              title={t().trainClearFilteredTooltip(
                props.filteredJobs.length,
                props.jobStatusFilter,
              )}
            >
              <Trash size={12} class="text-rose-500" />
              <span class="text-[11px]">{t().trainClearFilteredBtn(props.jobStatusFilter)}</span>
              <span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {props.filteredJobs.length}
              </span>
            </button>
          </Show>

          <button
            type="button"
            id="refresh-jobs-btn"
            onClick={props.onRefresh}
            disabled={props.refreshing}
            class="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
            title={t().trainRefreshTooltip}
          >
            <RotateCw
              size={12}
              classList={{
                "animate-spin text-emerald-500": props.refreshing,
                "text-slate-500": !props.refreshing,
              }}
            />
            <span>{t().trainRefreshBtn}</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Strip */}
      <div class="py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Status Filter Tabs (Segmented Control with Animated Glider) */}
        <div
          ref={(el) => (tabContainerRef = el)}
          class="relative inline-flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300/80 dark:border-slate-700/60 shadow-inner select-none"
        >
          {/* Smooth Moving Glider Pill */}
          <Show when={gliderReady()}>
            <div
              class={`absolute inset-y-1 rounded-lg transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-xs pointer-events-none ${
                props.jobStatusFilter === "all"
                  ? "bg-white border border-slate-200/80 dark:bg-slate-900 dark:border-slate-700"
                  : props.jobStatusFilter === "running"
                    ? "bg-cyan-600 border border-cyan-500 shadow-cyan-600/20"
                    : props.jobStatusFilter === "done"
                      ? "bg-emerald-600 border border-emerald-500 shadow-emerald-600/20"
                      : "bg-rose-600 border border-rose-500 shadow-rose-600/20"
              }`}
              style={{
                left: `${gliderStyle().left}px`,
                width: `${gliderStyle().width}px`,
              }}
            />
          </Show>

          <button
            ref={(el) => (tabRefs["all"] = el)}
            type="button"
            onClick={() => props.onStatusFilterChange("all")}
            class={`relative z-10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 cursor-pointer flex items-center space-x-1.5 ${
              props.jobStatusFilter === "all"
                ? "text-slate-900 dark:text-white font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <span>{t().trainFilterAll}</span>
            <span
              class={`px-1.5 py-0.2 rounded-full text-[10px] font-mono transition-colors duration-200 ${
                props.jobStatusFilter === "all"
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  : "bg-slate-300/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400"
              }`}
            >
              {props.jobs.length}
            </span>
          </button>

          <button
            ref={(el) => (tabRefs["running"] = el)}
            type="button"
            onClick={() => props.onStatusFilterChange("running")}
            class={`relative z-10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 cursor-pointer flex items-center space-x-1.5 ${
              props.jobStatusFilter === "running"
                ? "text-white font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>{t().trainFilterRunning}</span>
            <span
              class={`px-1.5 py-0.2 rounded-full text-[10px] font-mono transition-colors duration-200 ${
                props.jobStatusFilter === "running"
                  ? "bg-cyan-700/60 text-white"
                  : "bg-slate-300/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400"
              }`}
            >
              {runningJobsCount()}
            </span>
          </button>

          <button
            ref={(el) => (tabRefs["done"] = el)}
            type="button"
            onClick={() => props.onStatusFilterChange("done")}
            class={`relative z-10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 cursor-pointer flex items-center space-x-1.5 ${
              props.jobStatusFilter === "done"
                ? "text-white font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <span>{t().trainFilterDone}</span>
            <span
              class={`px-1.5 py-0.2 rounded-full text-[10px] font-mono transition-colors duration-200 ${
                props.jobStatusFilter === "done"
                  ? "bg-emerald-700/60 text-white"
                  : "bg-slate-300/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400"
              }`}
            >
              {doneJobsCount()}
            </span>
          </button>

          <button
            ref={(el) => (tabRefs["error"] = el)}
            type="button"
            onClick={() => props.onStatusFilterChange("error")}
            class={`relative z-10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 cursor-pointer flex items-center space-x-1.5 ${
              props.jobStatusFilter === "error"
                ? "text-white font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <span>{t().trainFilterError}</span>
            <span
              class={`px-1.5 py-0.2 rounded-full text-[10px] font-mono transition-colors duration-200 ${
                props.jobStatusFilter === "error"
                  ? "bg-rose-700/60 text-white"
                  : "bg-slate-300/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400"
              }`}
            >
              {errorJobsCount()}
            </span>
          </button>
        </div>

        {/* Search Box */}
        <div class="relative w-full sm:w-72">
          <Search
            size={14}
            class="absolute left-3 top-3 text-slate-400 dark:text-slate-500 pointer-events-none"
          />
          <input
            type="text"
            placeholder={t().trainSearchPlaceholder}
            value={props.searchQuery}
            onInput={(e) => props.onSearchQueryChange(e.currentTarget.value)}
            class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs transition-all"
          />
          <Show when={props.searchQuery}>
            <button
              type="button"
              onClick={() => props.onSearchQueryChange("")}
              class="absolute right-2.5 top-2.5 w-4 h-4 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors"
            >
              <X size={13} />
            </button>
          </Show>
        </div>
      </div>

      {/* Scrollable Jobs List */}
      <div class="flex-1 overflow-y-auto space-y-3 pt-1">
        <Show
          when={props.filteredJobs.length > 0}
          fallback={
            <div class="h-80 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div class="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 shadow-2xs">
                <Activity size={24} />
              </div>
              <div>
                <p class="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">
                  {props.searchQuery || props.jobStatusFilter !== "all"
                    ? t().trainNoJobsMatchingFilter
                    : t().trainNoJobsSubmittedYet}
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  {props.searchQuery || props.jobStatusFilter !== "all"
                    ? t().trainNoJobsMatchingFilterDesc
                    : t().trainNoJobsSubmittedYetDesc}
                </p>
              </div>
              <Show when={props.searchQuery || props.jobStatusFilter !== "all"}>
                <button
                  type="button"
                  onClick={() => {
                    props.onSearchQueryChange("");
                    props.onStatusFilterChange("all");
                  }}
                  class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  {t().trainResetFilters}
                </button>
              </Show>
            </div>
          }
        >
          <Index each={props.filteredJobs}>
            {(job) => {
              const j = job;
              const statusBadge = () => {
                switch (j().status) {
                  case "done":
                    return {
                      cls: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700",
                      label: "COMPLETED",
                    };
                  case "running":
                    return {
                      cls: "bg-cyan-50 text-cyan-700 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-700 animate-pulse",
                      label: "RUNNING",
                    };
                  case "error":
                    return {
                      cls: "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700",
                      label: "ERROR",
                    };
                  default:
                    return {
                      cls: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
                      label: "QUEUED",
                    };
                }
              };

              return (
                <div class="p-5 bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl space-y-4 shadow-sm dark:shadow-none hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                  {/* Top Row: Status, Job ID, Copy, Timestamps, Trash */}
                  <div class="flex items-center justify-between flex-wrap gap-2">
                    <div class="flex items-center space-x-2">
                      <span
                        class={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border font-mono tracking-wider ${statusBadge().cls}`}
                      >
                        {statusBadge().label}
                      </span>

                      <span class="text-xs text-slate-800 dark:text-slate-200 font-mono font-bold">
                        {j().job_id}
                      </span>

                      <button
                        type="button"
                        onClick={() => props.onCopyJobId(j().job_id)}
                        class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Copy job ID"
                      >
                        <Show when={props.copiedJobId === j().job_id} fallback={<Copy size={12} />}>
                          <Check size={12} class="text-emerald-600 dark:text-emerald-400" />
                        </Show>
                      </button>
                    </div>

                    <div class="flex items-center space-x-2">
                      <span class="text-[10px] text-slate-500 font-mono">{j().created_at}</span>

                      <Show when={j().status !== "running"}>
                        <button
                          type="button"
                          onClick={() => props.onDeleteJobClick(j().job_id)}
                          class="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Delete job record"
                        >
                          <Trash size={13} />
                        </button>
                      </Show>
                    </div>
                  </div>

                  {/* Interactive Switching Tag: Training Progress vs. Detail Config */}
                  {(() => {
                    const parsed = parseJobConfig(j());
                    const currentTab = () => getJobTab(j().job_id);
                    const isExpanded = () =>
                      j().status === "running" ||
                      j().status === "queued" ||
                      props.expandedJobs.includes(j().job_id);
                    return (
                      <Show
                        when={isExpanded()}
                        fallback={
                          <div
                            onClick={() => props.onToggleExpandJob(j().job_id)}
                            class="p-3 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100/90 dark:hover:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 rounded-xl flex items-center justify-between flex-wrap gap-2 cursor-pointer transition-colors shadow-2xs group"
                          >
                            <div class="flex items-center space-x-2 text-xs font-mono">
                              <span class="font-bold text-slate-800 dark:text-slate-200">
                                {parsed.imputerName} × {parsed.forecasterName}
                              </span>
                              <span class="text-slate-400">·</span>
                              <span class="text-slate-500 dark:text-slate-400">
                                {j().status === "done"
                                  ? view.lang === "id"
                                    ? "100% Selesai"
                                    : "100% Completed"
                                  : (j().stage ?? "Failed")}
                              </span>
                              <Show when={j().duration_seconds}>
                                <span class="text-slate-400">·</span>
                                <span class="text-slate-500 dark:text-slate-400">
                                  {j().duration_seconds?.toFixed(1)}s
                                </span>
                              </Show>
                            </div>

                            <div class="flex items-center space-x-1.5 text-[10px] font-mono">
                              <span class="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold">
                                {parsed.forecasterName}
                              </span>
                              <Show when={parsed.forecasterName !== "ARIMA"}>
                                <span
                                  class={`px-2 py-0.5 rounded font-bold border flex items-center space-x-1 ${
                                    parsed.device === "GPU"
                                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                      : "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20"
                                  }`}
                                >
                                  <span>{parsed.device}</span>
                                </span>
                              </Show>
                              <Show when={parsed.batchSize !== undefined}>
                                <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {parsed.batchSize === 0 ? "Full" : `B=${parsed.batchSize}`}
                                </span>
                              </Show>
                              <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                h={parsed.h}
                              </span>
                            </div>
                          </div>
                        }
                      >
                        <div class="space-y-3.5 animate-in fade-in duration-150">
                          <div class="flex items-center justify-between flex-wrap gap-2 pt-1 pb-1 border-b border-slate-200/80 dark:border-slate-800">
                            {/* Segmented Switching Tabs */}
                            <div class="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-xs font-mono select-none shadow-inner">
                              <button
                                type="button"
                                onClick={() => setJobTab(j().job_id, "progress")}
                                class={`px-3 py-1 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer text-[11px] font-bold ${
                                  currentTab() === "progress"
                                    ? "bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-2xs border border-slate-200/80 dark:border-slate-700"
                                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                              >
                                <Activity
                                  size={12}
                                  class={
                                    currentTab() === "progress" ? "text-cyan-500" : "text-slate-400"
                                  }
                                />
                                <span>
                                  {view.lang === "id" ? "Progres Pelatihan" : "Training Progress"}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setJobTab(j().job_id, "config")}
                                class={`px-3 py-1 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer text-[11px] font-bold ${
                                  currentTab() === "config"
                                    ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs border border-slate-200/80 dark:border-slate-700"
                                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                              >
                                <SlidersVertical
                                  size={12}
                                  class={
                                    currentTab() === "config" ? "text-purple-500" : "text-slate-400"
                                  }
                                />
                                <span>
                                  {view.lang === "id" ? "Detail Konfigurasi" : "Detail Config"}
                                </span>
                              </button>
                            </div>

                            {/* Quick Summary Chips on Right */}
                            <div class="flex items-center space-x-1.5 text-[10px] font-mono">
                              <span class="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold">
                                {parsed.forecasterName}
                              </span>
                              <Show when={parsed.forecasterName !== "ARIMA"}>
                                <span
                                  class={`px-2 py-0.5 rounded font-bold border flex items-center space-x-1 ${
                                    parsed.device === "GPU"
                                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                      : "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20"
                                  }`}
                                >
                                  <Show
                                    when={parsed.device === "GPU"}
                                    fallback={<Cpu size={10} class="text-cyan-500" />}
                                  >
                                    <Sparkles size={10} class="text-amber-500" />
                                  </Show>
                                  <span>{parsed.device}</span>
                                </span>
                              </Show>
                              <Show when={parsed.batchSize}>
                                <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  B={parsed.batchSize}
                                </span>
                              </Show>
                              <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                h={parsed.h}
                              </span>
                            </div>
                          </div>

                          {/* TAB CONTENT 1: Training Progress Stepper */}
                          <Show when={currentTab() === "progress"}>
                            <TrainingStepper
                              stage={j().stage}
                              progress={j().progress}
                              status={j().status}
                              algorithm={j().config_hash}
                              epoch={j().epoch}
                              totalEpochs={j().total_epochs}
                              currentVar={j().current_var}
                              subStep={j().sub_step}
                              varEpochs={j().var_epochs}
                              createdAt={j().created_at}
                              finishedAt={j().finished_at}
                              durationSeconds={j().duration_seconds}
                            />
                          </Show>

                          {/* TAB CONTENT 2: 4-Card Detail Configuration */}
                          <Show when={currentTab() === "config"}>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                              {/* Card 1: Dataset & Evaluasi */}
                              <div class="p-3.5 rounded-xl bg-blue-500/5 dark:bg-blue-500/5 border border-blue-500/20 space-y-2.5">
                                <div class="flex items-center justify-between pb-1.5 border-b border-blue-500/20 text-blue-900 dark:text-blue-200 font-bold text-[11px]">
                                  <div class="flex items-center space-x-1.5">
                                    <Database size={13} class="text-blue-500" />
                                    <span>
                                      {view.lang === "id"
                                        ? "Dataset & Evaluasi"
                                        : "Dataset & Evaluation"}
                                    </span>
                                  </div>
                                  <span class="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">
                                    PARQUET / CSV
                                  </span>
                                </div>
                                <div class="space-y-1.5 text-[11px]">
                                  <div class="flex items-center justify-between">
                                    <span class="text-slate-500 dark:text-slate-400">Dataset:</span>
                                    <span
                                      class="font-sans font-bold text-slate-900 dark:text-slate-100 truncate max-w-45"
                                      title={parsed.datasetName}
                                    >
                                      {parsed.datasetName}
                                    </span>
                                  </div>
                                  <div class="flex items-center justify-between">
                                    <span class="text-slate-500 dark:text-slate-400">
                                      Holdout Split:
                                    </span>
                                    <span class="font-bold text-emerald-600 dark:text-emerald-400">
                                      {(parsed.splitRatio * 100).toFixed(0)}% (Test Split)
                                    </span>
                                  </div>
                                  <div class="flex items-center justify-between">
                                    <span class="text-slate-500 dark:text-slate-400">
                                      Horizon (h):
                                    </span>
                                    <span class="font-bold text-cyan-600 dark:text-cyan-400">
                                      {parsed.h} steps forward
                                    </span>
                                  </div>
                                  <div class="flex items-center justify-between">
                                    <span class="text-slate-500 dark:text-slate-400">
                                      PRNG Seed:
                                    </span>
                                    <span class="font-bold text-slate-800 dark:text-slate-200">
                                      {parsed.seed} (Deterministic)
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Card 2: Konfigurasi Imputasi */}
                              <div class="p-3.5 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/20 space-y-2.5">
                                <div class="flex items-center justify-between pb-1.5 border-b border-emerald-500/20 text-emerald-900 dark:text-emerald-200 font-bold text-[11px]">
                                  <div class="flex items-center space-x-1.5">
                                    <Layers size={13} class="text-emerald-500" />
                                    <span>
                                      {view.lang === "id"
                                        ? "Konfigurasi Imputasi"
                                        : "Imputation Engine"}
                                    </span>
                                  </div>
                                  <span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold">
                                    {parsed.imputerId}
                                  </span>
                                </div>
                                <div class="space-y-1.5 text-[11px]">
                                  <div class="flex items-center justify-between">
                                    <span class="text-slate-500 dark:text-slate-400">Method:</span>
                                    <span class="font-bold text-emerald-600 dark:text-emerald-400">
                                      {parsed.imputerName}
                                    </span>
                                  </div>
                                  <div class="flex items-center justify-between">
                                    <span class="text-slate-500 dark:text-slate-400">
                                      Neighbors (k):
                                    </span>
                                    <span class="font-bold text-slate-900 dark:text-slate-100">
                                      k = {parsed.k} donors
                                    </span>
                                  </div>
                                  <div class="flex items-center justify-between">
                                    <span class="text-slate-500 dark:text-slate-400">
                                      Smoothing Span:
                                    </span>
                                    <span class="font-bold text-slate-900 dark:text-slate-100">
                                      span = {parsed.span}
                                    </span>
                                  </div>
                                  <div class="flex items-center justify-between">
                                    <span class="text-slate-500 dark:text-slate-400">
                                      Boundary Guard:
                                    </span>
                                    <div class="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                                      <ShieldCheck size={12} />
                                      <span>Edge-NA Active</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Card 3: Arsitektur & Hiperparameter */}
                              <div class="p-3.5 rounded-xl bg-purple-500/5 dark:bg-purple-500/5 border border-purple-500/20 space-y-2.5">
                                <div class="flex items-center justify-between pb-1.5 border-b border-purple-500/20 text-purple-900 dark:text-purple-200 font-bold text-[11px]">
                                  <div class="flex items-center space-x-1.5">
                                    <Cpu size={13} class="text-purple-500" />
                                    <span>
                                      {view.lang === "id"
                                        ? "Arsitektur Model"
                                        : "Model Architecture"}
                                    </span>
                                  </div>
                                  <span
                                    class={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${
                                      parsed.device === "GPU"
                                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                        : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300"
                                    }`}
                                  >
                                    {parsed.device}
                                  </span>
                                </div>
                                <div class="space-y-1.5 text-[11px]">
                                  <div class="flex items-center justify-between">
                                    <span class="text-slate-500 dark:text-slate-400">Model:</span>
                                    <span class="font-bold text-purple-600 dark:text-purple-400">
                                      {parsed.forecasterName}
                                    </span>
                                  </div>
                                  <Show when={parsed.units}>
                                    <div class="flex items-center justify-between">
                                      <span class="text-slate-500 dark:text-slate-400">
                                        Hidden Units:
                                      </span>
                                      <span class="font-bold text-slate-900 dark:text-slate-100">
                                        {parsed.units} units
                                      </span>
                                    </div>
                                  </Show>
                                  <Show when={parsed.batchSize !== undefined}>
                                    <div class="flex items-center justify-between">
                                      <span class="text-slate-500 dark:text-slate-400">
                                        Batch Size:
                                      </span>
                                      <span class="font-bold text-cyan-600 dark:text-cyan-400">
                                        {parsed.batchSize === 0
                                          ? "Full Batch"
                                          : `B = ${parsed.batchSize}`}{" "}
                                        (Adam lr={parsed.learningRate ?? 0.02})
                                      </span>
                                    </div>
                                  </Show>
                                  <Show when={parsed.epochs}>
                                    <div class="flex items-center justify-between">
                                      <span class="text-slate-500 dark:text-slate-400">
                                        Epochs:
                                      </span>
                                      <span class="font-bold text-emerald-600 dark:text-emerald-400">
                                        {parsed.epochs} epochs
                                      </span>
                                    </div>
                                  </Show>
                                </div>
                              </div>

                              {/* Card 4: Parameter Fisik PFVI */}
                              <div class="p-3.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/5 border border-amber-500/20 space-y-2.5">
                                <div class="flex items-center justify-between pb-1.5 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 font-bold text-[11px]">
                                  <div class="flex items-center space-x-1.5">
                                    <Flame size={13} class="text-amber-500" />
                                    <span>
                                      {view.lang === "id"
                                        ? "Parameter Fisik PFVI"
                                        : "Physical PFVI Fit"}
                                    </span>
                                  </div>
                                  <span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold flex items-center space-x-1">
                                    <Zap size={9} />
                                    <span>NELDER-MEAD</span>
                                  </span>
                                </div>
                                <div class="space-y-1.5 text-[11px]">
                                  <div class="flex items-center justify-between">
                                    <span class="text-slate-500 dark:text-slate-400">
                                      Rainfall (R₀):
                                    </span>
                                    <span class="font-bold text-slate-900 dark:text-slate-100">
                                      R₀ = {parsed.r0} mm
                                    </span>
                                  </div>
                                  <div class="flex items-center justify-between">
                                    <span class="text-slate-500 dark:text-slate-400">
                                      Time Step (Δt):
                                    </span>
                                    <span class="font-bold text-slate-900 dark:text-slate-100">
                                      Δt = {parsed.dt} day
                                    </span>
                                  </div>
                                  <div class="flex items-center justify-between">
                                    <span class="text-slate-500 dark:text-slate-400">
                                      Peat Soil (FC/SAT):
                                    </span>
                                    <span class="font-bold text-slate-900 dark:text-slate-100">
                                      FC = {parsed.fc}% · SAT = {parsed.sat}%
                                    </span>
                                  </div>
                                  <div class="flex items-center justify-between">
                                    <span class="text-slate-500 dark:text-slate-400">
                                      Grid Search (m):
                                    </span>
                                    <span class="font-bold text-slate-900 dark:text-slate-100">
                                      m = {parsed.maxGridM} dimension
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Show>
                        </div>
                      </Show>
                    );
                  })()}

                  {/* Error Banner */}
                  <Show when={j().error}>
                    <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-start space-x-2">
                      <TriangleAlert
                        size={15}
                        class="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5"
                      />
                      <div>
                        <span class="font-bold block">{t().trainExecutionError}</span>
                        <span class="font-mono text-[11px] break-all">{j().error}</span>
                      </div>
                    </div>
                  </Show>

                  {/* Completion Banner */}
                  <Show when={j().status === "done" && j().run_id}>
                    <div class="p-3.5 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex flex-wrap items-center justify-between gap-3">
                      <div class="flex items-center space-x-2.5">
                        <div class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                          ✓
                        </div>
                        <div>
                          <span class="text-xs font-bold text-emerald-900 dark:text-emerald-300 block">
                            {t().trainTrainingSucceeded}
                          </span>
                          <span class="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                            run: {j().run_id}
                          </span>
                        </div>
                      </div>

                      <div class="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPlayback("selectedRunId", j().run_id!);
                            navigateTab("runs");
                          }}
                          class="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 text-xs font-semibold shadow-2xs transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <ChartColumn size={13} />
                          <span>{t().trainViewMetrics}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            props.onOpenRun(j().run_id!, `Job #${j().job_id.slice(0, 6)}`)
                          }
                          class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center space-x-1 shadow-xs cursor-pointer"
                        >
                          <span>{t().trainOpenInPlayer}</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  </Show>

                  {/* Bottom Metadata & Controls */}
                  <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs flex-wrap gap-2">
                    <div class="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center space-x-2">
                      <span>dataset={j().dataset_id}</span>
                      <span>·</span>
                      <span>seed={j().seed}</span>
                    </div>

                    <div class="flex items-center space-x-2">
                      <Show when={j().status === "done" || j().status === "error"}>
                        <button
                          type="button"
                          onClick={() => props.onToggleExpandJob(j().job_id)}
                          class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                        >
                          <span>
                            {props.expandedJobs.includes(j().job_id)
                              ? t().trainHideSteps
                              : t().trainViewSteps}
                          </span>
                          <Show
                            when={props.expandedJobs.includes(j().job_id)}
                            fallback={<ChevronDown size={12} />}
                          >
                            <ChevronUp size={12} />
                          </Show>
                        </button>
                      </Show>

                      <Show when={j().status === "running"}>
                        <button
                          type="button"
                          onClick={() => props.onCancelJob(j().job_id)}
                          class="px-3 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-500/30 transition-colors cursor-pointer shadow-2xs"
                        >
                          {t().trainCancelJob}
                        </button>
                      </Show>
                    </div>
                  </div>
                </div>
              );
            }}
          </Index>
        </Show>
      </div>
    </div>
  );
};
