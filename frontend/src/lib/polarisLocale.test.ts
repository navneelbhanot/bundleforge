import { describe, it, expect } from "vitest";
import { polarisCodeFor } from "./polarisLocale";

describe("polarisCodeFor (M-186 polish)", () => {
  it("maps the simple cases identity", () => {
    expect(polarisCodeFor("en")).toBe("en");
    expect(polarisCodeFor("fr")).toBe("fr");
    expect(polarisCodeFor("ja")).toBe("ja");
    expect(polarisCodeFor("ko")).toBe("ko");
    expect(polarisCodeFor("nl")).toBe("nl");
    expect(polarisCodeFor("pl")).toBe("pl");
    expect(polarisCodeFor("sv")).toBe("sv");
    expect(polarisCodeFor("da")).toBe("da");
  });

  it("maps regional variants to Polaris's canonical pack names", () => {
    expect(polarisCodeFor("pt")).toBe("pt-BR");
    expect(polarisCodeFor("zh")).toBe("zh-CN");
    expect(polarisCodeFor("no")).toBe("nb");
  });

  it("falls back to English for locales Polaris doesn't ship", () => {
    expect(polarisCodeFor("ru")).toBe("en");
    expect(polarisCodeFor("xx")).toBe("en"); // unknown
    expect(polarisCodeFor("")).toBe("en");
  });
});
