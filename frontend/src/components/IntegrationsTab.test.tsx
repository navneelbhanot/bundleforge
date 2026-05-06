import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { AppProvider } from "@shopify/polaris";

import { IntegrationsTab } from "./IntegrationsTab";

const i18n = { Polaris: { Common: { cancel: "Cancel", save: "Save" } } };

function wrap(node: React.ReactNode) {
  return <AppProvider i18n={i18n}>{node}</AppProvider>;
}

const ROWS = [
  {
    type: "shipstation",
    label: "ShipStation",
    kind: "push" as const,
    expectedCredKeys: ["apiKey", "apiSecret"],
    status: "active" as const,
    lastSyncedAt: null,
    errorMessage: null,
    credentialKeys: ["apiKey", "apiSecret"],
    settings: {},
  },
  {
    type: "klaviyo",
    label: "Klaviyo",
    kind: "push" as const,
    expectedCredKeys: ["privateKey"],
    status: "inactive" as const,
    lastSyncedAt: null,
    errorMessage: null,
    credentialKeys: [],
    settings: {},
  },
  {
    type: "google_merchant",
    label: "Google Merchant",
    kind: "feed" as const,
    expectedCredKeys: [],
    status: "inactive" as const,
    lastSyncedAt: null,
    errorMessage: null,
    credentialKeys: [],
    settings: {},
  },
];

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
) {
  return vi.fn(
    (input: string, init?: RequestInit) => responder(input, init) as never,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    mockFetch(async (_input, init) => {
      if (!init || init.method === undefined || init.method === "GET") {
        return { ok: true, status: 200, json: async () => ROWS };
      }
      // Default mutating responses — individual tests override.
      return { ok: true, status: 200, json: async () => ROWS[0] };
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("IntegrationsTab", () => {
  it("renders one card per known adapter with status badges", async () => {
    render(wrap(<IntegrationsTab />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "ShipStation", level: 3 }),
      ).toBeTruthy(),
    );
    expect(
      screen.getByRole("heading", { name: "Klaviyo", level: 3 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Google Merchant", level: 3 }),
    ).toBeTruthy();
    // Status copy: active row says Connected, inactive says Not connected.
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getAllByText("Not connected").length).toBeGreaterThan(0);
  });

  it("opens the Configure modal for a push adapter", async () => {
    const { container } = render(wrap(<IntegrationsTab />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "ShipStation", level: 3 }),
      ).toBeTruthy(),
    );
    const configureBtns = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).filter((b) => b.textContent?.trim() === "Configure");
    expect(configureBtns.length).toBeGreaterThan(0);
    configureBtns[0].click();
    await waitFor(() =>
      expect(screen.getByText("Configure ShipStation")).toBeTruthy(),
    );
  });

  it("Test connection POSTs to /:type/test with non-empty credentials only", async () => {
    const fetchSpy = mockFetch(async (_input, init) => {
      if (!init || init.method === undefined || init.method === "GET") {
        return { ok: true, status: 200, json: async () => ROWS };
      }
      if (init.method === "POST") {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      return { ok: true, status: 200, json: async () => ROWS[0] };
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { container } = render(wrap(<IntegrationsTab />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "ShipStation", level: 3 }),
      ).toBeTruthy(),
    );

    // Click Configure
    const configureBtns = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).filter((b) => b.textContent?.trim() === "Configure");
    configureBtns[0].click();
    await waitFor(() =>
      expect(screen.getByText("Configure ShipStation")).toBeTruthy(),
    );

    // Fill apiKey only, leave apiSecret blank.
    const passwordInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="password"]'),
    );
    expect(passwordInputs.length).toBe(2);
    fireEvent.change(passwordInputs[0], { target: { value: "ak-new" } });

    // Click Test connection (a secondary action — find by text).
    const testBtn = (
      Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
    ).find((b) => b.textContent?.trim() === "Test connection")!;
    testBtn.click();

    await waitFor(() => {
      const postCall = fetchSpy.mock.calls.find((c) => {
        const init = c[1] as RequestInit | undefined;
        return init?.method === "POST";
      });
      expect(postCall).toBeTruthy();
      const body = JSON.parse(
        ((postCall![1] as RequestInit).body as string) ?? "{}",
      );
      // apiSecret was empty — UI strips it before POSTing.
      expect(body.credentials).toEqual({ apiKey: "ak-new" });
    });
  });

  it("feed-only integrations show the M-167 wire-up note instead of Configure", async () => {
    render(wrap(<IntegrationsTab />));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Google Merchant", level: 3 }),
      ).toBeTruthy(),
    );
    expect(screen.getByText(/Feed URL surfaces in M-167/i)).toBeTruthy();
  });
});
