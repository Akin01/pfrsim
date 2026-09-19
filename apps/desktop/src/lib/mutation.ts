import { createSignal } from "solid-js";
import { setPlayback } from "./store";

/**
 * Reactive mutation bus for cross-component cache invalidation.
 *
 * Any component reading an entity version hook (`useDatasetsVersion()`,
 * `useJobsVersion()`, `useRunsVersion()`) inside a SolidJS `createEffect` or
 * `createResource` will automatically and reactively refetch whenever that
 * entity is mutated anywhere in the application.
 */

const [datasetsVersion, setDatasetsVersion] = createSignal(0);
const [jobsVersion, setJobsVersion] = createSignal(0);
const [runsVersion, setRunsVersion] = createSignal(0);

export const useDatasetsVersion = () => datasetsVersion();
export const useJobsVersion = () => jobsVersion();
export const useRunsVersion = () => runsVersion();

export const mutationBus = {
  /**
   * Notify that a dataset was created, imported, renamed, or deleted.
   * Optionally updates the globally selected dataset ID in playback store.
   */
  notifyDatasetMutated(selectedDatasetId?: string | null) {
    if (selectedDatasetId !== undefined) {
      setPlayback("selectedDatasetId", selectedDatasetId);
    }
    setDatasetsVersion((v) => v + 1);
  },

  /**
   * Notify that a training job was started, canceled, progressed, or deleted.
   */
  notifyJobMutated() {
    setJobsVersion((v) => v + 1);
  },

  /**
   * Notify that a model run was created (e.g. training job completed) or deleted.
   * Optionally updates the globally selected run ID in playback store.
   */
  notifyRunMutated(selectedRunId?: string | null) {
    if (selectedRunId !== undefined) {
      setPlayback("selectedRunId", selectedRunId);
    }
    setRunsVersion((v) => v + 1);
  },
};

export default mutationBus;
