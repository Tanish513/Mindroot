import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  activePaths?: string[];
  badge?: number;
}

interface MobileBottomNavProps {
  onOpenMenu?: () => void;
  isMenuOpen?: boolean;
}

export function MobileBottomNav({ onOpenMenu, isMenuOpen = false }: MobileBottomNavProps) {
  const location = useLocation();
  const notifications = useAppStore(state => state.notifications);
  const unreadCount = notifications.filter(n => !n.read).length;

  const navItems: NavItem[] = [
    {
      path: '/dashboard',
      label: 'Home',
      icon: 'dashboard',
      activePaths: ['/dashboard', '/'],
    },
    {
      path: '/marketplace',
      label: 'Find',
      icon: 'search',
      activePaths: ['/marketplace', '/match-finder'],
    },
    {
      path: '/schedule',
      label: 'Schedule',
      icon: 'calendar_today',
      activePaths: ['/schedule'],
    },
    {
      path: '/messages',
      label: 'Messages',
      icon: 'chat_bubble',
      activePaths: ['/messages'],
    },
    {
      path: '/profile',
      label: 'More',
      icon: 'more_horiz',
      activePaths: ['/profile', '/wallet'],
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
  ];

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 h-14 bg-surface/95 dark:bg-[#0D0E14] backdrop-blur-xl border-t border-border z-40 md:hidden pb-safe shadow-[0_-1px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
    >
      <div className="h-full max-w-lg mx-auto flex items-center justify-around px-2">
        {navItems.map((item) => {
          const isMore = item.label === 'More';
          const isActive = isMore 
            ? Boolean(isMenuOpen)
            : (item.activePaths 
                ? item.activePaths.some(p => location.pathname === p || (p !== '/' && location.pathname.startsWith(p)))
                : location.pathname === item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={(e) => {
                if (isMore && onOpenMenu) {
                  e.preventDefault();
                  onOpenMenu();
                }
              }}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={clsx(
                "flex flex-col items-center justify-center flex-1 min-w-[48px] h-full py-0.5 transition-all select-none relative group",
                isActive ? "text-primary" : "text-muted hover:text-text"
              )}
            >
              <div className="relative flex items-center justify-center">
                <span 
                  className="material-symbols-outlined text-[22px] transition-transform duration-150 group-active:scale-90"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {item.icon}
                </span>

                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-accent text-on-primary text-[12px] font-bold flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={clsx(
                "text-[12px] leading-tight mt-0.5 transition-colors",
                isActive ? "font-bold text-primary" : "font-medium text-muted"
              )}>
                {item.label}
              </span>

              {isActive && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
