import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { Lang } from "../i18n/catalog";
import type { SimulationFrame } from "./types";

export type TabType = "onboarding" | "decide" | "data" | "train" | "player" | "runs";
export interface WorkspaceTab {
  id: string;
  type: TabType;
  title: string;
  runId?: string | null;
  closable?: boolean;
}
export type TransportState = "idle" | "playing" | "paused" | "ended";
export type SpeedRate = 1 | 2 | 4 | 8;

export interface PlaybackState {
  frames: SimulationFrame[];
  t: number; // 1-based (1..n+h)
  transport: TransportState;
  speed: SpeedRate;
  selectedRunId: string | null;
  selectedDatasetId: string | null;
}

export interface VisibleSeries {
  diobs: boolean;
  imputed: boolean;
  holdout: boolean;
  divider: boolean;
}

export interface ViewState {
  activeTab: TabType;
  xWindow: [number, number] | null;
  visibleSeries: VisibleSeries;
  overlayRunId: string | null;
  overlayFrames: SimulationFrame[] | null;
  hoverT: number | null;
  lang: Lang;
  showGlossary: boolean;
  showShortcuts: boolean;
  theme: "dark" | "light";
  sidebarCollapsed: boolean;
}

export const [playback, setPlayback] = createStore<PlaybackState>({
  frames: [],
  t: 1,
  transport: "idle",
  speed: 2,
  selectedRunId: null,
  selectedDatasetId: null,
});
const getInitialLang = (): Lang => {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("pfrsim-lang");
      if (saved === "en" || saved === "id") return saved;
    } catch {}
  }
  return "id";
};

export const [view, setView] = createStore<ViewState>({
  activeTab: "onboarding",
  xWindow: null,
  visibleSeries: {
    diobs: true,
    imputed: true,
    holdout: true,
    divider: true,
  },
  overlayRunId: null,
  overlayFrames: null,
  hoverT: null,
  lang: getInitialLang(),
  showGlossary: false,
  showShortcuts: false,
  theme:
    typeof window !== "undefined" && localStorage.getItem("pfrsim-theme") === "light"
      ? "light"
      : "dark",
  sidebarCollapsed:
    typeof window !== "undefined" && localStorage.getItem("pfrsim-sidebar-collapsed") === "true",
});

export const currentLang = () => view.lang;

export const getPageTitle = (tab: TabType, targetLang?: Lang): string => {
  const titleMap: Record<TabType, { id: string; en: string }> = {
    onboarding: { id: "Panduan Mulai", en: "Getting Started" },
    data: { id: "Koleksi Data", en: "Data Library" },
    train: { id: "Pelatihan Model", en: "Model Training" },
    player: { id: "Simulasi Risiko", en: "Risk Simulation" },
    runs: { id: "Riwayat & Model", en: "Runs & Models" },
    decide: { id: "Ringkasan Risiko", en: "Risk Summary" },
  };
  const lang = targetLang ?? currentLang();
  return titleMap[tab]?.[lang] ?? titleMap[tab]?.en ?? tab;
};

const getInitialTab = (): TabType => {
  if (typeof window !== "undefined" && window.location.hash) {
    const fromHash = window.location.hash.replace(/^#\/?/, "").split(/[/?#]/)[0];
    if (
      fromHash === "data" ||
      fromHash === "train" ||
      fromHash === "runs" ||
      fromHash === "player"
    ) {
      return fromHash as TabType;
    }
  }
  return "onboarding";
};

const initialTab = getInitialTab();

export const [workspaceTabs, setWorkspaceTabs] = createSignal<WorkspaceTab[]>([
  {
    id: initialTab,
    type: initialTab,
    title: getPageTitle(initialTab),
    closable: true,
  },
]);

export const [activeWorkspaceTabId, setActiveWorkspaceTabId] = createSignal<string>(initialTab);
export const [activeTab, setActiveTab] = createSignal<TabType>(initialTab);

export const openSimulationTab = (runId: string, runName?: string) => {
  const tabId = `sim-${runId}`;
  const existing = workspaceTabs().find((t) => t.id === tabId);
  const title = runName
    ? runName.length > 20
      ? `${runName.slice(0, 18)}…`
      : runName
    : `Run ${runId.slice(0, 6)}`;

  if (!existing) {
    const newTab: WorkspaceTab = {
      id: tabId,
      type: "player",
      title: `Sim: ${title}`,
      runId,
      closable: true,
    };
    setWorkspaceTabs([...workspaceTabs(), newTab]);
  }

  setActiveWorkspaceTabId(tabId);
  setPlayback("selectedRunId", runId);
  setActiveTab("player");
  setView("activeTab", "player");
  if (typeof window !== "undefined") {
    window.location.hash = "#/player";
  }
};

export const openWorkspaceTab = (tab: WorkspaceTab) => {
  const existing = workspaceTabs().find((t) => t.id === tab.id);
  if (!existing) {
    setWorkspaceTabs([...workspaceTabs(), tab]);
  }
  setActiveWorkspaceTabId(tab.id);
  if (tab.runId) {
    setPlayback("selectedRunId", tab.runId);
  }
  setActiveTab(tab.type);
  setView("activeTab", tab.type);
  if (typeof window !== "undefined") {
    window.location.hash = `#/${tab.type}`;
  }
};

export const activateWorkspaceTab = (tabId: string) => {
  const tab = workspaceTabs().find((t) => t.id === tabId);
  if (!tab) return;
  setActiveWorkspaceTabId(tabId);
  if (tab.runId) {
    setPlayback("selectedRunId", tab.runId);
  }
  setActiveTab(tab.type);
  setView("activeTab", tab.type);
  if (typeof window !== "undefined") {
    window.location.hash = `#/${tab.type}`;
  }
};

export const closeWorkspaceTab = (tabId?: string) => {
  const tabs = workspaceTabs();
  const targetId = tabId || activeWorkspaceTabId();
  let index = tabs.findIndex((t) => t.id === targetId);
  if (index === -1) {
    index = tabs.findIndex((t) => t.type === targetId);
    if (index === -1) {
      index = tabs.length - 1;
    }
  }
  if (index === -1 || tabs.length === 0) return;

  if (tabs.length === 1) {
    closeAllTabs();
    return;
  }

  const tabToClose = tabs[index];
  const nextTabs = tabs.filter((_, i) => i !== index);
  setWorkspaceTabs(nextTabs);

  if (activeWorkspaceTabId() === tabToClose.id || activeWorkspaceTabId() === tabToClose.type) {
    const nextActiveIndex = Math.min(index, nextTabs.length - 1);
    const nextTab = nextTabs[nextActiveIndex];
    activateWorkspaceTab(nextTab.id);
  }
};

export const closeActiveTab = () => {
  const tabs = workspaceTabs();
  if (tabs.length === 0) return;
  const activeId = activeWorkspaceTabId();
  let targetTab = tabs.find((t) => t.id === activeId);
  if (!targetTab) {
    targetTab = tabs.find((t) => t.type === view.activeTab) || tabs[tabs.length - 1];
  }
  if (targetTab) {
    closeWorkspaceTab(targetTab.id);
  }
};

export const navigateTab = (tab: TabType) => {
  if (typeof window !== "undefined") {
    window.location.hash = `#/${tab}`;
  }
  setActiveTab(tab);
  setView("activeTab", tab);

  // Sync workspace tabs
  const currentActiveId = activeWorkspaceTabId();
  const currentTab = workspaceTabs().find((t) => t.id === currentActiveId);
  if (!currentTab || currentTab.type !== tab) {
    const existing = workspaceTabs().find((t) => t.type === tab && !t.runId);
    if (existing) {
      setActiveWorkspaceTabId(existing.id);
    } else {
      const newTab: WorkspaceTab = {
        id: tab,
        type: tab,
        title: getPageTitle(tab),
        closable: true,
      };
      setWorkspaceTabs([...workspaceTabs(), newTab]);
      setActiveWorkspaceTabId(tab);
    }
  }
};

export const navigateActiveTabTo = (tab: TabType) => {
  const newTitle = getPageTitle(tab);
  const activeId = activeWorkspaceTabId();
  const tabs = workspaceTabs();
  const activeIdx = tabs.findIndex((t) => t.id === activeId);

  if (activeIdx !== -1) {
    // Update the CURRENT active tab in place!
    const updated = [...tabs];
    const newId = tab;
    updated[activeIdx] = {
      ...updated[activeIdx],
      id: newId,
      type: tab,
      title: newTitle,
      runId: tab === "player" ? updated[activeIdx].runId : undefined,
    };
    setWorkspaceTabs(updated);
    setActiveWorkspaceTabId(newId);
  } else {
    openWorkspaceTab({
      id: tab,
      type: tab,
      title: newTitle,
      closable: true,
    });
  }

  setActiveTab(tab);
  setView("activeTab", tab);
  if (typeof window !== "undefined") {
    window.location.hash = `#/${tab}`;
  }
};

export const openNewPageTab = (tab: TabType) => {
  const title = getPageTitle(tab);
  const newTabId = `${tab}-${Date.now()}`;

  const newTab: WorkspaceTab = {
    id: newTabId,
    type: tab,
    title,
    closable: true,
  };

  setWorkspaceTabs([...workspaceTabs(), newTab]);
  setActiveWorkspaceTabId(newTabId);
  setActiveTab(tab);
  setView("activeTab", tab);
  if (typeof window !== "undefined") {
    window.location.hash = `#/${tab}`;
  }
};

export const closeAllTabs = () => {
  const title = getPageTitle("onboarding");
  const defaultTab: WorkspaceTab = {
    id: "onboarding",
    type: "onboarding",
    title,
    closable: true,
  };
  setWorkspaceTabs([defaultTab]);
  setActiveWorkspaceTabId("onboarding");
  setActiveTab("onboarding");
  setView("activeTab", "onboarding");
  if (typeof window !== "undefined") {
    window.location.hash = "#/onboarding";
  }
};

export const closeOtherTabs = (keepTabId: string) => {
  const tabs = workspaceTabs();
  const keepTab = tabs.find((t) => t.id === keepTabId);
  if (!keepTab) return;
  setWorkspaceTabs([keepTab]);
  activateWorkspaceTab(keepTab.id);
};

export const reorderWorkspaceTabs = (fromIndex: number, toIndex: number) => {
  if (fromIndex === toIndex) return;
  const tabs = [...workspaceTabs()];
  if (fromIndex < 0 || fromIndex >= tabs.length) return;
  const clampedTo = Math.max(0, Math.min(tabs.length - 1, toIndex));
  if (fromIndex === clampedTo) return;
  const [moved] = tabs.splice(fromIndex, 1);
  tabs.splice(clampedTo, 0, moved);
  setWorkspaceTabs(tabs);
};

export const setLang = (lang: Lang) => {
  setView("lang", lang);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("pfrsim-lang", lang);
      document.documentElement.setAttribute("lang", lang);
    } catch {}
  }
  setWorkspaceTabs((prev) =>
    prev.map((tab) => ({
      ...tab,
      title: tab.type === "player" ? tab.title : getPageTitle(tab.type, lang),
    })),
  );
};

export const toggleLang = () => {
  const nextLang: Lang = currentLang() === "id" ? "en" : "id";
  setLang(nextLang);
};

export const toggleSidebar = () => {
  setSidebarCollapsed(!view.sidebarCollapsed);
};

export const setSidebarCollapsed = (collapsed: boolean) => {
  setView("sidebarCollapsed", collapsed);
  if (typeof window !== "undefined") {
    localStorage.setItem("pfrsim-sidebar-collapsed", String(collapsed));
  }
};

export const setTheme = (theme: "dark" | "light") => {
  setView("theme", theme);
  if (typeof window !== "undefined") {
    localStorage.setItem("pfrsim-theme", theme);
    if (theme === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    }
  }
};

export const toggleTheme = () => {
  setTheme(view.theme === "dark" ? "light" : "dark");
};

// Initialize theme class on startup
if (typeof window !== "undefined") {
  document.documentElement.setAttribute("lang", getInitialLang());
}
if (typeof window !== "undefined") {
  const isLight = localStorage.getItem("pfrsim-theme") === "light";
  if (isLight) {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
  }
}

// Playback actions
let timerId: number | null = null;

export const play = () => {
  if (playback.frames.length === 0) return;
  if (playback.t >= playback.frames.length) {
    setPlayback("t", 1);
  }
  setPlayback("transport", "playing");
  startTimer();
};

export const pause = () => {
  setPlayback("transport", "paused");
  stopTimer();
};

export const togglePlayPause = () => {
  if (playback.transport === "playing") {
    pause();
  } else {
    play();
  }
};

export const scrubTo = (newT: number) => {
  const maxT = Math.max(1, playback.frames.length);
  const clamped = Math.max(1, Math.min(newT, maxT));
  setPlayback("t", clamped);
  if (playback.transport === "playing") {
    pause();
  }
};

export const stepBy = (delta: number) => {
  const maxT = Math.max(1, playback.frames.length);
  const nextT = Math.max(1, Math.min(playback.t + delta, maxT));
  setPlayback("t", nextT);
};

export const setSpeed = (speed: SpeedRate) => {
  setPlayback("speed", speed);
  if (playback.transport === "playing") {
    stopTimer();
    startTimer();
  }
};

function startTimer() {
  stopTimer();
  const intervalMs = 1000 / playback.speed;
  timerId = window.setInterval(() => {
    if (playback.t < playback.frames.length) {
      setPlayback("t", (prev) => prev + 1);
    } else {
      setPlayback("transport", "ended");
      stopTimer();
    }
  }, intervalMs);
}

function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}
