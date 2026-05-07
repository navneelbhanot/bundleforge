import "@testing-library/jest-dom/vitest";

// M-188: initialise i18next once for the entire frontend test
// suite so components that call useTranslation() get real
// translations instead of falling back to the key string.
import "../frontend/src/lib/i18n";

// jsdom doesn't ship matchMedia or ResizeObserver; Polaris needs them.
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
  if (typeof globalThis.ResizeObserver === "undefined") {
    class RO {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
  }
}
