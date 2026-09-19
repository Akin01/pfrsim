import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";
import { Cpu, Layers, Play, Upload } from "lucide-solid";
import { artifactLoadFrames, artifactLoadManifest, runImport, runsList } from "../lib/tauri";
import { mutationBus } from "../lib/mutation";
import {
  navigateTab,
  playback,
  setView,
  type SpeedRate,
  type TransportState,
  view,
} from "../lib/store";
import { toast } from "../lib/toast";
import { CircularProgress } from "../components/CircularProgress";
import { parseRunFile } from "../lib/runImporter";
import { Land3DView } from "../components/Land3DView";
import type { Manifest, SimulationFrame } from "../lib/types";
import {
  exportFramesCsv,
  exportFramesJson,
  HERO_HEIGHT,
  OVERVIEW_PLOT_LEFT,
  OVERVIEW_PLOT_WIDTH,
  OVERVIEW_SVG_WIDTH,
  PLOT_LEFT,
  PLOT_RIGHT,
  STRIP_HEIGHT,
  svgXToT,
} from "../utils/player";
import { catalogs } from "../i18n/catalog";
import { PlayerHeader } from "../components/PlayerHeader";
import { PlaybookModal } from "../components/PlaybookModal";
import { PlayerEnvironmentalStrips } from "../components/PlayerEnvironmentalStrips";
import { PlayerHeroChart } from "../components/PlayerHeroChart";
import { PlayerHoverTooltip } from "../components/PlayerHoverTooltip";
import { PlayerModelDetailsModal } from "../components/PlayerModelDetailsModal";
import { PlayerTransportBar } from "../components/PlayerTransportBar";
export interface PlayerPageProps {
  runId?: string | null;
  tabId?: string;
  isActive?: boolean;
}

export const PlayerPage: Component<PlayerPageProps> = (props) => {
  const tCatalog = () => catalogs[view.lang];
  const tabSlug = () => (props.tabId || "player").replace(/[^a-zA-Z0-9_-]/g, "_");
  const stripClipId = () => `strip-plot-clip-${tabSlug()}`;
  const chartClipId = () => `chart-plot-clip-${tabSlug()}`;
  const holdoutPatternId = () => `holdout-stripes-${tabSlug()}`;

  const [manifest, setManifest] = createSignal<Manifest | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

  // Simulation Visualization Mode: "trend" (Time strips + hero) vs "3d" (Three.js 3D Land Heatmap)
  const [playerMode, setPlayerMode] = createSignal<"trend" | "3d">("trend");
  // Tab-isolated independent playback state
  const [frames, setFrames] = createSignal<SimulationFrame[]>([]);
  const [t, setT] = createSignal(1);
  const [transport, setTransport] = createSignal<TransportState>("idle");
  const [speed, setSpeed] = createSignal<SpeedRate>(2);
  const [loop, setLoop] = createSignal(false);
  let timerId: number | null = null;

  // Zoom & Pan state (x-axis timeframe window: [minT, maxT])
  const [xWindow, setXWindow] = createSignal<[number, number] | null>(null);

  // Synced hover inspection across all 5 charts
  const [hoverT, setHoverT] = createSignal<number | null>(null);
  const [hoverPos, setHoverPos] = createSignal<{
    x: number;
    y: number;
    chartName: string;
    clientX: number;
    clientY: number;
  } | null>(null);

  // Brush selection for click-to-scrub vs drag-to-zoom
  const [brushState, setBrushState] = createSignal<{
    isDragging: boolean;
    startT: number;
    currentT: number;
    startX: number;
    currentX: number;
    chartName: string;
  } | null>(null);

  // UI Popovers & Modals
  const [showModelDetails, setShowModelDetails] = createSignal(false);
  const [showPlaybook, setShowPlaybook] = createSignal(false);
  const [showExportMenu, setShowExportMenu] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);
  const [zeroLineVisible, setZeroLineVisible] = createSignal(true);

  let minimapSvgRef: SVGSVGElement | null = null;
  let fileInputRef: HTMLInputElement | null = null;

  const handleImportRunClick = () => {
    fileInputRef?.click();
  };

  const handleFileSelected = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const imported = await parseRunFile(file);
      const cleanName = imported.fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const res = await runImport(cleanName, imported.frames, imported.manifest.config);
      if (res.ok) {
        mutationBus.notifyRunMutated(res.data.run_id);
        setFrames(imported.frames);
        setManifest({
          ...imported.manifest,
          run_id: res.data.run_id,
          dataset_id: res.data.dataset_id,
        });
        setT(1);
        setXWindow(null);
        setTransport("idle");
        toast.success(tCatalog().playerImportSuccess(res.data.name, imported.frames.length));
      } else {
        throw new Error(res.message);
      }
    } catch (err) {
      toast.error(`Import failed: ${String(err)}`);
      setErrorMsg(`Failed to import file: ${String(err)}`);
    } finally {
      setLoading(false);
      target.value = "";
    }
  };

  let isMinimapDragging = false;
  let minimapDragState: {
    startX: number;
    startWMin: number;
    startWMax: number;
    startT: number;
  } | null = null;
  const totalN = createMemo(() => frames().length);

  const currentFrame = createMemo(() => {
    const f = frames();
    const idx = t() - 1;
    return f[idx] ?? null;
  });

  const hoveredFrame = createMemo(() => {
    const ht = hoverT();
    if (ht === null) return null;
    const f = frames();
    return f[ht - 1] ?? null;
  });

  const forecastStartT = createMemo(() => {
    const idx = frames().findIndex((f) => f.is_forecast);
    return idx === -1 ? null : idx + 1;
  });

  // Holdout region calculation based on training test_split_ratio
  const holdoutRange = createMemo<{ startT: number; endT: number } | null>(() => {
    const m = manifest();
    const fStart = forecastStartT();
    const n = totalN();
    if (n === 0) return null;

    const splitRatio = m?.config?.forecaster?.arima?.test_split_ratio ?? 0.2;
    if (splitRatio <= 0) return null;

    const historyEnd = fStart !== null ? fStart - 1 : n;
    if (historyEnd <= 2) return null;

    const holdoutLen = Math.max(1, Math.round(historyEnd * splitRatio));
    const startT = Math.max(1, historyEnd - holdoutLen + 1);
    return { startT, endT: historyEnd };
  });

  // Effective visible x-window [minT, maxT]
  const effectiveWindow = createMemo<[number, number]>(() => {
    const win = xWindow();
    const n = Math.max(1, totalN());
    if (!win) return [1, n];
    const minClamped = Math.max(1, Math.min(win[0], n));
    const maxClamped = Math.max(minClamped, Math.min(win[1], n));
    return [minClamped, maxClamped];
  });

  const isZoomed = createMemo(() => {
    const win = xWindow();
    if (!win) return false;
    const n = totalN();
    return win[0] > 1 || win[1] < n;
  });

  const zoomPercentage = createMemo(() => {
    const [wMin, wMax] = effectiveWindow();
    const n = Math.max(1, totalN());
    const span = wMax - wMin + 1;
    return Math.round((span / n) * 100);
  });

  // Overlay frame at current t
  const overlayFrame = createMemo(() => {
    if (!view.overlayFrames || view.overlayFrames.length === 0) return null;
    const idx = t() - 1;
    return view.overlayFrames[idx] ?? null;
  });

  const hoveredOverlayFrame = createMemo(() => {
    const ht = hoverT();
    if (ht === null || !view.overlayFrames || view.overlayFrames.length === 0) return null;
    return view.overlayFrames[ht - 1] ?? null;
  });

  // Timer & Playback controls
  const startTimer = () => {
    stopTimer();
    const intervalMs = 1000 / speed();
    timerId = window.setInterval(() => {
      const current = t();
      const maxT = totalN();
      if (current < maxT) {
        setT((prev) => prev + 1);
      } else {
        if (loop()) {
          setT(1);
        } else {
          setTransport("ended");
          stopTimer();
        }
      }
    }, intervalMs);
  };

  const stopTimer = () => {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  };

  const play = () => {
    const f = frames();
    if (f.length === 0) return;
    if (t() >= f.length) {
      setT(1);
    }
    setTransport("playing");
    startTimer();
  };

  const pause = () => {
    setTransport("paused");
    stopTimer();
  };

  const togglePlayPause = () => {
    if (transport() === "playing") {
      pause();
    } else {
      play();
    }
  };

  const scrubTo = (newT: number) => {
    const maxT = Math.max(1, totalN());
    const clamped = Math.max(1, Math.min(newT, maxT));
    setT(clamped);
    if (transport() === "playing") {
      pause();
    }
  };

  const stepBy = (delta: number) => {
    const maxT = Math.max(1, totalN());
    const nextT = Math.max(1, Math.min(t() + delta, maxT));
    setT(nextT);
  };

  const updateSpeed = (newSpeed: SpeedRate) => {
    setSpeed(newSpeed);
    if (transport() === "playing") {
      stopTimer();
      startTimer();
    }
  };

  const toggleLoop = () => {
    setLoop((prev) => !prev);
  };

  onCleanup(() => {
    stopTimer();
  });

  // Run data loading
  let isFetchingRun = false;
  let lastLoadedRunId: string | null = null;

  const loadRun = async (runId: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [fRes, mRes] = await Promise.all([
        artifactLoadFrames(runId),
        artifactLoadManifest(runId),
      ]);
      if (fRes.ok && fRes.data.length > 0) {
        setFrames(fRes.data);
        setT(1);
        setXWindow(null);
        setTransport("idle");
      } else if (!fRes.ok) {
        setErrorMsg(`Failed to load simulation frames: ${fRes.message}`);
      }
      if (mRes.ok) {
        setManifest(mRes.data);
      }
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    const targetRunId = props.runId || playback.selectedRunId;

    untrack(() => {
      if (isFetchingRun) return;

      if (targetRunId && targetRunId !== lastLoadedRunId) {
        lastLoadedRunId = targetRunId;
        isFetchingRun = true;
        loadRun(targetRunId).finally(() => {
          isFetchingRun = false;
        });
      } else if (!targetRunId && frames().length === 0) {
        isFetchingRun = true;
        runsList(1, 0)
          .then((res) => {
            if (res.ok && res.data.length > 0) {
              const latestId = res.data[0].run_id;
              lastLoadedRunId = latestId;
              return loadRun(latestId);
            }
          })
          .finally(() => {
            isFetchingRun = false;
          });
      }
    });
  });

  // Zoom manipulation helpers
  const zoomBy = (factor: number, centerT?: number) => {
    const n = totalN();
    if (n <= 2) return;
    const [wMin, wMax] = effectiveWindow();
    const currentSpan = wMax - wMin;
    const center = centerT ?? t();

    const newSpan = Math.max(4, Math.round(currentSpan * factor));
    if (newSpan >= n) {
      setXWindow(null);
      return;
    }

    const centerRatio = (center - wMin) / Math.max(1, currentSpan);
    let newMin = Math.round(center - centerRatio * newSpan);
    let newMax = newMin + newSpan;

    if (newMin < 1) {
      newMax += 1 - newMin;
      newMin = 1;
    }
    if (newMax > n) {
      newMin -= newMax - n;
      newMax = n;
    }
    newMin = Math.max(1, newMin);

    setXWindow([newMin, newMax]);
  };

  const resetZoom = () => {
    setXWindow(null);
  };

  const zoomToForecast = () => {
    const fc = forecastStartT();
    const n = totalN();
    if (!fc || n === 0) return;
    const padding = Math.min(10, Math.round((n - fc) * 0.5));
    const start = Math.max(1, fc - padding);
    setXWindow([start, n]);
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    if (props.isActive === false) return;
    if (view.activeTab !== "player" && !props.runId) return;

    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.code === "Space") {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === "ArrowLeft") {
      e.preventDefault();
      if (e.shiftKey) {
        const h = manifest()?.config?.pfvi?.h ?? 4;
        stepBy(-h);
      } else {
        stepBy(-1);
      }
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      if (e.shiftKey) {
        const h = manifest()?.config?.pfvi?.h ?? 4;
        stepBy(h);
      } else {
        stepBy(1);
      }
    } else if (e.code === "KeyF") {
      e.preventDefault();
      const fc = forecastStartT();
      if (fc) scrubTo(fc);
    } else if (e.code === "Home") {
      e.preventDefault();
      scrubTo(1);
    } else if (e.code === "End") {
      e.preventDefault();
      scrubTo(totalN());
    } else if (e.key === "1") {
      updateSpeed(1);
    } else if (e.key === "2") {
      updateSpeed(2);
    } else if (e.key === "3") {
      updateSpeed(4);
    } else if (e.key === "4") {
      updateSpeed(8);
    } else if (e.code === "KeyL") {
      toggleLoop();
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomBy(0.8);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomBy(1.25);
    } else if (e.key === "0") {
      e.preventDefault();
      resetZoom();
    } else if (e.key === "?") {
      setView("showShortcuts", !view.showShortcuts);
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("mousemove", handleGlobalMouseMove);
    window.removeEventListener("mouseup", handleGlobalMouseUp);
  });

  // Exact cursor X clamped within plot area for smooth continuous crosshair tracking
  const cursorSvgX = createMemo(() => {
    const pos = hoverPos();
    if (!pos) return null;
    return Math.max(PLOT_LEFT, Math.min(PLOT_RIGHT, pos.x));
  });

  // Smooth viewport-bounded tooltip coordinates (prevents overflowing right/bottom edges)
  const tooltipCoords = createMemo(() => {
    const pos = hoverPos();
    if (!pos) return null;
    const tooltipWidth = 280;
    const tooltipHeight = 265;
    const offset = 16;

    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;

    let left: number;
    let top: number;

    if (pos.clientX > vw * 0.55 || pos.clientX + offset + tooltipWidth > vw - 24) {
      left = pos.clientX - tooltipWidth - offset;
    } else {
      left = pos.clientX + offset;
    }

    if (pos.clientY > vh * 0.58 || pos.clientY + offset + tooltipHeight > vh - 24) {
      top = pos.clientY - tooltipHeight - offset;
    } else {
      top = pos.clientY + offset;
    }

    left = Math.max(16, Math.min(vw - tooltipWidth - 20, left));
    top = Math.max(16, Math.min(vh - tooltipHeight - 20, top));

    return { left, top };
  });

  // Series bounds for strips
  const wtBounds = createMemo(() => {
    const f = frames();
    if (f.length === 0) return { min: -2.5, max: 0.0 };
    const vals = f.map((x) => x.wt);
    return { min: Math.min(...vals, -2.5), max: Math.max(...vals, 0.0) };
  });

  const smBounds = createMemo(() => {
    const f = frames();
    if (f.length === 0) return { min: 20.0, max: 60.0 };
    const vals = f.map((x) => x.sm);
    return { min: Math.min(...vals, 20.0), max: Math.max(...vals, 60.0) };
  });

  const rfBounds = createMemo(() => {
    const f = frames();
    if (f.length === 0) return { min: 0.0, max: 0.005 };
    const vals = f.map((x) => x.rf);
    return { min: 0.0, max: Math.max(...vals, 0.005) };
  });

  const tempBounds = createMemo(() => {
    const f = frames();
    if (f.length === 0) return { min: 30.0, max: 42.0 };
    const vals = f.map((x) => x.temp);
    return { min: Math.min(...vals, 30.0), max: Math.max(...vals, 42.0) };
  });

  // Mouse interaction handlers (Hover crosshair, Brush zoom, Click-to-scrub, Wheel-zoom)
  const handleChartMouseMove = (e: MouseEvent, chartName: string, svgElement: SVGSVGElement) => {
    const rect = svgElement.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const xInSvg = ((clientX - rect.left) / rect.width) * 850;
    const [wMin, wMax] = effectiveWindow();
    const frameT = svgXToT(xInSvg, wMin, wMax);

    setHoverT(frameT);
    setHoverPos({
      x: xInSvg,
      y: ((clientY - rect.top) / rect.height) * (chartName === "hero" ? HERO_HEIGHT : STRIP_HEIGHT),
      chartName,
      clientX,
      clientY,
    });

    const b = brushState();
    if (b && b.isDragging) {
      setBrushState({
        ...b,
        currentT: frameT,
        currentX: xInSvg,
      });
      if (Math.abs(xInSvg - b.startX) <= 15) {
        scrubTo(frameT);
      }
    }
  };

  const handleChartMouseDown = (e: MouseEvent, chartName: string, svgElement: SVGSVGElement) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = svgElement.getBoundingClientRect();
    const xInSvg = ((e.clientX - rect.left) / rect.width) * 850;
    const [wMin, wMax] = effectiveWindow();
    const frameT = svgXToT(xInSvg, wMin, wMax);

    scrubTo(frameT);

    setBrushState({
      isDragging: true,
      startT: frameT,
      currentT: frameT,
      startX: xInSvg,
      currentX: xInSvg,
      chartName,
    });
  };

  const handleChartMouseUp = () => {
    const b = brushState();
    if (!b) return;

    const diffX = Math.abs(b.currentX - b.startX);
    if (diffX > 15) {
      const minT = Math.min(b.startT, b.currentT);
      const maxT = Math.max(b.startT, b.currentT);
      if (maxT - minT >= 2) {
        setXWindow([minT, maxT]);
      }
    } else {
      scrubTo(b.currentT);
    }
    setBrushState(null);
  };

  const handleMinimapMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (!minimapSvgRef) return;

    const rect = minimapSvgRef.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * OVERVIEW_SVG_WIDTH;
    const frac = Math.max(0, Math.min(1, (clickX - OVERVIEW_PLOT_LEFT) / OVERVIEW_PLOT_WIDTH));
    const clickedT = Math.round(1 + frac * (totalN() - 1));

    const [wMin, wMax] = effectiveWindow();
    const span = wMax - wMin;

    let targetMin = wMin;
    let targetMax = wMax;
    let targetT = t();

    if (clickedT >= wMin && clickedT <= wMax && isZoomed()) {
      targetMin = wMin;
      targetMax = wMax;
      targetT = t();
    } else if (isZoomed()) {
      const half = Math.round(span / 2);
      targetMin = Math.max(1, Math.min(totalN() - span, clickedT - half));
      targetMax = targetMin + span;
      targetT = clickedT;
      setXWindow([targetMin, targetMax]);
      scrubTo(targetT);
    } else {
      scrubTo(clickedT);
      targetT = clickedT;
    }

    minimapDragState = {
      startX: e.clientX,
      startWMin: targetMin,
      startWMax: targetMax,
      startT: targetT,
    };
    isMinimapDragging = true;
  };

  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (isMinimapDragging && minimapDragState && minimapSvgRef) {
      e.preventDefault();
      const rect = minimapSvgRef.getBoundingClientRect();
      const deltaPx = e.clientX - minimapDragState.startX;
      const plotPixelWidth = rect.width * (OVERVIEW_PLOT_WIDTH / OVERVIEW_SVG_WIDTH);
      const deltaFrames = Math.round((deltaPx / plotPixelWidth) * (totalN() - 1));

      const span = minimapDragState.startWMax - minimapDragState.startWMin;
      let newMin = minimapDragState.startWMin + deltaFrames;
      let newMax = minimapDragState.startWMax + deltaFrames;

      if (newMin < 1) {
        newMin = 1;
        newMax = 1 + span;
      }
      if (newMax > totalN()) {
        newMax = totalN();
        newMin = totalN() - span;
      }
      newMin = Math.max(1, newMin);
      newMax = Math.min(totalN(), newMax);

      setXWindow([newMin, newMax]);

      const deltaShift = newMin - minimapDragState.startWMin;
      const newT = Math.max(1, Math.min(totalN(), minimapDragState.startT + deltaShift));
      scrubTo(newT);
    }
  };

  const handleGlobalMouseUp = () => {
    handleChartMouseUp();
    if (isMinimapDragging) {
      isMinimapDragging = false;
      minimapDragState = null;
    }
  };

  const handleChartMouseLeave = () => {
    setHoverT(null);
    setHoverPos(null);
  };

  const handleChartWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.25 : 0.8;
    zoomBy(factor, hoverT() ?? t());
  };

  // Export handlers
  const handleExportCsv = async () => {
    const rId = props.runId || playback.selectedRunId || "sim";
    setIsExporting(true);
    setShowExportMenu(false);

    try {
      const res = await exportFramesCsv(frames(), rId);
      if (res.isSaved) {
        toast.success(tCatalog().playerExportSuccess(res.fileName));
      }
    } catch (e) {
      toast.error(`Export error: ${String(e)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadFramesJson = async () => {
    const fList = frames();
    if (fList.length === 0) return;
    setShowExportMenu(false);

    const rId = props.runId || playback.selectedRunId || "run";
    try {
      const res = await exportFramesJson(fList, rId);
      if (res.isSaved) {
        toast.success(tCatalog().playerExportSuccess(res.fileName));
      }
    } catch (e) {
      toast.error(`Export error: ${String(e)}`);
    }
  };

  const clearOverlay = () => {
    setView("overlayFrames", null);
    setView("overlayRunId", null);
    toast.info("Comparison overlay cleared.");
  };

  return (
    <div class="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2.5 space-y-2 transition-colors relative select-none">
      {/* Hidden File Input for Importing Simulation Data (.json / .csv) */}
      <input
        ref={(el) => (fileInputRef = el)}
        type="file"
        accept=".json,.csv,text/csv,application/json"
        class="hidden"
        onChange={handleFileSelected}
      />

      {/* Header Bar */}
      <PlayerHeader
        manifest={manifest()}
        frames={frames()}
        currentFrame={currentFrame()}
        overlayFrame={overlayFrame()}
        t={t()}
        totalN={totalN()}
        playerMode={playerMode()}
        onPlayerModeChange={setPlayerMode}
        isZoomed={isZoomed()}
        zoomPercentage={zoomPercentage()}
        onZoomBy={zoomBy}
        onResetZoom={resetZoom}
        onZoomToForecast={zoomToForecast}
        onImportClick={handleImportRunClick}
        onExportCsv={handleExportCsv}
        onDownloadFramesJson={handleDownloadFramesJson}
        isExporting={isExporting()}
        showExportMenu={showExportMenu()}
        onToggleExportMenu={() => setShowExportMenu(!showExportMenu())}
        showModelDetails={showModelDetails()}
        onToggleModelDetails={() => setShowModelDetails(!showModelDetails())}
        onClearOverlay={clearOverlay}
        onOpenShortcuts={() => setView("showShortcuts", true)}
        showPlaybook={showPlaybook()}
        onTogglePlaybook={() => setShowPlaybook(!showPlaybook())}
      />
      {/* Main Visualizations Area */}
      <div
        class={`flex-1 min-h-0 ${
          playerMode() === "trend"
            ? "overflow-y-auto space-y-2 pr-1 custom-scrollbar"
            : "overflow-hidden flex flex-col"
        } select-none`}
      >
        <Show
          when={frames().length > 0}
          fallback={
            <div class="h-96 flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg mx-auto my-8 shadow-xs">
              <div class="mb-4">
                <Show
                  when={loading()}
                  fallback={
                    <div class="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                      <Play size={24} class="fill-emerald-500 ml-1" />
                    </div>
                  }
                >
                  <CircularProgress progress={0.5} size={64} strokeWidth={6} />
                </Show>
              </div>

              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
                {tCatalog().playerNoSimulationTitle}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-5 leading-relaxed">
                {tCatalog().playerNoSimulationDesc}
              </p>

              <Show when={errorMsg()}>
                <div class="p-2.5 mb-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-mono">
                  {errorMsg()}
                </div>
              </Show>

              <div class="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => navigateTab("train")}
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors flex items-center space-x-2 cursor-pointer"
                >
                  <Cpu size={14} />
                  <span>{tCatalog().playerGoToTraining}</span>
                </button>
                <button
                  type="button"
                  onClick={handleImportRunClick}
                  class="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-colors flex items-center space-x-2 cursor-pointer"
                >
                  <Upload size={14} />
                  <span>{tCatalog().playerImportRun}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateTab("runs")}
                  class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center space-x-2 border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  <Layers size={14} />
                  <span>{tCatalog().playerSelectFromRuns}</span>
                </button>
              </div>
            </div>
          }
        >
          {/* Mode 1: Trend Player (Strips + Hero + DataZoom Minimap) */}
          <div
            class={`w-full flex-col space-y-2 select-none ${
              playerMode() === "trend" ? "flex" : "hidden"
            }`}
          >
            <PlayerEnvironmentalStrips
              frames={frames()}
              t={t()}
              currentFrame={currentFrame()}
              hoveredFrame={hoveredFrame()}
              effectiveWindow={effectiveWindow()}
              isZoomed={isZoomed()}
              holdoutRange={holdoutRange()}
              forecastStartT={forecastStartT()}
              zeroLineVisible={zeroLineVisible()}
              onToggleZeroLine={() => setZeroLineVisible(!zeroLineVisible())}
              wtBounds={wtBounds()}
              smBounds={smBounds()}
              rfBounds={rfBounds()}
              tempBounds={tempBounds()}
              holdoutPatternId={holdoutPatternId()}
              chartClipId={chartClipId()}
              stripClipId={stripClipId()}
              cursorSvgX={cursorSvgX()}
              brushState={brushState()}
              onChartMouseMove={handleChartMouseMove}
              onChartMouseDown={handleChartMouseDown}
              onChartMouseUp={handleChartMouseUp}
              onChartMouseLeave={handleChartMouseLeave}
              onChartWheel={handleChartWheel}
            />

            <PlayerHeroChart
              frames={frames()}
              t={t()}
              currentFrame={currentFrame()}
              hoveredFrame={hoveredFrame()}
              hoveredOverlayFrame={hoveredOverlayFrame()}
              effectiveWindow={effectiveWindow()}
              isZoomed={isZoomed()}
              zoomPercentage={zoomPercentage()}
              holdoutRange={holdoutRange()}
              forecastStartT={forecastStartT()}
              zeroLineVisible={zeroLineVisible()}
              chartClipId={chartClipId()}
              holdoutPatternId={holdoutPatternId()}
              cursorSvgX={cursorSvgX()}
              hoverT={hoverT()}
              brushState={brushState()}
              onChartMouseMove={handleChartMouseMove}
              onChartMouseDown={handleChartMouseDown}
              onChartMouseUp={handleChartMouseUp}
              onChartMouseLeave={handleChartMouseLeave}
              onChartWheel={handleChartWheel}
              onMinimapMouseDown={handleMinimapMouseDown}
              onResetZoom={resetZoom}
              minimapRef={(el) => (minimapSvgRef = el)}
            />
          </div>

          {/* Mode 2: 3D Land Heatmap View (Persisted in DOM - never unmounted) */}
          <div
            class={`w-full h-full flex-1 min-h-0 relative overflow-hidden ${
              playerMode() === "3d" ? "flex flex-col" : "hidden"
            }`}
          >
            <Land3DView
              frames={frames()}
              t={t()}
              currentFrame={currentFrame()}
              theme={view.theme}
              speed={speed()}
              isPlaying={transport() === "playing"}
              onScrub={scrubTo}
              visible={playerMode() === "3d"}
            />
          </div>
        </Show>
      </div>

      {/* Floating Synced Hover Tooltip Card */}
      <Show when={playerMode() === "trend"}>
        <PlayerHoverTooltip
          tooltipCoords={tooltipCoords()}
          hoveredFrame={hoveredFrame()}
          hoveredOverlayFrame={hoveredOverlayFrame()}
          totalN={totalN()}
        />
      </Show>

      {/* Model Determinism & Provenance Popover Modal */}
      <PlayerModelDetailsModal
        open={showModelDetails()}
        onClose={() => setShowModelDetails(false)}
        manifest={manifest()}
        runId={props.runId}
      />

      {/* Mitigation Playbook Modal */}
      <PlaybookModal
        open={showPlaybook()}
        onClose={() => setShowPlaybook(false)}
        activeClass={currentFrame()?.class || "Low"}
        currentPfvi={currentFrame()?.pfvi}
      />
      <PlayerTransportBar
        t={t()}
        totalN={totalN()}
        transport={transport()}
        speed={speed()}
        loop={loop()}
        manifest={manifest()}
        onScrub={scrubTo}
        onStepBy={stepBy}
        onTogglePlayPause={togglePlayPause}
        onJumpToForecastStart={() => {
          const fc = forecastStartT();
          if (fc) scrubTo(fc);
        }}
        onToggleLoop={toggleLoop}
        onSpeedChange={updateSpeed}
      />
    </div>
  );
};

export default PlayerPage;
