import { describe, it, expect } from "vitest";
import { parseAgnosticGpuSpec, PRESETS } from "./train";

describe("Training Utilities (train.ts)", () => {
  describe("PRESETS", () => {
    it("defines 4 standard training presets with localized metadata and hyperparameters", () => {
      expect(PRESETS).toHaveLength(4);
      const ids = PRESETS.map((p) => p.id);
      expect(ids).toEqual(["research-standard", "fast-baseline", "deep-lstm", "smooth-gru"]);

      const research = PRESETS.find((p) => p.id === "research-standard")!;
      expect(research.imputerId).toBe("knn");
      expect(research.forecasterId).toBe("arima");
      expect(research.epochs).toBe(100);
      expect(research.lookBack).toBe(12);
      expect(research.batchSize).toBe(32);
      const fast = PRESETS.find((p) => p.id === "fast-baseline")!;
      expect(fast.imputerId).toBe("linear");
      expect(fast.forecasterId).toBe("arima");
      expect(fast.maxGridM).toBe(1);

      const lstm = PRESETS.find((p) => p.id === "deep-lstm")!;
      expect(lstm.imputerId).toBe("knn");
      expect(lstm.forecasterId).toBe("lstm");
      expect(lstm.batchSize).toBe(64);
      const gru = PRESETS.find((p) => p.id === "smooth-gru")!;
      expect(gru.imputerId).toBe("loess");
      expect(gru.forecasterId).toBe("gru");
    });
  });

  describe("parseAgnosticGpuSpec", () => {
    it("provides fallback descriptor when empty name is given", () => {
      const fallback = parseAgnosticGpuSpec("");
      expect(fallback.cleanName).toBe("Generic Hardware GPU");
      expect(fallback.score).toBe(50);
      expect(fallback.backend).toBe("WebGPU / Vulkan / Metal");
    });

    it("parses dedicated high-end GPU with VRAM correctly", () => {
      const spec = parseAgnosticGpuSpec("NVIDIA GeForce RTX 4090", 24576);
      expect(spec.cleanName).toContain("NVIDIA GeForce RTX 4090");
      expect(spec.vramMb).toBe(24576);
      expect(spec.score).toBeGreaterThanOrEqual(80);
      expect(spec.tier).toContain("Tensor");
    });

    it("parses Apple Silicon Unified Memory hardware", () => {
      const spec = parseAgnosticGpuSpec("Apple M3 Max");
      expect(spec.cleanName).toContain("Apple M3 Max");
      expect(spec.score).toBeGreaterThanOrEqual(80);
      expect(spec.tier).toContain("Apple");
    });

    it("parses Intel Integrated Graphics and identifies lower tier", () => {
      const spec = parseAgnosticGpuSpec("Intel Iris Xe Graphics");
      expect(spec.cleanName).toContain("Intel Iris Xe");
      expect(spec.tier).toContain("Integrated");
    });
  });
});
