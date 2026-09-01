import { describe, it, expect } from "vitest";
import { summarizeBalance } from "../src/services/payment.service";

describe("summarizeBalance", () => {
  it("matches the docs' worked example (Section 21)", () => {
    const result = summarizeBalance(650000, [{ status: "verified", amount: 400000 }]);
    expect(result.balance).toBe(250000);
    expect(result.status).toBe("partially_paid");
  });

  it("never lets a pending payment affect the balance", () => {
    const result = summarizeBalance(650000, [
      { status: "verified", amount: 400000 },
      { status: "pending", amount: 100000 },
    ]);
    expect(result.balance).toBe(250000); // NOT 150000
    expect(result.pendingAmount).toBe(100000);
  });

  it("treats clarification_requested the same as pending", () => {
    const result = summarizeBalance(500000, [{ status: "clarification_requested", amount: 200000 }]);
    expect(result.balance).toBe(500000);
    expect(result.pendingAmount).toBe(200000);
  });

  it("marks fully_paid at exact fee amount", () => {
    const result = summarizeBalance(500000, [{ status: "verified", amount: 500000 }]);
    expect(result.status).toBe("fully_paid");
    expect(result.balance).toBe(0);
  });

  it("never goes negative on overpayment", () => {
    const result = summarizeBalance(500000, [{ status: "verified", amount: 520000 }]);
    expect(result.balance).toBe(0);
    expect(result.status).toBe("fully_paid");
  });

  it("ignores rejected payments entirely", () => {
    const result = summarizeBalance(500000, [{ status: "rejected", amount: 500000 }]);
    expect(result.verifiedPaid).toBe(0);
    expect(result.pendingAmount).toBe(0);
    expect(result.status).toBe("outstanding");
  });

  it("returns null balance/no_active_accommodation when there's no fee (no room assigned)", () => {
    const result = summarizeBalance(null, []);
    expect(result.balance).toBeNull();
    expect(result.status).toBe("no_active_accommodation");
  });

  it("sums multiple verified payments correctly", () => {
    const result = summarizeBalance(650000, [
      { status: "verified", amount: 300000 },
      { status: "verified", amount: 100000 },
      { status: "rejected", amount: 999999 }, // must not count
    ]);
    expect(result.verifiedPaid).toBe(400000);
    expect(result.balance).toBe(250000);
  });
});
