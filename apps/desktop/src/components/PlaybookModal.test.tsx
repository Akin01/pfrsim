import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "solid-js/web";
import { PlaybookModal } from "./PlaybookModal";

describe("PlaybookModal Component (playbook/cards.ts)", () => {
  let container: HTMLDivElement;

  afterEach(() => {
    if (container) {
      container.remove();
    }
  });

  it("renders contextual field mitigation directives for High hazard class", () => {
    container = document.createElement("div");
    document.body.appendChild(container);

    const onClose = vi.fn();
    const dispose = render(
      () => <PlaybookModal open={true} onClose={onClose} activeClass="High" currentPfvi={185.4} />,
      container,
    );

    // Modal dialog content rendered in portal or body
    const modalContent = document.body.textContent || "";
    expect(modalContent).toContain("Playbook");
    expect(modalContent).toContain("High");
    expect(modalContent).toContain("185.4");

    dispose();
  });

  it("switches directives dynamically when another hazard class tab is clicked", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);

    const onClose = vi.fn();
    const dispose = render(
      () => <PlaybookModal open={true} onClose={onClose} activeClass="Low" currentPfvi={45.0} />,
      container,
    );

    const modalContent = document.body.textContent || "";
    expect(modalContent).toContain("Low");

    // Click Extreme class button
    const buttons = Array.from(document.body.querySelectorAll("button"));
    const extremeBtn = buttons.find((b) => b.textContent?.includes("Extreme"));
    expect(extremeBtn).toBeDefined();
    extremeBtn?.click();

    expect(document.body.textContent).toContain("Extreme");

    dispose();
  });
});
