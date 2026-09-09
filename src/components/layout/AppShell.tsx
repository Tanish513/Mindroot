import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AIAssistant } from './AIAssistant';
import { NotificationManager } from '../NotificationManager';
import { useLocation, useNavigate } from 'react-router-dom';
import { isBackendConfigMissing } from '../../lib/env';
import { useAppStore } from '../../store/useAppStore';

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleSidebarCollapsed } = useAppStore();

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

  if (isStandalonePage) {
    return <div className="min-h-screen bg-background text-on-background">{children}</div>;
  }

  return (
    <div className="flex h-screen bg-background text-on-background overflow-hidden selection:bg-primary/20 selection:text-primary transition-colors duration-200">
      <NotificationManager />
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {isBackendConfigMissing() && (
          <div className="bg-learning-amber text-on-learning-amber px-4 py-2 text-xs font-semibold text-center z-50 shadow-elevation-1 flex items-center justify-center gap-2">
            <span>🚨 Backend URL (`VITE_BACKEND_URL`) is not configured for production in your host dashboard. API & WebRTC connections will fail.</span>
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
