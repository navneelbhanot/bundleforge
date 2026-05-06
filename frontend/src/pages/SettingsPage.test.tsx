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
  display: {} as Record<string, unknown>,
  inventory: {} as Record<string, unknown>,
  pricing: {} as Record<string, unknown>,
  cart: {} as Record<string, unknown>,
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

  it("non-built tabs render the placeholder pointing at their milestone", async () => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/settings#notifications");
    }
    render(wrap(<SettingsPage />));
    await waitFor(() =>
      expect(screen.getByText(/being built in/i)).toBeTruthy(),
    );
    expect(screen.getByText(/M-165/)).toBeTruthy();
  });

  it("Display tab renders three editable cards", async () => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/settings#display");
    }
    render(wrap(<SettingsPage />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Layout & visual style", level: 2 }),
      ).toBeTruthy(),
    );
    expect(
      screen.getByRole("heading", { name: "Imagery & copy", level: 2 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Custom CSS", level: 2 }),
    ).toBeTruthy();
  });

  it("Display PATCH sends the layout key in the display subobject", async () => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/settings#display");
    }
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
          display?: Record<string, unknown>;
        };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...BASE_PAYLOAD,
            display: { ...BASE_PAYLOAD.display, ...(body.display ?? {}) },
          }),
        };
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { container } = render(wrap(<SettingsPage />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Layout & visual style", level: 2 }),
      ).toBeTruthy(),
    );

    // First Select with value "grid" is the Layout selector.
    const layoutSelect = (
      Array.from(container.querySelectorAll<HTMLSelectElement>("select")).find(
        (s) => s.value === "grid",
      ) ?? null
    );
    expect(layoutSelect).toBeTruthy();
    fireEvent.change(layoutSelect!, { target: { value: "list" } });

    // Click the Save button in the Layout card (the first Save button).
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
      expect(body.display.layout).toBe("list");
    });
  });

  it("Inventory tab renders Stock guards and Audit cards", async () => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/settings#inventory");
    }
    render(wrap(<SettingsPage />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Stock guards", level: 2 }),
      ).toBeTruthy(),
    );
    expect(
      screen.getByRole("heading", { name: "Audit & snapshots", level: 2 }),
    ).toBeTruthy();
  });

  it("Pricing tab renders Rounding and Defaults cards", async () => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/settings#pricing");
    }
    render(wrap(<SettingsPage />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Rounding & formatting", level: 2 }),
      ).toBeTruthy(),
    );
    expect(
      screen.getByRole("heading", {
        name: "Defaults for new bundles",
        level: 2,
      }),
    ).toBeTruthy();
  });

  it("Inventory PATCH sends inventory subobject (not nested under display/general)", async () => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/settings#inventory");
    }
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
          inventory?: Record<string, unknown>;
        };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...BASE_PAYLOAD,
            inventory: { ...BASE_PAYLOAD.inventory, ...(body.inventory ?? {}) },
          }),
        };
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { container } = render(wrap(<SettingsPage />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Stock guards", level: 2 }),
      ).toBeTruthy(),
    );

    // The threshold input defaults to "5" in INVENTORY_DEFAULTS.
    const thresholdInput = (
      Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="number"]'),
      ).find((i) => i.value === "5") ?? null
    );
    expect(thresholdInput).toBeTruthy();
    fireEvent.change(thresholdInput!, { target: { value: "12" } });

    // Click first Save button (Stock guards card).
    const saveBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Save");
    expect(saveBtn).toBeTruthy();
    saveBtn!.click();

    await waitFor(() => {
      const putCall = fetchSpy.mock.calls.find((c) => {
        const init = c[1] as RequestInit | undefined;
        if (!init || init.method !== "PUT") return false;
        const body = JSON.parse((init.body as string) ?? "{}");
        return body.inventory !== undefined;
      });
      expect(putCall).toBeTruthy();
      const body = JSON.parse(
        ((putCall![1] as RequestInit).body as string) ?? "{}",
      );
      expect(body.inventory.lowStockThreshold).toBe(12);
    });
  });

  it("safetyLock toggle on Inventory tab patches top-level (not under inventory)", async () => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/settings#inventory");
    }
    const fetchSpy = vi.fn(
      mockFetch(async (_input, init) => {
        if (!init || init.method === undefined || init.method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => BASE_PAYLOAD,
          };
        }
        const body = JSON.parse((init.body as string) ?? "{}");
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...BASE_PAYLOAD,
            ...(body.safetyLock !== undefined && { safetyLock: body.safetyLock }),
          }),
        };
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { container } = render(wrap(<SettingsPage />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Stock guards", level: 2 }),
      ).toBeTruthy(),
    );

    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement | null;
    expect(checkbox).toBeTruthy();
    fireEvent.click(checkbox!);

    await waitFor(() => {
      const putCall = fetchSpy.mock.calls.find((c) => {
        const init = c[1] as RequestInit | undefined;
        if (!init || init.method !== "PUT") return false;
        const body = JSON.parse((init.body as string) ?? "{}");
        return body.safetyLock !== undefined;
      });
      expect(putCall).toBeTruthy();
      const body = JSON.parse(
        ((putCall![1] as RequestInit).body as string) ?? "{}",
      );
      expect(body.safetyLock).toBe(true);
      // Crucially: NOT nested under inventory.
      expect(body.inventory).toBeUndefined();
    });
  });

  it("Cart tab renders Cart-mode and Checkout-protections cards", async () => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/settings#cart");
    }
    render(wrap(<SettingsPage />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Cart mode", level: 2 }),
      ).toBeTruthy(),
    );
    expect(
      screen.getByRole("heading", { name: "Checkout protections", level: 2 }),
    ).toBeTruthy();
  });

  it("Cart PATCH sends cart subobject (not nested elsewhere)", async () => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/settings#cart");
    }
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
          cart?: Record<string, unknown>;
        };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...BASE_PAYLOAD,
            cart: { ...BASE_PAYLOAD.cart, ...(body.cart ?? {}) },
          }),
        };
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { container } = render(wrap(<SettingsPage />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Cart mode", level: 2 }),
      ).toBeTruthy(),
    );

    // Cart mode select defaults to bundle_as_product (CART_DEFAULTS).
    const modeSelect = (
      Array.from(container.querySelectorAll<HTMLSelectElement>("select")).find(
        (s) => s.value === "bundle_as_product",
      ) ?? null
    );
    expect(modeSelect).toBeTruthy();
    fireEvent.change(modeSelect!, {
      target: { value: "components_as_attributes" },
    });

    const saveBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Save");
    expect(saveBtn).toBeTruthy();
    saveBtn!.click();

    await waitFor(() => {
      const putCall = fetchSpy.mock.calls.find((c) => {
        const init = c[1] as RequestInit | undefined;
        if (!init || init.method !== "PUT") return false;
        const body = JSON.parse((init.body as string) ?? "{}");
        return body.cart !== undefined;
      });
      expect(putCall).toBeTruthy();
      const body = JSON.parse(
        ((putCall![1] as RequestInit).body as string) ?? "{}",
      );
      expect(body.cart.defaultMode).toBe("components_as_attributes");
    });
  });

  it("Custom CSS card flags mismatched braces", async () => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/settings#display");
    }
    const { container } = render(wrap(<SettingsPage />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Custom CSS", level: 2 }),
      ).toBeTruthy(),
    );
    const cssTextarea = container.querySelector(
      "textarea",
    ) as HTMLTextAreaElement | null;
    expect(cssTextarea).toBeTruthy();
    fireEvent.change(cssTextarea!, {
      target: { value: ".bf-bundle { color: red;" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Mismatched braces" }),
      ).toBeTruthy(),
    );
  });
});
