import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LogOut, Bell } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { api } from "./lib/api";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import StudentDashboard from "./pages/StudentDashboard";
import SubmitPayment from "./pages/SubmitPayment";
import PaymentHistory from "./pages/PaymentHistory";
import Profile from "./pages/Profile";
import Maintenance from "./pages/Maintenance";
import Announcements from "./pages/Announcements";
import Notifications from "./pages/Notifications";
import AdminRooms from "./pages/AdminRooms";
import AdminPayments from "./pages/AdminPayments";
import AdminStudents from "./pages/AdminStudents";
import AdminApplications from "./pages/AdminApplications";
import AdminAnnouncements from "./pages/AdminAnnouncements";
import AdminMaintenance from "./pages/AdminMaintenance";
import AdminReports from "./pages/AdminReports";
import AdminSettings from "./pages/AdminSettings";
import AdminAuditLog from "./pages/AdminAuditLog";
import PublicHome from "./pages/public/Home";
import AvailableRooms from "./pages/public/AvailableRooms";
import Apply from "./pages/public/Apply";
import Contact from "./pages/public/Contact";
import Guidelines from "./pages/public/Guidelines";
// PaymentInfo intentionally not imported/routed - payment/bank details are
// no longer public. See pages/public/PaymentInfo.tsx for why, and
// SubmitPayment.tsx for the authenticated equivalent.

const STUDENT_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/payments/submit", label: "Submit Payment" },
  { to: "/payments/history", label: "Payment History" },
  { to: "/announcements", label: "Announcements" },
  { to: "/maintenance", label: "Maintenance" },
  { to: "/profile", label: "Profile" },
];

const ADMIN_LINKS = [
  { to: "/admin/rooms", label: "Rooms" },
  { to: "/admin/students", label: "Students" },
  { to: "/admin/applications", label: "Applications" },
  { to: "/admin/payments", label: "Payments" },
  { to: "/admin/announcements", label: "Announcements" },
  { to: "/admin/maintenance", label: "Maintenance" },
  { to: "/admin/reports", label: "Reports" },
  { to: "/admin/audit-log", label: "Audit Log" },
  { to: "/admin/settings", label: "Settings" },
];

function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    function poll() {
      api.notifications(true).then((r) => setUnread(r.unreadCount)).catch(() => {});
    }
    poll();
    const interval = setInterval(poll, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <Link to="/notifications" style={{ position: "relative", display: "flex", alignItems: "center", color: "var(--color-text)" }}>
      <Bell size={18} />
      {unread > 0 && (
        <span style={{
          position: "absolute", top: -6, right: -6, background: "var(--color-danger)", color: "#fff",
          fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
        }}>
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

function TopNav() {
  const { role, logout } = useAuth();
  const navigate = useNavigate();
  const links = role === "student" ? STUDENT_LINKS : role === "administrator" || role === "landlady" ? ADMIN_LINKS : [];

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div style={{ background: "#fff", borderBottom: "1px solid var(--color-border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <Link to="/" className="font-display" style={{ fontWeight: 700, fontSize: 16, color: "var(--color-primary-dark)", textDecoration: "none" }}>
        Executive Hostel
      </Link>
      {links.map((l) => (
        <Link key={l.to} to={l.to} style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", textDecoration: "none" }}>{l.label}</Link>
      ))}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
        <NotificationBell />
        <button onClick={handleLogout} className="btn btn-outline" style={{ padding: "6px 12px" }}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}

function PublicNav() {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid var(--color-border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <Link to="/" className="font-display" style={{ fontWeight: 700, fontSize: 16, color: "var(--color-primary-dark)", textDecoration: "none" }}>
        Executive Hostel
      </Link>
      <Link to="/rooms" style={{ fontSize: 13, fontWeight: 600, textDecoration: "none", color: "var(--color-text)" }}>Available Rooms</Link>
      <Link to="/guidelines" style={{ fontSize: 13, fontWeight: 600, textDecoration: "none", color: "var(--color-text)" }}>Guidelines</Link>
      <Link to="/contact" style={{ fontSize: 13, fontWeight: 600, textDecoration: "none", color: "var(--color-text)" }}>Contact</Link>
      <Link to="/apply" className="btn btn-primary" style={{ marginLeft: "auto", padding: "6px 14px" }}>Apply</Link>
      <Link to="/login" className="btn btn-outline" style={{ padding: "6px 14px" }}>Student Login</Link>
    </div>
  );
}

function Home() {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <><PublicNav /><PublicHome /></>;
  if (role === "administrator" || role === "landlady") return <Navigate to="/admin/rooms" replace />;
  if (role === "student") return <Navigate to="/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

function AppShell() {
  const { isAuthenticated } = useAuth();
  return (
    <>
      {isAuthenticated && <TopNav />}
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/rooms" element={<><PublicNav /><AvailableRooms /></>} />
        <Route path="/apply" element={<><PublicNav /><Apply /></>} />
        <Route path="/contact" element={<><PublicNav /><Contact /></>} />
        <Route path="/guidelines" element={<><PublicNav /><Guidelines /></>} />

        {/* Student */}
        <Route path="/dashboard" element={<ProtectedRoute allow={["student"]}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/payments/submit" element={<ProtectedRoute allow={["student"]}><SubmitPayment /></ProtectedRoute>} />
        <Route path="/payments/history" element={<ProtectedRoute allow={["student"]}><PaymentHistory /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute allow={["student"]}><Profile /></ProtectedRoute>} />
        <Route path="/maintenance" element={<ProtectedRoute allow={["student"]}><Maintenance /></ProtectedRoute>} />
        <Route path="/announcements" element={<ProtectedRoute allow={["student", "administrator", "landlady", "chairperson"]}><Announcements /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute allow={["student", "administrator", "landlady", "chairperson"]}><Notifications /></ProtectedRoute>} />

        {/* Admin / landlady */}
        <Route path="/admin/rooms" element={<ProtectedRoute allow={["administrator", "landlady"]}><AdminRooms /></ProtectedRoute>} />
        <Route path="/admin/students" element={<ProtectedRoute allow={["administrator", "landlady"]}><AdminStudents /></ProtectedRoute>} />
        <Route path="/admin/applications" element={<ProtectedRoute allow={["administrator", "landlady"]}><AdminApplications /></ProtectedRoute>} />
        <Route path="/admin/payments" element={<ProtectedRoute allow={["administrator", "landlady"]}><AdminPayments /></ProtectedRoute>} />
        <Route path="/admin/announcements" element={<ProtectedRoute allow={["administrator", "landlady", "chairperson"]}><AdminAnnouncements /></ProtectedRoute>} />
        <Route path="/admin/maintenance" element={<ProtectedRoute allow={["administrator", "landlady"]}><AdminMaintenance /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute allow={["administrator", "landlady"]}><AdminReports /></ProtectedRoute>} />
        <Route path="/admin/audit-log" element={<ProtectedRoute allow={["administrator", "landlady"]}><AdminAuditLog /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute allow={["administrator", "landlady"]}><AdminSettings /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
