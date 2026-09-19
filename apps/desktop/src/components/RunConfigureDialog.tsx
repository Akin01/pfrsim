import { Component, createEffect, createSignal, For, Show } from "solid-js";
import { BrainCircuit, Cpu, Play, Sliders, X } from "lucide-solid";
import Dialog from "corvu/dialog";
import { catalogs } from "../i18n/catalog";
import { InfoHelper } from "./InfoHelper";
import { navigateTab, view } from "../lib/store";
import { pipelineRun } from "../lib/tauri";
import { toast } from "../lib/toast";
import { mutationBus } from "../lib/mutation";
import type { PipelineConfig, RunDetail } from "../lib/types";
import { forecasterAlgorithm, getParam, isNeural } from "../utils/runs";
import { DEFAULT_SEED } from "../utils/train";

export interface RunConfigureDialogProps {
  runDetail: RunDetail | null;
  onClose: () => void;
  onRunLaunched?: (jobId: string) => void;
  onOpenInTrain?: (config: PipelineConfig, datasetId: string) => void;
}

export const RunConfigureDialog: Component<RunConfigureDialogProps> = (props) => {
  const t = () => catalogs[view.lang];

  const detail = () => props.runDetail;
  const algo = () => forecasterAlgorithm(detail());
  const isNeu = () => isNeural(detail());

  // Form Signals
  const [learningRate, setLearningRate] = createSignal(0.02);
  const [epochs, setEpochs] = createSignal(100);
  const [batchSize, setBatchSize] = createSignal(32);
  const [lookBack, setLookBack] = createSignal(12);
  const [layerUnits, setLayerUnits] = createSignal(16);
  const [splitRatio, setSplitRatio] = createSignal(0.2);
  const [hParam, setHParam] = createSignal(4);
  const [r0Param, setR0Param] = createSignal(2700);
  const [dlDevice, setDlDevice] = createSignal<"cpu" | "gpu">("cpu");
  const [seedParam, setSeedParam] = createSignal(42);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  // Initialize signals from runDetail whenever it changes
  createEffect(() => {
    const d = detail();
    if (!d) return;

    let parsed: PipelineConfig | null = null;
    const configRaw = "config_json" in d ? d.config_json : undefined;
    if (configRaw) {
      try {
        parsed = typeof configRaw === "string" ? JSON.parse(configRaw) : configRaw;
      } catch {}
    }

    const p = (key: string, fallback = "-") => {
      const val = getParam(d, key);
      return val !== "-" && val !== undefined ? val : fallback;
    };

    const parsedNn = parsed?.forecaster?.lstm || parsed?.forecaster?.gru;
    const parsedArima = parsed?.forecaster?.arima;

    // Learning rate extraction
    const lrStr = p(`${algo()}.learning_rate`, p("arima.learning_rate"));
    let lr = 0.02;
    if (lrStr !== "-") {
      const num = parseFloat(lrStr);
      if (!isNaN(num)) lr = num;
    } else if (parsedNn?.learning_rate !== undefined) {
      lr = parsedNn.learning_rate;
    } else if (parsedArima?.learning_rate !== undefined) {
      lr = parsedArima.learning_rate;
    } else {
      lr = isNeu() ? 0.02 : 0.01;
    }
    setLearningRate(lr);

    // Epochs
    const epStr = p(`${algo()}.epochs`);
    const epNum = parseInt(epStr, 10);
    setEpochs(!isNaN(epNum) ? epNum : (parsedNn?.epochs ?? 100));

    // Batch size
    const bStr = p(`${algo()}.batch_size`);
    const bNum = parseInt(bStr, 10);
    setBatchSize(!isNaN(bNum) ? bNum : (parsedNn?.batch_size ?? 32));

    // Lookback
    const lbStr = p(`${algo()}.look_back`);
    const lbNum = parseInt(lbStr, 10);
    setLookBack(!isNaN(lbNum) ? lbNum : (parsedNn?.look_back ?? 12));

    // Layer units
    const uStr = p(`${algo()}.layer_units`);
    const uNum = parseInt(uStr, 10);
    setLayerUnits(!isNaN(uNum) ? uNum : (parsedNn?.layer_units?.[0] ?? 16));

    // Split ratio
    const splitStr = p("arima.test_split_ratio");
    const splitNum = parseFloat(splitStr);
    setSplitRatio(!isNaN(splitNum) ? splitNum : (parsedArima?.test_split_ratio ?? 0.2));

    // Horizon & R0
    setHParam(d.summary?.h ?? 4);
    const r0Str = p("pfvi.r0");
    const r0Num = parseFloat(r0Str);
    setR0Param(!isNaN(r0Num) ? r0Num : (parsed?.pfvi?.r0 ?? 2700));

    // Device
    const devStr = p(`${algo()}.device`, parsedNn?.device ?? "cpu").toLowerCase();
    setDlDevice(devStr === "gpu" ? "gpu" : "cpu");

    // Seed
    setSeedParam(d.summary?.seed ?? 42);
  });

  const buildPipelineConfig = (): PipelineConfig => {
    const d = detail();
    let imputerId = "knn";
    let imputerK = 5;
    let imputerSpan = 0.5;

    if (d) {
      imputerId =
        getParam(d, "imputer.id") !== "-"
          ? getParam(d, "imputer.id")
          : (d.summary?.imputer_id ?? "knn");
      const kNum = parseInt(getParam(d, "imputer.k"), 10);
      if (!isNaN(kNum)) imputerK = kNum;
      const spanNum = parseFloat(getParam(d, "imputer.span"));
      if (!isNaN(spanNum)) imputerSpan = spanNum;
    }

    const fcId = algo();

    return {
      imputer: {
        id: imputerId,
        k: imputerK,
        span: imputerSpan,
      },
      forecaster: {
        id: fcId,
        arima: {
          test_split_ratio: splitRatio(),
          learning_rate: learningRate(),
        },
        lstm:
          fcId === "lstm"
            ? {
                look_back: lookBack(),
                layer_units: [layerUnits()],
                epochs: epochs(),
                batch_size: batchSize(),
                learning_rate: learningRate(),
                device: dlDevice(),
              }
            : null,
        gru:
          fcId === "gru"
            ? {
                look_back: lookBack(),
                layer_units: [layerUnits()],
                epochs: epochs(),
                batch_size: batchSize(),
                learning_rate: learningRate(),
                device: dlDevice(),
              }
            : null,
      },
      pfvi: {
        r0: r0Param(),
        dt: 1.0,
        h: hParam(),
        fc: 40.0,
        sat: 70.0,
        max_grid_m: 2,
        timeout_s: 30.0,
      },
      seed: seedParam(),
    };
  };

  const handleLaunchRun = async () => {
    const d = detail();
    if (!d) return;

    const datasetId = d.summary.dataset_id;
    if (!datasetId) {
      toast.error("Missing dataset ID for this run.");
      return;
    }

    setIsSubmitting(true);
    try {
      const config = buildPipelineConfig();
      const res = await pipelineRun(datasetId, config, seedParam());
      if (res.ok) {
        toast.success(t().runsReconfigureInitiated(res.data.job_id));
        mutationBus.notifyRunMutated(null);
        props.onRunLaunched?.(res.data.job_id);
        props.onClose();
      } else {
        toast.error(`Failed to launch run: ${res.message}`);
      }
    } catch (err) {
      toast.error(`Run launch error: ${String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenInTrainStudio = () => {
    const d = detail();
    if (!d) return;

    const config = buildPipelineConfig();
    const datasetId = d.summary.dataset_id;

    if (props.onOpenInTrain) {
      props.onOpenInTrain(config, datasetId);
    } else {
      navigateTab("train");
    }
    props.onClose();
  };

  return (
    <Dialog
      open={props.runDetail !== null}
      onOpenChange={(open) => {
        if (!open && !isSubmitting()) props.onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm transition-all duration-200" />
        <Dialog.Content class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-[94vw] p-6 shadow-2xl space-y-5 focus:outline-none text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
          {/* Header */}
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Sliders size={20} />
              </div>
              <div>
                <Dialog.Label class="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                  {t().runsReconfigureModalTitle}
                </Dialog.Label>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {detail()?.summary.name ?? "Run"} · {algo().toUpperCase()}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              disabled={isSubmitting()}
              class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {t().runsReconfigureModalDesc}
          </p>

          {/* Form Hyperparameters */}
          <div class="space-y-4">
            {/* Learning Rate (η) Highlight Card */}
            <div class="p-3.5 rounded-xl bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 space-y-2.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-1.5 text-xs font-bold text-purple-900 dark:text-purple-200 font-mono">
                  <BrainCircuit size={14} class="text-purple-600 dark:text-purple-400" />
                  <span>{t().trainDlLearningRate}</span>
                  <InfoHelper
                    title={t().trainDlGuideTitle}
                    placement="top"
                    size={11}
                    content={
                      <div class="space-y-2 text-xs max-w-xs leading-relaxed">
                        <p>
                          <strong>{t().trainDlGuideLrTitle}:</strong> {t().trainDlGuideLrDesc}
                        </p>
                        <p>
                          <strong>{t().trainDlGuideBatchTitle}:</strong> {t().trainDlGuideBatchDesc}
                        </p>
                        <p>
                          <strong>{t().trainDlGuideEpochsTitle}:</strong>{" "}
                          {t().trainDlGuideEpochsDesc}
                        </p>
                      </div>
                    }
                  />
                </div>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                  η = {learningRate()}
                </span>
              </div>

              <div class="flex items-center gap-2">
                <input
                  type="number"
                  min={0.0001}
                  max={1.0}
                  step={0.005}
                  value={learningRate()}
                  onInput={(e) => {
                    const val = parseFloat(e.currentTarget.value) || 0.02;
                    setLearningRate(Math.min(1.0, Math.max(0.0001, val)));
                  }}
                  class="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono text-xs text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                />
                <div class="flex items-center space-x-1 shrink-0">
                  <For each={[0.001, 0.005, 0.01, 0.02, 0.05]}>
                    {(rate) => (
                      <button
                        type="button"
                        onClick={() => setLearningRate(rate)}
                        class={`px-2 py-1 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                          learningRate() === rate
                            ? "bg-purple-600 text-white font-bold shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {rate}
                      </button>
                    )}
                  </For>
                </div>
              </div>
              <p class="text-[10px] text-slate-400 dark:text-slate-500">
                {t().trainDlLearningRateHint}
              </p>
            </div>

            {/* Neural Parameters (if neural) */}
            <Show when={isNeu()}>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div class="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <span class="text-[10px] text-slate-500 block truncate">{t().trainDlEpochs}</span>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={epochs()}
                    onInput={(e) => setEpochs(parseInt(e.currentTarget.value) || 100)}
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-1 text-center font-bold"
                  />
                </div>
                <div class="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] text-slate-500 block truncate">
                      {t().trainDlBatchSize}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBatchSize(batchSize() === 0 ? 32 : 0)}
                      class={`text-[9px] font-mono px-1 rounded transition-colors cursor-pointer ${
                        batchSize() === 0
                          ? "bg-emerald-500 text-white font-bold shadow-2xs"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                      }`}
                      title={t().trainDlFullBatchDesc}
                    >
                      {batchSize() === 0 ? t().trainDlFullBatch : "Full"}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={batchSize() === 0 ? "Full" : batchSize()}
                    onInput={(e) => {
                      const raw = e.currentTarget.value.trim().toLowerCase();
                      if (raw === "0" || raw === "full" || raw === "f") {
                        setBatchSize(0);
                        return;
                      }
                      const val = parseInt(raw, 10);
                      if (!isNaN(val)) setBatchSize(Math.max(0, val));
                    }}
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-1 text-center font-bold"
                  />
                </div>
                <div class="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <span class="text-[10px] text-slate-500 block truncate">
                    {t().trainDlLookback}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={lookBack()}
                    onInput={(e) => setLookBack(parseInt(e.currentTarget.value) || 12)}
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-1 text-center font-bold"
                  />
                </div>
                <div class="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <span class="text-[10px] text-slate-500 block truncate">{t().trainDlUnits}</span>
                  <input
                    type="number"
                    min={4}
                    max={64}
                    value={layerUnits()}
                    onInput={(e) => setLayerUnits(parseInt(e.currentTarget.value) || 16)}
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-1 text-center font-bold"
                  />
                </div>
              </div>
            </Show>

            {/* General Simulation Settings */}
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div class="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                <span class="text-[10px] text-slate-500 block">Horizon (h)</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={hParam()}
                  onInput={(e) => setHParam(parseInt(e.currentTarget.value) || 4)}
                  class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-1 text-center font-bold"
                />
              </div>
              <div class="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                <span class="text-[10px] text-slate-500 block">Rainfall R₀ (mm)</span>
                <input
                  type="number"
                  min={100}
                  max={5000}
                  value={r0Param()}
                  onInput={(e) => setR0Param(parseFloat(e.currentTarget.value) || 2700)}
                  class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-1 text-center font-bold"
                />
              </div>
              <div class="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                <span class="text-[10px] text-slate-500 block">Split Ratio</span>
                <input
                  type="number"
                  min={0.05}
                  max={0.5}
                  step={0.05}
                  value={splitRatio()}
                  onInput={(e) => setSplitRatio(parseFloat(e.currentTarget.value) || 0.2)}
                  class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-1 text-center font-bold"
                />
              </div>
              <div class="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] text-slate-500 block">Seed</span>
                  <button
                    type="button"
                    onClick={() => setSeedParam(Math.floor(Math.random() * 100000))}
                    class="text-[9px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-semibold"
                    title="Generate random seed"
                  >
                    🎲
                  </button>
                </div>
                <input
                  type="number"
                  placeholder={DEFAULT_SEED.toString()}
                  value={seedParam() ?? DEFAULT_SEED}
                  onInput={(e) => {
                    const val = parseInt(e.currentTarget.value, 10);
                    setSeedParam(!isNaN(val) ? val : DEFAULT_SEED);
                  }}
                  class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-1 text-center font-bold"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div class="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleOpenInTrainStudio}
              disabled={isSubmitting()}
              class="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 transition-colors"
            >
              <Cpu size={13} />
              <span>{t().runsReconfigureOpenTrain}</span>
            </button>

            <div class="flex items-center space-x-2">
              <Dialog.Close
                disabled={isSubmitting()}
                onClick={props.onClose}
                class="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {t().runsDeleteCancel}
              </Dialog.Close>
              <button
                type="button"
                onClick={handleLaunchRun}
                disabled={isSubmitting()}
                class="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <Show when={isSubmitting()} fallback={<Play size={12} fill="currentColor" />}>
                  <div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </Show>
                <span>{t().runsReconfigureLaunch}</span>
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
