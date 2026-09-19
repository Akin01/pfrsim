import {
  Component,
  createContext,
  createEffect,
  createSignal,
  createUniqueId,
  JSX,
  onCleanup,
  ParentProps,
  Show,
  useContext,
} from "solid-js";
import { Info, X } from "lucide-solid";
import { Portal } from "solid-js/web";

export interface InfoHelperProps {
  title?: string | JSX.Element;
  content: JSX.Element;
  placement?: "top" | "bottom";
  size?: number;
}

export interface InfoHelperScopeContextValue {
  activeId: () => string | null;
  setActiveId: (id: string | null) => void;
  close: () => void;
}

export const InfoHelperScopeContext = createContext<InfoHelperScopeContextValue>();

export interface InfoHelperScopeProps {
  /** When provided and false (e.g. page is inactive), closes any active popovers in this scope */
  active?: boolean;
}

/**
 * Page-level scope: ensures only ONE helper popover can be active within the active page.
 */
export const InfoHelperScope: Component<ParentProps<InfoHelperScopeProps>> = (props) => {
  const [activeId, setActiveId] = createSignal<string | null>(null);
  const close = () => setActiveId(null);

  createEffect(() => {
    if (props.active === false) {
      close();
    }
  });

  return (
    <InfoHelperScopeContext.Provider value={{ activeId, setActiveId, close }}>
      {props.children}
    </InfoHelperScopeContext.Provider>
  );
};

export const useInfoHelperScope = () => useContext(InfoHelperScopeContext);

/** Backward compatibility alias */
export const InfoHelperProvider = InfoHelperScope;

export const closeActiveHelper = () => {
  // Maintained for backward compatibility; page scopes close on navigation/inactive automatically.
};
export const InfoHelper: Component<InfoHelperProps> = (props) => {
  const id = createUniqueId();
  let triggerRef: HTMLButtonElement | null = null;
  let popoverRef: HTMLDivElement | null = null;

  const scope = useInfoHelperScope();
  const [localOpen, setLocalOpen] = createSignal(false);

  const isOpen = () => (scope ? scope.activeId() === id : localOpen());
  const close = () => {
    if (scope) {
      if (scope.activeId() === id) {
        scope.setActiveId(null);
      }
    } else {
      setLocalOpen(false);
    }
  };
  const open = () => {
    if (scope) {
      scope.setActiveId(id);
    } else {
      setLocalOpen(true);
    }
  };
  const [coords, setCoords] = createSignal<{
    top: number;
    left: number;
    maxHeight: number;
    placeBelow: boolean;
  }>({
    top: 0,
    left: 0,
    maxHeight: 400,
    placeBelow: false,
  });

  const updatePosition = () => {
    if (!triggerRef) return;
    const rect = triggerRef.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const padding = 12;

    const spaceBelow = vh - rect.bottom - padding;
    const spaceAbove = rect.top - padding;

    const placeBelow =
      props.placement === "bottom"
        ? spaceBelow >= 180
        : spaceBelow >= spaceAbove || spaceAbove < 240;

    let top: number;
    let maxHeight: number;

    if (placeBelow) {
      top = rect.bottom + 6;
      maxHeight = Math.max(160, Math.min(520, spaceBelow - 12));
    } else {
      top = rect.top - 6;
      maxHeight = Math.max(160, Math.min(520, spaceAbove - 12));
    }

    const popoverWidth = Math.min(380, vw - 24);
    const left = Math.max(padding, Math.min(vw - popoverWidth - padding, rect.left - 120));
    setCoords({ top, left, maxHeight, placeBelow });
  };

  const toggle = (e: MouseEvent) => {
    e.stopPropagation();
    if (isOpen()) {
      close();
    } else {
      updatePosition();
      open();
    }
  };

  // While this helper is active:
  // 1. Close when user clicks or presses down outside both the trigger and the popover.
  //    Uses capture phase (true) on window & document so it intercepts even if child elements stop propagation.
  // 2. Close on Escape key.
  // 3. Close on window blur.
  // 4. Keep position anchored on window resize or container scroll.
  createEffect(() => {
    if (!isOpen()) return;

    updatePosition();

    const handleOutsideClick = (e: Event) => {
      const target = (e as MouseEvent | PointerEvent).target as Node | null;
      if (target && !triggerRef?.contains(target) && !popoverRef?.contains(target)) {
        close();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };

    const handleBlur = () => {
      close();
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("pointerdown", handleOutsideClick, true);
    window.addEventListener("mousedown", handleOutsideClick, true);
    window.addEventListener("click", handleOutsideClick, true);
    document.addEventListener("pointerdown", handleOutsideClick, true);
    document.addEventListener("mousedown", handleOutsideClick, true);
    document.addEventListener("click", handleOutsideClick, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    window.addEventListener("scroll", handleScrollOrResize, { capture: true, passive: true });

    onCleanup(() => {
      window.removeEventListener("pointerdown", handleOutsideClick, true);
      window.removeEventListener("mousedown", handleOutsideClick, true);
      window.removeEventListener("click", handleOutsideClick, true);
      document.removeEventListener("pointerdown", handleOutsideClick, true);
      document.removeEventListener("mousedown", handleOutsideClick, true);
      document.removeEventListener("click", handleOutsideClick, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    });
  });

  // Cleanup if the active helper instance unmounts
  onCleanup(() => {
    if (isOpen()) {
      close();
    }
  });

  return (
    <>
      <button
        ref={(el) => {
          triggerRef = el;
        }}
        type="button"
        onClick={toggle}
        class={`inline-flex items-center justify-center p-0.5 rounded-md transition-colors cursor-pointer focus:outline-none ${
          isOpen()
            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20"
            : "text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400"
        }`}
        aria-expanded={isOpen()}
        title={typeof props.title === "string" ? props.title : "Info"}
      >
        <Info size={props.size ?? 11} />
      </button>

      <Show when={isOpen()}>
        <Portal>
          <div
            ref={(el) => {
              popoverRef = el;
            }}
            onClick={(e) => e.stopPropagation()}
            class="fixed z-9999 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/90 p-4 text-xs text-slate-800 dark:text-slate-200 shadow-2xl font-sans max-w-sm w-[92vw] sm:w-[380px] flex flex-col animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: `${coords().top}px`,
              left: `${coords().left}px`,
              transform: coords().placeBelow ? "none" : "translateY(-100%)",
              "max-height": `${coords().maxHeight}px`,
            }}
          >
            <div class="flex items-start justify-between gap-2 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1.5 shrink-0">
              <span class="font-bold text-slate-900 dark:text-slate-100 text-xs font-mono">
                {props.title ?? "Info"}
              </span>
              <button
                type="button"
                onClick={close}
                class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer shrink-0"
              >
                <X size={13} />
              </button>
            </div>
            <div class="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed font-sans overflow-y-auto custom-scrollbar pr-1 flex-1 min-h-0 space-y-2">
              {props.content}
            </div>
          </div>
        </Portal>
      </Show>
    </>
  );
};

export default InfoHelper;
