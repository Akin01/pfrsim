import { Component, createMemo, createSignal, For, Show } from "solid-js";
import Dialog from "corvu/dialog";
import { CircleQuestionMark, Keyboard, Layers, Play, Search, X } from "lucide-solid";
import { setView, view } from "../lib/store";

export type ShortcutCategory = "all" | "simulation" | "workspace" | "global";

export interface ShortcutItem {
  id: string;
  category: "simulation" | "workspace" | "global";
  labelId: string;
  labelEn: string;
  descriptionId?: string;
  descriptionEn?: string;
  keys: string[][]; // e.g. [["Space"]], [["Shift", "←"], ["Shift", "→"]], [["Ctrl", "W"], ["Alt", "W"]]
}

const SHORTCUTS_DATA: ShortcutItem[] = [
  // Simulation & Timeline
  {
    id: "play_pause",
    category: "simulation",
    labelId: "Putar / Jeda Simulasi",
    labelEn: "Play / Pause Simulation",
    descriptionId: "Menjalankan atau menghentikan pemutaran animasi risiko secara otomatis",
    descriptionEn: "Toggle automatic simulation timeline playback",
    keys: [["Space"]],
  },
  {
    id: "step_frame",
    category: "simulation",
    labelId: "Mundur / Maju 1 Frame",
    labelEn: "Step -1 / +1 Frame",
    descriptionId: "Berpindah tepat satu langkah waktu ke belakang atau ke depan",
    descriptionEn: "Step exactly one single time step backward or forward",
    keys: [["←"], ["→"]],
  },
  {
    id: "step_horizon",
    category: "simulation",
    labelId: "Lompat per Horizon Prakiraan ±h",
    labelEn: "Jump Horizon ±h Frames",
    descriptionId: "Melompati rentang waktu sebanyak cakrawala prakiraan (h)",
    descriptionEn: "Jump timeline forward or backward by the full forecast horizon length (h)",
    keys: [
      ["Shift", "←"],
      ["Shift", "→"],
    ],
  },
  {
    id: "timeline_boundary",
    category: "simulation",
    labelId: "Awal / Akhir Garis Waktu",
    labelEn: "Start / End Timeline",
    descriptionId: "Langsung melompat ke frame paling pertama atau frame terakhir",
    descriptionEn: "Jump directly to the earliest recorded frame or the latest frame",
    keys: [["Home"], ["End"]],
  },
  {
    id: "jump_forecast",
    category: "simulation",
    labelId: "Lompat ke Awal Horizon Prakiraan",
    labelEn: "Jump to Forecast Horizon Point",
    descriptionId:
      "Mengarahkan playhead langsung ke batas antara data observasi dan data prakiraan",
    descriptionEn: "Snap playhead to the transition index between observed data and model forecast",
    keys: [["F"]],
  },
  {
    id: "speed_cycle",
    category: "simulation",
    labelId: "Ubah Kecepatan Putar (0.5x – 4x)",
    labelEn: "Cycle Playback Speed (0.5x – 4x)",
    descriptionId: "Mengubah laju fps pemutaran simulasi dari lambat hingga cepat",
    descriptionEn: "Switch animation playback speed between 0.5x, 1x, 2x, and 4x",
    keys: [["1"], ["2"], ["3"], ["4"]],
  },

  // Workspace & Tabs
  {
    id: "toggle_sidebar",
    category: "workspace",
    labelId: "Buka / Tutup Sidebar Kiri",
    labelEn: "Toggle Left Navigation Sidebar",
    descriptionId: "Memperluas atau menciutkan bilah navigasi modul",
    descriptionEn: "Expand or collapse the primary application module sidebar",
    keys: [["Ctrl", "B"]],
  },
  {
    id: "close_tab",
    category: "workspace",
    labelId: "Tutup Tab Aktif Saat Ini",
    labelEn: "Close Active Workspace Tab",
    descriptionId: "Menutup tab lembar kerja yang sedang dibuka dan beralih ke tab sebelumnya",
    descriptionEn: "Close the currently focused workspace tab and switch to adjacent tab",
    keys: [
      ["Ctrl", "W"],
      ["Alt", "W"],
    ],
  },
  {
    id: "switch_tab",
    category: "workspace",
    labelId: "Beralih Cepat Tab Workspace",
    labelEn: "Switch Workspace Tab (1 – 5)",
    descriptionId: "Berpindah langsung ke tab nomor urut tertentu pada tab bar",
    descriptionEn: "Directly jump to the corresponding tab index on the workspace tab strip",
    keys: [
      ["Alt", "1"],
      ["Alt", "2"],
      ["Alt", "3"],
    ],
  },

  // Global & Modals
  {
    id: "toggle_shortcuts",
    category: "global",
    labelId: "Buka / Tutup Bantuan Pintasan",
    labelEn: "Toggle Keyboard Shortcuts Help",
    descriptionId: "Menampilkan jendela panduan tombol pintas keyboard ini",
    descriptionEn: "Display this keyboard shortcuts dialog reference",
    keys: [["?"]],
  },
  {
    id: "open_glossary",
    category: "global",
    labelId: "Buka Glosarium Sains & Metodologi",
    labelEn: "Open Peatland Scientific Glossary",
    descriptionId: "Membuka katalog istilah hidrologi, rumus matematika, dan acuan bahaya",
    descriptionEn: "Open reference dialog for hydrological terms, formulas, and hazard metrics",
    keys: [["G"]],
  },
  {
    id: "escape_dismiss",
    category: "global",
    labelId: "Tutup Dialog / Popover / Menu",
    labelEn: "Dismiss Modals, Popovers & Menus",
    descriptionId: "Menutup popover info helper, menu dropdown, atau modal yang aktif",
    descriptionEn: "Close any currently active popover, context menu, or modal dialog",
    keys: [["Esc"]],
  },
];

export const KeyboardModal: Component = () => {
  const [search, setSearch] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal<ShortcutCategory>("all");

  const lang = () => view.lang;

  const categories = createMemo(() => [
    {
      id: "all" as ShortcutCategory,
      labelId: "Semua Pintasan",
      labelEn: "All Shortcuts",
      icon: Keyboard,
    },
    {
      id: "simulation" as ShortcutCategory,
      labelId: "Simulasi & Pemutar",
      labelEn: "Simulation & Player",
      icon: Play,
    },
    {
      id: "workspace" as ShortcutCategory,
      labelId: "Workspace & Tab",
      labelEn: "Workspace & Tabs",
      icon: Layers,
    },
    {
      id: "global" as ShortcutCategory,
      labelId: "Aplikasi & Bantuan",
      labelEn: "App & Help",
      icon: CircleQuestionMark,
    },
  ]);

  const filteredItems = createMemo(() => {
    const q = search().trim().toLowerCase();
    const cat = selectedCategory();

    return SHORTCUTS_DATA.filter((item) => {
      // Category filter
      if (cat !== "all" && item.category !== cat) return false;

      // Query filter
      if (!q) return true;

      const label = (lang() === "id" ? item.labelId : item.labelEn).toLowerCase();
      const desc = (lang() === "id" ? item.descriptionId : item.descriptionEn)?.toLowerCase() ?? "";
      const keysText = item.keys.flat().join(" ").toLowerCase();

      return label.includes(q) || desc.includes(q) || keysText.includes(q) || item.id.includes(q);
    });
  });

  const isMac = () => {
    if (typeof navigator === "undefined") return false;
    return /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
  };

  const formatKeyName = (key: string) => {
    if (key === "Ctrl" && isMac()) return "⌘";
    if (key === "Alt" && isMac()) return "⌥";
    if (key === "Shift" && isMac()) return "⇧";
    return key;
  };

  return (
    <Dialog open={view.showShortcuts} onOpenChange={(open) => setView("showShortcuts", open)}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-transparent backdrop-blur-md transition-all duration-150 data-open:opacity-100 data-closed:opacity-0" />
        <Dialog.Content class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-[92vw] shadow-2xl flex flex-col max-h-[85vh] focus:outline-none overflow-hidden transition-all duration-150 data-open:opacity-100 data-open:scale-100 data-closed:opacity-0 data-closed:scale-95">
          {/* Header */}
          <div class="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <div class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Keyboard size={18} />
                </div>
                <Dialog.Label class="text-base font-bold text-slate-900 dark:text-slate-100 font-sans tracking-tight">
                  {lang() === "id" ? "Pintasan Keyboard Aplikasi" : "Simulation & App Shortcuts"}
                </Dialog.Label>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 pl-8">
                {lang() === "id"
                  ? "Akselerasi navigasi, pemutar simulasi, dan kontrol workspace dengan tombol fisik."
                  : "Accelerate simulation playback, workspace navigation, and modal dialogs with physical hotkeys."}
              </p>
            </div>

            <Dialog.Close
              class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer shrink-0"
              title={lang() === "id" ? "Tutup (Esc)" : "Close (Esc)"}
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Search & Category Filter Toolbar */}
          <div class="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
            {/* Search Input Bar with embedded count badge */}
            <div class="relative flex items-center">
              <Search
                size={15}
                class="absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
                placeholder={
                  lang() === "id"
                    ? "Cari tombol pintas (cth: Space, Frame, Tab, W, G)..."
                    : "Search shortcuts (e.g. Space, Frame, Tab, W, G)..."
                }
                class="w-full pl-9 pr-28 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <div class="absolute right-2.5 flex items-center gap-1.5">
                <Show when={search()}>
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    class="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X size={12} />
                  </button>
                </Show>
                <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/70 shadow-2xs select-none whitespace-nowrap">
                  <span>{filteredItems().length}</span>
                  <span class="ml-1">{lang() === "id" ? "pintasan" : "shortcuts"}</span>
                </span>
              </div>
            </div>

            {/* Category Filter Pills (Full Width) */}
            <div class="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden text-xs font-sans w-full">
              <For each={categories()}>
                {(cat) => {
                  const Icon = cat.icon;
                  const isSelected = () => selectedCategory() === cat.id;
                  return (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      class={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                        isSelected()
                          ? "bg-emerald-600 text-white shadow-xs font-semibold"
                          : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60"
                      }`}
                    >
                      <Icon size={12} class="shrink-0" />
                      <span>{lang() === "id" ? cat.labelId : cat.labelEn}</span>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>

          {/* Shortcuts List Body */}
          <div class="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/60">
            <For each={filteredItems()}>
              {(item) => (
                <div class="pt-2.5 first:pt-0 flex items-center justify-between gap-4 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors">
                  {/* Left: Action Label & Description */}
                  <div class="space-y-0.5 min-w-0 pr-2">
                    <h4 class="text-xs font-semibold text-slate-800 dark:text-slate-200 font-sans tracking-tight">
                      {lang() === "id" ? item.labelId : item.labelEn}
                    </h4>
                    <Show when={item.descriptionId}>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-sm">
                        {lang() === "id" ? item.descriptionId : item.descriptionEn}
                      </p>
                    </Show>
                  </div>

                  {/* Right: Tactile Keycaps */}
                  <div class="flex items-center gap-2 shrink-0">
                    <For each={item.keys}>
                      {(combo, comboIdx) => (
                        <>
                          <Show when={comboIdx() > 0}>
                            <span class="text-slate-400 dark:text-slate-500 font-mono text-xs">
                              /
                            </span>
                          </Show>
                          <div class="inline-flex items-center gap-1">
                            <For each={combo}>
                              {(k, kIdx) => (
                                <>
                                  <Show when={kIdx() > 0}>
                                    <span class="text-slate-400 dark:text-slate-500 font-mono text-[10px]">
                                      +
                                    </span>
                                  </Show>
                                  <kbd class="inline-flex items-center justify-center min-w-6 h-6 px-1.5 text-xs font-mono font-semibold rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-2xs shadow-slate-900/10 dark:shadow-none ring-1 ring-slate-900/5 dark:ring-white/5 select-none">
                                    {formatKeyName(k)}
                                  </kbd>
                                </>
                              )}
                            </For>
                          </div>
                        </>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>

            {/* Empty State */}
            <Show when={filteredItems().length === 0}>
              <div class="py-10 flex flex-col items-center justify-center text-center space-y-3">
                <div class="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                  <Search size={22} />
                </div>
                <div class="space-y-1">
                  <h4 class="text-sm font-semibold text-slate-800 dark:text-slate-200 font-sans">
                    {lang() === "id" ? "Tidak Ada Pintasan yang Cocok" : "No Matching Shortcuts"}
                  </h4>
                  <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                    {lang() === "id"
                      ? `Tidak ditemukan pintasan keyboard untuk pencarian "${search()}".`
                      : `No shortcuts matched your search for "${search()}".`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("all");
                  }}
                  class="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 font-medium transition-colors cursor-pointer"
                >
                  {lang() === "id" ? "Reset Pencarian & Filter" : "Reset Search & Filters"}
                </button>
              </div>
            </Show>
          </div>

          {/* Modal Footer */}
          <div class="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span class="flex items-center gap-1.5 font-mono text-[11px]">
              <kbd class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                ?
              </kbd>
              <span>
                {lang() === "id"
                  ? "Tekan ? kapan saja untuk panduan"
                  : "Press ? anytime for shortcut help"}
              </span>
            </span>

            <Dialog.Close class="px-3.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors cursor-pointer">
              {lang() === "id" ? "Tutup" : "Close"}
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default KeyboardModal;
