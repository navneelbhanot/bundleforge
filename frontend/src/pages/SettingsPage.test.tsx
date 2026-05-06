import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { SettingsPage } from "./SettingsPage";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

const BASE_PAYLOAD = {
  safetyLock: false,
  notifications: { email: true, inApp: true },
  general: {
    name: "Devstore",
    email: "owner@devstore.com",
    shopifyDomain: "devstore.myshopify.com",
    brandColor: null,
    logoUrl: null,
    currency: "USD",
    locale: "en",
    timezone: "America/Los_Angeles",
  },
};

interface FetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function mockFetch(
  responder: (
    input: string,
    init?: RequestInit,
  ) => Promise<FetchResponse>,
): ReturnType<typeof vi.fn> {
  return vi.fn(
    (input: string, init?: RequestInit) => responder(input, init) as never,
  );
}

beforeEach(() => {
  // Default GET handler returns BASE_PAYLOAD; PUT echoes back a merged shape.
  vi.stubGlobal(
    "fetch",
    mockFetch(async (_input, init) => {
      if (!init || init.method === undefined || init.method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => BASE_PAYLOAD,
        };
      }
      const body = JSON.parse((init.body as string) ?? "{}") as {
        general?: Partial<typeof BASE_PAYLOAD.general>;
      };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ...BASE_PAYLOAD,
          general: { ...BASE_PAYLOAD.general, ...(body.general ?? {}) },
        }),
      };
    }),
  );
  // Reset hash between tests.
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", "/settings");
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SettingsPage", () => {
  it("renders all 10 tab labels", async () => {
    render(wrap(<SettingsPage />));
    await waitFor(() => expect(screen.getByText("Shop")).toBeTruthy());
    for (const label of [
      "General",
      "Display",
      "Inventory",
      "Pricing",
      "Cart & checkout",
      "Notifications",
      "Integrations",
      "API & webhooks",
      "Localization",
      "Billing",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("shows General tab content (Shop, Brand, Defaults cards)", async () => {
    render(wrap(<SettingsPage />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Shop", level: 2 }),
      ).toBeTruthy(),
    );
    expect(screen.getByRole("heading", { name: "Brand", level: 2 })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Defaults", level: 2 }),
    ).toBeTruthy();
    // Read-only shop info from the payload.
    expect(screen.getByText("Devstore")).toBeTruthy();
    expect(screen.getByText("owner@devstore.com")).toBeTruthy();
  });

  it("PATCHes brandColor and persists the new value", async () => {
    const fetchSpy = vi.fn(
      mockFetch(async (_input, init) => {
        if (!init || init.method === undefined || init.method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => BASE_PAYLOAD,
          };
        }
        const body = JSON.parse((init.body as string) ?? "{}") as {
          general?: { brandColor?: string };
        };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...BASE_PAYLOAD,
            general: {
              ...BASE_PAYLOAD.general,
              brandColor: body.general?.brandColor ?? null,
            },
          }),
        };
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { container } = render(wrap(<SettingsPage />));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Brand", level: 2 })).toBeTruthy());

    const colorInput = (
      Array.from(
        container.querySelectorAll<HTMLInputElement>("input"),
      ).find((i) => i.value === "#1f5fa6") ?? null
    ) as HTMLInputElement | null;
    expect(colorInput).toBeTruthy();
    fireEvent.change(colorInput!, { target: { value: "#abcdef" } });

    const saveBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Save");
    expect(saveBtn).toBeTruthy();
    saveBtn!.click();

    await waitFor(() => {
      const putCall = fetchSpy.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "PUT",
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse(
        ((putCall![1] as RequestInit).body as string) ?? "{}",
      );
      expect(body.general.brandColor).toBe("#abcdef");
    });
  });

  it("rejects malformed brand color before sending PATCH", async () => {
    const fetchSpy = vi.fn(
      mockFetch(async (_input, init) => {
        if (!init || init.method === undefined || init.method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => BASE_PAYLOAD,
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => BASE_PAYLOAD,
        };
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { container } = render(wrap(<SettingsPage />));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Brand", level: 2 })).toBeTruthy());

    const colorInput = Array.from(
      container.querySelectorAll<HTMLInputElement>("input"),
    ).find((i) => i.value === "#1f5fa6")!;
    fireEvent.change(colorInput, { target: { value: "blue" } });

    const saveBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Save");
    saveBtn!.click();

    await waitFor(() =>
      expect(screen.getByText(/6-digit hex/i)).toBeTruthy(),
    );
    // No PUT was issued.
    const putCall = fetchSpy.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === "PUT",
    );
    expect(putCall).toBeUndefined();
  });

  it("non-General tabs render the placeholder", async () => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/settings#display");
    }
    render(wrap(<SettingsPage />));
    await waitFor(() =>
      expect(screen.getByText(/being built in/i)).toBeTruthy(),
    );
    expect(screen.getByText(/M-162/)).toBeTruthy();
  });
});
