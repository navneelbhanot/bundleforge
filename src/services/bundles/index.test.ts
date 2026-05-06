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

vi.mock("./activityRepo", () => {
  return {
    bundleActivityRepo: {
      append: vi.fn().mockResolvedValue({ id: "act-1" }),
      list: vi.fn(),
    },
  };
});

import { bundleRepo } from "./repository";
import { bundleActivityRepo } from "./activityRepo";
const mockedRepo = bundleRepo as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockedActivity = bundleActivityRepo as unknown as Record<string, ReturnType<typeof vi.fn>>;

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

describe("BundleService — inventoryRules (M-173)", () => {
  beforeEach(() => {
    Object.values(mockedRepo).forEach((m) => m.mockReset());
  });

  it("persists inventoryRules on create with all 5 fields", async () => {
    mockedRepo.create.mockResolvedValueOnce({ id: "b-i1" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "Holiday Box",
      type: "fixed",
      items: [],
      pricingRules: [],
      inventoryRules: {
        lowStockThreshold: 5,
        oversellPolicy: "prevent",
        lowStockAlertEnabled: true,
        pauseWhenComponentBelow: 3,
        componentOnlyMode: false,
      },
    });
    const args = mockedRepo.create.mock.calls[0][0];
    expect(args.data.inventoryRules).toMatchObject({
      lowStockThreshold: 5,
      oversellPolicy: "prevent",
      lowStockAlertEnabled: true,
      pauseWhenComponentBelow: 3,
      componentOnlyMode: false,
    });
  });

  it("rejects oversellPolicy outside the enum", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "x",
        type: "fixed",
        items: [],
        pricingRules: [],
        inventoryRules: {
          oversellPolicy: "yolo" as unknown as "prevent",
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects pauseWhenComponentBelow > 100000", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "x",
        type: "fixed",
        items: [],
        pricingRules: [],
        inventoryRules: { pauseWhenComponentBelow: 1_000_000 },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("update deep-merges — saving lowStockThreshold keeps componentOnlyMode", async () => {
    mockedRepo.findById.mockResolvedValueOnce({
      id: "b-1",
      title: "X",
      inventoryRules: {
        componentOnlyMode: true,
        oversellPolicy: "prevent",
      },
    });
    mockedRepo.update.mockResolvedValueOnce({ id: "b-1" });
    const svc = new BundleService();
    await svc.update("shop", "b-1", {
      inventoryRules: { lowStockThreshold: 7 },
    });
    const args = mockedRepo.update.mock.calls[0][0];
    expect(args.data.inventoryRules).toEqual({
      componentOnlyMode: true,
      oversellPolicy: "prevent",
      lowStockThreshold: 7,
    });
  });

  it("update treats null as 'remove this override'", async () => {
    mockedRepo.findById.mockResolvedValueOnce({
      id: "b-1",
      title: "X",
      inventoryRules: {
        oversellPolicy: "prevent",
        componentOnlyMode: true,
      },
    });
    mockedRepo.update.mockResolvedValueOnce({ id: "b-1" });
    const svc = new BundleService();
    await svc.update("shop", "b-1", {
      inventoryRules: {
        oversellPolicy: null,
      },
    });
    const args = mockedRepo.update.mock.calls[0][0];
    expect(args.data.inventoryRules).toEqual({ componentOnlyMode: true });
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

describe("BundleService — SEO fields (M-175)", () => {
  beforeEach(() => {
    Object.values(mockedRepo).forEach((m) => m.mockReset());
    Object.values(mockedActivity).forEach((m) => m.mockReset());
    mockedActivity.append.mockResolvedValue({ id: "act-1" });
  });

  it("persists seoTitle and seoDescription on create", async () => {
    mockedRepo.create.mockResolvedValueOnce({ id: "b-seo" });
    const svc = new BundleService();
    await svc.create("shop", {
      title: "Pack",
      type: "fixed",
      items: [],
      pricingRules: [],
      seoTitle: "Holiday Pack — Save 20%",
      seoDescription: "Curated holiday gift set with three crowd-pleasers.",
    });
    const args = mockedRepo.create.mock.calls[0][0];
    expect(args.data.seoTitle).toBe("Holiday Pack — Save 20%");
    expect(args.data.seoDescription).toBe(
      "Curated holiday gift set with three crowd-pleasers.",
    );
  });

  it("rejects seoTitle longer than 60 chars", async () => {
    const svc = new BundleService();
    await expect(
      svc.create("shop", {
        title: "x",
        type: "fixed",
        items: [],
        pricingRules: [],
        seoTitle: "x".repeat(61),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("update with empty string normalises to null", async () => {
    mockedRepo.findById.mockResolvedValueOnce({
      id: "b-1",
      title: "X",
      seoTitle: "previous",
    });
    mockedRepo.update.mockResolvedValueOnce({ id: "b-1" });
    const svc = new BundleService();
    await svc.update("shop", "b-1", { seoTitle: "" });
    const args = mockedRepo.update.mock.calls[0][0];
    expect(args.data.seoTitle).toBeNull();
  });

  it("update with SEO fields appends a 'seo_updated' activity entry", async () => {
    mockedRepo.findById.mockResolvedValueOnce({
      id: "b-1",
      title: "X",
    });
    mockedRepo.update.mockResolvedValueOnce({ id: "b-1" });
    const svc = new BundleService();
    await svc.update("shop", "b-1", {
      seoTitle: "New SEO title",
    });
    expect(mockedActivity.append).toHaveBeenCalledTimes(1);
    expect(mockedActivity.append.mock.calls[0][0].action).toBe("seo_updated");
  });
});

describe("BundleService — activity log writers (M-174)", () => {
  beforeEach(() => {
    Object.values(mockedRepo).forEach((m) => m.mockReset());
    Object.values(mockedActivity).forEach((m) => m.mockReset());
    mockedActivity.append.mockResolvedValue({ id: "act-1" });
  });

  it("publish() appends a 'published' activity entry", async () => {
    mockedRepo.findById.mockResolvedValueOnce({ id: "b-1" });
    mockedRepo.update.mockResolvedValueOnce({ id: "b-1", status: "active" });
    const svc = new BundleService();
    await svc.publish("shop", "b-1");
    expect(mockedActivity.append).toHaveBeenCalledTimes(1);
    expect(mockedActivity.append.mock.calls[0][0].action).toBe("published");
  });

  it("archive() appends an 'archived' activity entry", async () => {
    mockedRepo.findById.mockResolvedValueOnce({ id: "b-1" });
    mockedRepo.update.mockResolvedValueOnce({ id: "b-1", status: "archived" });
    const svc = new BundleService();
    await svc.archive("shop", "b-1");
    expect(mockedActivity.append).toHaveBeenCalledTimes(1);
    expect(mockedActivity.append.mock.calls[0][0].action).toBe("archived");
  });

  it("update() with displaySettings + eligibility appends two entries", async () => {
    mockedRepo.findById.mockResolvedValueOnce({
      id: "b-1",
      title: "X",
      displaySettings: {},
      eligibility: {},
    });
    mockedRepo.update.mockResolvedValueOnce({ id: "b-1" });
    const svc = new BundleService();
    await svc.update("shop", "b-1", {
      displaySettings: { layout: "grid" },
      eligibility: { customerTagsAllow: ["vip"] },
    });
    expect(mockedActivity.append).toHaveBeenCalledTimes(2);
    const actions = mockedActivity.append.mock.calls.map((c) => c[0].action);
    expect(actions).toContain("display_updated");
    expect(actions).toContain("eligibility_updated");
  });

  it("logging failure does not propagate to the caller", async () => {
    mockedRepo.findById.mockResolvedValueOnce({ id: "b-1" });
    mockedRepo.update.mockResolvedValueOnce({ id: "b-1", status: "active" });
    mockedActivity.append.mockRejectedValueOnce(new Error("DB down"));
    const svc = new BundleService();
    // Must resolve, not reject.
    await expect(svc.publish("shop", "b-1")).resolves.toBeTruthy();
  });
});
