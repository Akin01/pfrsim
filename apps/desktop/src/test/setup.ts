import { vi, beforeEach, afterEach } from "vitest";
import { mockWindows, mockIPC, clearMocks } from "@tauri-apps/api/mocks";

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock URL createObjectURL & revokeObjectURL
if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/mock-blob");
} else {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/mock-blob");
}
if (typeof URL.revokeObjectURL === "undefined") {
  URL.revokeObjectURL = vi.fn();
} else {
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
}

// Mock requestAnimationFrame
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback: FrameRequestCallback) =>
    setTimeout(callback, 0) as unknown as number;
  window.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

beforeEach(() => {
  mockWindows("main");
  mockIPC((_cmd) => {}, { shouldMockEvents: true });
});

afterEach(() => {
  clearMocks();
});
