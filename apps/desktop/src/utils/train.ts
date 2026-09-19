export interface TrainingPreset {
  id: string;
  name: string;
  nameId: string;
  badge: string;
  badgeId?: string;
  badgeColor: string;
  description: string;
  descriptionId: string;
  imputerId: string;
  k: number;
  span: number;
  forecasterId: string;
  splitRatio: number;
  lookBack: number;
  epochs: number;
  layerUnits: number;
  batchSize: number;
  learningRate: number;
  h: number;
  r0: number;
  maxGridM: number;
  seed: number;
}

export const DEFAULT_SEED = 42;
export const PRESETS: TrainingPreset[] = [
  {
    id: "research-standard",
    name: "Paper Benchmark (kNN + ARIMA)",
    nameId: "Tolok Ukur Jurnal (kNN + ARIMA)",
    badge: "Recommended",
    badgeId: "Rekomendasi",
    badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    description: "VIM::kNN (k=5) + Box-Cox AutoARIMA & Nelder-Mead simplex calibration.",
    descriptionId: "Imputasi VIM::kNN (k=5) + Box-Cox AutoARIMA & kalibrasi simpleks Nelder-Mead.",
    imputerId: "knn",
    k: 5,
    span: 0.5,
    forecasterId: "arima",
    splitRatio: 0.2,
    lookBack: 12,
    epochs: 100,
    layerUnits: 16,
    batchSize: 32,
    learningRate: 0.01,
    h: 4,
    r0: 2700,
    maxGridM: 2,
    seed: DEFAULT_SEED,
  },
  {
    id: "fast-baseline",
    name: "Fast Baseline (Linear + ARIMA)",
    nameId: "Garis Dasar Cepat (Linear + ARIMA)",
    badge: "Fast Iteration",
    badgeId: "Iterasi Cepat",
    badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    description: "Linear gap interpolation + AutoARIMA for rapid data verification.",
    descriptionId: "Interpolasi linier cepat + AutoARIMA untuk verifikasi awal data yang cepat.",
    imputerId: "linear",
    k: 5,
    span: 0.5,
    forecasterId: "arima",
    splitRatio: 0.2,
    lookBack: 12,
    epochs: 100,
    layerUnits: 16,
    batchSize: 32,
    learningRate: 0.01,
    h: 4,
    r0: 2700,
    maxGridM: 1,
    seed: DEFAULT_SEED,
  },
  {
    id: "deep-lstm",
    name: "Deep Sequence (LSTM)",
    nameId: "Sekuens Dalam (LSTM)",
    badge: "Neural Network",
    badgeId: "Jaringan Saraf",
    badgeColor: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
    description: "Deep learning recurrent neural network (LSTM) on normalized sequence windows.",
    descriptionId: "Jaringan saraf tiruan rekuren (LSTM) pada jendela sekuens ternormalisasi.",
    imputerId: "knn",
    k: 5,
    span: 0.5,
    forecasterId: "lstm",
    splitRatio: 0.2,
    lookBack: 12,
    epochs: 100,
    layerUnits: 16,
    batchSize: 64,
    learningRate: 0.02,
    h: 4,
    r0: 2700,
    maxGridM: 2,
    seed: DEFAULT_SEED,
  },
  {
    id: "smooth-gru",
    name: "Smooth LOESS + GRU",
    nameId: "LOESS Halus + GRU",
    badge: "Nonlinear Trend",
    badgeId: "Tren Non-linier",
    badgeColor: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
    description: "Cleveland LOESS local regression with fast-converging Gated Recurrent Units.",
    descriptionId:
      "Regresi lokal LOESS Cleveland dengan sel Gated Recurrent Unit yang cepat konvergen.",
    imputerId: "loess",
    k: 5,
    span: 0.5,
    forecasterId: "gru",
    splitRatio: 0.2,
    lookBack: 12,
    epochs: 100,
    layerUnits: 16,
    batchSize: 32,
    learningRate: 0.02,
    h: 4,
    r0: 2700,
    maxGridM: 2,
    seed: DEFAULT_SEED,
  },
];
export interface ParsedGpuSpec {
  cleanName: string;
  score: number;
  tier: string;
  speedup: string;
  backend: string;
  vramMb: number | null;
  driver: string | null;
}

export interface DetectedGpuInfo {
  name: string;
  vram_mb: number | null;
  driver_version: string | null;
  tier: string;
  score: number;
  backend: string;
  estimated_speedup: string;
}

export function parseAgnosticGpuSpec(
  rawName: string,
  vramMb: number | null = null,
  driver: string | null = null,
): ParsedGpuSpec {
  let cleanName = rawName || "Generic Hardware GPU";

  // Strip ANGLE wrapper if present: "ANGLE (Vendor, RealName Direct3D11...)"
  const angleMatch = cleanName.match(/ANGLE\s*\([^,]+,\s*([^,)]+)/i);
  if (angleMatch) {
    cleanName = angleMatch[1].trim();
  }
  // Strip trailing Direct3D, OpenGL, and hex PCI IDs
  cleanName = cleanName
    .replace(/\s+Direct3D.*$/i, "")
    .replace(/\s+vs_\S+\s+ps_\S+.*$/i, "")
    .replace(/\s*\(0x[0-9a-fA-F]+\)/g, "")
    .replace(/\s*\(0x[0-9a-fA-F]+/g, "")
    .trim();

  const lower = cleanName.toLowerCase();
  let score = 50;
  let tier = "Standard Graphics Adapter";
  let speedup = "~1.5x – 2.5x vs CPU";
  let backend = "WebGPU / Vulkan / Metal";

  if (
    lower.includes("nvidia") ||
    lower.includes("geforce") ||
    lower.includes("rtx") ||
    lower.includes("quadro") ||
    lower.includes("tesla")
  ) {
    backend = "DirectX 12 / Vulkan / WGPU";
    if (
      lower.includes("4090") ||
      lower.includes("a100") ||
      lower.includes("h100") ||
      lower.includes("h200")
    ) {
      score = 99;
      tier = "Flagship Tensor Core Accelerator";
      speedup = "~12x – 20x vs CPU";
    } else if (lower.includes("4080") || lower.includes("3090")) {
      score = 95;
      tier = "Ultra Enthusiast Tensor GPU";
      speedup = "~8x – 12x vs CPU";
    } else if (lower.includes("4070") || lower.includes("3080")) {
      score = 90;
      tier = "High-End Tensor Core GPU";
      speedup = "~6x – 10x vs CPU";
    } else if (lower.includes("4060") || lower.includes("3070")) {
      score = 85;
      tier = "High-Performance Discrete GPU";
      speedup = "~5x – 8x vs CPU";
    } else if (lower.includes("3060")) {
      score = 82;
      tier = "Mid-Range Tensor Core GPU";
      speedup = "~4x – 6x vs CPU";
    } else if (lower.includes("3050")) {
      score = 78;
      tier = "Mainstream Tensor Core GPU";
      speedup = "~3.5x – 5x vs CPU";
    } else if (lower.includes("2080") || lower.includes("2070")) {
      score = 76;
      tier = "Turing Tensor Core GPU";
      speedup = "~3.5x – 5x vs CPU";
    } else if (lower.includes("2060") || lower.includes("1660")) {
      score = 72;
      tier = "Entry Discrete GPU";
      speedup = "~3x – 4.5x vs CPU";
    } else {
      score = 65;
      tier = "Legacy Discrete GPU";
      speedup = "~2x – 3.5x vs CPU";
    }
  } else if (
    lower.includes("apple") ||
    lower.includes("m1") ||
    lower.includes("m2") ||
    lower.includes("m3") ||
    lower.includes("m4")
  ) {
    backend = "Apple Metal / WebGPU";
    if (lower.includes("max") || lower.includes("ultra")) {
      score = 94;
      tier = "Apple High-Core Neural GPU";
      speedup = "~8x – 14x vs CPU";
    } else if (lower.includes("pro")) {
      score = 88;
      tier = "Apple Pro Unified GPU";
      speedup = "~6x – 9x vs CPU";
    } else {
      score = 82;
      tier = "Apple Silicon Unified GPU";
      speedup = "~4x – 6x vs CPU";
    }
  } else if (lower.includes("radeon") || lower.includes("amd")) {
    backend = "AMD RDNA / Vulkan / WGPU";
    if (lower.includes("7900") || lower.includes("6900")) {
      score = 92;
      tier = "High-End AMD RDNA GPU";
      speedup = "~7x – 11x vs CPU";
    } else if (lower.includes("7800") || lower.includes("6800") || lower.includes("6700")) {
      score = 86;
      tier = "Mid-Range AMD RDNA GPU";
      speedup = "~5x – 8x vs CPU";
    } else if (lower.includes("7600") || lower.includes("6600")) {
      score = 78;
      tier = "Mainstream AMD RDNA GPU";
      speedup = "~3.5x – 5x vs CPU";
    } else {
      score = 62;
      tier = "Integrated Radeon GPU";
      speedup = "~1.8x – 2.5x vs CPU";
    }
  } else if (lower.includes("arc")) {
    backend = "Intel oneAPI / Vulkan / WGPU";
    score = 80;
    tier = "Intel Arc Xe-HPG Discrete";
    speedup = "~4x – 6x vs CPU";
  } else if (lower.includes("iris")) {
    backend = "Intel Graphics / Direct3D / Vulkan";
    score = 58;
    tier = "Intel Iris Xe Integrated";
    speedup = "~1.5x – 2.2x vs CPU";
  } else if (lower.includes("intel") || lower.includes("uhd")) {
    backend = "Intel Graphics / Vulkan";
    score = 45;
    tier = "Intel Integrated Graphics";
    speedup = "~1.2x – 1.6x vs CPU";
  } else if (vramMb && vramMb >= 8192) {
    score = 85;
    tier = "High-Memory Dedicated GPU";
    speedup = "~5x – 8x vs CPU";
  } else if (vramMb && vramMb >= 4096) {
    score = 75;
    tier = "Mid-Range Dedicated GPU";
    speedup = "~3x – 5x vs CPU";
  }

  return { cleanName, score, tier, speedup, backend, vramMb, driver };
}

export const DEFAULT_SIDEBAR_WIDTH = 460;
export const MIN_SIDEBAR_WIDTH = 320;
export const MAX_SIDEBAR_WIDTH = 780;

export const getInitialSidebarWidth = (): number => {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;
  try {
    const saved = localStorage.getItem("pfrsim_train_sidebar_width");
    if (saved) {
      const val = parseInt(saved, 10);
      if (!isNaN(val) && val >= MIN_SIDEBAR_WIDTH && val <= MAX_SIDEBAR_WIDTH) {
        return val;
      }
    }
  } catch {}
  return DEFAULT_SIDEBAR_WIDTH;
};
