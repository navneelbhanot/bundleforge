import { describe, it, expect, vi, beforeEach } from "vitest";

import { BundleService, slugify } from "./index";
import { NotFoundError, ValidationError } from "../../middleware/errors";

vi.mock("./repository", () => {
  return {
    bundleRepo: {
      list: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    },
  };
});

import { bundleRepo } from "./repository";
const mockedRepo = bundleRepo as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe("slugify", () => {
  it("normalizes spaces and special chars", () => {
    expect(slugify("Summer Starter Kit")).toBe("summer-starter-kit");
    expect(slugify("  Hello!! World??")).toBe("hello-world");
    expect(slugify("Café & Cookies")).toBe("caf-cookies");
  });

  it("returns empty for non-alphanumeric", () => {
    expect(slugify("???")).toBe("");
  });
});

describe("BundleService.list", () => {
  beforeEach(() => {
    Object.values(mockedRepo).forEach((m) => m.mockReset());
  });

  it("clamps page/limit and returns paginated shape", async () => {
    mockedRepo.list.mockResolvedValueOnce({ data: [], total: 0 });
    const svc = new BundleService();
    const r = await svc.list("shop", { page: 0, limit: 9999 }, {});
    expect(r.pagination.page).toBe(1); // clamped to 1 minimum
    expect(r.pagination.limit).toBe(100); // clamped to 100 max
    expect(r.pagination.total).toBe(0);
    expect(mockedRepo.list).toHaveBeenCalledWith(
      "shop",
      expect.objectContaining({ page: 1, limit: 100, sortOrder: "desc" }),
      {},
    );
  });

  it("falls back to createdAt for unknown sortBy (no SQL injection)", async () => {
    mockedRepo.list.mockResolvedValueOnce({ data: [], total: 0 });
    const svc = new BundleService();
    await svc.list("shop", { sortBy: "drop_table" }, {});
    expect(mockedRepo.list).toHaveBeenCalledWith(
      "shop",
      expect.objectContaining({ sortBy: "createdAt" }),
      {},
    );
  });
});

describe("BundleService.create", () => {
  beforeEach(() => {
    Object.values(mockedRepo).forEach((m) => m.mockReset());
  });

  it("validates title + type + config and calls repo.create", async () => {
    mockedRepo.create.mockResolvedValueOnce({ id: "b-1" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "Pack of 3",
      type: "multipack",
      config: { packQuantity: 3 },
      items: [],
      pricingRules: [],
    });
    expect(mockedRepo.create).toHaveBeenCalledTimes(1);
    const args = mockedRepo.create.mock.calls[0][0];
    expect(args.data.shopId).toBe("shop");
    expect(args.data.slug).toBe("pack-of-3");
    expect(args.data.type).toBe("multipack");
  });

  it("rejects unknown type", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "x",
        type: "nonexistent" as unknown as "fixed",
        items: [],
        pricingRules: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects empty title", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "",
        type: "fixed",
        items: [],
        pricingRules: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects title that produces empty slug", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "???",
        type: "fixed",
        items: [],
        pricingRules: [],
      }),
    ).rejects.toThrow(/empty slug/);
  });

  it("propagates Zod errors for invalid per-type config", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "p",
        type: "multipack",
        config: { packQuantity: 0 },
        items: [],
        pricingRules: [],
      }),
    ).rejects.toThrow();
  });

  it("persists scheduleSettings on create (M-170)", async () => {
    mockedRepo.create.mockResolvedValueOnce({ id: "b-2" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "Holiday",
      type: "fixed",
      items: [],
      pricingRules: [],
      scheduleSettings: {
        timezone: "America/Los_Angeles",
        recurringRule: {
          type: "weekly",
          daysOfWeek: [5, 6],
          startTime: "09:00",
          endTime: "23:59",
        },
        endBehavior: "archive",
      },
    });
    const args = mockedRepo.create.mock.calls[0][0];
    expect(args.data.scheduleSettings).toMatchObject({
      timezone: "America/Los_Angeles",
      endBehavior: "archive",
    });
  });

  it("rejects scheduleSettings.endBehavior with an unknown value (M-170)", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "x",
        type: "fixed",
        items: [],
        pricingRules: [],
        scheduleSettings: {
          endBehavior: "burn-it-down" as unknown as "archive",
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects daysOfWeek without weekly type (M-170)", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "x",
        type: "fixed",
        items: [],
        pricingRules: [],
        scheduleSettings: {
          recurringRule: { type: "daily", daysOfWeek: [1, 2] },
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects endsAt before startsAt (M-170)", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "x",
        type: "fixed",
        items: [],
        pricingRules: [],
        startsAt: "2026-12-25T00:00:00Z",
        endsAt: "2026-12-24T00:00:00Z",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("BundleService — displaySettings (M-171)", () => {
  beforeEach(() => {
    Object.values(mockedRepo).forEach((m) => m.mockReset());
  });

  it("persists displaySettings on create with all six fields", async () => {
    mockedRepo.create.mockResolvedValueOnce({ id: "b-d1" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "Visual override",
      type: "fixed",
      items: [],
      pricingRules: [],
      displaySettings: {
        layout: "carousel",
        colorPreset: "high-contrast",
        imagePreference: "bundle_hero",
        addToCartCopy: "Grab the box",
        soldOutBehavior: "waitlist",
        cssOverride: ".bf-bundle{font-weight:700}",
      },
    });
    const args = mockedRepo.create.mock.calls[0][0];
    expect(args.data.displaySettings).toMatchObject({
      layout: "carousel",
      colorPreset: "high-contrast",
      imagePreference: "bundle_hero",
      addToCartCopy: "Grab the box",
      soldOutBehavior: "waitlist",
    });
  });

  it("rejects displaySettings.layout with an unknown enum value", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "x",
        type: "fixed",
        items: [],
        pricingRules: [],
        displaySettings: { layout: "tablet" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects displaySettings.cssOverride > 8000 chars", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "x",
        type: "fixed",
        items: [],
        pricingRules: [],
        displaySettings: { cssOverride: "x".repeat(8001) },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects displaySettings.addToCartCopy that is empty or > 40 chars", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "x",
        type: "fixed",
        items: [],
        pricingRules: [],
        displaySettings: { addToCartCopy: "" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      svc.create("shop", {
        title: "x",
        type: "fixed",
        items: [],
        pricingRules: [],
        displaySettings: { addToCartCopy: "z".repeat(41) },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("update deep-merges displaySettings — saving colorPreset alone keeps layout", async () => {
    mockedRepo.findById.mockResolvedValueOnce({
      id: "b-1",
      title: "X",
      displaySettings: { layout: "carousel", colorPreset: "brand" },
    });
    mockedRepo.update.mockResolvedValueOnce({ id: "b-1" });
    const svc = new BundleService();
    await svc.update("shop", "b-1", {
      displaySettings: { colorPreset: "high-contrast" },
    });
    const args = mockedRepo.update.mock.calls[0][0];
    expect(args.data.displaySettings).toEqual({
      layout: "carousel",
      colorPreset: "high-contrast",
    });
  });

  it("update treats null as 'remove this override' (use shop default)", async () => {
    mockedRepo.findById.mockResolvedValueOnce({
      id: "b-1",
      title: "X",
      displaySettings: {
        layout: "carousel",
        colorPreset: "high-contrast",
      },
    });
    mockedRepo.update.mockResolvedValueOnce({ id: "b-1" });
    const svc = new BundleService();
    await svc.update("shop", "b-1", {
      displaySettings: { layout: null as unknown as undefined },
    });
    const args = mockedRepo.update.mock.calls[0][0];
    expect(args.data.displaySettings).toEqual({
      colorPreset: "high-contrast",
    });
  });
});

describe("BundleService — eligibility (M-172)", () => {
  beforeEach(() => {
    Object.values(mockedRepo).forEach((m) => m.mockReset());
  });

  it("persists eligibility on create", async () => {
    mockedRepo.create.mockResolvedValueOnce({ id: "b-e1" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "VIP-only",
      type: "fixed",
      items: [],
      pricingRules: [],
      eligibility: {
        customerTagsAllow: ["vip"],
        customerTagsDeny: ["wholesale"],
        requireLogin: true,
        markets: ["US", "CA"],
        locales: ["en", "fr"],
      },
    });
    const args = mockedRepo.create.mock.calls[0][0];
    expect(args.data.eligibility).toMatchObject({
      customerTagsAllow: ["vip"],
      customerTagsDeny: ["wholesale"],
      requireLogin: true,
      markets: ["US", "CA"],
      locales: ["en", "fr"],
    });
  });

  it("rejects unsupported locale", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "x",
        type: "fixed",
        items: [],
        pricingRules: [],
        eligibility: { locales: ["klingon"] },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects market codes that aren't 2-letter uppercase ISO", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "x",
        type: "fixed",
        items: [],
        pricingRules: [],
        eligibility: { markets: ["United States"] },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      svc.create("shop", {
        title: "x",
        type: "fixed",
        items: [],
        pricingRules: [],
        eligibility: { markets: ["us"] },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects > 50 customer tags", async () => {
    const svc = new BundleService();
    const tooMany = Array.from({ length: 51 }, (_, i) => `t${i}`);
    await expect(
      svc.create("shop", {
        title: "x",
        type: "fixed",
        items: [],
        pricingRules: [],
        eligibility: { customerTagsAllow: tooMany },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("update deep-merges eligibility — saving customerTagsAllow keeps markets", async () => {
    mockedRepo.findById.mockResolvedValueOnce({
      id: "b-1",
      title: "X",
      eligibility: {
        markets: ["US"],
        requireLogin: true,
      },
    });
    mockedRepo.update.mockResolvedValueOnce({ id: "b-1" });
    const svc = new BundleService();
    await svc.update("shop", "b-1", {
      eligibility: { customerTagsAllow: ["vip"] },
    });
    const args = mockedRepo.update.mock.calls[0][0];
    expect(args.data.eligibility).toEqual({
      markets: ["US"],
      requireLogin: true,
      customerTagsAllow: ["vip"],
    });
  });

  it("update treats null as 'remove this restriction'", async () => {
    mockedRepo.findById.mockResolvedValueOnce({
      id: "b-1",
      title: "X",
      eligibility: {
        markets: ["US", "CA"],
        requireLogin: true,
      },
    });
    mockedRepo.update.mockResolvedValueOnce({ id: "b-1" });
    const svc = new BundleService();
    await svc.update("shop", "b-1", {
      eligibility: { markets: null as unknown as undefined },
    });
    const args = mockedRepo.update.mock.calls[0][0];
    expect(args.data.eligibility).toEqual({ requireLogin: true });
  });
});

describe("BundleService.update — scheduleSettings (M-170)", () => {
  beforeEach(() => {
    Object.values(mockedRepo).forEach((m) => m.mockReset());
  });

  it("deep-merges scheduleSettings — saving timezone alone keeps recurringRule", async () => {
    mockedRepo.findById.mockResolvedValueOnce({
      id: "b-1",
      title: "X",
      scheduleSettings: {
        timezone: "UTC",
        recurringRule: {
          type: "weekly",
          daysOfWeek: [5, 6],
        },
        endBehavior: "pause",
      },
    });
    mockedRepo.update.mockResolvedValueOnce({ id: "b-1" });
    const svc = new BundleService();
    await svc.update("shop", "b-1", {
      scheduleSettings: { timezone: "America/Los_Angeles" },
    });
    const args = mockedRepo.update.mock.calls[0][0];
    expect(args.data.scheduleSettings).toEqual({
      timezone: "America/Los_Angeles",
      recurringRule: {
        type: "weekly",
        daysOfWeek: [5, 6],
      },
      endBehavior: "pause",
    });
  });

  it("validates schedule on update too", async () => {
    mockedRepo.findById.mockResolvedValueOnce({ id: "b-1", scheduleSettings: {} });
    const svc = new BundleService();
    await expect(
      svc.update("shop", "b-1", {
        scheduleSettings: {
          recurringRule: { type: "monthly", dayOfMonth: 99 },
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("BundleService.getById", () => {
  beforeEach(() => {
    Object.values(mockedRepo).forEach((m) => m.mockReset());
  });

  it("throws NotFoundError when missing", async () => {
    mockedRepo.findById.mockResolvedValueOnce(null);
    const svc = new BundleService();
    await expect(svc.getById("shop", "b-1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns bundle when found", async () => {
    mockedRepo.findById.mockResolvedValueOnce({ id: "b-1", title: "X" });
    const svc = new BundleService();
    const r = (await svc.getById("shop", "b-1")) as { id: string };
    expect(r.id).toBe("b-1");
  });
});

describe("BundleService.duplicate (M-050)", () => {
  beforeEach(() => {
    Object.values(mockedRepo).forEach((m) => m.mockReset());
  });

  it("clones with title (Copy) and copies items/rules", async () => {
    mockedRepo.findById.mockResolvedValueOnce({
      title: "Source",
      type: "fixed",
      description: null,
      config: {},
      displaySettings: {},
      items: [
        {
          shopifyProductGid: "gid://Product/1",
          shopifyVariantGid: null,
          title: "P1",
          sku: "S",
          quantity: 1,
          isRequired: true,
          isDefault: false,
          position: 0,
          groupName: null,
          minQuantity: 0,
          maxQuantity: null,
          priceOverride: null,
        },
      ],
      pricingRules: [
        {
          type: "fixed",
          value: { toString: () => "5.00" },
          minQuantity: 1,
          maxQuantity: null,
          minCartValue: null,
          conditions: {},
          priority: 0,
          isStackable: false,
          startsAt: null,
          endsAt: null,
        },
      ],
    });
    mockedRepo.create.mockResolvedValueOnce({ id: "new-id" });
    const svc = new BundleService();
    await svc.duplicate("shop", "src-id");
    const args = mockedRepo.create.mock.calls[0][0];
    expect(args.data.title).toBe("Source (Copy)");
    expect(args.data.slug).toBe("source-copy");
  });
});

describe("BundleService.publish (M-051)", () => {
  beforeEach(() => {
    Object.values(mockedRepo).forEach((m) => m.mockReset());
  });

  it("verifies existence and updates status to active", async () => {
    mockedRepo.findById.mockResolvedValueOnce({ id: "b-1" });
    mockedRepo.update.mockResolvedValueOnce({ id: "b-1", status: "active" });
    const svc = new BundleService();
    await svc.publish("shop", "b-1");
    expect(mockedRepo.update.mock.calls[0][0].data.status).toBe("active");
  });
});

describe("BundleService.archive (M-052)", () => {
  beforeEach(() => {
    Object.values(mockedRepo).forEach((m) => m.mockReset());
  });

  it("updates status to archived", async () => {
    mockedRepo.findById.mockResolvedValueOnce({ id: "b-1" });
    mockedRepo.update.mockResolvedValueOnce({ id: "b-1", status: "archived" });
    const svc = new BundleService();
    await svc.archive("shop", "b-1");
    expect(mockedRepo.update.mock.calls[0][0].data.status).toBe("archived");
  });
});

describe("BundleService.softDelete", () => {
  beforeEach(() => {
    Object.values(mockedRepo).forEach((m) => m.mockReset());
  });

  it("verifies existence then calls repo.softDelete", async () => {
    mockedRepo.findById.mockResolvedValueOnce({ id: "b-1" });
    mockedRepo.softDelete.mockResolvedValueOnce({ id: "b-1" });
    const svc = new BundleService();
    await svc.softDelete("shop", "b-1");
    expect(mockedRepo.softDelete).toHaveBeenCalledWith("b-1");
  });
});
