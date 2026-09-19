import Papa from "papaparse";
import type { Manifest, SimulationFrame } from "./types";

export interface ImportedRunData {
  fileName: string;
  frames: SimulationFrame[];
  manifest: Manifest;
}

export async function parseRunFile(file: File): Promise<ImportedRunData> {
  const fileName = file.name;
  const text = await file.text();
  const trimmed = text.trim();

  let frames: SimulationFrame[] = [];
  let manifest: Manifest | undefined = undefined;

  if (
    fileName.toLowerCase().endsWith(".json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[")
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        frames = parsed;
      } else if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.frames)) {
          frames = parsed.frames;
          if (parsed.manifest) manifest = parsed.manifest;
        } else if (Array.isArray(parsed.data)) {
          frames = parsed.data;
        }
      }
    } catch (e) {
      throw new Error(`Invalid JSON format: ${String(e)}`);
    }
  } else {
    // Parse as CSV using PapaParse
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });

    if (parsed.errors && parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
      throw new Error(`CSV Parsing error: ${parsed.errors[0].message}`);
    }

    const rows = parsed.data;
    if (!rows || rows.length === 0) {
      throw new Error("CSV file contains no data rows.");
    }

    frames = rows.map((row, idx) => {
      const t = Number(row.t ?? row.frame ?? idx + 1);
      const time_label = row.time_label ? String(row.time_label) : null;
      const wt = Number(row.wt ?? row.water_table ?? 0);
      const sm = Number(row.sm ?? row.soil_moisture ?? 0);
      const rf = Number(row.rf ?? row.rainfall ?? 0);
      const temp = Number(row.temp ?? row.temperature ?? 0);
      const pfvi = Number(row.pfvi ?? row.fire_risk ?? 0);
      const diobs = Number(row.diobs ?? row.di_obs ?? pfvi);

      let cls: "Low" | "Moderate" | "High" | "Extreme" = "Low";
      if (row.class) {
        cls = String(row.class) as "Low" | "Moderate" | "High" | "Extreme";
      } else {
        if (pfvi > 225) cls = "Extreme";
        else if (pfvi > 150) cls = "High";
        else if (pfvi > 75) cls = "Moderate";
        else cls = "Low";
      }

      const is_forecast = Boolean(
        row.is_forecast === true ||
        row.is_forecast === "true" ||
        row.forecast === true ||
        row.isForecast === true,
      );

      const imputed = {
        wt: Boolean(row.imputed_wt || row["imputed.wt"] || false),
        sm: Boolean(row.imputed_sm || row["imputed.sm"] || false),
        rf: Boolean(row.imputed_rf || row["imputed.rf"] || false),
        temp: Boolean(row.imputed_temp || row["imputed.temp"] || false),
      };

      return {
        t,
        time_label,
        wt,
        sm,
        rf,
        temp,
        pfvi,
        diobs,
        class: cls,
        class_code: cls === "Extreme" ? 3 : cls === "High" ? 2 : cls === "Moderate" ? 1 : 0,
        is_forecast,
        imputed,
        water_distribution: Number(row.water_distribution ?? 0),
        rainfall_effect: Number(row.rainfall_effect ?? 0),
        soil_fluctuation: Number(row.soil_fluctuation ?? 0),
        water_depth: Number(row.water_depth ?? Math.abs(wt)),
      };
    });
  }

  if (!frames || frames.length === 0) {
    throw new Error("No simulation frames could be parsed from the file.");
  }

  // Ensure frames are sorted by t
  frames.sort((a, b) => a.t - b.t);

  // Generate synthetic manifest if not provided
  if (!manifest) {
    const cleanId = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const hCount = frames.filter((f) => f.is_forecast).length;
    manifest = {
      run_id: `imported-${cleanId}`,
      dataset_id: `ds-${cleanId}`,
      csv_sha: "imported",
      config: {
        imputer: { id: "linear", k: 5, span: 0.5 },
        forecaster: { id: "arima", arima: { test_split_ratio: 0.2 }, lstm: null, gru: null },
        pfvi: { r0: 3000, dt: 1, h: hCount, fc: 0.4, sat: 0.7, max_grid_m: 5, timeout_s: 30 },
        seed: 42,
      },
      seed: 42,
      crate_versions: {},
      frames_sha256: "imported",
      created_at: new Date().toISOString(),
      peatfr_parity: true,
    };
  }

  return { fileName, frames, manifest };
}
