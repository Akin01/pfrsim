import { Component, For, Show } from "solid-js";
import { ArrowDownRight, ArrowUpRight, Equal, Minus, Repeat, Shuffle } from "lucide-solid";
import type { DatasetDetail, DatasetPreview } from "../lib/types";
import { getSeriesConfig, getSeriesTrendline } from "../utils/data";
import { InfoHelper } from "./InfoHelper";
import { MathTex } from "./MathTex";
import { TrendlineSparkline } from "./TrendlineSparkline";
import { view } from "../lib/store";

export interface DatasetStatsViewProps {
  preview: DatasetPreview | null;
  detail: DatasetDetail | null;
}

export const DatasetStatsView: Component<DatasetStatsViewProps> = (props) => {
  const seriesCfg = () => getSeriesConfig(view.lang);

  return (
    <div class="space-y-4 select-none">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <For each={["wt", "sm", "rf", "temp"] as const}>
          {(k) => {
            const cfg = seriesCfg()[k];
            const st = () => props.preview?.stats[k];
            const miss = () => props.preview?.missing[k];
            const rangeVal = () => (st() ? (st()!.max - st()!.min).toFixed(3) : "-");
            const meanPos = () => {
              if (!st() || st()!.max === st()!.min) return 50;
              return Math.max(
                5,
                Math.min(95, ((st()!.mean - st()!.min) / (st()!.max - st()!.min)) * 100),
              );
            };

            return (
              <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
                <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div class="flex items-center space-x-2.5">
                    <span class="w-3 h-3 rounded-full" style={{ "background-color": cfg.color }} />
                    <h3 class="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                      {cfg.name} · {cfg.label} ({cfg.unit})
                    </h3>
                  </div>
                  <span
                    class={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      (miss()?.count ?? 0) === 0
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {(miss()?.count ?? 0) === 0
                      ? view.lang === "id"
                        ? "Lengkap (100%)"
                        : "Complete (100%)"
                      : `${miss()?.count} ${view.lang === "id" ? "Nilai Hilang" : "Missing"}`}
                  </span>
                </div>

                {/* Visual Range Distribution Bar */}
                <div class="space-y-1.5 pt-1">
                  <div class="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>Min: {st()?.min.toFixed(2)}</span>
                    <span class="font-bold text-slate-700 dark:text-slate-300">
                      {view.lang === "id" ? "Rerata" : "Mean"}: {st()?.mean.toFixed(2)}
                    </span>
                    <span>Max: {st()?.max.toFixed(2)}</span>
                  </div>
                  <div class="relative w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      class="absolute top-0 bottom-0 rounded-full opacity-60"
                      style={{
                        left: "0%",
                        width: "100%",
                        "background-color": cfg.color,
                      }}
                    />
                    <div
                      class="absolute top-0 bottom-0 w-2 h-2 rounded-full bg-white shadow-md -ml-1 border border-slate-400"
                      style={{ left: `${meanPos()}%` }}
                    />
                  </div>
                </div>

                {/* Metrics Grid */}
                <div class="grid grid-cols-2 gap-2.5 pt-2 text-xs font-mono">
                  {/* Minimum */}
                  <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] text-slate-400 uppercase">
                        {view.lang === "id" ? "Nilai Terendah" : "Minimum"}
                      </span>
                      <InfoHelper
                        title="Minimum"
                        placement="top"
                        content={
                          view.lang === "id"
                            ? "Nilai terendah yang tercatat dalam deret waktu."
                            : "Lowest recorded value in the time series."
                        }
                      />
                    </div>
                    <strong class="text-slate-900 dark:text-slate-100 mt-0.5 block">
                      {st()?.min.toFixed(4) ?? "-"} {cfg.unit}
                    </strong>
                  </div>

                  {/* Maximum */}
                  <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] text-slate-400 uppercase">
                        {view.lang === "id" ? "Nilai Tertinggi" : "Maximum"}
                      </span>
                      <InfoHelper
                        title="Maximum"
                        placement="top"
                        content={
                          view.lang === "id"
                            ? "Nilai tertinggi yang tercatat dalam deret waktu."
                            : "Highest recorded value in the time series."
                        }
                      />
                    </div>
                    <strong class="text-slate-900 dark:text-slate-100 mt-0.5 block">
                      {st()?.max.toFixed(4) ?? "-"} {cfg.unit}
                    </strong>
                  </div>

                  {/* Mean */}
                  <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] text-slate-400 uppercase">
                        {view.lang === "id" ? "Rata-rata" : "Mean"}
                      </span>
                      <InfoHelper
                        title={view.lang === "id" ? "Rata-rata" : "Mean"}
                        placement="top"
                        content={
                          <div class="space-y-1.5 text-[11px] font-sans">
                            <p>
                              {view.lang === "id"
                                ? "Rata-rata aritmatika dari seluruh observasi valid:"
                                : "Arithmetic mean of all valid observations:"}
                            </p>
                            <div class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-center my-1">
                              <MathTex math="\bar{y} = \frac{1}{N} \sum_{i=1}^N y_i" />
                            </div>
                          </div>
                        }
                      />
                    </div>
                    <strong class="text-slate-900 dark:text-slate-100 mt-0.5 block">
                      {st()?.mean.toFixed(4) ?? "-"} {cfg.unit}
                    </strong>
                  </div>

                  {/* Range */}
                  <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] text-slate-400 uppercase">
                        {view.lang === "id" ? "Rentang Nilai" : "Range"}
                      </span>
                      <InfoHelper
                        title={view.lang === "id" ? "Rentang Nilai" : "Range"}
                        placement="top"
                        content={
                          view.lang === "id"
                            ? "Rentang sebaran absolut antara nilai maksimum dan minimum."
                            : "Absolute spread between maximum and minimum observed values."
                        }
                      />
                    </div>
                    <strong class="text-slate-900 dark:text-slate-100 mt-0.5 block">
                      {rangeVal()} {cfg.unit}
                    </strong>
                  </div>

                  {/* Std Dev */}
                  <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] text-slate-400 uppercase">
                        {view.lang === "id" ? "Deviasi Standar" : "Standard Deviation"}
                      </span>
                      <InfoHelper
                        title={
                          <span class="inline-flex items-center gap-1">
                            <span>
                              {view.lang === "id" ? "Deviasi Standar" : "Standard Deviation"}
                            </span>
                            <span>
                              (<MathTex math="\sigma" />)
                            </span>
                          </span>
                        }
                        placement="top"
                        content={
                          <div class="space-y-1.5 text-[11px] font-sans">
                            <p>
                              {view.lang === "id"
                                ? "Ukuran dispersi atau variabilitas data:"
                                : "Measure of data dispersion or variability:"}
                            </p>
                            <div class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-center my-1">
                              <MathTex math="\sigma = \sqrt{\frac{1}{N-1} \sum (y_i - \bar{y})^2}" />
                            </div>
                          </div>
                        }
                      />
                    </div>
                    <strong class="text-slate-900 dark:text-slate-100 mt-0.5 block">
                      {st()?.std != null ? `${st()!.std!.toFixed(4)} ${cfg.unit}` : "-"}
                    </strong>
                  </div>

                  {/* ACF(1) */}
                  <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] text-slate-400 uppercase">
                        {view.lang === "id" ? "Autokorelasi Lag-1" : "ACF(1)"}
                      </span>
                      <InfoHelper
                        title={<MathTex math="\text{ACF}(1)" />}
                        placement="top"
                        content={
                          <div class="space-y-1.5 text-[11px] font-sans">
                            <p>
                              {view.lang === "id"
                                ? "Korelasi antar langkah berturutan:"
                                : "Correlation between consecutive time steps:"}
                            </p>
                            <div class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-center my-1">
                              <MathTex math="r_1 \in [-1, 1]" />
                            </div>
                          </div>
                        }
                      />
                    </div>
                    <strong class="text-slate-900 dark:text-slate-100 mt-0.5 block">
                      {st()?.acf1 != null ? st()!.acf1!.toFixed(3) : "-"}
                    </strong>
                  </div>

                  {/* Trend */}
                  <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] text-slate-400 uppercase">
                        {view.lang === "id" ? "Arah Tren" : "Trend"}
                      </span>
                      <InfoHelper
                        title={
                          view.lang === "id"
                            ? "Arah Tren (Dekomposisi STL)"
                            : "Trend Direction (STL Decomposition)"
                        }
                        placement="top"
                        content={
                          view.lang === "id"
                            ? "Garis tren moving-average terpusat dari dekomposisi STL. Menunjukkan lintasan umum deret (Naik, Turun, atau Datar)."
                            : "Centered moving-average trendline from STL decomposition. Shows the general trajectory (Rising, Falling, or Flat)."
                        }
                      />
                    </div>
                    <div class="flex items-center justify-between mt-1 gap-2">
                      <strong class="text-slate-900 dark:text-slate-100 flex items-center gap-1 text-xs font-mono">
                        <Show
                          when={st()?.trend != null}
                          fallback={<span class="text-slate-400">-</span>}
                        >
                          {(() => {
                            const dir = st()!.trend!.direction;
                            const isRising = dir === "rising";
                            const isFalling = dir === "falling";
                            return (
                              <span class="flex items-center gap-1">
                                <span
                                  class={`w-4 h-4 rounded-md flex items-center justify-center ${
                                    isRising
                                      ? "bg-emerald-500/15 text-emerald-500"
                                      : isFalling
                                        ? "bg-rose-500/15 text-rose-500"
                                        : "bg-slate-500/15 text-slate-400"
                                  }`}
                                >
                                  <Show
                                    when={isRising}
                                    fallback={
                                      <Show when={isFalling} fallback={<Minus size={10} />}>
                                        <ArrowDownRight size={10} />
                                      </Show>
                                    }
                                  >
                                    <ArrowUpRight size={10} />
                                  </Show>
                                </span>
                                <span class="text-[11px]">
                                  {view.lang === "id"
                                    ? isRising
                                      ? "Naik"
                                      : isFalling
                                        ? "Turun"
                                        : "Datar"
                                    : isRising
                                      ? "Rising"
                                      : isFalling
                                        ? "Falling"
                                        : "Flat"}
                                </span>
                              </span>
                            );
                          })()}
                        </Show>
                      </strong>
                      {/* TradingView-style mini trendline sparkline from STL decompose */}
                      <div class="pl-1.5 border-l border-slate-200/80 dark:border-slate-800/80 flex items-center">
                        <TrendlineSparkline
                          data={getSeriesTrendline(k, props.preview, props.detail)}
                          width={66}
                          height={22}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seasonality */}
                  <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] text-slate-400 uppercase">
                        {view.lang === "id" ? "Pola Musiman" : "Seasonality"}
                      </span>
                      <InfoHelper
                        title={view.lang === "id" ? "Deteksi Musiman" : "Seasonality Detection"}
                        placement="top"
                        content={
                          view.lang === "id"
                            ? "Mengidentifikasi keberadaan siklus berulang konsisten berdasarkan puncak autokorelasi."
                            : "Identifies repeating periodic cycles based on autocorrelation peaks."
                        }
                      />
                    </div>
                    <strong class="text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
                      <Show
                        when={st()?.seasonality != null}
                        fallback={<span class="text-slate-400">-</span>}
                      >
                        {(() => {
                          const s = st()!.seasonality!;
                          return (
                            <span class="flex items-center gap-1.5">
                              <span
                                class={`w-5 h-5 rounded-lg flex items-center justify-center ${
                                  s.seasonal
                                    ? "bg-indigo-500/15 text-indigo-500"
                                    : "bg-slate-500/15 text-slate-400"
                                }`}
                              >
                                {s.seasonal ? <Repeat size={12} /> : <Shuffle size={12} />}
                              </span>
                              <span>
                                {s.seasonal
                                  ? view.lang === "id"
                                    ? `Ya (Periode ${s.period})`
                                    : `Yes (Period ${s.period})`
                                  : view.lang === "id"
                                    ? "Tidak Ada"
                                    : "None"}
                              </span>
                            </span>
                          );
                        })()}
                      </Show>
                    </strong>
                  </div>

                  {/* Stationarity */}
                  <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] text-slate-400 uppercase">
                        {view.lang === "id" ? "Uji Stasioner" : "Stationarity"}
                      </span>
                      <InfoHelper
                        title={view.lang === "id" ? "Uji Stasioneritas" : "Stationarity Test"}
                        placement="top"
                        content={
                          view.lang === "id"
                            ? "Mengevaluasi stabilitas rata-rata dan rasio variansi antar paruh waktu data."
                            : "Evaluates stability of split-half means and variance ratios across the series."
                        }
                      />
                    </div>
                    <strong class="text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
                      <Show
                        when={st()?.stationarity != null}
                        fallback={<span class="text-slate-400">-</span>}
                      >
                        {(() => {
                          const s = st()!.stationarity!;
                          return (
                            <span class="flex items-center gap-1.5">
                              <span
                                class={`w-5 h-5 rounded-lg flex items-center justify-center ${
                                  s.stationary
                                    ? "bg-emerald-500/15 text-emerald-500"
                                    : "bg-amber-500/15 text-amber-500"
                                }`}
                                title={`mean_shift=${s.mean_shift.toFixed(2)}σ · var_ratio=${isFinite(s.var_ratio) ? s.var_ratio.toFixed(2) : "∞"}`}
                              >
                                <Equal size={12} />
                              </span>
                              <span>
                                {s.stationary
                                  ? view.lang === "id"
                                    ? "Stasioner"
                                    : "Stationary"
                                  : view.lang === "id"
                                    ? "Tidak stasioner"
                                    : "Non-stationary"}
                              </span>
                            </span>
                          );
                        })()}
                      </Show>
                    </strong>
                  </div>
                </div>

                <p class="text-[11px] text-slate-500 dark:text-slate-400 italic">
                  {cfg.description}
                </p>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};
