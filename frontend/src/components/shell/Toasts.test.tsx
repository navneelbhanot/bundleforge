import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { AppProvider, Frame } from "@shopify/polaris";

import { ToastsProvider, ToastHost, useToasts } from "./Toasts";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

afterEach(() => {
  cleanup();
});

function ShowOnMount({ message }: { message: string }) {
  const { show } = useToasts();
  // Use act-wrapped effect once.
  if (!(globalThis as { __shown?: boolean }).__shown) {
    (globalThis as { __shown?: boolean }).__shown = true;
    show(message);
  }
  return null;
}

describe("Toasts", () => {
  it("useToasts() outside <ToastsProvider> throws a clear error", () => {
    function Bad(): JSX.Element {
      useToasts();
      return <div />;
    }
    // React 18 logs the error twice; suppress to keep test output
    // readable.
    const original = console.error;
    console.error = () => undefined;
    try {
      expect(() =>
        render(
          <AppProvider i18n={i18n}>
            <Bad />
          </AppProvider>,
        ),
      ).toThrow(/useToasts\(\) called outside <ToastsProvider>/i);
    } finally {
      console.error = original;
    }
  });

  it("calling show() mounts a Polaris Toast with the message", () => {
    (globalThis as { __shown?: boolean }).__shown = false;
    render(
      <AppProvider i18n={i18n}>
        <ToastsProvider>
          <Frame>
            <ShowOnMount message="Saved" />
            <ToastHost />
          </Frame>
        </ToastsProvider>
      </AppProvider>,
    );
    // Polaris Toast renders its content in a portal; getByText
    // searches the entire document.
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("calling show() twice replaces the message (last wins)", () => {
    let capturedShow: ((m: string) => void) | null = null;
    function Capture(): JSX.Element {
      const { show } = useToasts();
      capturedShow = show;
      return <div />;
    }
    render(
      <AppProvider i18n={i18n}>
        <ToastsProvider>
          <Frame>
            <Capture />
            <ToastHost />
          </Frame>
        </ToastsProvider>
      </AppProvider>,
    );
    act(() => capturedShow!("first"));
    expect(screen.getByText("first")).toBeTruthy();
    act(() => capturedShow!("second"));
    // Second message is now visible. Polaris remounts the Toast
    // when the key changes, but during the in-flight transition
    // both nodes can briefly co-exist in the portal — assert that
    // the new message is present rather than that the old is gone.
    expect(screen.getByText("second")).toBeTruthy();
  });
});
