import type {
  DatasetDetail,
  DatasetPreview,
  DatasetSummary,
  RowPreview,
  StlDecompositionView,
} from "../lib/types";

export type SeriesKey = "wt" | "sm" | "rf" | "temp";

export interface SeriesConfigItem {
  key: SeriesKey;
  name: string;
  label: string;
  unit: string;
  color: string;
  stroke: string;
  bgBadge: string;
  description: string;
  threshold: number;
}

export const getSeriesConfig = (lang: "id" | "en" = "en"): Record<SeriesKey, SeriesConfigItem> => ({
  wt: {
    key: "wt",
    name: "WT",
    label: lang === "id" ? "Muka Air Gambut" : "Water Table",
    unit: "m",
    color: "#06b6d4",
    stroke: "#22d3ee",
    bgBadge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    description:
      lang === "id"
        ? "Tinggi muka air tanah gambut (kritis jika < -0.4 m)"
        : "Peat water table depth (critical threshold < -0.4 m)",
    threshold: -0.4,
  },
  sm: {
    key: "sm",
    name: "SM",
    label: lang === "id" ? "Kelembaban Tanah" : "Soil Moisture",
    unit: "%",
    color: "#10b981",
    stroke: "#34d399",
    bgBadge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    description:
      lang === "id"
        ? "Kadar air volumetrik lapisan tanah gambut atas"
        : "Volumetric soil water content in upper peat layer",
    threshold: 30.0,
  },
  rf: {
    key: "rf",
    name: "Rf",
    label: lang === "id" ? "Curah Hujan" : "Rainfall",
    unit: "mm",
    color: "#3b82f6",
    stroke: "#60a5fa",
    bgBadge: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    description:
      lang === "id"
        ? "Akumulasi curah hujan harian stasiun pantau"
        : "Daily precipitation accumulated at weather station",
    threshold: 0.0,
  },
  temp: {
    key: "temp",
    name: "Temp",
    label: lang === "id" ? "Suhu Udara" : "Temperature",
    unit: "°C",
    color: "#f43f5e",
    stroke: "#fb7185",
    bgBadge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    description:
      lang === "id"
        ? "Suhu ambien harian di sekitar kawasan gambut"
        : "Daily ambient air temperature in peatland zone",
    threshold: 35.0,
  },
});

export const getSeriesTrendline = (
  k: SeriesKey,
  preview: DatasetPreview | null,
  detail: DatasetDetail | null,
  stlSeries?: SeriesKey,
  stlView?: StlDecompositionView | null,
): (number | null)[] => {
  const decompTrend = preview?.stats[k]?.decomposition?.trend;
  if (decompTrend && decompTrend.some((v) => v != null)) {
    return decompTrend;
  }
  if (stlSeries === k && stlView?.trend) {
    return stlView.trend;
  }
  // Fallback to OLS linear regression line from preview stats trend if available
  const st = preview?.stats[k];
  const stTrend = st?.trend;
  if (st && stTrend && stTrend.slope !== 0) {
    const pts = 50;
    const slope = stTrend.slope;
    const mean = st.mean;
    const res: number[] = [];
    for (let i = 0; i < pts; i++) {
      const frac = i / (pts - 1) - 0.5;
      res.push(mean + slope * frac * 50);
    }
    return res;
  }

  const raw = detail?.columns[k] ?? preview?.head.map((r) => r[k]) ?? [];
  if (raw.length < 4) return [];
  const p = Math.min(12, Math.max(3, Math.floor(raw.length / 4)));
  const half = Math.floor(p / 2);
  const trend: (number | null)[] = [];
  for (let i = 0; i < raw.length; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(raw.length - 1, i + half);
    let sum = 0;
    let count = 0;
    for (let j = lo; j <= hi; j++) {
      const val = raw[j];
      if (val != null && !isNaN(val)) {
        sum += val;
        count++;
      }
    }
    trend.push(count > 0 ? sum / count : null);
  }
  return trend;
};

export const allDatasetRows = (
  preview: DatasetPreview | null,
  detail: DatasetDetail | null,
): RowPreview[] => {
  if (!detail || !detail.columns) return preview?.head ?? [];
  const n = detail.n;
  // If dataset has more than 1000 rows, do NOT generate all rows into browser heap memory.
  // Return the preview head rows; VirtualPreviewTable streams windowed chunks via datasetGetRows on scroll.
  if (n > 1000 || !detail.columns.wt || detail.columns.wt.length === 0) {
    return preview?.head ?? [];
  }
  const cols = detail.columns;
  const rows: RowPreview[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      t: i + 1,
      time_label:
        i < (preview?.head.length ?? 0) ? (preview?.head[i]?.time_label ?? `${i + 1}`) : `${i + 1}`,
      wt: cols.wt[i] ?? null,
      sm: cols.sm[i] ?? null,
      rf: cols.rf[i] ?? null,
      temp: cols.temp[i] ?? null,
    });
  }
  return rows;
};

export const filterDatasetRows = (rows: RowPreview[], search: string): RowPreview[] => {
  const q = search.toLowerCase().trim();
  if (!q) return rows;
  return rows.filter((r) => {
    const matchLabel = r.time_label?.toLowerCase().includes(q);
    const matchT = r.t.toString().includes(q);
    const matchWt = r.wt?.toString().includes(q);
    const matchSm = r.sm?.toString().includes(q);
    const matchRf = r.rf?.toString().includes(q);
    const matchTemp = r.temp?.toString().includes(q);
    return matchLabel || matchT || matchWt || matchSm || matchRf || matchTemp;
  });
};

export const computeMissingPercent = (
  currentDataset: DatasetSummary | undefined,
  preview: DatasetPreview | null,
): string => {
  if (!currentDataset || !preview || currentDataset.n === 0) return "0.0";
  const totalCells = currentDataset.n * 4;
  return ((preview.missing.total / totalCells) * 100).toFixed(1);
};
