import { describe, expect, it } from "vitest";
import { nextParam } from "./index.js";

describe("nextParam", () => {
  it("keeps paths inside the app", () => {
    expect(nextParam({ next: "/orgs/1/notes" })).toBe("/orgs/1/notes");
    expect(nextParam({ next: "/accept-invitation?token=abc" })).toBe("/accept-invitation?token=abc");
  });

  it("rejects other sites and odd values", () => {
    for (const next of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", 42, undefined]) {
      expect(nextParam({ next })).toBe("/");
    }
  });
});
