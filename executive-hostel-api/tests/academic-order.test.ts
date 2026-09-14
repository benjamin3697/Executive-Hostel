import { describe, expect, it } from "vitest";
import { isOlderSemester } from "../src/services/academic.service";

const semester = (year: string, label: string, type: "regular" | "recess" = "regular") => ({
  academicYear: { label: year },
  label,
  type,
});

describe("semester ordering", () => {
  it("blocks moving from Semester 2 back to Semester 1 in the same academic year", () => {
    expect(isOlderSemester(semester("2026/2027", "Semester 2"), semester("2026/2027", "Semester 1"))).toBe(true);
  });

  it("allows moving to the next academic semester", () => {
    expect(isOlderSemester(semester("2026/2027", "Semester 2"), semester("2027/2028", "Semester 1"))).toBe(false);
  });

  it("orders recess after the regular semesters", () => {
    expect(isOlderSemester(semester("2026/2027", "Recess", "recess"), semester("2026/2027", "Semester 2"))).toBe(true);
  });
});