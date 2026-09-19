import { Component, createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import {
  ArrowRight,
  Check,
  Database,
  FileSpreadsheet,
  GripVertical,
  Link,
  Pencil,
  RefreshCw,
  Sparkles,
  Table,
  Unlink,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-solid";
import type { DatasetInspection } from "../lib/types";
import { datasetImportMapped } from "../lib/tauri";
import { view } from "../lib/store";

export interface ColumnMapperProps {
  inspection: DatasetInspection;
  rawBytes?: number[];
  filePath?: string;
  onImportSuccess: (datasetId: string) => void;
  onCancel: () => void;
}

interface SystemVar {
  key: string;
  label: string;
  name: string;
  unit: string;
  required: boolean;
  color: string;
  darkColor: string;
  border: string;
  activeBg: string;
}

const SYSTEM_VARIABLES: SystemVar[] = [
  {
    key: "WT",
    label: "WT",
    name: "Water Table (Muka Air Gambut)",
    unit: "m (negative = below surface)",
    required: true,
    color: "#0284c7",
    darkColor: "#0ea5e9",
    border: "border-sky-500",
    activeBg: "bg-sky-500/15",
  },
  {
    key: "SM",
    label: "SM",
    name: "Soil Moisture (Kelembaban Tanah)",
    unit: "%",
    required: true,
    color: "#059669",
    darkColor: "#10b981",
    border: "border-emerald-500",
    activeBg: "bg-emerald-500/15",
  },
  {
    key: "Rf",
    label: "Rf",
    name: "Rainfall (Curah Hujan)",
    unit: "mm",
    required: true,
    color: "#2563eb",
    darkColor: "#3b82f6",
    border: "border-blue-500",
    activeBg: "bg-blue-500/15",
  },
  {
    key: "Temp",
    label: "Temp",
    name: "Temperature (Suhu Udara)",
    unit: "°C",
    required: true,
    color: "#e11d48",
    darkColor: "#f43f5e",
    border: "border-rose-500",
    activeBg: "bg-rose-500/15",
  },
  {
    key: "Time",
    label: "Time",
    name: "Time / Date (Waktu / Tanggal)",
    unit: "ISO date or index (optional)",
    required: false,
    color: "#d97706",
    darkColor: "#f59e0b",
    border: "border-amber-500",
    activeBg: "bg-amber-500/15",
  },
];

export const ColumnMapperCanvas: Component<ColumnMapperProps> = (props) => {
  // Mapping state: Target Var Key -> Source Column Name
  const [mapping, setMapping] = createSignal<Record<string, string>>({
    ...props.inspection.suggested_mapping,
  });

  const isDark = () => view.theme === "dark";
  const getSysColor = (sys: SystemVar) => (isDark() ? sys.darkColor : sys.color);

  const [selectedSource, setSelectedSource] = createSignal<string | null>(null);
  const [selectedTarget, setSelectedTarget] = createSignal<string | null>(null);

  // Drag-to-connect state (Draw.io style interactive wire)
  const [activeDrag, setActiveDrag] = createSignal<{
    sourceCol: string;
    startX: number;
    startY: number;
  } | null>(null);
  const [mousePos, setMousePos] = createSignal<{ x: number; y: number } | null>(null);

  const [importing, setImporting] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);
  const [datasetName, setDatasetName] = createSignal(props.inspection.file_name);
  const [isEditingName, setIsEditingName] = createSignal(false);

  const getFinalDatasetName = () => {
    const raw = datasetName().trim();
    // When left as default filename (or empty), append timestamp
    const isDefault = !raw || raw === props.inspection.file_name;
    if (isDefault) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const hh = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      const ts = `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;

      const base = props.inspection.file_name.replace(/\.[^/.]+$/, "");
      return `${base}_${ts}`;
    }
    return raw;
  };
  const [zoom, setZoom] = createSignal(1);
  const [canvasPan, setCanvasPan] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomIn = () => setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(2))));
  const zoomOut = () => setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(2))));
  const resetZoom = () => {
    setZoom(1);
    setCanvasPan({ x: 0, y: 0 });
  };
  const [showPreview, setShowPreview] = createSignal(false);
  const [sourcePorts, setSourcePorts] = createSignal<Record<string, { x: number; y: number }>>({});
  const [targetPorts, setTargetPorts] = createSignal<Record<string, { x: number; y: number }>>({});

  let canvasRef: HTMLDivElement | undefined;
  let contentRef: HTMLDivElement | undefined;
  let resizeObs: ResizeObserver | undefined;

  // Draggable Left and Right Table Nodes (Draw.io style)
  const [leftTablePos, setLeftTablePos] = createSignal<{ x: number; y: number }>({ x: 24, y: 24 });
  const [rightTablePos, setRightTablePos] = createSignal<{ x: number; y: number }>({
    x: 520,
    y: 24,
  });
  const [draggingNode, setDraggingNode] = createSignal<"left" | "right" | null>(null);
  let nodeDragStartMouse = { x: 0, y: 0 };
  let nodeDragStartPos = { x: 0, y: 0 };
  const cachedLeftOffsets: Record<string, { x: number; y: number }> = {};
  const cachedRightOffsets: Record<string, { x: number; y: number }> = {};
  const startDragNode = (node: "left" | "right", e: PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Don't drag node if clicking socket port, button, or link
    if (target.closest("[data-port]") || target.closest("button")) return;

    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    setDraggingNode(node);
    nodeDragStartMouse = { x: e.clientX, y: e.clientY };
    nodeDragStartPos = node === "left" ? { ...leftTablePos() } : { ...rightTablePos() };
  };

  const onNodePointerMove = (e: PointerEvent) => {
    const node = draggingNode();
    if (!node) return;

    const currentZoom = zoom();
    const dx = (e.clientX - nodeDragStartMouse.x) / currentZoom;
    const dy = (e.clientY - nodeDragStartMouse.y) / currentZoom;

    const newX = Math.round(nodeDragStartPos.x + dx);
    const newY = Math.round(nodeDragStartPos.y + dy);

    if (node === "left") {
      setLeftTablePos({ x: newX, y: newY });
      const nextPorts: Record<string, { x: number; y: number }> = {};
      for (const [idx, col] of props.inspection.detected_columns.entries()) {
        const off = cachedLeftOffsets[col] ?? { x: 280, y: 45 + idx * 56 + 28 };
        nextPorts[col] = { x: newX + off.x, y: newY + off.y };
      }
      setSourcePorts(nextPorts);
    } else {
      setRightTablePos({ x: newX, y: newY });
      const nextPorts: Record<string, { x: number; y: number }> = {};
      for (const [idx, sys] of SYSTEM_VARIABLES.entries()) {
        const off = cachedRightOffsets[sys.key] ?? { x: 22, y: 45 + idx * 56 + 28 };
        nextPorts[sys.key] = { x: newX + off.x, y: newY + off.y };
      }
      setTargetPorts(nextPorts);
    }
  };
  const onNodePointerUp = (e: PointerEvent) => {
    if (!draggingNode()) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setDraggingNode(null);
    updatePorts();
  };

  // Window-level pointer tracking for boundary-free node dragging
  createEffect(() => {
    const node = draggingNode();
    if (!node) return;

    const handleWindowNodeMove = (e: PointerEvent) => {
      const currentZoom = zoom();
      const dx = (e.clientX - nodeDragStartMouse.x) / currentZoom;
      const dy = (e.clientY - nodeDragStartMouse.y) / currentZoom;

      const newX = Math.round(nodeDragStartPos.x + dx);
      const newY = Math.round(nodeDragStartPos.y + dy);

      if (node === "left") {
        setLeftTablePos({ x: newX, y: newY });
        const nextPorts: Record<string, { x: number; y: number }> = {};
        for (const [idx, col] of props.inspection.detected_columns.entries()) {
          const off = cachedLeftOffsets[col] ?? { x: 280, y: 45 + idx * 56 + 28 };
          nextPorts[col] = { x: newX + off.x, y: newY + off.y };
        }
        setSourcePorts(nextPorts);
      } else {
        setRightTablePos({ x: newX, y: newY });
        const nextPorts: Record<string, { x: number; y: number }> = {};
        for (const [idx, sys] of SYSTEM_VARIABLES.entries()) {
          const off = cachedRightOffsets[sys.key] ?? { x: 22, y: 45 + idx * 56 + 28 };
          nextPorts[sys.key] = { x: newX + off.x, y: newY + off.y };
        }
        setTargetPorts(nextPorts);
      }
    };

    const handleWindowNodeUp = () => {
      setDraggingNode(null);
      updatePorts();
    };

    window.addEventListener("pointermove", handleWindowNodeMove);
    window.addEventListener("pointerup", handleWindowNodeUp);

    onCleanup(() => {
      window.removeEventListener("pointermove", handleWindowNodeMove);
      window.removeEventListener("pointerup", handleWindowNodeUp);
    });
  });
  const isWheelOverCanvas = (e: WheelEvent): boolean => {
    if (!canvasRef) return false;

    // 1. Direct DOM tree check (safe for non-Node targets like Window)
    const target = e.target;
    if (target && target instanceof Node && (canvasRef === target || canvasRef.contains(target))) {
      return true;
    }

    // 2. Cursor coordinate check within canvas viewport bounds
    const rect = canvasRef.getBoundingClientRect();
    if (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    ) {
      return true;
    }

    // 3. Fallback when target is document/window (e.g. synthetic gestures from WebView2 / DirectManipulation)
    if (
      (!e.clientX && !e.clientY) ||
      target === document.body ||
      target === document.documentElement ||
      target === window ||
      target === document
    ) {
      if (e.clientX > 0 || e.clientY > 0) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el && (canvasRef === el || canvasRef.contains(el))) {
          return true;
        }
      } else {
        return true;
      }
    }

    return false;
  };

  // Multi-modal Touchpad & Mouse Zoom Engine
  const handleZoomWheel = (e: WheelEvent) => {
    if (!isWheelOverCanvas(e)) return;

    // If holding space, wheel scrolls / pans the canvas in any direction without boundary
    if (isSpacePressed()) {
      setCanvasPan((prev) => ({
        x: prev.x - (e.deltaX || 0),
        y: prev.y - (e.deltaY || 0),
      }));
      return;
    }

    // When space is not pressed: touchpad pinch, two-finger scroll, or mouse wheel ALWAYS ZOOMS!
    e.preventDefault();
    e.stopPropagation();

    let zoomDelta = 0;
    if (Math.abs(e.deltaY) < 40) {
      // Continuous touchpad pinch or two-finger scroll: smooth proportional adjustment
      zoomDelta = -e.deltaY * 0.005;
    } else {
      // Discrete mouse wheel notch
      zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
    }

    setZoom((z) => {
      const next = Math.min(1.5, Math.max(0.6, z + zoomDelta));
      return Number(next.toFixed(3));
    });
  };

  // Canvas Spacebar Panning (Draw.io / Figma style)
  const [isSpacePressed, setIsSpacePressed] = createSignal(false);
  const [isPanningCanvas, setIsPanningCanvas] = createSignal(false);
  let canvasPanStart = { x: 0, y: 0, startPanX: 0, startPanY: 0 };

  createEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          zoomIn();
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          zoomOut();
        } else if (e.key === "0") {
          e.preventDefault();
          resetZoom();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
        setIsPanningCanvas(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    onCleanup(() => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    });
  });

  // Multi-touch pointer tracking for touch screen / multi-touch touchpad pinch
  const activePointers = new Map<number, { x: number; y: number }>();
  let initialPinchDistance = 0;
  let initialPinchZoom = 1;

  const onCanvasPointerDown = (e: PointerEvent) => {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-finger touch pinch-to-zoom initialization
    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialPinchZoom = zoom();
      setIsPanningCanvas(false);
      return;
    }

    // Canvas pan MUST ONLY activate when space is pressed (single pointer)
    if (activePointers.size === 1 && e.button === 0 && isSpacePressed()) {
      e.preventDefault();
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      setIsPanningCanvas(true);
      canvasPanStart = {
        x: e.clientX,
        y: e.clientY,
        startPanX: canvasPan().x,
        startPanY: canvasPan().y,
      };
    }
  };

  const onCanvasPointerMove = (e: PointerEvent) => {
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Two-finger touch pinch-to-zoom
    if (activePointers.size === 2 && initialPinchDistance > 0) {
      e.preventDefault();
      const pts = Array.from(activePointers.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const scale = currentDist / initialPinchDistance;
      const next = Math.min(1.5, Math.max(0.6, initialPinchZoom * scale));
      setZoom(Number(next.toFixed(3)));
      return;
    }

    if (isPanningCanvas()) {
      e.preventDefault();
      const dx = e.clientX - canvasPanStart.x;
      const dy = e.clientY - canvasPanStart.y;
      setCanvasPan({
        x: canvasPanStart.startPanX + dx,
        y: canvasPanStart.startPanY + dy,
      });
    } else {
      handleCanvasMouseMove(e);
    }
  };

  const onCanvasPointerUp = (e: PointerEvent) => {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) {
      initialPinchDistance = 0;
    }
    if (isPanningCanvas()) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setIsPanningCanvas(false);
    }
    handleCanvasMouseUp();
  };

  // Window-level pointer tracking for boundary-free infinite canvas pan
  createEffect(() => {
    if (!isPanningCanvas()) return;

    const handleWindowPanMove = (e: PointerEvent) => {
      e.preventDefault();
      const dx = e.clientX - canvasPanStart.x;
      const dy = e.clientY - canvasPanStart.y;
      setCanvasPan({
        x: canvasPanStart.startPanX + dx,
        y: canvasPanStart.startPanY + dy,
      });
    };

    const handleWindowPanUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) {
        initialPinchDistance = 0;
      }
      setIsPanningCanvas(false);
      handleCanvasMouseUp();
    };

    window.addEventListener("pointermove", handleWindowPanMove);
    window.addEventListener("pointerup", handleWindowPanUp);

    onCleanup(() => {
      window.removeEventListener("pointermove", handleWindowPanMove);
      window.removeEventListener("pointerup", handleWindowPanUp);
    });
  });
  // Drag horizontal scrolling for preview table (direct scrollLeft manipulation)
  const [isDraggingTable, setIsDraggingTable] = createSignal(false);
  let tableDragStartX = 0;
  let tableDragStartScrollLeft = 0;
  let tableContainerRef: HTMLDivElement | undefined;

  const onTablePointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || !tableContainerRef) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input")) return;

    // Do not interfere if user is clicking directly on the scrollbar track or thumb
    const rect = tableContainerRef.getBoundingClientRect();
    if (e.clientY - rect.top >= tableContainerRef.clientHeight) return;

    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setIsDraggingTable(true);
    tableDragStartX = e.clientX;
    tableDragStartScrollLeft = tableContainerRef.scrollLeft;
  };

  const onTablePointerMove = (e: PointerEvent) => {
    if (!isDraggingTable() || !tableContainerRef) return;
    e.preventDefault();
    const deltaX = e.clientX - tableDragStartX;
    tableContainerRef.scrollLeft = tableDragStartScrollLeft - deltaX;
  };

  const onTablePointerUp = (e: PointerEvent) => {
    if (!isDraggingTable()) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setIsDraggingTable(false);
  };
  const canvasContentWidth = () =>
    Math.max(680, Math.max(leftTablePos().x + 300, rightTablePos().x + 320));
  const canvasContentHeight = () =>
    Math.max(460, Math.max(leftTablePos().y + 360, rightTablePos().y + 360));

  const updatePorts = () => {
    const root = contentRef || canvasRef;
    if (!root) return;
    const currentZoom = zoom();

    const leftCard = root.querySelector('[data-node="left"]') as HTMLElement | null;
    const rightCard = root.querySelector('[data-node="right"]') as HTMLElement | null;
    const leftCardRect = leftCard?.getBoundingClientRect();
    const rightCardRect = rightCard?.getBoundingClientRect();

    const sPorts: Record<string, { x: number; y: number }> = {};
    for (const [idx, col] of props.inspection.detected_columns.entries()) {
      const el = root.querySelector(`[data-port="source-${col}"]`) as HTMLElement | null;
      let offX = 280;
      let offY = 45 + idx * 56 + 28;
      if (el && leftCardRect && leftCardRect.width > 0 && currentZoom > 0) {
        const elRect = el.getBoundingClientRect();
        offX = (elRect.left - leftCardRect.left + elRect.width / 2) / currentZoom;
        offY = (elRect.top - leftCardRect.top + elRect.height / 2) / currentZoom;
      }
      cachedLeftOffsets[col] = { x: offX, y: offY };
      sPorts[col] = {
        x: leftTablePos().x + offX,
        y: leftTablePos().y + offY,
      };
    }
    setSourcePorts(sPorts);

    const tPorts: Record<string, { x: number; y: number }> = {};
    for (const [idx, sys] of SYSTEM_VARIABLES.entries()) {
      const el = root.querySelector(`[data-port="target-${sys.key}"]`) as HTMLElement | null;
      let offX = 22;
      let offY = 45 + idx * 56 + 28;
      if (el && rightCardRect && rightCardRect.width > 0 && currentZoom > 0) {
        const elRect = el.getBoundingClientRect();
        offX = (elRect.left - rightCardRect.left + elRect.width / 2) / currentZoom;
        offY = (elRect.top - rightCardRect.top + elRect.height / 2) / currentZoom;
      }
      cachedRightOffsets[sys.key] = { x: offX, y: offY };
      tPorts[sys.key] = {
        x: rightTablePos().x + offX,
        y: rightTablePos().y + offY,
      };
    }
    setTargetPorts(tPorts);
  };

  onMount(() => {
    if (canvasRef) {
      const w = canvasRef.clientWidth / zoom();
      const rx = Math.max(320, Math.round(w - 320));
      setRightTablePos({ x: rx, y: 24 });
    }
    updatePorts();

    // 1. Wheel & Precision Touchpad Pinch-to-Zoom (capture phase ensures e.preventDefault() works before WebView defaults)
    const onWindowWheel = (e: WheelEvent) => {
      handleZoomWheel(e);
    };
    window.addEventListener("wheel", onWindowWheel, { passive: false, capture: true });

    // 2. Safari / WebKit Trackpad Pinch Gestures
    let initialGestureZoom = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      initialGestureZoom = zoom();
    };
    const onGestureChange = (e: Event & { scale?: number }) => {
      e.preventDefault();
      if (typeof e.scale === "number") {
        const next = Math.min(1.5, Math.max(0.6, initialGestureZoom * e.scale));
        setZoom(Number(next.toFixed(3)));
      }
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
    };

    if (canvasRef) {
      canvasRef.addEventListener("gesturestart", onGestureStart as EventListener, {
        passive: false,
      });
      canvasRef.addEventListener("gesturechange", onGestureChange as EventListener, {
        passive: false,
      });
      canvasRef.addEventListener("gestureend", onGestureEnd as EventListener, { passive: false });
    }

    if (typeof ResizeObserver !== "undefined" && canvasRef) {
      resizeObs = new ResizeObserver(() => {
        updatePorts();
      });
      resizeObs.observe(canvasRef);
    }
    window.addEventListener("resize", updatePorts);
    setTimeout(updatePorts, 50);
    setTimeout(updatePorts, 200);

    onCleanup(() => {
      window.removeEventListener("wheel", onWindowWheel, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", updatePorts);
      if (canvasRef) {
        canvasRef.removeEventListener("gesturestart", onGestureStart as EventListener);
        canvasRef.removeEventListener("gesturechange", onGestureChange as EventListener);
        canvasRef.removeEventListener("gestureend", onGestureEnd as EventListener);
      }
      if (resizeObs && canvasRef) {
        resizeObs.disconnect();
      }
    });
  });

  createEffect(() => {
    if (props.inspection) {
      setTimeout(updatePorts, 50);
    }
  });

  createEffect(() => {
    zoom();
    updatePorts();
    setTimeout(updatePorts, 20);
  });

  // Active dragging spline calculation (fine-grained, updates path without DOM re-mount)
  const draggingPath = () => {
    const drag = activeDrag();
    const m = mousePos();
    if (!drag || !m) return "";
    const x1 = drag.startX;
    const y1 = drag.startY;
    const x2 = m.x;
    const y2 = m.y;
    const dx = Math.max(30, Math.abs(x2 - x1) * 0.45);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };

  createEffect(() => {
    if (!activeDrag()) return;

    const handleWindowMove = (e: MouseEvent | PointerEvent) => {
      const root = contentRef || canvasRef;
      if (!root) return;
      const r = root.getBoundingClientRect();
      const currentZoom = zoom();
      setMousePos({
        x: (e.clientX - r.left) / currentZoom,
        y: (e.clientY - r.top) / currentZoom,
      });
    };

    const handleWindowUp = (e: MouseEvent | PointerEvent) => {
      const drag = activeDrag();
      if (drag) {
        // Inspect element directly under cursor on release
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const targetRow = el?.closest("[id^='target-row-']") as HTMLElement | null;
        const targetPort = el?.closest("[data-port^='target-']") as HTMLElement | null;
        const targetId = targetRow?.id || targetPort?.getAttribute("data-port");

        if (targetId) {
          const key = targetId.replace("target-row-", "").replace("target-", "");
          if (key) {
            connect(key, drag.sourceCol);
          }
        }
      }
      setTimeout(() => {
        setActiveDrag(null);
      }, 20);
    };

    window.addEventListener("pointermove", handleWindowMove);
    window.addEventListener("pointerup", handleWindowUp);
    window.addEventListener("mousemove", handleWindowMove);
    window.addEventListener("mouseup", handleWindowUp);

    onCleanup(() => {
      window.removeEventListener("pointermove", handleWindowMove);
      window.removeEventListener("pointerup", handleWindowUp);
      window.removeEventListener("mousemove", handleWindowMove);
      window.removeEventListener("mouseup", handleWindowUp);
    });
  });

  // Track mouse coordinates over canvas for live dragging wire
  const handleCanvasMouseMove = (e: MouseEvent | PointerEvent) => {
    const root = contentRef || canvasRef;
    if (!root || !activeDrag()) return;
    const r = root.getBoundingClientRect();
    const currentZoom = zoom();
    setMousePos({
      x: (e.clientX - r.left) / currentZoom,
      y: (e.clientY - r.top) / currentZoom,
    });
  };

  const handleCanvasMouseUp = () => {
    if (activeDrag()) {
      setActiveDrag(null);
    }
  };

  // Start dragging from source port
  const startDragFromSource = (col: string, e: MouseEvent | PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const port = sourcePorts()[col];
    const root = contentRef || canvasRef;
    if (port && root) {
      const r = root.getBoundingClientRect();
      const currentZoom = zoom();
      setMousePos({
        x: (e.clientX - r.left) / currentZoom,
        y: (e.clientY - r.top) / currentZoom,
      });
      setActiveDrag({ sourceCol: col, startX: port.x, startY: port.y });
    }
  };

  // Drop on target port
  const dropOnTarget = (targetKey: string, e: MouseEvent | PointerEvent) => {
    e.stopPropagation();
    const drag = activeDrag();
    if (drag) {
      connect(targetKey, drag.sourceCol);
      setActiveDrag(null);
    }
  };
  // Click-to-connect handling (alternative to drag)
  const handleSelectSource = (colName: string) => {
    if (selectedTarget()) {
      connect(selectedTarget()!, colName);
      setSelectedTarget(null);
      setSelectedSource(null);
    } else {
      setSelectedSource((prev) => (prev === colName ? null : colName));
    }
  };

  const handleSelectTarget = (targetKey: string) => {
    if (selectedSource()) {
      connect(targetKey, selectedSource()!);
      setSelectedSource(null);
      setSelectedTarget(null);
    } else {
      setSelectedTarget((prev) => (prev === targetKey ? null : targetKey));
    }
  };

  const connect = (targetKey: string, sourceCol: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[k] === sourceCol && k !== targetKey) {
          delete next[k];
        }
      }
      next[targetKey] = sourceCol;
      return next;
    });
    setTimeout(updatePorts, 30);
  };

  const disconnect = (targetKey: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      delete next[targetKey];
      return next;
    });
    setTimeout(updatePorts, 30);
  };

  const disconnectAll = () => {
    setMapping({});
    setSelectedSource(null);
    setSelectedTarget(null);
    setTimeout(updatePorts, 30);
  };

  const resetToSuggested = () => {
    setMapping({ ...props.inspection.suggested_mapping });
    setSelectedSource(null);
    setSelectedTarget(null);
    setTimeout(updatePorts, 30);
  };

  const mappedCount = () => {
    const m = mapping();
    return SYSTEM_VARIABLES.filter((s) => s.required && Boolean(m[s.key])).length;
  };

  const isReady = () => mappedCount() === 4;

  const handleImport = async () => {
    if (!isReady()) return;
    setImporting(true);
    setErrorMsg(null);
    try {
      const res = await datasetImportMapped(
        props.inspection.file_name,
        mapping(),
        props.filePath,
        props.rawBytes,
        getFinalDatasetName(),
      );
      if (res.ok) {
        props.onImportSuccess(res.data.dataset_id);
      } else {
        setErrorMsg(`Import validation failed [${res.code}]: ${res.message}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(`Failed to import dataset: ${msg}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div class="space-y-4 select-none pb-2 relative">
      {/* Active Processing / Ingestion Overlay */}
      <Show when={importing()}>
        <div class="absolute inset-0 bg-white/85 dark:bg-slate-900/90 backdrop-blur-xs z-50 flex flex-col items-center justify-center space-y-4 rounded-3xl animate-in fade-in duration-150">
          <div class="relative flex items-center justify-center">
            <div class="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
            <Database size={24} class="absolute text-emerald-600 dark:text-emerald-400" />
          </div>
          <div class="text-center space-y-1.5 max-w-sm px-4">
            <p class="text-sm font-bold text-slate-900 dark:text-slate-100">
              {view.lang === "id"
                ? "Memproses & Menyimpan Dataset..."
                : "Processing & Storing Dataset..."}
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {view.lang === "id"
                ? `${props.inspection.row_count_estimate.toLocaleString()} baris sedang diindeks dan disimpan...`
                : `${props.inspection.row_count_estimate.toLocaleString()} rows being indexed and persisted...`}
            </p>
          </div>
        </div>
      </Show>
      {/* 1. Integrated Header & Toolbar */}
      <div class="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-200/80 dark:border-slate-800/80">
        <div class="flex-1 min-w-60">
          <Show
            when={isEditingName()}
            fallback={
              <div class="flex items-center space-x-2">
                <h2 class="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono truncate max-w-70 sm:max-w-90">
                  {datasetName()}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  class="p-1 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title={view.lang === "id" ? "Ubah nama dataset" : "Edit dataset name"}
                >
                  <Pencil size={13} />
                </button>
              </div>
            }
          >
            <div class="flex items-center space-x-1.5">
              <input
                ref={(el) => setTimeout(() => el?.focus(), 20)}
                type="text"
                value={datasetName()}
                onInput={(e) => setDatasetName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setIsEditingName(false);
                  } else if (e.key === "Escape") {
                    setDatasetName(props.inspection.file_name);
                    setIsEditingName(false);
                  }
                }}
                onBlur={() => setIsEditingName(false)}
                class="text-xs font-mono font-bold px-2.5 py-1 rounded-lg border border-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 w-full max-w-65 sm:max-w-[320px]"
                title="Press Enter to confirm or Escape to reset"
              />
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                class="p-1 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                title="Done editing"
              >
                <Check size={14} />
              </button>
            </div>
          </Show>
          <p class="text-[10px] text-slate-400 dark:text-slate-400 font-mono mt-0.5">
            {props.inspection.detected_columns.length} cols · ~{props.inspection.row_count_estimate}{" "}
            rows
          </p>
        </div>
        {/* Toolbar buttons */}
        <div class="flex items-center space-x-2 text-xs">
          <button
            type="button"
            onClick={resetToSuggested}
            class="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-semibold transition-colors flex items-center space-x-1.5 border border-emerald-300 dark:border-emerald-700/80 shadow-xs"
            title="Auto-detect matches using fuzzy column heuristics"
          >
            <Sparkles size={13} />
            <span>{view.lang === "id" ? "Otomatis" : "Auto-Map"}</span>
          </button>

          <button
            type="button"
            onClick={disconnectAll}
            class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/90 text-slate-600 dark:text-slate-300 text-xs transition-colors border border-slate-200 dark:border-slate-700/80 flex items-center space-x-1 shadow-xs"
            title="Disconnect all wires"
          >
            <Unlink size={12} />
            <span>{view.lang === "id" ? "Reset" : "Reset"}</span>
          </button>
        </div>
      </div>

      <Show when={errorMsg()}>
        <div class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-300 text-xs font-mono flex items-center justify-between">
          <span>{errorMsg()}</span>
          <button onClick={() => setErrorMsg(null)} class="text-rose-400 font-bold">
            <X size={14} />
          </button>
        </div>
      </Show>

      {/* 2. Draw.io Canvas Window Frame (Stationary Outer Frame) */}
      <div class="relative bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/90 rounded-2xl shadow-sm dark:shadow-inner overflow-hidden h-115 min-h-105">
        {/* Scrollable / Pannable Canvas Viewport */}
        <div
          ref={(el) => {
            canvasRef = el;
          }}
          onWheel={handleZoomWheel}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
          class={`w-full h-full p-3 md:px-5 md:pt-4 md:pb-2 overflow-hidden select-none touch-none ${
            isPanningCanvas()
              ? "cursor-grabbing"
              : isSpacePressed()
                ? "cursor-grab"
                : "cursor-default"
          }`}
          style={{
            "background-image": isDark()
              ? "radial-gradient(rgba(148, 163, 184, 0.16) 1.2px, transparent 1.2px)"
              : "radial-gradient(rgba(100, 116, 139, 0.28) 1.2px, transparent 1.2px)",
            "background-size": `${22 * zoom()}px ${22 * zoom()}px`,
            "background-position": `${canvasPan().x}px ${canvasPan().y}px`,
          }}
        >
          {/* Scalable & Infinite Pannable Content Layer */}
          <div
            ref={(el) => {
              contentRef = el;
            }}
            class="relative origin-top-left"
            style={{
              transform: `translate3d(${canvasPan().x}px, ${canvasPan().y}px, 0) scale(${zoom()})`,
              "transform-origin": "0 0",
              width: `${canvasContentWidth()}px`,
              height: `${canvasContentHeight()}px`,
            }}
          >
            {/* Node 1 (Left Table): Source Schema Entity (Draggable Node) */}
            <div
              data-node="left"
              onPointerDown={(e) => startDragNode("left", e)}
              onPointerMove={onNodePointerMove}
              onPointerUp={onNodePointerUp}
              onPointerCancel={onNodePointerUp}
              class={`absolute w-70 md:w-75 bg-white dark:bg-slate-900 border rounded-2xl shadow-md dark:shadow-2xl dark:shadow-black/60 overflow-hidden z-10 select-none transition-shadow ${
                draggingNode() === "left"
                  ? "border-emerald-500 ring-2 ring-emerald-500/40 shadow-2xl shadow-emerald-950/40 cursor-grabbing"
                  : "border-slate-200 dark:border-slate-700/80 cursor-grab hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700"
              }`}
              style={{
                left: `${leftTablePos().x}px`,
                top: `${leftTablePos().y}px`,
              }}
            >
              {/* Entity Header */}
              <div class="bg-slate-100/80 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700/80 px-4 py-3 flex items-center justify-between cursor-grab active:cursor-grabbing">
                <div class="flex items-center space-x-2">
                  <GripVertical size={14} class="text-slate-400 dark:text-slate-500 shrink-0" />
                  <FileSpreadsheet
                    size={15}
                    class="text-emerald-500 dark:text-emerald-400 shrink-0"
                  />
                  <span class="text-xs font-bold font-mono text-slate-800 dark:text-slate-100 truncate max-w-40">
                    {props.inspection.file_name}
                  </span>
                </div>
                <span class="text-[9px] font-mono uppercase px-2 py-0.5 rounded-md bg-slate-200 dark:bg-emerald-500/10 text-slate-700 dark:text-emerald-400 border border-slate-300/80 dark:border-emerald-500/25 font-bold tracking-wider">
                  {props.inspection.format}
                </span>
              </div>

              <div class="divide-y divide-slate-100 dark:divide-slate-800">
                <For each={props.inspection.detected_columns}>
                  {(col) => {
                    const isMappedTo = () => {
                      const m = mapping();
                      return Object.keys(m).find((k) => m[k] === col);
                    };
                    const isSelected = () => selectedSource() === col;
                    const targetVar = () => {
                      const key = isMappedTo();
                      return SYSTEM_VARIABLES.find((s) => s.key === key);
                    };

                    return (
                      <div
                        id={`source-row-${col}`}
                        onClick={() => handleSelectSource(col)}
                        class={`relative h-14 px-3.5 flex items-center justify-between transition-colors cursor-pointer group ${
                          isSelected()
                            ? "bg-emerald-50 dark:bg-emerald-950/60 ring-1 ring-inset ring-emerald-500/50"
                            : isMappedTo()
                              ? "bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
                              : "hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <div class="pr-3 overflow-hidden">
                          <span
                            class={`text-xs font-bold font-mono block truncate ${
                              isMappedTo()
                                ? "text-slate-900 dark:text-slate-100"
                                : "text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100"
                            }`}
                          >
                            {col}
                          </span>
                          <span class="text-[10px] text-slate-400 dark:text-slate-400 font-mono block truncate">
                            Sample: {props.inspection.sample_rows[0]?.[col] ?? "null"}
                          </span>
                        </div>

                        <div class="flex items-center space-x-2 shrink-0">
                          <Show when={targetVar()}>
                            <span
                              class="text-[10px] font-mono px-2 py-0.5 rounded-md font-bold border shrink-0 transition-all flex items-center space-x-1"
                              style={{
                                color: getSysColor(targetVar()!),
                                "border-color":
                                  getSysColor(targetVar()!) + (isDark() ? "50" : "40"),
                                "background-color":
                                  getSysColor(targetVar()!) + (isDark() ? "20" : "15"),
                              }}
                            >
                              <span>→</span>
                              <span>{targetVar()!.key}</span>
                            </span>
                          </Show>

                          {/* Interactive Source Output Socket Port */}
                          <div
                            id={`source-port-${col}`}
                            data-port={`source-${col}`}
                            onPointerDown={(e) => startDragFromSource(col, e)}
                            onMouseDown={(e) => startDragFromSource(col, e)}
                            class="w-4.5 h-4.5 rounded-full border-2 transition-all flex items-center justify-center cursor-crosshair group-hover:scale-125 shadow-xs shrink-0"
                            style={{
                              "border-color": targetVar()
                                ? getSysColor(targetVar()!)
                                : isDark()
                                  ? "#475569"
                                  : "#94a3b8",
                              "background-color": targetVar()
                                ? getSysColor(targetVar()!)
                                : isDark()
                                  ? "#0f172a"
                                  : "#ffffff",
                              "box-shadow":
                                targetVar() && isDark()
                                  ? `0 0 10px ${getSysColor(targetVar()!)}70`
                                  : undefined,
                            }}
                            title={`Drag from ${col} to a target variable`}
                          >
                            <Show when={targetVar()}>
                              <div class="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                            </Show>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* Node 2 (Right Table): Target System Variables Entity (Draggable Node) */}
            <div
              data-node="right"
              onPointerDown={(e) => startDragNode("right", e)}
              onPointerMove={onNodePointerMove}
              onPointerUp={onNodePointerUp}
              onPointerCancel={onNodePointerUp}
              class={`absolute w-75 md:w-82.5 bg-white dark:bg-slate-900 border rounded-2xl shadow-md dark:shadow-2xl dark:shadow-black/60 overflow-hidden z-10 select-none transition-shadow ${
                draggingNode() === "right"
                  ? "border-cyan-500 ring-2 ring-cyan-500/40 shadow-2xl cursor-grabbing"
                  : "border-slate-200 dark:border-slate-700/80 cursor-grab hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700"
              }`}
              style={{
                left: `${rightTablePos().x}px`,
                top: `${rightTablePos().y}px`,
              }}
            >
              {/* Entity Header */}
              <div class="bg-slate-100/80 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700/80 px-4 py-3 flex items-center justify-between cursor-grab active:cursor-grabbing">
                <div class="flex items-center space-x-2">
                  <GripVertical size={14} class="text-slate-400 dark:text-slate-500 shrink-0" />
                  <Database size={15} class="text-cyan-500 shrink-0" />
                  <span class="text-xs font-bold font-mono text-slate-800 dark:text-slate-100">
                    Target Variables
                  </span>
                </div>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-300/40 dark:border-slate-700">
                  4 Req · 1 Opt
                </span>
              </div>

              {/* Entity Rows */}
              <div class="divide-y divide-slate-100 dark:divide-slate-800">
                <For each={SYSTEM_VARIABLES}>
                  {(sys) => {
                    const mappedCol = () => mapping()[sys.key];
                    const isSelected = () => selectedTarget() === sys.key;

                    return (
                      <div
                        id={`target-row-${sys.key}`}
                        onClick={() => handleSelectTarget(sys.key)}
                        onPointerUp={(e) => dropOnTarget(sys.key, e)}
                        onMouseUp={(e) => dropOnTarget(sys.key, e)}
                        class={`relative h-14 px-3.5 flex items-center justify-between transition-colors cursor-pointer group ${
                          isSelected()
                            ? "bg-emerald-50 dark:bg-emerald-950/60 ring-1 ring-inset ring-emerald-500/50"
                            : mappedCol()
                              ? "bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
                              : "hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <div class="flex items-center space-x-3">
                          {/* Interactive Target Input Socket Port */}
                          <div
                            id={`target-port-${sys.key}`}
                            data-port={`target-${sys.key}`}
                            onPointerUp={(e) => dropOnTarget(sys.key, e)}
                            onMouseUp={(e) => dropOnTarget(sys.key, e)}
                            class="w-4.5 h-4.5 rounded-full border-2 transition-all flex items-center justify-center cursor-crosshair group-hover:scale-125 shadow-xs shrink-0"
                            style={{
                              "border-color": mappedCol()
                                ? getSysColor(sys)
                                : isDark()
                                  ? "#475569"
                                  : "#94a3b8",
                              "background-color": mappedCol()
                                ? getSysColor(sys)
                                : isDark()
                                  ? "#0f172a"
                                  : "#ffffff",
                              "box-shadow":
                                mappedCol() && isDark()
                                  ? `0 0 10px ${getSysColor(sys)}70`
                                  : undefined,
                            }}
                            title={`Drop wire or click to connect to ${sys.key}`}
                          >
                            <Show when={mappedCol()}>
                              <div class="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                            </Show>
                          </div>

                          {/* Variable Pill Badge */}
                          <div
                            class="w-6.5 h-6.5 rounded-lg flex items-center justify-center font-mono font-black text-[11px] text-white shadow-xs shrink-0"
                            style={{
                              "background-color": getSysColor(sys),
                              "box-shadow": isDark()
                                ? `0 2px 8px ${getSysColor(sys)}50`
                                : undefined,
                            }}
                          >
                            {sys.label}
                          </div>

                          <div class="overflow-hidden">
                            <div class="flex items-center space-x-1">
                              <span
                                class={`text-xs font-bold truncate ${
                                  mappedCol()
                                    ? "text-slate-900 dark:text-slate-100"
                                    : "text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100"
                                }`}
                              >
                                {sys.name}
                              </span>
                              <Show when={sys.required}>
                                <span class="text-[9px] font-bold text-rose-500 dark:text-rose-400">
                                  *
                                </span>
                              </Show>
                            </div>
                            <span class="text-[10px] text-slate-400 dark:text-slate-400 font-mono block truncate">
                              {sys.unit}
                            </span>
                          </div>
                        </div>

                        {/* Right: Wired / Unwire Icon Only (No check, No text) */}
                        <div class="flex items-center shrink-0 pl-2">
                          <Show
                            when={mappedCol()}
                            fallback={
                              <div
                                class="p-1.5 text-slate-300 dark:text-slate-600 cursor-pointer hover:text-slate-400 dark:hover:text-slate-400 transition-colors"
                                title="Unwired (Click or drag wire to connect)"
                              >
                                <Unlink size={14} class="opacity-50" />
                              </div>
                            }
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                disconnect(sys.key);
                              }}
                              class="p-1.5 rounded-lg text-emerald-500 dark:text-emerald-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 transition-all group/btn"
                              title={`Wired: ${mappedCol()} (Click to unwire)`}
                            >
                              <Link size={14} class="group-hover/btn:hidden" />
                              <Unlink size={14} class="hidden group-hover/btn:inline" />
                            </button>
                          </Show>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* SVG Connected Bezier Wires Layer (Draw.io style) */}
            <svg
              class="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
              style={{ overflow: "visible" }}
            >
              <For each={SYSTEM_VARIABLES}>
                {(sys) => {
                  const mappedCol = () => mapping()[sys.key];
                  const p1 = () => (mappedCol() ? sourcePorts()[mappedCol()!] : null);
                  const p2 = () => targetPorts()[sys.key];

                  return (
                    <Show when={p1() && p2()}>
                      {(() => {
                        const x1 = p1()!.x;
                        const y1 = p1()!.y;
                        const x2 = p2()!.x;
                        const y2 = p2()!.y;
                        const dx = Math.max(40, (x2 - x1) * 0.45);
                        return (
                          <g>
                            {/* Glow / Selection Aura */}
                            <path
                              d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                              fill="none"
                              stroke={getSysColor(sys)}
                              stroke-width={isDark() ? "9" : "8"}
                              stroke-opacity={isDark() ? "0.22" : "0.15"}
                            />
                            {/* Primary Bezier Wire */}
                            <path
                              d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                              fill="none"
                              stroke={getSysColor(sys)}
                              stroke-width="3"
                              stroke-linecap="round"
                              stroke-opacity={isDark() ? "0.95" : "0.9"}
                            />
                            {/* Anchor circle caps */}
                            <circle
                              cx={x1}
                              cy={y1}
                              r="5"
                              fill={getSysColor(sys)}
                              stroke={isDark() ? "#0f172a" : "#ffffff"}
                              stroke-width="2"
                            />
                            <circle
                              cx={x2}
                              cy={y2}
                              r="5"
                              fill={getSysColor(sys)}
                              stroke={isDark() ? "#0f172a" : "#ffffff"}
                              stroke-width="2"
                            />
                          </g>
                        );
                      })()}
                    </Show>
                  );
                }}
              </For>

              {/* Active Interactive Dragging Wire (smooth SVG attribute updates, zero re-mounts) */}
              <Show when={activeDrag()}>
                <g class="pointer-events-none">
                  {/* Glow aura */}
                  <path
                    d={draggingPath()}
                    fill="none"
                    stroke="#10b981"
                    stroke-width="7"
                    stroke-opacity={isDark() ? "0.3" : "0.2"}
                    stroke-linecap="round"
                  />
                  {/* Primary dashed dragging wire */}
                  <path
                    d={draggingPath()}
                    fill="none"
                    stroke="#10b981"
                    stroke-width="2.5"
                    stroke-dasharray="6,4"
                    stroke-linecap="round"
                  />
                  {/* Stable outer halo dot */}
                  <circle
                    cx={mousePos()?.x ?? 0}
                    cy={mousePos()?.y ?? 0}
                    r="9"
                    fill="#10b981"
                    fill-opacity={isDark() ? "0.3" : "0.22"}
                  />
                  {/* Stable core cursor dot */}
                  <circle
                    cx={mousePos()?.x ?? 0}
                    cy={mousePos()?.y ?? 0}
                    r="4.5"
                    fill="#10b981"
                    stroke={isDark() ? "#0f172a" : "#ffffff"}
                    stroke-width="1.5"
                  />
                </g>
              </Show>
            </svg>
          </div>
        </div>

        {/* FIXED Floating Canvas Trigger Button for Preview Table (Bottom-Left HUD) */}
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview())}
          class={`absolute bottom-3 left-3 z-20 flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-medium shadow-md backdrop-blur-md transition-all pointer-events-auto ${
            showPreview()
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/40"
              : "bg-white/95 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:border-slate-700 shadow-black/40"
          }`}
          title="Toggle Mapped Data Preview Table"
        >
          <Table
            size={13}
            class={showPreview() ? "text-white" : "text-emerald-500 dark:text-emerald-400"}
          />
          <span>{view.lang === "id" ? "Pratinjau Data" : "Preview Table"}</span>
        </button>

        {/* FIXED Floating Canvas Zoom Controls HUD (Bottom-Right HUD) */}
        <div class="absolute bottom-3 right-3 z-20 flex items-center space-x-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-1 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-black/40 pointer-events-auto">
          <button
            type="button"
            onClick={zoomOut}
            class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Zoom Out (Ctrl + Scroll Down)"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            class="px-2 py-0.5 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Reset Zoom to 100%"
          >
            {Math.round(zoom() * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Zoom In (Ctrl + Scroll Up)"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      {/* 3. Smooth Transition Sliding Preview Panel (Not Accordion) */}
      <div
        class={`transition-all duration-300 ease-in-out overflow-hidden ${
          showPreview()
            ? "opacity-100 max-h-95 translate-y-0"
            : "opacity-0 max-h-0 translate-y-3 pointer-events-none"
        }`}
      >
        <div class="border border-slate-200/90 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-xs dark:shadow-2xl dark:shadow-black/60 overflow-hidden p-3.5 space-y-2">
          {/* Panel Header */}
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <div class="flex items-center space-x-2.5">
              <div class="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Table size={13} />
              </div>
              <span class="font-bold text-xs font-mono text-slate-900 dark:text-slate-100">
                {view.lang === "id" ? "Pratinjau Data Terpetakan" : "Mapped Data Preview"}
              </span>
              <span class="text-[10px] text-slate-400 dark:text-slate-400 font-mono hidden sm:inline">
                (5 sample rows)
              </span>
              <span
                class={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  isReady()
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                }`}
              >
                {isReady()
                  ? view.lang === "id"
                    ? "Siap Diimpor"
                    : "Ready to Import"
                  : `${mappedCount()} / 4 Required`}
              </span>
            </div>

            <div class="flex items-center space-x-2">
              <span class="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                ↔ {view.lang === "id" ? "Geser horizontal" : "Drag or scroll horizontally"}
              </span>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Dismiss Preview"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Draggable Viewport with VISIBLE Horizontal Scrollbar */}
          <div
            ref={(el) => {
              tableContainerRef = el;
            }}
            onPointerDown={onTablePointerDown}
            onPointerMove={onTablePointerMove}
            onPointerUp={onTablePointerUp}
            onPointerCancel={onTablePointerUp}
            class={`border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto w-full select-none transition-shadow ${
              isDraggingTable()
                ? "cursor-grabbing ring-2 ring-emerald-500/40 bg-slate-50/50 dark:bg-slate-800/50"
                : "cursor-grab hover:border-slate-300 dark:hover:border-slate-700"
            }`}
            title="Click and drag anywhere to scroll horizontally"
          >
            <table class="text-xs text-left font-mono whitespace-nowrap min-w-275 w-max select-none">
              <thead class="bg-slate-100/70 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th class="px-3.5 py-3 w-12 text-center text-[10px] font-bold text-slate-400 bg-slate-100/90 dark:bg-slate-800/90 border-r border-slate-200 dark:border-slate-800 shrink-0">
                    #
                  </th>
                  <For each={SYSTEM_VARIABLES}>
                    {(sys) => {
                      const mappedCol = () => mapping()[sys.key];
                      return (
                        <th class="px-4 py-2.5 min-w-52.5 border-r border-slate-200/70 dark:border-slate-800/70 last:border-r-0">
                          <div class="flex items-center space-x-2">
                            <div
                              class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white font-mono shadow-2xs shrink-0"
                              style={{ "background-color": getSysColor(sys) }}
                            >
                              {sys.label}
                            </div>
                            <div class="overflow-hidden">
                              <span class="font-bold text-xs text-slate-800 dark:text-slate-200 block truncate">
                                {sys.name}
                              </span>
                              <span class="text-[10px] text-slate-400 dark:text-slate-400 font-normal font-mono block truncate">
                                {sys.unit}
                              </span>
                            </div>
                          </div>

                          {/* Source mapping pill */}
                          <div class="mt-1.5">
                            <Show
                              when={mappedCol()}
                              fallback={
                                <span class="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-medium">
                                  <span>!</span>
                                  <span>Unmapped</span>
                                </span>
                              }
                            >
                              <span class="inline-flex items-center space-x-1 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                <Link size={10} />
                                <span class="truncate max-w-32.5">{mappedCol()}</span>
                              </span>
                            </Show>
                          </div>
                        </th>
                      );
                    }}
                  </For>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
                <For each={props.inspection.sample_rows.slice(0, 5)}>
                  {(row, idx) => (
                    <tr class="even:bg-slate-50/40 dark:even:bg-slate-800/30 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 transition-colors">
                      <td class="px-3.5 py-2.5 text-center text-[10px] font-mono font-bold text-slate-400 bg-slate-50/80 dark:bg-slate-800/60 border-r border-slate-200/60 dark:border-slate-800/60 w-12 shrink-0">
                        {idx() + 1}
                      </td>
                      <For each={SYSTEM_VARIABLES}>
                        {(sys) => {
                          const colName = () => mapping()[sys.key];
                          const rawVal = () => (colName() ? row[colName()!] : undefined);

                          return (
                            <td class="px-4 py-2.5 font-mono text-xs tabular-nums text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800/40 last:border-r-0">
                              <Show
                                when={colName()}
                                fallback={
                                  <span class="text-slate-300 dark:text-slate-600 font-light text-[11px]">
                                    —
                                  </span>
                                }
                              >
                                <Show
                                  when={
                                    rawVal() !== undefined && rawVal() !== null && rawVal() !== ""
                                  }
                                  fallback={
                                    <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                      NA
                                    </span>
                                  }
                                >
                                  <span class="font-semibold text-slate-900 dark:text-slate-100">
                                    {String(rawVal())}
                                  </span>
                                </Show>
                              </Show>
                            </td>
                          );
                        }}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* 4. Confirmation & Import Action Bar */}
      <div class="sticky -bottom-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md -mx-5 -mb-5 px-5 py-3 border-t border-slate-200/80 dark:border-slate-800/80 rounded-b-3xl z-30 flex items-center justify-between shadow-xs mt-2">
        <div class="flex items-center space-x-3 text-xs">
          {/* x/x Required Counter Pill (Bottom Left of Modal) */}
          <div
            class={`px-3 py-1.5 rounded-xl border font-mono text-xs flex items-center space-x-2 font-bold shadow-2xs ${
              isReady()
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
            }`}
          >
            <span
              class={`w-2 h-2 rounded-full ${
                isReady() ? "bg-emerald-500 shadow-sm" : "bg-amber-500 animate-pulse"
              }`}
            />
            <span>{mappedCount()} / 4 Required</span>
          </div>

          <Show
            when={isReady()}
            fallback={
              <span class="text-amber-600 dark:text-amber-400 font-medium flex items-center space-x-1.5 sm:inline-flex">
                <span>⚠️</span>
                <span>
                  {view.lang === "id" ? "Sambungkan 4 variabel." : "Connect 4 variables."}
                </span>
              </span>
            }
          >
            <span class="text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1 sm:inline-flex">
              <Check size={14} />
              <span>{view.lang === "id" ? "Siap diimpor." : "Ready to import."}</span>
            </span>
          </Show>
        </div>

        <div class="flex items-center space-x-3">
          <button
            type="button"
            onClick={props.onCancel}
            class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition-colors border border-slate-300 dark:border-slate-700 cursor-pointer shadow-xs"
          >
            {view.lang === "id" ? "Batal" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!isReady() || importing()}
            class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40 hover:shadow-lg hover:shadow-emerald-950/60 flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>
              {importing()
                ? view.lang === "id"
                  ? "Mengimpor Data..."
                  : "Importing Data..."
                : view.lang === "id"
                  ? "Impor Dataset"
                  : "Import Dataset"}
            </span>
            <Show when={importing()} fallback={<ArrowRight size={14} />}>
              <RefreshCw size={14} class="animate-spin" />
            </Show>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColumnMapperCanvas;
