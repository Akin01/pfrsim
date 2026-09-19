import { Component, For, Show } from "solid-js";
import {
  ArrowRight,
  BookOpen,
  Check,
  Cpu,
  Database,
  ExternalLink,
  Layers,
  RotateCw,
  SlidersVertical,
  Sparkles,
  TriangleAlert,
  Zap,
} from "lucide-solid";
import { Dropdown } from "./Dropdown";
import { InfoHelper } from "./InfoHelper";
import { Tooltip } from "./Tooltip";
import { GpuTooltipContent } from "./GpuTooltipContent";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";
import { DEFAULT_SEED, PRESETS, type DetectedGpuInfo, type TrainingPreset } from "../utils/train";
import type { CapabilityQueryOutput, DatasetSummary } from "../lib/types";

export interface TrainConfigPanelProps {
  sidebarWidth: number;
  isResizing: boolean;
  onResizeStart: (e: PointerEvent) => void;
  onResetSidebarWidth: () => void;
  onShowFormulaModal: () => void;
  selectedPreset: string;
  onApplyPreset: (preset: TrainingPreset) => void;
  datasets: DatasetSummary[];
  selectedDatasetId: string;
  onSelectDatasetId: (id: string) => void;
  onNavigateToData: () => void;
  currentDataset: DatasetSummary | undefined;
  capabilities: CapabilityQueryOutput | null;
  imputerId: string;
  onSelectImputerId: (id: string) => void;
  kParam: number;
  onKParamChange: (k: number) => void;
  spanParam: number;
  onSpanParamChange: (span: number) => void;
  forecasterId: string;
  onSelectForecasterId: (id: string) => void;
  splitRatio: number;
  onSplitRatioChange: (ratio: number) => void;
  lookBackParam: number;
  onLookBackParamChange: (lb: number) => void;
  epochsParam: number;
  onEpochsParamChange: (epochs: number) => void;
  layerUnitsParam: number;
  onLayerUnitsParamChange: (units: number) => void;
  batchSizeParam: number;
  onBatchSizeParamChange: (batchSize: number) => void;
  learningRateParam: number;
  onLearningRateParamChange: (lr: number) => void;
  dlDevice: "cpu" | "gpu";
  onDlDeviceChange: (device: "cpu" | "gpu") => void;
  isGpuAvailable: boolean;
  detectedGpuInfo: DetectedGpuInfo | null;
  hParam: number;
  onHParamChange: (h: number) => void;
  r0Param: number;
  onR0ParamChange: (r0: number) => void;
  maxGridM: number;
  onMaxGridMChange: (m: number) => void;
  seedParam: number;
  onSeedParamChange: (seed: number) => void;
  submitting: boolean;
  onStartTraining: () => void;
}

export const TrainConfigPanel: Component<TrainConfigPanelProps> = (props) => {
  const t = () => catalogs[view.lang];

  const getForecasterDisplay = (id: string) => {
    switch (id) {
      case "arima":
        return {
          badge: t().trainForecasterArimaBadge,
          desc: t().trainForecasterArimaDesc,
        };
      case "lstm":
        return {
          badge: t().trainForecasterLstmBadge,
          desc: t().trainForecasterLstmDesc,
        };
      case "gru":
        return {
          badge: t().trainForecasterGruBadge,
          desc: t().trainForecasterGruDesc,
        };
      default:
        return {
          badge: "",
          desc: t().trainForecasterDefaultDesc,
        };
    }
  };

  const getImputerDisplay = (id: string) => {
    switch (id) {
      case "knn":
        return t().trainImputationKnnDesc;
      case "linear":
        return t().trainImputationLinearDesc;
      case "spline":
        return t().trainImputationSplineDesc;
      case "loess":
        return t().trainImputationLoessDesc;
      default:
        return "";
    }
  };

  const maxBatchSize = () => {
    if (props.dlDevice === "gpu") {
      const vram = props.detectedGpuInfo?.vram_mb ?? 0;
      if (vram >= 16000) return 2048;
      if (vram >= 8000) return 1024;
      return 512;
    }
    // CPU backend: cache-bounded to prevent L3 thrashing
    return 128;
  };

  const recommendedBatch = () => {
    if (props.dlDevice === "gpu") {
      return "64 – 512";
    }
    return "16 – 64";
  };

  return (
    <>
      {/* Configuration Form Column */}
      <div
        style={{
          width: `${props.sidebarWidth}px`,
        }}
        class={`w-full bg-white dark:bg-slate-900/60 p-6 overflow-y-auto space-y-6 shrink-0 shadow-xs ${
          props.isResizing ? "select-none" : ""
        }`}
      >
        {/* Header with Title and Scientific Formula Button */}
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center space-x-2 mb-1">
              <div class="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <SlidersVertical size={16} />
              </div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
                {t().trainTitle}
              </h2>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">{t().trainSubtitle}</p>
          </div>

          <button
            type="button"
            onClick={props.onShowFormulaModal}
            class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors flex items-center space-x-1.5 shrink-0 cursor-pointer shadow-2xs"
            title={t().trainMathDocsTooltip}
          >
            <BookOpen size={13} class="text-emerald-600 dark:text-emerald-400" />
            <span class="text-[11px] hidden sm:inline">{t().trainMathDocs}</span>
          </button>
        </div>

        {/* Scientific Configuration Presets */}
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 font-mono flex items-center space-x-1.5">
              <Sparkles size={12} class="text-amber-500" />
              <span>{t().trainPresetsTitle}</span>
            </span>
            <Show when={props.selectedPreset === "custom"}>
              <span class="text-[10px] px-2 py-0.5 rounded font-mono bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                {t().trainCustomModified}
              </span>
            </Show>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <For each={PRESETS}>
              {(preset) => {
                const isSelected = () => props.selectedPreset === preset.id;
                return (
                  <button
                    type="button"
                    onClick={() => props.onApplyPreset(preset)}
                    class={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                      isSelected()
                        ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-slate-900 dark:text-emerald-100 shadow-xs ring-1 ring-emerald-500/40"
                        : "bg-white hover:bg-slate-50 dark:bg-slate-800/50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/70 text-slate-800 dark:text-slate-200 shadow-2xs"
                    }`}
                  >
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-[11px] font-bold truncate">
                        {view.lang === "id" ? preset.nameId : preset.name}
                      </span>
                      <Show when={isSelected()}>
                        <Check
                          size={13}
                          class="text-emerald-600 dark:text-emerald-400 shrink-0 ml-1"
                        />
                      </Show>
                    </div>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
                      {view.lang === "id" ? preset.descriptionId : preset.description}
                    </p>
                    <div class="mt-1.5 flex items-center justify-between">
                      <span
                        class={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${preset.badgeColor}`}
                      >
                        {view.lang === "id" ? preset.badgeId || preset.badge : preset.badge}
                      </span>
                      <span class="text-[9px] font-mono text-slate-500 dark:text-slate-400">
                        {preset.imputerId}+{preset.forecasterId}
                      </span>
                    </div>
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        {/* 1. Target Dataset Selector */}
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="flex text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono items-center space-x-1.5">
              <Database size={13} class="text-emerald-600 dark:text-emerald-400" />
              <span>{t().trainTargetDataset}</span>
            </label>
            <span class="text-[10px] text-slate-600 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              {t().trainDatasetsLoaded(props.datasets.length)}
            </span>
          </div>

          <Dropdown
            value={props.selectedDatasetId}
            onChange={props.onSelectDatasetId}
            placeholder={t().trainNoDatasetPlaceholder}
            options={props.datasets.map((ds) => ({
              value: ds.id,
              label: ds.name,
              sublabel: `${ds.n} rows · ${ds.missing_total} missing NA`,
              badge: ds.missing_total === 0 ? "0 NA" : `${ds.missing_total} NA`,
              badgeType: ds.missing_total === 0 ? "emerald" : "amber",
              icon: <Database size={13} class="text-emerald-500" />,
            }))}
            size="md"
            searchable={props.datasets.length > 5}
            emptyText={t().trainNoDatasetEmptyText}
          />

          {/* Empty state when no dataset */}
          <Show when={props.datasets.length === 0}>
            <div class="mt-2.5 p-3.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-xl flex items-center justify-between gap-3 shadow-xs">
              <div class="text-[11px] text-amber-900 dark:text-amber-300">
                <span class="font-bold flex items-center space-x-1.5">
                  <TriangleAlert size={14} class="text-amber-600 dark:text-amber-400" />
                  <span>{t().trainNoDatasetWarningTitle}</span>
                </span>
                <span class="text-slate-600 dark:text-slate-400 text-[10px] mt-0.5 block">
                  {t().trainNoDatasetWarningDesc}
                </span>
              </div>
              <button
                type="button"
                onClick={props.onNavigateToData}
                class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs transition-colors shrink-0 flex items-center space-x-1 cursor-pointer"
              >
                <span>{t().trainGoToData}</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </Show>

          {/* Rich Dataset Insight Card */}
          <Show when={props.currentDataset}>
            {(ds) => (
              <div class="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 rounded-xl space-y-2.5 shadow-2xs">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono truncate max-w-60">
                    {ds().name}
                  </span>
                  <span class="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                    sha: {ds().csv_sha.slice(0, 8)}…
                  </span>
                </div>

                <div class="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                    <span class="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                      {t().trainTotalTimesteps}
                    </span>
                    <span class="font-bold text-slate-900 dark:text-slate-100">
                      {ds().n} {t().trainRows}
                    </span>
                  </div>
                  <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                    <span class="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                      {t().trainMissingGaps}
                    </span>
                    <span
                      class={`font-bold ${
                        ds().missing_total > 0
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {ds().missing_total} NA (
                      {((ds().missing_total / Math.max(1, ds().n * 4)) * 100).toFixed(1)}
                      %)
                    </span>
                  </div>
                </div>

                <div class="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700/60 text-[10px]">
                  <span class="text-slate-600 dark:text-slate-400 font-mono">
                    {t().trainPastRuns(ds().run_count)}
                  </span>
                  <button
                    type="button"
                    onClick={props.onNavigateToData}
                    class="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center space-x-1 font-semibold cursor-pointer"
                  >
                    <span>{t().trainInspectInData}</span>
                    <ExternalLink size={11} />
                  </button>
                </div>
              </div>
            )}
          </Show>
        </div>

        {/* 2. Imputation Stage */}
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="flex text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono items-center space-x-1.5">
              <Layers size={13} class="text-blue-600 dark:text-blue-400" />
              <span>{t().trainImputationTitle}</span>
            </label>
            <InfoHelper
              title={t().trainImputationInfoTitle}
              content={
                <div class="space-y-2 text-xs leading-relaxed">
                  <p>{t().trainImputationInfoDesc}</p>
                  <p class="text-[11px] text-slate-400">
                    <strong>kNN:</strong> Joint 4-variable Euclidean distance across observed time
                    steps.
                    <br />
                    <strong>LOESS:</strong> Cleveland weighted local polynomial regression.
                    <br />
                    <strong>Linear:</strong> Fast piecewise linear interpolation between gap
                    boundaries.
                  </p>
                </div>
              }
            />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <For
              each={
                props.capabilities?.imputers ?? [
                  {
                    id: "knn",
                    name: "kNN",
                    tooltip: "VIM::kNN Euclidean distance across 4 channels",
                  },
                  {
                    id: "linear",
                    name: "Linear",
                    tooltip: "Fast linear interpolation between observed points",
                  },
                  {
                    id: "spline",
                    name: "Cubic Spline",
                    tooltip: "Smooth cubic spline interpolation",
                  },
                  { id: "loess", name: "LOESS", tooltip: "Cleveland local regression smoothing" },
                ]
              }
            >
              {(imp) => {
                const isSelected = () => props.imputerId === imp.id;
                return (
                  <label
                    class={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all select-none ${
                      isSelected()
                        ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 text-slate-900 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-500/30"
                        : "bg-white hover:bg-slate-50 dark:bg-slate-800/60 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/70 text-slate-800 dark:text-slate-200 shadow-2xs"
                    }`}
                  >
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-xs font-bold">{imp.name}</span>
                      <input
                        type="radio"
                        name="imputer"
                        value={imp.id}
                        checked={isSelected()}
                        onChange={() => props.onSelectImputerId(imp.id)}
                        class="text-emerald-600 dark:text-emerald-500 focus:ring-0"
                      />
                    </div>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {getImputerDisplay(imp.id) || imp.tooltip}
                    </p>
                  </label>
                );
              }}
            </For>
          </div>

          {/* Dynamic Imputer Controls */}
          <Show when={props.imputerId === "knn"}>
            <div class="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-700 dark:text-slate-300 font-medium">
                  {t().trainImputationKnnParam}
                </span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={props.kParam}
                  onInput={(e) => props.onKParamChange(parseInt(e.currentTarget.value) || 5)}
                  class="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs text-center text-slate-900 dark:text-slate-100 font-mono shadow-2xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={props.kParam}
                onInput={(e) => props.onKParamChange(parseInt(e.currentTarget.value) || 5)}
                class="w-full accent-emerald-600 dark:accent-emerald-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg focus:outline-none focus:ring-0 focus-visible:outline-none select-none"
              />
              <p class="text-[10px] text-slate-500 dark:text-slate-400">
                {t().trainImputationKnnHint}
              </p>
            </div>
          </Show>

          <Show when={props.imputerId === "loess"}>
            <div class="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-700 dark:text-slate-300 font-medium">
                  {t().trainImputationLoessParam}
                </span>
                <input
                  type="number"
                  step={0.05}
                  min={0.05}
                  max={1.0}
                  value={props.spanParam}
                  onInput={(e) => props.onSpanParamChange(parseFloat(e.currentTarget.value) || 0.5)}
                  class="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs text-center text-slate-900 dark:text-slate-100 font-mono shadow-2xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <input
                type="range"
                min={0.05}
                max={1.0}
                step={0.05}
                value={props.spanParam}
                onInput={(e) => props.onSpanParamChange(parseFloat(e.currentTarget.value) || 0.5)}
                class="w-full accent-emerald-600 dark:accent-emerald-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg focus:outline-none focus:ring-0 focus-visible:outline-none select-none"
              />
              <p class="text-[10px] text-slate-500 dark:text-slate-400">
                {t().trainImputationLoessHint}
              </p>
            </div>
          </Show>

          <Show when={props.imputerId === "linear"}>
            <div class="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-[11px] text-blue-900 dark:text-blue-300">
              {t().trainImputationLinearBanner}
            </div>
          </Show>

          <Show when={props.imputerId === "spline"}>
            <div class="p-3 rounded-xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 text-[11px] text-purple-900 dark:text-purple-300">
              {t().trainImputationSplineBanner}
            </div>
          </Show>
        </div>

        {/* 3. Forecasting Stage */}
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="flex text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono items-center space-x-1.5">
              <Cpu size={13} class="text-cyan-600 dark:text-cyan-400" />
              <span>{t().trainForecasterTitle}</span>
            </label>
            <InfoHelper
              title={t().trainForecasterInfoTitle}
              content={
                <div class="space-y-2 text-xs leading-relaxed">
                  <p>{t().trainForecasterInfoDesc}</p>
                  <p class="text-[11px] text-slate-400">
                    <strong>AutoARIMA:</strong> Estimates Box-Cox transformation λ, orders (p,d,q),
                    and holdout metrics.
                    <br />
                    <strong>LSTM / GRU:</strong> Deep recurrent neural networks for non-linear
                    multi-step time series forecasting.
                  </p>
                </div>
              }
            />
          </div>

          <div class="space-y-2">
            <For
              each={
                props.capabilities?.forecasters ?? [
                  {
                    id: "arima",
                    name: "AutoARIMA + Box-Cox",
                    enabled: true,
                    description: "AutoARIMA",
                    reason: null,
                    params_schema: {},
                    tooltip: "Optimal order (p,d,q) selection via Box-Cox profile likelihood",
                  },
                  {
                    id: "lstm",
                    name: "LSTM Neural Network",
                    enabled: true,
                    description: "LSTM",
                    reason: null,
                    params_schema: {},
                    tooltip: "Long Short-Term Memory (LSTM) recurrent neural network",
                  },
                  {
                    id: "gru",
                    name: "GRU Neural Network",
                    enabled: true,
                    description: "GRU",
                    reason: null,
                    params_schema: {},
                    tooltip: "Gated Recurrent Unit (GRU) neural network",
                  },
                ]
              }
            >
              {(fc) => {
                const isSelected = () => props.forecasterId === fc.id;
                return (
                  <label
                    class={`p-3 rounded-xl border flex items-center justify-between transition-all select-none ${
                      !fc.enabled
                        ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        : isSelected()
                          ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 text-slate-900 dark:text-emerald-300 cursor-pointer shadow-xs ring-1 ring-emerald-500/30"
                          : "bg-white hover:bg-slate-50 dark:bg-slate-800/60 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/70 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs cursor-pointer"
                    }`}
                  >
                    <div class="space-y-0.5">
                      <div class="flex items-center space-x-2">
                        <span class="text-xs font-bold">{fc.name}</span>
                        <Show when={getForecasterDisplay(fc.id).badge}>
                          <span
                            class={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                              fc.id === "arima"
                                ? "bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                                : fc.id === "lstm"
                                  ? "bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                                  : "bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800"
                            }`}
                          >
                            {getForecasterDisplay(fc.id).badge}
                          </span>
                        </Show>
                        <Show when={!fc.enabled && fc.reason}>
                          <span class="px-1.5 py-0.5 rounded text-[9px] bg-slate-200 dark:bg-slate-800 text-amber-700 dark:text-amber-400 border border-slate-300 dark:border-slate-700">
                            {fc.reason}
                          </span>
                        </Show>
                      </div>
                      <p class="text-[10px] text-slate-500 dark:text-slate-400">
                        {getForecasterDisplay(fc.id).desc}
                      </p>
                    </div>
                    <input
                      type="radio"
                      name="forecaster"
                      value={fc.id}
                      disabled={!fc.enabled}
                      checked={isSelected()}
                      onChange={() => props.onSelectForecasterId(fc.id)}
                      class="text-emerald-600 dark:text-emerald-500 focus:ring-0 ml-2"
                    />
                  </label>
                );
              }}
            </For>
          </div>

          {/* ARIMA Controls */}
          <Show when={props.forecasterId === "arima"}>
            <div class="space-y-2.5 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-700 dark:text-slate-300 font-medium">
                  {t().trainSplitRatioParam}
                </span>
                <input
                  type="number"
                  step={0.05}
                  min={0.05}
                  max={0.5}
                  value={props.splitRatio}
                  onInput={(e) =>
                    props.onSplitRatioChange(parseFloat(e.currentTarget.value) || 0.2)
                  }
                  class="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs text-center text-slate-900 dark:text-slate-100 font-mono shadow-2xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <input
                type="range"
                min={0.05}
                max={0.5}
                step={0.05}
                value={props.splitRatio}
                onInput={(e) => props.onSplitRatioChange(parseFloat(e.currentTarget.value) || 0.2)}
                class="w-full accent-emerald-600 dark:accent-emerald-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg focus:outline-none focus:ring-0 focus-visible:outline-none select-none"
              />
              <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                {t().trainSplitRatioHint}
              </p>
            </div>
          </Show>

          {/* Deep Learning Controls */}
          <Show when={props.forecasterId === "lstm" || props.forecasterId === "gru"}>
            <div class="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs">
              <div class="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-700/60">
                <div class="flex items-center space-x-1.5">
                  <span class="text-xs font-bold text-cyan-800 dark:text-cyan-400 font-mono">
                    {t().trainDlArch(props.forecasterId.toUpperCase())}
                  </span>
                  <InfoHelper
                    title={t().trainDlGuideTitle}
                    placement="bottom"
                    size={12}
                    content={
                      <div class="space-y-2 text-xs">
                        <div class="p-2 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 space-y-0.5">
                          <strong class="text-slate-900 dark:text-slate-100 block text-[11px] font-mono font-bold">
                            1. {t().trainDlGuideLookbackTitle}
                          </strong>
                          <p class="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                            {t().trainDlGuideLookbackDesc}
                          </p>
                        </div>
                        <div class="p-2 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 space-y-0.5">
                          <strong class="text-slate-900 dark:text-slate-100 block text-[11px] font-mono font-bold">
                            2. {t().trainDlGuideEpochsTitle}
                          </strong>
                          <p class="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                            {t().trainDlGuideEpochsDesc}
                          </p>
                        </div>
                        <div class="p-2 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 space-y-0.5">
                          <strong class="text-slate-900 dark:text-slate-100 block text-[11px] font-mono font-bold">
                            3. {t().trainDlGuideUnitsTitle}
                          </strong>
                          <p class="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                            {t().trainDlGuideUnitsDesc}
                          </p>
                        </div>
                        <div class="p-2 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 space-y-0.5">
                          <strong class="text-slate-900 dark:text-slate-100 block text-[11px] font-mono font-bold">
                            4. {t().trainDlGuideBatchTitle}
                          </strong>
                          <p class="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                            {t().trainDlGuideBatchDesc}
                          </p>
                        </div>
                        <div class="p-2 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 space-y-0.5">
                          <strong class="text-slate-900 dark:text-slate-100 block text-[11px] font-mono font-bold">
                            5. {t().trainDlGuideLrTitle}
                          </strong>
                          <p class="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                            {t().trainDlGuideLrDesc}
                          </p>
                        </div>
                        <div class="p-2 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 space-y-0.5">
                          <strong class="text-slate-900 dark:text-slate-100 block text-[11px] font-mono font-bold">
                            6. {t().trainDlGuideHardwareTitle}
                          </strong>
                          <p class="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                            {t().trainDlGuideHardwareDesc}
                          </p>
                        </div>
                      </div>
                    }
                  />
                </div>
                <div class="inline-flex items-center p-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700/70 shadow-inner">
                  <button
                    type="button"
                    onClick={() => props.onDlDeviceChange("cpu")}
                    class={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                      props.dlDevice === "cpu"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700 font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                  >
                    <Cpu
                      size={12}
                      class={
                        props.dlDevice === "cpu"
                          ? "text-cyan-600 dark:text-cyan-400"
                          : "text-slate-400"
                      }
                    />
                    <span>{t().trainDlDeviceCpu}</span>
                  </button>

                  <Tooltip
                    placement="top"
                    content={
                      <GpuTooltipContent
                        detectedGpuInfo={props.detectedGpuInfo}
                        isGpuAvailable={props.isGpuAvailable}
                      />
                    }
                  >
                    <button
                      type="button"
                      onClick={() => props.onDlDeviceChange("gpu")}
                      class={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        props.dlDevice === "gpu"
                          ? "bg-cyan-600 text-white shadow-xs border border-cyan-500 font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                      }`}
                    >
                      <Zap
                        size={12}
                        class={props.dlDevice === "gpu" ? "text-white" : "text-amber-500"}
                      />
                      <span>{t().trainDlDeviceGpu}</span>
                      <Show when={!props.isGpuAvailable}>
                        <span class="text-[8px] uppercase tracking-tight ml-0.5 text-rose-500 dark:text-rose-400 font-sans font-bold">
                          N/A
                        </span>
                      </Show>
                    </button>
                  </Tooltip>
                </div>
              </div>
              {/* Architecture Parameters (3 columns) */}
              <div class="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span
                    class="text-[11px] text-slate-700 dark:text-slate-300 block mb-1 font-medium truncate"
                    title={t().trainDlLookback}
                  >
                    {t().trainDlLookback}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={props.lookBackParam}
                    onInput={(e) =>
                      props.onLookBackParamChange(parseInt(e.currentTarget.value) || 12)
                    }
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 text-center font-mono text-slate-900 dark:text-slate-100 shadow-2xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <span
                    class="text-[11px] text-slate-700 dark:text-slate-300 block mb-1 font-medium truncate"
                    title={t().trainDlEpochs}
                  >
                    {t().trainDlEpochs}
                  </span>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={props.epochsParam}
                    onInput={(e) =>
                      props.onEpochsParamChange(parseInt(e.currentTarget.value) || 100)
                    }
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 text-center font-mono text-slate-900 dark:text-slate-100 shadow-2xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <span
                    class="text-[11px] text-slate-700 dark:text-slate-300 block mb-1 font-medium truncate"
                    title={t().trainDlUnits}
                  >
                    {t().trainDlUnits}
                  </span>
                  <input
                    type="number"
                    min={4}
                    max={64}
                    value={props.layerUnitsParam}
                    onInput={(e) =>
                      props.onLayerUnitsParamChange(parseInt(e.currentTarget.value) || 16)
                    }
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 text-center font-mono text-slate-900 dark:text-slate-100 shadow-2xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Optimization Controls (Batch Size & Learning Rate in 2 Balanced Columns) */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/50">
                {/* Batch Size Box */}
                <div class="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/70 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                      {t().trainDlBatchSize}
                    </span>
                    <span
                      class={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                        props.batchSizeParam === 0
                          ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {props.batchSizeParam === 0 ? t().trainDlFullBatch : `≤${maxBatchSize()}`}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={props.batchSizeParam === 0 ? "Full" : props.batchSizeParam}
                    onInput={(e) => {
                      const raw = e.currentTarget.value.trim().toLowerCase();
                      if (raw === "0" || raw === "full" || raw === "f") {
                        props.onBatchSizeParamChange(0);
                        return;
                      }
                      const val = parseInt(raw, 10);
                      if (!isNaN(val)) {
                        props.onBatchSizeParamChange(Math.min(maxBatchSize(), Math.max(0, val)));
                      }
                    }}
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg py-1 px-2 text-center font-mono text-xs text-slate-900 dark:text-slate-100 shadow-2xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                  <div class="flex items-center flex-wrap gap-1 pt-0.5">
                    <For
                      each={props.dlDevice === "gpu" ? [32, 64, 128, 256, 0] : [16, 32, 64, 128, 0]}
                    >
                      {(size) => (
                        <button
                          type="button"
                          onClick={() => props.onBatchSizeParamChange(size)}
                          class={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                            props.batchSizeParam === size
                              ? "bg-emerald-600 text-white font-bold shadow-2xs"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {size === 0 ? t().trainDlFullBatch : size}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                {/* Learning Rate Box */}
                <div class="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/70 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                      {t().trainDlLearningRate}
                    </span>
                    <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold">
                      Adam
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0.0001}
                    max={1.0}
                    step={0.005}
                    value={props.learningRateParam}
                    onInput={(e) => {
                      const val = parseFloat(e.currentTarget.value) || 0.02;
                      props.onLearningRateParamChange(Math.min(1.0, Math.max(0.0001, val)));
                    }}
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg py-1 px-2 text-center font-mono text-xs text-slate-900 dark:text-slate-100 shadow-2xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                  <div class="flex items-center flex-wrap gap-1 pt-0.5">
                    <For each={[0.001, 0.005, 0.01, 0.02, 0.05]}>
                      {(rate) => (
                        <button
                          type="button"
                          onClick={() => props.onLearningRateParamChange(rate)}
                          class={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                            props.learningRateParam === rate
                              ? "bg-purple-600 text-white font-bold shadow-2xs"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {rate}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </div>

              {/* Status and Device Footnote */}
              <div class="space-y-1 pt-0.5 border-t border-slate-200/60 dark:border-slate-700/50 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                <p>
                  {props.batchSizeParam === 0
                    ? t().trainDlFullBatchDesc
                    : t().trainDlBatchFit(props.dlDevice.toUpperCase(), recommendedBatch())}
                </p>
                <div class="flex items-center justify-between text-slate-400 dark:text-slate-500">
                  <span>
                    {props.dlDevice === "gpu"
                      ? props.isGpuAvailable
                        ? t().trainDlGpuActive(
                            props.detectedGpuInfo?.name || "GPU",
                            props.detectedGpuInfo?.backend || "wgpu",
                          )
                        : t().trainDlGpuRequested
                      : t().trainDlCpuActive}
                  </span>
                  <Show when={!props.isGpuAvailable}>
                    <span class="text-rose-500 font-medium">{t().trainDlGpuUnavailable}</span>
                  </Show>
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* 4. PFVI & Optimization Settings */}
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="flex text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono items-center space-x-1.5">
              <Zap size={13} class="text-amber-500" />
              <span>{t().trainPfviSettingsTitle}</span>
            </label>
            <InfoHelper
              title={t().trainPfviInfoTitle}
              content={
                <div class="space-y-2 text-xs leading-relaxed">
                  <p>{t().trainPfviInfoDesc}</p>
                  <p class="text-[11px] text-slate-400">
                    <strong>Horizon (h):</strong> Number of time steps forecast into the future.
                    <br />
                    <strong>Annual Rain (R0):</strong> Tropical baseline rainfall normalization
                    (default: 2700 mm).
                    <br />
                    <strong>Max Grid (m):</strong> Nelder-Mead search grid dimension (1 to 3).
                  </p>
                </div>
              }
            />
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1.5 shadow-2xs">
              <span class="text-slate-700 dark:text-slate-300 block font-medium">
                {t().trainPfviHorizonParam}
              </span>
              <input
                type="number"
                min={1}
                max={30}
                value={props.hParam}
                onInput={(e) => props.onHParamChange(parseInt(e.currentTarget.value) || 4)}
                class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 text-center font-mono text-slate-900 dark:text-slate-100 shadow-2xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1.5 shadow-2xs">
              <span class="text-slate-700 dark:text-slate-300 block font-medium">
                {t().trainPfviAnnualRainParam}
              </span>
              <input
                type="number"
                value={props.r0Param}
                onInput={(e) => props.onR0ParamChange(parseFloat(e.currentTarget.value) || 2700)}
                class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 text-center font-mono text-slate-900 dark:text-slate-100 shadow-2xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1.5 shadow-2xs">
              <span class="text-slate-700 dark:text-slate-300 block font-medium">
                {t().trainPfviMaxGridParam}
              </span>
              <input
                type="number"
                min={1}
                max={3}
                value={props.maxGridM}
                onInput={(e) => props.onMaxGridMChange(parseInt(e.currentTarget.value) || 2)}
                class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 text-center font-mono text-slate-900 dark:text-slate-100 shadow-2xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1.5 shadow-2xs">
              <div class="flex items-center justify-between">
                <span class="text-slate-700 dark:text-slate-300 block font-medium">
                  {t().trainPfviRandomSeed}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextSeed = Math.floor(Math.random() * 100000);
                    props.onSeedParamChange(nextSeed);
                  }}
                  class="text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer font-semibold"
                >
                  {t().trainPfviRandomBtn}
                </button>
              </div>
              <input
                type="number"
                placeholder={DEFAULT_SEED.toString()}
                value={props.seedParam ?? DEFAULT_SEED}
                onInput={(e) => {
                  const val = parseInt(e.currentTarget.value, 10);
                  props.onSeedParamChange(!isNaN(val) ? val : DEFAULT_SEED);
                }}
                class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 text-center font-mono text-slate-900 dark:text-slate-100 shadow-2xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Start Training CTA */}
        <button
          type="button"
          onClick={props.onStartTraining}
          disabled={props.submitting || !props.selectedDatasetId}
          class="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-700/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.99]"
        >
          <Show
            when={!props.submitting}
            fallback={
              <div class="flex items-center space-x-2">
                <RotateCw size={14} class="animate-spin" />
                <span>{t().trainStartingBtn}</span>
              </div>
            }
          >
            <Sparkles size={15} />
            <span>{t().trainStartBtn}</span>
          </Show>
        </button>
      </div>

      {/* Resize Handle Divider */}
      <div
        role="separator"
        aria-orientation="vertical"
        tabIndex={0}
        onPointerDown={props.onResizeStart}
        onDblClick={props.onResetSidebarWidth}
        title={t().trainResizeHint}
        class={`hidden md:flex flex-col items-center justify-center w-3.5 -ml-2 -mr-1.5 z-20 cursor-col-resize select-none relative group shrink-0 transition-colors ${
          props.isResizing ? "bg-emerald-500/15" : "hover:bg-emerald-500/10"
        }`}
      >
        {/* Subtle center line */}
        <div
          class={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-px transition-colors ${
            props.isResizing
              ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
              : "bg-slate-200 dark:bg-slate-800 group-hover:bg-emerald-500/60"
          }`}
        />
        {/* Tactile Grab Handle */}
        <div
          class={`z-10 w-1 h-8 rounded-full transition-all duration-150 ${
            props.isResizing
              ? "bg-emerald-500 scale-y-125 shadow-sm shadow-emerald-500/50"
              : "bg-slate-300 dark:bg-slate-700 group-hover:bg-emerald-500 group-hover:scale-y-110"
          }`}
        />
      </div>
    </>
  );
};
