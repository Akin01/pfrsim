import { Component, Show } from "solid-js";
import { ArrowRight, CircleCheck, CloudUpload, Database, Layers, Sparkles } from "lucide-solid";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export interface OnboardingHeroProps {
  uploadSuccess: { name: string; id: string } | null;
  onOpenUploadModal: () => void;
  onNavigateToData: () => void;
  onNavigateToTrain: () => void;
  onClearUploadSuccess: () => void;
}

export const OnboardingHero: Component<OnboardingHeroProps> = (props) => {
  const t = () => catalogs[view.lang];

  return (
    <div class="relative overflow-hidden bg-white dark:bg-linear-to-br dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-950 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 md:p-9 shadow-sm dark:shadow-2xl transition-all select-none">
      {/* Subtle decorative atmospheric background glow */}
      <div class="pointer-events-none absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl" />
      <div class="pointer-events-none absolute -bottom-24 -left-24 w-80 h-80 bg-cyan-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl" />

      {/* Decorative scientific topography SVG contours in top-right */}
      <div class="pointer-events-none absolute top-0 right-0 w-80 h-full opacity-[0.05] dark:opacity-[0.12] overflow-hidden">
        <svg
          viewBox="0 0 400 300"
          class="w-full h-full stroke-current text-emerald-600 dark:text-emerald-400"
          fill="none"
          stroke-width="1.5"
        >
          <path d="M 0 50 Q 100 10 200 60 T 400 40" />
          <path d="M 0 100 Q 120 40 220 110 T 400 90" />
          <path d="M 0 150 Q 80 120 200 160 T 400 130" />
          <path d="M 0 200 Q 140 160 240 220 T 400 180" />
          <path d="M 0 250 Q 100 230 200 270 T 400 230" />
        </svg>
      </div>

      <div class="relative z-10 max-w-3xl space-y-4">
        {/* Title & Subtitle */}
        <div class="space-y-2">
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
            {t().onboardingHeroTitle}
          </h1>
          <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            {t().onboardingHeroSubtitle}
          </p>
        </div>

        {/* Core Capabilities Badges */}
        <div class="flex flex-wrap items-center gap-2 pt-1">
          <div class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-[11px] font-medium text-slate-700 dark:text-slate-300">
            <Layers size={13} class="text-blue-500 shrink-0" />
            <span>{t().onboardingBadgeWaterSoil}</span>
          </div>
          <div class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-[11px] font-medium text-slate-700 dark:text-slate-300">
            <Database size={13} class="text-emerald-500 shrink-0" />
            <span>{t().onboardingBadgeRainWeather}</span>
          </div>
          <div class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-[11px] font-medium text-slate-700 dark:text-slate-300">
            <Sparkles size={13} class="text-purple-500 shrink-0" />
            <span>{t().onboardingBadgeEarlyDetection}</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div class="pt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={props.onOpenUploadModal}
            class="px-5 py-2.5 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-900/30 hover:shadow-emerald-900/50 flex items-center space-x-2 cursor-pointer active:scale-[0.98]"
          >
            <CloudUpload size={16} />
            <span>{t().onboardingUploadBtn}</span>
          </button>

          <button
            type="button"
            onClick={props.onNavigateToData}
            class="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 dark:text-slate-200 text-xs font-bold transition-all border border-slate-300 dark:border-slate-700/80 flex items-center space-x-2 cursor-pointer active:scale-[0.98]"
          >
            <span>{t().onboardingGoToDataBtn}</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Success Notice if upload just finished */}
        <Show when={props.uploadSuccess}>
          <div class="mt-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between flex-wrap gap-2 animate-in fade-in">
            <div class="flex items-center space-x-2">
              <CircleCheck size={16} class="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {t().onboardingDatasetImported}
                <strong class="font-mono text-slate-900 dark:text-white">
                  {props.uploadSuccess?.name}
                </strong>
              </span>
            </div>
            <div class="flex items-center space-x-2">
              <button
                type="button"
                onClick={props.onNavigateToTrain}
                class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {t().onboardingProceedToTraining}
              </button>
              <button
                type="button"
                onClick={props.onClearUploadSuccess}
                class="text-slate-400 hover:text-slate-200 text-sm p-0.5 cursor-pointer"
              >
                ×
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};
