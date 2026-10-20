import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../lib/api';
import clsx from 'clsx';

const navItems = [
  { path: '/dashboard', icon: 'dashboard', label: 'Dashboard', shortcut: '⌘D', roles: ['student'] },
  { path: '/teacher', icon: 'school', label: 'Teacher Portal', shortcut: '⌘T', roles: ['teacher'] },
  { path: '/discussions', icon: 'forum', label: 'Community', shortcut: '⌘U', roles: ['student', 'teacher'] },
  { path: '/marketplace', icon: 'storefront', label: 'Marketplace', shortcut: '⌘M', roles: ['student'] },
  { path: '/rewards', icon: 'stars', label: 'Rewards Store', shortcut: '⌘R', roles: ['student'] },
  { path: '/match-finder', icon: 'search_check', label: 'Match Finder', shortcut: '⌘F', roles: ['student'] },
  { path: '/schedule', icon: 'calendar_today', label: 'Schedule', shortcut: '⌘S', roles: ['student', 'teacher'] },
  { path: '/notes', icon: 'edit_note', label: 'Notes', shortcut: '⌘N', roles: ['student', 'teacher'] },
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
          className="flex items-center gap-3 overflow-hidden cursor-pointer group/brand focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
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
          <div className="w-11 h-11 rounded-xl bg-sidebar-logo-tile border border-sidebar-border flex items-center justify-center text-sidebar-icon shadow-xs shrink-0 group-hover/brand:scale-105 transition-transform">
            <span className="material-symbols-outlined text-2xl text-sidebar-icon">psychology</span>
          </div>
          <div
            className={clsx(
              "min-w-0 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden whitespace-nowrap",
              isCollapsed ? "max-w-0 opacity-0 -translate-x-2 pointer-events-none" : "max-w-[130px] opacity-100 translate-x-0"
            )}
          >
            <h1 className="text-base font-black tracking-tight text-sidebar-active-text leading-none truncate">
              Mindroot
            </h1>
            <span className="inline-block text-[10px] font-bold text-sidebar-icon opacity-80 mt-0.5 tracking-wider uppercase truncate">
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
                "group relative flex items-center h-11 w-full rounded-xl font-semibold text-xs transition-colors duration-150 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-bg",
                isActive 
                  ? "bg-primary-tint text-primary-text font-bold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:bg-primary before:rounded-r" 
                  : "text-sidebar-icon [@media(hover:hover)]:hover:bg-nav-hover [@media(hover:hover)]:hover:text-text focus-visible:bg-nav-hover focus-visible:text-text"
              )}
            >
              {/* Stationary Anchor Icon with soft rounded background when active */}
              <div className="w-11 h-11 flex items-center justify-center shrink-0 relative">
                <div className={clsx(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150",
                  isActive ? "bg-sidebar-active-icon-bg shadow-xs" : ""
                )}>
                  <span
                    className={clsx(
                      "material-symbols-outlined text-xl transition-colors duration-150",
                      isActive 
                        ? "text-primary-text" 
                        : "text-sidebar-icon [@media(hover:hover)]:group-hover:text-primary-text group-focus-visible:text-primary-text"
                    )}
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                  >
                    {item.icon}
                  </span>
                </div>

                {/* Pulsing joinable session dot on Live Room icon */}
                {item.label === 'Live Room' && hasJoinableSession && (
                  <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5" title="Live lecture joinable now">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary ring-2 ring-sidebar-bg"></span>
                  </span>
                )}
              </div>

              {/* Accessible Hover / Keyboard Focus Tooltip */}
              <div 
                role="tooltip" 
                className={clsx(
                  "pointer-events-none absolute left-full ml-2.5 z-50 items-center px-2.5 py-1 text-xs font-semibold text-text bg-surface rounded-lg shadow border border-border whitespace-nowrap transition-opacity duration-150",
                  isCollapsed ? "hidden group-hover:flex group-focus-visible:flex" : "hidden"
                )}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="ml-1.5 text-muted font-mono text-[10px] bg-surface-2 px-1 py-0.5 rounded border border-border">
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
                  <span className={clsx(
                    "truncate transition-colors duration-150",
                    isActive 
                      ? "text-primary-text" 
                      : "text-sidebar-icon [@media(hover:hover)]:group-hover:text-text group-focus-visible:text-text"
                  )}>
                    {item.label}
                  </span>
                  {item.label === 'Live Room' && hasJoinableSession && (
                    <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold bg-primary text-on-primary rounded-full animate-pulse shrink-0">
                      LIVE
                    </span>
                  )}
                </div>
                <span
                  className={clsx(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded transition-all duration-150 shrink-0 ml-2",
                    "bg-surface border border-border text-muted opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-focus-visible:opacity-100"
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
        {currentUser && (() => {
          const isProfileActive = location.pathname === '/profile';
          return (
            <Link
              to="/profile"
              onClick={handleNavClick}
              aria-label="Open your profile"
              className={clsx(
                "group relative flex items-center h-11 w-full rounded-xl transition-colors duration-150 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-bg",
                isProfileActive 
                  ? "bg-primary-tint text-primary-text font-bold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:bg-primary before:rounded-r shadow-xs" 
                  : "text-sidebar-icon [@media(hover:hover)]:hover:bg-nav-hover [@media(hover:hover)]:hover:text-text focus-visible:bg-nav-hover focus-visible:text-text"
              )}
            >
              <div className="w-11 h-11 flex items-center justify-center shrink-0">
                <div className="relative w-8 h-8">
                  <img 
                    src={currentUser.avatar || "https://i.pravatar.cc/150?img=11"} 
                    alt={currentUser.name} 
                    className={clsx(
                      "w-8 h-8 rounded-full object-cover border transition-colors duration-150",
                      isProfileActive 
                        ? "border-primary" 
                        : "border-sidebar-border [@media(hover:hover)]:group-hover:border-primary group-focus-visible:border-primary"
                    )} 
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-sidebar-bg" />
                </div>
              </div>

              {/* Tooltip on collapsed profile */}
              <div 
                role="tooltip" 
                className={clsx(
                  "pointer-events-none absolute left-full ml-2.5 z-50 items-center px-2.5 py-1 text-xs font-semibold text-text bg-surface rounded-lg shadow border border-border whitespace-nowrap transition-opacity duration-150",
                  isCollapsed ? "hidden group-hover:flex group-focus-visible:flex" : "hidden"
                )}
              >
                <span>View profile</span>
              </div>

              <div
                className={clsx(
                  "flex-1 min-w-0 pr-2.5 pl-1 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden whitespace-nowrap flex items-center justify-between gap-1",
                  isCollapsed ? "max-w-0 opacity-0 -translate-x-2 pointer-events-none" : "max-w-[170px] opacity-100 translate-x-0"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className={clsx(
                    "text-xs font-bold truncate transition-colors duration-150",
                    isProfileActive 
                      ? "text-primary-text" 
                      : "text-sidebar-icon [@media(hover:hover)]:group-hover:text-text group-focus-visible:text-text"
                  )}>
                    {currentUser.name}
                  </p>
                  <p className={clsx(
                    "text-[10px] capitalize font-medium truncate transition-colors duration-150",
                    isProfileActive ? "text-primary-text/80" : "text-muted"
                  )}>
                    {activeRole} • {activeRole === 'student' ? `${Math.min(100, Math.round((currentUser.trustScore || 5) * 20))}%` : `${currentUser.trustScore || '4.95'}⭐`}
                  </p>
                </div>

                <span className={clsx(
                  "material-symbols-outlined text-base shrink-0 transition-colors duration-150",
                  isProfileActive 
                    ? "text-primary-text" 
                    : "text-muted [@media(hover:hover)]:group-hover:text-primary-text group-focus-visible:text-primary-text"
                )}>
                  chevron_right
                </span>
              </div>
            </Link>
          );
        })()}

        {/* Switch Role Button: Only available if account is both/hybrid */}
        {canSwitchRole && (
          <button 
            onClick={() => {
              toggleRole();
              setMobileOpen?.(false);
            }}
            aria-label={`Switch to ${activeRole === 'student' ? 'Teacher' : 'Student'}`}
            className="group relative w-full h-10 rounded-xl text-xs font-bold transition-colors duration-150 flex items-center active:scale-98 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-bg border border-sidebar-border text-sidebar-icon [@media(hover:hover)]:hover:bg-nav-hover [@media(hover:hover)]:hover:text-text focus-visible:bg-nav-hover focus-visible:text-text"
          >
            <div className="w-11 h-10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg text-sidebar-icon [@media(hover:hover)]:group-hover:text-primary-text group-focus-visible:text-primary-text transition-colors duration-150">swap_horiz</span>
            </div>

            {/* Tooltip on collapsed switch role */}
            <div 
              role="tooltip" 
              className={clsx(
                "pointer-events-none absolute left-full ml-2.5 z-50 items-center px-2.5 py-1 text-xs font-semibold text-text bg-surface rounded-lg shadow border border-border whitespace-nowrap transition-opacity duration-150",
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
              <span className="[@media(hover:hover)]:group-hover:text-text group-focus-visible:text-text transition-colors duration-150">Switch to {activeRole === 'student' ? 'Teacher' : 'Student'}</span>
            </div>
          </button>
        )}

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          aria-label="Sign Out"
          className="group relative w-full h-10 rounded-xl text-xs font-semibold border border-sidebar-border text-sidebar-icon [@media(hover:hover)]:hover:bg-nav-hover [@media(hover:hover)]:hover:text-text focus-visible:bg-nav-hover focus-visible:text-text transition-colors duration-150 flex items-center cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-bg"
        >
          <div className="w-11 h-10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-lg text-sidebar-icon [@media(hover:hover)]:group-hover:text-primary-text group-focus-visible:text-primary-text transition-colors duration-150">logout</span>
          </div>

          {/* Tooltip on collapsed logout */}
          <div 
            role="tooltip" 
            className={clsx(
                "pointer-events-none absolute left-full ml-2.5 z-50 items-center px-2.5 py-1 text-xs font-semibold text-text bg-surface rounded-lg shadow border border-border whitespace-nowrap transition-opacity duration-150",
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
            <span className="[@media(hover:hover)]:group-hover:text-text group-focus-visible:text-text transition-colors duration-150">Sign Out</span>
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

