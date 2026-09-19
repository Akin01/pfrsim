import { Component, Show } from "solid-js";
import { Trash, TriangleAlert } from "lucide-solid";
import Dialog from "corvu/dialog";
import type { DatasetSummary } from "../lib/types";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export interface DatasetDeleteDialogProps {
  targetDataset: DatasetSummary | undefined;
  onClose: () => void;
  onConfirm: () => void;
}

export const DatasetDeleteDialog: Component<DatasetDeleteDialogProps> = (props) => {
  const t = () => catalogs[view.lang];

  return (
    <Dialog
      open={props.targetDataset !== undefined}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-transparent backdrop-blur-md transition-all duration-200" />
        <Dialog.Content class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-[92vw] p-6 shadow-2xl space-y-4 focus:outline-none text-slate-100 select-none">
          <div class="flex items-center space-x-3 text-rose-400">
            <div class="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
              <TriangleAlert size={20} class="text-rose-400" />
            </div>
            <div>
              <Dialog.Label class="text-base font-bold text-slate-100">
                {t().dataDeleteModalTitle}
              </Dialog.Label>
              <p class="text-xs text-slate-400 mt-0.5">{t().dataDeleteModalWarning}</p>
            </div>
          </div>

          <Show when={props.targetDataset}>
            {(ds) => (
              <div class="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-xs font-mono">
                <div class="text-slate-300 font-bold truncate">{ds().name}</div>
                <div class="text-slate-500 text-[11px]">
                  ID: {ds().id} · {t().dataRowsCount(ds().n)} · {t().dataRunsCount(ds().run_count)}
                </div>
              </div>
            )}
          </Show>

          <p class="text-xs text-slate-400">{t().dataDeleteLinkedNotice}</p>

          <div class="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              {t().dataDeleteCancel}
            </button>
            <button
              type="button"
              onClick={props.onConfirm}
              class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-900/30 flex items-center space-x-1.5 cursor-pointer"
            >
              <Trash size={14} />
              <span>{t().dataDeleteConfirm}</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
