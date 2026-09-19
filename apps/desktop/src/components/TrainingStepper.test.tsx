import { describe, it, expect, afterEach } from "vitest";
import { render } from "solid-js/web";
import { TrainingStepper } from "./TrainingStepper";

describe("TrainingStepper Component", () => {
  let container: HTMLDivElement;

  afterEach(() => {
    if (container) {
      container.remove();
    }
  });

  it("renders 5 execution steps correctly", () => {
    container = document.createElement("div");
    document.body.appendChild(container);

    const dispose = render(
      () => (
        <TrainingStepper stage="validating" progress={0.03} status="running" subStep="SCHEMA" />
      ),
      container,
    );

    expect(container.textContent).toMatch(/Validating|Validasi/);
    expect(container.textContent).toMatch(/Imputing|Imputasi/);
    expect(container.textContent).toMatch(/Forecasting|Prakiraan/);
    expect(container.textContent).toMatch(/Calibration|Kalibrasi/);
    expect(container.textContent).toMatch(/Materializing|Materialisasi/);
    dispose();
  });

  it("displays sub-step chips and active variable during forecasting", () => {
    container = document.createElement("div");
    document.body.appendChild(container);

    const dispose = render(
      () => (
        <TrainingStepper
          stage="forecasting"
          progress={0.45}
          status="running"
          currentVar="WT"
          subStep="WT"
          epoch={5}
          totalEpochs={10}
        />
      ),
      container,
    );

    expect(container.textContent).toContain("WT");
    expect(container.textContent).toContain("45%");
    dispose();
  });

  it("indicates completed status when status is done", () => {
    container = document.createElement("div");
    document.body.appendChild(container);

    const dispose = render(
      () => <TrainingStepper stage="done" progress={1.0} status="done" durationSeconds={12.5} />,
      container,
    );

    expect(container.textContent).toContain("100%");
    dispose();
  });

  it("renders concurrent variable progress from varEpochs monotonically", () => {
    container = document.createElement("div");
    document.body.appendChild(container);

    const dispose = render(
      () => (
        <TrainingStepper
          stage="forecasting (WT epoch 50/100)"
          progress={0.45}
          status="running"
          currentVar="WT"
          subStep="WT"
          epoch={50}
          totalEpochs={100}
          varEpochs={{ WT: 50, SM: 25, Rf: 10, Temp: 5 }}
        />
      ),
      container,
    );

    expect(container.textContent).toContain("WT");
    expect(container.textContent).toContain("50/100 · 50%");
    expect(container.textContent).toContain("25/100 · 25%");
    dispose();
  });

  it("switches stage tabs when user clicks stage buttons", () => {
    container = document.createElement("div");
    document.body.appendChild(container);

    const dispose = render(
      () => (
        <TrainingStepper
          stage="forecasting (WT epoch 50/100)"
          progress={0.45}
          status="running"
          currentVar="WT"
          subStep="WT"
          epoch={50}
          totalEpochs={100}
        />
      ),
      container,
    );

    // Initially forecasting stage is shown
    expect(container.textContent).toContain("WT");

    // Find and click Validating stage tab button
    const buttons = container.querySelectorAll("button");
    const validatingBtn = Array.from(buttons).find(
      (b) => b.textContent?.includes("Validat") || b.textContent?.includes("Validasi"),
    );
    expect(validatingBtn).toBeDefined();
    validatingBtn?.click();

    // Validating pipeline cards (DIM, SCHEMA, AUDIT, SANITY) must now be visible!
    expect(container.textContent).toContain("DIM");
    expect(container.textContent).toContain("SCHEMA");
    expect(container.textContent).toMatch(/Stage:\s*Validating|Tahap:\s*Validasi/);
    dispose();
  });
});
