import { describe, it, expect } from "vitest";

import { capWarningTemplate } from "./capWarning";

describe("capWarningTemplate", () => {
  const args = {
    shopName: "Acme Co.",
    count: 80,
    cap: 100,
    upgradeUrl: "https://app.mintbundle.app/settings#billing",
  };

  it("includes the count and cap in the subject", () => {
    const t = capWarningTemplate(args);
    expect(t.subject).toContain("80 of 100");
    expect(t.subject).toContain("Acme Co.");
  });

  it("includes the upgrade URL in both html and text bodies", () => {
    const t = capWarningTemplate(args);
    expect(t.html).toContain("https://app.mintbundle.app/settings#billing");
    expect(t.text).toContain("https://app.mintbundle.app/settings#billing");
  });

  it("escapes shop names with HTML special characters", () => {
    const t = capWarningTemplate({
      ...args,
      shopName: 'Acme <script>alert("xss")</script>',
    });
    expect(t.html).not.toContain("<script>");
    expect(t.html).toContain("&lt;script&gt;");
  });

  it("computes remaining = cap - count", () => {
    const t = capWarningTemplate({ ...args, count: 95 });
    expect(t.text).toMatch(/about 5 bundle\s+orders left/);
  });

  it("clamps remaining to 0 when count exceeds cap", () => {
    const t = capWarningTemplate({ ...args, count: 110 });
    expect(t.text).toMatch(/about 0 bundle/);
  });
});
