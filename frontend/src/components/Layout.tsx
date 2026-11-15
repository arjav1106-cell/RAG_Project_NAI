import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  CarFront,
  ChevronDown,
  CircleHelp,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircleMore,
  Scale,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth-context";

const navigation = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/garage", label: "My garage", icon: CarFront },
  { to: "/policies", label: "Policies", icon: FileText },
  { to: "/claims", label: "Claims", icon: ShieldCheck },
  { to: "/compare", label: "Compare cover", icon: Scale },
  { to: "/assistant", label: "Policy assistant", icon: MessageCircleMore },
  { to: "/support", label: "Help & grievances", icon: CircleHelp },
];

const titles: Record<string, string> = {
  "/": "Overview",
  "/garage": "My garage",
  "/policies": "Policies & payments",
  "/claims": "Claims & documents",
  "/compare": "Compare cover",
  "/assistant": "Policy assistant",
  "/support": "Help & grievances",
};

export function Layout() {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const title = titles[location.pathname] ?? "Vahana";

  const leave = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          aria-label="Close menu"
          className="mobile-scrim"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark">
            <ShieldCheck size={21} strokeWidth={2.3} />
          </div>
          <div>
            <span className="brand-name">vahana</span>
            <span className="brand-caption">POLICY COMPANION</span>
          </div>
          <button
            aria-label="Close navigation"
            className="icon-button mobile-close"
            onClick={() => setMobileOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `side-link ${isActive ? "active" : ""}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
              {label === "Policy assistant" && (
                <span className="nav-spark">AI</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="side-note">
            <div className="side-note-icon">
              <ShieldCheck size={17} />
            </div>
            <div>
              <strong>Your data stays yours</strong>
              <span>Policies are private to your account.</span>
            </div>
          </div>
          <button
            className="profile-trigger"
            onClick={() => setProfileOpen((open) => !open)}
            aria-expanded={profileOpen}
          >
            <span className="avatar">
              {user?.email.slice(0, 1).toUpperCase() ?? "V"}
            </span>
            <span className="profile-copy">
              <strong>{user?.email.split("@")[0] ?? "Your account"}</strong>
              <span>Personal garage</span>
            </span>
            <ChevronDown size={16} className={profileOpen ? "rotate" : ""} />
          </button>
          {profileOpen && (
            <button className="sign-out-item" onClick={leave}>
              <LogOut size={16} /> Sign out
            </button>
          )}
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>Vahana</span>
            <span className="crumb-divider">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="privacy-pill">
              <span /> Private workspace
            </span>
            <NavLink
              to="/"
              className="icon-button notification-button"
              aria-label="View reminders"
            >
              <Bell size={18} />
            </NavLink>
            <div className="top-avatar">
              {user?.email.slice(0, 1).toUpperCase() ?? "V"}
            </div>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Vahana Policy Companion</span>
          <span>Helpful context, grounded in your policy documents.</span>
        </footer>
      </div>
    </div>
  );
}
