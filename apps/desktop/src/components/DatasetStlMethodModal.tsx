import { Component } from "solid-js";
import { Layers, X } from "lucide-solid";
import Dialog from "corvu/dialog";
import { MathTex } from "./MathTex";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export interface DatasetStlMethodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DatasetStlMethodModal: Component<DatasetStlMethodModalProps> = (props) => {
  const t = () => catalogs[view.lang];

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-transparent backdrop-blur-md transition-all duration-200" />
        <Dialog.Content class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-[92vw] p-6 shadow-2xl flex flex-col max-h-[88vh] overflow-y-auto focus:outline-none select-none text-slate-900 dark:text-slate-100">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5 mb-4">
            <div class="flex items-center space-x-2.5">
              <div class="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Layers size={16} />
              </div>
              <div>
                <Dialog.Label class="text-base font-bold text-slate-900 dark:text-slate-100">
                  {t().dataStlMethodGuide}
                </Dialog.Label>
                <div class="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center space-x-1.5">
                  <MathTex math="y_t = T_t + S_t + R_t" />
                </div>
              </div>
            </div>
            <Dialog.Close class="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div class="space-y-4 text-xs font-sans">
            {/* Card 1: Additive Model */}
            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-900 dark:text-slate-100 text-xs font-mono">
                  1.{" "}
                  {view.lang === "id"
                    ? "Model Aditif & Tren Terpusat"
                    : "Additive Model & Centered Trend"}
                </span>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/30">
                  <MathTex math="y_t = T_t + S_t + R_t" />
                </span>
              </div>
              <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
                {view.lang === "id"
                  ? "Deret waktu dipecah menjadi tiga komponen aditif: Tren (T) diekstrak dengan rata-rata bergerak terpusat berukuran periode jendela (centered moving average), Musiman (S) dihitung dari rata-rata per-posisi sepanjang siklus, dan Residu (R) adalah sisa fluktuasi acak (R = y - T - S)."
                  : "The time series is split into three additive components: Trend (T) is extracted using a centered moving average over the period window, Seasonal (S) is calculated from per-position averages across cycles, and Residual (R) is the leftover noise (R = y - T - S)."}
              </p>
            </div>

            {/* Card 2: Seasonality Gate */}
            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-900 dark:text-slate-100 text-xs font-mono">
                  2. {view.lang === "id" ? "Validasi Gerbang Musiman" : "Seasonality Gate Criteria"}
                </span>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <MathTex math="|r_k| \ge 0.50" />
                </span>
              </div>
              <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
                {view.lang === "id"
                  ? "Dekomposisi tidak dipaksakan pada semua variabel. Dekomposisi hanya dijalankan jika fungsi autokorelasi (ACF) mendeteksi puncak lokal rₖ ≥ 0.50 dengan lembah pemisah sebelumnya dan data mencakup minimal 2 siklus penuh. Deret yang didominasi tren (seperti Water Table) atau acak tidak dipaksakan agar tidak timbul artefak semu."
                  : "Decomposition is not forced onto all variables. It only runs when autocorrelation (ACF) discovers a local peak rₖ ≥ 0.50 with a preceding valley and at least 2 full cycles exist. Trend-dominated (e.g. Water Table) or random records are preserved without artificial decomposition artifacts."}
              </p>
            </div>

            {/* Card 3: NaN Gap Preservation */}
            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-900 dark:text-slate-100 text-xs font-mono">
                  3.{" "}
                  {view.lang === "id"
                    ? "Integritas & Penanganan Celah NaN"
                    : "NaN Gap Preservation & Alignment"}
                </span>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  Row-aligned
                </span>
              </div>
              <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
                {view.lang === "id"
                  ? "Pasangan lag autokorelasi dihitung berdasarkan indeks waktu baris sebenarnya, bukan hasil kompresi baris hilang. Jendela tren yang bersentuhan dengan nilai hilang (NaN) dibiarkan null sehingga celah data tidak mengotori titik tetangga."
                  : "Autocorrelation lag pairs are computed strictly using true row time indices rather than compressed gaps. Moving-average trend windows that touch missing (NaN) values are left null to prevent missing values from smearing into neighboring points."}
              </p>
            </div>

            {/* Card 4: Feature Metrics (Wang-Smith-Hyndman) */}
            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-900 dark:text-slate-100 text-xs font-mono">
                  4.{" "}
                  {view.lang === "id"
                    ? "Kekuatan Tren & Musiman (Wang et al., 2006)"
                    : "Trend & Seasonal Strength (Wang et al., 2006)"}
                </span>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                  <MathTex math="F_T, F_S \in [0, 1]" />
                </span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                  <span class="block text-[9px] text-slate-400 font-mono uppercase mb-0.5">
                    {t().dataTrendStrength}
                  </span>
                  <MathTex math="F_T = \max\left(0, 1 - \frac{\text{Var}(R)}{\text{Var}(T + R)}\right)" />
                </div>
                <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                  <span class="block text-[9px] text-slate-400 font-mono uppercase mb-0.5">
                    {t().dataSeasonalStrength}
                  </span>
                  <MathTex math="F_S = \max\left(0, 1 - \frac{\text{Var}(R)}{\text{Var}(S + R)}\right)" />
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
            <Dialog.Close class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              {view.lang === "id" ? "Tutup" : "Close"}
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
