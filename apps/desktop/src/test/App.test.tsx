import { describe, it, expect, beforeEach } from "vitest";
import { render } from "solid-js/web";
import { mockIPC } from "@tauri-apps/api/mocks";
import App from "../App";
import { setLang } from "../lib/store";
describe("App Root Mount", () => {
  beforeEach(() => {
    mockIPC((cmd) => {
      if (cmd === "datasets_list") return { ok: true, data: [] };
      if (cmd === "runs_list") return { ok: true, data: [] };
      if (cmd === "pipeline_jobs_list") return { ok: true, data: [] };
      if (cmd === "capability_query")
        return { ok: true, data: { gpu_available: false, memory_available: true } };
      if (cmd === "gpu_spec_query") return { ok: true, data: null };
      return { ok: true, data: null };
    });
  });

  it("mounts <App /> without throwing", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    expect(() => {
      const dispose = render(() => <App />, container);
      dispose();
    }).not.toThrow();
  });

  it("reactively switches all page and tab text when language changes", async () => {
    setLang("id");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const dispose = render(() => <App />, container);

    expect(container.textContent).toContain("Panduan Mulai");
    expect(container.textContent).toContain("Pelatihan Model");

    setLang("en");
    const { promise: p1, resolve: r1 } = Promise.withResolvers<void>();
    queueMicrotask(() => {
      expect(container.textContent).toContain("Getting Started");
      expect(container.textContent).toContain("Model Training");
      r1();
    });
    await p1;

    setLang("id");
    const { promise: p2, resolve: r2 } = Promise.withResolvers<void>();
    queueMicrotask(() => {
      expect(container.textContent).toContain("Panduan Mulai");
      expect(container.textContent).toContain("Pelatihan Model");
      r2();
    });
    await p2;

    dispose();
    container.remove();
  });
});
