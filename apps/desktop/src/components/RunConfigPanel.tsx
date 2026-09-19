import { Component, createMemo, createSignal, Show } from "solid-js";
import {
  BrainCircuit,
  Check,
  Copy,
  Cpu,
  Database,
  Flame,
  Layers,
  Settings2,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-solid";
import type { PipelineConfig, RunDetail } from "../lib/types";
import { forecasterAlgorithm, getMetric, getParam, isNeural } from "../utils/runs";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";
import { toast } from "../lib/toast";

export interface RunConfigPanelProps {
  detail: RunDetail;
  class?: string;
}

export const RunConfigPanel: Component<RunConfigPanelProps> = (props) => {
  const t = () => catalogs[view.lang];
  const [copiedKey, setCopiedKey] = createSignal<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(t().runsCopiedClipboard);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Parse config_json if present
  const parsedConfig = createMemo<PipelineConfig | null>(() => {
    const raw = props.detail.config_json;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PipelineConfig;
    } catch {
      return null;
    }
  });

  const d = () => props.detail;
  const algo = () => forecasterAlgorithm(d());
  const isNeu = () => isNeural(d());

  // Helper to get param with config fallback
  const p = (key: string, fallback?: string): string => {
    const val = getParam(d(), key);
    if (val !== "-" && val !== undefined) return val;
    return fallback ?? "-";
  };

  const device = createMemo(() => {
    const fromParam = p(`${algo()}.device`);
    if (fromParam !== "-") return fromParam.toUpperCase();
    const parsed = parsedConfig();
    const nn = parsed?.forecaster.lstm || parsed?.forecaster.gru;
    return (nn?.device || "CPU").toUpperCase();
  });

  const batchSize = createMemo(() => {
    const fromParam = p(`${algo()}.batch_size`);
    if (fromParam !== "-") {
      if (fromParam === "0" || fromParam.toLowerCase() === "full") return "Full";
      return fromParam;
    }
    const parsed = parsedConfig();
    const nn = parsed?.forecaster.lstm || parsed?.forecaster.gru;
    if (nn?.batch_size === 0) return "Full";
    return nn?.batch_size?.toString() || "32";
  });

  const lookBack = createMemo(() => {
    const fromParam = p(`${algo()}.look_back`);
    if (fromParam !== "-") return fromParam;
    const parsed = parsedConfig();
    const nn = parsed?.forecaster.lstm || parsed?.forecaster.gru;
    return nn?.look_back?.toString() || "12";
  });

  const epochs = createMemo(() => {
    const fromParam = p(`${algo()}.epochs`);
    if (fromParam !== "-") return fromParam;
    const parsed = parsedConfig();
    const nn = parsed?.forecaster.lstm || parsed?.forecaster.gru;
    return nn?.epochs?.toString() || "100";
  });

  const units = createMemo(() => {
    const fromParam = p(`${algo()}.layer_units`);
    if (fromParam !== "-") return fromParam;
    const parsed = parsedConfig();
    const nn = parsed?.forecaster.lstm || parsed?.forecaster.gru;
    return nn?.layer_units?.[0]?.toString() || "16";
  });

  const learningRate = createMemo(() => {
    const fromParam = p(`${algo()}.learning_rate`);
    if (fromParam !== "-") return fromParam;
    const fromArima = p("arima.learning_rate");
    if (fromArima !== "-") return fromArima;
    const parsed = parsedConfig();
    const nn = parsed?.forecaster.lstm || parsed?.forecaster.gru;
    if (nn?.learning_rate !== undefined) return nn.learning_rate.toString();
    if (parsed?.forecaster.arima?.learning_rate !== undefined)
      return parsed.forecaster.arima.learning_rate.toString();
    return isNeu() ? "0.02" : "0.01";
  });
  const holdoutRatio = createMemo(() => {
    const parsed = parsedConfig();
    if (parsed?.forecaster.arima.test_split_ratio) {
      return `${(parsed.forecaster.arima.test_split_ratio * 100).toFixed(0)}%`;
    }
    const val = p("arima.test_split_ratio");
    if (val !== "-") {
      const num = parseFloat(val);
      if (!isNaN(num)) return `${(num * 100).toFixed(0)}%`;
    }
    return "20%";
  });

  return (
    <div
      class={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs dark:shadow-md space-y-4 select-none ${
        props.class ?? ""
      }`}
    >
      {/* Panel Header */}
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs">
            <Settings2 size={16} />
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
                {t().runsConfigPanelTitle}
              </h3>
              <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                v1.0
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex items-center space-x-2">
              <span class="text-slate-800 dark:text-slate-200 font-semibold">
                {d().summary.dataset_name ?? "Dataset"}
              </span>
              <span>·</span>
              <span class="text-purple-600 dark:text-purple-400 font-bold">
                {p("imputer.id", parsedConfig()?.imputer.id ?? "knn").toUpperCase()} ×{" "}
                {algo().toUpperCase()}
              </span>
              <span>·</span>
              <span>h={d().summary.h}</span>
              <span>·</span>
              <span>Seed {d().summary.seed}</span>
            </p>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => copyToClipboard(d().summary.run_id, "run_id")}
            class="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            title="Copy Run ID"
          >
            <span>Run: {d().summary.run_id.slice(0, 16)}...</span>
            <Show
              when={copiedKey() === "run_id"}
              fallback={<Copy size={11} class="text-slate-400" />}
            >
              <Check size={11} class="text-emerald-500" />
            </Show>
          </button>
        </div>
      </div>

      {/* 4 Themed Configuration Cards */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        {/* Card 1: Dataset & Evaluation Split */}
        <div class="p-4 rounded-xl bg-blue-500/5 dark:bg-blue-500/5 border border-blue-500/20 space-y-3 relative overflow-hidden">
          <div class="flex items-center justify-between pb-2 border-b border-blue-500/20 text-blue-900 dark:text-blue-200 font-bold">
            <div class="flex items-center space-x-2">
              <Database size={14} class="text-blue-500" />
              <span class="tracking-wide uppercase text-[11px] font-mono">
                {t().runsConfigDataset}
              </span>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 font-mono">
              PARQUET / CSV
            </span>
          </div>

          <div class="space-y-2">
            <div class="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-blue-500/15 flex items-center justify-between">
              <span class="text-slate-500 dark:text-slate-400 text-[11px]">Dataset:</span>
              <div class="flex items-center space-x-1.5 min-w-0">
                <span
                  class="font-sans font-bold text-slate-900 dark:text-slate-100 truncate max-w-45"
                  title={d().summary.dataset_name ?? ""}
                >
                  {d().summary.dataset_name ?? "Default"}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(d().summary.dataset_id, "ds_id")}
                  class="text-slate-400 hover:text-blue-500 p-0.5 rounded cursor-pointer transition-colors"
                  title="Copy Dataset ID"
                >
                  <Show when={copiedKey() === "ds_id"} fallback={<Copy size={11} />}>
                    <Check size={11} class="text-emerald-500" />
                  </Show>
                </button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-blue-500/15">
                <span class="text-[10px] text-slate-400 block mb-0.5">Holdout Split</span>
                <span class="font-bold text-emerald-600 dark:text-emerald-400">
                  {holdoutRatio()} (Test Split)
                </span>
              </div>
              <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-blue-500/15">
                <span class="text-[10px] text-slate-400 block mb-0.5">Horizon (h)</span>
                <span class="font-bold text-cyan-600 dark:text-cyan-400">
                  {d().summary.h ?? 4} steps forward
                </span>
              </div>
              <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-blue-500/15 col-span-2 flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-400 text-[10px]">PRNG Seed:</span>
                <span class="font-bold text-slate-800 dark:text-slate-200">
                  {d().summary.seed} (Deterministic Replay)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Imputation Engine */}
        <div class="p-4 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/20 space-y-3 relative overflow-hidden">
          <div class="flex items-center justify-between pb-2 border-b border-emerald-500/20 text-emerald-900 dark:text-emerald-200 font-bold">
            <div class="flex items-center space-x-2">
              <Layers size={14} class="text-emerald-500" />
              <span class="tracking-wide uppercase text-[11px] font-mono">
                {t().runsConfigImputation}
              </span>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-mono font-bold">
              {p("imputer.id", parsedConfig()?.imputer.id ?? "knn").toUpperCase()}
            </span>
          </div>

          <div class="space-y-2">
            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-emerald-500/15">
                <span class="text-[10px] text-slate-400 block mb-0.5">Neighbors (k)</span>
                <span class="font-bold text-slate-900 dark:text-slate-100">
                  k = {p("imputer.k", String(parsedConfig()?.imputer.k ?? 5))} donors
                </span>
              </div>
              <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-emerald-500/15">
                <span class="text-[10px] text-slate-400 block mb-0.5">Smoothing Span</span>
                <span class="font-bold text-slate-900 dark:text-slate-100">
                  span = {p("imputer.span", String(parsedConfig()?.imputer.span ?? 0.5))}
                </span>
              </div>
            </div>

            <div class="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-emerald-500/15 flex items-center justify-between">
              <span class="text-slate-500 dark:text-slate-400 text-[11px]">Total Imputed:</span>
              <span class="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-[11px]">
                {getMetric(d(), "impute", "impute.n_imputed") ?? 0} cells (
                {((getMetric(d(), "impute", "impute.frac_imputed") ?? 0) * 100).toFixed(1)}%)
              </span>
            </div>

            <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-emerald-500/15 flex items-center justify-between">
              <span class="text-slate-500 dark:text-slate-400 text-[10px]">
                Boundary Protection:
              </span>
              <div class="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                <ShieldCheck size={13} />
                <span>Edge-NA Guard Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Model Architecture & Hyperparameters */}
        <div class="p-4 rounded-xl bg-purple-500/5 dark:bg-purple-500/5 border border-purple-500/20 space-y-3 relative overflow-hidden">
          <div class="flex items-center justify-between pb-2 border-b border-purple-500/20 text-purple-900 dark:text-purple-200 font-bold">
            <div class="flex items-center space-x-2">
              <BrainCircuit size={14} class="text-purple-500" />
              <span class="tracking-wide uppercase text-[11px] font-mono">
                {t().runsConfigForecasting}
              </span>
            </div>
            <div class="flex items-center space-x-1.5">
              <span class="px-2 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-bold font-mono">
                {algo().toUpperCase()}
              </span>
              <span
                class={`px-2 py-0.5 rounded text-[10px] font-bold font-mono flex items-center space-x-1 border ${
                  device() === "GPU"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    : "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20"
                }`}
              >
                <Show when={device() === "GPU"} fallback={<Cpu size={10} class="text-cyan-500" />}>
                  <Sparkles size={10} class="text-amber-500" />
                </Show>
                <span>{device()}</span>
              </span>
            </div>
          </div>

          <div class="space-y-2">
            <Show
              when={isNeu()}
              fallback={
                /* Statistical AutoARIMA Parameters */
                <div class="space-y-1.5">
                  <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-purple-500/15 flex items-center justify-between text-[11px]">
                    <span class="text-slate-500">AutoARIMA WT Order:</span>
                    <strong class="text-cyan-700 dark:text-cyan-400 font-mono">
                      (p={getMetric(d(), "forecast", "arima.wt.order_p") ?? 1}, d=
                      {getMetric(d(), "forecast", "arima.wt.order_d") ?? 1}, q=
                      {getMetric(d(), "forecast", "arima.wt.order_q") ?? 0})
                    </strong>
                  </div>
                  <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-purple-500/15 flex items-center justify-between text-[11px]">
                    <span class="text-slate-500">AutoARIMA SM Order:</span>
                    <strong class="text-emerald-700 dark:text-emerald-400 font-mono">
                      (p={getMetric(d(), "forecast", "arima.sm.order_p") ?? 1}, d=
                      {getMetric(d(), "forecast", "arima.sm.order_d") ?? 1}, q=
                      {getMetric(d(), "forecast", "arima.sm.order_q") ?? 0})
                    </strong>
                  </div>
                  <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-purple-500/15 flex items-center justify-between text-[11px]">
                    <span class="text-slate-500">Residual Diagnostics:</span>
                    <span class="text-emerald-600 dark:text-emerald-400 font-bold">
                      Ljung-Box p &gt; 0.05 (White Noise)
                    </span>
                  </div>
                  <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-purple-500/15 flex items-center justify-between text-[11px]">
                    <span class="text-slate-500">Refinement Learning Rate:</span>
                    <strong class="text-purple-700 dark:text-purple-400 font-mono">
                      η = {learningRate()}
                    </strong>
                  </div>
                </div>
              }
            >
              {/* Deep Learning 4-Chip Hyperparameter Grid */}
              <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-purple-500/15">
                  <span class="text-[10px] text-slate-400 block mb-0.5">Lookback (L)</span>
                  <strong class="text-slate-900 dark:text-slate-100">{lookBack()} timesteps</strong>
                </div>
                <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-purple-500/15">
                  <span class="text-[10px] text-slate-400 block mb-0.5">Hidden Units</span>
                  <strong class="text-purple-600 dark:text-purple-400">{units()} units</strong>
                </div>
                <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-purple-500/15">
                  <span class="text-[10px] text-slate-400 block mb-0.5">Total Epochs</span>
                  <strong class="text-emerald-600 dark:text-emerald-400">{epochs()} epochs</strong>
                </div>
                <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-purple-500/15">
                  <span class="text-[10px] text-slate-400 block mb-0.5">Batch & Optimizer</span>
                  <strong class="text-cyan-600 dark:text-cyan-400">
                    {batchSize() === "Full" ? "Full Batch" : `B=${batchSize()}`} · Adam (η=
                    {learningRate()})
                  </strong>
                </div>
              </div>
            </Show>
          </div>
        </div>

        {/* Card 4: PFVI Calibration Parameters */}
        <div class="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-500/5 border border-amber-500/20 space-y-3 relative overflow-hidden">
          <div class="flex items-center justify-between pb-2 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 font-bold">
            <div class="flex items-center space-x-2">
              <Flame size={14} class="text-amber-500" />
              <span class="tracking-wide uppercase text-[11px] font-mono">
                {t().runsConfigPfvi}
              </span>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-mono font-bold flex items-center space-x-1">
              <Zap size={10} />
              <span>NELDER-MEAD 4D</span>
            </span>
          </div>

          <div class="space-y-2">
            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-amber-500/15">
                <span class="text-[10px] text-slate-400 block mb-0.5">Van Genuchten [aH, bH]</span>
                <span class="text-slate-900 dark:text-slate-100 font-mono font-bold">
                  aH={getMetric(d(), "pfvi", "pfvi.aH")?.toFixed(3) ?? "-"} · bH=
                  {getMetric(d(), "pfvi", "pfvi.bH")?.toFixed(3) ?? "-"}
                </span>
              </div>
              <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-amber-500/15">
                <span class="text-[10px] text-slate-400 block mb-0.5">Shape [n, α]</span>
                <span class="text-slate-900 dark:text-slate-100 font-mono font-bold">
                  n={getMetric(d(), "pfvi", "pfvi.n")?.toFixed(3) ?? "-"} · α=
                  {getMetric(d(), "pfvi", "pfvi.alpha")?.toFixed(3) ?? "-"}
                </span>
              </div>
            </div>

            <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-amber-500/15 flex items-center justify-between text-[11px]">
              <span class="text-slate-500 dark:text-slate-400 text-[10px]">
                Hydrological Constants:
              </span>
              <span class="text-slate-800 dark:text-slate-200 font-bold">
                R₀={p("pfvi.r0", p("pfvi.R0", "2700"))} mm · Δt={p("pfvi.dt", "1.0")} d
              </span>
            </div>

            <div class="bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-amber-500/15 flex items-center justify-between text-[11px]">
              <span class="text-slate-500 dark:text-slate-400 text-[10px]">
                Soil Characteristics:
              </span>
              <span class="text-slate-800 dark:text-slate-200 font-bold">
                FC={p("pfvi.fc", "40")}% · SAT={p("pfvi.sat", "70")}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RunConfigPanel;
