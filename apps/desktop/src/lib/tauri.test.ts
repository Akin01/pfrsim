import { describe, it, expect, vi } from "vitest";
import { mockIPC } from "@tauri-apps/api/mocks";
import { datasetsList, pipelineCancel, listenPipelineProgress } from "./tauri";

describe("Tauri IPC Client (tauri.ts) with Official @tauri-apps/api/mocks", () => {
  it("fetches datasets list successfully via mockIPC", async () => {
    const mockDatasets = [
      {
        id: "ds-1",
        name: "Sabangau Test",
        csv_sha: "abc123sha",
        n: 192,
        missing_total: 0,
        run_count: 1,
        created_at: "2026-09-18T00:00:00Z",
      },
    ];

    mockIPC((cmd) => {
      if (cmd === "datasets_list") {
        return { ok: true, data: mockDatasets };
      }
    });

    const res = await datasetsList();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toHaveLength(1);
      expect(res.data[0].id).toBe("ds-1");
      expect(res.data[0].n).toBe(192);
    }
  });

  it("handles backend errors cleanly with CommandOutput<T> via mockIPC", async () => {
    mockIPC((cmd) => {
      if (cmd === "datasets_list") {
        return {
          ok: false,
          code: "NOT_FOUND",
          message: "Dataset not found",
        };
      }
    });

    const res = await datasetsList();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("NOT_FOUND");
      expect(res.message).toBe("Dataset not found");
    }
  });

  it("cancels a running pipeline job with jobId parameter", async () => {
    const handler = vi.fn((cmd, args) => {
      if (cmd === "pipeline_cancel") {
        expect(args).toEqual({ jobId: "job-xyz-123" });
        return { ok: true, data: { cancelled: true } };
      }
    });

    mockIPC(handler);

    const res = await pipelineCancel("job-xyz-123");
    expect(res.ok).toBe(true);
    expect(handler).toHaveBeenCalled();
  });

  it("subscribes to pipeline-progress events", async () => {
    const callback = vi.fn();
    const unlisten = await listenPipelineProgress(callback);
    expect(typeof unlisten).toBe("function");
    unlisten();
  });
});
