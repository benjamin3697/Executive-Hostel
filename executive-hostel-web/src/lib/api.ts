// In production, set VITE_API_BASE_URL to your deployed API's URL (e.g.
// https://api.executivehostel.example). In dev, Vite's proxy (vite.config.ts)
// forwards /api to localhost:4000, so this can stay empty.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

const ACCESS_TOKEN_KEY = "hostel_access_token";
const REFRESH_TOKEN_KEY = "hostel_refresh_token";
const ROLE_KEY = "hostel_role";

export function getStoredAuth() {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
    role: localStorage.getItem(ROLE_KEY),
  };
}

export function storeAuth(accessToken: string, refreshToken: string, role: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(ROLE_KEY, role);
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = getStoredAuth();
  if (!refreshToken) return null;

  // Coalesce concurrent 401s into a single refresh call rather than firing
  // one refresh request per failed request.
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          clearAuth();
          return null;
        }
        const data = await res.json();
        const { role } = getStoredAuth();
        storeAuth(data.accessToken, data.refreshToken, role ?? "");
        return data.accessToken as string;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

/**
 * The single place every API call goes through. Attaches the bearer token,
 * transparently retries once after a token refresh on 401, and normalizes
 * error responses to ApiError so callers can check `.code` (matches the
 * { error: { code, message } } shape every backend route uses).
 */
export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { accessToken } = getStoredAuth();
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString().replace(window.location.origin, ""), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) return apiFetch<T>(path, options, true);
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? "UNKNOWN", data?.error?.message ?? "Something went wrong.");
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Typed convenience calls for the endpoints the frontend actually uses.
// Add more here as you build more pages, rather than calling apiFetch
// directly from components - keeps the API surface in one file.
// ---------------------------------------------------------------------------

export const api = {
  login: (identifier: string, password: string) =>
    apiFetch<{ accessToken: string; refreshToken: string; role: string }>("/api/v1/auth/login", {
      method: "POST",
      body: { identifier, password },
    }),

  register: (payload: { fullName: string; registrationNumber: string; email?: string; phone?: string; password: string }) =>
    apiFetch("/api/v1/auth/register", { method: "POST", body: payload }),

  requestPasswordReset: (identifier: string) =>
    apiFetch<{ message: string }>("/api/v1/auth/password-reset/request", { method: "POST", body: { identifier } }),
  confirmPasswordReset: (token: string, newPassword: string) =>
    apiFetch<{ message: string }>("/api/v1/auth/password-reset/confirm", { method: "POST", body: { token, newPassword } }),

  logout: async () => {
    const { refreshToken } = getStoredAuth();
    if (refreshToken) {
      await apiFetch("/api/v1/auth/logout", { method: "POST", body: { refreshToken } }).catch(() => {});
    }
    clearAuth();
  },

  // ---- Profile ----
  me: () => apiFetch<Me>("/api/v1/me"),
  updateProfile: (payload: Partial<{ phone: string; email: string; course: string; yearOfStudy: number; homeDistrict: string; emergencyContactName: string; emergencyContactPhone: string }>) =>
    apiFetch("/api/v1/me/profile", { method: "PATCH", body: payload }),
  studentDashboard: () => apiFetch<StudentDashboard>("/api/v1/me/dashboard"),

  // ---- Rooms ----
  rooms: (query: { section?: string; type?: string; status?: string }) =>
    apiFetch<Room[]>("/api/v1/rooms", { query }),
  availableRooms: (section?: string) =>
    apiFetch<{ id: string; section: string; roomNumber: string; roomType: string; status: string }[]>("/api/v1/rooms/available", { query: { section } }),
  assignRoom: (roomId: string, studentId: string) =>
    apiFetch(`/api/v1/rooms/${roomId}/assign`, { method: "POST", body: { studentId } }),
  checkInStudent: (roomId: string, studentId: string) =>
    apiFetch(`/api/v1/rooms/${roomId}/checkin`, { method: "POST", body: { studentId } }),
  checkOutStudent: (roomId: string, studentId: string, payload: { reason?: string; outstandingBalance?: number }) =>
    apiFetch(`/api/v1/rooms/${roomId}/checkout`, { method: "POST", body: { studentId, ...payload } }),

  // ---- Students (admin) ----
  students: (query: { q?: string; status?: string; section?: string; roomType?: string; year?: number; course?: string; semesterId?: string; paymentStatus?: string; page?: number; pageSize?: number }) =>
    apiFetch<{ total: number; students: StudentRow[] }>("/api/v1/students", { query }),
  student: (id: string) => apiFetch<StudentDetail>(`/api/v1/students/${id}`),
  enrollStudent: (id: string, payload: { semesterId: string; course?: string; yearOfStudy?: number }) =>
    apiFetch(`/api/v1/students/${id}/enroll`, { method: "POST", body: payload }),
  enrollActiveStudents: (semesterId: string) =>
    apiFetch<{ enrolledCount: number; semester: { id: string; label: string; academicYear: string } }>("/api/v1/students/enroll-bulk", { method: "POST", body: { semesterId } }),
  lockouts: () => apiFetch<LockedAccount[]>("/api/v1/admin/users/lockouts"),
  unlockAccount: (id: string) => apiFetch(`/api/v1/admin/users/${id}/unlock`, { method: "PATCH" }),

  // ---- Fees ----
  currentFees: () => apiFetch<{ roomType: string; roomTypeId: string; amount: number | null; effectiveDate: string | null }[]>("/api/v1/fees/current"),
  feeHistory: (roomTypeId?: string) => apiFetch<FeeRow[]>("/api/v1/fees/history", { query: { roomTypeId } }),
  createFee: (payload: { roomTypeId: string; amount: number; semesterId?: string; academicYearId?: string; effectiveDate?: string }) =>
    apiFetch("/api/v1/fees", { method: "POST", body: payload }),

  // ---- Academic calendar (years/semesters) - drives semester-scoped fees
  // and student enrollment (docs update: a year has 2 regular semesters
  // plus a recess semester, each potentially priced differently) ----
  academicYears: () => apiFetch<AcademicYearRow[]>("/api/v1/academic-years"),
  createAcademicYear: (label: string) => apiFetch<AcademicYearRow>("/api/v1/academic-years", { method: "POST", body: { label } }),
  semesters: (academicYearId?: string) => apiFetch<SemesterRow[]>("/api/v1/semesters", { query: { academicYearId } }),
  createSemester: (payload: { academicYearId: string; label: string; type: "regular" | "recess" }) =>
    apiFetch<SemesterRow>("/api/v1/semesters", { method: "POST", body: payload }),

  // ---- Payments ----
  pendingPayments: () =>
    apiFetch<{ total: number; payments: Payment[] }>("/api/v1/payments", { query: { status: "pending" } }),
  allPayments: (query: { status?: string; page?: number }) =>
    apiFetch<{ total: number; payments: Payment[] }>("/api/v1/payments", { query }),
  verifyPayment: (id: string) => apiFetch(`/api/v1/payments/${id}/verify`, { method: "POST" }),
  rejectPayment: (id: string, reason: string) =>
    apiFetch(`/api/v1/payments/${id}/reject`, { method: "POST", body: { reason } }),
  requestClarification: (id: string, message: string) =>
    apiFetch(`/api/v1/payments/${id}/request-clarification`, { method: "POST", body: { message } }),
  correctPayment: (id: string, reason: string, newAmount: number) =>
    apiFetch(`/api/v1/payments/${id}/correct`, { method: "POST", body: { reason, newAmount } }),
  evidenceUploadUrl: (fileType: "image" | "pdf") =>
    apiFetch<{ key: string; url: string; fields: Record<string, string>; allowedContentTypes: string[]; maxBytes: number }>(
      "/api/v1/payments/evidence-upload-url", { method: "POST", body: { fileType } }
    ),
  submitPayment: (payload: {
    amount: number; paymentMethod: string; paymentDate: string;
    transactionReference?: string; payerName?: string; remarks?: string;
    evidence: { key: string; fileType: "image" | "pdf" }[];
  }) => apiFetch("/api/v1/payments", { method: "POST", body: payload }),
  myPayments: () => apiFetch<PaymentHistoryRow[]>("/api/v1/payments/me"),
  paymentSummary: () => apiFetch<PaymentSummary>("/api/v1/payments/me/summary"),

  // ---- Applications ----
  submitApplication: (payload: Record<string, unknown>) => apiFetch("/api/v1/applications", { method: "POST", body: payload }),
  applications: (query: { status?: string; page?: number }) =>
    apiFetch<{ total: number; applications: ApplicationRow[] }>("/api/v1/applications", { query }),
  approveApplication: (id: string) =>
    apiFetch<
      | { studentId: string; userId: string; deliveryMethod: "email" | "sms"; message: string }
      | { studentId: string; userId: string; deliveryMethod: "manual"; temporaryPassword: string; message: string }
      | { studentId: string; userId: string; deliveryMethod: "chosen_password"; message: string }
    >(`/api/v1/applications/${id}/approve`, { method: "POST" }),
  decideApplication: (id: string, decision: string) =>
    apiFetch(`/api/v1/applications/${id}/decision`, { method: "POST", body: { decision } }),

  // ---- Announcements ----
  announcements: () => apiFetch<AnnouncementRow[]>("/api/v1/announcements"),
  createAnnouncement: (payload: { title: string; message: string; priority: string; audienceType: string; audienceRef?: string }) =>
    apiFetch("/api/v1/announcements", { method: "POST", body: payload }),
  updateAnnouncement: (id: string, payload: Partial<{ title: string; message: string; priority: string; audienceType: string; audienceRef?: string }>) =>
    apiFetch<AnnouncementRow>(`/api/v1/announcements/${id}`, { method: "PATCH", body: payload }),
  deleteAnnouncement: (id: string) => apiFetch<void>(`/api/v1/announcements/${id}`, { method: "DELETE" }),

  // ---- Maintenance ----
  submitMaintenance: (payload: { category: string; description: string; imageUrl?: string }) =>
    apiFetch("/api/v1/maintenance", { method: "POST", body: payload }),
  myMaintenance: () => apiFetch<MaintenanceRow[]>("/api/v1/maintenance/me"),
  adminMaintenance: (query: { status?: string; page?: number }) =>
    apiFetch<{ total: number; requests: MaintenanceRow[] }>("/api/v1/maintenance", { query }),
  updateMaintenanceStatus: (id: string, status: string) =>
    apiFetch(`/api/v1/maintenance/${id}/status`, { method: "PATCH", body: { status } }),

  // ---- Reports ----
  reportOccupancy: () => apiFetch<OccupancyReport>("/api/v1/reports/occupancy"),
  reportFinancial: () => apiFetch<FinancialReport>("/api/v1/reports/financial"),
  reportOutstanding: () => apiFetch<{ total: number; students: OutstandingRow[] }>("/api/v1/reports/outstanding"),
  reportStudents: () => apiFetch<StudentsReport>("/api/v1/reports/students"),
  reportMaintenance: () => apiFetch<{ byStatus: Record<string, number>; total: number }>("/api/v1/reports/maintenance"),

  // ---- Settings / Contacts / Guidelines ----
  // ---- Payment info (authenticated - no longer public, see backend README) ----
  paymentInfo: () => apiFetch<Record<string, string | null>>("/api/v1/settings/payment-info"),
  allSettings: () => apiFetch<{ key: string; value: string | null }[]>("/api/v1/settings"),
  updateSettings: (settings: { key: string; value: string | null }[]) =>
    apiFetch("/api/v1/settings", { method: "PATCH", body: { settings } }),
  contacts: () => apiFetch<ContactRow[]>("/api/v1/contacts"),
  createContact: (payload: { label: string; phone?: string; email?: string; notes?: string }) =>
    apiFetch("/api/v1/contacts", { method: "POST", body: payload }),
  deleteContact: (id: string) => apiFetch(`/api/v1/contacts/${id}`, { method: "DELETE" }),
  guidelines: () => apiFetch<GuidelineRow[]>("/api/v1/guidelines"),

  // ---- Notifications ----
  notifications: (unreadOnly = false) =>
    apiFetch<{ unreadCount: number; notifications: NotificationRow[] }>("/api/v1/notifications", { query: { unread: unreadOnly ? "true" : undefined } }),
  markNotificationRead: (id: string) => apiFetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => apiFetch("/api/v1/notifications/read-all", { method: "PATCH" }),

  // ---- Audit logs ----
  auditLogs: (query: { action?: string; entityType?: string; actorId?: string; dateFrom?: string; dateTo?: string; page?: number }) =>
    apiFetch<{ total: number; page: number; pageSize: number; logs: AuditLogRow[] }>("/api/v1/audit-logs", { query }),
};

/**
 * Uploads a file directly to the storage bucket using a presigned POST
 * (see backend src/lib/storage.ts) - the file bytes never pass through our
 * API server. Call this, then pass the returned key into submitPayment's
 * evidence array or a maintenance request's imageUrl.
 */
export async function uploadEvidenceFile(file: File, fileType: "image" | "pdf"): Promise<string> {
  const { key, url, fields } = await api.evidenceUploadUrl(fileType);
  const formData = new FormData();
  for (const [k, v] of Object.entries(fields)) formData.append(k, v);
  formData.append("file", file); // must be appended last for S3-compatible presigned POST
  const res = await fetch(url, { method: "POST", body: formData });
  if (!res.ok) throw new Error("File upload failed. Check file type/size and try again.");
  return key;
}

// ---------------------------------------------------------------------------
// Minimal response types - expand as you build more pages. These are
// intentionally loose (not a 1:1 mirror of the Prisma schema) since the
// frontend only needs the fields it actually renders.
// ---------------------------------------------------------------------------
export interface Room {
  id: string;
  roomNumber: string;
  status: string;
  section: { id: string; name: string };
  roomType: { id: string; name: string };
  currentStudent?: { id: string; fullName: string; registrationNumber: string } | null;
}

export interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  transactionReference?: string;
  submittedAt: string;
  student: { fullName: string; registrationNumber: string };
  room?: { roomNumber: string; section: { name: string } } | null;
}

export interface PaymentSummary {
  fee: number | null;
  verifiedPaid: number;
  pendingAmount: number;
  balance: number | null;
  status: string;
}

export interface StudentDashboard {
  student: { id: string; fullName: string; registrationNumber: string; status: string };
  accommodation: { section: string; roomNumber: string; roomType: string } | null;
  payment: PaymentSummary;
  urgentAnnouncements: { id: string; title: string; message: string; priority: string }[];
  openMaintenanceRequests: number;
}

export interface Me {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  student?: {
    id: string; fullName: string; registrationNumber: string; course: string | null;
    yearOfStudy: number | null; phone: string | null; email: string | null;
    homeDistrict: string | null; emergencyContactName: string | null; emergencyContactPhone: string | null;
    currentRoom?: { roomNumber: string; section: { name: string }; roomType: { name: string } } | null;
  } | null;
}

export interface StudentRow {
  id: string; fullName: string; registrationNumber: string; status: string;
  course: string | null; yearOfStudy: number | null;
  currentRoom?: { roomNumber: string; section: { name: string }; roomType: { name: string } } | null;
  semester?: { id: string; label: string; type: "regular" | "recess"; academicYear: { label: string } } | null;
  payment: PaymentSummary;
}

export interface StudentDetail extends StudentRow {
  phone: string | null; email: string | null;
  payments: PaymentHistoryRow[];
  termsAcceptedAt: string | null;
}

export interface LockedAccount {
  id: string; email: string | null; phone: string | null; role: string;
  failedLoginAttempts: number; lockedUntil: string | null;
  student?: { fullName: string; registrationNumber: string } | null;
}

export interface FeeRow {
  id: string; amount: number; effectiveDate: string;
  roomType: { name: string }; semester?: { label: string; type: string } | null;
}

export interface AcademicYearRow {
  id: string; label: string; semesters: SemesterRow[];
}

export interface SemesterRow {
  id: string; label: string; type: "regular" | "recess"; academicYearId: string;
  academicYear?: { label: string };
}

export interface PaymentHistoryRow {
  id: string; amount: number; status: string; paymentMethod: string;
  paymentDate: string; submittedAt: string; rejectionReason?: string | null; adminRemarks?: string | null;
}

export interface ApplicationRow {
  id: string; fullName: string; phone: string; email: string | null;
  registrationNumber: string | null; course: string | null; status: string; createdAt: string;
  preferredRoom?: { roomNumber: string; section: { name: string } } | null;
}

export interface AnnouncementRow {
  id: string; title: string; message: string; priority: string;
  audienceType: string; publishedAt: string;
}

export interface MaintenanceRow {
  id: string; category: string; description: string; status: string; createdAt: string;
  student?: { fullName: string }; room?: { roomNumber: string; section: { name: string } } | null;
}

export interface OccupancyReport {
  totalRooms: number; occupiedRooms: number; vacantRooms: number; occupancyRate: number;
  bySection: Record<string, { total: number; occupied: number; vacant: number; other: number }>;
  byType: Record<string, { total: number; occupied: number; vacant: number }>;
}

export interface FinancialReport {
  expected: number; verified: number; pending: number; outstanding: number;
  fullyPaidCount: number; partiallyPaidCount: number; outstandingCount: number; activeStudentCount: number;
}

export interface OutstandingRow {
  student: string; registrationNumber: string; room: string; fee: number; paid: number; balance: number; status: string;
}

export interface StudentsReport {
  total: number; byYear: Record<string, number>; byCourse: Record<string, number>; bySection: Record<string, number>;
}

export interface ContactRow { id: string; label: string; phone: string | null; email: string | null; notes: string | null; }
export interface GuidelineRow { id: string; category: string; content: string; updatedAt: string; }

export interface NotificationRow {
  id: string; type: string; payload: Record<string, unknown> | null; isRead: boolean; createdAt: string;
}

export interface AuditLogRow {
  id: string; action: string; entityType: string | null; entityId: string | null;
  previousValue: unknown; newValue: unknown; createdAt: string;
  actor: { email: string | null; phone: string | null; role: string } | null;
}
