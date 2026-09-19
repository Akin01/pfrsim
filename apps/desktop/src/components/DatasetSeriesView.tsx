import { Component, createEffect, createSignal, For, Show } from "solid-js";
import { Layers, RefreshCw } from "lucide-solid";
import type { DatasetDetail, DatasetPreview } from "../lib/types";
import { getSeriesConfig, type SeriesKey } from "../utils/data";
import { UPlotChart } from "./UPlotChart";
import { lttbDownsample } from "../lib/lttb";
import { datasetGetAllSeriesDownsampled } from "../lib/tauri";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export interface DatasetSeriesViewProps {
  selectedId: string | null;
  preview: DatasetPreview | null;
  detail: DatasetDetail | null;
  activeSeries: "all" | SeriesKey;
  onActiveSeriesChange: (series: "all" | SeriesKey) => void;
  onNavigateToDecomp: () => void;
  isActive?: boolean;
}

export const DatasetSeriesView: Component<DatasetSeriesViewProps> = (props) => {
  const t = () => catalogs[view.lang];
  const seriesCfg = () => getSeriesConfig(view.lang);
  const [downsampledMap, setDownsampledMap] = createSignal<
    Record<string, [number[], (number | null)[]]>
  >({});
  const [loadingMap, setLoadingMap] = createSignal<Record<string, boolean>>({
    wt: true,
    sm: true,
    rf: true,
    temp: true,
  });

  let lastFetchedId: string | null = null;
  createEffect(() => {
    const id = props.selectedId;
    if (!id || props.isActive === false) return;
    if (id === lastFetchedId && downsampledMap().wt) return;

    lastFetchedId = id;
    setLoadingMap({ wt: true, sm: true, rf: true, temp: true });
    // Single batched IPC call downsampling all 4 series in Rust in parallel in ~14ms
    void datasetGetAllSeriesDownsampled(id, 2500)
      .then((res) => {
        if (res.ok) {
          setDownsampledMap({
            wt: [res.data.wt.x, res.data.wt.y],
            sm: [res.data.sm.x, res.data.sm.y],
            rf: [res.data.rf.x, res.data.rf.y],
            temp: [res.data.temp.x, res.data.temp.y],
          });
        }
      })
      .finally(() => {
        setLoadingMap({ wt: false, sm: false, rf: false, temp: false });
      });
  });

  const getChartData = (k: SeriesKey, targetPoints = 2500): [number[], (number | null)[]] => {
    const cached = downsampledMap()[k];
    if (cached && cached[0].length > 0) {
      return cached;
    }
    const vals = props.detail?.columns[k] ?? props.preview?.head.map((r) => r[k]) ?? [];
    const x = Array.from({ length: vals.length }, (_, i) => i + 1);
    return lttbDownsample(x, vals, targetPoints);
  };

  return (
    <div class="space-y-4 select-none">
      {/* Controls Bar: Series Selector & Active Variable Metrics */}
      <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl">
        {/* Variable selector pills */}
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => props.onActiveSeriesChange("all")}
            class={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              props.activeSeries === "all"
                ? "bg-slate-700 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-400"
            }`}
          >
            {t().dataAllVariables}
          </button>

          <button
            type="button"
            onClick={() => props.onActiveSeriesChange("wt")}
            class={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              props.activeSeries === "wt"
                ? "bg-cyan-500 text-white shadow-xs"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-cyan-400"
            }`}
          >
            <span class="w-2 h-2 rounded-full bg-cyan-400" />
            <span>WT (m)</span>
          </button>

          <button
            type="button"
            onClick={() => props.onActiveSeriesChange("sm")}
            class={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              props.activeSeries === "sm"
                ? "bg-emerald-500 text-white shadow-xs"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-400"
            }`}
          >
            <span class="w-2 h-2 rounded-full bg-emerald-400" />
            <span>SM (%)</span>
          </button>

          <button
            type="button"
            onClick={() => props.onActiveSeriesChange("rf")}
            class={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              props.activeSeries === "rf"
                ? "bg-blue-500 text-white shadow-xs"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-blue-400"
            }`}
          >
            <span class="w-2 h-2 rounded-full bg-blue-400" />
            <span>Rf (mm)</span>
          </button>

          <button
            type="button"
            onClick={() => props.onActiveSeriesChange("temp")}
            class={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              props.activeSeries === "temp"
                ? "bg-rose-500 text-white shadow-xs"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-rose-400"
            }`}
          >
            <span class="w-2 h-2 rounded-full bg-rose-400" />
            <span>Temp (°C)</span>
          </button>
        </div>

        {/* Mini stats for active series */}
        <Show when={props.activeSeries !== "all"}>
          {(() => {
            const key = props.activeSeries as SeriesKey;
            const cfg = seriesCfg()[key];
            const st = props.preview?.stats[key];
            return (
              <div class="flex items-center space-x-2 text-[11px] font-mono">
                <span class="text-slate-400">
                  Min:{" "}
                  <strong class="text-slate-900 dark:text-slate-200">{st?.min.toFixed(2)}</strong>{" "}
                  {cfg.unit}
                </span>
                <span class="text-slate-400">
                  {view.lang === "id" ? "Rerata" : "Mean"}:{" "}
                  <strong class="text-slate-900 dark:text-slate-200">{st?.mean.toFixed(2)}</strong>{" "}
                  {cfg.unit}
                </span>
                <span class="text-slate-400">
                  Max:{" "}
                  <strong class="text-slate-900 dark:text-slate-200">{st?.max.toFixed(2)}</strong>{" "}
                  {cfg.unit}
                </span>
                <span class="text-slate-400">
                  {view.lang === "id" ? "Standar Deviasi" : "Std Dev"}:{" "}
                  <strong class="text-slate-900 dark:text-slate-200">
                    {st?.std != null ? st.std.toFixed(2) : "-"}
                  </strong>{" "}
                  {cfg.unit}
                </span>
                <span class="text-slate-400">
                  ACF(1):{" "}
                  <strong class="text-slate-900 dark:text-slate-200">
                    {st?.acf1 != null ? st.acf1.toFixed(3) : "-"}
                  </strong>
                </span>
              </div>
            );
          })()}
        </Show>
      </div>

      {/* View A: Single Large Time Series Chart with hover inspection */}
      <Show
        when={props.activeSeries === "all"}
        fallback={(() => {
          const key = props.activeSeries as SeriesKey;
          const cfg = seriesCfg()[key];
          const chartData = () => getChartData(key, 2500);
          const isDark = view.theme === "dark";
          const fill = isDark ? `${cfg.color}1f` : `${cfg.color}12`;

          return (
            <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
              <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div class="flex items-center space-x-2">
                  <span class="w-3 h-3 rounded-full" style={{ "background-color": cfg.color }} />
                  <h3 class="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    {cfg.name} · {cfg.label} ({cfg.unit})
                  </h3>
                  <span class="text-[11px] text-slate-400 font-mono">— {cfg.description}</span>
                </div>
              </div>

              {/* Lightweight uPlot Chart or Loading Spinner */}
              <div class="relative w-full pt-1 min-h-70">
                <Show
                  when={downsampledMap()[key] != null}
                  fallback={
                    <div class="h-70 flex flex-col items-center justify-center space-y-3 bg-slate-50/50 dark:bg-slate-950/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                        <RefreshCw size={20} class="animate-spin" />
                      </div>
                      <div class="text-center space-y-0.5">
                        <p class="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">
                          {view.lang === "id"
                            ? "Memuat visualisasi deret..."
                            : "Rendering series plot..."}
                        </p>
                        <p class="text-[11px] font-mono text-slate-400">
                          {view.lang === "id"
                            ? "Menyelaraskan 2.500 titik data LTTB..."
                            : "Aligning 2,500 LTTB visual samples..."}
                        </p>
                      </div>
                    </div>
                  }
                >
                  <div
                    class={`transition-opacity duration-200 ${loadingMap()[key] ? "opacity-75" : "opacity-100"}`}
                  >
                    <UPlotChart
                      data={chartData()}
                      series={[
                        {
                          label: `${cfg.name} (${cfg.unit})`,
                          stroke: cfg.stroke,
                          fill,
                          width: 2.2,
                          unit: cfg.unit,
                        },
                      ]}
                      height={280}
                    />
                  </div>
                </Show>
              </div>
              {/* STL teaser: decomposition lives in its own tab */}
              <Show when={props.preview?.stats[key]?.decomposition != null}>
                <button
                  type="button"
                  onClick={props.onNavigateToDecomp}
                  class="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 text-xs font-mono transition-all cursor-pointer group/stl"
                >
                  <span class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Layers size={13} class="text-indigo-500" />
                    <span>
                      {t().dataStlAvailableTeaser(props.preview!.stats[key]!.decomposition!.period)}
                    </span>
                  </span>
                  <span class="font-bold text-indigo-500 group-hover/stl:translate-x-0.5 transition-transform">
                    →
                  </span>
                </button>
              </Show>
            </div>
          );
        })()}
      >
        {/* View B: Anofox 2x2 Grid with all 4 series synchronized */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <For each={["wt", "sm", "rf", "temp"] as const}>
            {(k) => {
              const cfg = seriesCfg()[k];
              const chartData = () => getChartData(k, 1500);
              const isDark = view.theme === "dark";
              const fill = isDark ? `${cfg.color}14` : `${cfg.color}0a`;

              return (
                <div
                  onClick={() => props.onActiveSeriesChange(k)}
                  class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 rounded-2xl p-4 space-y-2 cursor-pointer transition-all hover:shadow-md group"
                >
                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <div class="flex items-center space-x-2">
                      <span
                        class="w-2.5 h-2.5 rounded-full"
                        style={{ "background-color": cfg.color }}
                      />
                      <span class="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                        {cfg.name} · {cfg.label}
                      </span>
                    </div>
                    <span class="text-[10px] text-slate-400 font-mono">
                      {t().dataClickToEnlarge}
                    </span>
                  </div>

                  <div class="w-full pt-1 min-h-37.5">
                    <Show
                      when={downsampledMap()[k] != null}
                      fallback={
                        <div class="h-37.5 flex flex-col items-center justify-center space-y-2 bg-slate-50/50 dark:bg-slate-950/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                          <RefreshCw size={16} class="animate-spin text-emerald-500" />
                          <span class="text-[10px] font-mono text-slate-400">
                            {view.lang === "id" ? "Memproses titik..." : "Downsampling..."}
                          </span>
                        </div>
                      }
                    >
                      <div
                        class={`transition-opacity duration-200 ${loadingMap()[k] ? "opacity-75" : "opacity-100"}`}
                      >
                        <UPlotChart
                          data={chartData()}
                          series={[
                            {
                              label: `${cfg.name} (${cfg.unit})`,
                              stroke: cfg.stroke,
                              fill,
                              width: 1.8,
                              unit: cfg.unit,
                            },
                          ]}
                          height={150}
                        />
                      </div>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
};
