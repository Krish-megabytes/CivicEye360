import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AppShell, AuthLayout, PublicLayout } from './components/Layouts';
import { ToastProvider } from './components/ui/Toast';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { NgoRegisterPage } from './pages/auth/NgoRegisterPage';
import { NgoLayout } from './pages/ngo/NgoLayout';
import { NgoOverviewPage } from './pages/ngo/NgoOverviewPage';
import { NgoTasksPage } from './pages/ngo/NgoTasksPage';
import { NgoWorkPage } from './pages/ngo/NgoWorkPage';
import { NgoLeaderboardPage } from './pages/ngo/NgoLeaderboardPage';
import { NgoReviewPage } from './pages/ngo/NgoReviewPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { LandingPage } from './pages/public/LandingPage';
import { HelpPage } from './pages/public/HelpPage';
import { PrivacyPage } from './pages/public/PrivacyPage';
import { TermsPage } from './pages/public/TermsPage';
import { CitizenDashboardPage } from './pages/citizen/CitizenDashboardPage';
import { CitizenReportsPage } from './pages/citizen/CitizenReportsPage';
import { CitizenMapPage } from './pages/citizen/CitizenMapPage';
import { NewReportPage } from './pages/citizen/NewReportPage';
import { CitizenReportDetailPage } from './pages/citizen/ReportDetailPage';
import { StaffWorkspacePage } from './pages/citizen/StaffWorkspacePage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminReportDetailPage } from './pages/admin/AdminReportDetailPage';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { TrackPage } from './pages/public/TrackPage';
import { NotificationsPage } from './pages/citizen/NotificationsPage';
import { ProfilePage } from './pages/citizen/ProfilePage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminMapPage } from './pages/admin/AdminMapPage';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { RequireAuth, RequireRole, NotFoundPage } from './routes/guards';
import './styles.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function ScrollManager() {
  const { pathname, hash } = useLocation();
  React.useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      const scroll = () => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ block: 'start' });
          return true;
        }
        return false;
      };
      if (!scroll()) {
        let tries = 0;
        const timer = window.setInterval(() => {
          if (scroll() || tries++ > 20) window.clearInterval(timer);
        }, 100);
        return () => window.clearInterval(timer);
      }
      return;
    }
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname, hash]);
  return null;
}

function PublicHome() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="container-page py-12" role="status">Loading…</div>;
  if (user) {
    if (user.role === 'ngo') return <Navigate to="/ngo" replace />;
    if (user.role === 'field_staff') return <Navigate to="/staff" replace />;
    if (user.role !== 'citizen') return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <LandingPage />;
}

function App() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><ScrollManager /><AuthProvider><ToastProvider><Routes>
    <Route element={<PublicLayout />}>
      <Route path="/" element={<PublicHome />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/track" element={<TrackPage />} />
    </Route>
    <Route element={<AuthLayout />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/ngo" element={<NgoRegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
    </Route>
    <Route element={<RequireAuth />}><Route element={<AppShell />}>
      <Route path="/dashboard" element={<CitizenDashboardPage />} />
      <Route path="/dashboard/reports" element={<CitizenReportsPage />} />
      <Route path="/dashboard/map" element={<CitizenMapPage />} />
      <Route path="/reports/new" element={<NewReportPage />} />
      <Route path="/reports/:reportId" element={<CitizenReportDetailPage />} />
      <Route path="/staff" element={<StaffWorkspacePage />} />
      <Route path="/ngo" element={<RequireRole roles={['ngo']}><NgoLayout /></RequireRole>}>
        <Route index element={<NgoOverviewPage />} />
        <Route path="tasks" element={<NgoTasksPage />} />
        <Route path="work" element={<NgoWorkPage />} />
        <Route path="leaderboard" element={<NgoLeaderboardPage />} />
      </Route>
      <Route path="/admin/ngo-review" element={<RequireRole roles={['municipal_admin', 'platform_admin']}><NgoReviewPage /></RequireRole>} />
      <Route path="/admin" element={<AdminOverviewPage />} />
      <Route path="/admin/reports" element={<AdminReportsPage />} />
      <Route path="/admin/reports/:reportId" element={<AdminReportDetailPage />} />
      <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
      <Route path="/admin/map" element={<AdminMapPage />} />
      <Route path="/admin/*" element={<ComingSoon title="Administration workspace" />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/settings/profile" element={<ProfilePage />} />
    </Route></Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes></ToastProvider></AuthProvider></BrowserRouter></QueryClientProvider>;
}

function ComingSoon({ title }: { title: string }) { return <main className="mx-auto max-w-3xl"><h1 className="text-2xl font-bold text-ink">{title}</h1><p className="mt-2 text-sm text-ink-muted">This workspace is not available yet.</p></main>; }

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
