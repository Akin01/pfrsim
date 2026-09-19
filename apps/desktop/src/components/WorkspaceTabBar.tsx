import { Component, createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import {
  BarChart3,
  ChevronDown,
  Compass,
  Cpu,
  Database,
  Layers,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-solid";
import { catalogs } from "../i18n/catalog";
import {
  activateWorkspaceTab,
  activeWorkspaceTabId,
  closeActiveTab,
  closeAllTabs,
  closeOtherTabs,
  closeWorkspaceTab,
  currentLang,
  getPageTitle,
  openWorkspaceTab,
  reorderWorkspaceTabs,
  view,
  workspaceTabs,
  type WorkspaceTab,
} from "../lib/store";
export const WorkspaceTabBar: Component = () => {
  const t = () => catalogs[view.lang];
  const [isOpen, setIsOpen] = createSignal(false);
  const [search, setSearch] = createSignal("");
  const [isOverflowing, setIsOverflowing] = createSignal(false);

  const getTabTitle = (tab: WorkspaceTab) => {
    if (tab.type !== "player") {
      return getPageTitle(tab.type, currentLang());
    }
    return tab.title;
  };
  const [contextMenu, setContextMenu] = createSignal<{
    isOpen: boolean;
    x: number;
    y: number;
    tab: WorkspaceTab | null;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    tab: null,
  });

  let tabStripRef: HTMLDivElement | undefined = undefined;
  let dropdownRef: HTMLDivElement | undefined = undefined;
  let contextMenuRef: HTMLDivElement | undefined = undefined;
  // Tab drag-and-drop live reordering state (Fluid 60fps browser-tab experience)
  const [draggingTabId, setDraggingTabId] = createSignal<string | null>(null);
  let pointerStartX = 0;
  let isDraggingTab = false;
  let currentPointerId: number | null = null;
  let originIndex = -1;
  let targetIndex = -1;
  let measuredRects: Array<{ id: string; left: number; width: number; right: number }> = [];
  let tabElements: HTMLElement[] = [];
  let draggedEl: HTMLElement | null = null;

  const resetTabStyles = () => {
    tabElements.forEach((el) => {
      el.style.transform = "";
      el.style.transition = "";
      el.style.zIndex = "";
    });
    if (draggedEl) {
      draggedEl.style.transform = "";
      draggedEl.style.transition = "";
      draggedEl.style.zIndex = "";
      draggedEl = null;
    }
  };

  const handleTabPointerDown = (e: PointerEvent, tabId: string) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button")) return;

    if (!tabStripRef) return;

    tabElements = Array.from(tabStripRef.querySelectorAll<HTMLElement>("[data-workspace-tab-id]"));
    if (tabElements.length <= 1) return;

    measuredRects = tabElements.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: el.getAttribute("data-workspace-tab-id") || "",
        left: r.left,
        width: r.width,
        right: r.right,
      };
    });

    originIndex = measuredRects.findIndex((r) => r.id === tabId);
    if (originIndex === -1) return;
    targetIndex = originIndex;

    pointerStartX = e.clientX;
    isDraggingTab = false;
    currentPointerId = e.pointerId;
    setDraggingTabId(tabId);
    draggedEl = e.currentTarget as HTMLElement;

    try {
      draggedEl.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleTabPointerMove = (e: PointerEvent, tabId: string) => {
    if (draggingTabId() !== tabId || !draggedEl || originIndex === -1 || measuredRects.length <= 1)
      return;

    const dx = e.clientX - pointerStartX;
    if (!isDraggingTab && Math.abs(dx) > 3) {
      isDraggingTab = true;
    }

    if (!isDraggingTab) return;

    // 1. Fluid 1:1 hardware-accelerated translation on dragged tab (0ms latency, feels physical)
    draggedEl.style.transition = "none";
    draggedEl.style.transform = `translateX(${dx}px)`;
    draggedEl.style.zIndex = "50";

    // 2. Compute current virtual center of dragged tab
    const draggedWidth = measuredRects[originIndex].width;
    const draggedCenter = measuredRects[originIndex].left + draggedWidth / 2 + dx;

    // 3. Find target slot index
    let newTarget = originIndex;
    if (dx > 0) {
      for (let k = originIndex + 1; k < measuredRects.length; k++) {
        const siblingCenter = measuredRects[k].left + measuredRects[k].width / 2;
        if (draggedCenter > siblingCenter) {
          newTarget = k;
        }
      }
    } else if (dx < 0) {
      for (let k = originIndex - 1; k >= 0; k--) {
        const siblingCenter = measuredRects[k].left + measuredRects[k].width / 2;
        if (draggedCenter < siblingCenter) {
          newTarget = k;
        }
      }
    }
    targetIndex = newTarget;

    // 4. Smoothly shift sibling tabs with CSS transition to make room for dragged tab
    const gap = 6;
    for (let k = 0; k < tabElements.length; k++) {
      if (k === originIndex) continue;
      const siblingEl = tabElements[k];
      if (!siblingEl) continue;

      let shiftX = 0;
      if (originIndex < targetIndex && k > originIndex && k <= targetIndex) {
        shiftX = -(draggedWidth + gap);
      } else if (originIndex > targetIndex && k >= targetIndex && k < originIndex) {
        shiftX = draggedWidth + gap;
      }

      siblingEl.style.transition = "transform 180ms cubic-bezier(0.2, 0, 0, 1)";
      siblingEl.style.transform = shiftX !== 0 ? `translateX(${shiftX}px)` : "translateX(0px)";
    }
  };

  const handleTabPointerUp = (_e: PointerEvent, tabId: string) => {
    if (currentPointerId !== null && draggedEl) {
      try {
        draggedEl.releasePointerCapture(currentPointerId);
      } catch {}
      currentPointerId = null;
    }

    const wasDragging = isDraggingTab;
    const fromIdx = originIndex;
    const toIdx = targetIndex;
    const activeEl = draggedEl;

    isDraggingTab = false;
    originIndex = -1;
    targetIndex = -1;

    // Case 1: Simple click without dragging -> Activate Tab
    if (!wasDragging || fromIdx === -1 || toIdx === -1 || fromIdx === toIdx || !activeEl) {
      resetTabStyles();
      setDraggingTabId(null);
      if (!wasDragging) {
        activateWorkspaceTab(tabId);
      }
      return;
    }

    // Case 2: Smooth fluid snap into the target slot!
    let snapOffset = 0;
    if (toIdx > fromIdx) {
      snapOffset =
        measuredRects[toIdx].right - measuredRects[fromIdx].width - measuredRects[fromIdx].left;
    } else {
      snapOffset = measuredRects[toIdx].left - measuredRects[fromIdx].left;
    }

    activeEl.style.transition = "transform 160ms cubic-bezier(0.2, 0, 0, 1)";
    activeEl.style.transform = `translateX(${snapOffset}px)`;

    setTimeout(() => {
      resetTabStyles();
      reorderWorkspaceTabs(fromIdx, toIdx);
      setDraggingTabId(null);
    }, 160);
  };

  const handleTabPointerCancel = () => {
    resetTabStyles();
    setDraggingTabId(null);
    isDraggingTab = false;
    currentPointerId = null;
  };

  const closeContextMenu = () => {
    if (contextMenu().isOpen) {
      setContextMenu((prev) => ({ ...prev, isOpen: false, tab: null }));
    }
  };

  const handleContextMenu = (e: MouseEvent, tab: WorkspaceTab | null) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOpen()) {
      setIsOpen(false);
    }

    const menuWidth = 190;
    const menuHeight = 120;
    const padding = 8;
    const x = Math.max(padding, Math.min(e.clientX, window.innerWidth - menuWidth - padding));
    const y = Math.max(padding, Math.min(e.clientY, window.innerHeight - menuHeight - padding));

    setContextMenu({
      isOpen: true,
      x,
      y,
      tab,
    });
  };

  const contextTargetTab = () =>
    contextMenu().tab ||
    workspaceTabs().find((t) => t.id === activeWorkspaceTabId()) ||
    workspaceTabs()[0];
  const isContextTargetCurrent = () =>
    !contextMenu().tab || contextMenu().tab?.id === activeWorkspaceTabId();
  const canCloseOtherTabs = () => workspaceTabs().length > 1;
  const checkOverflow = () => {
    if (tabStripRef) {
      const hasOverflow = tabStripRef.scrollWidth > tabStripRef.clientWidth + 4;
      setIsOverflowing(hasOverflow);
    }
  };

  createEffect(() => {
    void workspaceTabs().length;
    void activeWorkspaceTabId();
    setTimeout(checkOverflow, 40);
  });

  // Keyboard shortcuts (Ctrl+W / Alt+W / Ctrl+F4 to close active tab, Esc to close dropdown / context menu)
  const handleKeyDown = (e: KeyboardEvent) => {
    const isW = e.key?.toLowerCase() === "w" || e.code === "KeyW";
    const isF4 = e.key === "F4" || e.code === "F4";
    const isClose =
      ((e.ctrlKey || e.metaKey) && isW) || (e.altKey && isW) || ((e.ctrlKey || e.metaKey) && isF4);

    if (isClose) {
      e.preventDefault();
      e.stopPropagation();
      closeContextMenu();
      closeActiveTab();
    } else if (e.key === "Escape" || e.code === "Escape") {
      if (contextMenu().isOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeContextMenu();
      } else if (isOpen()) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    }
  };
  onMount(() => {
    checkOverflow();
    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", checkOverflow);
    window.addEventListener("resize", closeContextMenu);
    window.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("blur", closeContextMenu);

    // ResizeObserver for accurate tab strip bounds tracking
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && tabStripRef) {
      observer = new ResizeObserver(() => checkOverflow());
      observer.observe(tabStripRef);
    }

    // Outside click to close dropdown and context menu
    const handleOutsideClick = (e: Event) => {
      if (contextMenu().isOpen) {
        const target = (e as MouseEvent | PointerEvent).target as Node | null;
        if (!contextMenuRef || !target || !contextMenuRef.contains(target)) {
          closeContextMenu();
        }
      }
      if (dropdownRef && e.target && !dropdownRef.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handleOutsideClick, true);
    window.addEventListener("mousedown", handleOutsideClick, true);
    window.addEventListener("click", handleOutsideClick, true);
    document.addEventListener("pointerdown", handleOutsideClick, true);
    document.addEventListener("mousedown", handleOutsideClick, true);
    document.addEventListener("click", handleOutsideClick, true);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", closeContextMenu);
      window.removeEventListener("scroll", closeContextMenu, true);
      window.removeEventListener("blur", closeContextMenu);
      window.removeEventListener("pointerdown", handleOutsideClick, true);
      window.removeEventListener("mousedown", handleOutsideClick, true);
      window.removeEventListener("click", handleOutsideClick, true);
      document.removeEventListener("pointerdown", handleOutsideClick, true);
      document.removeEventListener("mousedown", handleOutsideClick, true);
      document.removeEventListener("click", handleOutsideClick, true);
      if (observer) observer.disconnect();
    });
  });

  const getTabIcon = (type: string) => {
    switch (type) {
      case "player":
        return <Play size={11} class="text-emerald-500 fill-emerald-500 shrink-0" />;
      case "runs":
        return <BarChart3 size={12} class="text-emerald-500 shrink-0" />;
      case "train":
        return <Cpu size={12} class="text-cyan-500 shrink-0" />;
      case "data":
        return <Database size={12} class="text-blue-500 shrink-0" />;
      case "onboarding":
      default:
        return <Compass size={12} class="text-amber-500 shrink-0" />;
    }
  };

  return (
    <div
      onContextMenu={(e) => handleContextMenu(e, null)}
      class="h-9.5 bg-white dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between px-2 gap-1.5 select-none shrink-0 z-20 transition-colors relative"
    >
      {/* Left: Open Tabs Strip (overflow-hidden, no horizontal scroll) */}
      <div
        ref={(el) => (tabStripRef = el)}
        class="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden py-1"
      >
        <For each={workspaceTabs()}>
          {(tab) => {
            const isActive = () => activeWorkspaceTabId() === tab.id;
            const isBeingDragged = () => draggingTabId() === tab.id;

            return (
              <div
                data-workspace-tab-id={tab.id}
                onPointerDown={(e) => handleTabPointerDown(e, tab.id)}
                onPointerMove={(e) => handleTabPointerMove(e, tab.id)}
                onPointerUp={(e) => handleTabPointerUp(e, tab.id)}
                onPointerCancel={handleTabPointerCancel}
                onContextMenu={(e) => handleContextMenu(e, tab)}
                onAuxClick={(e) => {
                  // Middle click (wheel click) closes the tab
                  if (e.button === 1 && tab.closable) {
                    e.preventDefault();
                    closeWorkspaceTab(tab.id);
                  }
                }}
                class={`group relative flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors duration-150 cursor-pointer shrink min-w-17.5 max-w-50 truncate select-none ${
                  isBeingDragged()
                    ? "z-30 shadow-lg bg-white dark:bg-slate-800 border-emerald-500 ring-2 ring-emerald-500/40"
                    : isActive()
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 shadow-xs font-semibold"
                      : "border border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 font-medium"
                }`}
                title={`${getTabTitle(tab)} (${tab.type})`}
              >
                {getTabIcon(tab.type)}
                <span class="truncate">{getTabTitle(tab)}</span>

                <Show when={tab.closable}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeWorkspaceTab(tab.id);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    class="w-4 h-4 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors opacity-60 group-hover:opacity-100 cursor-pointer shrink-0 ml-0.5"
                    title="Close tab (Ctrl+W / Alt+W)"
                  >
                    <X size={10} stroke-width={2.5} />
                  </button>
                </Show>
              </div>
            );
          }}
        </For>

        {/* Plus / New Tab Button */}
        <button
          type="button"
          onClick={() =>
            openWorkspaceTab({
              id: `onboarding-${Date.now()}`,
              type: "onboarding",
              title: t().onboardingTab,
              closable: true,
            })
          }
          class="w-6.5 h-6.5 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer shrink-0 ml-0.5"
          title={t().newTabTooltip}
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Right: Tab Overflow Dropdown & Counter */}
      <div
        ref={(el) => (dropdownRef = el)}
        class="relative flex items-center space-x-1.5 shrink-0 pl-1"
      >
        {/* Dropdown Toggle Button */}
        <button
          id="tab-overflow-dropdown-btn"
          type="button"
          onClick={() => setIsOpen(!isOpen())}
          class={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
            isOpen()
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
              : isOverflowing()
                ? "bg-amber-100/90 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/90 dark:border-amber-700/80 shadow-xs ring-1 ring-amber-500/20"
                : "bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent"
          }`}
          title={isOverflowing() ? t().openTabsTitle : t().openTabsTitle}
        >
          <Layers size={12} class="shrink-0" />
          <span class="text-[10px] font-bold">{workspaceTabs().length}</span>
          <ChevronDown
            size={11}
            class={`transition-transform duration-150 ${isOpen() ? "rotate-180" : ""}`}
          />
        </button>

        {/* Floating Dropdown Menu */}
        <Show when={isOpen()}>
          <div
            id="tab-overflow-dropdown-menu"
            class="absolute right-0 top-full mt-1.5 w-76 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2 space-y-2 text-xs font-mono backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Dropdown Header */}
            <div class="flex items-center justify-between px-1 pb-1 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              <span class="font-bold text-slate-700 dark:text-slate-300">
                {t().openTabsTitle} ({workspaceTabs().length})
              </span>
              <Show when={isOverflowing()}>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
                  {t().overflowBadge}
                </span>
              </Show>
            </div>

            {/* Quick Filter Input (when 4+ tabs) */}
            <Show when={workspaceTabs().length >= 4}>
              <div class="relative flex items-center">
                <Search size={12} class="absolute left-2 text-slate-400 pointer-events-none" />
                <input
                  placeholder={t().searchTabsPlaceholder}
                  value={search()}
                  onInput={(e) => setSearch(e.currentTarget.value)}
                  class="w-full pl-6 pr-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </Show>

            {/* List of open tabs */}
            <div class="max-h-64 overflow-y-auto space-y-1 pr-0.5">
              <For
                each={workspaceTabs().filter(
                  (t) =>
                    !search() ||
                    t.title.toLowerCase().includes(search().toLowerCase()) ||
                    t.type.includes(search().toLowerCase()),
                )}
              >
                {(tab) => {
                  const isActive = () => activeWorkspaceTabId() === tab.id;

                  return (
                    <div
                      onClick={() => {
                        activateWorkspaceTab(tab.id);
                        setIsOpen(false);
                      }}
                      onContextMenu={(e) => handleContextMenu(e, tab)}
                      class={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                        isActive()
                          ? "bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-300/80 dark:border-emerald-700/60 shadow-2xs font-semibold"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 border border-transparent"
                      }`}
                    >
                      <div class="flex items-center space-x-2 min-w-0 flex-1">
                        {getTabIcon(tab.type)}
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-xs">{getTabTitle(tab)}</p>
                          <p class="text-[9px] text-slate-400 dark:text-slate-500 font-mono capitalize">
                            {tab.type === "player" ? "Simulation" : tab.type}
                          </p>
                        </div>
                      </div>

                      <div class="flex items-center space-x-1.5 shrink-0 pl-2">
                        <Show when={isActive()}>
                          <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60">
                            Active
                          </span>
                        </Show>
                        <Show when={tab.closable}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              closeWorkspaceTab(tab.id);
                            }}
                            class="w-4 h-4 rounded flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            title="Close tab"
                          >
                            <X size={10} stroke-width={2.5} />
                          </button>
                        </Show>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>

            {/* Dropdown Footer: Quick Actions */}
            <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => {
                  closeAllTabs();
                  setIsOpen(false);
                }}
                class="hover:text-rose-600 dark:hover:text-rose-400 flex items-center space-x-1 cursor-pointer transition-colors"
                title={t().closeAllTooltip}
              >
                <X size={11} />
                <span>{t().closeAllTabs}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  openWorkspaceTab({
                    id: `onboarding-${Date.now()}`,
                    type: "onboarding",
                    title: t().onboardingTab,
                    closable: true,
                  });
                  setIsOpen(false);
                }}
                class="hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Plus size={11} />
                <span>{t().newTab}</span>
              </button>
            </div>
          </div>
        </Show>
      </div>

      {/* Tab Context Menu */}
      <Show when={contextMenu().isOpen}>
        <Portal>
          {/* Backdrop overlay to close context menu on click anywhere outside */}
          <div
            class="fixed inset-0 z-9998 bg-transparent cursor-default select-none"
            style={{ "pointer-events": "auto" }}
            onPointerDown={() => closeContextMenu()}
            onMouseDown={() => closeContextMenu()}
            onClick={() => closeContextMenu()}
            onContextMenu={(e) => {
              e.preventDefault();
              closeContextMenu();
            }}
          />

          <div
            ref={(el) => (contextMenuRef = el)}
            class="fixed z-9999 min-w-47.5 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-2xl p-1 text-xs font-mono select-none backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: `${contextMenu().x}px`,
              top: `${contextMenu().y}px`,
            }}
            onClick={(e) => {
              const target = e.target as HTMLElement | null;
              if (!target?.closest("button")) {
                closeContextMenu();
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {/* Option 1: Close Tab / Close Current Tab */}
            <button
              type="button"
              onClick={() => {
                const target = contextTargetTab();
                if (target) {
                  closeWorkspaceTab(target.id);
                }
                closeContextMenu();
              }}
              class="group w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-300 transition-colors cursor-pointer text-left"
            >
              <div class="flex items-center space-x-2 min-w-0">
                <X
                  size={13}
                  class="text-slate-400 group-hover:text-rose-500 transition-colors shrink-0"
                />
                <span class="truncate">
                  {isContextTargetCurrent() ? t().closeCurrentTab : t().closeTab}
                </span>
              </div>
              <Show when={isContextTargetCurrent()}>
                <span class="text-[9px] text-slate-400 dark:text-slate-500 font-sans ml-2 shrink-0">
                  Ctrl+W
                </span>
              </Show>
            </button>

            {/* Option 2: Close Other Tabs */}
            <button
              type="button"
              disabled={!canCloseOtherTabs()}
              onClick={() => {
                const target = contextTargetTab();
                if (target && canCloseOtherTabs()) {
                  closeOtherTabs(target.id);
                }
                closeContextMenu();
              }}
              class={`group w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                !canCloseOtherTabs()
                  ? "opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-600"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              }`}
            >
              <Layers
                size={13}
                class="text-slate-400 group-hover:text-amber-500 transition-colors shrink-0"
              />
              <span class="truncate">{t().closeOtherTabs}</span>
            </button>

            <div class="my-1 border-t border-slate-100 dark:border-slate-800/80" />

            {/* Option 3: Close All Tabs */}
            <button
              type="button"
              onClick={() => {
                closeAllTabs();
                closeContextMenu();
              }}
              class="group w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-300 transition-colors cursor-pointer text-left"
            >
              <Trash2
                size={13}
                class="text-slate-400 group-hover:text-rose-500 transition-colors shrink-0"
              />
              <span class="truncate">{t().closeAllTabs}</span>
            </button>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
