import { Component, createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { view } from "../lib/store";

export interface UPlotSeriesConfig {
  label: string;
  stroke: string;
  fill?: string;
  width?: number;
  unit?: string;
}

export interface UPlotChartProps {
  data: [number[], ...(number | null)[][]];
  series: UPlotSeriesConfig[];
  height?: number;
  yMin?: number;
  yMax?: number;
  class?: string;
  syncKey?: string;
  timeLabels?: (string | null)[];
}

export const UPlotChart: Component<UPlotChartProps> = (props) => {
  let containerRef: HTMLDivElement | null = null;
  let chartRef: HTMLDivElement | null = null;
  let chartInstance: uPlot | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const [tooltip, setTooltip] = createSignal<{
    visible: boolean;
    left: number;
    top: number;
    title: string;
    items: { label: string; value: string; color: string }[];
  }>({
    visible: false,
    left: 0,
    top: 0,
    title: "",
    items: [],
  });
  const isDark = () => view.theme === "dark";

  const getOptions = (width: number): uPlot.Options => {
    const dark = isDark();
    const gridColor = dark ? "rgba(51, 65, 85, 0.35)" : "rgba(226, 232, 240, 0.8)";
    const tickColor = dark ? "#64748b" : "#94a3b8";

    const seriesOpts: uPlot.Series[] = [
      {
        label: "t",
        value: (_u, v) => (v != null ? `t = ${v}` : "-"),
      },
      ...props.series.map((s) => ({
        label: s.label,
        stroke: s.stroke,
        fill: s.fill,
        width: s.width ?? 2,
        spanGaps: false,
        points: {
          show: false,
        },
        value: (_u: uPlot, v: number | null) =>
          v != null ? `${v.toFixed(3)} ${s.unit ?? ""}`.trim() : "NA",
      })),
    ];

    const axesOpts: uPlot.Axis[] = [
      {
        stroke: tickColor,
        grid: { stroke: gridColor, width: 1 },
        ticks: { stroke: tickColor, width: 1, size: 4 },
        font: "10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        gap: 6,
        size: 28,
        values: (_u, splits) => splits.map((v) => `${v}`),
      },
      {
        stroke: tickColor,
        grid: { stroke: gridColor, width: 1 },
        ticks: { stroke: tickColor, width: 1, size: 4 },
        font: "10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        gap: 6,
        size: 55,
        values: (_u, splits) => splits.map((v) => `${v.toFixed(2)}`),
      },
    ];

    return {
      width,
      height: props.height ?? 260,
      series: seriesOpts,
      axes: axesOpts,
      cursor: {
        drag: { x: true, y: false },
        sync: props.syncKey
          ? {
              key: props.syncKey,
              scales: ["x", null],
            }
          : undefined,
        points: {
          size: 7,
          fill: (_u, seriesIdx) => props.series[seriesIdx - 1]?.stroke ?? "#10b981",
          stroke: "#ffffff",
          width: 2,
        },
      },
      scales: {
        x: {
          time: false,
        },
        y: {
          range: (_u, min, max) => {
            const ymin = props.yMin !== undefined ? props.yMin : min;
            const ymax = props.yMax !== undefined ? props.yMax : max;
            const pad = (ymax - ymin) * 0.05 || 0.1;
            return [ymin - pad, ymax + pad];
          },
        },
      },
      legend: {
        show: false,
      },
      hooks: {
        setCursor: [
          (u) => {
            const idx = u.cursor.idx;
            if (idx == null || u.cursor.left == null || u.cursor.left < 0 || !containerRef) {
              setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
              return;
            }

            const xVal = u.data[0][idx];
            const timeLabel = props.timeLabels?.[idx];
            const title = timeLabel ? `${timeLabel} (t=${xVal})` : `Step t = ${xVal}`;

            const items = props.series.map((s, i) => {
              const val = u.data[i + 1]?.[idx];
              const valStr =
                val != null && !isNaN(val)
                  ? `${Number(val.toFixed(4))} ${s.unit ?? ""}`.trim()
                  : "NA (Missing)";
              return {
                label: s.label,
                value: valStr,
                color: s.stroke,
              };
            });

            const overRect = u.over.getBoundingClientRect();
            const containerRect = containerRef.getBoundingClientRect();
            const cursorX = (u.cursor.left ?? 0) + (overRect.left - containerRect.left);
            const cursorY = (u.cursor.top ?? 0) + (overRect.top - containerRect.top);

            const containerW = containerRef.clientWidth || 800;
            const containerH = props.height ?? 260;

            let left = cursorX + 16;
            let top = cursorY - 12;

            if (left + 160 > containerW) {
              left = cursorX - 165;
            }
            if (top + 70 > containerH) {
              top = cursorY - 65;
            }

            left = Math.max(8, left);
            top = Math.max(8, top);

            setTooltip({
              visible: true,
              left: Math.round(left),
              top: Math.round(top),
              title,
              items,
            });
          },
        ],
      },
    };
  };

  const initChart = () => {
    if (!chartRef) return;
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    const width = chartRef.clientWidth || containerRef?.clientWidth || 600;
    const opts = getOptions(width);
    chartInstance = new uPlot(opts, props.data as unknown as uPlot.AlignedData, chartRef);
  };

  let lastWidth = 0;
  let rafId: number | null = null;
  onMount(() => {
    // Schedule in requestAnimationFrame so tab transitions & DOM updates commit without dropping frames
    rafId = requestAnimationFrame(() => {
      initChart();

      if (chartRef && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const width = Math.floor(entry.contentRect.width);
            if (width > 50 && Math.abs(width - lastWidth) >= 2 && chartInstance) {
              lastWidth = width;
              chartInstance.setSize({ width, height: props.height ?? 260 });
            }
          }
        });
        resizeObserver.observe(chartRef);
      }
    });
  });

  let lastTheme = view.theme;
  let lastHeight = props.height;
  createEffect(() => {
    const t = view.theme;
    const h = props.height;
    if (chartInstance && (t !== lastTheme || h !== lastHeight)) {
      lastTheme = t;
      lastHeight = h;
      initChart();
    }
  });

  createEffect(() => {
    const d = props.data;
    if (chartInstance) {
      chartInstance.setData(d as unknown as uPlot.AlignedData);
    }
  });

  onCleanup(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  });

  return (
    <div
      ref={(el) => {
        containerRef = el;
      }}
      class={`w-full relative select-none ${props.class ?? ""}`}
      style={{
        height: `${props.height ?? 260}px`,
        "min-height": `${props.height ?? 260}px`,
      }}
    >
      {/* 1. Dedicated DOM container for uPlot canvas ONLY — SolidJS never reconciles inside this element */}
      <div
        ref={(el) => {
          chartRef = el;
        }}
        class="w-full h-full overflow-hidden"
        style={{
          height: `${props.height ?? 260}px`,
          "min-height": `${props.height ?? 260}px`,
        }}
      />

      {/* 2. Floating Tooltip Overlay (sibling of chart, never inside chartRef) */}
      <Show when={tooltip().visible}>
        <div
          class="pointer-events-none absolute z-30 transition-transform duration-75 ease-out"
          style={{
            transform: `translate3d(${tooltip().left}px, ${tooltip().top}px, 0)`,
            top: 0,
            left: 0,
          }}
        >
          <div class="bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-2xl backdrop-blur-md text-[11px] font-mono space-y-1.5 min-w-37.5 pointer-events-none">
            <div class="text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800 pb-1 flex items-center justify-between text-[10px]">
              <span>{tooltip().title}</span>
            </div>
            <For each={tooltip().items}>
              {(item) => (
                <div class="flex items-center justify-between space-x-3 text-[11px]">
                  <div class="flex items-center space-x-1.5 min-w-0">
                    <span
                      class="w-2 h-2 rounded-full shrink-0"
                      style={{ "background-color": item.color }}
                    />
                    <span class="text-slate-600 dark:text-slate-300 truncate max-w-30">
                      {item.label}
                    </span>
                  </div>
                  <strong class="font-bold text-slate-900 dark:text-white shrink-0 font-mono">
                    {item.value}
                  </strong>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default UPlotChart;
