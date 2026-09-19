import { describe, it, expect } from "vitest";
import { createRoot } from "solid-js";
import { mutationBus, useDatasetsVersion, useRunsVersion, useJobsVersion } from "./mutation";

describe("Mutation Bus (mutation.ts)", () => {
  it("increments dataset version when notifyDatasetMutated is called", () => {
    createRoot((dispose) => {
      const initial = useDatasetsVersion();
      mutationBus.notifyDatasetMutated();
      const updated = useDatasetsVersion();
      expect(updated).toBe(initial + 1);
      dispose();
    });
  });

  it("increments runs version when notifyRunMutated is called", () => {
    createRoot((dispose) => {
      const initial = useRunsVersion();
      mutationBus.notifyRunMutated();
      const updated = useRunsVersion();
      expect(updated).toBe(initial + 1);
      dispose();
    });
  });

  it("increments jobs version when notifyJobMutated is called", () => {
    createRoot((dispose) => {
      const initial = useJobsVersion();
      mutationBus.notifyJobMutated();
      const updated = useJobsVersion();
      expect(updated).toBe(initial + 1);
      dispose();
    });
  });
});
