import { describe, it, expect } from "vitest";
import {
  riskClassColor,
  riskTextColor,
  valToStripY,
  buildStripPath,
  buildPfviPath,
  exportFramesCsv,
} from "./player";
import type { SimulationFrame } from "../lib/types";

describe("Simulation Player Utilities (player.ts)", () => {
  describe("Risk Color Classification", () => {
    it("maps severity classes to appropriate CSS color tokens", () => {
      expect(riskClassColor("Extreme")).toContain("rose");
      expect(riskClassColor("High")).toContain("orange");
      expect(riskClassColor("Moderate")).toContain("amber");
      expect(riskClassColor("Low")).toContain("emerald");

      expect(riskTextColor("Extreme")).toContain("rose");
      expect(riskTextColor("High")).toContain("orange");
      expect(riskTextColor("Moderate")).toContain("amber");
      expect(riskTextColor("Low")).toContain("emerald");
    });
  });

  describe("Coordinate System & Strip Projections", () => {
    it("maps values correctly into vertical strip pixel space (valToStripY)", () => {
      // STRIP_HEIGHT = 65; min = 0, max = 100
      // valToStripY = 65 - 10 - ((val - min) / range) * (65 - 20)
      const topVal = valToStripY(100, 0, 100);
      const bottomVal = valToStripY(0, 0, 100);
      const midVal = valToStripY(50, 0, 100);

      expect(topVal).toBe(10);
      expect(bottomVal).toBe(55);
      expect(midVal).toBeCloseTo(32.5, 1);
    });

    it("handles zero dynamic range without throwing NaN", () => {
      const y = valToStripY(50, 50, 50);
      expect(Number.isNaN(y)).toBe(false);
      expect(y).toBe(55);
    });
  });

  describe("SVG Path Builders", () => {
    const mockFrames: SimulationFrame[] = [
      {
        t: 1,
        time_label: "2026-01-01",
        wt: -0.5,
        sm: 40.0,
        rf: 10.0,
        temp: 28.0,
        pfvi: 50.0,
        diobs: 55.0,
        class: "Low",
        class_code: 0,
        is_forecast: false,
        imputed: { wt: false, sm: false, rf: false, temp: false },
        water_distribution: 0,
        rainfall_effect: 0,
        soil_fluctuation: 0,
        water_depth: 0.5,
      },
      {
        t: 2,
        time_label: "2026-01-02",
        wt: -0.6,
        sm: 38.0,
        rf: 0.0,
        temp: 30.0,
        pfvi: 85.0,
        diobs: 90.0,
        class: "Moderate",
        class_code: 1,
        is_forecast: false,
        imputed: { wt: false, sm: false, rf: false, temp: false },
        water_distribution: 0,
        rainfall_effect: 0,
        soil_fluctuation: 0,
        water_depth: 0.6,
      },
      {
        t: 3,
        time_label: "+1d",
        wt: -0.7,
        sm: 35.0,
        rf: 0.0,
        temp: 31.0,
        pfvi: 160.0,
        diobs: 155.0,
        class: "High",
        class_code: 2,
        is_forecast: true,
        imputed: { wt: false, sm: false, rf: false, temp: false },
        water_distribution: 0,
        rainfall_effect: 0,
        soil_fluctuation: 0,
        water_depth: 0.7,
      },
    ];

    it("generates valid SVG path commands for strip charts", () => {
      const path = buildStripPath(
        mockFrames,
        (f) => f.wt,
        { min: -1.0, max: 0.0 },
        3,
        false,
        null,
        1,
        3,
      );

      expect(path).toContain("M ");
      expect(path).toContain("L ");
      expect(path).not.toContain("NaN");
    });

    it("generates continuous SVG path for PFVI trend line", () => {
      const path = buildPfviPath(mockFrames, 3, false, null, 1, 3);

      expect(path).toContain("M ");
      expect(path).toContain("L ");
      expect(path).not.toContain("NaN");
    });
  });

  describe("exportFramesCsv", () => {
    it("formats frames into standard RFC 4180 CSV and handles download", async () => {
      const mockFrames: SimulationFrame[] = [
        {
          t: 1,
          time_label: "2026-01-01",
          wt: -0.5,
          sm: 40.0,
          rf: 10.0,
          temp: 28.0,
          pfvi: 50.0,
          diobs: 55.0,
          class: "Low",
          class_code: 0,
          is_forecast: false,
          imputed: { wt: false, sm: false, rf: false, temp: false },
          water_distribution: 0,
          rainfall_effect: 0,
          soil_fluctuation: 0,
          water_depth: 0.5,
        },
      ];

      const res = await exportFramesCsv(mockFrames, "run-test-123");
      expect(res.fileName).toBe("pfrsim-frames-run-test-123.csv");
      expect(res.isSaved).toBe(true);
    });
  });
});
