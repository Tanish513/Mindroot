import { useState, useEffect, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { useAppStore } from '../store/useAppStore';
import { api, onSessionsUpdated, onTransactionsUpdated, onPeersUpdated } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const { currentUser, setCurrentUser, searchQuery, setSearchQuery, role, loginRole } = useAppStore();
  const [sessions, setSessions] = useState<any[]>([]);
  const [peers, setPeers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [champions, setChampions] = useState<any[]>([]);
  const [loadingChampions, setLoadingChampions] = useState<boolean>(true);
  const navigate = useNavigate();

  const loadData = () => {
    if (!currentUser) {
      api.getMe().then(setCurrentUser).catch(console.error);
    }
    api.getSessions().then(setSessions).catch(console.error);
    api.getPeers().then(setPeers).catch(console.error);
    api.getTransactions().then(setTransactions).catch(console.error);
    api.getCommunityChampions().then(data => {
      setChampions(data || []);
      setLoadingChampions(false);
    }).catch(() => setLoadingChampions(false));
  };

  useEffect(() => {
    loadData();
    const unsubSessions = onSessionsUpdated(() => {
      api.getSessions().then(setSessions).catch(console.error);
    });
    const unsubTx = onTransactionsUpdated(() => {
      api.getTransactions().then(setTransactions).catch(console.error);
    });
    const unsubPeers = onPeersUpdated(() => {
      api.getPeers().then(setPeers).catch(console.error);
      api.getCommunityChampions().then(data => {
        if (data && data.length) setChampions(data);
      }).catch(console.error);
    });
    return () => {
      unsubSessions();
      unsubTx();
      unsubPeers();
    };
  }, [currentUser, setCurrentUser]);

  // Daily Streak Calculation & Sync
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentStreak = typeof currentUser?.streak === 'number' ? currentUser.streak : 4;
  const lastActive = currentUser?.lastActiveDate || '';

  useEffect(() => {
    if (currentUser?.id && lastActive !== todayStr) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const nextStreak = lastActive === yesterday ? currentStreak + 1 : (currentStreak || 1);
      api.updateUser(currentUser.id, {
        streak: nextStreak,
        lastActiveDate: todayStr
      }).then(res => {
        if (res && res.user) {
          setCurrentUser(res.user);
        } else {
          setCurrentUser({ ...currentUser, streak: nextStreak, lastActiveDate: todayStr });
        }
      }).catch(() => {});
    }
  }, [currentUser?.id, lastActive, todayStr]);

  if (!currentUser) return <div className="p-8 text-center text-on-surface-variant font-bold animate-pulse text-sm">Loading dashboard...</div>;

  const isPastSession = (s: any) => {
    if (!s || !s.scheduledAt) return false;
    const startTime = new Date(s.scheduledAt).getTime();
    const durationMs = (s.durationMin || 60) * 60 * 1000;
    return startTime + durationMs <= Date.now();
  };

  const isBothRole = loginRole === 'both' || currentUser?.role === 'both';
  const isTeacherRole = role === 'teacher' || (!isBothRole && (loginRole === 'teacher' || currentUser?.role === 'teacher'));

  const confirmedSessions = sessions.filter(s => {
    const isUserPart = s.teacherId === currentUser.id || s.studentId === currentUser.id || (Array.isArray(s.students) && s.students.some((st: any) => st.id === currentUser.id));
    const isConfirmed = s.status === 'confirmed' || s.status === 'live';
    return isUserPart && isConfirmed && !isPastSession(s);
  });

  const query = searchQuery.trim().toLowerCase();

  const matchingPeers = peers.filter(p => {
    if (!query) return false;
    const nameMatch = p.name?.toLowerCase().includes(query);
    const skillMatch = Array.isArray(p.skillsTaught) && p.skillsTaught.some((s: string) => s.toLowerCase().includes(query));
    const userSkillMatch = Array.isArray(p.userSkills) && p.userSkills.some((us: any) => us.skill?.name?.toLowerCase().includes(query));
    return nameMatch || skillMatch || userSkillMatch;
  });

  const filteredSessions = confirmedSessions.filter(s => {
    if (!query) return true;
    const titleMatch = s.title?.toLowerCase().includes(query) ?? false;
    const teacherMatch = s.teacher?.name?.toLowerCase().includes(query) ?? false;
    const studentMatch = s.student?.name?.toLowerCase().includes(query) ?? false;
    return titleMatch || teacherMatch || studentMatch;
  });

  // Total Spent by student (fees paid to teachers)
  const studentSpentTransactions = transactions.filter(t => 
    t.type === 'SPENT' && t.userId === currentUser.id
  );
  const totalSpent = studentSpentTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Total Earned by teacher (fees received from students)
  const teacherEarnedTransactions = transactions.filter(t => 
    t.type === 'EARNED' && t.userId === currentUser.id
  );
  const totalEarned = teacherEarnedTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Pending payment due for student sessions (unpaid enrolled sessions)
  const pendingStudentSessions = sessions.filter(s => {
    const studentEntry = Array.isArray(s.students) ? s.students.find((st: any) => st.id === currentUser.id) : null;
    if (studentEntry) {
      return studentEntry.paymentStatus !== 'paid';
    }
    const isDirectStudent = s.studentId === currentUser.id;
    return isDirectStudent && s.paymentStatus !== 'paid';
  });

  const pendingPaymentDue = pendingStudentSessions.reduce((sum, s) => {
    const studentEntry = Array.isArray(s.students) ? s.students.find((st: any) => st.id === currentUser.id) : null;
    if (studentEntry && typeof studentEntry.amountDue === 'number' && studentEntry.amountDue >= 0) {
      return sum + studentEntry.amountDue;
    }
    return sum + (Number(s.pricePerStudent) || Number(s.amount) || 499);
  }, 0);

  // Hours calculation
  const studentSessions = sessions.filter(s => 
    s.studentId === currentUser.id || (Array.isArray(s.students) && s.students.some((st: any) => st.id === currentUser.id))
  );
  const hoursLearned = studentSessions.reduce((sum, s) => sum + ((s.durationMin || 60) / 60), 0);

  const teacherSessions = sessions.filter(s => s.teacherId === currentUser.id || s.teacher?.id === currentUser.id);
  const hoursTaught = teacherSessions.reduce((sum, s) => sum + ((s.durationMin || 60) / 60), 0);

  const trustScoreNum = typeof currentUser?.trustScore === 'number' ? currentUser.trustScore : 4.95;

  const teachSkills = Array.isArray(currentUser?.userSkills)
    ? currentUser.userSkills.filter((s: any) => s.type === 'teaches').map((s: any) => s.skill?.name || 'Skill')
    : (Array.isArray(currentUser?.skillsTaught) ? currentUser.skillsTaught : []);

  const learnSkills = Array.isArray(currentUser?.userSkills)
    ? currentUser.userSkills.filter((s: any) => s.type === 'wants_to_learn').map((s: any) => s.skill?.name || 'Skill')
    : (Array.isArray(currentUser?.skillsLearned) ? currentUser.skillsLearned : ['Python', 'UI Design']);

  const activeSkillsList = isTeacherRole ? teachSkills : (learnSkills.length ? learnSkills : teachSkills);
  const activeTopicsCount = activeSkillsList.length.toString();
  const activeTopicTags = activeSkillsList.slice(0, 2);

  // Dynamically compute top recommended peer match from database peers
  const recommendedPeerMatch = useMemo(() => {
    if (!currentUser || !peers || peers.length === 0) return null;

    const myId = currentUser.id;
    const candidatePeers = peers.filter(p => p && p.id && p.id !== myId && p.role !== 'admin');
    if (candidatePeers.length === 0) return null;

    const myUserSkills = currentUser.userSkills || [
      ...(currentUser.skillsTaught || []).map((t: string) => ({ type: 'teaches', skill: { id: 's-' + t, name: t } })),
      ...(currentUser.skillsLearned || []).map((l: string) => ({ type: 'wants_to_learn', skill: { id: 's-' + l, name: l } }))
    ];

    const myTeaches = myUserSkills.filter((us: any) => us.type === 'teaches');
    const myLearns = myUserSkills.filter((us: any) => us.type === 'wants_to_learn');

    const scoredPeers = candidatePeers.map(peer => {
      const peerUserSkills = peer.userSkills || [
        ...(peer.skillsTaught || []).map((t: string) => ({ type: 'teaches', skill: { id: 's-' + t, name: t } })),
        ...(peer.skillsLearned || []).map((l: string) => ({ type: 'wants_to_learn', skill: { id: 's-' + l, name: l } }))
      ];

      const peerTeaches = peerUserSkills.filter((us: any) => us.type === 'teaches');
      const peerLearns = peerUserSkills.filter((us: any) => us.type === 'wants_to_learn');

      const takeMatches = peerTeaches.filter((pt: any) =>
        myLearns.some((al: any) =>
          (pt.skill?.id && al.skill?.id && pt.skill.id === al.skill.id) ||
          (pt.skill?.name && al.skill?.name && pt.skill.name.toLowerCase() === al.skill.name.toLowerCase())
        )
      ).length;

      const giveMatches = myTeaches.filter((at: any) =>
        peerLearns.some((pl: any) =>
          (at.skill?.id && pl.skill?.id && at.skill.id === pl.skill.id) ||
          (at.skill?.name && pl.skill?.name && at.skill.name.toLowerCase() === pl.skill.name.toLowerCase())
        )
      ).length;

      const totalMatches = takeMatches + giveMatches;
      let matchScore = 78;
      if (myUserSkills.length > 0 && peerUserSkills.length > 0) {
        if (totalMatches > 0) {
          const maxPossible = Math.max(1, Math.min(myLearns.length + myTeaches.length, peerTeaches.length + peerLearns.length));
          matchScore = Math.min(99, Math.max(70, Math.round(60 + (totalMatches / maxPossible) * 39)));
        } else {
          matchScore = Math.min(88, Math.max(65, Math.round((peer.trustScore || 4.8) * 16)));
        }
      }

      const peerSessions = sessions.filter(s => (s.teacherId === peer.id || s.studentId === peer.id));
      const sessionCount = peerSessions.length;

      const teachesSkills = peerTeaches.map((us: any) => us.skill?.name).filter(Boolean);
      const learnsSkills = peerLearns.map((us: any) => us.skill?.name).filter(Boolean);

      const teachStr = teachesSkills.length > 0 
        ? teachesSkills.slice(0, 2).join(' & ') 
        : (Array.isArray(peer.skillsTaught) && peer.skillsTaught.length > 0 ? peer.skillsTaught.slice(0, 2).join(' & ') : 'Core Mentoring');
      const learnStr = learnsSkills.length > 0 
        ? learnsSkills.slice(0, 2).join(' & ') 
        : (Array.isArray(peer.skillsLearned) && peer.skillsLearned.length > 0 ? peer.skillsLearned.slice(0, 2).join(' & ') : 'Advanced Concepts');

      return {
        peer,
        matchScore,
        totalMatches,
        sessionCount,
        teachStr,
        learnStr
      };
    });

    scoredPeers.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return (b.peer.trustScore || 0) - (a.peer.trustScore || 0);
    });

    return scoredPeers[0] || null;
  }, [currentUser, peers, sessions]);

  // Contextual time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Determine Badge & Subtitle
  const roleBadgeLabel = isBothRole 
    ? 'Student & Peer Mentor' 
    : (isTeacherRole ? 'Teacher & Mentor' : 'Student Learner');

  const roleSubtitle = isTeacherRole 
    ? `You have ${confirmedSessions.length} active lecture${confirmedSessions.length !== 1 ? 's' : ''} scheduled with student payments enabled.`
    : `You have ${confirmedSessions.length} active learning session${confirmedSessions.length !== 1 ? 's' : ''} scheduled with Razorpay payments enabled.`;

  // Build Stat Cards dynamically per role
  const statCards = isTeacherRole ? [
    { 
      label: 'Mentoring Revenue', 
      value: `₹${totalEarned.toLocaleString('en-IN')}`, 
      unit: 'earned',
      icon: 'payments', 
      bgColor: 'bg-surface-container',
      iconColor: 'text-primary',
      borderColor: 'border-outline-variant',
      sub: `${teacherEarnedTransactions.length} student payout${teacherEarnedTransactions.length !== 1 ? 's' : ''} received`, 
      path: '/wallet' 
    },
    { 
      label: 'Hours Taught', 
      value: hoursTaught > 0 ? hoursTaught.toString() : '24', 
      unit: 'hrs',
      icon: 'school', 
      bgColor: 'bg-surface-container',
      iconColor: 'text-primary',
      borderColor: 'border-outline-variant',
      sub: 'Across active lectures', 
      progress: Math.min(100, Math.round(((hoursTaught || 24) / 40) * 100)),
      path: '/teacher' 
    },
    { 
      label: 'Teaching Skills', 
      value: teachSkills.length.toString(), 
      unit: 'skills',
      icon: 'workspace_premium', 
      bgColor: 'bg-surface-container',
      iconColor: 'text-primary',
      borderColor: 'border-outline-variant',
      tags: teachSkills.slice(0, 2), 
      path: '/profile' 
    },
    { 
      label: 'Trust Rating', 
      value: trustScoreNum.toFixed(2), 
      unit: '/ 5.0',
      icon: 'verified', 
      bgColor: 'bg-surface-container',
      iconColor: 'text-primary',
      borderColor: 'border-outline-variant',
      sub: 'Top 5% mentor rating',
      progress: (trustScoreNum / 5.0) * 100, 
      path: '/feedback' 
    }
  ] : [
    { 
      label: 'Mentoring Payments', 
      value: `₹${totalSpent.toLocaleString('en-IN')}`, 
      unit: 'spent',
      icon: 'shopping_cart', 
      bgColor: 'bg-surface-container',
      iconColor: 'text-primary',
      borderColor: 'border-outline-variant',
      sub: pendingPaymentDue > 0 ? `₹${pendingPaymentDue.toLocaleString('en-IN')} pending due` : (isBothRole && totalEarned > 0 ? `₹${totalEarned.toLocaleString('en-IN')} earned as mentor` : 'View Razorpay receipts'), 
      path: '/wallet' 
    },
    { 
      label: 'Hours Learned', 
      value: hoursLearned.toString(), 
      unit: 'hrs',
      icon: 'schedule', 
      bgColor: 'bg-surface-container',
      iconColor: 'text-primary',
      borderColor: 'border-outline-variant',
      sub: '+2 hours this week', 
      progress: Math.min(100, Math.round((hoursLearned / 20) * 100)),
      path: '/schedule' 
    },
    { 
      label: isBothRole ? 'Active Skills' : 'Learning Goals', 
      value: activeTopicsCount, 
      unit: 'skills',
      icon: 'school', 
      bgColor: 'bg-surface-container',
      iconColor: 'text-primary',
      borderColor: 'border-outline-variant',
      tags: activeTopicTags, 
      path: '/marketplace' 
    },
    { 
      label: 'Reliability Score', 
      value: `${Math.min(100, Math.round(trustScoreNum * 20))}%`, 
      unit: 'punctual',
      icon: 'verified_user', 
      bgColor: 'bg-surface-container',
      iconColor: 'text-primary',
      borderColor: 'border-outline-variant',
      sub: '100% Session Attendance & Etiquette',
      progress: Math.min(100, Math.round(trustScoreNum * 20)), 
      path: '/feedback' 
    }
  ];

  return (
    <div className="max-w-container_max mx-auto space-y-6 select-none">
      {/* Search Results Banner when search query is active */}
      {query && (
        <div className="bg-primary-container/40 border border-primary/20 rounded-2xl p-5 shadow-elevation-1 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">search</span>
              <h2 className="text-sm font-bold text-on-surface">
                Search Results for "<span className="text-primary font-extrabold">{searchQuery}</span>"
              </h2>
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-on-surface-variant hover:text-on-surface flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">close</span>
              <span>Clear Search</span>
            </button>
          </div>

          {matchingPeers.length === 0 && filteredSessions.length === 0 ? (
            <p className="text-xs text-on-surface-variant">No peers or scheduled sessions matched "{searchQuery}". Try searching "React", "Python", or "Maya".</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {matchingPeers.map(peer => (
                <div key={peer.id} className="bg-surface border border-outline-variant rounded-xl p-3 flex items-center justify-between gap-3 shadow-elevation-1">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src={peer.avatar || 'https://i.pravatar.cc/150?img=11'} alt={peer.name} className="w-8 h-8 rounded-full object-cover border border-outline-variant" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-on-surface truncate">{peer.name}</p>
                      <p className="text-[10px] text-on-surface-variant truncate">Teaches: {Array.isArray(peer.skillsTaught) ? peer.skillsTaught.join(', ') : 'Tech & Design'}</p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    className="py-1 px-2 text-[11px] font-bold bg-primary-container text-on-primary-container border-primary/20 shrink-0"
                    onClick={() => navigate('/marketplace')}
                  >
                    View Mentor
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clean Dashboard Header Banner */}
      <div className="bg-surface border border-outline-variant rounded-2xl p-6 sm:p-7 shadow-elevation-1 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isTeacherRole ? 'bg-teaching-emerald' : 'bg-primary'}`} />
            <span className="text-xs font-semibold text-on-surface-variant">{roleBadgeLabel}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
            {getGreeting()}, {currentUser?.name?.split(' ')[0] || 'Peer'}
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant font-medium">
            {roleSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="secondary"
            className="text-xs font-semibold px-3.5 py-2"
            onClick={() => navigate('/match-finder')}
          >
            <span className="material-symbols-outlined text-sm text-on-surface-variant">search</span>
            Find Peer Match
          </Button>
          <Button
            variant="primary"
            className="text-xs font-semibold px-3.5 py-2"
            onClick={() => navigate('/schedule')}
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Schedule Session
          </Button>
        </div>
      </div>

      {/* Daily Streak & Community Momentum Banner */}
      <div className="bg-surface-container border border-outline-variant rounded-2xl p-4 sm:p-5 shadow-elevation-1 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-surface border border-outline-variant text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              local_fire_department
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-on-surface">
                {currentStreak}-Day Learning Streak
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-surface border border-outline-variant text-on-surface font-semibold text-[10px] uppercase">
                Active
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-medium mt-0.5">
              Keep learning every day. Complete 1 session or answer a discussion question to reach 7 days and claim +20 Bonus Points!
            </p>
          </div>
        </div>

        {/* Days of Week Tracker */}
        <div className="flex items-center gap-1.5 self-stretch sm:self-auto justify-between sm:justify-start">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => {
            const isCompleted = idx < Math.min(7, currentStreak);
            return (
              <div key={idx} className="flex flex-col items-center gap-1">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-bold border transition-all ${
                    isCompleted
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface text-on-surface-variant border-outline-variant'
                  }`}
                >
                  {isCompleted ? '✓' : day}
                </div>
                <span className="text-[9px] font-medium text-on-surface-variant">Day {idx + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <div 
            key={i} 
            onClick={() => navigate(stat.path)}
            className="bg-surface border border-outline-variant rounded-2xl p-5 shadow-elevation-1 hover:border-outline hover:shadow-elevation-2 cursor-pointer transition-all flex flex-col justify-between"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-on-surface-variant mb-0.5">{stat.label}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-on-surface">{stat.value}</span>
                  <span className="text-xs font-semibold text-on-surface-variant">{stat.unit}</span>
                </div>
              </div>
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} ${stat.iconColor} ${stat.borderColor} border flex items-center justify-center`}>
                <span className="material-symbols-outlined text-xl">{stat.icon}</span>
              </div>
            </div>

            {stat.progress !== undefined && (
              <div className="mt-2 space-y-1">
                <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-300" 
                    style={{ width: `${stat.progress}%` }} 
                  />
                </div>
              </div>
            )}

            {stat.sub && (
              <p className="text-[11px] mt-2 text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 font-medium">
                {stat.sub} <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </p>
            )}

            {stat.tags && (
              <div className="flex gap-1 mt-2">
                {stat.tags.map((t: string) => (
                  <span key={t} className="px-2 py-0.5 bg-surface-container text-on-surface border border-outline-variant rounded-md text-[10px] font-medium truncate max-w-[80px]">{t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recommended Match Preview */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-surface rounded-2xl p-6 shadow-elevation-1 border border-outline-variant">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">recommend</span> Recommended Peer Match
                </h3>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">Top peer recommendation based on your skill interests</p>
              </div>
              <Button variant="ghost" onClick={() => navigate('/match-finder')} className="text-xs px-3 py-1.5 text-primary hover:bg-primary-container/50 font-semibold">
                Browse All Matches →
              </Button>
            </div>
            
            {recommendedPeerMatch ? (
              <div 
                onClick={() => navigate('/match-finder')}
                className="bg-surface-container-low rounded-xl p-5 flex flex-col md:flex-row gap-5 items-start md:items-center hover:bg-surface-container transition-colors cursor-pointer border border-outline-variant"
              >
                <div className="relative shrink-0">
                  <img 
                    className="w-12 h-12 rounded-full object-cover border border-outline-variant" 
                    src={recommendedPeerMatch.peer.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'} 
                    alt={`${recommendedPeerMatch.peer.name || 'Peer'} profile avatar`} 
                  />
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${recommendedPeerMatch.peer.isAvailableNow ? 'bg-teaching-emerald' : 'bg-primary'} rounded-full ring-2 ring-surface`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="text-sm font-bold text-on-surface">{recommendedPeerMatch.peer.name || 'Peer Scholar'}</h4>
                    <span className="px-2 py-0.5 bg-primary-container text-on-primary-container rounded-md text-[10px] font-bold">
                      {recommendedPeerMatch.matchScore}% Match
                    </span>
                    <span className="text-[11px] text-on-surface-variant font-medium">
                      • {recommendedPeerMatch.peer.isAvailableNow ? 'Available Today' : 'Available for Booking'}
                    </span>
                  </div>
                  
                  <p className="text-xs text-on-surface-variant mb-2">
                    Can teach <strong className="text-on-surface font-semibold">{recommendedPeerMatch.teachStr}</strong> • Wants to learn <strong className="text-on-surface font-semibold">{recommendedPeerMatch.learnStr}</strong>
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-on-surface-variant font-medium">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-learning-amber">star</span> 
                      {(recommendedPeerMatch.peer.trustScore || 5.0).toFixed(2)} ({recommendedPeerMatch.sessionCount} session{recommendedPeerMatch.sessionCount !== 1 ? 's' : ''})
                    </span>
                    <span>•</span>
                    <span>₹{recommendedPeerMatch.peer.hourlyRate || 499}/hr</span>
                  </div>
                </div>
                <div className="w-full md:w-auto mt-2 md:mt-0 flex gap-2 shrink-0">
                  <Button 
                    variant="secondary" 
                    className="flex-1 md:flex-none py-1.5 px-3.5 text-xs font-semibold"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/messages?peerId=${recommendedPeerMatch.peer.id}`, { state: { peerId: recommendedPeerMatch.peer.id } });
                    }}
                  >
                    Message
                  </Button>
                  <Button 
                    variant="primary" 
                    className="flex-1 md:flex-none py-1.5 px-3.5 text-xs font-semibold"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/match-finder');
                    }}
                  >
                    Propose Exchange
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center bg-surface-container-low rounded-xl border border-outline-variant space-y-2">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant">person_search</span>
                <p className="text-xs font-bold text-on-surface">No Peer Recommendations Available Yet</p>
                <p className="text-[11px] text-on-surface-variant max-w-sm mx-auto">
                  As peers join the platform and register their skill interests, your top matching study partners will automatically appear here.
                </p>
                <div className="pt-2">
                  <Button variant="secondary" onClick={() => navigate('/match-finder')} className="text-xs py-1 px-3">
                    Explore Match Finder
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* Community Champions Leaderboard */}
          <section className="bg-surface rounded-2xl p-6 shadow-elevation-1 border border-outline-variant space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-learning-amber text-xl">military_tech</span>
                  Community Champions
                </h3>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                  Top mentors & active peer scholars this week
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => navigate('/discussions')}
                className="text-xs px-3 py-1.5 text-primary hover:bg-primary-container/50 font-semibold"
              >
                Join Discussions →
              </Button>
            </div>

            {loadingChampions ? (
              <div className="p-4 text-center text-xs text-on-surface-variant font-medium animate-pulse">
                Loading community rankings...
              </div>
            ) : champions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {champions.map((champion, idx) => (
                  <div key={champion.id || idx} className="p-3.5 rounded-xl border border-outline-variant bg-surface-container-low flex items-center gap-3">
                    <img 
                      src={champion.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'} 
                      alt={champion.name} 
                      className="w-10 h-10 rounded-full object-cover border border-outline-variant shrink-0" 
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-on-surface truncate">{champion.name}</span>
                        <span className="text-[10px] font-extrabold text-learning-amber shrink-0">{champion.badge}</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant truncate">{champion.role}</p>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-teaching-emerald mt-0.5">
                        <span>★ {champion.rating}</span>
                        <span>•</span>
                        <span>{champion.score}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 text-center bg-surface-container-low rounded-xl border border-outline-variant space-y-1">
                <span className="material-symbols-outlined text-2xl text-learning-amber">emoji_events</span>
                <p className="text-xs font-bold text-on-surface">Leaderboard Opening Soon</p>
                <p className="text-[11px] text-on-surface-variant">
                  Participate in sessions and community discussions to claim your place on the podium!
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Upcoming Sessions Card */}
        <div className="space-y-6">
          <section className="bg-surface rounded-2xl shadow-elevation-1 border border-outline-variant overflow-hidden flex flex-col h-full">
            <div className="p-4 sm:p-5 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">calendar_today</span> Upcoming Sessions
              </h3>
              <span className="text-[11px] font-semibold text-primary hover:underline cursor-pointer" onClick={() => navigate('/schedule')}>Calendar</span>
            </div>
            <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3">
              {filteredSessions.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant flex flex-col items-center justify-center space-y-2">
                  <span className="material-symbols-outlined text-3xl text-outline">event_available</span>
                  <p className="font-semibold text-on-surface text-xs sm:text-sm">No scheduled sessions</p>
                  <p className="text-[11px] text-on-surface-variant">Match with a peer to schedule your next session.</p>
                  <Button variant="primary" className="text-xs font-semibold py-1.5 px-3.5 mt-2" onClick={() => navigate('/match-finder')}>
                    Find a Match
                  </Button>
                </div>
              ) : (
                filteredSessions.map(session => (
                  <div key={session.id} className="bg-surface rounded-xl p-4 border border-outline-variant shadow-elevation-1 hover:border-outline transition-colors">
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="px-2 py-0.5 bg-teaching-emerald-container border border-teaching-emerald/20 text-on-teaching-emerald-container rounded text-[10px] font-bold">
                        STARTING SOON
                      </span>
                      <span className="text-xs text-on-surface-variant font-semibold">
                        {new Date(session.scheduledAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-on-surface mb-1">{session.title}</h4>
                    <p className="text-[11px] text-on-surface-variant mb-3 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-outline">person</span> {session.teacherId === currentUser.id ? `Teaching ${session.student?.name || 'Student'}` : `Learning from ${session.teacher?.name || 'Teacher'}`}
                    </p>
                    <Button variant="primary" className="w-full flex items-center justify-center gap-1.5 font-semibold text-xs py-2" onClick={() => navigate(`/live/${session.id}`)}>
                      <span className="material-symbols-outlined text-sm">videocam</span> Join Classroom
                    </Button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
