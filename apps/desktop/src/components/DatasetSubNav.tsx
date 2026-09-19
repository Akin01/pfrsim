import { Component, createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { Activity, ChartColumn, Layers, RefreshCw, Table, TrendingUp } from "lucide-solid";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export type ExploreTabType = "stats" | "series" | "decomp" | "acf" | "missing" | "table";

export interface DatasetSubNavProps {
  activeTab: ExploreTabType;
  onTabChange: (tab: ExploreTabType) => void;
  loading?: boolean;
}
export const DatasetSubNav: Component<DatasetSubNavProps> = (props) => {
  const t = () => catalogs[view.lang];

  const exploreTabRefs: Record<string, HTMLButtonElement | undefined> = {};
  let exploreTabContainerRef: HTMLDivElement | null = null;
  const [exploreGliderReady, setExploreGliderReady] = createSignal(false);
  const [exploreGliderStyle, setExploreGliderStyle] = createSignal({ left: 24, width: 80 });

  const updateExploreGlider = () => {
    const el = exploreTabRefs[props.activeTab];
    if (el) {
      setExploreGliderStyle({ left: el.offsetLeft, width: el.offsetWidth });
      setExploreGliderReady(true);
    }
  };

  createEffect(() => {
    void props.activeTab;
    void view.lang;
    requestAnimationFrame(() => {
      updateExploreGlider();
      requestAnimationFrame(updateExploreGlider);
    });
  });

  onMount(() => {
    requestAnimationFrame(updateExploreGlider);
    window.addEventListener("resize", updateExploreGlider);

    let resizeObs: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      resizeObs = new ResizeObserver(() => {
        requestAnimationFrame(updateExploreGlider);
      });
      if (exploreTabContainerRef) resizeObs.observe(exploreTabContainerRef);
      Object.values(exploreTabRefs).forEach((btn) => {
        if (btn) resizeObs?.observe(btn);
      });
    }

    onCleanup(() => {
      window.removeEventListener("resize", updateExploreGlider);
      if (resizeObs) resizeObs.disconnect();
    });
  });

  return (
    <div
      ref={(el) => (exploreTabContainerRef = el)}
      class="relative px-6 pt-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between shrink-0 text-xs font-mono font-bold select-none"
    >
      {/* Left: Tab Buttons Strip */}
      <div class="relative flex items-center space-x-6">
        {/* Smooth Moving Underline Indicator */}
        <Show when={exploreGliderReady()}>
          <div
            class="absolute bottom-0 h-0.5 bg-emerald-500 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none rounded-full"
            style={{
              left: `${exploreGliderStyle().left}px`,
              width: `${exploreGliderStyle().width}px`,
            }}
          />
        </Show>

        <button
          ref={(el) => (exploreTabRefs["stats"] = el)}
          onClick={() => props.onTabChange("stats")}
          class={`pb-2.5 flex items-center space-x-2 transition-colors duration-200 cursor-pointer ${
            props.activeTab === "stats"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <ChartColumn size={14} />
          <span>{t().dataTabStats}</span>
        </button>

        <button
          ref={(el) => (exploreTabRefs["series"] = el)}
          type="button"
          onClick={() => props.onTabChange("series")}
          class={`pb-2.5 flex items-center space-x-2 transition-colors duration-200 cursor-pointer ${
            props.activeTab === "series"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <TrendingUp size={14} />
          <span>{t().dataTabSeries}</span>
        </button>

        <button
          ref={(el) => (exploreTabRefs["decomp"] = el)}
          type="button"
          onClick={() => props.onTabChange("decomp")}
          class={`pb-2.5 flex items-center space-x-2 transition-colors duration-200 cursor-pointer ${
            props.activeTab === "decomp"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <Layers size={14} />
          <span>{t().dataTabDecomp}</span>
        </button>

        <button
          ref={(el) => (exploreTabRefs["acf"] = el)}
          type="button"
          onClick={() => props.onTabChange("acf")}
          class={`pb-2.5 flex items-center space-x-2 transition-colors duration-200 cursor-pointer ${
            props.activeTab === "acf"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <Activity size={14} />
          <span>{t().dataTabAcf}</span>
        </button>

        <button
          ref={(el) => (exploreTabRefs["missing"] = el)}
          type="button"
          onClick={() => props.onTabChange("missing")}
          class={`pb-2.5 flex items-center space-x-2 transition-colors duration-200 cursor-pointer ${
            props.activeTab === "missing"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <Layers size={14} />
          <span>{t().dataTabMissing}</span>
        </button>

        <button
          ref={(el) => (exploreTabRefs["table"] = el)}
          type="button"
          onClick={() => props.onTabChange("table")}
          class={`pb-2.5 flex items-center space-x-2 transition-colors duration-200 cursor-pointer ${
            props.activeTab === "table"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <Table size={14} />
          <span>{t().dataTabTable}</span>
        </button>
      </div>

      {/* Right: Reserved Circular Spinner Slot (Never shifts or moves any tab element) */}
      <div class="pb-2.5 flex items-center justify-end w-8 h-8 shrink-0">
        <div
          class={`transition-opacity duration-200 flex items-center justify-center ${
            props.loading ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          title={view.lang === "id" ? "Memproses komputasi data..." : "Processing calculation..."}
        >
          <RefreshCw size={14} class="animate-spin text-emerald-500 dark:text-emerald-400" />
        </div>
      </div>
    </div>
  );
};
