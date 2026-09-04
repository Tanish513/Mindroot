import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AIAssistant } from './AIAssistant';
import { NotificationManager } from '../NotificationManager';
import { useLocation, useNavigate } from 'react-router-dom';
import { isBackendConfigMissing, getBackendUrl } from '../../lib/env';
import { useAppStore } from '../../store/useAppStore';

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, isSidebarCollapsed, toggleSidebarCollapsed } = useAppStore();
  const token = localStorage.getItem('mindroot_token') || localStorage.getItem('token') || '';

  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);

  const authStandalonePages = ['/login', '/forgot-password', '/reset-password', '/verify-email'];
  const isStandalonePage = authStandalonePages.includes(location.pathname);

  // Global Navigation Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle sidebar collapse shortcut: Cmd+[ or Ctrl+[
      if ((e.metaKey || e.ctrlKey) && e.key === '[') {
        e.preventDefault();
        toggleSidebarCollapsed();
        return;
      }

      // Don't trigger navigation shortcuts if typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'd') { e.preventDefault(); navigate('/dashboard'); }
        else if (key === 'p') { e.preventDefault(); navigate('/profile'); }
        else if (key === 'm') { e.preventDefault(); navigate('/marketplace'); }
        else if (key === 'f') { e.preventDefault(); navigate('/match-finder'); }
        else if (key === 's') { e.preventDefault(); navigate('/schedule'); }
        else if (key === 'e') { e.preventDefault(); navigate('/messages'); }
        else if (key === 'w') { e.preventDefault(); navigate('/wallet'); }
        else if (key === 't') { e.preventDefault(); navigate('/teacher'); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, toggleSidebarCollapsed]);

  const handleResendVerification = async () => {
    setResendingVerification(true);
    setVerificationNotice(null);

    try {
      const res = await fetch(`${getBackendUrl()}/api/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend verification email.');
      }
      setVerificationNotice('Verification email sent! Check your inbox.');
    } catch (err: any) {
      setVerificationNotice(err.message || 'Error sending verification email.');
    } finally {
      setResendingVerification(false);
    }
  };

  if (isStandalonePage) {
    return <div className="min-h-screen bg-background text-on-background">{children}</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-background">
      <NotificationManager />
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className={`flex-1 flex flex-col h-screen overflow-hidden relative transition-[margin-left] duration-300 ease-[cubic-bezier(0.2,0,0,1)] will-change-[margin-left] ${isSidebarCollapsed ? 'ml-0 md:ml-[72px]' : 'ml-0 md:ml-[260px]'}`}>
        {isBackendConfigMissing() && (
          <div className="bg-learning-amber text-on-learning-amber px-4 py-2 text-xs font-semibold text-center z-50 shadow-elevation-1 flex items-center justify-center gap-2">
            <span>🚨 Backend URL (`VITE_BACKEND_URL`) is not configured for production in your host dashboard. API & WebRTC connections will fail.</span>
          </div>
        )}

        {currentUser && currentUser.emailVerified === false && (
          <div className="bg-learning-amber-container border-b border-learning-amber/20 text-on-learning-amber-container px-4 py-2 text-xs font-bold text-center z-40 flex flex-wrap items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">mark_email_unread</span>
            <span>Please verify your email address ({currentUser.email || 'your account'}).</span>
            <button
              onClick={handleResendVerification}
              disabled={resendingVerification}
              className="text-primary font-extrabold hover:underline disabled:opacity-50 transition-colors ml-1"
            >
              {resendingVerification ? 'Sending Email...' : 'Resend Verification Link'}
            </button>
            {verificationNotice && (
              <span className="text-[11px] font-medium text-on-learning-amber-container/90 ml-1">({verificationNotice})</span>
            )}
          </div>
        )}

        <TopBar onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
      <AIAssistant />
    </div>
  );
}
