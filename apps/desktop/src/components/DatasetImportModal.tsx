import { Component, Show } from "solid-js";
import { CloudUpload, RefreshCw, X } from "lucide-solid";
import Dialog from "corvu/dialog";
import { ColumnMapperCanvas } from "./ColumnMapperCanvas";
import type { DatasetInspection } from "../lib/types";
import { dialogPickFile, isTauri } from "../lib/tauri";
import { view } from "../lib/store";

export interface DatasetImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modalInspection: DatasetInspection | null;
  modalBytes: number[] | null;
  modalFilePath: string | null;
  isModalDragging: boolean;
  setIsModalDragging: (val: boolean) => void;
  onFileSelect: (file: File) => void;
  onPathSelect?: (fileName: string, filePath: string) => void;
  onImportSuccess: (newId: string) => void;
  onCancelInspection: () => void;
  loading?: boolean;
}

export const DatasetImportModal: Component<DatasetImportModalProps> = (props) => {
  let isPicking = false;
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-transparent backdrop-blur-md transition-all duration-150" />
        <Dialog.Content
          class={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl overflow-y-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden max-h-[92vh] focus:outline-none transition-all duration-150 select-none ${
            props.modalInspection
              ? "max-w-4xl w-[82vw]"
              : "w-[92vw] max-w-2xl min-h-110 flex flex-col justify-between"
          }`}
        >
          <Show
            when={props.modalInspection}
            fallback={
              <div class="space-y-4 flex-1 flex flex-col">
                <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <Dialog.Label class="text-base font-bold text-slate-900 dark:text-slate-100">
                    {view.lang === "id" ? "Impor Dataset Baru" : "Import New Dataset"}
                  </Dialog.Label>
                  <Dialog.Close class="text-slate-400 hover:text-slate-200 cursor-pointer">
                    <X size={16} />
                  </Dialog.Close>
                </div>

                {/* File Upload Trigger & Native Drag-Drop Target */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    props.setIsModalDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    props.setIsModalDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    props.setIsModalDragging(false);
                    const files = e.dataTransfer?.files;
                    if (files && files.length > 0) {
                      const file = files[0];
                      const nativePath = (file as unknown as { path?: string }).path;
                      if (nativePath && nativePath.trim().length > 0 && props.onPathSelect) {
                        props.onPathSelect(file.name, nativePath.trim());
                        return;
                      }
                      props.onFileSelect(file);
                    }
                  }}
                  onClick={async (e) => {
                    if (isPicking) return;
                    if (e.target === document.getElementById("data-page-file-input")) {
                      return;
                    }
                    if (isTauri() && props.onPathSelect) {
                      isPicking = true;
                      try {
                        const picked = await dialogPickFile(
                          view.lang === "id" ? "Pilih Berkas Dataset" : "Select Dataset File",
                        );
                        if (picked.ok && picked.data) {
                          const path = picked.data;
                          const name = path.split(/[/\\]/).pop() || "dataset";
                          props.onPathSelect(name, path);
                        }
                      } finally {
                        isPicking = false;
                      }
                      return;
                    }
                    const input = document.getElementById(
                      "data-page-file-input",
                    ) as HTMLInputElement;
                    input?.click();
                  }}
                  class={`flex-1 min-h-70 md:min-h-80 border-2 border-dashed rounded-2xl p-8 md:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-4 ${
                    props.isModalDragging
                      ? "border-emerald-500 bg-emerald-500/10 scale-[1.01]"
                      : "border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <input
                    id="data-page-file-input"
                    type="file"
                    accept=".csv,.tsv,.xlsx,.xls,.ods,.parquet,.pq,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    class="hidden"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const files = e.currentTarget.files;
                      if (files && files.length > 0) {
                        const file = files[0];
                        const nativePath = (file as unknown as { path?: string }).path;
                        if (nativePath && nativePath.trim().length > 0 && props.onPathSelect) {
                          props.onPathSelect(file.name, nativePath.trim());
                          return;
                        }
                        props.onFileSelect(file);
                      }
                    }}
                  />
                  <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                    <Show when={props.loading} fallback={<CloudUpload size={32} />}>
                      <RefreshCw size={30} class="animate-spin text-emerald-500" />
                    </Show>
                  </div>
                  <div class="space-y-1.5 max-w-md mx-auto">
                    <p class="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
                      {props.loading
                        ? view.lang === "id"
                          ? "Memeriksa Skema & Struktur Berkas..."
                          : "Inspecting File Schema & Columns..."
                        : props.isModalDragging
                          ? view.lang === "id"
                            ? "Lepaskan Berkas di Sini"
                            : "Drop Dataset File Here"
                          : view.lang === "id"
                            ? "Pilih atau Seret Berkas ke Sini"
                            : "Select or Drag & Drop File Here"}
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                      {view.lang === "id"
                        ? "Mendukung CSV, TSV, Excel (.xlsx/.xls), dan Parquet (.parquet)"
                        : "Supports CSV, TSV, Excel (.xlsx/.xls), and Parquet (.parquet)"}
                    </p>
                    <p class="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                      {view.lang === "id"
                        ? "Format kolom diperiksa otomatis dengan pemeta interaktif"
                        : "Column format inspected automatically with interactive mapper"}
                    </p>
                  </div>

                  {/* Supported format badges */}
                  <div class="flex items-center justify-center gap-2 pt-2 flex-wrap">
                    <span class="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs">
                      CSV / TSV
                    </span>
                    <span class="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs">
                      Excel (.xlsx, .xls)
                    </span>
                    <span class="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs">
                      Parquet (.parquet)
                    </span>
                  </div>
                </div>

                <div class="flex items-center justify-end pt-2">
                  <Dialog.Close class="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer">
                    {view.lang === "id" ? "Batal" : "Cancel"}
                  </Dialog.Close>
                </div>
              </div>
            }
          >
            <ColumnMapperCanvas
              inspection={props.modalInspection!}
              rawBytes={props.modalBytes ?? undefined}
              filePath={props.modalFilePath ?? undefined}
              onImportSuccess={props.onImportSuccess}
              onCancel={props.onCancelInspection}
            />
          </Show>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
