import { Component } from "solid-js";
import { TriangleAlert } from "lucide-solid";
import Dialog from "corvu/dialog";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export interface TrainDeleteJobDialogProps {
  jobId: string | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const TrainDeleteJobDialog: Component<TrainDeleteJobDialogProps> = (props) => {
  const t = () => catalogs[view.lang];

  return (
    <Dialog
      open={props.jobId !== null}
      onOpenChange={(open) => {
        if (!open && !props.deleting) props.onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-transparent backdrop-blur-md transition-all duration-200" />
        <Dialog.Content class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-[92vw] p-6 shadow-2xl space-y-4 focus:outline-none text-slate-900 dark:text-slate-100">
          <div class="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
            <div class="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center">
              <TriangleAlert size={20} class="text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <Dialog.Label class="text-base font-bold text-slate-900 dark:text-slate-100">
                {t().trainDeleteDialogTitle}
              </Dialog.Label>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t().trainDeleteDialogDesc}
              </p>
            </div>
          </div>

          <p class="text-xs text-slate-800 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 break-all">
            job_id: {props.jobId}
          </p>

          <div class="flex items-center justify-end space-x-2 pt-2">
            <Dialog.Close
              disabled={props.deleting}
              onClick={props.onClose}
              class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {t().trainCancelBtn}
            </Dialog.Close>
            <button
              type="button"
              onClick={props.onConfirm}
              disabled={props.deleting}
              class="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {props.deleting ? t().trainDeletingBtn : t().trainDeleteConfirmBtn}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
