import { Component, For } from "solid-js";
import { CircleAlert, TriangleAlert, CircleCheck, X, Info } from "lucide-solid";
import { dismissToast, ToastItem, toasts } from "../lib/toast";

export const ToastContainer: Component = () => {
  const getIcon = (type: ToastItem["type"]) => {
    switch (type) {
      case "success":
        return <CircleCheck size={17} class="text-emerald-500 dark:text-emerald-400 shrink-0" />;
      case "error":
        return <CircleAlert size={17} class="text-rose-500 dark:text-rose-400 shrink-0" />;
      case "warning":
        return <TriangleAlert size={17} class="text-amber-500 dark:text-amber-400 shrink-0" />;
      case "info":
      default:
        return <Info size={17} class="text-cyan-500 dark:text-cyan-400 shrink-0" />;
    }
  };

  const getBorderColor = (type: ToastItem["type"]) => {
    switch (type) {
      case "success":
        return "border-emerald-500/30 dark:border-emerald-500/30";
      case "error":
        return "border-rose-500/30 dark:border-rose-500/30";
      case "warning":
        return "border-amber-500/30 dark:border-amber-500/30";
      case "info":
      default:
        return "border-cyan-500/30 dark:border-cyan-500/30";
    }
  };

  return (
    <div
      class="fixed bottom-5 right-5 z-100 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
      role="region"
    >
      <For each={toasts()}>
        {(item) => (
          <div
            class={`pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border ${getBorderColor(
              item.type,
            )} rounded-2xl p-3.5 shadow-2xl flex items-start space-x-3 transition-all animate-in fade-in slide-in-from-bottom-2 duration-150`}
          >
            <div class="pt-0.5">{getIcon(item.type)}</div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-slate-900 dark:text-slate-100 font-medium leading-relaxed wrap-break-word">
                {item.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </For>
    </div>
  );
};

export default ToastContainer;
