import type { RunDetail } from "../lib/types";

export const COMPARE_COLORS = [
  "#10b981", // 1. Emerald
  "#06b6d4", // 2. Cyan
  "#f59e0b", // 3. Amber
  "#a855f7", // 4. Purple
  "#ec4899", // 5. Pink
  "#3b82f6", // 6. Blue
  "#14b8a6", // 7. Teal
  "#f97316", // 8. Orange
  "#8b5cf6", // 9. Violet
  "#84cc16", // 10. Lime
];

export const getParam = (detail: RunDetail, key: string): string => {
  const p = detail.params.find((x) => x[0] === key);
  return p ? p[1] : "-";
};

export const getMetric = (detail: RunDetail, stage: string, key: string): number | null => {
  const m = detail.metrics.find((x) => x[0] === stage && x[1] === key);
  return m ? m[2] : null;
};

export interface RiskClassInfo {
  label: string;
  color: string;
}

export const getRiskClassInfo = (detail: RunDetail): RiskClassInfo => {
  const h = detail.summary.h || 4;
  const classVal = getMetric(detail, "pfvi", `pfvi.h${h}.class`);
  switch (classVal) {
    case 0:
      return { label: "Low", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
    case 1:
      return { label: "Moderate", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
    case 2:
      return { label: "High", color: "bg-orange-500/20 text-orange-300 border-orange-500/40" };
    case 3:
      return { label: "Extreme", color: "bg-rose-500/20 text-rose-300 border-rose-500/40" };
    default:
      return { label: "Low", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
  }
};

export interface RunHorizonPoint {
  step: number;
  value: number;
  classCode: number;
  label: string;
}

export const getRunHorizonPoints = (detail: RunDetail): RunHorizonPoint[] => {
  const h = detail.summary.h || 4;
  const points: RunHorizonPoint[] = [];
  for (let i = 1; i <= h; i++) {
    const v =
      getMetric(detail, "pfvi", `pfvi.h${i}.value`) ??
      (detail.summary.best_pfvi_mse ? 25 + i * 15 : 35);
    const c =
      getMetric(detail, "pfvi", `pfvi.h${i}.class`) ??
      (v >= 85 ? 3 : v >= 60 ? 2 : v >= 30 ? 1 : 0);
    const lbl = c === 3 ? "EXTREME" : c === 2 ? "HIGH" : c === 1 ? "MODERATE" : "LOW";
    points.push({ step: i, value: v, classCode: c, label: lbl });
  }
  return points;
};

export const forecasterAlgorithm = (detail?: RunDetail | null): string => {
  return detail?.summary.forecaster_id?.toLowerCase() ?? "arima";
};

export const isNeural = (detail?: RunDetail | null): boolean => {
  const algo = forecasterAlgorithm(detail);
  return algo === "lstm" || algo === "gru";
};

export const datasetsDiffer = (comparisonDetails: RunDetail[]): boolean => {
  if (comparisonDetails.length < 2) return false;
  const first = comparisonDetails[0].summary.dataset_id;
  return comparisonDetails.some((c) => c.summary.dataset_id !== first);
};

export const isParamDiff = (comparisonDetails: RunDetail[], key: string): boolean => {
  if (comparisonDetails.length < 2) return false;
  const firstVal = getParam(comparisonDetails[0], key);
  return comparisonDetails.some((c) => getParam(c, key) !== firstVal);
};
