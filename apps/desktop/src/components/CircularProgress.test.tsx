import { describe, it, expect, afterEach } from "vitest";
import { render } from "solid-js/web";
import { CircularProgress } from "./CircularProgress";

describe("CircularProgress Component", () => {
  let container: HTMLDivElement;

  afterEach(() => {
    if (container) {
      container.remove();
    }
  });

  it("renders 0% correctly on zero progress", () => {
    container = document.createElement("div");
    document.body.appendChild(container);

    const dispose = render(() => <CircularProgress progress={0.0} />, container);

    expect(container.textContent).toContain("0%");
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
    dispose();
  });

  it("renders 50% correctly on 0.5 progress", () => {
    container = document.createElement("div");
    document.body.appendChild(container);

    const dispose = render(() => <CircularProgress progress={0.5} />, container);

    expect(container.textContent).toContain("50%");
    dispose();
  });

  it("clamps progress values exceeding 1.0 to 100%", () => {
    container = document.createElement("div");
    document.body.appendChild(container);

    const dispose = render(() => <CircularProgress progress={1.5} />, container);

    expect(container.textContent).toContain("100%");
    dispose();
  });
});
