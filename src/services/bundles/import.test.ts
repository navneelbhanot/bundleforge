import { describe, it, expect, vi } from "vitest";

vi.mock("./repository", () => ({
  bundleRepo: {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: "b" }),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
}));

import { importBundlesFromCsv } from "./import";
import { BundleService } from "./index";
import { bundleRepo } from "./repository";

const repo = bundleRepo as unknown as Record<string, ReturnType<typeof vi.fn>>;

const csvHeader =
  'title,type,description,items,rules\n';

function row(title: string, type: string, items: string, rules: string): string {
  return `"${title}","${type}","desc","${items.replace(/"/g, '""')}","${rules.replace(/"/g, '""')}"\n`;
}

describe("importBundlesFromCsv", () => {
  it("imports two valid rows (commit mode)", async () => {
    repo.create.mockClear();
    const csv =
      csvHeader +
      row(
        "Box A",
        "fixed",
        '[{"shopifyProductGid":"gid://1","title":"X","quantity":1}]',
        '[{"type":"fixed","value":5}]',
      ) +
      row(
        "Box B",
        "fixed",
        '[{"shopifyProductGid":"gid://2","title":"Y","quantity":1}]',
        '[]',
      );
    const result = await importBundlesFromCsv("shop", csv);
    expect(result.imported).toBe(2);
    expect(result.errors).toEqual([]);
    expect(repo.create).toHaveBeenCalledTimes(2);
  });

  it("captures per-row errors without aborting the batch", async () => {
    repo.create.mockClear();
    const csv =
      csvHeader +
      row("Bad", "fixed", "not-json", '[]') +
      row(
        "Good",
        "fixed",
        '[{"shopifyProductGid":"gid://2","title":"Y","quantity":1}]',
        '[]',
      );
    const result = await importBundlesFromCsv("shop", csv);
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(1);
    expect(result.errors[0].message).toMatch(/items is not valid JSON/);
  });

  it("dry-run does not call the service", async () => {
    const svc = { create: vi.fn() } as unknown as BundleService;
    const csv =
      csvHeader +
      row(
        "Box A",
        "fixed",
        '[{"shopifyProductGid":"gid://1","title":"X","quantity":1}]',
        '[{"type":"fixed","value":5}]',
      );
    const result = await importBundlesFromCsv("shop", csv, {
      dryRun: true,
      service: svc,
    });
    expect(result.imported).toBe(1);
    expect((svc.create as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("flags missing required columns", async () => {
    const csv = "type\nfixed\n";
    const result = await importBundlesFromCsv("shop", csv);
    expect(result.imported).toBe(0);
    expect(result.errors[0].message).toMatch(/missing required column/);
  });
});
