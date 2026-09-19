import { Component, createSignal, onCleanup, onMount, Show } from "solid-js";
import { useLocation } from "@solidjs/router";
import { Copy, Minus, PanelLeft, Square, X } from "lucide-solid";
import {
  closeWindow,
  getCurrentWindow,
  isTauri,
  isWindowMaximized,
  minimizeWindow,
  startDraggingWindow,
  toggleMaximizeWindow,
} from "../lib/tauri";
import {
  activeWorkspaceTabId,
  currentLang,
  getPageTitle,
  type TabType,
  toggleSidebar,
  workspaceTabs,
} from "../lib/store";

export const TitleBar: Component = () => {
  const location = useLocation();
  const [isMaximized, setIsMaximized] = createSignal(false);

  const updateMaximizedState = async () => {
    if (isTauri()) {
      try {
        const max = await isWindowMaximized();
        setIsMaximized(max);
      } catch {}
    }
  };

  onMount(() => {
    void updateMaximizedState();

    let unlisten: (() => void) | undefined;
    if (isTauri()) {
      try {
        getCurrentWindow()
          .onResized(() => {
            void updateMaximizedState();
          })
          .then((u) => {
            unlisten = u;
          });
      } catch {}
    } else {
      const handleResize = () => {
        void updateMaximizedState();
      };
      window.addEventListener("resize", handleResize);
      onCleanup(() => {
        window.removeEventListener("resize", handleResize);
      });
    }

    onCleanup(() => {
      unlisten?.();
    });
  });
  const activeTabObj = () => workspaceTabs().find((t) => t.id === activeWorkspaceTabId());
  const pageTitle = () => {
    const active = activeTabObj();
    if (active) {
      if (active.type !== "player") {
        return getPageTitle(active.type, currentLang());
      }
      return active.title;
    }
    const p = location.pathname.replace(/^\/+/, "");
    return getPageTitle((p as TabType) || "onboarding", currentLang());
  };
  const handleMouseDown = (e: MouseEvent) => {
    if (
      e.buttons === 1 &&
      (e.target as HTMLElement).tagName !== "BUTTON" &&
      !(e.target as HTMLElement).closest("button")
    ) {
      startDraggingWindow();
    }
  };

  const handleToggleMaximize = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!isTauri()) {
      setIsMaximized(!isMaximized());
      return;
    }
    await toggleMaximizeWindow();
    setTimeout(() => {
      void updateMaximizedState();
    }, 80);
  };
  const handleDblClick = (e: MouseEvent) => {
    if (
      (e.target as HTMLElement).tagName !== "BUTTON" &&
      !(e.target as HTMLElement).closest("button")
    ) {
      void handleToggleMaximize(e);
    }
  };

  return (
    <header
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      onDblClick={handleDblClick}
      class="h-9 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between px-3 select-none shrink-0 z-40 relative text-xs cursor-default transition-colors"
    >
      {/* Left: Sidebar Toggle */}
      <div
        class="flex items-center space-x-2 text-slate-500 dark:text-slate-400 z-10 relative"
        data-tauri-drag-region
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSidebar();
          }}
          class="w-6 h-6 flex items-center justify-center rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Toggle Sidebar (Ctrl+B)"
        >
          <PanelLeft size={14} />
        </button>
      </div>

      {/* Center: Perfectly Centered Breadcrumbs */}
      <div
        class="absolute inset-0 flex items-center justify-center space-x-2 pointer-events-none text-slate-500 dark:text-slate-400"
        data-tauri-drag-region
      >
        <span
          class="font-mono font-bold text-emerald-600 dark:text-emerald-400 tracking-tight"
          data-tauri-drag-region
        >
          pfrsim
        </span>
        <span class="text-slate-400 dark:text-slate-600" data-tauri-drag-region>
          /
        </span>
        <span class="font-medium text-slate-800 dark:text-slate-200" data-tauri-drag-region>
          {pageTitle()}
        </span>
      </div>

      {/* Right: Custom Native Window Controls */}
      <div class="flex items-center space-x-1 z-10 relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            minimizeWindow();
          }}
          class="w-7 h-6 flex items-center justify-center rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Minimize"
        >
          <Minus size={13} />
        </button>
        <button
          type="button"
          onClick={handleToggleMaximize}
          class="w-7 h-6 flex items-center justify-center rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title={isMaximized() ? "Restore Down" : "Maximize"}
        >
          <Show when={isMaximized()} fallback={<Square size={11} />}>
            <Copy size={11} />
          </Show>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            closeWindow();
          }}
          class="w-7 h-6 flex items-center justify-center rounded text-slate-500 dark:text-slate-400 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
};

export default TitleBar;
