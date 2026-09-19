import { Component, createMemo, For, Show } from "solid-js";
import { Info, RefreshCw } from "lucide-solid";
import type { DatasetPreview, StlDecompositionView } from "../lib/types";
import { getSeriesConfig, type SeriesKey } from "../utils/data";
import { MathTex } from "./MathTex";
import { InfoHelper } from "./InfoHelper";
import { UPlotChart } from "./UPlotChart";
import { TrendlineSparkline } from "./TrendlineSparkline";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export interface DatasetDecompViewProps {
  selectedId: string | null;
  preview: DatasetPreview | null;
  stlSeries: SeriesKey;
  onStlSeriesChange: (s: SeriesKey) => void;
  stlMethod: "stl" | "trend";
  onStlMethodChange: (m: "stl" | "trend") => void;
  stlPeriod: number;
  onStlPeriodChange: (p: number) => void;
  stlView: StlDecompositionView | null;
  stlLoading: boolean;
  stlError: string | null;
  onOpenStlMethodModal: () => void;
  onReloadDecomp: (
    datasetId: string,
    series: SeriesKey,
    period?: number,
    method?: "stl" | "trend",
  ) => void;
}

export const DatasetDecompView: Component<DatasetDecompViewProps> = (props) => {
  const t = () => catalogs[view.lang];
  const seriesCfg = () => getSeriesConfig(view.lang);

  return (
    <div class="space-y-4 select-none">
      <div class="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        {/* Left: Title + Helper + Series Selector */}
        <div class="flex flex-wrap items-center gap-3">
          <div>
            <h3 class="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <span>{t().dataTabDecomp}</span>
              <button
                type="button"
                onClick={props.onOpenStlMethodModal}
                class="inline-flex items-center text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
                title={t().dataStlOpenGuideTooltip}
              >
                <Info size={14} />
              </button>
            </h3>
          </div>
          {/* Series Pills */}
          <div class="flex items-center gap-1 bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <For each={["wt", "sm", "rf", "temp"] as const}>
              {(k) => {
                const cfg = seriesCfg()[k];
                const active = () => props.stlSeries === k;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      props.onStlSeriesChange(k);
                      if (props.selectedId) {
                        props.onReloadDecomp(props.selectedId, k);
                      }
                    }}
                    class={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      active()
                        ? "text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                    style={active() ? { "background-color": cfg.color } : {}}
                  >
                    {cfg.name}
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        {/* Right: Anofox Controls (Method, Period input) */}
        <div class="flex flex-wrap items-center gap-3 text-xs font-mono">
          {/* Method Selector */}
          <div class="flex items-center space-x-1.5">
            <span class="text-slate-400 text-[11px]">{t().dataStlMethodLabel}</span>
            <div class="flex items-center bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  props.onStlMethodChange("stl");
                  if (props.selectedId) {
                    props.onReloadDecomp(props.selectedId, props.stlSeries, props.stlPeriod, "stl");
                  }
                }}
                class={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  props.stlMethod === "stl"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                STL
              </button>
              <button
                type="button"
                onClick={() => {
                  props.onStlMethodChange("trend");
                  if (props.selectedId) {
                    props.onReloadDecomp(
                      props.selectedId,
                      props.stlSeries,
                      props.stlPeriod,
                      "trend",
                    );
                  }
                }}
                class={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  props.stlMethod === "trend"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t().dataStlTrend}
              </button>
            </div>
          </div>

          {/* Period Override */}
          <Show when={props.stlMethod === "stl"}>
            <div class="flex items-center space-x-1.5">
              <span class="text-slate-400 text-[11px]">{t().dataStlPeriodLabel}</span>
              <div class="flex items-center space-x-1 bg-white dark:bg-slate-950 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-800">
                <input
                  type="number"
                  min="2"
                  max="365"
                  value={props.stlPeriod}
                  onChange={(e) => {
                    const val = Math.max(2, parseInt(e.currentTarget.value) || 12);
                    props.onStlPeriodChange(val);
                    if (props.selectedId) {
                      props.onReloadDecomp(props.selectedId, props.stlSeries, val, props.stlMethod);
                    }
                  }}
                  class="w-12 bg-transparent text-center font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const detected = props.preview?.stats[props.stlSeries]?.seasonality?.period ?? 12;
                  props.onStlPeriodChange(detected);
                  if (props.selectedId) {
                    props.onReloadDecomp(
                      props.selectedId,
                      props.stlSeries,
                      detected,
                      props.stlMethod,
                    );
                  }
                }}
                class="px-2 py-1 rounded-lg text-[10px] text-slate-400 hover:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={t().dataStlAutoTooltip}
              >
                Auto
              </button>
            </div>
          </Show>
        </div>
      </div>

      {/* Anofox Metric Strip */}
      <Show when={props.stlView != null}>
        <div
          class={`flex flex-wrap items-center gap-2.5 select-none transition-opacity duration-200 ${props.stlLoading ? "opacity-75" : "opacity-100"}`}
        >
          <div class="px-4 py-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center space-x-3">
            <div>
              <div class="flex items-center space-x-1">
                <span class="text-[9px] uppercase font-mono font-bold text-slate-400">
                  {t().dataTrendStrength}
                </span>
                <InfoHelper
                  title={
                    <span class="inline-flex items-center gap-1">
                      <span>{t().dataTrendStrength}</span>
                      <span>
                        (<MathTex math="F_T" />)
                      </span>
                    </span>
                  }
                  placement="bottom"
                  content={
                    <div class="space-y-1.5 font-sans text-[11px]">
                      <p>
                        {view.lang === "id"
                          ? "Mengukur dominasi komponen tren terhadap variansi residu (Wang et al., 2006):"
                          : "Measures trend component dominance over residual variance (Wang et al., 2006):"}
                      </p>
                      <div class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-center my-1">
                        <MathTex math="F_T = \max\left(0, 1 - \frac{\text{Var}(R)}{\text{Var}(T + R)}\right)" />
                      </div>
                      <p class="text-slate-400">
                        {view.lang === "id"
                          ? "Nilai mendekati 1.00 menandakan tren deterministik kuat."
                          : "Values near 1.00 indicate a strong deterministic trend."}
                      </p>
                    </div>
                  }
                />
              </div>
              <span class="text-sm font-mono font-bold text-amber-500">
                {props.stlView!.trend_strength.toFixed(3)}
              </span>
            </div>
            <div class="pl-2 border-l border-slate-200/80 dark:border-slate-800/80 flex items-center">
              <TrendlineSparkline data={props.stlView!.trend} width={76} height={24} />
            </div>
          </div>

          {/* Seasonal Strength */}
          <div class="px-4 py-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div class="flex items-center space-x-1">
              <span class="text-[9px] uppercase font-mono font-bold text-slate-400">
                {t().dataSeasonalStrength}
              </span>
              <InfoHelper
                title={
                  <span class="inline-flex items-center gap-1">
                    <span>{t().dataSeasonalStrength}</span>
                    <span>
                      (<MathTex math="F_S" />)
                    </span>
                  </span>
                }
                placement="bottom"
                content={
                  <div class="space-y-1.5 font-sans text-[11px]">
                    <p>
                      {view.lang === "id"
                        ? "Mengukur kontribusi osilasi musiman terhadap variansi residu (Wang et al., 2006):"
                        : "Measures seasonal oscillation contribution over residual variance (Wang et al., 2006):"}
                    </p>
                    <div class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-center my-1">
                      <MathTex math="F_S = \max\left(0, 1 - \frac{\text{Var}(R)}{\text{Var}(S + R)}\right)" />
                    </div>
                    <p class="text-slate-400 flex items-center gap-1 flex-wrap">
                      <span>{view.lang === "id" ? "Nilai" : "Values"}</span>
                      <MathTex math="F_S \ge 0.50" />
                      <span>
                        {view.lang === "id"
                          ? "menandakan musiman yang signifikan."
                          : "indicate significant seasonality."}
                      </span>
                    </p>
                  </div>
                }
              />
            </div>
            <span
              class={`text-sm font-mono font-bold ${
                props.stlView!.seasonal_strength >= 0.5 ? "text-emerald-500" : "text-slate-400"
              }`}
            >
              {props.stlView!.seasonal_strength.toFixed(3)}
            </span>
          </div>

          {/* Type / Method */}
          <div class="px-4 py-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div class="flex items-center space-x-1">
              <span class="text-[9px] uppercase font-mono font-bold text-slate-400">
                {view.lang === "id" ? "Tipe Model" : "Type"}
              </span>
              <InfoHelper
                title={view.lang === "id" ? "Model Dekomposisi" : "Decomposition Model"}
                placement="bottom"
                content={
                  <div class="space-y-1.5 font-sans text-[11px]">
                    <p class="flex items-center gap-1 flex-wrap">
                      <strong class="text-slate-200">Additive:</strong>
                      <MathTex math="y_t = T_t + S_t + R_t" />
                    </p>
                    <p class="flex items-center gap-1 flex-wrap">
                      <strong class="text-slate-200">Trend-Only:</strong>
                      <MathTex math="y_t = T_t + R_t" />
                    </p>
                  </div>
                }
              />
            </div>
            <span class="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
              {props.stlMethod === "trend"
                ? view.lang === "id"
                  ? "Hanya Tren"
                  : "Trend-Only"
                : view.lang === "id"
                  ? "Aditif"
                  : "Additive"}
            </span>
          </div>

          {/* Period */}
          <div class="px-4 py-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div class="flex items-center space-x-1">
              <span class="text-[9px] uppercase font-mono font-bold text-slate-400">
                {view.lang === "id" ? "Periode" : "Period"}
              </span>
              <InfoHelper
                title={
                  <span class="inline-flex items-center gap-1">
                    <span>{view.lang === "id" ? "Periode Siklus" : "Cycle Period"}</span>
                    <span>
                      (<MathTex math="p" />)
                    </span>
                  </span>
                }
                placement="bottom"
                content={
                  <p class="text-[11px] leading-relaxed">
                    {view.lang === "id"
                      ? "Jumlah baris data dalam satu siklus berulang lengkap (contoh: p = 12 untuk tahunan/bulanan, p = 7 untuk mingguan)."
                      : "Number of data rows per full repeating cycle (e.g. p = 12 for annual/monthly, p = 7 for weekly)."}
                  </p>
                }
              />
            </div>
            <span class="text-sm font-mono font-bold text-indigo-400">{props.stlView!.period}</span>
          </div>
        </div>
      </Show>

      <Show
        when={props.stlView != null}
        fallback={
          <Show
            when={props.stlLoading}
            fallback={
              <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                <div class="text-center space-y-1.5 py-1">
                  <p class="text-sm font-bold font-mono text-slate-700 dark:text-slate-300">
                    {view.lang === "id"
                      ? "Belum ada dekomposisi musiman yang terdeteksi"
                      : "No seasonal decomposition detected"}
                  </p>
                  <p class="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                    {props.stlError ??
                      (view.lang === "id"
                        ? "Seluruh variabel pada dataset ini belum memenuhi kriteria gelombang musiman (kekuatan autokorelasi ≥ 0.50 dan minimal 2 siklus penuh)."
                        : "None of the variables in this dataset met the seasonal cycle criteria (autocorrelation strength ≥ 0.50 and at least 2 full cycles).")}
                  </p>
                </div>

                {/* Explanatory banner */}
                <div class="p-3.5 bg-slate-100/90 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl text-xs space-y-1">
                  <div class="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                    <span>
                      {view.lang === "id"
                        ? "Kriteria Validasi Musiman (STL Gate)"
                        : "Seasonal Validation Criteria (STL Gate)"}
                    </span>
                  </div>
                  <p class="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                    {view.lang === "id"
                      ? "Metode STL memerlukan pola musiman yang terbukti secara statistik. Jika autokorelasi rendah atau deret terlalu pendek, sistem beralih ke mode tren atau mempertahankan deret asli."
                      : "The STL method requires statistically proven seasonal patterns. If autocorrelation is weak or the series is too short, the system defaults to trend-only mode or keeps the original series."}
                  </p>
                </div>

                {/* 4 Diagnostic Variable Summary Cards */}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <For each={["wt", "sm", "rf", "temp"] as const}>
                    {(k) => {
                      const c = seriesCfg()[k];
                      const st = () => props.preview?.stats[k];
                      const seas = () => st()?.seasonality;
                      const hasPeriod = () => seas()?.period != null;
                      const cyclePassed = () => seas()?.seasonal === true;

                      return (
                        <div class="p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 rounded-xl space-y-1.5">
                          <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-2">
                              <span
                                class="w-2.5 h-2.5 rounded-full"
                                style={{ "background-color": c.color }}
                              />
                              <span class="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                                {c.name} · {c.label}
                              </span>
                            </div>
                            <span
                              class={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                                cyclePassed()
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                  : "bg-slate-200/60 dark:bg-slate-800/60 border-slate-300/60 dark:border-slate-700/60 text-slate-500"
                              }`}
                            >
                              {cyclePassed()
                                ? view.lang === "id"
                                  ? "Lolos STL"
                                  : "STL Eligible"
                                : view.lang === "id"
                                  ? "Non-Musiman"
                                  : "Non-Seasonal"}
                            </span>
                          </div>

                          <div class="flex items-center justify-between text-[11px] font-mono text-slate-500">
                            <span>
                              {view.lang === "id" ? "Periode Terdeteksi:" : "Detected Period:"}
                            </span>
                            <span class="font-bold text-slate-700 dark:text-slate-300">
                              {hasPeriod()
                                ? `${seas()!.period} ${view.lang === "id" ? "titik" : "steps"}`
                                : "—"}
                            </span>
                          </div>

                          <div class="flex items-center justify-between text-[11px] font-mono text-slate-500">
                            <span>
                              {view.lang === "id"
                                ? "Autokorelasi Puncak:"
                                : "Peak Autocorrelation:"}
                            </span>
                            <span class="font-bold text-slate-700 dark:text-slate-300">
                              {seas()?.strength != null ? seas()!.strength.toFixed(3) : "—"}
                            </span>
                          </div>

                          <p class="text-[10px] text-slate-400 pt-0.5 border-t border-slate-200/60 dark:border-slate-800/60">
                            {cyclePassed()
                              ? view.lang === "id"
                                ? `Pola siklus berulang terverifikasi kuat.`
                                : `Verified repeating cyclical pattern.`
                              : view.lang === "id"
                                ? `Fluktuasi acak tanpa pengulangan periodik yang kuat.`
                                : `Random fluctuations without strong periodic repetition.`}
                          </p>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>
            }
          >
            <div class="p-12 text-center bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-xs">
              <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
                <RefreshCw size={24} class="animate-spin" />
              </div>
              <div class="space-y-1">
                <h4 class="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  {view.lang === "id"
                    ? "Menghitung Dekomposisi Deret Waktu..."
                    : "Calculating Time Series Decomposition..."}
                </h4>
                <p class="text-xs font-mono text-slate-400 max-w-md mx-auto">
                  {view.lang === "id"
                    ? "Mengekstraksi komponen tren, musiman, dan residu menggunakan regresi lokal LOESS..."
                    : "Extracting trend, seasonal, and remainder components using local LOESS smoothing..."}
                </p>
              </div>
            </div>
          </Show>
        }
      >
        {(() => {
          const cfg = seriesCfg()[props.stlSeries];
          const v = () => props.stlView!;
          const isDark = view.theme === "dark";
          const n = () => v().observed.length;
          const x = createMemo(() => Array.from({ length: n() }, (_, i) => i + 1));

          const tiers = createMemo(() => [
            {
              id: "observed",
              name: view.lang === "id" ? "Observasi" : "Observed",
              values: v().observed,
              stroke: cfg.stroke,
              fill: isDark ? `${cfg.color}18` : `${cfg.color}0a`,
              unit: cfg.unit,
            },
            {
              id: "trend",
              name: view.lang === "id" ? "Tren" : "Trend",
              values: v().trend,
              stroke: "#f59e0b",
              fill: isDark ? "#f59e0b14" : "#f59e0b0a",
              unit: cfg.unit,
            },
            ...(props.stlMethod === "trend"
              ? []
              : [
                  {
                    id: "seasonal",
                    name: view.lang === "id" ? "Musiman" : "Seasonal",
                    values: v().seasonal,
                    stroke: "#8b5cf6",
                    fill: isDark ? "#8b5cf614" : "#8b5cf60a",
                    unit: cfg.unit,
                  },
                ]),
            {
              id: "remainder",
              name: view.lang === "id" ? "Residu" : "Residual",
              values: v().remainder,
              stroke: "#64748b",
              fill: isDark ? "#64748b18" : "#64748b0a",
              unit: cfg.unit,
            },
          ]);

          return (
            <div
              class={`bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-xs transition-opacity duration-200 ${props.stlLoading ? "opacity-75" : "opacity-100"}`}
            >
              <div class="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
                <div class="flex items-center space-x-2.5">
                  <span class="w-3 h-3 rounded-full" style={{ "background-color": cfg.color }} />
                  <h4 class="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    {props.stlMethod === "trend"
                      ? view.lang === "id"
                        ? "Dekomposisi Tren"
                        : "Trend Decomposition"
                      : view.lang === "id"
                        ? "Dekomposisi STL"
                        : "STL Decomposition"}{" "}
                  </h4>
                </div>
                <div class="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                  <MathTex
                    math={props.stlMethod === "trend" ? "y_t = T_t + R_t" : "y_t = T_t + S_t + R_t"}
                  />
                  <span>· N = {n()}</span>
                </div>
              </div>

              {/* 4 Stacked Tiers with syncKey */}
              <div class="space-y-3">
                <For each={tiers()}>
                  {(tier) => (
                    <div class="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 space-y-1">
                      <div class="flex items-center justify-between px-1">
                        <div class="flex items-center space-x-2">
                          <span
                            class="w-2 h-2 rounded-full"
                            style={{ "background-color": tier.stroke }}
                          />
                          <span class="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                            {tier.name}
                          </span>
                        </div>
                        <span class="text-[10px] font-mono text-slate-400">{tier.unit}</span>
                      </div>
                      <div class="w-full min-h-30">
                        <UPlotChart
                          data={[x(), tier.values] as [number[], (number | null)[]]}
                          series={[
                            {
                              label: `${tier.name} (${tier.unit})`,
                              stroke: tier.stroke,
                              fill: tier.fill,
                              width: 1.8,
                              unit: tier.unit,
                            },
                          ]}
                          height={120}
                          syncKey="stl-anofox-sync"
                        />
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          );
        })()}
      </Show>
    </div>
  );
};
