import { Component, For, Show } from "solid-js";
import { Activity, RefreshCw } from "lucide-solid";
import type { AutocorrelationView, DatasetPreview } from "../lib/types";
import { getSeriesConfig, type SeriesKey } from "../utils/data";
import { MathTex } from "./MathTex";
import { InfoHelper } from "./InfoHelper";
import { view } from "../lib/store";

export interface DatasetAcfViewProps {
  selectedId: string | null;
  preview: DatasetPreview | null;
  acfSeries: SeriesKey;
  onAcfSeriesChange: (s: SeriesKey) => void;
  acfMaxLag: number;
  onAcfMaxLagChange: (l: number) => void;
  acfData: AutocorrelationView | null;
  acfLoading: boolean;
  acfHover: { lag: number; val: number; type: "acf" | "pacf" } | null;
  setAcfHover: (h: { lag: number; val: number; type: "acf" | "pacf" } | null) => void;
  onLoadAutocorrelation: (id: string, series: SeriesKey, maxLag?: number) => void;
}

export const DatasetAcfView: Component<DatasetAcfViewProps> = (props) => {
  const seriesCfg = () => getSeriesConfig(view.lang);

  return (
    <div class="space-y-4 select-none">
      {/* 1. Anofox Top Control Bar (Variable selector + Max Lag slider) */}
      <div class="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        {/* Left: Title + Series Selector Pills */}
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center space-x-2">
            <div class="w-7 h-7 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500">
              <Activity size={15} />
            </div>
            <h3 class="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              {view.lang === "id" ? "Autokorelasi ACF dan PACF" : "Autocorrelation ACF and PACF"}
            </h3>
          </div>
          {/* Series Pills */}
          <div class="flex items-center gap-1 bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <For each={["wt", "sm", "rf", "temp"] as const}>
              {(k) => {
                const cfg = seriesCfg()[k];
                const active = () => props.acfSeries === k;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      props.onAcfSeriesChange(k);
                      if (props.selectedId) {
                        props.onLoadAutocorrelation(props.selectedId, k, props.acfMaxLag);
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

        {/* Right: Max Lag Slider */}
        <div class="flex items-center space-x-3 text-xs font-mono">
          <span class="text-slate-400 text-[11px] whitespace-nowrap">
            {view.lang === "id" ? "Maks Lag:" : "Max Lag:"}{" "}
            <strong class="text-slate-900 dark:text-slate-100 font-bold">{props.acfMaxLag}</strong>
          </span>
          <input
            type="range"
            min="5"
            max="60"
            value={props.acfMaxLag}
            onInput={(e) => {
              const val = parseInt(e.currentTarget.value) || 39;
              props.onAcfMaxLagChange(val);
              if (props.selectedId) {
                props.onLoadAutocorrelation(props.selectedId, props.acfSeries, val);
              }
            }}
            class="w-32 sm:w-44 accent-cyan-500 cursor-pointer focus:outline-none focus:ring-0 focus-visible:outline-none select-none"
          />
        </div>
      </div>

      {/* 2. Anofox Metric Strip */}
      <Show when={props.acfData != null}>
        {(() => {
          const d = () => props.acfData!;
          const st = () => props.preview?.stats[props.acfSeries];
          const sigCount = () =>
            d()
              .acf.slice(1)
              .filter((v) => Math.abs(v) > d().confidence_band).length;
          const period = () => st()?.seasonality?.period;

          return (
            <div
              class={`flex flex-wrap items-center gap-2.5 select-none transition-opacity duration-200 ${props.acfLoading ? "opacity-75" : "opacity-100"}`}
            >
              <div class="px-4 py-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div class="flex items-center space-x-1">
                  <span class="text-[9px] uppercase font-mono font-bold text-slate-400">
                    {view.lang === "id" ? "Pola Tren" : "Pattern"}
                  </span>
                  <InfoHelper
                    title={view.lang === "id" ? "Arah Pola Tren (OLS)" : "Pattern Direction (OLS)"}
                    placement="bottom"
                    content={
                      view.lang === "id"
                        ? "Kecenderungan pergerakan umum data berdasarkan kemiringan regresi linier OLS (Rising, Falling, atau Monotone/Flat)."
                        : "General trajectory of the series based on OLS linear regression slope (Rising, Falling, or Monotone/Flat)."
                    }
                  />
                </div>
                <span class="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
                  {st()?.trend?.direction === "rising"
                    ? view.lang === "id"
                      ? "Naik"
                      : "Rising"
                    : st()?.trend?.direction === "falling"
                      ? view.lang === "id"
                        ? "Turun"
                        : "Falling"
                      : view.lang === "id"
                        ? "Monoton"
                        : "Monotone"}
                </span>
              </div>

              {/* Seasonal Period */}
              <div class="px-4 py-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div class="flex items-center space-x-1">
                  <span class="text-[9px] uppercase font-mono font-bold text-slate-400">
                    {view.lang === "id" ? "Periode Musiman" : "Seasonal Period"}
                  </span>
                  <InfoHelper
                    title={
                      <span class="inline-flex items-center gap-1">
                        <span>{view.lang === "id" ? "Periode Musiman" : "Seasonal Period"}</span>
                        <span>
                          (<MathTex math="p" />)
                        </span>
                      </span>
                    }
                    placement="bottom"
                    content={
                      <p class="text-[11px] leading-relaxed">
                        {view.lang === "id"
                          ? "Panjang lag kelambatan pada puncak lokal autokorelasi yang lolos uji gerbang musiman. Bernilai 'None' jika tidak ada siklus berulang yang signifikan."
                          : "Autocorrelation lag of the local peak passing seasonality criteria. 'None' if no repeating cycle exists."}
                      </p>
                    }
                  />
                </div>
                <span
                  class={`text-sm font-mono font-bold ${period() ? "text-emerald-500" : "text-slate-400"}`}
                >
                  {period() ? `p = ${period()}` : view.lang === "id" ? "Tidak Ada" : "None"}
                </span>
              </div>

              {/* First Lag (r1) */}
              <div class="px-4 py-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div class="flex items-center space-x-1">
                  <span class="text-[9px] uppercase font-mono font-bold text-slate-400">
                    {view.lang === "id" ? "Lag Pertama (r₁)" : "First Lag (r₁)"}
                  </span>
                  <InfoHelper
                    title={
                      <span class="inline-flex items-center gap-1">
                        <span>
                          {view.lang === "id" ? "Autokorelasi Lag-1" : "Lag-1 Autocorrelation"}
                        </span>
                        <span>
                          (<MathTex math="r_1" />)
                        </span>
                      </span>
                    }
                    placement="bottom"
                    content={
                      <div class="space-y-1.5 text-[11px] font-sans">
                        <p>
                          {view.lang === "id"
                            ? "Korelasi titik data dengan titik tepat sebelumnya (t-1):"
                            : "Correlation between data point and immediately preceding point (t-1):"}
                        </p>
                        <div class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-center my-1">
                          <MathTex math="r_1 = \frac{\sum (y_t - \bar{y})(y_{t-1} - \bar{y})}{\sum (y_t - \bar{y})^2}" />
                        </div>
                        <p class="text-slate-400">
                          {view.lang === "id"
                            ? "Nilai mendekati 1.00 menandakan persistensi tinggi (proses AR(1))."
                            : "Values near 1.00 indicate strong persistence (AR(1) process)."}
                        </p>
                      </div>
                    }
                  />
                </div>
                <span class="text-sm font-mono font-bold text-cyan-500">
                  {d().acf[1] !== undefined ? d().acf[1].toFixed(3) : "-"}
                </span>
              </div>

              {/* 95% Confidence Band */}
              <div class="px-4 py-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div class="flex items-center space-x-1">
                  <span class="text-[9px] uppercase font-mono font-bold text-slate-400">
                    {view.lang === "id" ? "Batas Kepercayaan 95%" : "95% Confidence Band"}
                  </span>
                  <InfoHelper
                    title={
                      <span class="inline-flex items-center gap-1">
                        <span>
                          {view.lang === "id" ? "Interval Kepercayaan 95%" : "95% Confidence Band"}
                        </span>
                        <span>
                          (<MathTex math="\pm \frac{1.96}{\sqrt{N}}" />)
                        </span>
                      </span>
                    }
                    placement="bottom"
                    content={
                      <div class="space-y-1.5 text-[11px] font-sans">
                        <p>
                          {view.lang === "id"
                            ? "Batas signifikansi Bartlett untuk derau putih:"
                            : "Bartlett white-noise significance boundary:"}
                        </p>
                        <div class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-center my-1">
                          <MathTex math="\text{CI}_{95\%} = \pm \frac{1.96}{\sqrt{N}}" />
                        </div>
                        <p class="text-slate-400 flex items-center gap-1 flex-wrap">
                          <span>
                            {view.lang === "id"
                              ? "Batang di luar batas"
                              : "Bars beyond boundary are"}
                          </span>
                          <MathTex math="p < 0.05" />
                          <span>
                            {view.lang === "id"
                              ? "dianggap signifikan."
                              : "considered significant."}
                          </span>
                        </p>
                      </div>
                    }
                  />
                </div>
                <span class="text-sm font-mono font-bold text-rose-400">
                  ±{d().confidence_band.toFixed(3)}
                </span>
              </div>

              {/* Significant Lags */}
              <div class="px-4 py-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <div class="flex items-center space-x-1">
                  <span class="text-[9px] uppercase font-mono font-bold text-slate-400">
                    {view.lang === "id" ? "Lag Signifikan" : "Significant Lags"}
                  </span>
                  <InfoHelper
                    title={view.lang === "id" ? "Jumlah Lag Signifikan" : "Significant Lags Count"}
                    placement="bottom"
                    content={
                      <p class="text-[11px] leading-relaxed flex items-center gap-1 flex-wrap font-sans">
                        <span>
                          {view.lang === "id" ? "Jumlah lag di mana" : "Number of lags where"}
                        </span>
                        <MathTex math="|r_k| > \frac{1.96}{\sqrt{N}}" />
                        <span>
                          {view.lang === "id"
                            ? "melebihi batas derau putih."
                            : "exceeds the white-noise bound."}
                        </span>
                      </p>
                    }
                  />
                </div>
                <span class="text-sm font-mono font-bold text-amber-500">
                  {sigCount()} {view.lang === "id" ? "dari" : "of"} {d().max_lag}
                </span>
              </div>
            </div>
          );
        })()}
      </Show>

      {/* 3. Side-by-Side ACF & PACF Plots */}
      <Show
        when={props.acfData != null}
        fallback={
          <Show when={props.acfLoading}>
            <div class="p-12 text-center bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-xs">
              <div class="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-cyan-500">
                <RefreshCw size={24} class="animate-spin" />
              </div>
              <div class="space-y-1">
                <h4 class="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  {view.lang === "id"
                    ? "Menghitung Autokorelasi & PACF..."
                    : "Computing Autocorrelation & PACF..."}
                </h4>
                <p class="text-xs font-mono text-slate-400 max-w-md mx-auto">
                  {view.lang === "id"
                    ? "Mengevaluasi korelasi lag temporal dan batas signifikansi Bartlett 95% via Durbin-Levinson..."
                    : "Evaluating temporal lag correlation and 95% Bartlett confidence limits via Durbin-Levinson..."}
                </p>
              </div>
            </div>
          </Show>
        }
      >
        {(() => {
          const d = () => props.acfData!;
          const maxLag = () => d().max_lag;
          const conf = () => d().confidence_band;

          // SVG Geometry Constants
          const svgW = 560;
          const svgH = 260;
          const padL = 36;
          const padR = 14;
          const padT = 18;
          const padB = 28;
          const plotW = svgW - padL - padR;
          const plotH = svgH - padT - padB;
          const midY = padT + plotH / 2;
          const scaleY = plotH / 2;

          const posConfY = midY - conf() * scaleY;
          const negConfY = midY + conf() * scaleY;

          const slotW = () => plotW / (maxLag() + 1);
          const barW = () => Math.max(3, slotW() * 0.68);

          return (
            <div
              class={`space-y-4 transition-opacity duration-200 ${props.acfLoading ? "opacity-75" : "opacity-100"}`}
            >
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3 shadow-xs">
                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                    <h4 class="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      {view.lang === "id"
                        ? "Fungsi Autokorelasi (ACF)"
                        : "Autocorrelation Function (ACF)"}
                    </h4>
                    <span class="text-[10px] font-mono text-rose-500 dark:text-rose-400 border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 rounded-full">
                      95% CI (±{conf().toFixed(3)})
                    </span>
                  </div>

                  {/* Hover readout strip */}
                  <div class="h-5 flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
                    <Show
                      when={props.acfHover}
                      fallback={
                        <span>
                          {view.lang === "id"
                            ? "Arahkan kursor ke batang lag untuk melihat nilai"
                            : "Hover over any lag bar for exact values"}
                        </span>
                      }
                    >
                      <span class="text-cyan-500 font-bold">
                        Lag {props.acfHover!.lag}: r = {props.acfHover!.val.toFixed(3)}
                      </span>
                      <span
                        class={
                          Math.abs(props.acfHover!.val) > conf()
                            ? "text-emerald-500 font-bold"
                            : "text-slate-400"
                        }
                      >
                        {Math.abs(props.acfHover!.val) > conf()
                          ? view.lang === "id"
                            ? "Signifikan (|r| > 95% CI)"
                            : "Significant (|r| > 95% CI)"
                          : view.lang === "id"
                            ? "Tidak signifikan (derau)"
                            : "Insignificant (noise)"}
                      </span>
                    </Show>
                  </div>

                  {/* SVG ACF Bar Plot */}
                  <div class="w-full overflow-hidden">
                    <svg
                      viewBox={`0 0 ${svgW} ${svgH}`}
                      class="w-full h-auto select-none overflow-visible"
                    >
                      <line
                        x1={padL}
                        y1={midY - scaleY}
                        x2={padL + plotW}
                        y2={midY - scaleY}
                        stroke="currentColor"
                        class="text-slate-200 dark:text-slate-800/80"
                        stroke-width="1"
                      />
                      <line
                        x1={padL}
                        y1={midY - 0.5 * scaleY}
                        x2={padL + plotW}
                        y2={midY - 0.5 * scaleY}
                        stroke="currentColor"
                        class="text-slate-100 dark:text-slate-800/40"
                        stroke-width="1"
                      />
                      <line
                        x1={padL}
                        y1={midY}
                        x2={padL + plotW}
                        y2={midY}
                        stroke="currentColor"
                        class="text-slate-300 dark:text-slate-700"
                        stroke-width="1.2"
                      />
                      <line
                        x1={padL}
                        y1={midY + 0.5 * scaleY}
                        x2={padL + plotW}
                        y2={midY + 0.5 * scaleY}
                        stroke="currentColor"
                        class="text-slate-100 dark:text-slate-800/40"
                        stroke-width="1"
                      />
                      <line
                        x1={padL}
                        y1={midY + scaleY}
                        x2={padL + plotW}
                        y2={midY + scaleY}
                        stroke="currentColor"
                        class="text-slate-200 dark:text-slate-800/80"
                        stroke-width="1"
                      />

                      {/* Y-Axis text labels */}
                      <text
                        x={padL - 8}
                        y={midY - scaleY + 4}
                        text-anchor="end"
                        font-size="9"
                        font-family="monospace"
                        fill="#94a3b8"
                      >
                        +1.0
                      </text>
                      <text
                        x={padL - 8}
                        y={midY + 3}
                        text-anchor="end"
                        font-size="9"
                        font-family="monospace"
                        fill="#94a3b8"
                      >
                        0.0
                      </text>
                      <text
                        x={padL - 8}
                        y={midY + scaleY + 2}
                        text-anchor="end"
                        font-size="9"
                        font-family="monospace"
                        fill="#94a3b8"
                      >
                        -1.0
                      </text>

                      {/* 95% Bartlett Confidence Band lines */}
                      <line
                        x1={padL}
                        y1={posConfY}
                        x2={padL + plotW}
                        y2={posConfY}
                        stroke="#f43f5e"
                        stroke-width="1.2"
                        stroke-dasharray="3,3"
                        stroke-opacity="0.85"
                      />
                      <line
                        x1={padL}
                        y1={negConfY}
                        x2={padL + plotW}
                        y2={negConfY}
                        stroke="#f43f5e"
                        stroke-width="1.2"
                        stroke-dasharray="3,3"
                        stroke-opacity="0.85"
                      />

                      {/* Shaded confidence region */}
                      <rect
                        x={padL}
                        y={posConfY}
                        width={plotW}
                        height={Math.max(0, negConfY - posConfY)}
                        fill="#f43f5e"
                        fill-opacity="0.04"
                      />

                      {/* Bars for ACF lags */}
                      <For each={d().acf}>
                        {(val, idx) => {
                          const isZeroLag = idx() === 0;
                          const isSignificant = Math.abs(val) > conf();
                          const xCenter = padL + idx() * slotW() + slotW() / 2;
                          const barHeight = Math.abs(val) * scaleY;
                          const barY = val >= 0 ? midY - barHeight : midY;

                          const isHovered = () =>
                            props.acfHover?.lag === idx() && props.acfHover?.type === "acf";

                          const fillColor = () =>
                            isZeroLag ? "#06b6d4" : isSignificant ? "#22d3ee" : "#94a3b8";

                          return (
                            <g
                              class="cursor-pointer"
                              onMouseEnter={() =>
                                props.setAcfHover({ lag: idx(), val, type: "acf" })
                              }
                              onMouseLeave={() => props.setAcfHover(null)}
                            >
                              <rect
                                x={xCenter - slotW() / 2}
                                y={padT}
                                width={slotW()}
                                height={plotH}
                                fill="transparent"
                              />

                              <rect
                                x={xCenter - barW() / 2}
                                y={barY}
                                width={barW()}
                                height={Math.max(1.5, barHeight)}
                                rx={1.5}
                                fill={fillColor()}
                                fill-opacity={isHovered() ? 1.0 : isSignificant ? 0.9 : 0.45}
                                class="transition-all duration-75"
                              />

                              <line
                                x1={xCenter}
                                y1={midY}
                                x2={xCenter}
                                y2={val >= 0 ? barY : barY + barHeight}
                                stroke={fillColor()}
                                stroke-width="1.2"
                                stroke-opacity={0.6}
                              />

                              <circle
                                cx={xCenter}
                                cy={val >= 0 ? barY : barY + barHeight}
                                r={isHovered() ? 3.5 : 2}
                                fill={fillColor()}
                                class="transition-all duration-75"
                              />

                              <Show
                                when={idx() % (maxLag() > 30 ? 5 : 2) === 0 || idx() === maxLag()}
                              >
                                <text
                                  x={xCenter}
                                  y={padT + plotH + 15}
                                  text-anchor="middle"
                                  font-size="9"
                                  font-family="monospace"
                                  fill={isHovered() ? "#06b6d4" : "#64748b"}
                                  font-weight={isHovered() ? "bold" : "normal"}
                                >
                                  {idx()}
                                </text>
                              </Show>
                            </g>
                          );
                        }}
                      </For>
                    </svg>
                  </div>
                </div>

                {/* Card 2: Partial Autocorrelation (PACF) */}
                <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3 shadow-xs">
                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                    <h4 class="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      {view.lang === "id"
                        ? "Fungsi Autokorelasi Parsial (PACF)"
                        : "Partial Autocorrelation Function (PACF)"}
                    </h4>
                    <span class="text-[10px] font-mono text-orange-500 dark:text-orange-400 border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 rounded-full">
                      Durbin-Levinson (95% CI)
                    </span>
                  </div>

                  {/* Hover readout strip */}
                  <div class="h-5 flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
                    <Show
                      when={props.acfHover}
                      fallback={
                        <span>
                          {view.lang === "id"
                            ? "Arahkan kursor ke batang lag untuk melihat nilai"
                            : "Hover over any lag bar for exact values"}
                        </span>
                      }
                    >
                      <span class="text-orange-500 font-bold">
                        Lag {props.acfHover!.lag}: α = {props.acfHover!.val.toFixed(3)}
                      </span>
                      <span
                        class={
                          Math.abs(props.acfHover!.val) > conf()
                            ? "text-emerald-500 font-bold"
                            : "text-slate-400"
                        }
                      >
                        {Math.abs(props.acfHover!.val) > conf()
                          ? view.lang === "id"
                            ? "Signifikan (|α| > 95% CI)"
                            : "Significant (|α| > 95% CI)"
                          : view.lang === "id"
                            ? "Tidak signifikan (derau)"
                            : "Insignificant (noise)"}
                      </span>
                    </Show>
                  </div>

                  {/* SVG PACF Bar Plot */}
                  <div class="w-full overflow-hidden">
                    <svg
                      viewBox={`0 0 ${svgW} ${svgH}`}
                      class="w-full h-auto select-none overflow-visible"
                    >
                      <line
                        x1={padL}
                        y1={midY - scaleY}
                        x2={padL + plotW}
                        y2={midY - scaleY}
                        stroke="currentColor"
                        class="text-slate-200 dark:text-slate-800/80"
                        stroke-width="1"
                      />
                      <line
                        x1={padL}
                        y1={midY - 0.5 * scaleY}
                        x2={padL + plotW}
                        y2={midY - 0.5 * scaleY}
                        stroke="currentColor"
                        class="text-slate-100 dark:text-slate-800/40"
                        stroke-width="1"
                      />
                      <line
                        x1={padL}
                        y1={midY}
                        x2={padL + plotW}
                        y2={midY}
                        stroke="currentColor"
                        class="text-slate-300 dark:text-slate-700"
                        stroke-width="1.2"
                      />
                      <line
                        x1={padL}
                        y1={midY + 0.5 * scaleY}
                        x2={padL + plotW}
                        y2={midY + 0.5 * scaleY}
                        stroke="currentColor"
                        class="text-slate-100 dark:text-slate-800/40"
                        stroke-width="1"
                      />
                      <line
                        x1={padL}
                        y1={midY + scaleY}
                        x2={padL + plotW}
                        y2={midY + scaleY}
                        stroke="currentColor"
                        class="text-slate-200 dark:text-slate-800/80"
                        stroke-width="1"
                      />

                      {/* Y-Axis text labels */}
                      <text
                        x={padL - 8}
                        y={midY - scaleY + 4}
                        text-anchor="end"
                        font-size="9"
                        font-family="monospace"
                        fill="#94a3b8"
                      >
                        +1.0
                      </text>
                      <text
                        x={padL - 8}
                        y={midY + 3}
                        text-anchor="end"
                        font-size="9"
                        font-family="monospace"
                        fill="#94a3b8"
                      >
                        0.0
                      </text>
                      <text
                        x={padL - 8}
                        y={midY + scaleY + 2}
                        text-anchor="end"
                        font-size="9"
                        font-family="monospace"
                        fill="#94a3b8"
                      >
                        -1.0
                      </text>

                      {/* 95% Bartlett Confidence Band lines */}
                      <line
                        x1={padL}
                        y1={posConfY}
                        x2={padL + plotW}
                        y2={posConfY}
                        stroke="#f43f5e"
                        stroke-width="1.2"
                        stroke-dasharray="3,3"
                        stroke-opacity="0.85"
                      />
                      <line
                        x1={padL}
                        y1={negConfY}
                        x2={padL + plotW}
                        y2={negConfY}
                        stroke="#f43f5e"
                        stroke-width="1.2"
                        stroke-dasharray="3,3"
                        stroke-opacity="0.85"
                      />

                      {/* Shaded confidence region */}
                      <rect
                        x={padL}
                        y={posConfY}
                        width={plotW}
                        height={Math.max(0, negConfY - posConfY)}
                        fill="#f43f5e"
                        fill-opacity="0.04"
                      />

                      {/* Bars for PACF lags */}
                      <For each={d().pacf}>
                        {(val, idx) => {
                          const isZeroLag = idx() === 0;
                          const isSignificant = Math.abs(val) > conf();
                          const xCenter = padL + idx() * slotW() + slotW() / 2;
                          const barHeight = Math.abs(val) * scaleY;
                          const barY = val >= 0 ? midY - barHeight : midY;

                          const isHovered = () =>
                            props.acfHover?.lag === idx() && props.acfHover?.type === "pacf";

                          const fillColor = () =>
                            isZeroLag ? "#f97316" : isSignificant ? "#fb923c" : "#94a3b8";

                          return (
                            <g
                              class="cursor-pointer"
                              onMouseEnter={() =>
                                props.setAcfHover({ lag: idx(), val, type: "pacf" })
                              }
                              onMouseLeave={() => props.setAcfHover(null)}
                            >
                              <rect
                                x={xCenter - slotW() / 2}
                                y={padT}
                                width={slotW()}
                                height={plotH}
                                fill="transparent"
                              />

                              <rect
                                x={xCenter - barW() / 2}
                                y={barY}
                                width={barW()}
                                height={Math.max(1.5, barHeight)}
                                rx={1.5}
                                fill={fillColor()}
                                fill-opacity={isHovered() ? 1.0 : isSignificant ? 0.9 : 0.45}
                                class="transition-all duration-75"
                              />

                              <line
                                x1={xCenter}
                                y1={midY}
                                x2={xCenter}
                                y2={val >= 0 ? barY : barY + barHeight}
                                stroke={fillColor()}
                                stroke-width="1.2"
                                stroke-opacity={0.6}
                              />

                              <circle
                                cx={xCenter}
                                cy={val >= 0 ? barY : barY + barHeight}
                                r={isHovered() ? 3.5 : 2}
                                fill={fillColor()}
                                class="transition-all duration-75"
                              />

                              <Show
                                when={idx() % (maxLag() > 30 ? 5 : 2) === 0 || idx() === maxLag()}
                              >
                                <text
                                  x={xCenter}
                                  y={padT + plotH + 15}
                                  text-anchor="middle"
                                  font-size="9"
                                  font-family="monospace"
                                  fill={isHovered() ? "#f97316" : "#64748b"}
                                  font-weight={isHovered() ? "bold" : "normal"}
                                >
                                  {idx()}
                                </text>
                              </Show>
                            </g>
                          );
                        }}
                      </For>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Guide / Interpretation Footer */}
              <div class="p-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5 font-sans">
                <div class="font-bold text-slate-800 dark:text-slate-200 font-mono text-xs">
                  {view.lang === "id"
                    ? "Panduan Interpretasi Autokorelasi"
                    : "Autocorrelation Interpretation Guide"}
                </div>
                <p class="leading-relaxed">
                  {view.lang === "id" ? (
                    <>
                      ACF mengukur korelasi deret dengan kelambatan waktunya (
                      <MathTex math="r_k" />
                      ). PACF mengisolasi korelasi langsung pada lag tertentu setelah efek lag
                      perantara dihilangkan (<MathTex math="\alpha_k" />, algoritma
                      Durbin-Levinson). Garis putus-putus merah menandai batas signifikansi 95%
                      Bartlett (
                      <MathTex math="\pm \frac{1.96}{\sqrt{N}}" />) — batang yang melewati batas ini
                      memiliki ketergantungan temporal yang signifikan.
                    </>
                  ) : (
                    <>
                      ACF measures the series correlation against its own past lags (
                      <MathTex math="r_k" />
                      ). PACF isolates the direct correlation at each lag by removing the effect of
                      intermediate lags (<MathTex math="\alpha_k" />, via the Durbin-Levinson
                      algorithm). The red dashed lines mark the 95% Bartlett confidence threshold (
                      <MathTex math="\pm \frac{1.96}{\sqrt{N}}" />) — bars extending beyond these
                      boundaries indicate statistically significant temporal dependencies.
                    </>
                  )}
                </p>
              </div>
            </div>
          );
        })()}
      </Show>
    </div>
  );
};
