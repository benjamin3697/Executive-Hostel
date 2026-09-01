/**
 * Registration numbers are exactly 10 digits, with the first 2 digits
 * being the two-digit year the student joined the university (the
 * "cohort") - e.g. "2301600084" means cohort 2023.
 */
export const REGISTRATION_NUMBER_REGEX = /^\d{10}$/;

export function isValidRegistrationNumber(regNo: string): boolean {
  return REGISTRATION_NUMBER_REGEX.test(regNo);
}

/**
 * Extracts the 4-digit cohort year from a registration number, e.g.
 * "2301600084" -> 2023. Returns null for anything not matching the
 * expected 10-digit format (rather than guessing).
 */
export function getCohortYear(registrationNumber: string): number | null {
  if (!isValidRegistrationNumber(registrationNumber)) return null;
  return 2000 + parseInt(registrationNumber.slice(0, 2), 10);
}
