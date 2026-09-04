import { create } from 'zustand';
import { api, onPeersUpdated, safeSetStorage } from '../lib/api';

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
  } else {
    document.documentElement.classList.remove('dark');
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

// Read initial state from localStorage to prevent loss of state on refresh
const getInitialUser = () => {
  try {
    const stored = localStorage.getItem('mindroot_current_user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const initialUser = getInitialUser();
if (initialUser) {
  setTimeout(() => api.syncNetworkUser(initialUser), 500);
}

const initialRole = (localStorage.getItem('mindroot_current_role') as 'student' | 'teacher' | 'admin') || 'student';
const initialLoginRole = (localStorage.getItem('mindroot_login_role') as 'student' | 'teacher' | 'both' | 'admin') || 'both';

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
      safeSetStorage('mindroot_current_user', updatedUser);
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
    safeSetStorage('mindroot_current_role', nextRole);
    return { role: nextRole };
  }),
  tokenBalance: initialUser ? initialUser.tokenBalance : 50,
  setTokenBalance: (balance) => set((state) => {
    if (state.currentUser) {
      const updatedUser = { ...state.currentUser, tokenBalance: balance };
      safeSetStorage('mindroot_current_user', updatedUser);
      return { tokenBalance: balance, currentUser: updatedUser };
    }
    return { tokenBalance: balance };
  }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  currentUser: initialUser,
  setCurrentUser: (user) => set(() => {
    if (user) {
      safeSetStorage('mindroot_current_user', user);
      api.syncNetworkUser(user);
      return { currentUser: user, tokenBalance: user.tokenBalance };
    } else {
      localStorage.removeItem('mindroot_current_user');
      return { currentUser: null, tokenBalance: 50 };
    }
  }),
  login: (user, role) => {
    safeSetStorage('mindroot_current_user', user);
    safeSetStorage('mindroot_login_role', role);
    const calculatedRole = role === 'admin' ? 'admin' : (role === 'both' ? 'student' : (role === 'teacher' ? 'teacher' : 'student'));
    safeSetStorage('mindroot_current_role', calculatedRole);
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
    localStorage.removeItem('mindroot_current_user');
    localStorage.removeItem('mindroot_login_role');
    localStorage.removeItem('mindroot_current_role');
    localStorage.removeItem('mindroot_auth_token');
    set({
      isLoggedIn: false,
      currentUser: null,
      tokenBalance: 50,
      loginRole: 'both',
      role: 'student'
    });
  },
}));
