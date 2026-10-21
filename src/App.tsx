import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAppStore } from './store/useAppStore';
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Marketplace = lazy(() => import('./pages/Marketplace').then(m => ({ default: m.Marketplace })));
const Schedule = lazy(() => import('./pages/Schedule').then(m => ({ default: m.Schedule })));
const TeacherPortal = lazy(() => import('./pages/TeacherPortal').then(m => ({ default: m.TeacherPortal })));
const Wallet = lazy(() => import('./pages/Wallet').then(m => ({ default: m.Wallet })));
const Feedback = lazy(() => import('./pages/Feedback').then(m => ({ default: m.Feedback })));
const MatchFinder = lazy(() => import('./pages/MatchFinder').then(m => ({ default: m.MatchFinder })));
const Messages = lazy(() => import('./pages/Messages').then(m => ({ default: m.Messages })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Rewards = lazy(() => import('./pages/Rewards').then(m => ({ default: m.Rewards })));
const Discussions = lazy(() => import('./pages/Discussions').then(m => ({ default: m.Discussions })));
const AdminPortal = lazy(() => import('./pages/AdminPortal').then(m => ({ default: m.AdminPortal })));
const LiveRoom = lazy(() => import('./pages/LiveRoom').then(m => ({ default: m.LiveRoom })));
const Notes = lazy(() => import('./pages/Notes').then(m => ({ default: m.Notes })));

const SuspenseFallback = (
  <div className="flex items-center justify-center min-h-[400px] text-on-surface-variant text-xs font-bold">
    <div className="flex items-center gap-2 bg-surface px-4 py-2.5 rounded-xl border border-outline-variant shadow-elevation-1">
      <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span>Loading module...</span>
    </div>
  </div>
);

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('student' | 'teacher' | 'admin')[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isLoggedIn, role, loginRole, currentUser } = useAppStore();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  const effectiveRole = (currentUser?.role === 'both' || loginRole === 'both')
    ? role
    : (currentUser?.role === 'teacher' || loginRole === 'teacher' ? 'teacher' : (currentUser?.role === 'admin' || loginRole === 'admin' ? 'admin' : 'student'));

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    if (effectiveRole === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to={effectiveRole === 'teacher' ? '/teacher' : '/dashboard'} replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { isLoggedIn, role, loginRole, currentUser } = useAppStore();
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  const effectiveRole = (currentUser?.role === 'both' || loginRole === 'both')
    ? role
    : (currentUser?.role === 'teacher' || loginRole === 'teacher' ? 'teacher' : (currentUser?.role === 'admin' || loginRole === 'admin' ? 'admin' : 'student'));

  if (effectiveRole === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to={effectiveRole === 'teacher' ? '/teacher' : '/dashboard'} replace />;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell>
          <Suspense fallback={SuspenseFallback}>
            <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            
            {/* Student Protected Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/marketplace" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Marketplace />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/match-finder" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <MatchFinder />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/rewards" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Rewards />
                </ProtectedRoute>
              } 
            />

            {/* Teacher Protected Routes */}
            <Route 
              path="/teacher" 
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <TeacherPortal />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPortal />
                </ProtectedRoute>
              } 
            />

            {/* Shared Protected Routes */}
            <Route 
              path="/discussions" 
              element={
                <ProtectedRoute>
                  <Discussions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/schedule" 
              element={
                <ProtectedRoute>
                  <Schedule />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/notes" 
              element={
                <ProtectedRoute>
                  <Notes />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/notes/daily" 
              element={
                <ProtectedRoute>
                  <Notes />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/messages" 
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/live-room/:sessionId?" 
              element={<LiveRoom />} 
            />
            <Route 
              path="/classroom/:sessionId?" 
              element={<LiveRoom />} 
            />
            <Route 
              path="/live/:sessionId?" 
              element={<LiveRoom />} 
            />
            <Route 
              path="/room/:sessionId?" 
              element={<LiveRoom />} 
            />
            <Route 
              path="/feedback" 
              element={
                <ProtectedRoute allowedRoles={['student', 'teacher']}>
                  <Feedback />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/wallet" 
              element={
                <ProtectedRoute>
                  <Wallet />
                </ProtectedRoute>
              } 
            />

            {/* Fallback Redirect */}
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </Suspense>
      </AppShell>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
