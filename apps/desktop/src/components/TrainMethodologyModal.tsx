import { Component } from "solid-js";
import { BookOpen, X } from "lucide-solid";
import Dialog from "corvu/dialog";
import { MathTex } from "./MathTex";
import { catalogs } from "../i18n/catalog";
import { view } from "../lib/store";

export interface TrainMethodologyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TrainMethodologyModal: Component<TrainMethodologyModalProps> = (props) => {
  const t = () => catalogs[view.lang];

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-transparent backdrop-blur-md transition-all duration-200" />
        <Dialog.Content class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-[94vw] max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-5 focus:outline-none text-slate-900 dark:text-slate-100">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div class="flex items-center space-x-2">
              <BookOpen size={18} class="text-emerald-600 dark:text-emerald-400" />
              <Dialog.Label class="text-base font-bold text-slate-900 dark:text-slate-100">
                {t().trainMethodologyModalTitle}
              </Dialog.Label>
            </div>
            <Dialog.Close class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
              <X size={16} />
            </Dialog.Close>
          </div>

          <div class="space-y-4 text-xs leading-relaxed">
            {/* Step 1 */}
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <span class="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                1. Multivariate Imputation
              </span>
              <p class="text-slate-600 dark:text-slate-300 text-[11px]">
                Fills missing sensor telemetry across 4 variables using joint Euclidean nearest
                neighbor distance:
              </p>
              <div class="text-center py-1">
                <MathTex
                  math="d(x_i, x_j) = \sqrt{\sum_{v \in \{\text{WT, SM, Rf, Temp}\}} (x_{i,v} - x_{j,v})^2}"
                  block={true}
                />
              </div>
            </div>

            {/* Step 2 */}
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <span class="text-xs font-bold text-blue-700 dark:text-blue-400 font-mono">
                2. Out-of-Sample Forecasting
              </span>
              <p class="text-slate-600 dark:text-slate-300 text-[11px]">
                AutoARIMA utilizes Box-Cox profile maximum likelihood estimation to stabilize
                variance before model fitting:
              </p>
              <div class="text-center py-1">
                <MathTex
                  math="y_t^{(\lambda)} = \begin{cases} \frac{y_t^\lambda - 1}{\lambda} & \lambda \neq 0 \\ \ln(y_t) & \lambda = 0 \end{cases}"
                  block={true}
                />
              </div>
            </div>

            {/* Step 3 */}
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <span class="text-xs font-bold text-amber-700 dark:text-amber-400 font-mono">
                3. Peat Fire Vulnerability Index (PFVI)
              </span>
              <p class="text-slate-600 dark:text-slate-300 text-[11px]">
                Evaluates wildfire danger as a coupling of soil dryness and water table drawdown:
              </p>
              <div class="text-center py-1">
                <MathTex
                  math="\text{PFVI}_t = \max\left(0, \frac{\text{SM}_{\text{crit}} - \text{SM}_t}{\text{SM}_{\text{crit}}} \times \left(1 + \frac{|\text{WT}_t|}{\text{WT}_{\text{ref}}}\right)\right)"
                  block={true}
                />
              </div>
            </div>

            {/* Step 4 */}
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <span class="text-xs font-bold text-purple-700 dark:text-purple-400 font-mono">
                4. Nelder-Mead Simplex Calibration
              </span>
              <p class="text-slate-600 dark:text-slate-300 text-[11px]">
                Optimizes parameter set{" "}
                <MathTex math="\theta = (\text{SM}_{\text{crit}}, \text{WT}_{\text{ref}})" />{" "}
                against observed drought indices:
              </p>
              <div class="text-center py-1">
                <MathTex
                  math="\min_{\theta} \frac{1}{N} \sum_{t=1}^N \left(\text{PFVI}_t(\theta) - \text{DI}_{\text{obs}, t}\right)^2"
                  block={true}
                />
              </div>
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <Dialog.Close class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 text-xs font-bold transition-colors cursor-pointer shadow-xs">
              {t().trainCloseModal}
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
