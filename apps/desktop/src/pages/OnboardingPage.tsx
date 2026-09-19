import { Component, createEffect, createSignal, onCleanup } from "solid-js";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { datasetInspect, isTauri } from "../lib/tauri";
import { navigateTab, view } from "../lib/store";
import { mutationBus } from "../lib/mutation";
import type { DatasetInspection } from "../lib/types";
import { toast } from "../lib/toast";
import { catalogs } from "../i18n/catalog";
import { isValidDatasetFile } from "../utils/onboarding";
import { OnboardingHero } from "../components/OnboardingHero";
import { OnboardingWorkflowSteps } from "../components/OnboardingWorkflowSteps";
import { OnboardingUploadModal } from "../components/OnboardingUploadModal";

export const OnboardingPage: Component = () => {
  const t = () => catalogs[view.lang];

  const [showUploadModal, setShowUploadModal] = createSignal(false);
  const [isDragging, setIsDragging] = createSignal(false);
  const [uploading, setUploading] = createSignal(false);
  const [inspectionData, setInspectionData] = createSignal<DatasetInspection | null>(null);
  const [uploadedBytes, setUploadedBytes] = createSignal<number[] | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = createSignal<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = createSignal<{
    name: string;
    id: string;
  } | null>(null);
  const [uploadError, setUploadError] = createSignal<string | null>(null);

  // Handle CSV/Excel/Parquet file upload and inspection
  const handleFileUpload = async (file: File) => {
    if (!isValidDatasetFile(file.name)) {
      setUploadError(t().onboardingUnsupportedFormat);
      return;
    }

    // 1. If native OS file path is accessible (Tauri WebView2), stream directly from disk
    const nativePath = (file as unknown as { path?: string }).path;
    if (nativePath && nativePath.trim().length > 0) {
      await handlePathUpload(file.name, nativePath.trim());
      return;
    }

    // 2. Prevent browser memory exhaustion on multi-million row files
    if (file.size > 50 * 1024 * 1024) {
      const errMsg = `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB) to load in browser memory. Please open via the desktop app file picker.`;
      setUploadError(errMsg);
      toast.error(errMsg);
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const buffer = await file.arrayBuffer();
      const rawBytes = Array.from(new Uint8Array(buffer));

      const res = await datasetInspect(file.name, undefined, rawBytes);
      if (res.ok) {
        setInspectionData(res.data);
        setUploadedBytes(rawBytes);
      } else {
        setUploadError(`Failed to inspect file schema [${res.code}]: ${res.message}`);
        toast.error(`Failed to inspect file schema: ${res.message}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(`Inspection error: ${msg}`);
      toast.error(`Inspection error: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const handlePathUpload = async (fileName: string, filePath: string) => {
    if (!isValidDatasetFile(fileName)) {
      setUploadError(t().onboardingUnsupportedFormat);
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const res = await datasetInspect(fileName, filePath, undefined);
      if (res.ok) {
        setInspectionData(res.data);
        setUploadedFilePath(filePath);
        setUploadedBytes(null);
      } else {
        setUploadError(`Failed to inspect file schema [${res.code}]: ${res.message}`);
        toast.error(`Failed to inspect file schema: ${res.message}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(`Inspection error: ${msg}`);
      toast.error(`Inspection error: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  // Native Tauri drag-and-drop listener for onboarding dropzone
  createEffect(() => {
    if (inspectionData()) return;
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent(async (event) => {
        const payload = event.payload;
        if (payload.type === "enter" || payload.type === "over") {
          setIsDragging(true);
        } else if (payload.type === "leave") {
          setIsDragging(false);
        } else if (payload.type === "drop") {
          setIsDragging(false);
          const paths = payload.paths;
          if (paths && paths.length > 0) {
            const filePath = paths[0];
            const fileName = filePath.split(/[/\\]/).pop() || "dataset.csv";
            setShowUploadModal(true);
            await handlePathUpload(fileName, filePath);
          }
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((e) => {
        console.warn("Tauri onDragDropEvent listener failed:", e);
      });

    onCleanup(() => {
      if (unlisten) unlisten();
    });
  });

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const onFileInputChange = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      handleFileUpload(target.files[0]);
    }
  };

  return (
    <div class="h-full overflow-y-auto p-6 md:p-8 bg-white dark:bg-slate-950 transition-colors">
      <div class="max-w-4xl w-full mx-auto space-y-8">
        {/* 1. Hero Welcome Greeting Section */}
        <OnboardingHero
          uploadSuccess={uploadSuccess()}
          onOpenUploadModal={() => {
            setUploadError(null);
            setShowUploadModal(true);
          }}
          onNavigateToData={() => navigateTab("data")}
          onNavigateToTrain={() => navigateTab("train")}
          onClearUploadSuccess={() => setUploadSuccess(null)}
        />

        {/* 2. 4-Step App Workflow Guide */}
        <OnboardingWorkflowSteps onNavigateToTab={(tab) => navigateTab(tab)} />
      </div>

      {/* 3. Upload Dataset Dropzone & Column Mapper Modal */}
      <OnboardingUploadModal
        open={showUploadModal()}
        onOpenChange={(open) => {
          setShowUploadModal(open);
          if (!open) {
            setInspectionData(null);
            setUploadedBytes(null);
            setUploadedFilePath(null);
            setUploadError(null);
          }
        }}
        inspectionData={inspectionData()}
        uploadedBytes={uploadedBytes()}
        uploadedFilePath={uploadedFilePath()}
        uploading={uploading()}
        isDragging={isDragging()}
        uploadError={uploadError()}
        onClearUploadError={() => setUploadError(null)}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onFileInputChange={onFileInputChange}
        onPathSelect={handlePathUpload}
        onImportSuccess={(datasetId) => {
          setUploadSuccess({ name: inspectionData()!.file_name, id: datasetId });
          toast.success(t().onboardingSuccessToast);
          setInspectionData(null);
          setUploadedBytes(null);
          setUploadedFilePath(null);
          setShowUploadModal(false);
          mutationBus.notifyDatasetMutated(datasetId);
        }}
        onCancelInspection={() => {
          setInspectionData(null);
          setUploadedBytes(null);
          setUploadedFilePath(null);
        }}
      />
    </div>
  );
};

export default OnboardingPage;
