import { lazy, Suspense, useEffect, useState, ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Bell, Building2, CheckCircle2, ClipboardList, DoorOpen, FileText, LayoutDashboard, LogOut, Menu, Megaphone, Settings, Shield, Users, WalletCards, Wrench, X } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import BrandMark from "./components/BrandMark";
import { api } from "./lib/api";

const LoginPage = lazy(() => import("./pages/Login"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPassword"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword"));
const StudentDashboardPage = lazy(() => import("./pages/StudentDashboard"));
const SubmitPaymentPage = lazy(() => import("./pages/SubmitPayment"));
const PaymentHistoryPage = lazy(() => import("./pages/PaymentHistory"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const MaintenancePage = lazy(() => import("./pages/Maintenance"));
const AnnouncementsPage = lazy(() => import("./pages/Announcements"));
const NotificationsPage = lazy(() => import("./pages/Notifications"));
const AdminRoomsPage = lazy(() => import("./pages/AdminRooms"));
const AdminPaymentsPage = lazy(() => import("./pages/AdminPayments"));
const AdminStudentsPage = lazy(() => import("./pages/AdminStudents"));
const AdminApplicationsPage = lazy(() => import("./pages/AdminApplications"));
const AdminAnnouncementsPage = lazy(() => import("./pages/AdminAnnouncements"));
const AdminMaintenancePage = lazy(() => import("./pages/AdminMaintenance"));
const AdminReportsPage = lazy(() => import("./pages/AdminReports"));
const AdminSettingsPage = lazy(() => import("./pages/AdminSettings"));
const AdminAuditLogPage = lazy(() => import("./pages/AdminAuditLog"));
const AdminSecurityPage = lazy(() => import("./pages/AdminSecurity"));
const PublicHomePage = lazy(() => import("./pages/public/Home"));
const AvailableRoomsPage = lazy(() => import("./pages/public/AvailableRooms"));
const ApplyPage = lazy(() => import("./pages/public/Apply"));
const ContactPage = lazy(() => import("./pages/public/Contact"));
const GuidelinesPage = lazy(() => import("./pages/public/Guidelines"));

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
  { to: "/admin/security", label: "Security" },
  { to: "/admin/settings", label: "Settings" },
];

const NAV_ICONS = {
  Dashboard: LayoutDashboard,
  "Submit Payment": WalletCards,
  "Payment History": FileText,
  Announcements: Megaphone,
  Maintenance: Wrench,
  Profile: Users,
  Rooms: DoorOpen,
  Students: Users,
  Applications: ClipboardList,
  Payments: WalletCards,
  Reports: FileText,
  "Audit Log": ClipboardList,
  Security: Shield,
  Settings,
};

function RouteFallback() {
  return (
    <div className="route-fallback" role="status">
      <div className="route-fallback-mark"><BrandMark /></div>
      <div className="route-fallback-line" />
      <div className="route-fallback-line route-fallback-line-short" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      api.notifications(true)
        .then((result) => active && setUnread(result.unreadCount))
        .catch(() => {});
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") poll();
    };
    poll();
    const interval = window.setInterval(poll, 60_000);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, []);

  return (
    <NavLink to="/notifications" className="notification-link" aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}>
      <Bell size={18} aria-hidden="true" />
      {unread > 0 && <span className="notification-count">{unread > 9 ? "9+" : unread}</span>}
    </NavLink>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={`site-brand ${compact ? "site-brand-compact" : ""}`} aria-label="Executive Hostel home">
      <BrandMark />
      <span className="brand-name">Executive <strong>Hostel</strong></span>
    </Link>
  );
}

function SiteNav({ links, actions, menuLabel, userRole }: { links: { to: string; label: string }[]; actions?: ReactNode; menuLabel: string; userRole?: string | null }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <header className={`site-nav ${menuOpen ? "is-open" : ""}`}>
      <div className="site-nav-inner">
        <Brand />
        <button className="nav-menu-toggle" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
        <nav className="site-nav-links" aria-label={menuLabel}>
          <div className="mobile-nav-head"><span>Portal menu</span><button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={18} aria-hidden="true" /></button></div>
          {userRole && <div className="mobile-nav-profile"><div className="mobile-nav-avatar"><Users size={20} aria-hidden="true" /></div><div><strong>{userRole.replace(/_/g, " ")}</strong><small>Executive Hostel portal</small></div></div>}
          {!userRole && <div className="mobile-nav-profile"><div className="mobile-nav-avatar"><Building2 size={20} aria-hidden="true" /></div><div><strong>Executive Hostel</strong><small>Student accommodation in Soroti</small></div></div>}
          <div className="mobile-nav-section-label">{userRole ? "Your workspace" : "Explore"}</div>
          {links.map((link) => {
            const Icon = NAV_ICONS[link.label as keyof typeof NAV_ICONS] ?? FileText;
            return <NavLink key={link.to} to={link.to} className={({ isActive }) => isActive ? "is-active" : undefined}><Icon size={18} aria-hidden="true" /><span>{link.label}</span>{link.label === "Applications" && <span className="mobile-nav-badge">!</span>}</NavLink>;
          })}
          {userRole && <div className="mobile-nav-actions">{actions}</div>}
          {userRole && <div className="mobile-nav-notice"><Bell size={16} aria-hidden="true" /><span>Stay up to date with hostel activity.</span></div>}
        </nav>
        {actions && <div className="site-nav-actions">{actions}</div>}
      </div>
    </header>
  );
}

function PublicNav() {
  return (
    <SiteNav
      menuLabel="Public navigation"
      links={[
        { to: "/rooms", label: "Available Rooms" },
        { to: "/guidelines", label: "Guidelines" },
        { to: "/contact", label: "Contact" },
      ]}
      actions={(
        <div className="nav-cta-group">
          <NavLink to="/apply" className="btn btn-primary btn-small">Apply now</NavLink>
          <NavLink to="/login" className="btn btn-quiet btn-small">Student login</NavLink>
        </div>
      )}
    />
  );
}

function TopNav() {
  const { role, logout } = useAuth();
  const navigate = useNavigate();
  const links = role === "student" ? STUDENT_LINKS : role === "administrator" || role === "landlady" ? ADMIN_LINKS : [];

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <SiteNav
      menuLabel="Account navigation"
      links={links}
      userRole={role}
      actions={(
        <div className="nav-account-group">
          <NotificationBell />
          <button type="button" className="btn btn-quiet btn-small" onClick={handleLogout}><LogOut size={15} aria-hidden="true" /> Sign out</button>
        </div>
      )}
    />
  );
}

function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-frame">
      <PublicNav />
      <main className="public-main">{children}</main>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <div>
            <Brand compact />
            <p>Comfortable, independent student accommodation in Soroti.</p>
          </div>
          <div className="footer-links">
            <NavLink to="/rooms">Available rooms</NavLink>
            <NavLink to="/guidelines">Guidelines</NavLink>
            <NavLink to="/contact">Contact</NavLink>
            <NavLink to="/login">Student login</NavLink>
          </div>
          <div className="footer-note"><Building2 size={15} aria-hidden="true" /> Soroti University · Soroti, Uganda</div>
        </div>
      </footer>
    </div>
  );
}

function Home() {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) {
    return <PublicLayout><LazyRoute><PublicHomePage /></LazyRoute></PublicLayout>;
  }
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
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LazyRoute><LoginPage /></LazyRoute>} />
        <Route path="/forgot-password" element={<LazyRoute><ForgotPasswordPage /></LazyRoute>} />
        <Route path="/reset-password" element={<LazyRoute><ResetPasswordPage /></LazyRoute>} />
        <Route path="/rooms" element={<PublicLayout><LazyRoute><AvailableRoomsPage /></LazyRoute></PublicLayout>} />
        <Route path="/apply" element={<PublicLayout><LazyRoute><ApplyPage /></LazyRoute></PublicLayout>} />
        <Route path="/contact" element={<PublicLayout><LazyRoute><ContactPage /></LazyRoute></PublicLayout>} />
        <Route path="/guidelines" element={<PublicLayout><LazyRoute><GuidelinesPage /></LazyRoute></PublicLayout>} />

        <Route path="/dashboard" element={<ProtectedRoute allow={["student"]}><LazyRoute><StudentDashboardPage /></LazyRoute></ProtectedRoute>} />
        <Route path="/payments/submit" element={<ProtectedRoute allow={["student"]}><LazyRoute><SubmitPaymentPage /></LazyRoute></ProtectedRoute>} />
        <Route path="/payments/history" element={<ProtectedRoute allow={["student"]}><LazyRoute><PaymentHistoryPage /></LazyRoute></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute allow={["student"]}><LazyRoute><ProfilePage /></LazyRoute></ProtectedRoute>} />
        <Route path="/maintenance" element={<ProtectedRoute allow={["student"]}><LazyRoute><MaintenancePage /></LazyRoute></ProtectedRoute>} />
        <Route path="/announcements" element={<ProtectedRoute allow={["student", "administrator", "landlady", "chairperson"]}><LazyRoute><AnnouncementsPage /></LazyRoute></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute allow={["student", "administrator", "landlady", "chairperson"]}><LazyRoute><NotificationsPage /></LazyRoute></ProtectedRoute>} />

        <Route path="/admin/rooms" element={<ProtectedRoute allow={["administrator", "landlady"]}><LazyRoute><AdminRoomsPage /></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/students" element={<ProtectedRoute allow={["administrator", "landlady"]}><LazyRoute><AdminStudentsPage /></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/applications" element={<ProtectedRoute allow={["administrator", "landlady"]}><LazyRoute><AdminApplicationsPage /></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/payments" element={<ProtectedRoute allow={["administrator", "landlady"]}><LazyRoute><AdminPaymentsPage /></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/announcements" element={<ProtectedRoute allow={["administrator", "landlady", "chairperson"]}><LazyRoute><AdminAnnouncementsPage /></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/maintenance" element={<ProtectedRoute allow={["administrator", "landlady"]}><LazyRoute><AdminMaintenancePage /></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute allow={["administrator", "landlady"]}><LazyRoute><AdminReportsPage /></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/audit-log" element={<ProtectedRoute allow={["administrator", "landlady"]}><LazyRoute><AdminAuditLogPage /></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/security" element={<ProtectedRoute allow={["administrator", "landlady"]}><LazyRoute><AdminSecurityPage /></LazyRoute></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute allow={["administrator", "landlady"]}><LazyRoute><AdminSettingsPage /></LazyRoute></ProtectedRoute>} />

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
