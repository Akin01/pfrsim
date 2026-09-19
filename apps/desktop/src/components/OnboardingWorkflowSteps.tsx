import { Component, For } from "solid-js";
import { ArrowRight, Workflow } from "lucide-solid";
import { getOnboardingSteps } from "../utils/onboarding";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export interface OnboardingWorkflowStepsProps {
  onNavigateToTab: (tab: "data" | "train" | "player" | "runs") => void;
}

export const OnboardingWorkflowSteps: Component<OnboardingWorkflowStepsProps> = (props) => {
  const t = () => catalogs[view.lang];
  const steps = () => getOnboardingSteps(view.lang);

  return (
    <div class="space-y-4 select-none">
      <div class="flex items-center justify-between pb-1">
        <div>
          <div class="flex items-center space-x-2 mb-1">
            <div class="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Workflow size={14} />
            </div>
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
              {t().onboardingWorkflowTitle}
            </h2>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">{t().onboardingWorkflowSubtitle}</p>
        </div>
        <span class="text-[11px] font-mono text-slate-400 dark:text-slate-500 hidden sm:inline px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          4 Stages Pipeline
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <For each={steps()}>
          {(s) => {
            const IconComp = s.icon;
            return (
              <div
                onClick={() => props.onNavigateToTab(s.tab)}
                class={`relative overflow-hidden bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 ${s.accentBorder} rounded-2xl p-5 space-y-4 cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1 group flex flex-col justify-between`}
              >
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <div
                      class={`w-11 h-11 rounded-xl border flex items-center justify-center shadow-xs transition-transform group-hover:scale-105 duration-200 ${s.color}`}
                    >
                      <IconComp size={22} />
                    </div>
                    <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/80 group-hover:border-emerald-500/40 group-hover:text-emerald-500 transition-colors">
                      STAGE 0{s.step}
                    </span>
                  </div>

                  <div>
                    <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                      {s.title}
                    </h3>
                    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1.5">
                      {s.desc}
                    </p>
                  </div>
                </div>

                <div class="pt-2 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  <span>{t().onboardingOpenStage}</span>
                  <ArrowRight size={14} class="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};
