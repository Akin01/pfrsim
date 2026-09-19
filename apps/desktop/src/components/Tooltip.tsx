import { Component, createSignal, JSX, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";

export interface TooltipProps {
  content: JSX.Element | (() => JSX.Element);
  children: JSX.Element;
  placement?: "top" | "bottom" | "left" | "right";
  openDelay?: number;
}

export const Tooltip: Component<TooltipProps> = (props) => {
  let wrapRef: HTMLSpanElement | null = null;
  let timer: number | undefined;
  const [isOpen, setIsOpen] = createSignal(false);
  const [coords, setCoords] = createSignal({
    top: 0,
    left: 0,
    placement: "bottom" as "top" | "bottom" | "left" | "right",
  });

  const updatePosition = () => {
    if (!wrapRef) return;
    const rect = wrapRef.getBoundingClientRect();
    // Auto-select "right" placement if trigger is near left screen edge (e.g. sidebar)
    const placement = props.placement || (rect.left < 100 ? "right" : "bottom");

    if (placement === "right") {
      const left = rect.right + 10;
      const top = Math.max(16, Math.min(window.innerHeight - 30, rect.top + rect.height / 2));
      setCoords({ top, left, placement: "right" });
    } else if (placement === "left") {
      const left = Math.max(16, rect.left - 10);
      const top = Math.max(16, Math.min(window.innerHeight - 30, rect.top + rect.height / 2));
      setCoords({ top, left, placement: "left" });
    } else if (placement === "top") {
      const left = Math.max(16, Math.min(window.innerWidth - 16, rect.left + rect.width / 2));
      const top = rect.top - 8;
      setCoords({ top, left, placement: "top" });
    } else {
      // bottom
      const left = Math.max(16, Math.min(window.innerWidth - 16, rect.left + rect.width / 2));
      const top = rect.bottom + 8;
      setCoords({ top, left, placement: "bottom" });
    }
  };

  const show = () => {
    window.clearTimeout(timer);
    updatePosition();
    const delay = props.openDelay ?? 40;
    if (delay > 0) {
      timer = window.setTimeout(() => setIsOpen(true), delay);
    } else {
      setIsOpen(true);
    }
  };

  const hide = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => setIsOpen(false), 60);
  };

  onCleanup(() => {
    window.clearTimeout(timer);
  });

  const isSimpleString = () => typeof props.content === "string";

  const getTransform = () => {
    switch (coords().placement) {
      case "right":
        return "translateY(-50%)";
      case "left":
        return "translate(-100%, -50%)";
      case "top":
        return "translate(-50%, -100%)";
      case "bottom":
      default:
        return "translateX(-50%)";
    }
  };

  return (
    <>
      <span
        ref={(el) => (wrapRef = el)}
        class="relative inline-flex items-center"
        tabindex="0"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocusIn={show}
        onFocusOut={hide}
      >
        {props.children}
      </span>
      <Show when={isOpen()}>
        <Portal>
          <div
            ref={(el) => {
              if (el) {
                const tipRect = el.getBoundingClientRect();
                const vw = window.innerWidth;
                if (tipRect.left < 8) {
                  setCoords((prev) => ({ ...prev, left: prev.left + (8 - tipRect.left) }));
                } else if (tipRect.right > vw - 8) {
                  setCoords((prev) => ({ ...prev, left: prev.left - (tipRect.right - (vw - 8)) }));
                }
              }
            }}
            role="tooltip"
            class={`fixed z-9999 pointer-events-none transition-all duration-150 ease-out shadow-2xl backdrop-blur-md max-w-[calc(100vw-32px)] ${
              isSimpleString()
                ? "rounded-lg px-2.5 py-1 text-xs font-mono font-medium whitespace-nowrap bg-slate-900/95 dark:bg-slate-800/95 text-slate-100 border border-slate-700/80 shadow-xl"
                : "rounded-xl p-2.5 text-xs text-slate-100 border border-slate-700/80 font-sans max-w-[320px] bg-slate-900/95 dark:bg-slate-800/95 shadow-xl"
            }`}
            style={{
              top: `${coords().top}px`,
              left: `${coords().left}px`,
              transform: getTransform(),
            }}
          >
            {/* Subtle Pointer Caret when placed right */}
            <Show when={coords().placement === "right"}>
              <div class="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-slate-900/95 dark:bg-slate-800/95 border-l border-b border-slate-700/80" />
            </Show>
            {typeof props.content === "function"
              ? (props.content as () => JSX.Element)()
              : props.content}
          </div>
        </Portal>
      </Show>
    </>
  );
};

export default Tooltip;
