import { describe, it, expect } from "vitest";
import { mockIPC } from "@tauri-apps/api/mocks";
import { runGet, runsList, artifactLoadFrames } from "../../lib/tauri";
import type { RunDetail, RunSummary, SimulationFrame } from "../../lib/types";
import { buildStripPath, buildPfviPath, exportFramesCsv, valToStripY } from "../../utils/player";

describe("E2E Workflow: Simulation Playback, Scrubbing & Data Export (Tauri v2 mockIPC)", () => {
  it("loads simulation artifacts, calculates coordinates, scrubs frames, and exports CSV", async () => {
    const mockRuns: RunSummary[] = [
      {
        run_id: "run-pfrsim-20260918-999",
        job_id: "job-pfrsim-20260918-001",
        dataset_id: "ds-sabangau",
        dataset_name: "Sabangau Station",
        name: "Sabangau Full AutoARIMA",
        created_at: "2026-09-18T01:00:00Z",
        status: "done",
        imputer_id: "linear",
        forecaster_id: "arima",
        h: 4,
        best_pfvi_mse: 0.042,
        seed: 42,
      },
    ];

    const mockFrames: SimulationFrame[] = [];
    const n = 12;
    const h = 4;
    for (let i = 0; i < n + h; i++) {
      const isForecast = i >= n;
      mockFrames.push({
        t: i + 1,
        time_label: isForecast ? `+${i - n + 1}d` : `2026-01-${String(i + 1).padStart(2, "0")}`,
        wt: -0.5 - 0.05 * i,
        sm: 45.0 - 1.2 * i,
        rf: i % 3 === 0 ? 5.0 : 0.0,
        temp: 28.0 + 0.3 * i,
        pfvi: 60.0 + 8.5 * i,
        diobs: 62.0 + 8.0 * i,
        class: i < 5 ? "Low" : i < 10 ? "Moderate" : "High",
        class_code: i < 5 ? 0 : i < 10 ? 1 : 2,
        is_forecast: isForecast,
        imputed: { wt: false, sm: false, rf: false, temp: false },
        water_distribution: 12.0,
        rainfall_effect: 2.0,
        soil_fluctuation: 4.0,
        water_depth: 0.5 + 0.05 * i,
      });
    }

    const mockDetail: RunDetail = {
      summary: mockRuns[0],
      config_json: "{}",
      stages: [
        {
          stage: "done",
          status: "done",
          started_at: "2026-09-18T01:00:00Z",
          finished_at: "2026-09-18T01:00:15Z",
        },
      ],
      params: [["forecaster.id", "arima"]],
      metrics: [["pfvi", "pfvi.mse", 0.042]],
      artifacts: [["frames", "models/frames.parquet", "sha256-frames"]],
    };

    mockIPC((cmd) => {
      if (cmd === "runs_list") {
        return { ok: true, data: mockRuns };
      }
      if (cmd === "run_get") {
        return { ok: true, data: mockDetail };
      }
      if (cmd === "artifact_load_frames") {
        return { ok: true, data: mockFrames };
      }
      return null;
    });

    // 1. Fetch Completed Runs
    const runsRes = await runsList();
    expect(runsRes.ok).toBe(true);
    if (!runsRes.ok) return;
    const run = runsRes.data[0];
    expect(run.run_id).toBe("run-pfrsim-20260918-999");

    // 2. Load Detailed Run Artifact & Simulation Frames
    const detailRes = await runGet(run.run_id);
    expect(detailRes.ok).toBe(true);
    if (!detailRes.ok) return;
    const detail = detailRes.data;
    expect(detail.summary.name).toBe("Sabangau Full AutoARIMA");

    const framesRes = await artifactLoadFrames(run.run_id);
    expect(framesRes.ok).toBe(true);
    if (!framesRes.ok) return;
    const frames = framesRes.data;
    expect(frames).toHaveLength(n + h);

    // 3. Verify Timeline Scrubber Boundaries and Forecast Separation
    const historyFrames = frames.filter((f) => !f.is_forecast);
    const forecastFrames = frames.filter((f) => f.is_forecast);

    expect(historyFrames).toHaveLength(12);
    expect(forecastFrames).toHaveLength(4);
    expect(forecastFrames[0].t).toBe(13);
    expect(forecastFrames[0].time_label).toBe("+1d");

    // 4. Scrubbing & Coordinate Mapping Verification
    const wMin = 1;
    const wMax = n + h;

    const pfviPath = buildPfviPath(frames, n + h, false, null, wMin, wMax);
    expect(pfviPath).toContain("M ");
    expect(pfviPath).toContain("L ");
    expect(pfviPath).not.toContain("NaN");

    const wtStripPath = buildStripPath(
      frames,
      (f: SimulationFrame) => f.wt,
      { min: -2.0, max: 0.0 },
      n + h,
      false,
      null,
      wMin,
      wMax,
    );
    expect(wtStripPath).toContain("M ");
    expect(wtStripPath).toContain("L ");

    // Verify Vertical Y-Axis Normalization
    const yTop = valToStripY(0.0, -2.0, 0.0);
    const yBottom = valToStripY(-2.0, -2.0, 0.0);
    expect(yTop).toBeLessThan(yBottom);

    // 5. CSV Export Verification
    const exportResult = await exportFramesCsv(frames, run.run_id);
    expect(exportResult.fileName).toBe(`pfrsim-frames-${run.run_id}.csv`);
    expect(exportResult.isSaved).toBe(true);
  });
});
