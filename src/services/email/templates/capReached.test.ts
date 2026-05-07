import { describe, it, expect } from "vitest";

import { capReachedTemplate } from "./capReached";

describe("capReachedTemplate", () => {
  const args = {
    shopName: "Acme Co.",
    cap: 100,
    upgradeUrl: "https://app.bundleforge.app/settings#billing",
  };

  it("includes the cap and shop name in the subject", () => {
    const t = capReachedTemplate(args);
    expect(t.subject).toContain("Starter limit");
    expect(t.subject).toContain("Acme Co.");
  });

  it("communicates the storefront pause state", () => {
    const t = capReachedTemplate(args);
    expect(t.text).toMatch(/now paused/i);
    expect(t.html).toMatch(/now paused/i);
  });

  it("includes the upgrade URL in both bodies", () => {
    const t = capReachedTemplate(args);
    expect(t.html).toContain(args.upgradeUrl);
    expect(t.text).toContain(args.upgradeUrl);
  });

  it("escapes shop names with HTML special characters", () => {
    const t = capReachedTemplate({
      ...args,
      shopName: 'Acme & "Co."',
    });
    expect(t.html).toContain("Acme &amp; &quot;Co.&quot;");
  });
});
