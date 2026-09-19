import { BarChart3, Cpu, Database, PlayCircle } from "lucide-solid";
import type { Component } from "solid-js";

export const SUPPORTED_DATASET_EXTENSIONS = [
  ".csv",
  ".tsv",
  ".xlsx",
  ".xls",
  ".ods",
  ".parquet",
  ".pq",
] as const;

export const isValidDatasetFile = (fileName: string): boolean => {
  const lower = fileName.toLowerCase();
  return SUPPORTED_DATASET_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

export interface OnboardingStepItem {
  step: number;
  id: "data" | "train" | "player" | "runs";
  title: string;
  desc: string;
  icon: Component<{ size?: number | string; class?: string }>;
  tab: "data" | "train" | "player" | "runs";
  color: string;
  accentBorder: string;
}

export const getOnboardingSteps = (lang: "id" | "en" = "en"): OnboardingStepItem[] => [
  {
    step: 1,
    id: "data",
    title: lang === "id" ? "1. Unggah Data Lingkungan" : "1. Import Peatland Data",
    desc:
      lang === "id"
        ? "Impor berkas CSV/Excel berisi 4 variabel wajib: Muka Air Gambut (WT), Kelembaban Tanah (SM), Curah Hujan (Rf), dan Suhu (Temp)."
        : "Upload CSV/Excel with 4 core series: Water Table (WT), Soil Moisture (SM), Rainfall (Rf), and Temperature (Temp).",
    icon: Database,
    tab: "data",
    color: "text-emerald-500 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    accentBorder: "hover:border-emerald-500/50 hover:shadow-emerald-500/10",
  },
  {
    step: 2,
    id: "train",
    title: lang === "id" ? "2. Pelatihan & Kalibrasi Model" : "2. Model Training & Fit",
    desc:
      lang === "id"
        ? "Pilih algoritma imputasi (kNN/Spline) dan prakiraan (AutoARIMA), kalibrasi parameter PFVI via Nelder-Mead secara deterministik."
        : "Select imputation (kNN/Spline) and forecaster (AutoARIMA), calibrating non-linear PFVI parameters via Nelder-Mead.",
    icon: Cpu,
    tab: "train",
    color: "text-indigo-500 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
    accentBorder: "hover:border-indigo-500/50 hover:shadow-indigo-500/10",
  },
  {
    step: 3,
    id: "player",
    title: lang === "id" ? "3. Simulasi Risiko Interaktif" : "3. Interactive Risk Timeline",
    desc:
      lang === "id"
        ? "Putar evolusi risiko kebakaran harian, amati zonasi bahaya (Low/Moderate/High/Extreme) pada cakrawala prakiraan."
        : "Scrub daily fire risk evolution, monitoring dynamic danger thresholds (Low, Moderate, High, Extreme).",
    icon: PlayCircle,
    tab: "player",
    color: "text-cyan-500 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
    accentBorder: "hover:border-cyan-500/50 hover:shadow-cyan-500/10",
  },
  {
    step: 4,
    id: "runs",
    title: lang === "id" ? "4. Audit Hasil & Metrik MLflow" : "4. Metrics Audit & Export",
    desc:
      lang === "id"
        ? "Bandingkan metrik MSE, RMSE, kriteria AIC/BIC, dan ekspor laporan situasi risiko dalam format PDF atau gambar PNG."
        : "Compare MSE/RMSE calibration metrics, examine AIC/BIC, and export reproducible PDF or PNG situation reports.",
    icon: BarChart3,
    tab: "runs",
    color: "text-purple-500 dark:text-purple-400 border-purple-500/30 bg-purple-500/10",
    accentBorder: "hover:border-purple-500/50 hover:shadow-purple-500/10",
  },
];
