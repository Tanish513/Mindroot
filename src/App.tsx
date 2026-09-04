import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { Marketplace } from './pages/Marketplace';
import { Schedule } from './pages/Schedule';
import { TeacherPortal } from './pages/TeacherPortal';
import { Wallet } from './pages/Wallet';
import { Feedback } from './pages/Feedback';
import { MatchFinder } from './pages/MatchFinder';
import { Messages } from './pages/Messages';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import { Rewards } from './pages/Rewards';
import { Discussions } from './pages/Discussions';
import { useAppStore } from './store/useAppStore';
import type { ReactNode } from 'react';

const AdminPortal = lazy(() => import('./pages/AdminPortal').then(m => ({ default: m.AdminPortal })));
const LiveRoom = lazy(() => import('./pages/LiveRoom').then(m => ({ default: m.LiveRoom })));

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
                  <Suspense fallback={SuspenseFallback}>
                    <AdminPortal />
                  </Suspense>
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
              path="/messages" 
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/live/:sessionId?" 
              element={
                <Suspense fallback={SuspenseFallback}>
                  <LiveRoom />
                </Suspense>
              } 
            />
            <Route 
              path="/room/:sessionId?" 
              element={
                <Suspense fallback={SuspenseFallback}>
                  <LiveRoom />
                </Suspense>
              } 
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
        </AppShell>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
