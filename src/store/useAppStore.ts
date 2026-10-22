import { create } from 'zustand';
import { api, onPeersUpdated, safeSetStorage, updateSocketAuth, getAuthItem, setAuthItem, removeAuthItem } from '../lib/api';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppNotification {
  id: string;
  type: 'message' | 'reminder' | 'session';
  title: string;
  body: string;
  time: string;
  link?: string;
  read: boolean;
  avatar?: string;
}

interface AppState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  isLoggedIn: boolean;
  role: 'student' | 'teacher' | 'admin';
  loginRole: 'student' | 'teacher' | 'both' | 'admin';
  toggleRole: () => void;
  tokenBalance: number;
  setTokenBalance: (balance: number) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentUser: any;
  setCurrentUser: (user: any) => void;
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'time' | 'read'>) => void;
  markNotificationsAsRead: () => void;
  clearNotifications: () => void;
  isSidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
  login: (user: any, role: 'student' | 'teacher' | 'both' | 'admin') => void;
  logout: () => void;
}

const updateDocumentTheme = (theme: ThemeMode) => {
  if (typeof document === 'undefined') return;
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
  }
};

const getInitialTheme = (): ThemeMode => {
  try {
    const saved = localStorage.getItem('mindroot_theme') as ThemeMode;
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {}
  return 'system';
};

const initialTheme = getInitialTheme();
updateDocumentTheme(initialTheme);

// Listen to OS color scheme changes when theme is set to 'system'
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemThemeChange = () => {
    const currentTheme = useAppStore.getState().theme;
    if (currentTheme === 'system') {
      updateDocumentTheme('system');
    }
  };
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  } else if ((mediaQuery as any).addListener) {
    (mediaQuery as any).addListener(handleSystemThemeChange);
  }
}

// Read initial state from tab-scoped session storage with fallback to localStorage
const getInitialUser = () => {
  try {
    const stored = getAuthItem('mindroot_current_user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const initialUser = getInitialUser();
if (initialUser && typeof window !== 'undefined') {
  if (initialUser.id && !getAuthItem('mindroot_auth_token')) {
    setAuthItem('mindroot_auth_token', `dev-token-${initialUser.id}`);
  }
  updateSocketAuth();
  setTimeout(() => api.syncNetworkUser(initialUser), 500);
}

const initialRole = (getAuthItem('mindroot_current_role') as 'student' | 'teacher' | 'admin') || (initialUser?.role === 'teacher' ? 'teacher' : 'student');
const initialLoginRole = (initialUser?.role as 'student' | 'teacher' | 'both' | 'admin') || (getAuthItem('mindroot_login_role') as 'student' | 'teacher' | 'both' | 'admin') || 'student';

// Reactive multi-laptop listener: auto-update current user's token balance & trust score live
onPeersUpdated((peers) => {
  const current = useAppStore.getState().currentUser;
  if (current && current.id && Array.isArray(peers)) {
    const matchedPeer = peers.find((p: any) => p.id === current.id);
    if (matchedPeer) {
      const updatedUser = {
        ...current,
        tokenBalance: typeof matchedPeer.tokenBalance === 'number' ? matchedPeer.tokenBalance : current.tokenBalance,
        trustScore: typeof matchedPeer.trustScore === 'number' ? matchedPeer.trustScore : current.trustScore,
        rewardPoints: typeof matchedPeer.rewardPoints === 'number' ? matchedPeer.rewardPoints : current.rewardPoints,
        badges: Array.isArray(matchedPeer.badges) ? matchedPeer.badges : current.badges
      };
      setAuthItem('mindroot_current_user', updatedUser);
      useAppStore.setState({
        currentUser: updatedUser,
        tokenBalance: updatedUser.tokenBalance
      });
    }
  }
});

const getInitialNotifications = (): AppNotification[] => {
  try {
    const saved = localStorage.getItem('mindroot_notifications');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const useAppStore = create<AppState>((set) => ({
  theme: initialTheme,
  setTheme: (theme: ThemeMode) => {
    safeSetStorage('mindroot_theme', theme);
    updateDocumentTheme(theme);
    set({ theme });
  },
  isLoggedIn: !!initialUser,
  role: initialRole,
  loginRole: initialLoginRole,
  notifications: getInitialNotifications(),
  addNotification: (item) => set((state) => {
    const newNotif: AppNotification = {
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
      ...item
    };
    const updated = [newNotif, ...state.notifications].slice(0, 30);
    safeSetStorage('mindroot_notifications', updated);
    return { notifications: updated };
  }),
  markNotificationsAsRead: () => set((state) => {
    const updated = state.notifications.map(n => ({ ...n, read: true }));
    safeSetStorage('mindroot_notifications', updated);
    return { notifications: updated };
  }),
  clearNotifications: () => set(() => {
    localStorage.removeItem('mindroot_notifications');
    return { notifications: [] };
  }),
  isSidebarCollapsed: typeof localStorage !== 'undefined' && localStorage.getItem('mindroot_sidebar_collapsed') === 'true',
  toggleSidebarCollapsed: () => set((state) => {
    const next = !state.isSidebarCollapsed;
    safeSetStorage('mindroot_sidebar_collapsed', String(next));
    return { isSidebarCollapsed: next };
  }),
  toggleRole: () => set((state) => {
    if (state.loginRole !== 'both') return {};
    const nextRole = state.role === 'student' ? 'teacher' : 'student';
    setAuthItem('mindroot_current_role', nextRole);
    return { role: nextRole };
  }),
  tokenBalance: initialUser ? initialUser.tokenBalance : 50,
  setTokenBalance: (balance) => set((state) => {
    if (state.currentUser) {
      const updatedUser = { ...state.currentUser, tokenBalance: balance };
      setAuthItem('mindroot_current_user', updatedUser);
      return { tokenBalance: balance, currentUser: updatedUser };
    }
    return { tokenBalance: balance };
  }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  currentUser: initialUser,
  setCurrentUser: (user) => set((state) => {
    if (user) {
      setAuthItem('mindroot_current_user', user);
      if (user.id && typeof window !== 'undefined' && !getAuthItem('mindroot_auth_token')) {
        setAuthItem('mindroot_auth_token', `dev-token-${user.id}`);
      }
      updateSocketAuth();
      api.syncNetworkUser(user);

      // Dynamically synchronize loginRole and active role if role is defined on user
      const userRole = user.role;
      let newLoginRole = state.loginRole;
      let newActiveRole = state.role;

      if (userRole === 'student' || userRole === 'teacher' || userRole === 'both' || userRole === 'admin') {
        newLoginRole = userRole;
        setAuthItem('mindroot_login_role', newLoginRole);

        if (userRole === 'student') {
          newActiveRole = 'student';
        } else if (userRole === 'teacher') {
          newActiveRole = 'teacher';
        } else if (userRole === 'admin') {
          newActiveRole = 'admin';
        }
        setAuthItem('mindroot_current_role', newActiveRole);
      }

      return { 
        currentUser: user, 
        tokenBalance: user.tokenBalance,
        loginRole: newLoginRole,
        role: newActiveRole
      };
    } else {
      removeAuthItem('mindroot_current_user');
      removeAuthItem('mindroot_auth_token');
      updateSocketAuth('');
      return { currentUser: null, tokenBalance: 50 };
    }
  }),
  login: (user, role) => {
    setAuthItem('mindroot_current_user', user);
    setAuthItem('mindroot_login_role', role);
    if (user && user.id && typeof window !== 'undefined' && !getAuthItem('mindroot_auth_token')) {
      setAuthItem('mindroot_auth_token', `dev-token-${user.id}`);
    }
    const calculatedRole = role === 'admin' ? 'admin' : (role === 'teacher' ? 'teacher' : 'student');
    setAuthItem('mindroot_current_role', calculatedRole);
    updateSocketAuth();
    api.syncNetworkUser(user);
    
    set({
      isLoggedIn: true,
      currentUser: user,
      tokenBalance: user ? user.tokenBalance : 50,
      loginRole: role,
      role: calculatedRole
    });
  },
  logout: () => {
    removeAuthItem('mindroot_current_user');
    removeAuthItem('mindroot_login_role');
    removeAuthItem('mindroot_current_role');
    removeAuthItem('mindroot_auth_token');
    updateSocketAuth('');
    set({
      isLoggedIn: false,
      currentUser: null,
      tokenBalance: 50,
      loginRole: 'student',
      role: 'student'
    });
  },
}));
