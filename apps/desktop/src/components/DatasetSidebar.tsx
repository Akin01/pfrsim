import { Component, For, Show } from "solid-js";
import { Check, Folder, Pencil, Plus, Trash, X } from "lucide-solid";
import type { DatasetSummary } from "../lib/types";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export interface DatasetSidebarProps {
  datasets: DatasetSummary[];
  selectedId: string | null;
  editingId: string | null;
  editName: string;
  onSelectDataset: (id: string) => void;
  onStartRename: (id: string, name: string, e?: MouseEvent) => void;
  onSaveRename: (id: string, e?: Event) => void;
  onCancelRename: (e?: Event) => void;
  onEditNameChange: (val: string) => void;
  onDeleteClick: (id: string) => void;
  onOpenImportModal: () => void;
}

export const DatasetSidebar: Component<DatasetSidebarProps> = (props) => {
  const t = () => catalogs[view.lang];

  return (
    <div class="w-full md:w-80 border-r border-slate-800 bg-slate-900/40 flex flex-col shrink-0 select-none">
      <div class="p-4 border-b border-slate-800 flex items-center justify-between">
        <h2 class="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
          {t().dataLibraryTitle}
        </h2>
        <span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
          {props.datasets.length}
        </span>
      </div>

      <Show when={props.datasets.length > 0}>
        <div class="p-3 border-b border-slate-800/80 space-y-2">
          <button
            type="button"
            onClick={props.onOpenImportModal}
            class="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center justify-center space-x-2 shadow-xs cursor-pointer active:scale-[0.99]"
          >
            <Plus size={14} />
            <span>{t().dataImportFile}</span>
          </button>
        </div>
      </Show>

      <div class="flex-1 overflow-y-auto p-2 space-y-1.5 flex flex-col">
        <Show
          when={props.datasets.length > 0}
          fallback={
            <div class="p-6 text-center text-slate-500 text-xs space-y-3 my-auto">
              <div class="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-slate-400 font-bold">
                <Folder size={20} class="text-slate-400" />
              </div>
              <p class="font-medium text-slate-300">{t().dataNoDatasetsTitle}</p>
              <p class="text-[11px] text-slate-400">{t().dataNoDatasetsDesc}</p>
              <button
                type="button"
                onClick={props.onOpenImportModal}
                class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {t().dataImportNewBtn}
              </button>
            </div>
          }
        >
          <For each={props.datasets}>
            {(ds) => {
              const isSelected = () => props.selectedId === ds.id;
              const isEditing = () => props.editingId === ds.id;

              return (
                <div
                  onClick={() => {
                    if (!isEditing()) props.onSelectDataset(ds.id);
                  }}
                  class={`group relative p-3 rounded-xl cursor-pointer border transition-all ${
                    isSelected()
                      ? "bg-emerald-500/15 border-emerald-500/50 shadow-md"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Top Row: Name / Inline Edit & Actions */}
                  <div class="flex items-center justify-between mb-1.5 gap-1.5">
                    <Show
                      when={isEditing()}
                      fallback={
                        <div class="flex items-center justify-between flex-1 min-w-0 pr-1">
                          <h3
                            class="text-xs font-bold text-slate-200 truncate font-mono"
                            title={ds.name}
                          >
                            {ds.name}
                          </h3>
                          <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => props.onStartRename(ds.id, ds.name, e)}
                              class="p-1 rounded-md text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors cursor-pointer"
                              title={t().dataRenameTooltip}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                props.onDeleteClick(ds.id);
                              }}
                              class="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                              title={t().dataDeleteTooltip}
                            >
                              <Trash size={12} />
                            </button>
                          </div>
                        </div>
                      }
                    >
                      <div
                        class="flex items-center space-x-1 flex-1 min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={props.editName}
                          onInput={(e) => props.onEditNameChange(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") props.onSaveRename(ds.id, e);
                            if (e.key === "Escape") props.onCancelRename(e);
                          }}
                          class="flex-1 bg-slate-950 border border-emerald-500 text-slate-100 text-xs font-mono font-bold px-2 py-0.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-0"
                          autofocus
                        />
                        <button
                          type="button"
                          onClick={(e) => props.onSaveRename(ds.id, e)}
                          class="p-1 rounded-md text-emerald-400 hover:bg-emerald-500/20 transition-colors shrink-0 cursor-pointer"
                          title="Save"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={props.onCancelRename}
                          class="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                          title="Cancel"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </Show>
                  </div>

                  {/* Bottom Row */}
                  <div class="flex items-center justify-between text-[11px] font-mono">
                    <span class="text-slate-400">{t().dataRowsCount(ds.n)}</span>
                    <span class="text-emerald-400 font-medium">
                      {t().dataRunsCount(ds.run_count)}
                    </span>
                  </div>
                </div>
              );
            }}
          </For>
        </Show>
      </div>
    </div>
  );
};
