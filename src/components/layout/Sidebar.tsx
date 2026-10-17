import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../lib/api';
import clsx from 'clsx';

const navItems = [
  { path: '/dashboard', icon: 'dashboard', label: 'Dashboard', shortcut: '⌘D', roles: ['student'] },
  { path: '/teacher', icon: 'school', label: 'Teacher Portal', shortcut: '⌘T', roles: ['teacher'] },
  { path: '/discussions', icon: 'forum', label: 'Community', shortcut: '⌘U', roles: ['student', 'teacher'] },
  { path: '/profile', icon: 'account_circle', label: 'My Profile', shortcut: '⌘P', roles: ['student', 'teacher'] },
  { path: '/marketplace', icon: 'storefront', label: 'Marketplace', shortcut: '⌘M', roles: ['student'] },
  { path: '/rewards', icon: 'stars', label: 'Rewards Store', shortcut: '⌘R', roles: ['student'] },
  { path: '/match-finder', icon: 'search_check', label: 'Match Finder', shortcut: '⌘F', roles: ['student'] },
  { path: '/schedule', icon: 'calendar_today', label: 'Schedule', shortcut: '⌘S', roles: ['student', 'teacher'] },
  { path: '/messages', icon: 'chat_bubble', label: 'Messages', shortcut: '⌘E', roles: ['student', 'teacher'] },
  { path: '/live-room', icon: 'video_chat', label: 'Live Room', shortcut: '⌘L', roles: ['student', 'teacher'] },
  { path: '/wallet', icon: 'account_balance_wallet', label: 'Wallet', shortcut: '⌘W', roles: ['student', 'teacher'] },
  { path: '/feedback', icon: 'rate_review', label: 'Feedback', shortcut: '⌘K', roles: ['student', 'teacher'] },
  { path: '/admin', icon: 'admin_panel_settings', label: 'Admin', shortcut: '⌘A', roles: ['admin'] },
];

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export function Sidebar({ mobileOpen = false, setMobileOpen }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const toggleRole = useAppStore(state => state.toggleRole);
  const role = useAppStore(state => state.role);
  const loginRole = useAppStore(state => state.loginRole);
  const logout = useAppStore(state => state.logout);
  const currentUser = useAppStore(state => state.currentUser);
  const isSidebarCollapsed = useAppStore(state => state.isSidebarCollapsed);
  const toggleSidebarCollapsed = useAppStore(state => state.toggleSidebarCollapsed);

  const [isHovered, setIsHovered] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for currently joinable session to display pulsing dot on Live Room icon
  const [hasJoinableSession, setHasJoinableSession] = useState(false);

  useEffect(() => {
    let active = true;
    const checkJoinable = async () => {
      try {
        if (!currentUser?.id) {
          if (active) setHasJoinableSession(false);
          return;
        }
        const sessions = await api.getSessions();
        if (!Array.isArray(sessions) || !active) return;
        const now = Date.now();
        const joinable = sessions.some((s: any) => {
          if (!s || (s.status !== 'confirmed' && s.status !== 'live')) return false;
          const isT = s.teacherId === currentUser.id || s.teacher?.id === currentUser.id;
          const isS = s.studentId === currentUser.id || s.student?.id === currentUser.id ||
            (Array.isArray(s.students) && s.students.some((st: any) => (st.id || st) === currentUser.id));
          if (!isT && !isS) return false;

          const rawDate = s.scheduledAt || s.date || s.time;
          if (!rawDate) return false;
          const start = new Date(rawDate).getTime();
          if (isNaN(start)) return false;

          const dur = (s.durationMin || s.duration || 60) * 60 * 1000;
          const grace = 15 * 60 * 1000;
          const ended = now > start + dur + grace;
          if (ended) return false;

          if (isT) return true; // Teacher may join anytime before end + grace
          // Student join window: 10 mins before start until end + grace
          return now >= start - 10 * 60 * 1000;
        });

        if (active) {
          setHasJoinableSession(joinable);
        }
      } catch {
        // Ignore network / offline errors
      }
    };

    checkJoinable();
    const interval = setInterval(checkJoinable, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [currentUser?.id]);

  const handleMouseEnter = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    if (isSidebarCollapsed) {
      hoverTimer.current = setTimeout(() => {
        setIsHovered(true);
      }, 100);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    if (isSidebarCollapsed) {
      leaveTimer.current = setTimeout(() => {
        setIsHovered(false);
      }, 160);
    } else {
      setIsHovered(false);
    }
  };

  const handleNavClick = () => {
    setMobileOpen?.(false);
    if (isHovered) {
      setIsHovered(false);
    }
  };

  const isExpanded = !isSidebarCollapsed || isHovered;
  const isFloatingOverlay = isSidebarCollapsed && isHovered;

  const canSwitchRole = loginRole === 'both' || currentUser?.role === 'both';
  const activeRole = canSwitchRole
    ? role
    : (currentUser?.role === 'teacher' || loginRole === 'teacher' ? 'teacher' : 'student');
  const filteredItems = navItems.filter(item => item.roles.includes(activeRole));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderNavContent = (isCollapsed: boolean) => (
    <div className="flex flex-col h-full py-4 bg-sidebar-bg text-sidebar-icon select-none px-3.5 overflow-hidden">
      {/* Brand Header */}
      <div className="flex items-center mb-4 h-11 w-full justify-between overflow-hidden">
        <div 
          className="flex items-center gap-3 overflow-hidden cursor-pointer group/brand focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-active rounded-xl"
          onClick={() => isCollapsed && toggleSidebarCollapsed()}
          title={isCollapsed ? "Click to expand sidebar (⌘[)" : undefined}
          tabIndex={isCollapsed ? 0 : -1}
          onKeyDown={(e) => {
            if (isCollapsed && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              toggleSidebarCollapsed();
            }
          }}
        >
          <div className="w-11 h-11 rounded-xl bg-sidebar-logo-tile/20 border border-sidebar-logo-tile/40 flex items-center justify-center text-white shadow-sm shrink-0 group-hover/brand:scale-105 transition-transform">
            <span className="material-symbols-outlined text-2xl text-sidebar-logo-tile">psychology</span>
          </div>
          <div
            className={clsx(
              "min-w-0 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden whitespace-nowrap",
              isCollapsed ? "max-w-0 opacity-0 -translate-x-2 pointer-events-none" : "max-w-[130px] opacity-100 translate-x-0"
            )}
          >
            <h1 className="text-base font-black tracking-tight text-white leading-none truncate">
              Mindroot
            </h1>
            <span className="inline-block text-[10px] font-bold text-sidebar-icon/80 mt-0.5 tracking-wider uppercase truncate">
              Skill Exchange
            </span>
          </div>
        </div>

        {/* Desktop Collapse / Pin Button */}
        {!isCollapsed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleSidebarCollapsed();
              setIsHovered(false);
            }}
            title={isSidebarCollapsed ? "Pin sidebar open (⌘[)" : "Collapse sidebar (⌘[)"}
            aria-label={isSidebarCollapsed ? "Pin sidebar open" : "Collapse sidebar"}
            className="hidden md:flex items-center justify-center text-sidebar-icon hover:text-sidebar-icon-hover p-1.5 rounded-xl hover:bg-sidebar-hover-bg transition-colors shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">
              {isSidebarCollapsed ? 'push_pin' : 'menu_open'}
            </span>
          </button>
        )}

        {/* Mobile Close Button */}
        {setMobileOpen && (
          <button 
            onClick={() => setMobileOpen(false)} 
            aria-label="Close navigation menu"
            className="md:hidden text-sidebar-icon hover:text-sidebar-icon-hover p-1.5 rounded-lg hover:bg-sidebar-hover-bg transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar overflow-x-hidden pt-1">
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (location.pathname === '/' && item.path === '/dashboard') ||
            (item.path === '/live-room' && (location.pathname.startsWith('/live') || location.pathname.startsWith('/room') || location.pathname.startsWith('/classroom')));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              aria-label={item.label}
              className={clsx(
                "group relative flex items-center h-11 w-full rounded-xl font-semibold text-xs transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-active",
                isActive 
                  ? "text-sidebar-active-icon bg-sidebar-active shadow-md" 
                  : "text-sidebar-icon hover:bg-sidebar-hover-bg hover:text-sidebar-icon-hover"
              )}
            >
              {/* Stationary Anchor Icon */}
              <div className="w-11 h-11 flex items-center justify-center shrink-0 relative">
                <span
                  className={clsx(
                    "material-symbols-outlined text-xl transition-colors",
                    isActive ? "text-sidebar-active-icon" : "text-sidebar-icon group-hover:text-sidebar-icon-hover"
                  )}
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {item.icon}
                </span>

                {/* Pulsing joinable session dot on Live Room icon */}
                {item.label === 'Live Room' && hasJoinableSession && (
                  <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5" title="Live lecture joinable now">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 ring-2 ring-sidebar-bg"></span>
                  </span>
                )}
              </div>

              {/* Accessible Hover / Keyboard Focus Tooltip */}
              <div 
                role="tooltip" 
                className={clsx(
                  "pointer-events-none absolute left-full ml-2.5 z-50 items-center px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 rounded-lg shadow-xl border border-white/10 whitespace-nowrap transition-opacity duration-150",
                  isCollapsed ? "hidden group-hover:flex group-focus-visible:flex" : "hidden"
                )}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="ml-1.5 opacity-60 font-mono text-[10px] bg-white/10 px-1 py-0.5 rounded">
                    {item.shortcut}
                  </span>
                )}
              </div>

              {/* Smooth Expanding Label + Shortcut Wrapper */}
              <div
                className={clsx(
                  "flex-1 flex items-center justify-between min-w-0 pr-3 pl-1 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden whitespace-nowrap",
                  isCollapsed ? "max-w-0 opacity-0 -translate-x-2 pointer-events-none" : "max-w-[180px] opacity-100 translate-x-0"
                )}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="truncate">{item.label}</span>
                  {item.label === 'Live Room' && hasJoinableSession && (
                    <span className="px-1.5 py-0.5 text-[9px] uppercase font-black bg-emerald-400 text-slate-950 rounded-full animate-pulse shrink-0">
                      LIVE
                    </span>
                  )}
                </div>
                <span
                  className={clsx(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors shrink-0 ml-2",
                    isActive 
                      ? "bg-white/20 border-white/30 text-white font-bold" 
                      : "bg-white/5 border-white/10 text-sidebar-icon/80 opacity-70 group-hover:opacity-100"
                  )}
                >
                  {item.shortcut}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Info & Footer Controls */}
      <div className="mt-auto pt-3 space-y-1.5 border-t border-sidebar-border overflow-hidden">
        {/* User Mini Profile Card */}
        {currentUser && (
          <Link
            to="/profile"
            onClick={() => setMobileOpen?.(false)}
            aria-label={`${currentUser.name} Profile`}
            className="group relative flex items-center h-11 w-full rounded-xl bg-white/5 hover:bg-sidebar-hover-bg border border-sidebar-border transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-active"
          >
            <div className="w-11 h-11 flex items-center justify-center shrink-0">
              <div className="relative w-8 h-8">
                <img 
                  src={currentUser.avatar || "https://i.pravatar.cc/150?img=11"} 
                  alt={currentUser.name} 
                  className="w-8 h-8 rounded-full object-cover border border-white/10" 
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-sidebar-bg" />
              </div>
            </div>

            {/* Tooltip on collapsed profile */}
            <div 
              role="tooltip" 
              className={clsx(
                "pointer-events-none absolute left-full ml-2.5 z-50 items-center px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 rounded-lg shadow-xl border border-white/10 whitespace-nowrap",
                isCollapsed ? "hidden group-hover:flex group-focus-visible:flex" : "hidden"
              )}
            >
              <span>{currentUser.name} (Profile)</span>
            </div>

            <div
              className={clsx(
                "flex-1 min-w-0 pr-2.5 pl-1 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden whitespace-nowrap",
                isCollapsed ? "max-w-0 opacity-0 -translate-x-2 pointer-events-none" : "max-w-[160px] opacity-100 translate-x-0"
              )}
            >
              <p className="text-xs font-bold text-white truncate group-hover:text-sidebar-icon-hover transition-colors">
                {currentUser.name}
              </p>
              <p className="text-[10px] text-sidebar-icon/80 capitalize font-medium truncate">
                {activeRole} • {activeRole === 'student' ? `${Math.min(100, Math.round((currentUser.trustScore || 5) * 20))}%` : `${currentUser.trustScore || '4.95'}⭐`}
              </p>
            </div>
          </Link>
        )}

        {/* Switch Role Button: Only available if account is both/hybrid */}
        {canSwitchRole && (
          <button 
            onClick={() => {
              toggleRole();
              setMobileOpen?.(false);
            }}
            aria-label={`Switch to ${activeRole === 'student' ? 'Teacher' : 'Student'}`}
            className={clsx(
              "group relative w-full h-10 rounded-xl text-xs font-bold shadow-md transition-all flex items-center active:scale-98 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-active",
              activeRole === 'student' ? "bg-amber-600 hover:bg-amber-500 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white"
            )}
          >
            <div className="w-11 h-10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">swap_horiz</span>
            </div>

            {/* Tooltip on collapsed switch role */}
            <div 
              role="tooltip" 
              className={clsx(
                "pointer-events-none absolute left-full ml-2.5 z-50 items-center px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 rounded-lg shadow-xl border border-white/10 whitespace-nowrap",
                isCollapsed ? "hidden group-hover:flex group-focus-visible:flex" : "hidden"
              )}
            >
              <span>Switch to {activeRole === 'student' ? 'Teacher' : 'Student'}</span>
            </div>

            <div
              className={clsx(
                "flex-1 min-w-0 pr-2 pl-1 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden whitespace-nowrap text-left",
                isCollapsed ? "max-w-0 opacity-0 -translate-x-2 pointer-events-none" : "max-w-[170px] opacity-100 translate-x-0"
              )}
            >
              <span>Switch to {activeRole === 'student' ? 'Teacher' : 'Student'}</span>
            </div>
          </button>
        )}

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          aria-label="Sign Out"
          className="group relative w-full h-10 rounded-xl text-xs font-semibold border border-sidebar-border text-sidebar-icon hover:bg-sidebar-hover-bg hover:text-sidebar-icon-hover transition-all flex items-center cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-active"
        >
          <div className="w-11 h-10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-lg">logout</span>
          </div>

          {/* Tooltip on collapsed logout */}
          <div 
            role="tooltip" 
            className={clsx(
              "pointer-events-none absolute left-full ml-2.5 z-50 items-center px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 rounded-lg shadow-xl border border-white/10 whitespace-nowrap",
              isCollapsed ? "hidden group-hover:flex group-focus-visible:flex" : "hidden"
            )}
          >
            <span>Sign Out</span>
          </div>

          <div
            className={clsx(
              "flex-1 min-w-0 pr-2 pl-1 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden whitespace-nowrap text-left",
              isCollapsed ? "max-w-0 opacity-0 -translate-x-2 pointer-events-none" : "max-w-[170px] opacity-100 translate-x-0"
            )}
          >
            <span>Sign Out</span>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar with cubic-bezier transition */}
      <aside 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={clsx(
          "hidden md:block h-full fixed left-0 top-0 border-r border-sidebar-border bg-sidebar-bg transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] will-change-[width] overflow-hidden",
          isFloatingOverlay
            ? "w-[260px] z-50 shadow-2xl border-r-sidebar-border bg-sidebar-bg/95 backdrop-blur-md"
            : (isSidebarCollapsed 
                ? "w-[72px] z-40 shadow-elevation-1" 
                : "w-[260px] z-40 shadow-elevation-1")
        )}
      >
        {renderNavContent(!isExpanded)}
      </aside>

      {/* Mobile Drawer Overlay */}
      <div 
        className={clsx(
          "md:hidden fixed inset-0 z-50 transition-opacity duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs" 
          onClick={() => setMobileOpen?.(false)}
        />
        <aside 
          className={clsx(
            "relative w-[280px] max-w-[85vw] h-full bg-sidebar-bg border-r border-sidebar-border shadow-elevation-3 z-50 transform transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {renderNavContent(false)}
        </aside>
      </div>
    </>
  );
}

