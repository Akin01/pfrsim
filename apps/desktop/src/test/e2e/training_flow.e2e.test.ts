import { describe, it, expect } from "vitest";
import { mockIPC } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import {
  datasetsList,
  capabilityQuery,
  pipelineRun,
  pipelineJobsList,
  listenPipelineProgress,
} from "../../lib/tauri";
import { PRESETS, parseAgnosticGpuSpec } from "../../utils/train";
import { mutationBus, useJobsVersion, useRunsVersion } from "../../lib/mutation";
import type { PipelineConfig, ProgressEventPayload } from "../../lib/types";

describe("E2E Workflow: Training Pipeline Lifecycle (Tauri v2 mockIPC)", () => {
  it("executes the complete training workflow from hardware inspection to job completion", async () => {
    const mockDatasets = [
      {
        id: "ds-sabangau-192",
        name: "Sabangau Station Real-World (192-point)",
        csv_sha: "sha256-abcdef123456",
        n: 192,
        missing_total: 0,
        run_count: 0,
        created_at: "2026-09-18T00:00:00Z",
      },
    ];

    const mockHardwareStr = "NVIDIA RTX 4090";
    const mockJobId = "job-pfrsim-20260918-001";
    let jobCompleted = false;

    // Register complete IPC backend behavior via official Tauri v2 mockIPC with event mocking enabled
    mockIPC(
      (cmd) => {
        switch (cmd) {
          case "datasets_list":
            return { ok: true, data: mockDatasets };
          case "capability_query":
            return {
              ok: true,
              data: {
                gpu_detected: true,
                gpu_spec: mockHardwareStr,
                recommended_device: "gpu",
              },
            };
          case "pipeline_run":
            return {
              ok: true,
              data: {
                job_id: mockJobId,
                run_id: "run-pfrsim-20260918-001",
                status: "queued",
              },
            };
          case "pipeline_jobs_list":
            return {
              ok: true,
              data: [
                {
                  job_id: mockJobId,
                  dataset_id: "ds-sabangau-192",
                  run_name: "Sabangau Fast Run",
                  status: jobCompleted ? "done" : "running",
                  stage: jobCompleted ? "done" : "forecasting",
                  progress: jobCompleted ? 1.0 : 0.45,
                  created_at: "2026-09-18T00:01:00Z",
                  finished_at: jobCompleted ? "2026-09-18T00:01:12Z" : null,
                  run_id: "run-pfrsim-20260918-001",
                },
              ],
            };
          default:
            return null;
        }
      },
      { shouldMockEvents: true },
    );

    // 1. Ingest/Query Available Datasets
    const dsRes = await datasetsList();
    expect(dsRes.ok).toBe(true);
    if (!dsRes.ok) return;
    const selectedDataset = dsRes.data[0];
    expect(selectedDataset.id).toBe("ds-sabangau-192");
    // 2. Query Hardware Capabilities and Parse GPU Architecture
    const capRes = await capabilityQuery();
    expect(capRes.ok).toBe(true);
    const gpuSpec = parseAgnosticGpuSpec(mockHardwareStr, 24576);
    expect(gpuSpec.cleanName).toContain("NVIDIA RTX 4090");
    expect(gpuSpec.tier).toContain("Tensor");
    expect(gpuSpec.score).toBeGreaterThanOrEqual(80);

    // 3. Select Training Preset & Generate Pipeline Hyperparameter Configuration
    const preset = PRESETS.find((p) => p.id === "fast-baseline")!;
    expect(preset).toBeDefined();

    const trainingConfig: PipelineConfig = {
      imputer: {
        id: preset.imputerId,
        k: preset.k,
        span: preset.span,
      },
      forecaster: {
        id: preset.forecasterId,
        arima: { test_split_ratio: preset.splitRatio },
        lstm: null,
        gru: null,
      },
      pfvi: {
        r0: preset.r0,
        dt: 1.0,
        h: preset.h,
        fc: 40.0,
        sat: 70.0,
        max_grid_m: preset.maxGridM,
        timeout_s: 30.0,
      },
      seed: preset.seed,
    };

    // 4. Submit Pipeline Job to Backend Engine
    const startRes = await pipelineRun(selectedDataset.id, trainingConfig, preset.seed);
    expect(startRes.ok).toBe(true);
    if (startRes.ok) {
      expect(startRes.data.job_id).toBe(mockJobId);
    }

    // 5. Setup Live Streaming Telemetry Listener
    const progressTracker: ProgressEventPayload[] = [];
    const unlisten = await listenPipelineProgress((payload) => {
      progressTracker.push(payload);
    });

    // 6. Simulate Streaming Progress Events across all 5 Stages
    const stages: Array<{ stage: string; progress: number; sub_step?: string; epoch?: number }> = [
      { stage: "validating", progress: 0.03, sub_step: "SCHEMA" },
      { stage: "imputing", progress: 0.15, sub_step: "WT" },
      { stage: "forecasting", progress: 0.45, sub_step: "WT", epoch: 5 },
      { stage: "fitting-pfvi", progress: 0.75, sub_step: "OPTIM" },
      { stage: "materializing", progress: 0.95, sub_step: "CONCAT" },
      { stage: "done", progress: 1.0 },
    ];

    for (const st of stages) {
      await emit("pipeline-progress", {
        job_id: mockJobId,
        stage: st.stage,
        progress: st.progress,
        epoch: st.epoch ?? null,
        total_epochs: 10,
        current_var: "WT",
        sub_step: st.sub_step ?? null,
      });
    }

    expect(progressTracker).toHaveLength(6);
    expect(progressTracker[0].stage).toBe("validating");
    expect(progressTracker[2].epoch).toBe(5);
    expect(progressTracker[5].stage).toBe("done");
    expect(progressTracker[5].progress).toBe(1.0);

    // 7. Verify Job Status Reflection in SQLite RunStore List
    jobCompleted = true;
    const jobsRes = await pipelineJobsList();
    expect(jobsRes.ok).toBe(true);
    if (jobsRes.ok) {
      expect(jobsRes.data).toHaveLength(1);
      expect(jobsRes.data[0].status).toBe("done");
      expect(jobsRes.data[0].run_id).toBe("run-pfrsim-20260918-001");
    }

    // 8. Trigger Mutation Bus
    const initialJobsVer = useJobsVersion();
    const initialRunsVer = useRunsVersion();
    mutationBus.notifyJobMutated();
    mutationBus.notifyRunMutated();

    expect(useJobsVersion()).toBe(initialJobsVer + 1);
    expect(useRunsVersion()).toBe(initialRunsVer + 1);

    unlisten();
  });

  it("wires GPU device selection and custom batch size from UI config into pipeline_run IPC payload", async () => {
    let capturedArgs: unknown = null;

    mockIPC((cmd, args) => {
      if (cmd === "pipeline_run") {
        capturedArgs = args;
        return {
          ok: true,
          data: {
            job_id: "job-gpu-001",
            run_id: "run-gpu-001",
            status: "queued",
          },
        };
      }
      return null;
    });

    const customConfig: PipelineConfig = {
      imputer: { id: "knn", k: 5, span: 0.5 },
      forecaster: {
        id: "lstm",
        arima: { test_split_ratio: 0.2, learning_rate: 0.005 },
        lstm: {
          look_back: 16,
          layer_units: [32],
          epochs: 50,
          batch_size: 128,
          learning_rate: 0.035,
          device: "gpu",
        },
        gru: null,
      },
      pfvi: {
        r0: 2700.0,
        dt: 1.0,
        h: 4,
        fc: 40.0,
        sat: 70.0,
        max_grid_m: 2,
        timeout_s: 30.0,
      },
      seed: 42,
    };

    const res = await pipelineRun("ds-sabangau-192", customConfig, 42);
    expect(res.ok).toBe(true);

    const payload = capturedArgs as {
      datasetId: string;
      config: PipelineConfig;
      seed: number;
    };
    expect(payload.config.forecaster.id).toBe("lstm");
    expect(payload.config.forecaster.lstm?.device).toBe("gpu");
    expect(payload.config.forecaster.lstm?.batch_size).toBe(128);
    expect(payload.config.forecaster.lstm?.epochs).toBe(50);
    expect(payload.config.forecaster.lstm?.learning_rate).toBe(0.035);
  });

  it("wires configurable learning rate into pipeline_run IPC payload for GRU and ARIMA", async () => {
    let capturedArgs: unknown = null;
    mockIPC((cmd, args) => {
      if (cmd === "pipeline_run") {
        capturedArgs = args;
        return {
          ok: true,
          data: {
            job_id: "mock-job-gru-lr",
            run_id: "mock-run-gru-lr",
            status: "queued",
          },
        };
      }
      return null;
    });

    const gruConfig: PipelineConfig = {
      imputer: { id: "loess", k: 5, span: 0.5 },
      forecaster: {
        id: "gru",
        arima: { test_split_ratio: 0.2, learning_rate: 0.015 },
        lstm: null,
        gru: {
          look_back: 12,
          layer_units: [16],
          epochs: 80,
          batch_size: 64,
          learning_rate: 0.008,
          device: "cpu",
        },
      },
      pfvi: {
        r0: 2700.0,
        dt: 1.0,
        h: 4,
        fc: 40.0,
        sat: 70.0,
        max_grid_m: 2,
        timeout_s: 30.0,
      },
      seed: 42,
    };

    const res = await pipelineRun("ds-sabangau-192", gruConfig, 42);
    expect(res.ok).toBe(true);

    const payload = capturedArgs as {
      datasetId: string;
      config: PipelineConfig;
      seed: number;
    };
    expect(payload.config.forecaster.id).toBe("gru");
    expect(payload.config.forecaster.gru?.learning_rate).toBe(0.008);
    expect(payload.config.forecaster.arima.learning_rate).toBe(0.015);
  });

  it("wires full batch (batch_size: 0) into pipeline_run IPC payload for LSTM", async () => {
    let capturedArgs: unknown = null;
    mockIPC((cmd, args) => {
      if (cmd === "pipeline_run") {
        capturedArgs = args;
        return {
          ok: true,
          data: {
            job_id: "mock-job-full-batch",
            run_id: "mock-run-full-batch",
            status: "queued",
          },
        };
      }
      return null;
    });

    const fullBatchConfig: PipelineConfig = {
      imputer: { id: "knn", k: 5, span: 0.5 },
      forecaster: {
        id: "lstm",
        arima: { test_split_ratio: 0.2 },
        lstm: {
          look_back: 12,
          layer_units: [32],
          epochs: 50,
          batch_size: 0, // Full batch!
          learning_rate: 0.02,
          device: "cpu",
        },
        gru: null,
      },
      pfvi: {
        r0: 2700.0,
        dt: 1.0,
        h: 4,
        fc: 40.0,
        sat: 70.0,
        max_grid_m: 2,
        timeout_s: 30.0,
      },
      seed: 42,
    };

    const res = await pipelineRun("ds-sabangau-192", fullBatchConfig, 42);
    expect(res.ok).toBe(true);

    const payload = capturedArgs as {
      datasetId: string;
      config: PipelineConfig;
      seed: number;
    };
    expect(payload.config.forecaster.id).toBe("lstm");
    expect(payload.config.forecaster.lstm?.batch_size).toBe(0);
  });
});
