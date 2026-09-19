import { Component, createSignal, createEffect, For, Show } from "solid-js";
import { Clock, Shield, ShieldAlert, X } from "lucide-solid";
import Dialog from "corvu/dialog";
import { playbooks, type ActionCard } from "../playbook/cards";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";
import { riskClassColor, riskTextColor } from "../utils/player";

export interface PlaybookModalProps {
  open: boolean;
  onClose: () => void;
  activeClass: "Low" | "Moderate" | "High" | "Extreme";
  currentPfvi?: number;
}

export const PlaybookModal: Component<PlaybookModalProps> = (props) => {
  const t = () => catalogs[view.lang];
  const [selectedClass, setSelectedClass] = createSignal<"Low" | "Moderate" | "High" | "Extreme">(
    props.activeClass || "Low",
  );

  // Sync with timeline scrubbing
  createEffect(() => {
    if (props.activeClass) {
      setSelectedClass(props.activeClass);
    }
  });

  const cards = () => {
    const lang = view.lang === "id" ? "id" : "en";
    return playbooks[lang][selectedClass()] || [];
  };

  const getUrgencyBadge = (urgency: ActionCard["urgency"]) => {
    switch (urgency) {
      case "emergency":
        return {
          label: t().playbookUrgencyEmergency,
          cls: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 animate-pulse font-bold",
        };
      case "urgent":
        return {
          label: t().playbookUrgencyUrgent,
          cls: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30 font-bold",
        };
      case "advisory":
        return {
          label: t().playbookUrgencyAdvisory,
          cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold",
        };
      default:
        return {
          label: t().playbookUrgencyRoutine,
          cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
        };
    }
  };

  const classes: Array<"Low" | "Moderate" | "High" | "Extreme"> = [
    "Low",
    "Moderate",
    "High",
    "Extreme",
  ];

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-transparent backdrop-blur-md transition-all duration-200 data-open:opacity-100 data-closed:opacity-0" />
        <Dialog.Content class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-[94vw] p-6 shadow-2xl space-y-4 focus:outline-none max-h-[90vh] flex flex-col overflow-hidden select-none">
          {/* Header */}
          <div class="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3 shrink-0">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-2xs">
                <ShieldAlert size={20} />
              </div>
              <div>
                <Dialog.Label class="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                  {t().playerPlaybookTitle}
                </Dialog.Label>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                  {t().playerPlaybookSubtitle(props.activeClass, props.currentPfvi ?? 0)}
                </p>
              </div>
            </div>

            <Dialog.Close
              onClick={props.onClose}
              class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Hazard Class Selector Bar */}
          <div class="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shrink-0 font-mono text-xs">
            <For each={classes}>
              {(cls) => {
                const isSelected = () => selectedClass() === cls;
                const isTimelineActive = () => props.activeClass === cls;

                return (
                  <button
                    type="button"
                    onClick={() => setSelectedClass(cls)}
                    class={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                      isSelected()
                        ? `${riskClassColor(cls)} shadow-xs font-black`
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <span>{cls}</span>
                    <Show when={isTimelineActive()}>
                      <span class="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>

          {/* Action Cards List */}
          <div class="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono px-1">
              <span>{t().playbookFieldProtocols}</span>
              <span>{cards().length} Directives</span>
            </div>

            <For each={cards()}>
              {(card) => {
                const urgency = getUrgencyBadge(card.urgency);

                return (
                  <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-2.5 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                    {/* Card Header */}
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex items-center space-x-2">
                        <span class="text-xs font-bold text-slate-900 dark:text-slate-100 font-sans">
                          {card.title}
                        </span>
                      </div>

                      <span
                        class={`px-2 py-0.5 rounded text-[10px] font-mono border uppercase tracking-wide shrink-0 ${urgency.cls}`}
                      >
                        {urgency.label}
                      </span>
                    </div>

                    {/* Action Description */}
                    <p class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                      {card.action}
                    </p>

                    {/* Metadata Footer */}
                    <div class="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <div class="flex items-center space-x-1 text-cyan-700 dark:text-cyan-300">
                        <Clock size={12} class="text-cyan-500 shrink-0" />
                        <span>
                          {t().playbookTimingLabel}: <strong>{card.timing}</strong>
                        </span>
                      </div>

                      <div class="flex items-center space-x-1 text-purple-700 dark:text-purple-300">
                        <Shield size={12} class="text-purple-500 shrink-0" />
                        <span>
                          {t().playbookAuthorityLabel}: <strong>{card.ownerHint}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>

          {/* Modal Footer */}
          <div class="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 shrink-0 text-xs font-mono">
            <span class="text-[11px] text-slate-500 dark:text-slate-400">
              Active PFVI:{" "}
              <strong class={riskTextColor(props.activeClass)}>
                {props.currentPfvi?.toFixed(1) ?? "0.0"}
              </strong>{" "}
              ({props.activeClass})
            </span>

            <Dialog.Close
              onClick={props.onClose}
              class="px-4 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-colors cursor-pointer shadow-2xs"
            >
              Close
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default PlaybookModal;
