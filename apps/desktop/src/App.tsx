import { Component, createEffect, createMemo, For, onCleanup, onMount, Show } from "solid-js";
import { HashRouter, Route, useLocation } from "@solidjs/router";
import {
  activeWorkspaceTabId,
  getPageTitle,
  playback,
  setActiveTab,
  setActiveWorkspaceTabId,
  setView,
  setWorkspaceTabs,
  type TabType,
  view,
  workspaceTabs,
  type WorkspaceTab,
} from "./lib/store";
import { TitleBar } from "./components/TitleBar";
import { WorkspaceTabBar } from "./components/WorkspaceTabBar";
import { Sidebar } from "./components/Sidebar";
import { GlossaryModal } from "./components/GlossaryModal";
import { KeyboardModal } from "./components/KeyboardModal";
import { ToastContainer } from "./components/Toast";
import { OnboardingPage } from "./pages/OnboardingPage";
import { DataPage } from "./pages/DataPage";
import { TrainPage } from "./pages/TrainPage";
import { PlayerPage } from "./pages/PlayerPage";
import { RunsPage } from "./pages/RunsPage";
import { InfoHelperScope } from "./components/InfoHelper";

const Layout: Component = () => {
  const location = useLocation();
  const currentTab = () => {
    if (typeof window !== "undefined" && window.location.hash) {
      const fromHash = window.location.hash.replace(/^#\/?/, "").split(/[/?#]/)[0];
      if (fromHash && fromHash !== "onboarding" && fromHash !== "decide") {
        return fromHash as TabType;
      }
    }
    const raw = location.pathname.replace(/^\/+/, "");
    if (!raw || raw === "onboarding" || raw === "decide") return "onboarding";
    return raw as TabType;
  };

  createEffect(() => {
    const tab = currentTab() as TabType;
    setView("activeTab", tab);
    setActiveTab(tab);
  });

  onMount(() => {
    const fromHash =
      typeof window !== "undefined" && window.location.hash
        ? window.location.hash.replace(/^#\/?/, "").split(/[/?#]/)[0]
        : "";
    const raw = fromHash || location.pathname.replace(/^\/+/, "");
    if (raw && raw !== "onboarding" && raw !== "decide") {
      const target = raw as TabType;
      const existing = workspaceTabs().find((t) => t.type === target && !t.runId);
      if (existing) {
        setActiveWorkspaceTabId(existing.id);
      } else {
        const newTab: WorkspaceTab = {
          id: target,
          type: target,
          title: getPageTitle(target),
          closable: true,
        };
        setWorkspaceTabs([...workspaceTabs(), newTab]);
        setActiveWorkspaceTabId(target);
      }
    }
  });

  // Global Hotkeys: ? for Shortcuts Help, G for Glossary, Esc for dismiss
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable)
    ) {
      return;
    }

    // 'Escape' key: Close any active modal dialog
    if (e.key === "Escape") {
      if (view.showGlossary || view.showShortcuts) {
        e.preventDefault();
        setView("showGlossary", false);
        setView("showShortcuts", false);
        return;
      }
    }

    // '?' key: Toggle Keyboard Shortcuts Modal
    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (!view.showShortcuts && view.showGlossary) {
        setView("showGlossary", false);
      }
      setView("showShortcuts", !view.showShortcuts);
      return;
    }

    // 'g' or 'G' key: Toggle Peatland Glossary Modal
    if ((e.key === "g" || e.key === "G") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (!view.showGlossary && view.showShortcuts) {
        setView("showShortcuts", false);
      }
      setView("showGlossary", !view.showGlossary);
      return;
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleGlobalKeyDown);
  });

  const activeTabObj = () => workspaceTabs().find((t) => t.id === activeWorkspaceTabId());
  const activePageType = () => {
    const active = activeTabObj();
    if (active) return active.type;
    return currentTab();
  };
  const simulationTabs = createMemo(() => workspaceTabs().filter((t) => t.type === "player"));
  return (
    <div class="h-screen w-screen flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans border border-slate-200 dark:border-slate-800/80 transition-colors">
      {/* 1. Custom Title Bar with Window Controls */}
      <TitleBar />

      {/* 2. Main Desktop Shell (Sidebar + Content Workspace) */}
      <div class="flex-1 flex overflow-hidden relative">
        <Sidebar />

        <main class="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-slate-950 transition-colors">
          <WorkspaceTabBar />
          <div class="flex-1 relative overflow-hidden">
            <div
              class={`h-full w-full absolute inset-0 transition-all duration-200 ease-out ${
                activePageType() === "onboarding" || activePageType() === "decide"
                  ? "opacity-100 translate-y-0 pointer-events-auto z-10"
                  : "opacity-0 pointer-events-none -z-10 translate-y-1 invisible"
              }`}
            >
              <InfoHelperScope
                active={activePageType() === "onboarding" || activePageType() === "decide"}
              >
                <OnboardingPage />
              </InfoHelperScope>
            </div>
            <div
              class={`h-full w-full absolute inset-0 transition-all duration-200 ease-out ${
                activePageType() === "data"
                  ? "opacity-100 translate-y-0 pointer-events-auto z-10"
                  : "opacity-0 pointer-events-none -z-10 translate-y-1 invisible"
              }`}
            >
              <InfoHelperScope active={activePageType() === "data"}>
                <DataPage isActive={activePageType() === "data"} />
              </InfoHelperScope>
            </div>
            <div
              class={`h-full w-full absolute inset-0 transition-all duration-200 ease-out ${
                activePageType() === "train"
                  ? "opacity-100 translate-y-0 pointer-events-auto z-10"
                  : "opacity-0 pointer-events-none -z-10 translate-y-1 invisible"
              }`}
            >
              <InfoHelperScope active={activePageType() === "train"}>
                <TrainPage isActive={activePageType() === "train"} />
              </InfoHelperScope>
            </div>
            {/* Simulation Tabs: Each open simulation tab gets its OWN isolated PlayerPage! */}
            <For each={simulationTabs()}>
              {(tab) => (
                <div
                  class={`h-full w-full absolute inset-0 transition-all duration-200 ease-out ${
                    activeWorkspaceTabId() === tab.id && activePageType() === "player"
                      ? "opacity-100 translate-y-0 pointer-events-auto z-10"
                      : "opacity-0 pointer-events-none -z-10 translate-y-1 invisible"
                  }`}
                >
                  <InfoHelperScope
                    active={activeWorkspaceTabId() === tab.id && activePageType() === "player"}
                  >
                    <PlayerPage
                      runId={tab.runId}
                      tabId={tab.id}
                      isActive={activeWorkspaceTabId() === tab.id && activePageType() === "player"}
                    />
                  </InfoHelperScope>
                </div>
              )}
            </For>

            {/* Standalone Player fallback if no simulation tab has runId */}
            <Show when={simulationTabs().length === 0}>
              <div
                class={`h-full w-full absolute inset-0 transition-all duration-200 ease-out ${
                  activePageType() === "player"
                    ? "opacity-100 translate-y-0 pointer-events-auto z-10"
                    : "opacity-0 pointer-events-none -z-10 translate-y-1 invisible"
                }`}
              >
                <InfoHelperScope active={activePageType() === "player"}>
                  <PlayerPage
                    runId={playback.selectedRunId}
                    tabId="player-fallback"
                    isActive={activePageType() === "player"}
                  />
                </InfoHelperScope>
              </div>
            </Show>
            <div
              class={`h-full w-full absolute inset-0 transition-all duration-200 ease-out ${
                activePageType() === "runs"
                  ? "opacity-100 translate-y-0 pointer-events-auto z-10"
                  : "opacity-0 pointer-events-none -z-10 translate-y-1 invisible"
              }`}
            >
              <InfoHelperScope active={activePageType() === "runs"}>
                <RunsPage isActive={activePageType() === "runs"} />
              </InfoHelperScope>
            </div>
          </div>
        </main>
      </div>

      <GlossaryModal />
      <KeyboardModal />
      <ToastContainer />
    </div>
  );
};

export const App: Component = () => {
  return (
    <HashRouter root={Layout}>
      <Route path="/" component={() => null} />
      <Route path="/onboarding" component={() => null} />
      <Route path="/decide" component={() => null} />
      <Route path="/data" component={() => null} />
      <Route path="/train" component={() => null} />
      <Route path="/player" component={() => null} />
      <Route path="/runs" component={() => null} />
    </HashRouter>
  );
};

export default App;
