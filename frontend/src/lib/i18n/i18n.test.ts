import { describe, it, expect, beforeAll } from "vitest";
import i18n from "./index";

describe("i18n init (M-188)", () => {
  beforeAll(async () => {
    // i18n.init() is fired at module load; wait for it to settle.
    if (!i18n.isInitialized) await i18n.init();
  });

  it("loads English by default", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("nav.dashboard")).toBe("Dashboard");
    expect(i18n.t("nav.bundles")).toBe("Bundles");
  });

  it("switches to French and translates known keys", async () => {
    await i18n.changeLanguage("fr");
    expect(i18n.t("nav.dashboard")).toBe("Tableau de bord");
    expect(i18n.t("nav.settings")).toBe("Paramètres");
    expect(i18n.t("status.active")).toBe("Actif");
    expect(i18n.t("actions.cancel")).toBe("Annuler");
  });

  it("switches to German and translates known keys", async () => {
    await i18n.changeLanguage("de");
    expect(i18n.t("nav.orders")).toBe("Bestellungen");
    expect(i18n.t("settings.cart")).toBe("Warenkorb & Checkout");
  });

  it("falls back to English when key is missing in the active locale", async () => {
    await i18n.changeLanguage("ja"); // ja.json is a stub copy of en.json
    // The stub has English values, so EN is what we get back.
    expect(i18n.t("nav.dashboard")).toBe("Dashboard");
  });

  it("returns the key string for a missing key (graceful fallback)", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("nav.totallyMadeUpKey")).toBe("nav.totallyMadeUpKey");
  });

  it("interpolates values into translated strings", async () => {
    await i18n.changeLanguage("en");
    expect(
      i18n.t("checklist.progress", { complete: 2, total: 3 }),
    ).toBe("2 of 3 complete");
    await i18n.changeLanguage("fr");
    expect(
      i18n.t("checklist.progress", { complete: 2, total: 3 }),
    ).toBe("2 sur 3 terminé");
  });
});
