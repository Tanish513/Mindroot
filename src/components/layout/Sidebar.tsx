import { useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
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
  { path: '/live/preview', icon: 'video_chat', label: 'Live Room', shortcut: '⌘L', roles: ['student', 'teacher'] },
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

  const activeRole = role; // 'student' or 'teacher'
  const filteredItems = navItems.filter(item => item.roles.includes(activeRole));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderNavContent = (isCollapsed: boolean) => (
    <div className="flex flex-col h-full py-4 bg-surface select-none px-3.5 overflow-hidden">
      {/* Brand Header */}
      <div className="flex items-center mb-4 h-11 w-full justify-between overflow-hidden">
        <div 
          className="flex items-center gap-3 overflow-hidden cursor-pointer group/brand"
          onClick={() => isCollapsed && toggleSidebarCollapsed()}
          title={isCollapsed ? "Click to expand sidebar (⌘[)" : undefined}
        >
          <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-elevation-1 shrink-0 group-hover/brand:scale-105 transition-transform">
            <span className="material-symbols-outlined text-2xl">psychology</span>
          </div>
          <div
            className={clsx(
              "min-w-0 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden whitespace-nowrap",
              isCollapsed ? "max-w-0 opacity-0 -translate-x-2 pointer-events-none" : "max-w-[130px] opacity-100 translate-x-0"
            )}
          >
            <h1 className="text-base font-black tracking-tight text-on-surface leading-none truncate">
              Mindroot
            </h1>
            <span className="inline-block text-[10px] font-bold text-on-surface-variant mt-0.5 tracking-wider uppercase truncate">
              Skill Exchange
            </span>
          </div>
        </div>

        {/* Desktop Collapse / Pin Button - only rendered in DOM when expanded */}
        {!isCollapsed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleSidebarCollapsed();
              setIsHovered(false);
            }}
            title={isSidebarCollapsed ? "Pin sidebar open (⌘[)" : "Collapse sidebar (⌘[)"}
            className="hidden md:flex items-center justify-center text-on-surface-variant hover:text-on-surface p-1.5 rounded-xl hover:bg-surface-container transition-colors shrink-0 cursor-pointer"
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
            className="md:hidden text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar overflow-x-hidden pt-1">
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.path || (location.pathname === '/' && item.path === '/dashboard');
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              title={isCollapsed ? `${item.label} (${item.shortcut})` : undefined}
              className={clsx(
                "group relative flex items-center h-11 w-full rounded-xl font-semibold text-xs transition-colors duration-150",
                isActive 
                  ? "text-on-primary-container bg-primary-container border border-primary/20 shadow-elevation-1" 
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              )}
            >
              {/* Stationary Anchor Icon */}
              <div className="w-11 h-11 flex items-center justify-center shrink-0">
                <span
                  className={clsx(
                    "material-symbols-outlined text-xl transition-colors",
                    isActive ? "text-primary" : "text-outline group-hover:text-on-surface"
                  )}
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {item.icon}
                </span>
              </div>

              {/* Smooth Expanding Label + Shortcut Wrapper */}
              <div
                className={clsx(
                  "flex-1 flex items-center justify-between min-w-0 pr-3 pl-1 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden whitespace-nowrap",
                  isCollapsed ? "max-w-0 opacity-0 -translate-x-2 pointer-events-none" : "max-w-[180px] opacity-100 translate-x-0"
                )}
              >
                <span className="truncate">{item.label}</span>
                <span
                  className={clsx(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors shrink-0 ml-2",
                    isActive 
                      ? "bg-primary/10 border-primary/30 text-on-primary-container font-bold" 
                      : "bg-surface-container border-outline-variant text-on-surface-variant opacity-70 group-hover:opacity-100"
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
      <div className="mt-auto pt-3 space-y-1.5 border-t border-outline-variant overflow-hidden">
        {/* User Mini Profile Card */}
        {currentUser && (
          <Link
            to="/profile"
            onClick={() => setMobileOpen?.(false)}
            title={isCollapsed ? `${currentUser.name} (Profile)` : undefined}
            className="group relative flex items-center h-11 w-full rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant transition-colors cursor-pointer"
          >
            <div className="w-11 h-11 flex items-center justify-center shrink-0">
              <div className="relative w-8 h-8">
                <img 
                  src={currentUser.avatar || "https://i.pravatar.cc/150?img=11"} 
                  alt={currentUser.name} 
                  className="w-8 h-8 rounded-full object-cover border border-outline-variant" 
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-teaching-emerald ring-2 ring-surface" />
              </div>
            </div>

            <div
              className={clsx(
                "flex-1 min-w-0 pr-2.5 pl-1 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden whitespace-nowrap",
                isCollapsed ? "max-w-0 opacity-0 -translate-x-2 pointer-events-none" : "max-w-[160px] opacity-100 translate-x-0"
              )}
            >
              <p className="text-xs font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                {currentUser.name}
              </p>
              <p className="text-[10px] text-on-surface-variant capitalize font-medium truncate">
                {activeRole} • {activeRole === 'student' ? `${Math.min(100, Math.round((currentUser.trustScore || 5) * 20))}%` : `${currentUser.trustScore || '4.95'}⭐`}
              </p>
            </div>
          </Link>
        )}

        {/* Switch Role Button */}
        {loginRole === 'both' && (
          <button 
            onClick={() => {
              toggleRole();
              setMobileOpen?.(false);
            }}
            title={isCollapsed ? `Switch to ${activeRole === 'student' ? 'Teacher' : 'Student'}` : undefined}
            className={clsx(
              "group relative w-full h-10 rounded-xl text-xs font-bold shadow-elevation-1 transition-all flex items-center active:scale-98 cursor-pointer",
              activeRole === 'student' ? "bg-learning-amber hover:bg-learning-amber-hover text-on-learning-amber" : "bg-teaching-emerald hover:bg-teaching-emerald-hover text-on-teaching-emerald"
            )}
          >
            <div className="w-11 h-10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">swap_horiz</span>
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
          title={isCollapsed ? "Sign Out" : undefined}
          className="group relative w-full h-10 rounded-xl text-xs font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all flex items-center cursor-pointer"
        >
          <div className="w-11 h-10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-lg">logout</span>
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
      {/* Desktop Sidebar with buttery-smooth cubic-bezier transition */}
      <aside 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={clsx(
          "hidden md:block h-full fixed left-0 top-0 border-r transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] will-change-[width] overflow-hidden",
          isFloatingOverlay
            ? "w-[260px] z-50 shadow-2xl border-r-primary/30 bg-surface/98 backdrop-blur-md"
            : (isSidebarCollapsed 
                ? "w-[72px] z-40 shadow-elevation-1 border-r-outline-variant bg-surface" 
                : "w-[260px] z-40 shadow-elevation-1 border-r-outline-variant bg-surface")
        )}
      >
        {renderNavContent(!isExpanded)}
      </aside>

      {/* Mobile Drawer Overlay with smooth backdrop and slide animation */}
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
            "relative w-[280px] max-w-[85vw] h-full bg-surface shadow-elevation-3 z-50 transform transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {renderNavContent(false)}
        </aside>
      </div>
    </>
  );
}
