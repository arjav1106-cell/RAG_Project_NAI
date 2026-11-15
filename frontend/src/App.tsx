import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAuth } from "./lib/auth-context";
import { AuthPage } from "./pages/AuthPage";
import { AssistantPage } from "./pages/AssistantPage";
import { ClaimsPage } from "./pages/ClaimsPage";
import { ComparePage } from "./pages/ComparePage";
import { DashboardPage } from "./pages/DashboardPage";
import { GaragePage } from "./pages/GaragePage";
import { PoliciesPage } from "./pages/PoliciesPage";
import { SupportPage } from "./pages/SupportPage";

function Authenticated() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="full-loader">
        <span className="spinner" /> Loading your workspace…
      </div>
    );
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={
          loading ? (
            <div className="full-loader">
              <span className="spinner" /> Loading…
            </div>
          ) : user ? (
            <Navigate to="/" replace />
          ) : (
            <AuthPage />
          )
        }
      />
      <Route
        path="/register"
        element={
          loading ? (
            <div className="full-loader">
              <span className="spinner" /> Loading…
            </div>
          ) : user ? (
            <Navigate to="/" replace />
          ) : (
            <AuthPage createAccount />
          )
        }
      />
      <Route element={<Authenticated />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="garage" element={<GaragePage />} />
          <Route path="policies" element={<PoliciesPage />} />
          <Route path="claims" element={<ClaimsPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="support" element={<SupportPage />} />
        </Route>
      </Route>
      <Route
        path="*"
        element={<Navigate to={user ? "/" : "/login"} replace />}
      />
    </Routes>
  );
}
