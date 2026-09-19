import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  untrack,
} from "solid-js";
import {
  capabilityQuery,
  gpuSpecQuery,
  datasetsList,
  listenPipelineProgress,
  pipelineCancel,
  pipelineJobDelete,
  pipelineJobsList,
  pipelineRun,
} from "../lib/tauri";
import { navigateTab, openSimulationTab, playback, setPlayback, view } from "../lib/store";
import { mutationBus, useDatasetsVersion, useJobsVersion } from "../lib/mutation";
import { toast } from "../lib/toast";
import { catalogs } from "../i18n/catalog";
import type {
  CapabilityQueryOutput,
  DatasetSummary,
  GpuInfo,
  JobRecord,
  PipelineConfig,
} from "../lib/types";
import {
  DEFAULT_SIDEBAR_WIDTH,
  getInitialSidebarWidth,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  parseAgnosticGpuSpec,
  type TrainingPreset,
} from "../utils/train";
import { TrainConfigPanel } from "../components/TrainConfigPanel";
import { TrainJobsHistory } from "../components/TrainJobsHistory";
import { TrainDeleteJobDialog } from "../components/TrainDeleteJobDialog";
import { TrainClearFinishedModal } from "../components/TrainClearFinishedModal";
import { TrainMethodologyModal } from "../components/TrainMethodologyModal";

export interface TrainPageProps {
  isActive?: boolean;
}

export const TrainPage: Component<TrainPageProps> = (_props) => {
  const t = () => catalogs[view.lang];
  const [datasets, setDatasets] = createSignal<DatasetSummary[]>([]);
  const [capabilities, setCapabilities] = createSignal<CapabilityQueryOutput | null>(null);
  const [jobs, setJobs] = createSignal<JobRecord[]>(
    typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window)
      ? [
          {
            job_id: "job-b1973470626c",
            dataset_id: "ds-sabangau-demo",
            config_hash: "LSTM-Neural",
            seed: 42,
            status: "running",
            stage: "forecasting (WT epoch 86/100)",
            progress: 0.34,
            epoch: 86,
            total_epochs: 100,
            current_var: "WT",
            run_id: null,
            error: null,
            created_at: new Date(Date.now() - 14900).toISOString(),
            duration_seconds: 14.9,
          },
          {
            job_id: "job-demo-1",
            dataset_id: "ds-sabangau-demo",
            config_hash: "cfg42",
            seed: 42,
            status: "done",
            stage: "done",
            progress: 1.0,
            run_id: "pfrsim-pipeline-sabangau-demo",
            error: null,
            created_at: new Date().toISOString(),
          },
        ]
      : [],
  );
  const [selectedDatasetId, setSelectedDatasetId] = createSignal<string>(
    playback.selectedDatasetId ?? "",
  );

  // Active preset state
  const [selectedPreset, setSelectedPreset] = createSignal<string>("research-standard");

  // Form State
  const [imputerId, setImputerId] = createSignal("knn");
  const [kParam, setKParam] = createSignal(5);
  const [spanParam, setSpanParam] = createSignal(0.5);

  const [forecasterId, setForecasterId] = createSignal("arima");
  const [splitRatio, setSplitRatio] = createSignal(0.2);
  const [lookBackParam, setLookBackParam] = createSignal(12);
  const [epochsParam, setEpochsParam] = createSignal(100);
  const [layerUnitsParam, setLayerUnitsParam] = createSignal(16);
  const [batchSizeParam, setBatchSizeParam] = createSignal(32);
  const [learningRateParam, setLearningRateParam] = createSignal(0.02);
  const [hParam, setHParam] = createSignal(4);
  const [r0Param, setR0Param] = createSignal(2700);
  const [dtParam] = createSignal(1.0);
  const [maxGridM, setMaxGridM] = createSignal(2);
  const [seedParam, setSeedParam] = createSignal(42);
  const [dlDevice, setDlDevice] = createSignal<"cpu" | "gpu">("cpu");

  const [hardwareGpuInfo, setHardwareGpuInfo] = createSignal<{ available: boolean; name?: string }>(
    {
      available: false,
    },
  );
  const [lazyGpuInfo, setLazyGpuInfo] = createSignal<GpuInfo | null>(null);
  const [loadingGpuSpec, setLoadingGpuSpec] = createSignal(false);
  let gpuLoaded = false;
  const loadGpuSpecLazy = async (force = false) => {
    if (!force && (gpuLoaded || loadingGpuSpec())) return;
    setLoadingGpuSpec(true);
    try {
      const res = await gpuSpecQuery();
      if (res.ok && res.data) {
        setLazyGpuInfo(res.data);
        gpuLoaded = true;
      }
    } catch (err) {
      console.warn("GPU query failed:", err);
    } finally {
      setLoadingGpuSpec(false);
    }
  };

  // Eagerly pre-warm GPU spec in background on mount & when selecting deep learning
  onMount(() => {
    void loadGpuSpecLazy();
  });

  createEffect(() => {
    if (forecasterId() === "lstm" || forecasterId() === "gru") {
      void loadGpuSpecLazy();
    }
  });

  onMount(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        const renderer = debugInfo
          ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER);
        const isSoftware = /swiftshader|llvmpipe|softpipe/i.test(renderer || "");
        if (!isSoftware && renderer) {
          setHardwareGpuInfo({ available: true, name: renderer });
        }
      }
    } catch {}
  });

  const isGpuAvailable = createMemo(() => {
    if (capabilities()?.gpu_available !== undefined) {
      return Boolean(capabilities()!.gpu_available);
    }
    if (capabilities()?.gpu_info) {
      return true;
    }
    if (lazyGpuInfo() !== null) {
      return true;
    }
    return hardwareGpuInfo().available;
  });

  const detectedGpuInfo = createMemo(() => {
    const backendInfo = capabilities()?.gpu_info || lazyGpuInfo();
    const rawName = backendInfo?.name || capabilities()?.gpu_name || hardwareGpuInfo().name || "";
    const vram = backendInfo?.vram_mb || null;
    const driver = backendInfo?.driver_version || null;

    if (!rawName) return null;

    const parsed = parseAgnosticGpuSpec(rawName, vram, driver);

    return {
      name: backendInfo?.name || parsed.cleanName,
      vram_mb: vram,
      driver_version: driver,
      tier: backendInfo?.tier || parsed.tier,
      score: backendInfo?.score || parsed.score,
      backend: backendInfo?.backend || parsed.backend,
      estimated_speedup: backendInfo?.estimated_speedup || parsed.speedup,
    };
  });

  const [submitting, setSubmitting] = createSignal(false);
  // Job History View Controls
  const [jobStatusFilter, setJobStatusFilter] = createSignal<"all" | "running" | "done" | "error">(
    "all",
  );
  const [searchQuery, setSearchQuery] = createSignal("");
  const [expandedJobs, setExpandedJobs] = createSignal<string[]>([]);
  const [jobToDelete, setJobToDelete] = createSignal<string | null>(null);
  const [deletingJob, setDeletingJob] = createSignal(false);
  const [clearingCompleted, setClearingCompleted] = createSignal(false);
  const [showClearFinishedModal, setShowClearFinishedModal] = createSignal(false);
  const [refreshing, setRefreshing] = createSignal(false);
  const completedJobs = createMemo(() =>
    jobs().filter((j) => j.status === "done" || j.status === "error"),
  );
  const [copiedJobId, setCopiedJobId] = createSignal<string | null>(null);
  const [showFormulaModal, setShowFormulaModal] = createSignal(false);

  const toggleExpandJob = (id: string) =>
    setExpandedJobs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const applyPreset = (preset: TrainingPreset) => {
    setSelectedPreset(preset.id);
    setImputerId(preset.imputerId);
    setKParam(preset.k);
    setSpanParam(preset.span);
    setForecasterId(preset.forecasterId);
    setSplitRatio(preset.splitRatio);
    setLookBackParam(preset.lookBack);
    setEpochsParam(preset.epochs);
    setLayerUnitsParam(preset.layerUnits);
    if (preset.batchSize) {
      setBatchSizeParam(preset.batchSize);
    }
    if (preset.learningRate !== undefined) {
      setLearningRateParam(preset.learningRate);
    }
    setHParam(preset.h);
    setR0Param(preset.r0);
    setMaxGridM(preset.maxGridM);
    setSeedParam(preset.seed);
    toast.info(t().trainPresetApplied(view.lang === "id" ? preset.nameId : preset.name));
  };

  const markCustom = () => {
    setSelectedPreset("custom");
  };

  // Resizable Sidebar Configuration Panel (Default: 460px, Min: 320px, Max: 780px)
  const [sidebarWidth, setSidebarWidth] = createSignal<number>(getInitialSidebarWidth());
  const [isResizing, setIsResizing] = createSignal(false);

  const handleResizeStart = (e: PointerEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const startX = e.clientX;
    const startWidth = sidebarWidth();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const maxAllowed = Math.min(MAX_SIDEBAR_WIDTH, window.innerWidth - 360);
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxAllowed, startWidth + deltaX));
      setSidebarWidth(newWidth);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      try {
        localStorage.setItem("pfrsim_train_sidebar_width", sidebarWidth().toString());
      } catch {}
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleResetSidebarWidth = () => {
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    try {
      localStorage.setItem("pfrsim_train_sidebar_width", DEFAULT_SIDEBAR_WIDTH.toString());
    } catch {}
  };

  onCleanup(() => {
    if (typeof document !== "undefined") {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });

  const copyJobId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedJobId(id);
      toast.success(t().trainJobIdCopied);
      setTimeout(() => {
        if (copiedJobId() === id) setCopiedJobId(null);
      }, 2000);
    } catch {
      toast.error("Failed to copy ID");
    }
  };

  const handleConfirmDeleteJob = async () => {
    const id = jobToDelete();
    if (!id) return;
    setDeletingJob(true);
    try {
      const res = await pipelineJobDelete(id);
      if (res.ok) {
        toast.success(t().trainJobDeletedToast);
        setJobs((prev) => prev.filter((j) => j.job_id !== id));
        setJobToDelete(null);
        mutationBus.notifyJobMutated();
      } else {
        toast.error(`Failed to delete job: ${res.message}`);
      }
    } finally {
      setDeletingJob(false);
    }
  };

  const handleOpenClearFinishedModal = () => {
    if (filteredJobs().length === 0) {
      toast.info(t().trainNoJobsMatchingFilter);
      return;
    }
    setShowClearFinishedModal(true);
  };

  const handleConfirmClearCompleted = async () => {
    const targets = filteredJobs();
    if (targets.length === 0) {
      setShowClearFinishedModal(false);
      return;
    }
    setClearingCompleted(true);
    try {
      for (const job of targets) {
        if (job.status === "running" || job.status === "queued") {
          try {
            await pipelineCancel(job.job_id);
          } catch {}
        }
        await pipelineJobDelete(job.job_id);
      }
      const targetIds = new Set(targets.map((j) => j.job_id));
      setJobs((prev) => prev.filter((j) => !targetIds.has(j.job_id)));
      mutationBus.notifyJobMutated();
      toast.success(t().trainJobsClearedToast(targets.length));
      setShowClearFinishedModal(false);
    } catch (err: unknown) {
      toast.error(`Failed to clear jobs: ${String(err)}`);
    } finally {
      setClearingCompleted(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchJobs(), loadData()]);
      toast.info(t().trainRefreshedToast);
    } catch (err: unknown) {
      toast.error(`Refresh failed: ${String(err)}`);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchJobs = async () => {
    const res = await pipelineJobsList();
    if (res.ok) {
      const currentList = untrack(jobs);
      const merged = res.data.map((newJob) => {
        const existing = currentList.find((j) => j.job_id === newJob.job_id);
        if (existing && (newJob.status === "running" || newJob.status === "queued")) {
          return {
            ...newJob,
            stage: existing.stage || newJob.stage,
            progress: Math.max(existing.progress || 0, newJob.progress || 0),
            epoch: existing.epoch ?? newJob.epoch,
            total_epochs: existing.total_epochs ?? newJob.total_epochs,
            current_var: existing.current_var ?? newJob.current_var,
            sub_step: existing.sub_step ?? newJob.sub_step,
            var_epochs: existing.var_epochs ?? newJob.var_epochs,
          };
        }
        return newJob;
      });
      setJobs(merged);
    }
  };

  void fetchJobs();
  const loadData = async () => {
    const dsRes = await datasetsList();
    if (dsRes.ok) {
      setDatasets(dsRes.data);
      const targetId = playback.selectedDatasetId || selectedDatasetId();
      if (targetId) {
        const found = dsRes.data.find((d) => d.id === targetId);
        if (found) {
          setSelectedDatasetId(found.id);
        } else if (dsRes.data.length > 0) {
          setSelectedDatasetId(dsRes.data[0].id);
          setPlayback("selectedDatasetId", dsRes.data[0].id);
        }
      } else if (dsRes.data.length > 0) {
        setSelectedDatasetId(dsRes.data[0].id);
        setPlayback("selectedDatasetId", dsRes.data[0].id);
      }
    }

    const capRes = await capabilityQuery();
    if (capRes.ok) {
      setCapabilities(capRes.data);
    }

    await fetchJobs();
  };

  onMount(() => {
    void loadData();
    void fetchJobs();
  });

  createEffect(() => {
    if (playback.selectedDatasetId && playback.selectedDatasetId !== selectedDatasetId()) {
      setSelectedDatasetId(playback.selectedDatasetId);
    }
  });

  createEffect(() => {
    useDatasetsVersion();
    void loadData();
  });

  createEffect(() => {
    useJobsVersion();
    void fetchJobs();
  });

  createEffect(() => {
    if (view.activeTab === "train") {
      void fetchJobs();
    }
  });

  // Listen to pipeline-progress events
  let unlistenProgress: (() => void) | null = null;
  let pollInterval: number | null = null;
  createEffect(() => {
    listenPipelineProgress((payload) => {
      let found = false;
      setJobs((prev) => {
        const next = [...prev];
        const idx = next.findIndex((j) => j.job_id === payload.job_id);
        if (idx !== -1) {
          found = true;
          const existingVarEpochs = next[idx].var_epochs || {};
          const mergedVarEpochs = payload.var_epochs
            ? { ...existingVarEpochs, ...payload.var_epochs }
            : existingVarEpochs;

          next[idx] = {
            ...next[idx],
            stage: payload.stage,
            progress: Math.max(next[idx].progress || 0, payload.progress),
            epoch: payload.epoch,
            total_epochs: payload.total_epochs ?? next[idx].total_epochs,
            current_var: payload.current_var ?? next[idx].current_var,
            sub_step: payload.sub_step ?? next[idx].sub_step,
            var_epochs: mergedVarEpochs,
            status:
              payload.stage === "done" ? "done" : payload.stage === "error" ? "error" : "running",
          };
        }
        return next;
      });
      if (!found) {
        fetchJobs();
      }
      if (payload.stage === "done") {
        mutationBus.notifyJobMutated();
        mutationBus.notifyRunMutated();
      }
    }).then((unlisten) => {
      unlistenProgress = unlisten;
    });
  });

  // Active job polling fallback
  createEffect(() => {
    const hasActive = jobs().some((j) => j.status === "running" || j.status === "queued");
    if (hasActive) {
      if (pollInterval === null) {
        pollInterval = window.setInterval(fetchJobs, 1000);
      }
    } else if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  });

  onCleanup(() => {
    if (unlistenProgress) {
      unlistenProgress();
    }
    if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  });

  const handleStartTraining = async () => {
    if (!selectedDatasetId()) {
      toast.warning(t().trainPleaseSelectDataset);
      return;
    }

    setSubmitting(true);

    const config: PipelineConfig = {
      imputer: {
        id: imputerId(),
        k: kParam(),
        span: spanParam(),
      },
      forecaster: {
        id: forecasterId(),
        arima: {
          test_split_ratio: splitRatio(),
          learning_rate: learningRateParam(),
        },
        lstm:
          forecasterId() === "lstm"
            ? {
                look_back: lookBackParam(),
                layer_units: [layerUnitsParam()],
                epochs: epochsParam(),
                batch_size: batchSizeParam(),
                learning_rate: learningRateParam(),
                device: dlDevice(),
              }
            : null,
        gru:
          forecasterId() === "gru"
            ? {
                look_back: lookBackParam(),
                layer_units: [layerUnitsParam()],
                epochs: epochsParam(),
                batch_size: batchSizeParam(),
                learning_rate: learningRateParam(),
                device: dlDevice(),
              }
            : null,
      },
      pfvi: {
        r0: r0Param(),
        dt: dtParam(),
        h: hParam(),
        fc: 40.0,
        sat: 70.0,
        max_grid_m: maxGridM(),
        timeout_s: 30.0,
      },
      seed: seedParam(),
    };

    const res = await pipelineRun(selectedDatasetId(), config, seedParam());
    setSubmitting(false);

    if (res.ok) {
      toast.success(t().trainJobQueuedSuccess);
      mutationBus.notifyJobMutated();
    } else {
      toast.error(`Training error [${res.code}]: ${res.message}`);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    await pipelineCancel(jobId);
    toast.info(t().trainJobCanceled);
    mutationBus.notifyJobMutated();
  };

  const handleOpenRun = async (runId: string, runName?: string) => {
    openSimulationTab(runId, runName);
  };

  const currentDataset = createMemo(() => datasets().find((d) => d.id === selectedDatasetId()));

  const filteredJobs = createMemo(() => {
    const q = searchQuery().trim().toLowerCase();
    const filter = jobStatusFilter();

    return jobs().filter((job) => {
      if (filter !== "all") {
        if (filter === "running") {
          if (job.status !== "running" && job.status !== "queued") return false;
        } else if (job.status !== filter) {
          return false;
        }
      }
      if (q) {
        const matchId = job.job_id.toLowerCase().includes(q);
        const matchDs = job.dataset_id.toLowerCase().includes(q);
        const matchName = job.dataset_name?.toLowerCase().includes(q);
        const matchRun = job.run_id?.toLowerCase().includes(q);
        const matchAlgo = job.config_hash.toLowerCase().includes(q);
        return matchId || matchDs || matchName || matchRun || matchAlgo;
      }
      return true;
    });
  });

  return (
    <div
      class={`h-full flex flex-col md:flex-row overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors ${
        isResizing() ? "select-none cursor-col-resize" : ""
      }`}
    >
      {/* Left Configuration Panel + Resize Handle */}
      <TrainConfigPanel
        sidebarWidth={sidebarWidth()}
        isResizing={isResizing()}
        onResizeStart={handleResizeStart}
        onResetSidebarWidth={handleResetSidebarWidth}
        onShowFormulaModal={() => setShowFormulaModal(true)}
        selectedPreset={selectedPreset()}
        onApplyPreset={applyPreset}
        datasets={datasets()}
        selectedDatasetId={selectedDatasetId()}
        onSelectDatasetId={(val) => {
          setSelectedDatasetId(val);
          setPlayback("selectedDatasetId", val);
          markCustom();
        }}
        onNavigateToData={() => {
          if (currentDataset()) {
            setPlayback("selectedDatasetId", currentDataset()!.id);
          }
          navigateTab("data");
        }}
        currentDataset={currentDataset()}
        capabilities={capabilities()}
        imputerId={imputerId()}
        onSelectImputerId={(id) => {
          setImputerId(id);
          markCustom();
        }}
        kParam={kParam()}
        onKParamChange={(k) => {
          setKParam(k);
          markCustom();
        }}
        spanParam={spanParam()}
        onSpanParamChange={(span) => {
          setSpanParam(span);
          markCustom();
        }}
        forecasterId={forecasterId()}
        onSelectForecasterId={(id) => {
          setForecasterId(id);
          markCustom();
        }}
        splitRatio={splitRatio()}
        onSplitRatioChange={(ratio) => {
          setSplitRatio(ratio);
          markCustom();
        }}
        lookBackParam={lookBackParam()}
        onLookBackParamChange={(lb) => {
          setLookBackParam(lb);
          markCustom();
        }}
        epochsParam={epochsParam()}
        onEpochsParamChange={(ep) => {
          setEpochsParam(ep);
          markCustom();
        }}
        layerUnitsParam={layerUnitsParam()}
        onLayerUnitsParamChange={(u) => {
          setLayerUnitsParam(u);
          markCustom();
        }}
        batchSizeParam={batchSizeParam()}
        onBatchSizeParamChange={(b) => {
          setBatchSizeParam(b);
          markCustom();
        }}
        learningRateParam={learningRateParam()}
        onLearningRateParamChange={(lr) => {
          setLearningRateParam(lr);
          markCustom();
        }}
        dlDevice={dlDevice()}
        onDlDeviceChange={(dev) => {
          setDlDevice(dev);
          if (dev === "cpu" && batchSizeParam() > 128) {
            setBatchSizeParam(128);
          }
          markCustom();
        }}
        isGpuAvailable={isGpuAvailable()}
        detectedGpuInfo={detectedGpuInfo()}
        hParam={hParam()}
        onHParamChange={(h) => {
          setHParam(h);
          markCustom();
        }}
        r0Param={r0Param()}
        onR0ParamChange={(r0) => {
          setR0Param(r0);
          markCustom();
        }}
        maxGridM={maxGridM()}
        onMaxGridMChange={(m) => {
          setMaxGridM(m);
          markCustom();
        }}
        seedParam={seedParam()}
        onSeedParamChange={(seed) => {
          setSeedParam(seed);
          markCustom();
        }}
        submitting={submitting()}
        onStartTraining={handleStartTraining}
      />

      {/* Right Jobs History View */}
      <TrainJobsHistory
        jobs={jobs()}
        filteredJobs={filteredJobs()}
        completedJobs={completedJobs()}
        jobStatusFilter={jobStatusFilter()}
        onStatusFilterChange={setJobStatusFilter}
        searchQuery={searchQuery()}
        onSearchQueryChange={setSearchQuery}
        expandedJobs={expandedJobs()}
        onToggleExpandJob={toggleExpandJob}
        copiedJobId={copiedJobId()}
        onCopyJobId={copyJobId}
        onDeleteJobClick={(id) => setJobToDelete(id)}
        onCancelJob={handleCancelJob}
        onOpenClearFinishedModal={handleOpenClearFinishedModal}
        onRefresh={handleRefresh}
        refreshing={refreshing()}
        clearingCompleted={clearingCompleted()}
        onOpenRun={handleOpenRun}
      />

      {/* Delete Job Confirmation Dialog */}
      <TrainDeleteJobDialog
        jobId={jobToDelete()}
        deleting={deletingJob()}
        onClose={() => setJobToDelete(null)}
        onConfirm={handleConfirmDeleteJob}
      />

      {/* Clear Finished Jobs Confirmation Dialog */}
      <TrainClearFinishedModal
        open={showClearFinishedModal()}
        clearing={clearingCompleted()}
        targetCount={filteredJobs().length}
        activeFilter={jobStatusFilter()}
        onClose={() => setShowClearFinishedModal(false)}
        onConfirm={handleConfirmClearCompleted}
      />

      {/* Methodology & Mathematical Formulation Modal */}
      <TrainMethodologyModal
        open={showFormulaModal()}
        onOpenChange={(open) => setShowFormulaModal(open)}
      />
    </div>
  );
};

export default TrainPage;
