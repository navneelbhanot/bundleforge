import { describe, it, expect } from "vitest";

import { parseCsv, parseCsvWithHeaders } from "./csv";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3\n4,5,6\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("handles quoted fields with commas", () => {
    expect(parseCsv('a,"b,c",d\n')).toEqual([["a", "b,c", "d"]]);
  });

  it("handles doubled quotes inside quoted fields", () => {
    expect(parseCsv('"a","say ""hi"""\n')).toEqual([["a", 'say "hi"']]);
  });

  it("handles CRLF and CR line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseCsv("a,b\r1,2\r")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("tolerates missing trailing newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("preserves empty cells", () => {
    expect(parseCsv("a,,c\n")).toEqual([["a", "", "c"]]);
  });
});

describe("parseCsvWithHeaders", () => {
  it("returns array of records keyed by header", () => {
    const recs = parseCsvWithHeaders('title,type\n"Box","fixed"\n');
    expect(recs).toEqual([{ title: "Box", type: "fixed" }]);
  });

  it("returns empty array on empty input", () => {
    expect(parseCsvWithHeaders("")).toEqual([]);
  });

  it("fills missing cells with empty string", () => {
    const recs = parseCsvWithHeaders("a,b,c\n1,2\n");
    expect(recs[0]).toEqual({ a: "1", b: "2", c: "" });
  });
});
