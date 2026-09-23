import { useAppStore } from '../../store/useAppStore';
import { useEffect, useState, useRef } from 'react';
import { api, globalSocket } from '../../lib/api';
import { Link, useNavigate } from 'react-router-dom';

import { useDebounce } from '../../hooks/useDebounce';

interface TopBarProps {
  onOpenMobileMenu?: () => void;
}

const COMMON_SKILLS = [
  'React', 'Python', 'UI Design', 'Figma', 'TypeScript', 'JavaScript', 
  'Java', 'Spring Boot', 'Node.js', 'Machine Learning', 'Data Structures', 
  'Web Development', 'Next.js', 'Tailwind CSS', 'Docker', 'AWS'
];

const NAVIGATION_PAGES = [
  { label: 'My Profile', icon: 'person', path: '/profile', desc: 'Edit bio, skills portfolio, and rate' },
  { label: 'Marketplace & Mentors', icon: 'storefront', path: '/marketplace', desc: 'Find peer mentors and group cohorts' },
  { label: 'Schedule & Bookings', icon: 'calendar_month', path: '/schedule', desc: 'View calendar and upcoming classes' },
  { label: 'Match Finder', icon: 'handshake', path: '/match-finder', desc: 'AI skill barter and exchange matches' },
  { label: 'Messages & Chat', icon: 'chat', path: '/messages', desc: 'Direct chat with peers and mentors' },
  { label: 'Payments & Wallet', icon: 'payments', path: '/wallet', desc: 'Razorpay payment receipts and earnings' },
  { label: 'Live Studio Room', icon: 'videocam', path: '/live/session-trio-batch-101', desc: 'Join active batch classroom' },
];

export function TopBar({ onOpenMobileMenu }: TopBarProps) {
  const role = useAppStore(state => state.role);
  const theme = useAppStore(state => state.theme);
  const setTheme = useAppStore(state => state.setTheme);
  const searchQuery = useAppStore(state => state.searchQuery);
  const setSearchQuery = useAppStore(state => state.setSearchQuery);
  const currentUser = useAppStore(state => state.currentUser);
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const notifications = useAppStore(state => state.notifications);
  const markNotificationsAsRead = useAppStore(state => state.markNotificationsAsRead);
  const clearNotifications = useAppStore(state => state.clearNotifications);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const [showArchitectureModal, setShowArchitectureModal] = useState(false);
  const [incomingPaymentAlert, setIncomingPaymentAlert] = useState<any>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [peers, setPeers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const themeContainerRef = useRef<HTMLDivElement>(null);
  const demoContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      api.getMe().then(setCurrentUser).catch(console.error);
    }
    api.getPeers().then(setPeers).catch(console.error);
    api.getSessions().then(setSessions).catch(console.error);
  }, [currentUser, setCurrentUser]);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchFocused(true);
      }
      if (e.key === 'Escape') {
        setIsSearchFocused(false);
        setShowThemeMenu(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for real-time payment alerts from students
  useEffect(() => {
    const onPaymentAlert = (data: any) => {
      setIncomingPaymentAlert(data);
    };
    globalSocket.on('teacher-payment-alert', onPaymentAlert);
    return () => {
      globalSocket.off('teacher-payment-alert', onPaymentAlert);
    };
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
      if (themeContainerRef.current && !themeContainerRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
      if (demoContainerRef.current && !demoContainerRef.current.contains(e.target as Node)) {
        setShowDemoMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConfirmPaymentAlert = async () => {
    if (!incomingPaymentAlert) return;
    try {
      await api.confirmSessionPayment(incomingPaymentAlert.sessionId);
      setDemoMessage('Payment confirmed! Classroom access unlocked.');
      setIncomingPaymentAlert(null);
      setTimeout(() => setDemoMessage(null), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDisputePaymentAlert = async () => {
    if (!incomingPaymentAlert) return;
    try {
      await api.raisePaymentDispute(
        incomingPaymentAlert.sessionId,
        'Mentor reported payment not received / UTR mismatch',
        incomingPaymentAlert.utrNumber,
        'mentor'
      );
      setDemoMessage('Dispute submitted to Admin.');
      setIncomingPaymentAlert(null);
      setTimeout(() => setDemoMessage(null), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickSwitchRole = (newRole: 'student' | 'teacher' | 'admin') => {
    if (newRole === 'student') {
      const student = {
        id: 'user-demo-student',
        name: 'Aarav Patel',
        email: 'aarav.patel@mindroot.com',
        role: 'student',
        trustScore: 4.95,
        avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=256&q=80',
        tokenBalance: 250,
        rewardPoints: 120
      };
      setCurrentUser(student);
      localStorage.setItem('mindroot_user_id', student.id);
      localStorage.setItem('mindroot_user_name', student.name);
      localStorage.setItem('mindroot_user_role', 'student');
      navigate('/dashboard');
    } else if (newRole === 'teacher') {
      const teacher = {
        id: 'user-demo-priya-mentor',
        name: 'Dr. Priya Sharma',
        email: 'priya.sharma@mindroot.com',
        role: 'teacher',
        trustScore: 4.98,
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80',
        tokenBalance: 480,
        hourlyRate: 499,
        officialIdType: 'faculty_id',
        officialIdNumber: 'FAC-2026-ENG-849',
        officialIdStatus: 'verified',
        upiId: 'priya.sharma@okaxis'
      };
      setCurrentUser(teacher);
      localStorage.setItem('mindroot_user_id', teacher.id);
      localStorage.setItem('mindroot_user_name', teacher.name);
      localStorage.setItem('mindroot_user_role', 'teacher');
      navigate('/dashboard');
    } else if (newRole === 'admin') {
      const admin = {
        id: 'user-admin',
        name: 'System Admin',
        email: 'admin@mindroot.com',
        role: 'admin',
        trustScore: 5.0,
        tokenBalance: 9999
      };
      setCurrentUser(admin);
      localStorage.setItem('mindroot_user_id', admin.id);
      localStorage.setItem('mindroot_user_name', admin.name);
      localStorage.setItem('mindroot_user_role', 'admin');
      navigate('/admin');
    }
    setShowDemoMenu(false);
  };

  const handleSeedDemo = async () => {
    setSeedingDemo(true);
    try {
      const res = await api.seedDemoSession();
      if (res?.success) {
        setDemoMessage('⚡ Live Demo Session created! Scheduled for Now.');
        setTimeout(() => setDemoMessage(null), 5000);
        navigate('/schedule');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSeedingDemo(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const query = debouncedSearchQuery.trim().toLowerCase();

  // Filter Matching Peers
  const matchingPeers = peers.filter(p => {
    if (!query) return false;
    const nameMatch = p.name?.toLowerCase().includes(query);
    const skillMatch = Array.isArray(p.skillsTaught) && p.skillsTaught.some((s: string) => s.toLowerCase().includes(query));
    const userSkillMatch = Array.isArray(p.userSkills) && p.userSkills.some((us: any) => us.skill?.name?.toLowerCase().includes(query));
    return nameMatch || skillMatch || userSkillMatch;
  }).slice(0, 4);

  // Filter Matching Skills
  const matchingSkills = COMMON_SKILLS.filter(s => {
    if (!query) return false;
    return s.toLowerCase().includes(query);
  }).slice(0, 5);

  // Filter Matching Sessions
  const matchingSessions = sessions.filter(s => {
    if (!query) return false;
    const titleMatch = s.title?.toLowerCase().includes(query);
    const teacherMatch = s.teacher?.name?.toLowerCase().includes(query);
    return titleMatch || teacherMatch;
  }).slice(0, 3);

  // Filter Matching Platform Navigation Pages
  const matchingPages = NAVIGATION_PAGES.filter(p => {
    if (!query) return true;
    return p.label.toLowerCase().includes(query) || p.desc.toLowerCase().includes(query);
  }).slice(0, 4);

  const hasAnyResults = matchingPeers.length > 0 || matchingSkills.length > 0 || matchingSessions.length > 0 || matchingPages.length > 0;

  const handleSelectResult = (path: string) => {
    setIsSearchFocused(false);
    navigate(path);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query) {
      setIsSearchFocused(false);
      navigate(`/marketplace?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <header className="h-[64px] flex items-center justify-between px-4 md:px-8 w-full bg-surface border-b border-outline-variant shadow-elevation-1 z-40 shrink-0 select-none">
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="md:hidden text-on-surface-variant hover:text-on-surface p-2 rounded-xl hover:bg-surface-container transition-colors"
          title="Open Menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        {/* Global Spotlight Search Input & Dropdown */}
        <div ref={searchContainerRef} className="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
          <form onSubmit={handleSearchSubmit} className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input 
              ref={searchInputRef}
              className="w-full pl-9 pr-16 py-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-xl text-xs font-medium text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-surface transition-all" 
              placeholder="Search skills, peers, sessions..." 
              type="text" 
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-on-surface-variant hover:text-on-surface rounded-full"
                title="Clear Search"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-0.5 absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-on-surface-variant bg-surface border border-outline-variant rounded shadow-xs pointer-events-none">
                ⌘K
              </span>
            )}
          </form>

          {/* Spotlight Search Results Dropdown */}
          {isSearchFocused && (
            <div className="absolute left-0 right-0 mt-2 bg-surface border border-outline-variant rounded-2xl shadow-elevation-3 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[460px] overflow-y-auto custom-scrollbar">
              {query && !hasAnyResults ? (
                <div className="p-6 text-center text-on-surface-variant text-xs">
                  <span className="material-symbols-outlined text-3xl text-outline mb-1">search_off</span>
                  <p className="font-bold text-on-surface">No results found for "{searchQuery}"</p>
                  <p className="text-[11px] text-on-surface-variant mt-1">Try searching for "React", "Python", "Maya", or "Cohort"</p>
                </div>
              ) : (
                <div className="p-2 space-y-3">
                  {/* Matching Peers / Mentors */}
                  {matchingPeers.length > 0 && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant px-2.5 py-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-primary">group</span>
                        <span>Mentors & Peers</span>
                      </div>
                      <div className="space-y-0.5 mt-1">
                        {matchingPeers.map(peer => (
                          <div
                            key={peer.id}
                            onClick={() => handleSelectResult(`/marketplace?peer=${peer.id}`)}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-container cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img src={peer.avatar || 'https://i.pravatar.cc/150?img=11'} alt={peer.name} className="w-7 h-7 rounded-full object-cover border border-outline-variant" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-on-surface truncate">{peer.name}</p>
                                <p className="text-[10px] text-on-surface-variant truncate">
                                  Teaches: {Array.isArray(peer.skillsTaught) ? peer.skillsTaught.join(', ') : 'Coding & Design'}
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-primary shrink-0">
                              ₹{peer.hourlyRate || 399}/hr
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Skills */}
                  {matchingSkills.length > 0 && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant px-2.5 py-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-teaching-emerald">school</span>
                        <span>Skills & Topics</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 px-2 mt-1">
                        {matchingSkills.map(skill => (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => handleSelectResult(`/marketplace?skill=${encodeURIComponent(skill)}`)}
                            className="px-2.5 py-1 bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1 hover:bg-teaching-emerald-container/80"
                          >
                            <span>{skill}</span>
                            <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Sessions */}
                  {matchingSessions.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant px-2.5 py-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-primary">videocam</span>
                        <span>Live Classes & Cohorts</span>
                      </div>
                      <div className="space-y-0.5 mt-1">
                        {matchingSessions.map(session => (
                          <div
                            key={session.id}
                            onClick={() => handleSelectResult(`/live/${session.id}`)}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-container cursor-pointer transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-on-surface truncate">{session.title}</p>
                              <p className="text-[10px] text-on-surface-variant">
                                {session.maxCapacity ? `${session.maxCapacity}-Student Batch` : '1-on-1'} · Teacher: {session.teacher?.name || 'Mentor'}
                              </p>
                            </div>
                            <span className="px-2 py-0.5 bg-surface-container text-primary border border-outline-variant text-[10px] font-semibold rounded-md shrink-0">
                              Join Room
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Platform Navigation Pages */}
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant px-2.5 py-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-on-surface-variant">explore</span>
                      <span>Quick Navigation</span>
                    </div>
                    <div className="space-y-0.5 mt-1">
                      {matchingPages.map(page => (
                        <div
                          key={page.path}
                          onClick={() => handleSelectResult(page.path)}
                          className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-surface-container cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-base text-on-surface-variant">{page.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-on-surface">{page.label}</p>
                            <p className="text-[10px] text-on-surface-variant truncate">{page.desc}</p>
                          </div>
                          <span className="material-symbols-outlined text-xs text-outline">chevron_right</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Dropdown Footer */}
              <div className="p-2 border-t border-outline-variant bg-surface-container-low flex items-center justify-between text-[11px] text-on-surface-variant font-medium px-3">
                <span>Press <strong className="font-mono text-on-surface">Enter</strong> to search all in Marketplace</span>
                <span><strong className="font-mono text-on-surface">Esc</strong> to close</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Link 
          to="/wallet"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-teaching-emerald-container hover:bg-teaching-emerald-container/80 rounded-xl border border-teaching-emerald/20 text-on-teaching-emerald-container transition-colors cursor-pointer"
          title="Open Payments & Earnings Wallet"
        >
          <span className="material-symbols-outlined text-teaching-emerald text-base">payments</span>
          <span className="text-xs font-bold">Payments & Wallet</span>
        </Link>
        <Link 
          to="/wallet"
          className="flex sm:hidden items-center gap-1 px-2.5 py-1 bg-teaching-emerald-container rounded-lg border border-teaching-emerald/20 text-[11px] font-bold text-on-teaching-emerald-container shrink-0"
        >
          <span className="material-symbols-outlined text-sm">payments</span>
          <span>Wallet</span>
        </Link>
        <div className="hidden sm:block px-3 py-1 bg-surface-container rounded-xl border border-outline-variant">
          <span className="text-xs font-semibold text-on-surface-variant capitalize">{role} Mode</span>
        </div>

        {/* 5th-Sem / Hackathon Demo Suite Dropdown */}
        <div ref={demoContainerRef} className="relative">
          <button
            onClick={() => setShowDemoMenu(prev => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-black transition-all shadow-xs"
            title="Switch Demo Persona or Seed 1-Minute Live Demo"
          >
            <span className="material-symbols-outlined text-base">bolt</span>
            <span className="hidden md:inline">Demo Suite</span>
            <span className="material-symbols-outlined text-xs">arrow_drop_down</span>
          </button>

          {showDemoMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-surface border border-outline-variant rounded-2xl shadow-elevation-3 z-50 p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1 border-b border-outline-variant/60">
                <p className="text-[10px] font-black uppercase tracking-wider text-primary">5th-Sem Presentation Suite</p>
                <p className="text-[11px] text-on-surface-variant font-medium">Switch persona or seed 1-min live demo</p>
              </div>

              <div className="space-y-0.5">
                <button
                  onClick={() => handleQuickSwitchRole('student')}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold text-on-surface hover:bg-surface-container transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-primary">school</span>
                    <div>
                      <p className="leading-tight">Aarav Patel</p>
                      <p className="text-[10px] text-on-surface-variant font-normal">Student Persona</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-mono">Learner</span>
                </button>

                <button
                  onClick={() => handleQuickSwitchRole('teacher')}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold text-on-surface hover:bg-surface-container transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-teaching-emerald">workspace_premium</span>
                    <div>
                      <p className="leading-tight">Dr. Priya Sharma</p>
                      <p className="text-[10px] text-on-surface-variant font-normal">Verified Mentor (Faculty ID)</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 bg-teaching-emerald/15 text-teaching-emerald rounded font-mono">Mentor</span>
                </button>

                <button
                  onClick={() => handleQuickSwitchRole('admin')}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold text-on-surface hover:bg-surface-container transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-trust-purple">admin_panel_settings</span>
                    <div>
                      <p className="leading-tight">System Admin</p>
                      <p className="text-[10px] text-on-surface-variant font-normal">Approvals & Disputes</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 bg-trust-purple/15 text-trust-purple rounded font-mono">Admin</span>
                </button>
              </div>

              <div className="pt-1 border-t border-outline-variant/60">
                <button
                  onClick={handleSeedDemo}
                  disabled={seedingDemo}
                  className="w-full py-2 px-3 bg-gradient-to-r from-primary to-primary-hover text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">rocket_launch</span>
                  <span>{seedingDemo ? 'Seeding Demo...' : '⚡ Seed 1-Min Live Demo'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Project Specs & Architecture Button for Professor Q&A */}
        <button
          onClick={() => setShowArchitectureModal(true)}
          className="hidden md:flex items-center gap-1 px-2.5 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant rounded-xl text-xs font-bold transition-colors"
          title="Project Architecture & Syllabus Specs for Professor Evaluation"
        >
          <span className="material-symbols-outlined text-base">architecture</span>
          <span>Specs</span>
        </button>

        {/* Theme Toggle Button & Dropdown Menu */}
        <div ref={themeContainerRef} className="relative">
          <button
            onClick={() => setShowThemeMenu(prev => !prev)}
            aria-label="Toggle theme mode"
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full transition-colors relative flex items-center justify-center"
            title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
          >
            <span className="material-symbols-outlined transition-transform duration-200">
              {theme === 'dark' ? 'dark_mode' : theme === 'light' ? 'light_mode' : 'desktop_windows'}
            </span>
          </button>

          {showThemeMenu && (
            <div className="absolute right-0 mt-2 w-36 bg-surface border border-outline-variant rounded-2xl shadow-elevation-3 z-50 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => { setTheme('light'); setShowThemeMenu(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  theme === 'light' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base">light_mode</span>
                <span>Light</span>
              </button>
              <button
                onClick={() => { setTheme('dark'); setShowThemeMenu(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  theme === 'dark' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base">dark_mode</span>
                <span>Dark</span>
              </button>
              <button
                onClick={() => { setTheme('system'); setShowThemeMenu(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  theme === 'system' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base">desktop_windows</span>
                <span>System</span>
              </button>
            </div>
          )}
        </div>

        {/* Notifications Icon and Dropdown Panel */}
        <div className="relative">
          <button 
            onClick={() => {
              setShowNotifications((prev: boolean) => !prev);
              if (!showNotifications && unreadCount > 0) {
                markNotificationsAsRead();
              }
            }}
            aria-label="Notifications"
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full transition-colors relative"
            title="View Notifications"
          >
            <span className="material-symbols-outlined">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-alert-rose text-on-alert-rose rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-surface">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface border border-outline-variant rounded-2xl shadow-elevation-3 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3.5 border-b border-outline-variant bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-on-surface">Notifications</h4>
                  {unreadCount > 0 && (
                    <span className="bg-primary-container text-on-primary-container text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <button 
                      onClick={clearNotifications}
                      className="text-[11px] font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                  <button 
                    onClick={() => setShowNotifications(false)}
                    className="text-on-surface-variant hover:text-on-surface p-0.5 rounded-lg"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-outline-variant bg-surface">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-on-surface-variant space-y-2">
                    <span className="material-symbols-outlined text-3xl text-outline">notifications_off</span>
                    <p className="text-xs font-semibold text-on-surface">No notifications yet</p>
                    <p className="text-[11px] text-on-surface-variant">You'll receive alerts for messages & session reminders here.</p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <Link
                      key={item.id}
                      to={item.link || '#'}
                      onClick={() => setShowNotifications(false)}
                      className={`p-3.5 flex items-start gap-3 hover:bg-surface-container transition-colors ${!item.read ? 'bg-primary-container/40' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white ${item.type === 'reminder' ? 'bg-learning-amber' : 'bg-primary'}`}>
                        <span className="material-symbols-outlined text-sm">{item.type === 'reminder' ? 'alarm' : 'chat'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h5 className="text-xs font-bold text-on-surface truncate">{item.title}</h5>
                          <span className="text-[10px] font-medium text-on-surface-variant shrink-0">{item.time}</span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant font-medium line-clamp-2 leading-relaxed">{item.body}</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <Link to="/profile" className="flex items-center gap-2.5 pl-2 border-l border-outline-variant group cursor-pointer">
          <div className="relative">
            <img 
              alt="User Profile"
              className="w-8 h-8 rounded-full object-cover border border-outline-variant group-hover:border-primary transition-colors" 
              src={currentUser?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuAaAgIRwgg6AHDtczrU68mOSN4JcfnjovtSCOiLGT7b9aHQCCSmWVuhAowg82R3WeVuVFHWlSJCTam-aKq6HmH9QkteM5OmXlo5HupxoJgAQbhfykTOUjpS9nDTbUCsSltlwdhwMOFZs_TfIAC5jK9XGG5vjaH5AjFw4YeTAltPCkVfGvG5iu96iuovUv1BOnte-ybUhtOGFPRZJjrrUjcCKz4MN4fI8bDiKqAzLSz-NAtJkERLcuf7"} 
            />
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-teaching-emerald rounded-full ring-2 ring-surface" />
          </div>
          {currentUser && (
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors">{currentUser.name}</span>
              <span className="text-[10px] text-on-surface-variant capitalize font-medium">
                {currentUser?.role === 'both' ? `${role} (Hybrid)` : (currentUser?.role || role)}
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Real-time Student Payment Alert Floating Toast for Teacher */}
      {incomingPaymentAlert && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-in slide-in-from-top-3 duration-200">
          <div className="bg-surface border-2 border-learning-amber shadow-elevation-4 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-learning-amber/15 text-learning-amber flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">payments</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-on-surface flex items-center gap-1.5">
                  <span>Student UPI Payment Submitted</span>
                  <span className="px-1.5 py-0.2 bg-learning-amber/20 text-learning-amber rounded text-[10px] font-mono font-bold">
                    UTR: {incomingPaymentAlert.utrNumber}
                  </span>
                </p>
                <p className="text-[11px] text-on-surface-variant truncate">
                  <strong>{incomingPaymentAlert.studentName}</strong> sent <strong>₹{incomingPaymentAlert.amount}</strong> via UPI.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleConfirmPaymentAlert}
                className="px-3 py-1.5 bg-teaching-emerald hover:bg-teaching-emerald/90 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
              >
                <span className="material-symbols-outlined text-sm">check</span>
                <span>Confirm</span>
              </button>
              <button
                onClick={handleDisputePaymentAlert}
                className="px-2.5 py-1.5 bg-alert-rose/10 hover:bg-alert-rose/20 text-alert-rose rounded-xl text-xs font-bold transition-colors"
                title="Dispute payment"
              >
                <span className="material-symbols-outlined text-sm">flag</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Demo Status Message Toast */}
      {demoMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-auto px-4 animate-in fade-in duration-200">
          <div className="bg-primary text-on-primary shadow-elevation-3 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">info</span>
            <span>{demoMessage}</span>
          </div>
        </div>
      )}

      {/* Project Specs & Architecture Modal for Professor Evaluation */}
      {showArchitectureModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-outline-variant rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-elevation-3 p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-outline-variant/60 pb-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold mb-1">
                  <span className="material-symbols-outlined text-xs">school</span>
                  <span>5th Semester Academic Project Specifications</span>
                </div>
                <h3 className="text-xl font-black text-on-surface">Mindroot: Peer-to-Peer Academic Skill Exchange</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Decentralized Student-to-Student Mentorship with Direct P2P UPI Settlements
                </p>
              </div>
              <button
                onClick={() => setShowArchitectureModal(false)}
                className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Architecture Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/60 space-y-1.5">
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <span className="material-symbols-outlined text-base">devices</span>
                  <span>Frontend Architecture</span>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  React 19 with TypeScript, Vite bundler, Tailwind CSS design system, and Zustand global state store. Responsive across mobile and desktop.
                </p>
              </div>

              <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/60 space-y-1.5">
                <div className="flex items-center gap-2 text-teaching-emerald font-bold text-xs">
                  <span className="material-symbols-outlined text-base">dns</span>
                  <span>Backend & Real-Time Engine</span>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Node.js Express REST API, Socket.io bidirectional signaling channel, WebRTC peer-to-peer video mesh, and automated email trigger workers.
                </p>
              </div>

              <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/60 space-y-1.5">
                <div className="flex items-center gap-2 text-learning-amber font-bold text-xs">
                  <span className="material-symbols-outlined text-base">qr_code_scanner</span>
                  <span>P2P UPI Settlement Layer</span>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Zero-fee student-to-mentor direct UPI transfers with dynamic QR generation, UTR verification, provisional access, and Admin dispute escalation.
                </p>
              </div>

              <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/60 space-y-1.5">
                <div className="flex items-center gap-2 text-trust-purple font-bold text-xs">
                  <span className="material-symbols-outlined text-base">verified_user</span>
                  <span>Academic Credential Verification</span>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  College/Faculty ID upload and validation, verified trust badges, downloadable mentorship certificates, and community moderation.
                </p>
              </div>
            </div>

            {/* Quick Summary for Professor */}
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 space-y-1">
              <p className="text-xs font-black text-primary">Academic Evaluation Highlights:</p>
              <ul className="text-[11px] text-on-surface-variant space-y-1 list-disc list-inside">
                <li>Eliminates corporate intermediary fees by routing funds peer-to-peer directly into mentor accounts.</li>
                <li>Built-in collaborative study scratchpad that auto-saves session notes to student dashboards.</li>
                <li>Standard RFC-5545 `.ics` and Google Calendar 1-click scheduling sync.</li>
                <li>Comprehensive Admin moderation dashboard with audit logging and dispute resolution.</li>
              </ul>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowArchitectureModal(false)}
                className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-bold transition-colors"
              >
                Close Specs
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
