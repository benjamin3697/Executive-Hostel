import { describe, it, expect } from "vitest";
import { normalizeUgandanPhone } from "../src/lib/sms";

describe("normalizeUgandanPhone", () => {
  it("converts local format (0XXXXXXXXX) to E.164", () => {
    expect(normalizeUgandanPhone("0700123456")).toBe("+256700123456");
  });

  it("leaves already-international numbers unchanged", () => {
    expect(normalizeUgandanPhone("+256700123456")).toBe("+256700123456");
  });

  it("adds a + to a bare country-code-prefixed number", () => {
    expect(normalizeUgandanPhone("256700123456")).toBe("+256700123456");
  });

  it("strips spaces and punctuation before normalizing", () => {
    expect(normalizeUgandanPhone("0700 123 456")).toBe("+256700123456");
    expect(normalizeUgandanPhone("(0700) 123-456")).toBe("+256700123456");
  });

  it("passes through unrecognized formats rather than guessing wrong", () => {
    expect(normalizeUgandanPhone("12345")).toBe("12345");
  });
});
