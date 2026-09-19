import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  Index,
  onCleanup,
  Show,
} from "solid-js";
import { Layers, RotateCw } from "lucide-solid";
import { CircularProgress } from "./CircularProgress";
import { view } from "../lib/store";
import { catalogs } from "../i18n/catalog";

export interface TrainingStepperProps {
  stage: string | null;
  progress: number;
  status: "queued" | "running" | "done" | "error";
  algorithm?: string;
  epoch?: number | null;
  totalEpochs?: number | null;
  currentVar?: string | null;
  subStep?: string | null;
  varEpochs?: Record<string, number> | null;
  createdAt?: string;
  finishedAt?: string | null;
  durationSeconds?: number | null;
  inspectStage?: string | null;
  onInspectStageChange?: (stage: string | null) => void;
}
const STEPS = [
  {
    id: "validating",
    label: "Validating",
    nameId: "Validasi",
    sub: "Data sanity",
    subId: "Integritas data",
  },
  {
    id: "imputing",
    label: "Imputing",
    nameId: "Imputasi",
    sub: "Missing gaps",
    subId: "Pemulihan celah",
  },
  {
    id: "forecasting",
    label: "Forecasting",
    nameId: "Prakiraan",
    sub: "Neural / ARIMA",
    subId: "Runtun waktu",
  },
  {
    id: "fitting-pfvi",
    label: "Calibration",
    nameId: "Kalibrasi",
    sub: "Nelder-Mead fit",
    subId: "Optimasi PFVI",
  },
  {
    id: "materializing",
    label: "Materializing",
    nameId: "Materialisasi",
    sub: "Artifacts & plots",
    subId: "Penyusunan artefak",
  },
];

function getStageIndex(stage: string | null): number {
  if (!stage) return 0;
  const s = stage.toLowerCase();
  if (s.includes("validat")) return 0;
  if (s.includes("imput")) return 1;
  if (s.includes("forecast")) return 2;
  if (s.includes("pfvi") || s.includes("fit")) return 3;
  if (s.includes("material")) return 4;
  if (s.includes("done")) return 5;
  return 0;
}

export const TrainingStepper: Component<TrainingStepperProps> = (props) => {
  const t = () => catalogs[view.lang];
  const getInitialStart = () => {
    if (props.createdAt) {
      const ms = new Date(props.createdAt).getTime();
      if (!isNaN(ms) && ms > 0) return ms;
    }
    return Date.now();
  };

  const getInitialElapsed = () => {
    if (props.durationSeconds && props.durationSeconds > 0) return props.durationSeconds;
    if (props.finishedAt && props.createdAt) {
      const startMs = new Date(props.createdAt).getTime();
      const finMs = new Date(props.finishedAt).getTime();
      if (!isNaN(startMs) && !isNaN(finMs) && finMs >= startMs) {
        return Math.max(0.1, (finMs - startMs) / 1000);
      }
    }
    if (props.status === "done" || props.status === "error") {
      return 0.0;
    }
    return Math.max(0, (Date.now() - initialStart) / 1000);
  };

  const initialStart = getInitialStart();
  const [elapsed, setElapsed] = createSignal(getInitialElapsed());
  let startTime = initialStart;
  let timer: number | null = null;

  createEffect(() => {
    if (props.status === "running" || props.status === "queued") {
      if (timer === null) {
        startTime = getInitialStart();
        timer = window.setInterval(() => {
          setElapsed((Date.now() - startTime) / 1000);
        }, 100); // Responsive 100ms interval
      }
    } else if (timer !== null) {
      clearInterval(timer);
      timer = null;
      setElapsed((Date.now() - startTime) / 1000);
    }
  });

  // Stabilize epoch signals to prevent re-render flickering
  const [activeEpoch, setActiveEpoch] = createSignal<number | null>(null);
  const [activeTotalEpochs, setActiveTotalEpochs] = createSignal<number | null>(null);
  const [concurrentVarProgress, setConcurrentVarProgress] = createSignal<
    Record<string, { epoch: number; total: number }>
  >({});

  createEffect(() => {
    // 1. Monotonically merge any atomic varEpochs from backend
    if (props.varEpochs) {
      const tot = props.totalEpochs ?? activeTotalEpochs() ?? 100;
      setConcurrentVarProgress((prev) => {
        const next = { ...prev };
        for (const [vKey, epVal] of Object.entries(props.varEpochs!)) {
          const upper = vKey.toUpperCase();
          const prevEp = next[upper]?.epoch ?? 0;
          next[upper] = {
            epoch: Math.max(prevEp, epVal),
            total: tot,
          };
        }
        return next;
      });
    }

    // 2. Parse from stage string like "(WT epoch 86/100)"
    if (props.stage) {
      const match = props.stage.match(/([A-Za-z]+)\s+epoch\s+(\d+)\/(\d+)/i);
      if (match) {
        const varName = match[1].toUpperCase();
        const ep = parseInt(match[2], 10);
        const tot = parseInt(match[3], 10);
        setActiveEpoch(ep);
        setActiveTotalEpochs(tot);
        setConcurrentVarProgress((prev) => {
          const prevEp = prev[varName]?.epoch ?? 0;
          return {
            ...prev,
            [varName]: {
              epoch: Math.max(prevEp, ep),
              total: tot,
            },
          };
        });
      }
    }

    if (props.totalEpochs !== undefined && props.totalEpochs !== null) {
      setActiveTotalEpochs(props.totalEpochs);
    }

    // 3. Update single variable ONLY if currentVar is explicitly set
    if (props.currentVar && props.epoch !== undefined && props.epoch !== null) {
      const v = props.currentVar.toUpperCase();
      const ep = props.epoch;
      const tot = props.totalEpochs ?? activeTotalEpochs() ?? 100;
      setActiveEpoch(ep);
      setConcurrentVarProgress((prev) => {
        const prevEp = prev[v]?.epoch ?? 0;
        return {
          ...prev,
          [v]: {
            epoch: Math.max(prevEp, ep),
            total: tot,
          },
        };
      });
    }
  });

  const showEpochs = () =>
    activeEpoch() !== null &&
    activeTotalEpochs() !== null &&
    (props.status === "running" || props.status === "queued");
  interface StageStepDef {
    id: string;
    label: string;
    nameId: string;
    sub: string;
    subId: string;
  }

  interface StagePipelineDef {
    id: string;
    title: string;
    titleId: string;
    badge: string;
    badgeId: string;
    steps: StageStepDef[];
  }

  const STAGE_PIPELINES: Record<string, StagePipelineDef> = {
    validating: {
      id: "validating",
      title: "Data Validation Pipeline",
      titleId: "Alur Validasi Data",
      badge: "4 Checks",
      badgeId: "4 Verifikasi",
      steps: [
        {
          id: "DIM",
          label: "Temporal Continuity",
          nameId: "Integritas Temporal",
          sub: "Monotonic sequence check",
          subId: "Pemeriksaan runtun waktu",
        },
        {
          id: "SCHEMA",
          label: "Telemetry Schema",
          nameId: "Skema Telemetri",
          sub: "4-channel sensor binding",
          subId: "Pengikatan kanal sensor",
        },
        {
          id: "AUDIT",
          label: "Missingness Audit",
          nameId: "Audit Missingness",
          sub: "NaN & sparsity detection",
          subId: "Deteksi celah & edge NaNs",
        },
        {
          id: "SANITY",
          label: "Boundary Constraints",
          nameId: "Batas Rentang Nilai",
          sub: "Physical limit validation",
          subId: "Verifikasi rentang sensor",
        },
      ],
    },
    imputing: {
      id: "imputing",
      title: "Gap Imputation Pipeline",
      titleId: "Alur Imputasi Data Gambut",
      badge: "4 Channels",
      badgeId: "4 Kanal Data",
      steps: [
        {
          id: "WT",
          label: "Water Table (WT)",
          nameId: "Kedalaman Air (WT)",
          sub: "Donor regression estimate",
          subId: "Estimasi donor regresi",
        },
        {
          id: "SM",
          label: "Soil Moisture (SM)",
          nameId: "Kelembaban Tanah (SM)",
          sub: "Non-negativity bound (SM >= 0)",
          subId: "Restriksi batas fisik (SM >= 0)",
        },
        {
          id: "Rf",
          label: "Rainfall (Rf)",
          nameId: "Curah Hujan (Rf)",
          sub: "Zero-precipitation sparsity",
          subId: "Preservasi nihil presipitasi",
        },
        {
          id: "Temp",
          label: "Temperature (Temp)",
          nameId: "Suhu Gambut (Temp)",
          sub: "Diurnal thermal continuity",
          subId: "Kontinuitas siklus diurnal",
        },
      ],
    },
    forecasting: {
      id: "forecasting",
      title: "Forecasting Build Pipeline",
      titleId: "Alur Proses Prakiraan",
      badge: "4 Variables",
      badgeId: "4 Variabel",
      steps: [
        {
          id: "WT",
          label: "Water Table Depth",
          nameId: "Kedalaman Muka Air Tanah",
          sub: "Water table horizon trend",
          subId: "Tren horizon air gambut",
        },
        {
          id: "SM",
          label: "Soil Moisture",
          nameId: "Kelembaban Tanah",
          sub: "Volumetric water fraction",
          subId: "Fraksi volumetrik air",
        },
        {
          id: "Rf",
          label: "Rainfall Precipitation",
          nameId: "Curah Hujan",
          sub: "Precipitation horizon estimation",
          subId: "Estimasi horizon hujan",
        },
        {
          id: "Temp",
          label: "Surface Temperature",
          nameId: "Suhu Permukaan",
          sub: "Surface thermal trajectory",
          subId: "Trajektori termal permukaan",
        },
      ],
    },
    "fitting-pfvi": {
      id: "fitting-pfvi",
      title: "Nelder-Mead Calibration Pipeline",
      titleId: "Alur Kalibrasi Nelder-Mead",
      badge: "4 Steps",
      badgeId: "4 Tahap Kalibrasi",
      steps: [
        {
          id: "GRID",
          label: "Simplex Grid",
          nameId: "Inisialisasi Simpleks",
          sub: "Vertices (aH, bH, n, α)",
          subId: "Penyusunan titik parameter awal",
        },
        {
          id: "OPTIM",
          label: "Nelder-Mead Search",
          nameId: "Optimasi Nelder-Mead",
          sub: "Simplex reflection & contraction",
          subId: "Iterasi kontraksi & ekspansi",
        },
        {
          id: "LOSS",
          label: "MSE Convergence",
          nameId: "Minimisasi Nilai MSE",
          sub: "Empirical error minimization",
          subId: "Konvergensi error kerentanan",
        },
        {
          id: "CLASS",
          label: "Risk Bands",
          nameId: "Klasifikasi Tingkat Bahaya",
          sub: "Low, Moderate, High, Extreme",
          subId: "Zonasi tingkat risiko bahaya",
        },
      ],
    },
    materializing: {
      id: "materializing",
      title: "Artifact Materialization Pipeline",
      titleId: "Alur Materialisasi Artefak",
      badge: "4 Outputs",
      badgeId: "4 Tahap Output",
      steps: [
        {
          id: "CONCAT",
          label: "Series Concatenation",
          nameId: "Penyatuan Runtun Waktu",
          sub: "History (1..n) + Forecast (n+1..n+h)",
          subId: "Riwayat + Horizon prakiraan",
        },
        {
          id: "METRICS",
          label: "Metric Persistence",
          nameId: "Pencatatan Metrik RunStore",
          sub: "RMSE, MAE & PFVI loss",
          subId: "Penyimpanan telemetri evaluasi",
        },
        {
          id: "PARQUET",
          label: "Frame Compilation",
          nameId: "Kompilasi Frame Parquet",
          sub: "Arrow tables & SHA256 manifest",
          subId: "Tabel Arrow & manifest SHA256",
        },
        {
          id: "READY",
          label: "Player Readiness",
          nameId: "Kesiapan Pemutar Simulasi",
          sub: "Interactive timeline scrub indexing",
          subId: "Pengindeksan timeline interaktif",
        },
      ],
    },
  };

  const VAR_DEFS = [
    { id: "WT", label: "Water Table Depth", nameId: "Kedalaman Muka Air Tanah", unit: "cm" },
    { id: "SM", label: "Soil Moisture", nameId: "Kelembaban Tanah", unit: "m³/m³" },
    { id: "Rf", label: "Rainfall Precipitation", nameId: "Curah Hujan", unit: "mm" },
    { id: "Temp", label: "Surface Temperature", nameId: "Suhu Permukaan", unit: "°C" },
  ] as const;

  const currentIdx = () => {
    if (props.status === "done") return 5;
    return getStageIndex(props.stage);
  };
  const currentBackendStage = () => {
    const s = (props.stage || "").toLowerCase();
    if (s.includes("validat")) return "validating";
    if (s.includes("imput")) return "imputing";
    if (s.includes("forecast") || showEpochs()) return "forecasting";
    if (s.includes("pfvi") || s.includes("fit") || s.includes("calibrat")) return "fitting-pfvi";
    if (s.includes("material")) return "materializing";
    if (props.status === "done") return "forecasting";
    return "validating";
  };

  const [selectedStage, setSelectedStage] = createSignal<string | null>(props.inspectStage ?? null);

  createEffect(() => {
    if (props.inspectStage !== undefined) {
      setSelectedStage(props.inspectStage);
    }
  });

  const handleSelectStage = (stage: string | null) => {
    setSelectedStage(stage);
    props.onInspectStageChange?.(stage);
  };

  const activeStageId = () => {
    return selectedStage() ?? currentBackendStage();
  };

  const currentPipeline = createMemo(() => {
    const stageId = activeStageId();
    return STAGE_PIPELINES[stageId] || STAGE_PIPELINES["validating"];
  });

  const currentPipelineSteps = createMemo(() => {
    const stageId = activeStageId();
    const sIdx = getStageIndex(stageId);
    const curIdx = currentIdx();
    const isStageDone = props.status === "done" || curIdx > sIdx;
    const isStageActive = curIdx === sIdx && props.status === "running";

    if (stageId === "forecasting") {
      return VAR_DEFS.map((def) => {
        const varData = concurrentVarProgress()[def.id.toUpperCase()];
        const totEp = varData?.total ?? (activeTotalEpochs() || 100);
        const hasStarted = varData !== undefined;
        const curEp = varData?.epoch ?? 0;

        const isDone = isStageDone || (hasStarted && curEp >= totEp && totEp > 0);
        const isActive = isStageActive && hasStarted && !isDone;

        if (isDone) {
          return {
            id: def.id,
            label: view.lang === "id" ? def.nameId : def.label,
            sub: `${def.id} · ${def.unit}`,
            status: "completed" as const,
            progress: 100,
            badgeText: "100%",
          };
        }
        if (isActive) {
          const pct = Math.min(100, Math.max(1, Math.round((curEp / (totEp || 1)) * 100)));
          return {
            id: def.id,
            label: view.lang === "id" ? def.nameId : def.label,
            sub: `${def.id} · ${def.unit}`,
            status: "in_progress" as const,
            progress: pct,
            badgeText: `${curEp}/${totEp} · ${pct}%`,
          };
        }
        if (isStageActive) {
          return {
            id: def.id,
            label: view.lang === "id" ? def.nameId : def.label,
            sub: `${def.id} · ${def.unit}`,
            status: "in_progress" as const,
            progress: 0,
            badgeText: "0%",
          };
        }
        return {
          id: def.id,
          label: view.lang === "id" ? def.nameId : def.label,
          sub: `${def.id} · ${def.unit}`,
          status: "queued" as const,
          progress: 0,
          badgeText: t().stepperStatusQueued,
        };
      });
    }

    const pipelineDef = STAGE_PIPELINES[stageId] || STAGE_PIPELINES["validating"];

    let stageFrac = 0;
    if (isStageDone) {
      stageFrac = 1.0;
    } else if (isStageActive) {
      switch (stageId) {
        case "validating":
          stageFrac = Math.min(1, Math.max(0.08, props.progress / 0.05));
          break;
        case "imputing":
          stageFrac = Math.min(1, Math.max(0.08, (props.progress - 0.05) / 0.2));
          break;
        case "fitting-pfvi":
          stageFrac = Math.min(1, Math.max(0.08, (props.progress - 0.65) / 0.2));
          break;
        case "materializing":
          stageFrac = Math.min(1, Math.max(0.08, (props.progress - 0.85) / 0.15));
          break;
        default:
          stageFrac = 0.5;
      }
    }

    const backendSubStep = (props.subStep || "").toUpperCase();
    const backendSubStepIdx = pipelineDef.steps.findIndex(
      (s) => s.id.toUpperCase() === backendSubStep,
    );

    return pipelineDef.steps.map((step, idx) => {
      const stepLabel = view.lang === "id" ? step.nameId : step.label;
      const stepSub = view.lang === "id" ? step.subId : step.sub;

      const isSubDone =
        isStageDone ||
        (isStageActive && backendSubStepIdx > idx) ||
        (isStageActive && backendSubStepIdx < 0 && stageFrac >= (idx + 1) * 0.25);
      const isSubActive =
        isStageActive &&
        ((backendSubStepIdx >= 0 && backendSubStepIdx === idx) ||
          (backendSubStepIdx < 0 && stageFrac >= idx * 0.25 && stageFrac < (idx + 1) * 0.25));

      if (isSubDone) {
        return {
          id: step.id,
          label: stepLabel,
          sub: stepSub,
          status: "completed" as const,
          progress: 100,
          badgeText: "100%",
        };
      }
      if (isSubActive) {
        const stepProgress = Math.min(
          100,
          Math.max(15, Math.round(((stageFrac - idx * 0.25) / 0.25) * 100)),
        );
        return {
          id: step.id,
          label: stepLabel,
          sub: stepSub,
          status: "in_progress" as const,
          progress: stepProgress,
          badgeText: `${stepProgress}%`,
        };
      }
      return {
        id: step.id,
        label: stepLabel,
        sub: stepSub,
        status: "queued" as const,
        progress: 0,
        badgeText: t().stepperStatusQueued,
      };
    });
  });
  const displayStageTitle = () => {
    const stageId = activeStageId();
    const isInspecting = selectedStage() !== null && selectedStage() !== currentBackendStage();
    if (props.status === "done" && !isInspecting) {
      return t().stepperStatusCompleted;
    }
    if (props.status === "error" && !isInspecting) {
      return t().stepperStatusFailed;
    }

    const step = STEPS.find((s) => s.id === stageId);
    const stageName = step
      ? view.lang === "id"
        ? step.nameId
        : step.label
      : t().stepperStageProcessing;
    return `${t().stepperStagePrefix}${stageName}`;
  };
  onCleanup(() => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  });

  const displayTime = () => {
    if (
      props.durationSeconds !== undefined &&
      props.durationSeconds !== null &&
      props.durationSeconds > 0
    ) {
      if (props.status === "done") return `Completed in ${props.durationSeconds.toFixed(1)}s`;
      if (props.status === "error") return `Failed after ${props.durationSeconds.toFixed(1)}s`;
    }

    if (props.finishedAt && props.createdAt) {
      const startMs = new Date(props.createdAt).getTime();
      const finMs = new Date(props.finishedAt).getTime();
      if (!isNaN(startMs) && !isNaN(finMs) && finMs >= startMs) {
        const sec = Math.max(0.1, (finMs - startMs) / 1000);
        if (props.status === "done") return `Completed in ${sec.toFixed(1)}s`;
        if (props.status === "error") return `Failed after ${sec.toFixed(1)}s`;
      }
    }

    const s = elapsed();
    if (props.status === "done") {
      return s > 0 ? `Completed in ${s.toFixed(1)}s` : "Completed";
    }
    if (props.status === "error") {
      return s > 0 ? `Failed after ${s.toFixed(1)}s` : "Failed";
    }
    return `Running: ${s.toFixed(1)}s`;
  };

  return (
    <div class="space-y-4 bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-none">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <CircularProgress
            progress={props.status === "done" ? 1.0 : props.progress}
            size={52}
            strokeWidth={5}
            color={
              props.status === "error" ? "#f43f5e" : props.status === "done" ? "#10b981" : "#06b6d4"
            }
          />
          <div>
            <div class="flex items-center space-x-2">
              <span class="text-xs font-bold text-slate-800 dark:text-slate-100 font-mono">
                {displayStageTitle()}
              </span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {props.algorithm ? props.algorithm.toUpperCase() : "PIPELINE"}
              </span>
            </div>
            <div class="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span>
                {props.status === "done"
                  ? "All model artifacts and frames generated"
                  : `${Math.round(props.progress * 100)}% overall progress`}
              </span>
              <span class="text-slate-400 dark:text-slate-600">·</span>
              <span class="font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                {displayTime()}
              </span>
            </div>
          </div>
        </div>

        <span
          class={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider font-mono border ${
            props.status === "done"
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              : props.status === "error"
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse"
          }`}
        >
          {props.status}
        </span>
      </div>
      {/* 5-Step Horizontal Interactive Stage Tabs (Positioned at Top of Workflow) */}
      <div class="p-1.5 bg-slate-100/90 dark:bg-slate-950/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto select-none shadow-inner">
        <div class="flex items-center gap-1.5 min-w-145 sm:min-w-0">
          <For each={STEPS}>
            {(step, idx) => {
              const isSelected = () => activeStageId() === step.id;
              const isBackendCurrent = () => currentIdx() === idx() && props.status === "running";
              const isDone = () => currentIdx() > idx() || props.status === "done";
              const isError = () => currentIdx() === idx() && props.status === "error";

              return (
                <button
                  type="button"
                  onClick={() => handleSelectStage(step.id)}
                  class={`flex-1 min-w-0 flex items-center space-x-2 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected()
                      ? "bg-white dark:bg-slate-900 border-emerald-500 text-slate-900 dark:text-slate-100 shadow-xs ring-2 ring-emerald-500/20 font-bold"
                      : isBackendCurrent()
                        ? "bg-cyan-50/70 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200 hover:bg-cyan-100/60"
                        : isDone()
                          ? "bg-white/60 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800/60"
                          : "bg-slate-100/40 dark:bg-slate-900/20 border-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-200/50 opacity-60"
                  }`}
                >
                  {/* Step Number / Status Icon */}
                  <div
                    class={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 transition-all ${
                      isSelected()
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : isDone()
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                          : isBackendCurrent()
                            ? "bg-cyan-600 text-white ring-2 ring-cyan-500/30 animate-pulse"
                            : isError()
                              ? "bg-rose-600 text-white"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {isDone() && !isSelected() ? "✓" : idx() + 1}
                  </div>

                  {/* Title and Subtitle */}
                  <div class="min-w-0 flex-1 truncate">
                    <div class="flex items-center space-x-1">
                      <span class="text-xs font-bold font-sans truncate">
                        {view.lang === "id" ? step.nameId : step.label}
                      </span>
                      <Show when={isBackendCurrent()}>
                        <span class="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping shrink-0" />
                      </Show>
                    </div>
                    <div class="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate hidden sm:block">
                      {view.lang === "id" ? step.subId : step.sub}
                    </div>
                  </div>
                </button>
              );
            }}
          </For>
        </div>
      </div>

      {/* Multi-Step Pipeline Progress Animation (Streams for all pipeline stages) */}
      <div class="p-3.5 bg-slate-50/80 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs dark:shadow-md space-y-3 relative overflow-hidden select-none">
        {/* Subtle Ambient Glow */}
        <div class="absolute -right-12 -top-12 w-36 h-36 bg-amber-500/10 dark:bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div class="absolute -left-12 -bottom-12 w-36 h-36 bg-cyan-500/10 dark:bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div class="flex items-center justify-between relative z-10 border-b border-slate-200/80 dark:border-slate-800 pb-2">
          <div class="flex items-center space-x-2">
            <div class="w-5 h-5 rounded-md bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Layers size={11} />
            </div>
            <span class="text-xs font-bold text-slate-800 dark:text-slate-100 font-mono tracking-tight">
              {view.lang === "id" ? currentPipeline().titleId : currentPipeline().title}
            </span>
            <span class="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 font-bold">
              {view.lang === "id" ? currentPipeline().badgeId : currentPipeline().badge}
            </span>
          </div>

          <div class="flex items-center space-x-2">
            <Show when={selectedStage() !== null && selectedStage() !== currentBackendStage()}>
              <button
                type="button"
                onClick={() => handleSelectStage(null)}
                class="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 hover:bg-cyan-100 cursor-pointer flex items-center space-x-1"
                title="Return to currently active backend stage"
              >
                <RotateCw size={10} class="animate-spin" />
                <span>{t().stepperBackToLive}</span>
              </button>
            </Show>
            <span class="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
              {t().stepperDoneCount(
                currentPipelineSteps().filter((s) => s.status === "completed").length,
                currentPipelineSteps().length,
              )}
            </span>
          </div>
        </div>

        {/* 4 Multi-Step Stage Cards */}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 relative z-10">
          <Index each={currentPipelineSteps()}>
            {(step) => {
              const isCompleted = () => step().status === "completed";
              const isInProgress = () => step().status === "in_progress";
              const isQueued = () => step().status === "queued";

              return (
                <div
                  class={`p-2.5 rounded-xl border transition-all duration-200 ${
                    isInProgress()
                      ? "bg-cyan-50/60 dark:bg-slate-800/90 border-cyan-300 dark:border-cyan-500/60 shadow-xs ring-1 ring-cyan-400/30 dark:ring-cyan-500/20"
                      : isCompleted()
                        ? "bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                        : "bg-slate-100/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/40 opacity-55"
                  }`}
                >
                  {/* Top Row: Icon + Name + Badge */}
                  <div class="flex items-center justify-between mb-1.5">
                    <div class="flex items-center space-x-2 min-w-0">
                      {/* Status Icon */}
                      <div class="shrink-0">
                        <Show when={isCompleted()}>
                          <div class="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40 flex items-center justify-center text-[9px] font-bold">
                            ✓
                          </div>
                        </Show>
                        <Show when={isInProgress()}>
                          <div class="w-4 h-4 rounded-full bg-cyan-100 border border-cyan-400 dark:bg-cyan-500/20 dark:border-cyan-400/50 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                            <RotateCw size={10} class="animate-spin" />
                          </div>
                        </Show>
                        <Show when={isQueued()}>
                          <div class="w-4 h-4 rounded-full border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 flex items-center justify-center">
                            <span class="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600" />
                          </div>
                        </Show>
                      </div>

                      {/* Step Name & Subtitle */}
                      <div class="min-w-0 truncate">
                        <span
                          class={`text-xs font-mono font-bold ${
                            isInProgress()
                              ? "text-cyan-800 dark:text-cyan-300"
                              : isCompleted()
                                ? "text-slate-800 dark:text-slate-200"
                                : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {step().id}
                        </span>
                        <span class="text-[10px] text-slate-500 dark:text-slate-400 ml-1.5 font-sans truncate">
                          {step().label}
                        </span>
                      </div>
                    </div>

                    {/* Progress Badge */}
                    <div class="text-right font-mono text-[10px] shrink-0">
                      <Show when={isCompleted()}>
                        <span class="text-emerald-700 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                          100%
                        </span>
                      </Show>
                      <Show when={isInProgress()}>
                        <div class="flex items-center space-x-1.5 text-cyan-700 dark:text-cyan-300 font-bold">
                          <span class="px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-700 text-[9px]">
                            {step().badgeText}
                          </span>
                        </div>
                      </Show>
                      <Show when={isQueued()}>
                        <span class="text-slate-400 dark:text-slate-500">{step().badgeText}</span>
                      </Show>
                    </div>
                  </div>

                  {/* Animated Striped Progress Bar */}
                  <div class="h-3 w-full bg-slate-200/90 dark:bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-800 shadow-inner relative">
                    <div
                      class={`h-full rounded-full transition-all duration-300 ${
                        isCompleted()
                          ? "bg-emerald-600 dark:bg-emerald-500 shadow-xs shadow-emerald-600/40"
                          : isInProgress()
                            ? "bg-linear-to-r from-amber-500 via-orange-500 to-cyan-600 dark:to-cyan-400 animate-progress-stripes shadow-xs shadow-orange-500/30"
                            : "bg-transparent"
                      }`}
                      style={{ width: `${step().progress}%` }}
                    />
                  </div>
                </div>
              );
            }}
          </Index>
        </div>
      </div>
    </div>
  );
};
