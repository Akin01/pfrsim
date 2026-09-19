import type { SimulationFrame } from "../lib/types";

export const riskClassColor = (cls?: string): string => {
  switch (cls) {
    case "Extreme":
      return "bg-rose-500 text-white border-rose-600 shadow-rose-500/20";
    case "High":
      return "bg-orange-500 text-white border-orange-600 shadow-orange-500/20";
    case "Moderate":
      return "bg-amber-500 text-slate-950 font-bold border-amber-600 shadow-amber-500/20";
    default:
      return "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20";
  }
};

export const riskTextColor = (cls?: string): string => {
  switch (cls) {
    case "Extreme":
      return "text-rose-500 dark:text-rose-400";
    case "High":
      return "text-orange-500 dark:text-orange-400";
    case "Moderate":
      return "text-amber-500 dark:text-amber-400";
    default:
      return "text-emerald-600 dark:text-emerald-400";
  }
};

export const fmt = (val: number | null | undefined, digits = 2, fallback = "-"): string => {
  if (val === null || val === undefined || isNaN(val)) return fallback;
  return val.toFixed(digits);
};

export const SVG_WIDTH = 850;
export const STRIP_HEIGHT = 65;
export const HERO_HEIGHT = 220;
export const PLOT_LEFT = 52;
export const PLOT_RIGHT = SVG_WIDTH - 20; // 830
export const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT; // 778

export const OVERVIEW_SVG_WIDTH = 850;
export const OVERVIEW_SVG_HEIGHT = 24;
export const OVERVIEW_PLOT_LEFT = 52;
export const OVERVIEW_PLOT_RIGHT = OVERVIEW_SVG_WIDTH - 20;
export const OVERVIEW_PLOT_WIDTH = OVERVIEW_PLOT_RIGHT - OVERVIEW_PLOT_LEFT;

export const tToX = (frameT: number, wMin: number, wMax: number): number => {
  const span = Math.max(1, wMax - wMin);
  return PLOT_LEFT + ((frameT - wMin) / span) * PLOT_WIDTH;
};

export const svgXToT = (x: number, wMin: number, wMax: number): number => {
  const span = Math.max(1, wMax - wMin);
  const frac = Math.max(0, Math.min(1, (x - PLOT_LEFT) / PLOT_WIDTH));
  return Math.round(wMin + frac * span);
};

export const yToHeroY = (val: number): number => {
  const clamped = Math.max(-100, Math.min(val, 400));
  return HERO_HEIGHT - 25 - ((clamped - -100) / 500) * (HERO_HEIGHT - 45);
};

export const valToStripY = (val: number, min: number, max: number): number => {
  const range = max - min || 1.0;
  return STRIP_HEIGHT - 10 - ((val - min) / range) * (STRIP_HEIGHT - 20);
};

export const overviewTToX = (frameT: number, totalN: number): number => {
  const n = Math.max(1, totalN);
  return OVERVIEW_PLOT_LEFT + ((frameT - 1) / Math.max(1, n - 1)) * OVERVIEW_PLOT_WIDTH;
};

export const buildStripPath = (
  frames: SimulationFrame[],
  accessor: (f: SimulationFrame) => number,
  bounds: { min: number; max: number },
  untilT: number,
  onlyForecast: boolean,
  forecastStartT: number | null,
  wMin: number,
  wMax: number,
): string => {
  if (frames.length === 0) return "";
  let d = "";
  const fcIdx = (forecastStartT ?? 0) - 1;

  for (let i = 0; i < Math.min(untilT, frames.length); i++) {
    const frame = frames[i];
    if (onlyForecast && !frame.is_forecast) continue;
    if (!onlyForecast && frame.is_forecast) continue;

    const x = tToX(i + 1, wMin, wMax);
    const y = valToStripY(accessor(frame), bounds.min, bounds.max);

    if (d === "" || (onlyForecast && i === fcIdx)) {
      d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    } else {
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  return d;
};

export const buildPfviPath = (
  frames: SimulationFrame[],
  untilT: number,
  onlyForecast: boolean,
  forecastStartT: number | null,
  wMin: number,
  wMax: number,
): string => {
  if (frames.length === 0) return "";
  let d = "";
  const fcIdx = (forecastStartT ?? 0) - 1;

  for (let i = 0; i < Math.min(untilT, frames.length); i++) {
    const frame = frames[i];
    if (onlyForecast && !frame.is_forecast) continue;
    if (!onlyForecast && frame.is_forecast) continue;

    const x = tToX(i + 1, wMin, wMax);
    const y = yToHeroY(frame.pfvi);

    if (d === "" || (onlyForecast && i === fcIdx)) {
      d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    } else {
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  return d;
};

export const buildDiobsPath = (
  frames: SimulationFrame[],
  untilT: number,
  wMin: number,
  wMax: number,
): string => {
  if (frames.length === 0) return "";
  let d = "";
  for (let i = 0; i < Math.min(untilT, frames.length); i++) {
    const frame = frames[i];
    const x = tToX(i + 1, wMin, wMax);
    const y = yToHeroY(frame.diobs);
    if (d === "") d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    else d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
};

export const buildOverlayPfviPath = (
  overlayFrames: SimulationFrame[] | null | undefined,
  untilT: number,
  wMin: number,
  wMax: number,
): string => {
  if (!overlayFrames || overlayFrames.length === 0) return "";
  let d = "";
  for (let i = 0; i < Math.min(untilT, overlayFrames.length); i++) {
    const frame = overlayFrames[i];
    const x = tToX(i + 1, wMin, wMax);
    const y = yToHeroY(frame.pfvi);
    if (d === "") d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    else d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
};

export const buildOverviewSparkline = (frames: SimulationFrame[], totalN: number): string => {
  if (frames.length === 0) return "";
  let d = "";
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const x = overviewTToX(i + 1, totalN);
    const clamped = Math.max(-100, Math.min(frame.pfvi, 400));
    const y = OVERVIEW_SVG_HEIGHT - 3 - ((clamped - -100) / 500) * (OVERVIEW_SVG_HEIGHT - 6);
    if (i === 0) d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    else d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
};

export const downloadBlobInBrowser = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const exportFramesCsv = async (
  frames: SimulationFrame[],
  runId: string,
): Promise<{ fileName: string; isSaved: boolean }> => {
  const defaultFileName = `pfrsim-frames-${runId}.csv`;
  const headers = [
    "t",
    "time_label",
    "wt",
    "sm",
    "rf",
    "temp",
    "pfvi",
    "diobs",
    "class",
    "is_forecast",
    "imputed_wt",
    "imputed_sm",
    "imputed_rf",
    "imputed_temp",
  ];
  const rows = frames.map((f) =>
    [
      f.t,
      `"${f.time_label || ""}"`,
      f.wt,
      f.sm,
      f.rf,
      f.temp,
      f.pfvi,
      f.diobs,
      `"${f.class}"`,
      f.is_forecast,
      f.imputed?.wt ?? false,
      f.imputed?.sm ?? false,
      f.imputed?.rf ?? false,
      f.imputed?.temp ?? false,
    ].join(","),
  );
  const csvContent = [headers.join(","), ...rows].join("\n");
  const csvBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
    try {
      // @ts-expect-error File System Access API
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultFileName,
        types: [{ description: "CSV Spreadsheet (*.csv)", accept: { "text/csv": [".csv"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(csvBlob);
      await writable.close();
      return { fileName: handle.name, isSaved: true };
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === "AbortError") {
        return { fileName: defaultFileName, isSaved: false };
      }
    }
  }

  downloadBlobInBrowser(csvBlob, defaultFileName);
  return { fileName: defaultFileName, isSaved: true };
};

export const exportFramesJson = async (
  frames: SimulationFrame[],
  runId: string,
): Promise<{ fileName: string; isSaved: boolean }> => {
  const defaultFileName = `pfrsim-frames-${runId}.json`;
  const jsonContent = JSON.stringify(frames, null, 2);
  const jsonBlob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });

  if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
    try {
      // @ts-expect-error File System Access API
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultFileName,
        types: [{ description: "JSON File (*.json)", accept: { "application/json": [".json"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(jsonBlob);
      await writable.close();
      return { fileName: handle.name, isSaved: true };
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === "AbortError") {
        return { fileName: defaultFileName, isSaved: false };
      }
    }
  }

  downloadBlobInBrowser(jsonBlob, defaultFileName);
  return { fileName: defaultFileName, isSaved: true };
};
