type SemesterForOrdering = {
  label: string;
  type: string;
  startDate?: Date | string | null;
  academicYear: { label: string };
};

function academicYearStart(label: string): number | null {
  const match = label.match(/^(\d{4})\s*\/\s*(\d{4})$/);
  return match ? Number(match[1]) : null;
}

function semesterPart(semester: SemesterForOrdering): number | null {
  const match = semester.label.match(/semester\s*(\d+)/i);
  if (match) return Number(match[1]);
  if (semester.type.toLowerCase() === "recess" || /recess/i.test(semester.label)) return 3;
  return null;
}

/** Returns a positive value when target is later than current. */
export function compareSemesterOrder(current: SemesterForOrdering, target: SemesterForOrdering): number | null {
  if (current.startDate && target.startDate) {
    const dateDifference = new Date(target.startDate).getTime() - new Date(current.startDate).getTime();
    if (dateDifference !== 0) return dateDifference;
  }

  const currentYear = academicYearStart(current.academicYear.label);
  const targetYear = academicYearStart(target.academicYear.label);
  const currentPart = semesterPart(current);
  const targetPart = semesterPart(target);
  if (currentYear === null || targetYear === null || currentPart === null || targetPart === null) return null;

  return (targetYear - currentYear) * 10 + (targetPart - currentPart);
}

export function isOlderSemester(current: SemesterForOrdering, target: SemesterForOrdering): boolean {
  return (compareSemesterOrder(current, target) ?? 0) < 0;
}