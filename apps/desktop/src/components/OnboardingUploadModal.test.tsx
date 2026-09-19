import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "solid-js/web";
import { OnboardingUploadModal } from "./OnboardingUploadModal";
import * as tauriLib from "../lib/tauri";
import type * as TauriModule from "../lib/tauri";

vi.mock("../lib/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof TauriModule>();
  return {
    ...actual,
    isTauri: vi.fn(),
    dialogPickFile: vi.fn(),
  };
});

describe("OnboardingUploadModal Dropzone File Picker", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (container) {
      container.remove();
    }
  });

  it("does not trigger fallback file input click when native dialog is canceled in Tauri", async () => {
    vi.mocked(tauriLib.isTauri).mockReturnValue(true);
    vi.mocked(tauriLib.dialogPickFile).mockResolvedValue({ ok: true, data: null });

    const onPathSelect = vi.fn();
    const dispose = render(
      () => (
        <OnboardingUploadModal
          open={true}
          onOpenChange={() => {}}
          uploading={false}
          isDragging={false}
          uploadedBytes={null}
          uploadedFilePath={null}
          inspectionData={null}
          uploadError={null}
          onClearUploadError={() => {}}
          onDragOver={() => {}}
          onDragLeave={() => {}}
          onDrop={() => {}}
          onFileInputChange={() => {}}
          onPathSelect={onPathSelect}
          onImportSuccess={() => {}}
          onCancelInspection={() => {}}
        />
      ),
      container,
    );

    const input = document.getElementById("onboarding-file-upload") as HTMLInputElement;
    expect(input).toBeDefined();
    const inputClickSpy = vi.spyOn(input, "click");

    const dropzone = input.parentElement as HTMLDivElement;
    expect(dropzone).toBeDefined();

    dropzone.click();
    await Promise.resolve();

    expect(tauriLib.dialogPickFile).toHaveBeenCalledTimes(1);
    expect(onPathSelect).not.toHaveBeenCalled();
    expect(inputClickSpy).not.toHaveBeenCalled();

    dispose();
  });

  it("calls onPathSelect without triggering fallback input when file is picked in Tauri", async () => {
    vi.mocked(tauriLib.isTauri).mockReturnValue(true);
    vi.mocked(tauriLib.dialogPickFile).mockResolvedValue({
      ok: true,
      data: "C:\\data\\wetland_sample.csv",
    });

    const onPathSelect = vi.fn();
    const dispose = render(
      () => (
        <OnboardingUploadModal
          open={true}
          onOpenChange={() => {}}
          uploading={false}
          isDragging={false}
          uploadedBytes={null}
          uploadedFilePath={null}
          inspectionData={null}
          uploadError={null}
          onClearUploadError={() => {}}
          onDragOver={() => {}}
          onDragLeave={() => {}}
          onDrop={() => {}}
          onFileInputChange={() => {}}
          onPathSelect={onPathSelect}
          onImportSuccess={() => {}}
          onCancelInspection={() => {}}
        />
      ),
      container,
    );

    const input = document.getElementById("onboarding-file-upload") as HTMLInputElement;
    const inputClickSpy = vi.spyOn(input, "click");
    const dropzone = input.parentElement as HTMLDivElement;

    dropzone.click();
    await Promise.resolve();

    expect(tauriLib.dialogPickFile).toHaveBeenCalledTimes(1);
    expect(onPathSelect).toHaveBeenCalledWith("wetland_sample.csv", "C:\\data\\wetland_sample.csv");
    expect(inputClickSpy).not.toHaveBeenCalled();

    dispose();
  });
});
