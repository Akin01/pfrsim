import { Component, onCleanup, onMount, Show } from "solid-js";
import {
  BookOpen,
  ChartColumn,
  Compass,
  Cpu,
  Database,
  ExternalLink,
  Keyboard,
  Moon,
  Plus,
  Sun,
} from "lucide-solid";
import { catalogs } from "../i18n/catalog";
import {
  activeWorkspaceTabId,
  currentLang,
  navigateActiveTabTo,
  openNewPageTab,
  setView,
  setLang,
  toggleLang,
  toggleSidebar,
  toggleTheme,
  view,
  workspaceTabs,
} from "../lib/store";
import { openUrl } from "../lib/tauri";
import { Tooltip } from "./Tooltip";
import { APP_VERSION } from "../lib/version";
export const Sidebar: Component = () => {
  const t = () => catalogs[currentLang()];
  const currentActiveTabType = () => {
    const tab = workspaceTabs().find((t) => t.id === activeWorkspaceTabId());
    return tab?.type ?? "onboarding";
  };

  const isActive = (tabType: string) => currentActiveTabType() === tabType;
  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleSidebar();
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <aside
      class={`bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between shrink-0 select-none h-full z-30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        view.sidebarCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Top Header: Brand Identity */}
      <div>
        <Show
          when={!view.sidebarCollapsed}
          fallback={
            <div class="py-3 border-b border-slate-200 dark:border-slate-800/80 flex flex-col items-center justify-center">
              <Tooltip content={`pfrsim ${APP_VERSION}`} placement="right">
                <div class="flex flex-col items-center">
                  <img
                    src="/pfrsim-icon.png"
                    alt="pfrsim icon"
                    class="w-7 h-7 object-contain drop-shadow transition-transform duration-200 hover:scale-105"
                  />
                  <span class="mt-1 text-[8px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                    {APP_VERSION}
                  </span>
                </div>
              </Tooltip>
            </div>
          }
        >
          <div class="p-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
            <div class="flex items-center space-x-2.5">
              <img
                src="/pfrsim-icon.png"
                alt="pfrsim icon"
                class="w-7 h-7 object-contain drop-shadow transition-transform duration-200 hover:scale-105"
              />
              <div>
                <div class="flex items-center space-x-1.5">
                  <span class="text-base font-black tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
                    pfrsim
                  </span>
                  <span class="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs">
                    {APP_VERSION}
                  </span>
                </div>
                <p class="text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-none mt-0.5">
                  Peatland Fire Risk
                </p>
              </div>
            </div>
          </div>
        </Show>

        {/* Navigation Sections */}
        <nav class="p-2 space-y-4">
          {/* Section 1: Overview */}
          <div class="space-y-0.5">
            <Show
              when={!view.sidebarCollapsed}
              fallback={
                <div class="flex justify-center">
                  <Tooltip
                    content={
                      <div class="flex flex-col space-y-0.5 text-left py-0.5">
                        <span class="font-bold text-slate-100 text-xs font-mono">
                          {t().onboardingTab}
                        </span>
                        <span class="text-[10px] text-slate-400 font-sans">
                          {t().sidebarClickHint}
                        </span>
                      </div>
                    }
                    placement="right"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          openNewPageTab("onboarding");
                        } else {
                          navigateActiveTabTo("onboarding");
                        }
                      }}
                      class={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${
                        isActive("onboarding")
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/30 shadow-2xs"
                          : "border border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Compass
                        size={18}
                        class={`transition-colors duration-200 ${
                          isActive("onboarding")
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-500 dark:text-amber-400"
                        }`}
                      />
                    </button>
                  </Tooltip>
                </div>
              }
            >
              <div
                onClick={() => navigateActiveTabTo("onboarding")}
                class={`group/nav flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer select-none ${
                  isActive("onboarding")
                    ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-500/30 shadow-2xs"
                    : "border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <div class="flex items-center space-x-2.5 min-w-0 flex-1">
                  <Compass
                    size={16}
                    class={`transition-colors duration-200 ${
                      isActive("onboarding")
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-500 dark:text-amber-400"
                    }`}
                  />
                  <span class="truncate">{t().onboardingTab}</span>
                </div>
                <div class="flex items-center space-x-1 shrink-0">
                  <Show when={isActive("onboarding")}>
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  </Show>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openNewPageTab("onboarding");
                    }}
                    class="opacity-0 group-hover/nav:opacity-100 p-1 hover:bg-emerald-500/20 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-md text-slate-400 dark:text-slate-500 transition-all cursor-pointer"
                    title={t().openInNewTab(t().onboardingTab)}
                  >
                    <Plus size={12} stroke-width={2.5} />
                  </button>
                </div>
              </div>
            </Show>
          </div>

          {/* Section 2: Pipeline */}
          <div class="space-y-1">
            <Show when={!view.sidebarCollapsed}>
              <span class="px-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                {t().pipelineSection}
              </span>
            </Show>

            <div class="space-y-1 pt-1">
              {/* Data Collection Link */}
              <Show
                when={!view.sidebarCollapsed}
                fallback={
                  <div class="flex justify-center">
                    <Tooltip
                      content={
                        <div class="flex flex-col space-y-0.5 text-left py-0.5">
                          <span class="font-bold text-slate-100 text-xs font-mono">
                            {t().dataTab}
                          </span>
                          <span class="text-[10px] text-slate-400 font-sans">
                            {t().sidebarClickHint}
                          </span>
                        </div>
                      }
                      placement="right"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) {
                            openNewPageTab("data");
                          } else {
                            navigateActiveTabTo("data");
                          }
                        }}
                        class={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${
                          isActive("data")
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/30 shadow-2xs"
                            : "border border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Database
                          size={18}
                          class={`transition-colors duration-200 ${
                            isActive("data")
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-emerald-600 dark:text-emerald-500"
                          }`}
                        />
                      </button>
                    </Tooltip>
                  </div>
                }
              >
                <div
                  onClick={() => navigateActiveTabTo("data")}
                  class={`group/nav flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer select-none ${
                    isActive("data")
                      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-500/30 shadow-2xs"
                      : "border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <div class="flex items-center space-x-2.5 min-w-0 flex-1">
                    <Database
                      size={16}
                      class={`transition-colors duration-200 ${
                        isActive("data")
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-emerald-600 dark:text-emerald-500"
                      }`}
                    />
                    <span class="truncate">{t().dataTab}</span>
                  </div>
                  <div class="flex items-center space-x-1 shrink-0">
                    <Show when={isActive("data")}>
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    </Show>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openNewPageTab("data");
                      }}
                      class="opacity-0 group-hover/nav:opacity-100 p-1 hover:bg-emerald-500/20 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-md text-slate-400 dark:text-slate-500 transition-all cursor-pointer"
                      title={t().openInNewTab(t().dataTab)}
                    >
                      <Plus size={12} stroke-width={2.5} />
                    </button>
                  </div>
                </div>
              </Show>

              {/* Training Link */}
              <Show
                when={!view.sidebarCollapsed}
                fallback={
                  <div class="flex justify-center">
                    <Tooltip
                      content={
                        <div class="flex flex-col space-y-0.5 text-left py-0.5">
                          <span class="font-bold text-slate-100 text-xs font-mono">
                            {t().trainTab}
                          </span>
                          <span class="text-[10px] text-slate-400 font-sans">
                            {t().sidebarClickHint}
                          </span>
                        </div>
                      }
                      placement="right"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) {
                            openNewPageTab("train");
                          } else {
                            navigateActiveTabTo("train");
                          }
                        }}
                        class={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${
                          isActive("train")
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/30 shadow-2xs"
                            : "border border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Cpu
                          size={18}
                          class={`transition-colors duration-200 ${
                            isActive("train")
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-indigo-500 dark:text-indigo-400"
                          }`}
                        />
                      </button>
                    </Tooltip>
                  </div>
                }
              >
                <div
                  onClick={() => navigateActiveTabTo("train")}
                  class={`group/nav flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer select-none ${
                    isActive("train")
                      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-500/30 shadow-2xs"
                      : "border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <div class="flex items-center space-x-2.5 min-w-0 flex-1">
                    <Cpu
                      size={16}
                      class={`transition-colors duration-200 ${
                        isActive("train")
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-indigo-500 dark:text-indigo-400"
                      }`}
                    />
                    <span class="truncate">{t().trainTab}</span>
                  </div>
                  <div class="flex items-center space-x-1 shrink-0">
                    <Show when={isActive("train")}>
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    </Show>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openNewPageTab("train");
                      }}
                      class="opacity-0 group-hover/nav:opacity-100 p-1 hover:bg-emerald-500/20 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-md text-slate-400 dark:text-slate-500 transition-all cursor-pointer"
                      title={t().openInNewTab(t().trainTab)}
                    >
                      <Plus size={12} stroke-width={2.5} />
                    </button>
                  </div>
                </div>
              </Show>

              {/* Runs & Models Link */}
              <Show
                when={!view.sidebarCollapsed}
                fallback={
                  <div class="flex justify-center">
                    <Tooltip
                      content={
                        <div class="flex flex-col space-y-0.5 text-left py-0.5">
                          <span class="font-bold text-slate-100 text-xs font-mono">
                            {t().runsTab}
                          </span>
                          <span class="text-[10px] text-slate-400 font-sans">
                            {t().sidebarClickHint}
                          </span>
                        </div>
                      }
                      placement="right"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) {
                            openNewPageTab("runs");
                          } else {
                            navigateActiveTabTo("runs");
                          }
                        }}
                        class={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${
                          isActive("runs")
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/30 shadow-2xs"
                            : "border border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <ChartColumn
                          size={18}
                          class={`transition-colors duration-200 ${
                            isActive("runs")
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-purple-500 dark:text-purple-400"
                          }`}
                        />
                      </button>
                    </Tooltip>
                  </div>
                }
              >
                <div
                  onClick={() => navigateActiveTabTo("runs")}
                  class={`group/nav flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer select-none ${
                    isActive("runs")
                      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-500/30 shadow-2xs"
                      : "border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <div class="flex items-center space-x-2.5 min-w-0 flex-1">
                    <ChartColumn
                      size={16}
                      class={`transition-colors duration-200 ${
                        isActive("runs")
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-purple-500 dark:text-purple-400"
                      }`}
                    />
                    <span class="truncate">{t().runsTab}</span>
                  </div>
                  <div class="flex items-center space-x-1 shrink-0">
                    <Show when={isActive("runs")}>
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    </Show>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openNewPageTab("runs");
                      }}
                      class="opacity-0 group-hover/nav:opacity-100 p-1 hover:bg-emerald-500/20 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-md text-slate-400 dark:text-slate-500 transition-all cursor-pointer"
                      title={t().openInNewTab(t().runsTab)}
                    >
                      <Plus size={12} stroke-width={2.5} />
                    </button>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </nav>
      </div>

      {/* Bottom Area: Reference, GitHub & System Controls */}
      <div class="p-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1.5">
        <Show
          when={!view.sidebarCollapsed}
          fallback={
            <div class="flex flex-col items-center space-y-1.5 pt-1 text-slate-500 dark:text-slate-400">
              <Tooltip
                content={
                  <div class="flex flex-col space-y-0.5 text-left py-0.5">
                    <span class="font-bold text-slate-100 text-xs font-mono">
                      {t().glossaryButton}
                    </span>
                    <span class="text-[10px] text-slate-400 font-sans">
                      {view.lang === "id" ? "Tekan 'G'" : "Press 'G'"}
                    </span>
                  </div>
                }
                placement="right"
              >
                <button
                  type="button"
                  onClick={() => setView("showGlossary", true)}
                  class="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-800/60 cursor-pointer text-indigo-500 dark:text-indigo-400"
                >
                  <BookOpen size={14} />
                </button>
              </Tooltip>

              <Tooltip
                content={
                  <div class="flex flex-col space-y-0.5 text-left py-0.5">
                    <span class="font-bold text-slate-100 text-xs font-mono">
                      {t().shortcutsButton}
                    </span>
                    <span class="text-[10px] text-slate-400 font-sans">
                      {view.lang === "id" ? "Tekan '?'" : "Press '?'"}
                    </span>
                  </div>
                }
                placement="right"
              >
                <button
                  type="button"
                  onClick={() => setView("showShortcuts", true)}
                  class="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-800/60 cursor-pointer text-cyan-500 dark:text-cyan-400"
                >
                  <Keyboard size={14} />
                </button>
              </Tooltip>

              <Tooltip content="GitHub: akin01/pfrsim" placement="right">
                <button
                  type="button"
                  onClick={() => openUrl("https://github.com/akin01/pfrsim")}
                  class="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-800/60 cursor-pointer text-slate-700 dark:text-slate-300"
                >
                  <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </button>
              </Tooltip>

              <div class="w-5 h-px bg-slate-200 dark:bg-slate-800/80 my-0.5" />

              <Tooltip
                content={
                  view.theme === "dark"
                    ? view.lang === "id"
                      ? "Mode Terang"
                      : "Light Mode"
                    : view.lang === "id"
                      ? "Mode Gelap"
                      : "Dark Mode"
                }
                placement="right"
              >
                <button
                  type="button"
                  onClick={toggleTheme}
                  class="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-800/60 cursor-pointer"
                >
                  <Show
                    when={view.theme === "dark"}
                    fallback={<Moon size={14} class="text-indigo-500 dark:text-indigo-400" />}
                  >
                    <Sun size={14} class="text-amber-500 dark:text-amber-400" />
                  </Show>
                </button>
              </Tooltip>

              <Tooltip
                content={() =>
                  currentLang() === "id" ? "Beralih ke English" : "Switch to Bahasa Indonesia"
                }
                placement="right"
              >
                <button
                  type="button"
                  onClick={toggleLang}
                  class="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-800/60 font-mono font-bold text-[10px] cursor-pointer"
                >
                  <span class="text-emerald-600 dark:text-emerald-400">
                    {currentLang().toUpperCase()}
                  </span>
                </button>
              </Tooltip>
            </div>
          }
        >
          <div class="space-y-1">
            {/* 1. Glossary Button */}
            <button
              type="button"
              onClick={() => setView("showGlossary", true)}
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70"
            >
              <div class="flex items-center space-x-2.5 min-w-0 flex-1">
                <BookOpen size={14} class="text-indigo-500 dark:text-indigo-400 shrink-0" />
                <span class="truncate text-[11px]">{t().glossaryButton}</span>
              </div>
              <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-bold">
                G
              </span>
            </button>

            {/* 2. Keyboard Shortcuts Button */}
            <button
              type="button"
              onClick={() => setView("showShortcuts", true)}
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70"
            >
              <div class="flex items-center space-x-2.5 min-w-0 flex-1">
                <Keyboard size={14} class="text-cyan-500 dark:text-cyan-400 shrink-0" />
                <span class="truncate text-[11px]">{t().shortcutsButton}</span>
              </div>
              <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-bold">
                ?
              </span>
            </button>

            {/* 3. GitHub Link Button */}
            <button
              type="button"
              onClick={() => openUrl("https://github.com/akin01/pfrsim")}
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70"
              title="Open GitHub: akin01/pfrsim"
            >
              <div class="flex items-center space-x-2.5 min-w-0 flex-1">
                <svg
                  class="w-3.5 h-3.5 fill-current text-slate-700 dark:text-slate-300 shrink-0"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span class="truncate font-mono text-[11px]">akin01/pfrsim</span>
              </div>
              <ExternalLink size={11} class="text-slate-400 shrink-0" />
            </button>
          </div>

          {/* System Row: Theme Toggle + i18n Segmented Toggle */}
          <div class="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-200/80 dark:border-slate-800/80">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              class="py-1 px-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center justify-center space-x-1.5 border border-slate-200 dark:border-slate-800/60 cursor-pointer font-medium text-xs text-slate-700 dark:text-slate-300"
              title={view.theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              <Show
                when={view.theme === "dark"}
                fallback={<Moon size={12} class="text-indigo-500 dark:text-indigo-400" />}
              >
                <Sun size={12} class="text-amber-500 dark:text-amber-400" />
              </Show>
              <span class="truncate text-[11px]">
                {view.theme === "dark"
                  ? view.lang === "id"
                    ? "Gelap"
                    : "Dark"
                  : view.lang === "id"
                    ? "Terang"
                    : "Light"}
              </span>
            </button>

            {/* i18n Segmented Switch [ ID | EN ] */}
            <div class="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/60">
              <button
                type="button"
                onClick={() => setLang("id")}
                class={`flex-1 py-1 rounded-lg text-center font-mono font-bold text-[10px] transition-all cursor-pointer ${
                  currentLang() === "id"
                    ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-2xs border border-slate-200/80 dark:border-slate-700"
                    : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
                title="Bahasa Indonesia"
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                class={`flex-1 py-1 rounded-lg text-center font-mono font-bold text-[10px] transition-all cursor-pointer ${
                  currentLang() === "en"
                    ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-2xs border border-slate-200/80 dark:border-slate-700"
                    : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
                title="English Language"
              >
                EN
              </button>
            </div>
          </div>
        </Show>
      </div>
    </aside>
  );
};

export default Sidebar;
