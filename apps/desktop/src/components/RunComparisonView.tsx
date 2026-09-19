import { Component, createMemo, For, Show } from "solid-js";
import { Activity, ChartColumn, Play } from "lucide-solid";
import type { RunDetail } from "../lib/types";
import {
  COMPARE_COLORS,
  datasetsDiffer,
  getMetric,
  getParam,
  isNeural,
  isParamDiff,
} from "../utils/runs";
import { MultiModelTrajectoryPlot } from "./MultiModelTrajectoryPlot";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export interface RunComparisonViewProps {
  comparisonDetails: RunDetail[];
  activeCompareRunIdx: number | null;
  setActiveCompareRunIdx: (idx: number | null) => void;
  onClearComparison: () => void;
  onLoadIntoPlayer: (runId: string, runName?: string) => void;
}

export const RunComparisonView: Component<RunComparisonViewProps> = (props) => {
  const t = () => catalogs[view.lang];

  const comparisonBestMse = createMemo(() => {
    const list = props.comparisonDetails;
    if (list.length === 0) return null;
    const mses = list.map((c) => getMetric(c, "pfvi", "pfvi.mse") ?? Infinity);
    const minVal = Math.min(...mses);
    return minVal < Infinity ? minVal : null;
  });

  const comparisonFastestSec = createMemo(() => {
    const list = props.comparisonDetails;
    if (list.length === 0) return null;
    const secs = list.map((c) => getMetric(c, "pfvi", "pfvi.fit_seconds") ?? Infinity);
    const minVal = Math.min(...secs);
    return minVal < Infinity ? minVal : null;
  });

  return (
    <div id="comparison-scroll-container" class="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
      {/* 1. Comparison Header & Quick Actions */}
      <div class="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs dark:shadow-md flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center space-x-2.5">
          <div class="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ChartColumn size={15} />
          </div>
          <div>
            <h3 class="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
              {t().runsComparisonTitle(props.comparisonDetails.length)}
            </h3>
            <p class="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {t().runsComparisonSubtitle}
            </p>
          </div>
          <Show when={datasetsDiffer(props.comparisonDetails)}>
            <span class="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 text-[10px] font-mono">
              {t().runsDatasetsDiffer}
            </span>
          </Show>
        </div>
        <button
          type="button"
          onClick={props.onClearComparison}
          class="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer font-mono"
        >
          {t().runsClearComparison}
        </button>
      </div>

      {/* 2. Head-to-Head Visual Summary Cards (Horizontal Scrollable) */}
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 px-0.5">
          <span class="font-bold text-slate-700 dark:text-slate-300">
            {t().runsComparativeCardsTitle} ({props.comparisonDetails.length}/10)
          </span>
          <span class="text-[10px] text-slate-400 dark:text-slate-500 flex items-center space-x-1 font-mono">
            <span>←</span>
            <span>{t().runsScrollHorizontalHint}</span>
            <span>→</span>
          </span>
        </div>

        <div
          id="comparison-cards-container"
          class="flex items-stretch gap-3 overflow-x-auto pb-3 pt-0.5 px-0.5 snap-x snap-mandatory focus:outline-none"
        >
          <For each={props.comparisonDetails}>
            {(cd, idx) => {
              const mse = getMetric(cd, "pfvi", "pfvi.mse");
              const isBest = mse !== null && mse === comparisonBestMse();
              const baselineMse =
                getMetric(props.comparisonDetails[0], "pfvi", "pfvi.mse") ?? mse ?? 1;
              const deltaPct =
                mse !== null && baselineMse > 0
                  ? (((mse - baselineMse) / baselineMse) * 100).toFixed(1)
                  : "0.0";
              const h = cd.summary.h ?? 4;
              const lastVal = getMetric(cd, "pfvi", `pfvi.h${h}.value`);
              const lastClass =
                getMetric(cd, "pfvi", `pfvi.h${h}.class`) ??
                (lastVal !== null
                  ? lastVal >= 85
                    ? 3
                    : lastVal >= 60
                      ? 2
                      : lastVal >= 30
                        ? 1
                        : 0
                  : 0);

              return (
                <div
                  class={`w-72 shrink-0 p-4 rounded-2xl border transition-all snap-start flex flex-col justify-between ${
                    isBest
                      ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-500/40 shadow-xs ring-1 ring-emerald-500/20"
                      : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-2xs"
                  }`}
                >
                  <div>
                    <div class="flex items-start justify-between gap-1 mb-2">
                      <span
                        class={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase font-mono ${
                          isBest
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-700"
                            : "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        }`}
                      >
                        {isBest ? t().runsBestModelBadge : t().runsModelNumberBadge(idx() + 1)}
                      </span>
                      <span class="text-[10px] text-slate-400 font-mono">h={h}</span>
                    </div>

                    <h4
                      class="text-xs font-bold text-slate-900 dark:text-slate-100 truncate mb-1"
                      title={cd.summary.name}
                    >
                      {cd.summary.name}
                    </h4>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 font-mono mb-3">
                      {(cd.summary.imputer_id ?? "knn").toUpperCase()} ×{" "}
                      {(cd.summary.forecaster_id ?? "arima").toUpperCase()}
                    </p>
                  </div>

                  <div>
                    <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 mb-3 space-y-1">
                      <div class="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>PFVI MSE</span>
                        <span
                          class={`px-1 rounded text-[9px] font-bold ${
                            lastClass === 3
                              ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50"
                              : lastClass === 2
                                ? "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50"
                                : lastClass === 1
                                  ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50"
                                  : "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50"
                          }`}
                        >
                          {lastClass === 3
                            ? "EXTREME"
                            : lastClass === 2
                              ? "HIGH"
                              : lastClass === 1
                                ? "MOD"
                                : "LOW"}
                        </span>
                      </div>
                      <div class="flex items-baseline space-x-2">
                        <span
                          class={`text-lg font-black font-mono ${
                            isBest
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {mse !== null ? mse.toFixed(2) : "-"}
                        </span>
                        <Show when={idx() > 0 && mse !== null}>
                          <span
                            class={`text-[10px] font-mono font-bold ${
                              parseFloat(deltaPct) < 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-500"
                            }`}
                          >
                            {parseFloat(deltaPct) <= 0 ? "" : "+"}
                            {deltaPct}%
                          </span>
                        </Show>
                      </div>
                    </div>

                    <div class="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => props.onLoadIntoPlayer(cd.summary.run_id, cd.summary.name)}
                        class="flex-1 py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Play size={10} fill="currentColor" />
                        <span>Player</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* 3. Interactive Multi-Model Horizon Trajectory Comparison Plot */}
      <div class="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs dark:shadow-md space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Activity size={13} />
            </div>
            <h4 class="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
              {t().runsMultiModelTrajectoryTitle}
            </h4>
          </div>

          {/* Interactive Legend with highlight-on-hover */}
          <div class="flex flex-wrap items-center gap-2 text-[10px] font-mono">
            <For each={props.comparisonDetails}>
              {(cd, idx) => {
                const color = COMPARE_COLORS[idx() % COMPARE_COLORS.length];
                const isHovered = () => props.activeCompareRunIdx === idx();
                return (
                  <span
                    onMouseEnter={() => props.setActiveCompareRunIdx(idx())}
                    onMouseLeave={() => props.setActiveCompareRunIdx(null)}
                    class={`flex items-center space-x-1.5 px-2 py-0.5 rounded-md border cursor-pointer transition-all duration-150 ${
                      isHovered()
                        ? "bg-slate-200 dark:bg-slate-700 border-slate-400 dark:border-slate-500 shadow-xs scale-105"
                        : "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:border-slate-400"
                    }`}
                  >
                    <span
                      class="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ "background-color": color }}
                    />
                    <span class="truncate max-w-32.5" title={cd.summary.name}>
                      {cd.summary.name}
                    </span>
                  </span>
                );
              }}
            </For>
          </div>
        </div>

        <MultiModelTrajectoryPlot
          runs={props.comparisonDetails}
          colors={COMPARE_COLORS}
          activeRunIdx={props.activeCompareRunIdx}
        />
      </div>

      {/* 4. Comparison Table with Winner Highlights */}
      <div class="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs dark:shadow-md space-y-3">
        <h4 class="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
          {t().runsMetricMatrixTitle}
        </h4>
        <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table class="w-full text-xs text-left font-mono">
            <thead class="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th class="p-3">{t().runsMetricOrParam}</th>
                <For each={props.comparisonDetails}>
                  {(cd) => (
                    <th class="p-3 text-slate-900 dark:text-slate-200 font-bold">
                      {cd.summary.name}
                    </th>
                  )}
                </For>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-800/60">
              <tr
                class={
                  isParamDiff(props.comparisonDetails, "imputer.id")
                    ? "bg-amber-50/60 dark:bg-amber-500/5"
                    : ""
                }
              >
                <td class="p-3 text-slate-600 dark:text-slate-400 font-bold">Imputer</td>
                <For each={props.comparisonDetails}>
                  {(cd) => (
                    <td
                      class={`p-3 ${
                        isParamDiff(props.comparisonDetails, "imputer.id")
                          ? "text-amber-700 dark:text-amber-300 font-bold"
                          : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {getParam(cd, "imputer.id").toUpperCase()}
                    </td>
                  )}
                </For>
              </tr>
              <tr
                class={
                  isParamDiff(props.comparisonDetails, "forecaster.id")
                    ? "bg-amber-50/60 dark:bg-amber-500/5"
                    : ""
                }
              >
                <td class="p-3 text-slate-600 dark:text-slate-400 font-bold">Forecaster</td>
                <For each={props.comparisonDetails}>
                  {(cd) => (
                    <td
                      class={`p-3 ${
                        isParamDiff(props.comparisonDetails, "forecaster.id")
                          ? "text-amber-700 dark:text-amber-300 font-bold"
                          : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {getParam(cd, "forecaster.id").toUpperCase()}
                    </td>
                  )}
                </For>
              </tr>
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-medium">
                  {t().runsLearningRateCol}
                </td>
                <For each={props.comparisonDetails}>
                  {(cd) => {
                    const lrLstm = getParam(cd, "lstm.learning_rate");
                    const lrGru = getParam(cd, "gru.learning_rate");
                    const lrArima = getParam(cd, "arima.learning_rate");
                    const lr =
                      lrLstm !== "-"
                        ? lrLstm
                        : lrGru !== "-"
                          ? lrGru
                          : lrArima !== "-"
                            ? lrArima
                            : isNeural(cd)
                              ? "0.02"
                              : "0.01";
                    return (
                      <td class="p-3 font-mono text-xs text-slate-800 dark:text-slate-200">
                        <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold">
                          η = {lr}
                        </span>
                      </td>
                    );
                  }}
                </For>
              </tr>
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-medium">
                  {t().trainDlBatchSize}
                </td>
                <For each={props.comparisonDetails}>
                  {(cd) => {
                    if (!isNeural(cd)) {
                      return <td class="p-3 font-mono text-xs text-slate-400">-</td>;
                    }
                    const bLstm = getParam(cd, "lstm.batch_size");
                    const bGru = getParam(cd, "gru.batch_size");
                    const raw = bLstm !== "-" ? bLstm : bGru !== "-" ? bGru : "32";
                    const display =
                      raw === "0" || raw.toLowerCase() === "full" ? "Full Batch" : `B = ${raw}`;
                    return (
                      <td class="p-3 font-mono text-xs text-slate-800 dark:text-slate-200">
                        <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          {display}
                        </span>
                      </td>
                    );
                  }}
                </For>
              </tr>
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-bold">
                  PFVI MSE {t().runsLowerIsBetter}
                </td>
                <For each={props.comparisonDetails}>
                  {(cd) => {
                    const mse = getMetric(cd, "pfvi", "pfvi.mse");
                    const isBest = mse !== null && mse === comparisonBestMse();
                    return (
                      <td
                        class={`p-3 font-mono text-sm ${
                          isBest
                            ? "font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30"
                            : "text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {mse !== null ? (
                          <span class="flex items-center space-x-1">
                            <span>{mse.toFixed(2)}</span>
                            <Show when={isBest}>
                              <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                {t().runsBestBadge}
                              </span>
                            </Show>
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    );
                  }}
                </For>
              </tr>
              {/* WT Forecast Metrics */}
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-medium">WT Forecast MSE</td>
                <For each={props.comparisonDetails}>
                  {(cd) => (
                    <td class="p-3 text-slate-800 dark:text-slate-200">
                      {getMetric(cd, "forecast", "forecast.wt.mse")?.toFixed(4) ?? "-"}
                    </td>
                  )}
                </For>
              </tr>
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-medium">WT Forecast RMSE</td>
                <For each={props.comparisonDetails}>
                  {(cd) => (
                    <td class="p-3 text-slate-800 dark:text-slate-200">
                      {getMetric(cd, "forecast", "forecast.wt.rmse")?.toFixed(4) ?? "-"}
                    </td>
                  )}
                </For>
              </tr>
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-medium">WT Forecast MAE</td>
                <For each={props.comparisonDetails}>
                  {(cd) => (
                    <td class="p-3 text-slate-800 dark:text-slate-200">
                      {getMetric(cd, "forecast", "forecast.wt.mae")?.toFixed(4) ?? "-"}
                    </td>
                  )}
                </For>
              </tr>

              {/* SM Forecast Metrics */}
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-medium">SM Forecast MSE</td>
                <For each={props.comparisonDetails}>
                  {(cd) => (
                    <td class="p-3 text-slate-800 dark:text-slate-200">
                      {getMetric(cd, "forecast", "forecast.sm.mse")?.toFixed(4) ?? "-"}
                    </td>
                  )}
                </For>
              </tr>
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-medium">SM Forecast RMSE</td>
                <For each={props.comparisonDetails}>
                  {(cd) => (
                    <td class="p-3 text-slate-800 dark:text-slate-200">
                      {getMetric(cd, "forecast", "forecast.sm.rmse")?.toFixed(4) ?? "-"}
                    </td>
                  )}
                </For>
              </tr>
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-medium">SM Forecast MAE</td>
                <For each={props.comparisonDetails}>
                  {(cd) => (
                    <td class="p-3 text-slate-800 dark:text-slate-200">
                      {getMetric(cd, "forecast", "forecast.sm.mae")?.toFixed(4) ?? "-"}
                    </td>
                  )}
                </For>
              </tr>

              {/* Rf Forecast Metrics */}
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-medium">Rf Forecast MSE</td>
                <For each={props.comparisonDetails}>
                  {(cd) => (
                    <td class="p-3 text-slate-800 dark:text-slate-200">
                      {getMetric(cd, "forecast", "forecast.rf.mse")?.toFixed(6) ?? "-"}
                    </td>
                  )}
                </For>
              </tr>
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-medium">Rf Forecast RMSE</td>
                <For each={props.comparisonDetails}>
                  {(cd) => (
                    <td class="p-3 text-slate-800 dark:text-slate-200">
                      {getMetric(cd, "forecast", "forecast.rf.rmse")?.toFixed(6) ?? "-"}
                    </td>
                  )}
                </For>
              </tr>
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-medium">Rf Forecast MAE</td>
                <For each={props.comparisonDetails}>
                  {(cd) => (
                    <td class="p-3 text-slate-800 dark:text-slate-200">
                      {getMetric(cd, "forecast", "forecast.rf.mae")?.toFixed(6) ?? "-"}
                    </td>
                  )}
                </For>
              </tr>

              {/* Temp Forecast Metrics */}
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-medium">
                  Temp Forecast MSE
                </td>
                <For each={props.comparisonDetails}>
                  {(cd) => (
                    <td class="p-3 text-slate-800 dark:text-slate-200">
                      {getMetric(cd, "forecast", "forecast.temp.mse")?.toFixed(4) ?? "-"}
                    </td>
                  )}
                </For>
              </tr>
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-medium">
                  Temp Forecast RMSE
                </td>
                <For each={props.comparisonDetails}>
                  {(cd) => (
                    <td class="p-3 text-slate-800 dark:text-slate-200">
                      {getMetric(cd, "forecast", "forecast.temp.rmse")?.toFixed(4) ?? "-"}
                    </td>
                  )}
                </For>
              </tr>
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-medium">
                  Temp Forecast MAE
                </td>
                <For each={props.comparisonDetails}>
                  {(cd) => (
                    <td class="p-3 text-slate-800 dark:text-slate-200">
                      {getMetric(cd, "forecast", "forecast.temp.mae")?.toFixed(4) ?? "-"}
                    </td>
                  )}
                </For>
              </tr>
              <tr>
                <td class="p-3 text-slate-600 dark:text-slate-400">Fit Seconds</td>
                <For each={props.comparisonDetails}>
                  {(cd) => {
                    const sec = getMetric(cd, "pfvi", "pfvi.fit_seconds");
                    const isFastest = sec !== null && sec === comparisonFastestSec();
                    return (
                      <td
                        class={`p-3 text-slate-800 dark:text-slate-200 ${
                          isFastest
                            ? "font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30"
                            : ""
                        }`}
                      >
                        <span class="flex items-center space-x-1">
                          <span>{sec !== null ? `${sec.toFixed(2)}s` : "-"}</span>
                          <Show when={isFastest}>
                            <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700">
                              {t().runsFastestBadge}
                            </span>
                          </Show>
                        </span>
                      </td>
                    );
                  }}
                </For>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
