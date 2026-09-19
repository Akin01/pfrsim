import {
  Component,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  Show,
  startTransition,
} from "solid-js";
import { Activity, ArrowRight } from "lucide-solid";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  datasetAutocorrelation,
  datasetDelete,
  datasetGetDetail,
  datasetGetPreview,
  datasetInspect,
  datasetStlDecomposition,
  datasetUpdateName,
  datasetsList,
  isTauri,
} from "../lib/tauri";
import { navigateTab, playback, setPlayback, view } from "../lib/store";
import { mutationBus, useDatasetsVersion } from "../lib/mutation";
import type {
  AutocorrelationView,
  DatasetDetail,
  DatasetInspection,
  DatasetPreview,
  DatasetSummary,
  StlDecompositionView,
} from "../lib/types";
import { toast } from "../lib/toast";
import { catalogs } from "../i18n/catalog";
import type { SeriesKey } from "../utils/data";
import { DatasetSidebar } from "../components/DatasetSidebar";
import { DatasetKpiStrip } from "../components/DatasetKpiStrip";
import { DatasetSubNav, type ExploreTabType } from "../components/DatasetSubNav";
import { DatasetSeriesView } from "../components/DatasetSeriesView";
import { DatasetDecompView } from "../components/DatasetDecompView";
import { DatasetAcfView } from "../components/DatasetAcfView";
import { DatasetMissingView } from "../components/DatasetMissingView";
import { DatasetStatsView } from "../components/DatasetStatsView";
import { DatasetTableView } from "../components/DatasetTableView";
import { DatasetImportModal } from "../components/DatasetImportModal";
import { DatasetDeleteDialog } from "../components/DatasetDeleteDialog";
import { DatasetStlMethodModal } from "../components/DatasetStlMethodModal";

export interface DataPageProps {
  isActive?: boolean;
}

export const DataPage: Component<DataPageProps> = (props) => {
  const t = () => catalogs[view.lang];

  const [datasets, setDatasets] = createSignal<DatasetSummary[]>([]);
  const [selectedId, setSelectedId] = createSignal<string | null>(playback.selectedDatasetId);
  const [preview, setPreview] = createSignal<DatasetPreview | null>(null);
  const [detail, setDetail] = createSignal<DatasetDetail | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [showPasteModal, setShowPasteModal] = createSignal(false);
  const [modalInspection, setModalInspection] = createSignal<DatasetInspection | null>(null);
  const [modalBytes, setModalBytes] = createSignal<number[] | null>(null);
  const [modalFilePath, setModalFilePath] = createSignal<string | null>(null);
  const [isModalDragging, setIsModalDragging] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editName, setEditName] = createSignal<string>("");
  const [deleteTargetId, setDeleteTargetId] = createSignal<string | null>(null);

  // Explore view sub-navigation & interactive chart states
  const [exploreTab, setExploreTab] = createSignal<ExploreTabType>("stats");
  const [activeSeries, setActiveSeries] = createSignal<"all" | SeriesKey>("all");
  const [previewMode, setPreviewMode] = createSignal<"all" | "head" | "tail">("all");
  const [tableSearch, setTableSearch] = createSignal("");

  // STL decomposition states
  const [stlSeries, setStlSeries] = createSignal<SeriesKey>("wt");
  const [stlMethod, setStlMethod] = createSignal<"stl" | "trend">("stl");
  const [stlPeriod, setStlPeriod] = createSignal<number>(12);
  const [stlView, setStlView] = createSignal<StlDecompositionView | null>(null);
  const [stlLoading, setStlLoading] = createSignal(false);
  const [stlError, setStlError] = createSignal<string | null>(null);
  const [showStlMethodModal, setShowStlMethodModal] = createSignal(false);

  const [mountedTabs, setMountedTabs] = createSignal<Record<ExploreTabType, boolean>>({
    series: true,
    decomp: false,
    acf: false,
    missing: false,
    stats: false,
    table: false,
  });
  // Autocorrelation states
  const [acfSeries, setAcfSeries] = createSignal<SeriesKey>("wt");
  const [acfMaxLag, setAcfMaxLag] = createSignal<number>(39);
  const [acfData, setAcfData] = createSignal<AutocorrelationView | null>(null);
  const [acfLoading, setAcfLoading] = createSignal(false);
  const [acfHover, setAcfHover] = createSignal<{
    lag: number;
    val: number;
    type: "acf" | "pacf";
  } | null>(null);
  let currentStlRequestId = 0;
  let currentAcfRequestId = 0;
  let currentSelectRequestId = 0;

  const loadStlDecomposition = async (
    datasetId: string,
    series: SeriesKey,
    periodOverride?: number,
    methodOverride?: "stl" | "trend",
  ) => {
    const reqId = ++currentStlRequestId;
    setStlLoading(true);
    setStlError(null);
    try {
      const p = periodOverride !== undefined ? periodOverride : stlPeriod();
      const m = methodOverride !== undefined ? methodOverride : stlMethod();
      const res = await datasetStlDecomposition(datasetId, series, p, m);
      if (reqId !== currentStlRequestId) return;
      if (res.ok) {
        setStlView(res.data);
        setStlPeriod(res.data.period);
        setStlMethod(res.data.method as "stl" | "trend");
      } else {
        setStlView(null);
        setStlError(res.message);
      }
    } catch (err: unknown) {
      if (reqId !== currentStlRequestId) return;
      setStlView(null);
      setStlError(err instanceof Error ? err.message : String(err));
    } finally {
      if (reqId === currentStlRequestId) {
        setStlLoading(false);
      }
    }
  };

  const loadAutocorrelation = async (datasetId: string, series: SeriesKey, maxLag?: number) => {
    const reqId = ++currentAcfRequestId;
    setAcfLoading(true);
    try {
      const res = await datasetAutocorrelation(datasetId, series, maxLag ?? acfMaxLag());
      if (reqId !== currentAcfRequestId) return;
      if (res.ok) {
        setAcfData(res.data);
        setAcfMaxLag(res.data.max_lag);
      }
    } finally {
      if (reqId === currentAcfRequestId) {
        setAcfLoading(false);
      }
    }
  };

  const startRename = (id: string, currentName: string, e?: MouseEvent) => {
    e?.stopPropagation();
    setEditingId(id);
    setEditName(currentName);
  };

  const handleSaveRename = async (id: string, e?: Event) => {
    e?.stopPropagation();
    const newName = editName().trim();
    if (!newName) {
      setEditingId(null);
      return;
    }
    const res = await datasetUpdateName(id, newName);
    if (res.ok) {
      toast.success(t().dataNameUpdated(newName));
      setEditingId(null);
      mutationBus.notifyDatasetMutated(id);
    } else {
      toast.error(res.message);
    }
  };

  const handleCancelRename = (e?: Event) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  const handleConfirmDelete = async () => {
    const id = deleteTargetId();
    if (!id) return;
    const target = datasets().find((d) => d.id === id);
    const res = await datasetDelete(id);
    setDeleteTargetId(null);
    if (res.ok) {
      toast.success(t().dataDeletedSuccess(target?.name ?? id));
      if (selectedId() === id) {
        setSelectedId(null);
        setPreview(null);
        setPlayback("selectedDatasetId", null);
      }
      mutationBus.notifyDatasetMutated(null);
      mutationBus.notifyRunMutated(null);
    } else {
      toast.error(res.message);
    }
  };

  const fetchDatasets = async () => {
    const res = await datasetsList();
    if (res.ok) {
      setDatasets(res.data);
      const targetId = playback.selectedDatasetId || selectedId();
      if (targetId) {
        const found = res.data.find((d) => d.id === targetId);
        if (found) {
          selectDataset(found.id);
        } else if (res.data.length > 0) {
          selectDataset(res.data[0].id);
        }
      } else if (res.data.length > 0) {
        selectDataset(res.data[0].id);
      }
    }
  };

  void fetchDatasets();

  onMount(() => {
    void fetchDatasets();
  });
  const selectDataset = async (id: string) => {
    const reqId = ++currentSelectRequestId;
    setSelectedId(id);
    setPlayback("selectedDatasetId", id);
    setMountedTabs({
      series: exploreTab() === "series",
      decomp: exploreTab() === "decomp",
      acf: exploreTab() === "acf",
      missing: exploreTab() === "missing",
      stats: exploreTab() === "stats",
      table: exploreTab() === "table",
    });
    setLoading(true);
    try {
      const [pRes, dRes] = await Promise.all([datasetGetPreview(id), datasetGetDetail(id)]);
      if (reqId !== currentSelectRequestId) return;
      if (pRes.ok) {
        setPreview(pRes.data);
      } else {
        toast.error(pRes.message);
      }
      if (dRes.ok) {
        setDetail(dRes.data);
      }
      // Only trigger calculation for the active tab; other tabs calculate lazily on demand
      if (exploreTab() === "decomp") {
        void loadStlDecomposition(id, stlSeries(), stlPeriod(), stlMethod());
      } else if (exploreTab() === "acf") {
        void loadAutocorrelation(id, acfSeries(), acfMaxLag());
      }
    } finally {
      if (reqId === currentSelectRequestId) {
        setLoading(false);
      }
    }
  };

  const currentDataset = () => datasets().find((d) => d.id === selectedId());

  // Keep visited tabs alive in DOM for 0ms lag-free tab switching
  createEffect(() => {
    const tab = exploreTab();
    if (!mountedTabs()[tab]) {
      setMountedTabs((prev) => ({ ...prev, [tab]: true }));
    }
  });

  createEffect(() => {
    useDatasetsVersion();
    if (props.isActive !== false) {
      void fetchDatasets();
    }
  });

  // Lazy-load calculations on demand with 80ms debounce so rapid tab flips don't stampede the backend
  let tabDebounceTimer: number | undefined;
  createEffect(() => {
    const tab = exploreTab();
    const id = selectedId();
    if (!id) return;

    clearTimeout(tabDebounceTimer);

    tabDebounceTimer = window.setTimeout(() => {
      if (tab === "decomp") {
        if (!stlView() && !stlLoading()) {
          void loadStlDecomposition(id, stlSeries(), stlPeriod(), stlMethod());
        }
      } else if (tab === "acf") {
        if (!acfData() && !acfLoading()) {
          void loadAutocorrelation(id, acfSeries(), acfMaxLag());
        }
      }
    }, 80);
  });

  onCleanup(() => {
    clearTimeout(tabDebounceTimer);
  });

  const handleModalFileSelect = async (file: File) => {
    // 1. If native OS file path is accessible (Tauri WebView2), stream directly from disk
    const nativePath = (file as unknown as { path?: string }).path;
    if (nativePath && nativePath.trim().length > 0) {
      await handleModalPathSelect(file.name, nativePath.trim());
      return;
    }

    // 2. Prevent browser memory exhaustion on multi-million row files
    if (file.size > 50 * 1024 * 1024) {
      toast.error(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB) to load in browser memory. Please open via the desktop app file picker.`,
      );
      return;
    }

    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const rawBytes = Array.from(new Uint8Array(buffer));
      const res = await datasetInspect(file.name, undefined, rawBytes);
      if (res.ok) {
        setModalInspection(res.data);
        setModalBytes(rawBytes);
      } else {
        toast.error(`Inspection failed: ${res.message}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error inspecting file: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleModalPathSelect = async (fileName: string, filePath: string) => {
    setLoading(true);
    try {
      const res = await datasetInspect(fileName, filePath, undefined);
      if (res.ok) {
        setModalInspection(res.data);
        setModalFilePath(filePath);
        setModalBytes(null);
      } else {
        toast.error(`Inspection failed: ${res.message}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error inspecting file: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Native Tauri drag-and-drop listener for modal dropzone
  createEffect(() => {
    if (!showPasteModal() || modalInspection()) return;
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent(async (event) => {
        const payload = event.payload;
        if (payload.type === "enter" || payload.type === "over") {
          setIsModalDragging(true);
        } else if (payload.type === "leave") {
          setIsModalDragging(false);
        } else if (payload.type === "drop") {
          setIsModalDragging(false);
          const paths = payload.paths;
          if (paths && paths.length > 0) {
            const filePath = paths[0];
            const fileName = filePath.split(/[/\\]/).pop() || "dataset.csv";
            await handleModalPathSelect(fileName, filePath);
          }
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((e) => {
        console.warn("Tauri onDragDropEvent listener failed:", e);
      });

    onCleanup(() => {
      if (unlisten) unlisten();
    });
  });

  const handleTrainCta = () => {
    if (selectedId()) {
      navigateTab("train");
    }
  };

  return (
    <div class="h-full flex flex-col md:flex-row overflow-hidden bg-slate-950">
      {/* Left Column: Dataset List & Import */}
      <DatasetSidebar
        datasets={datasets()}
        selectedId={selectedId()}
        editingId={editingId()}
        editName={editName()}
        onSelectDataset={selectDataset}
        onStartRename={startRename}
        onSaveRename={handleSaveRename}
        onCancelRename={handleCancelRename}
        onEditNameChange={setEditName}
        onDeleteClick={(id) => setDeleteTargetId(id)}
        onOpenImportModal={() => setShowPasteModal(true)}
      />

      {/* Right Area: Anofox-style Dataset Explore View */}
      <div class="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-950 transition-colors">
        <Show
          when={preview()}
          fallback={
            <div class="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400">
                <Activity size={24} />
              </div>
              <p class="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">
                {t().dataEmptyExploreTitle}
              </p>
              <p class="text-xs text-slate-400 max-w-sm">{t().dataEmptyExploreDesc}</p>
            </div>
          }
        >
          {/* 1. Header & Quick Train CTA */}
          <div class="p-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between shrink-0 select-none">
            <div class="space-y-0.5">
              <div class="flex items-center space-x-2">
                <h2 class="text-base font-bold text-slate-900 dark:text-slate-100 font-mono truncate max-w-100">
                  {currentDataset()?.name ?? "Dataset Inspection"}
                </h2>
              </div>
              <p class="text-xs text-slate-400 font-mono">ID: {selectedId()}</p>
            </div>

            <button
              type="button"
              onClick={handleTrainCta}
              class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-900/30 flex items-center space-x-2 cursor-pointer active:scale-[0.98]"
            >
              <span>{t().dataTrainCta}</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* 2. Top KPI Summary Strip */}
          <DatasetKpiStrip currentDataset={currentDataset()} preview={preview()} />

          {/* 3. Sub-navigation Tabs Bar */}
          <DatasetSubNav
            activeTab={exploreTab()}
            loading={loading() || stlLoading() || acfLoading()}
            onTabChange={(tab) => {
              startTransition(() => {
                setExploreTab(tab);
              });
            }}
          />
          {/* 4. Tab Content Area - Keep-alive layer for instant, lag-free tab switching */}
          <div class="flex-1 relative overflow-hidden">
            <Show when={mountedTabs().series}>
              <div
                class={`h-full w-full absolute inset-0 overflow-y-auto p-6 space-y-6 transition-all duration-150 ease-out ${
                  exploreTab() === "series"
                    ? "opacity-100 translate-y-0 pointer-events-auto z-10"
                    : "opacity-0 pointer-events-none -z-10 translate-y-0.5 invisible"
                }`}
              >
                <DatasetSeriesView
                  selectedId={selectedId()}
                  preview={preview()}
                  detail={detail()}
                  activeSeries={activeSeries()}
                  onActiveSeriesChange={setActiveSeries}
                  onNavigateToDecomp={() => setExploreTab("decomp")}
                  isActive={exploreTab() === "series"}
                />
              </div>
            </Show>

            <Show when={mountedTabs().decomp}>
              <div
                class={`h-full w-full absolute inset-0 overflow-y-auto p-6 space-y-6 transition-all duration-150 ease-out ${
                  exploreTab() === "decomp"
                    ? "opacity-100 translate-y-0 pointer-events-auto z-10"
                    : "opacity-0 pointer-events-none -z-10 translate-y-0.5 invisible"
                }`}
              >
                <DatasetDecompView
                  selectedId={selectedId()}
                  preview={preview()}
                  stlSeries={stlSeries()}
                  onStlSeriesChange={setStlSeries}
                  stlMethod={stlMethod()}
                  onStlMethodChange={setStlMethod}
                  stlPeriod={stlPeriod()}
                  onStlPeriodChange={setStlPeriod}
                  stlView={stlView()}
                  stlLoading={stlLoading()}
                  stlError={stlError()}
                  onOpenStlMethodModal={() => setShowStlMethodModal(true)}
                  onReloadDecomp={loadStlDecomposition}
                />
              </div>
            </Show>

            <Show when={mountedTabs().acf}>
              <div
                class={`h-full w-full absolute inset-0 overflow-y-auto p-6 space-y-6 transition-all duration-150 ease-out ${
                  exploreTab() === "acf"
                    ? "opacity-100 translate-y-0 pointer-events-auto z-10"
                    : "opacity-0 pointer-events-none -z-10 translate-y-0.5 invisible"
                }`}
              >
                <DatasetAcfView
                  selectedId={selectedId()}
                  preview={preview()}
                  acfSeries={acfSeries()}
                  onAcfSeriesChange={setAcfSeries}
                  acfMaxLag={acfMaxLag()}
                  onAcfMaxLagChange={setAcfMaxLag}
                  acfData={acfData()}
                  acfLoading={acfLoading()}
                  acfHover={acfHover()}
                  setAcfHover={setAcfHover}
                  onLoadAutocorrelation={loadAutocorrelation}
                />
              </div>
            </Show>

            <Show when={mountedTabs().missing}>
              <div
                class={`h-full w-full absolute inset-0 overflow-y-auto p-6 space-y-6 transition-all duration-150 ease-out ${
                  exploreTab() === "missing"
                    ? "opacity-100 translate-y-0 pointer-events-auto z-10"
                    : "opacity-0 pointer-events-none -z-10 translate-y-0.5 invisible"
                }`}
              >
                <DatasetMissingView currentDataset={currentDataset()} preview={preview()} />
              </div>
            </Show>

            <Show when={mountedTabs().stats}>
              <div
                class={`h-full w-full absolute inset-0 overflow-y-auto p-6 space-y-6 transition-all duration-150 ease-out ${
                  exploreTab() === "stats"
                    ? "opacity-100 translate-y-0 pointer-events-auto z-10"
                    : "opacity-0 pointer-events-none -z-10 translate-y-0.5 invisible"
                }`}
              >
                <DatasetStatsView preview={preview()} detail={detail()} />
              </div>
            </Show>

            <Show when={mountedTabs().table}>
              <div
                class={`h-full w-full absolute inset-0 overflow-hidden p-4 flex flex-col min-h-0 transition-all duration-150 ease-out ${
                  exploreTab() === "table"
                    ? "opacity-100 translate-y-0 pointer-events-auto z-10"
                    : "opacity-0 pointer-events-none -z-10 translate-y-0.5 invisible"
                }`}
              >
                <DatasetTableView
                  currentDataset={currentDataset()}
                  preview={preview()}
                  detail={detail()}
                  previewMode={previewMode()}
                  onPreviewModeChange={setPreviewMode}
                  tableSearch={tableSearch()}
                  onTableSearchChange={setTableSearch}
                  selectedId={selectedId()}
                />
              </div>
            </Show>
          </div>
        </Show>
      </div>

      {/* Paste / Import Modal with Corvu Dialog */}
      <DatasetImportModal
        open={showPasteModal()}
        onOpenChange={setShowPasteModal}
        modalInspection={modalInspection()}
        modalBytes={modalBytes()}
        modalFilePath={modalFilePath()}
        isModalDragging={isModalDragging()}
        setIsModalDragging={setIsModalDragging}
        onFileSelect={handleModalFileSelect}
        onPathSelect={handleModalPathSelect}
        loading={loading()}
        onImportSuccess={async (newId) => {
          setShowPasteModal(false);
          setModalInspection(null);
          setModalBytes(null);
          setModalFilePath(null);
          mutationBus.notifyDatasetMutated(newId);
          toast.success(t().dataNewImportedSuccess);
        }}
        onCancelInspection={() => {
          setModalInspection(null);
          setModalFilePath(null);
          setModalBytes(null);
        }}
      />

      {/* Delete Dataset Confirmation Modal */}
      <DatasetDeleteDialog
        targetDataset={datasets().find((d) => d.id === deleteTargetId())}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* STL Methodology Modal with Corvu Dialog */}
      <DatasetStlMethodModal open={showStlMethodModal()} onOpenChange={setShowStlMethodModal} />
    </div>
  );
};

export default DataPage;
