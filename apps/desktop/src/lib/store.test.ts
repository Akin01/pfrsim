import { describe, it, expect, beforeEach } from "vitest";
import { createRenderEffect, createRoot } from "solid-js";
import { catalogs } from "../i18n/catalog";
import { view, currentLang, setLang, toggleLang, getPageTitle, workspaceTabs } from "./store";

describe("i18n & Store Language Management", () => {
  beforeEach(() => {
    setLang("id");
  });

  it("initializes default language and toggles language correctly", () => {
    expect(view.lang).toBe("id");
    expect(currentLang()).toBe("id");
    expect(getPageTitle("onboarding")).toBe("Panduan Mulai");
    expect(getPageTitle("data")).toBe("Koleksi Data");

    toggleLang();
    expect(view.lang).toBe("en");
    expect(currentLang()).toBe("en");
    expect(getPageTitle("onboarding")).toBe("Getting Started");
    expect(getPageTitle("data")).toBe("Data Library");

    toggleLang();
    expect(view.lang).toBe("id");
    expect(currentLang()).toBe("id");
    expect(getPageTitle("onboarding")).toBe("Panduan Mulai");
  });
  it("explicitly sets language via setLang", () => {
    setLang("en");
    expect(view.lang).toBe("en");
    expect(localStorage.getItem("pfrsim-lang")).toBe("en");
    expect(document.documentElement.getAttribute("lang")).toBe("en");

    setLang("id");
    expect(view.lang).toBe("id");
    expect(localStorage.getItem("pfrsim-lang")).toBe("id");
    expect(document.documentElement.getAttribute("lang")).toBe("id");
  });

  it("updates workspace tabs titles when language switches", () => {
    setLang("en");
    const enTabs = workspaceTabs();
    const onboardingEn = enTabs.find((t) => t.type === "onboarding");
    if (onboardingEn) {
      expect(onboardingEn.title).toBe("Getting Started");
    }

    setLang("id");
    const idTabs = workspaceTabs();
    const onboardingId = idTabs.find((t) => t.type === "onboarding");
    if (onboardingId) {
      expect(onboardingId.title).toBe("Panduan Mulai");
    }
  });

  it("reactively triggers createRenderEffect when setLang is called", async () => {
    let observed = "";
    let runs = 0;
    const { promise, resolve } = Promise.withResolvers<void>();
    createRoot((dispose) => {
      createRenderEffect(() => {
        observed = view.lang;
        runs++;
      });
      expect(observed).toBe("id");
      expect(runs).toBe(1);
      setLang("en");
      queueMicrotask(() => {
        expect(observed).toBe("en");
        expect(runs).toBe(2);
        dispose();
        resolve();
      });
    });
    await promise;
  });

  it("reactively updates DOM text when setLang is called", async () => {
    const div = document.createElement("div");
    document.body.appendChild(div);

    let disposeRoot: () => void;
    createRoot((dispose) => {
      disposeRoot = dispose;
      const t = () => catalogs[view.lang];
      div.textContent = t().runsListTitle;
      createRenderEffect(() => {
        div.textContent = t().runsListTitle;
      });
    });
    expect(div.textContent).toBe("Daftar Model");
    setLang("en");
    const { promise: flushPromise, resolve: flushResolve } = Promise.withResolvers<void>();
    queueMicrotask(() => {
      expect(div.textContent).toBe("Runs & Models");
      flushResolve();
    });
    await flushPromise;

    disposeRoot!();
    div.remove();
  });
});
