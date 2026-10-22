import { useState, useEffect, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { useAppStore } from '../store/useAppStore';
import { api, onSessionsUpdated, onTransactionsUpdated, onPeersUpdated, getSessionApproverId } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { SessionNotesPanel } from '../components/notes/SessionNotesPanel';

export function Dashboard() {
  const { currentUser, setCurrentUser, searchQuery, setSearchQuery, role, loginRole, addNotification } = useAppStore();
  const [sessions, setSessions] = useState<any[]>([]);
  const [peers, setPeers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [champions, setChampions] = useState<any[]>([]);
  const [loadingChampions, setLoadingChampions] = useState<boolean>(true);
  const [actingSessionId, setActingSessionId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Today's Note Dashboard Card State
  const [todayNote, setTodayNote] = useState<any | null>(null);
  const [todayNoteInput, setTodayNoteInput] = useState('');
  const [isSavingTodayNote, setIsSavingTodayNote] = useState(false);
  const [noteStreak, setNoteStreak] = useState(0);

  // Session Notes Panel State & Counts
  const [sessionNoteCounts, setSessionNoteCounts] = useState<Record<string, number>>({});
  const [selectedSessionForNotes, setSelectedSessionForNotes] = useState<any | null>(null);

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

    // Load today's daily note and note streak
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    api.getTodayNote(userTz).then(res => {
      if (res?.note) {
        setTodayNote(res.note);
      }
    }).catch(() => {});

    api.getDailyStreak(userTz).then(res => {
      if (typeof res?.noteStreak === 'number') {
        setNoteStreak(res.noteStreak);
      }
    }).catch(() => {});

    // Fetch notes to compute session notes counts
    api.getNotes().then((notesData: any[]) => {
      if (Array.isArray(notesData)) {
        const counts: Record<string, number> = {};
        for (const n of notesData) {
          if (n.sessionId) {
            counts[n.sessionId] = (counts[n.sessionId] || 0) + 1;
          }
        }
        setSessionNoteCounts(counts);
      }
    }).catch(() => {});
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

  // Live Daily Streak & Weekly Calendar Calculation
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isClaimingStreak, setIsClaimingStreak] = useState(false);
  const [streakClaimSuccess, setStreakClaimSuccess] = useState(false);

  // Live midnight rollover monitor: automatically shifts the active day without page reload
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      if (now.getDate() !== currentDate.getDate()) {
        setCurrentDate(now);
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [currentDate]);

  // Local date formatter (YYYY-MM-DD)
  const getLocalDateStr = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateStr(currentDate);

  // Real Streak State from authenticated user
  const rawStreak = typeof currentUser?.streak === 'number' ? currentUser.streak : 0;
  const lastActive = currentUser?.lastActiveDate || '';
  const isTodayCompleted = lastActive === todayStr;

  // Check if streak has lapsed (more than 1 day missed)
  const isStreakLapsed = useMemo(() => {
    if (!lastActive || rawStreak <= 0) return true;
    if (lastActive === todayStr) return false;
    const yest = new Date(currentDate);
    yest.setDate(yest.getDate() - 1);
    const yesterdayStr = getLocalDateStr(yest);
    return lastActive !== yesterdayStr;
  }, [lastActive, rawStreak, todayStr, currentDate]);

  const currentStreak = isStreakLapsed ? (isTodayCompleted ? 1 : 0) : rawStreak;

  // 7-Day Cycle & Milestone Reward Eligibility (+20 Bonus Points every 7 days)
  const currentMilestone = Math.floor(currentStreak / 7);
  const lastClaimedMilestone = currentUser?.lastClaimedStreakMilestone || 0;
  const canClaimBonus = currentStreak >= 7 && lastClaimedMilestone < currentMilestone;
  const daysUntilBonus = 7 - (currentStreak % 7);

  // Weekly calendar days (Monday to Sunday)
  const weeklyTrackerDays = useMemo(() => {
    const now = currentDate;
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0 ... Sunday = 6
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);

    const baseDays = [
      { num: 1, day: 'Mon', full: 'Monday' },
      { num: 2, day: 'Tue', full: 'Tuesday' },
      { num: 3, day: 'Wed', full: 'Wednesday' },
      { num: 4, day: 'Thu', full: 'Thursday' },
      { num: 5, day: 'Fri', full: 'Friday' },
      { num: 6, day: 'Sat', full: 'Saturday' },
      { num: 7, day: 'Sun', full: 'Sunday' }
    ];

    const activeDates = new Set<string>();
    if (Array.isArray(currentUser?.streakHistory)) {
      currentUser.streakHistory.forEach((h: any) => {
        if (h && h.date) activeDates.add(h.date);
      });
    }
    if (isTodayCompleted) {
      activeDates.add(todayStr);
    }
    // Also include lastActiveDate if active
    if (lastActive && !isStreakLapsed) {
      activeDates.add(lastActive);
    }

    return baseDays.map((item, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const dateStr = getLocalDateStr(d);

      const isPast = idx < dayOfWeek;
      const isToday = idx === dayOfWeek;
      const isFuture = idx > dayOfWeek;
      const isGift = item.num === 7;
      const wasActive = activeDates.has(dateStr);

      return {
        ...item,
        dateStr,
        isPast,
        isToday,
        isFuture,
        isGift,
        wasActive
      };
    });
  }, [currentDate, currentUser?.streakHistory, isTodayCompleted, todayStr, lastActive, isStreakLapsed]);

  const handleClaimStreakReward = async () => {
    if (!currentUser?.id || isClaimingStreak || !canClaimBonus) return;
    setIsClaimingStreak(true);
    try {
      const res = await api.claimStreakReward(currentUser.id);
      if (res?.success) {
        setStreakClaimSuccess(true);
        if (res.user) {
          setCurrentUser(res.user);
        } else {
          setCurrentUser({
            ...currentUser,
            rewardPoints: (currentUser.rewardPoints || 0) + 20,
            lastClaimedStreakMilestone: currentMilestone
          });
        }
        addNotification({
          type: 'reminder',
          title: '🎉 +20 Bonus Points Unlocked!',
          body: `You completed your 7-day learning milestone! +20 bonus points added to your loyalty balance.`,
          link: '/rewards'
        });
        setTimeout(() => setStreakClaimSuccess(false), 6000);
      }
    } catch (err) {
      console.error('Failed to claim streak reward:', err);
    } finally {
      setIsClaimingStreak(false);
    }
  };

  if (!currentUser) return <div className="p-8 text-center text-on-surface-variant font-bold animate-pulse text-sm">Loading dashboard...</div>;

  const isPastSession = (s: any) => {
    if (!s || !s.scheduledAt) return false;
    const startTime = new Date(s.scheduledAt).getTime();
    const durationMs = (s.durationMin || 60) * 60 * 1000;
    return startTime + durationMs <= Date.now();
  };

  const isBothRole = loginRole === 'both' || currentUser?.role === 'both';
  const isTeacherRole = role === 'teacher' || (!isBothRole && (loginRole === 'teacher' || currentUser?.role === 'teacher'));

  const pendingRequestsForMe = useMemo(() => {
    if (!currentUser?.id) return [];
    return sessions.filter(s => s && s.status === 'pending' && getSessionApproverId(s) === currentUser.id && !isPastSession(s));
  }, [sessions, currentUser?.id]);

  const handleAcceptBooking = async (sessionId: string) => {
    setActingSessionId(sessionId);
    try {
      await api.acceptSession(sessionId);
      addNotification({
        type: 'session',
        title: '✅ Request Approved',
        body: 'You approved the booking request. The classroom is ready.',
        link: `/live/${sessionId}`
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to accept booking');
    } finally {
      setActingSessionId(null);
    }
  };

  const handleDeclineBooking = async (sessionId: string) => {
    setActingSessionId(sessionId);
    try {
      await api.declineSession(sessionId);
      addNotification({
        type: 'session',
        title: 'Booking Declined',
        body: 'You declined the booking request. Any held tokens have been refunded.',
        link: '/schedule'
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to decline booking');
    } finally {
      setActingSessionId(null);
    }
  };

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

  const getGoogleCalendarUrl = (session: any) => {
    const title = encodeURIComponent(session.title || 'Mindroot Peer Mentorship Session');
    const start = session.scheduledAt ? new Date(session.scheduledAt) : new Date();
    const durationMin = session.durationMin || 60;
    const end = new Date(start.getTime() + durationMin * 60000);
    const formatTime = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const dates = `${formatTime(start)}/${formatTime(end)}`;
    const details = encodeURIComponent(`Mindroot Peer Learning Session.\nClassroom: ${window.location.origin}/live/${session.id}`);
    const location = encodeURIComponent(`${window.location.origin}/live/${session.id}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  };

  const handleDownloadIcs = (session: any) => {
    const start = session.scheduledAt ? new Date(session.scheduledAt) : new Date();
    const durationMin = session.durationMin || 60;
    const end = new Date(start.getTime() + durationMin * 60000);
    const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Mindroot//Peer Mentorship//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:session-${session.id}@mindroot.com`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(start)}`,
      `DTEND:${formatDate(end)}`,
      `SUMMARY:${session.title || 'Mindroot Session'}`,
      `DESCRIPTION:Classroom link: ${window.location.origin}/live/${session.id}`,
      `LOCATION:${window.location.origin}/live/${session.id}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindroot-session-${session.id.slice(0, 8)}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const isSessionLiveNow = (scheduledAt?: string) => {
    if (!scheduledAt) return false;
    const diffMin = Math.round((new Date(scheduledAt).getTime() - Date.now()) / 60000);
    return diffMin <= 15 && diffMin >= -60;
  };

  const getCountdownLabel = (scheduledAt?: string) => {
    if (!scheduledAt) return 'Upcoming';
    const diffMin = Math.round((new Date(scheduledAt).getTime() - Date.now()) / 60000);
    if (diffMin <= 15 && diffMin >= -60) return '● LIVE CLASSROOM READY';
    if (diffMin > 0 && diffMin <= 60) return `Starts in ${diffMin}m`;
    return 'Starting Soon';
  };

  // Determine Badge & Subtitle
  const roleBadgeLabel = isBothRole 
    ? 'Student & Peer Mentor' 
    : (isTeacherRole ? 'Teacher & Mentor' : 'Student Learner');

  const roleSubtitle = isTeacherRole 
    ? `You have ${confirmedSessions.length} active lecture${confirmedSessions.length !== 1 ? 's' : ''} scheduled with student payments enabled.`
    : `You have ${confirmedSessions.length} active learning session${confirmedSessions.length !== 1 ? 's' : ''} scheduled.`;

  // Build Stat Cards dynamically per role
  const statCards = isTeacherRole ? [
    { 
      label: 'Mentoring Revenue', 
      value: `₹${totalEarned.toLocaleString('en-IN')}`, 
      unit: 'earned',
      icon: 'payments', 
      bgColor: 'bg-primary-tint',
      iconColor: 'text-primary-text',
      borderColor: 'border-primary/20',
      sub: `${teacherEarnedTransactions.length} student payout${teacherEarnedTransactions.length !== 1 ? 's' : ''} received`, 
      path: '/wallet' 
    },
    { 
      label: 'Hours Taught', 
      value: hoursTaught > 0 ? hoursTaught.toString() : '24', 
      unit: 'hrs',
      icon: 'school', 
      bgColor: 'bg-primary-tint',
      iconColor: 'text-primary-text',
      borderColor: 'border-primary/20',
      sub: 'Across active lectures', 
      progress: Math.min(100, Math.round(((hoursTaught || 24) / 40) * 100)),
      path: '/teacher' 
    },
    { 
      label: 'Teaching Skills', 
      value: teachSkills.length.toString(), 
      unit: 'skills',
      icon: 'workspace_premium', 
      bgColor: 'bg-primary-tint',
      iconColor: 'text-primary-text',
      borderColor: 'border-primary/20',
      tags: teachSkills.slice(0, 2), 
      path: '/profile' 
    },
    { 
      label: 'Trust Rating', 
      value: trustScoreNum.toFixed(2), 
      unit: '/ 5.0',
      icon: 'verified', 
      bgColor: 'bg-primary-tint',
      iconColor: 'text-primary-text',
      borderColor: 'border-primary/20',
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
      bgColor: 'bg-primary-tint',
      iconColor: 'text-primary-text',
      borderColor: 'border-primary/20',
      sub: pendingPaymentDue > 0 ? `₹${pendingPaymentDue.toLocaleString('en-IN')} pending due` : (isBothRole && totalEarned > 0 ? `₹${totalEarned.toLocaleString('en-IN')} earned as mentor` : 'Payment history'), 
      path: '/wallet' 
    },
    { 
      label: 'Hours Learned', 
      value: hoursLearned.toString(), 
      unit: 'hrs',
      icon: 'schedule', 
      bgColor: 'bg-primary-tint',
      iconColor: 'text-primary-text',
      borderColor: 'border-primary/20',
      sub: '+2 hours this week', 
      progress: Math.min(100, Math.round((hoursLearned / 20) * 100)),
      path: '/schedule' 
    },
    { 
      label: isBothRole ? 'Active Skills' : 'Learning Goals', 
      value: activeTopicsCount, 
      unit: 'skills',
      icon: 'school', 
      bgColor: 'bg-primary-tint',
      iconColor: 'text-primary-text',
      borderColor: 'border-primary/20',
      tags: activeTopicTags, 
      path: '/marketplace' 
    },
    { 
      label: 'Reliability Score', 
      value: `${Math.min(100, Math.round(trustScoreNum * 20))}%`, 
      unit: 'punctual',
      icon: 'verified_user', 
      bgColor: 'bg-primary-tint',
      iconColor: 'text-primary-text',
      borderColor: 'border-primary/20',
      sub: '100% Session Attendance & Etiquette',
      progress: Math.min(100, Math.round(trustScoreNum * 20)), 
      path: '/feedback' 
    }
  ];

  return (
    <div className="max-w-container_max mx-auto space-y-6 select-none">
      {/* Existing Teacher UPI & ID Setup Reminder Banner */}
      {(role === 'teacher' || currentUser?.role === 'teacher' || currentUser?.role === 'both') && !currentUser?.upiId && (
        <div className="bg-accent-tint border border-accent/30 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-surface border border-accent/20 text-accent flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">qr_code_2</span>
            </div>
            <div>
              <h4 className="text-xs font-black text-text flex items-center gap-1.5">
                <span>Payments Not Set Up</span>
                <span className="px-1.5 py-0.5 rounded-full bg-accent text-on-accent text-[9px] font-extrabold uppercase">Action Required</span>
              </h4>
              <p className="text-[11px] text-muted font-medium mt-0.5">
                Add your UPI ID & official College ID in your profile to start accepting direct student payments.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-bold transition-all shrink-0 shadow-xs flex items-center gap-1"
          >
            <span>Set Up Now</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      )}

      {/* Search Results Banner when search query is active */}
      {query && (
        <div className="bg-primary-tint border border-primary/20 rounded-2xl p-5 shadow space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">search</span>
              <h2 className="text-sm font-bold text-text">
                Search Results for "<span className="text-primary font-extrabold">{searchQuery}</span>"
              </h2>
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-muted hover:text-text flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">close</span>
              <span>Clear Search</span>
            </button>
          </div>

          {matchingPeers.length === 0 && filteredSessions.length === 0 ? (
            <p className="text-xs text-muted">No peers or scheduled sessions matched "{searchQuery}". Try searching "React", "Python", or "Maya".</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {matchingPeers.map(peer => (
                <div key={peer.id} className="bg-surface border border-border rounded-xl p-3 flex items-center justify-between gap-3 shadow">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src={peer.avatar || 'https://i.pravatar.cc/150?img=11'} alt={peer.name} className="w-8 h-8 rounded-full object-cover border border-border" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-text truncate">{peer.name}</p>
                      <p className="text-[10px] text-muted truncate">Teaches: {Array.isArray(peer.skillsTaught) ? peer.skillsTaught.join(', ') : 'Tech & Design'}</p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    className="py-1 px-2 text-[11px] font-bold bg-primary-tint text-primary-text border-primary/20 shrink-0"
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
      <div 
        className="relative overflow-hidden bg-hero border border-border rounded-2xl p-6 sm:p-7 shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isTeacherRole ? 'bg-primary' : 'bg-primary'}`} />
            <span className="text-xs font-semibold text-muted">{roleBadgeLabel}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-text tracking-tight">
            {getGreeting()}, {currentUser?.name?.split(' ')[0] || 'Peer'}
          </h1>
          <p className="text-xs sm:text-sm text-muted font-medium">
            {roleSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative z-10">
          <Button
            variant="secondary"
            className="text-xs font-semibold px-3.5 py-2"
            onClick={() => navigate('/match-finder')}
          >
            <span className="material-symbols-outlined text-sm text-muted">search</span>
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

      {/* Pending Student Booking Requests Alert for Mentors */}
      {pendingRequestsForMe.length > 0 && (
        <div className="bg-surface border-2 border-primary/40 rounded-2xl p-5 shadow space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl animate-pulse">mark_email_unread</span>
              <h3 className="text-sm font-black text-text">
                Pending Student Booking Requests ({pendingRequestsForMe.length})
              </h3>
            </div>
            <span className="text-[11px] font-bold text-muted">Review & approve to unlock live classroom</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingRequestsForMe.map(req => (
              <div key={req.id} className="bg-surface-2 rounded-xl p-4 border border-border flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <img
                    src={req.student?.avatar || `https://i.pravatar.cc/150?img=11`}
                    alt={req.student?.name || 'Student'}
                    className="w-10 h-10 rounded-full object-cover border border-border shrink-0 ring-1 ring-primary/20"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-text truncate">{req.title}</h4>
                    <p className="text-[11px] text-muted font-medium mt-0.5">
                      Student: <strong className="text-text">{req.student?.name || 'Learner'}</strong>
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted mt-1">
                      <span>📅 {req.scheduledAt ? new Date(req.scheduledAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Flexible'}</span>
                      {req.paymentStatus === 'held' && (
                        <span className="px-1.5 py-0.5 rounded bg-accent-tint text-accent-text font-bold border border-accent/20">
                          Tokens Held
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                  <Button
                    variant="primary"
                    disabled={actingSessionId === req.id}
                    onClick={() => handleAcceptBooking(req.id)}
                    className="flex-1 py-1.5 text-xs font-bold flex items-center justify-center gap-1 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>{actingSessionId === req.id ? 'Confirming...' : 'Accept Request'}</span>
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actingSessionId === req.id}
                    onClick={() => handleDeclineBooking(req.id)}
                    className="flex-1 py-1.5 text-xs font-bold text-danger hover:bg-danger/10 flex items-center justify-center gap-1 border border-border"
                  >
                    <span className="material-symbols-outlined text-sm">cancel</span>
                    <span>Decline</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Streak & Community Momentum Banner */}
      <div 
        className="border border-border rounded-2xl p-4 sm:p-5 shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-accent-tint"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl border border-accent/20 bg-surface text-accent flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl text-accent" style={{ fontVariationSettings: "'FILL' 1" }}>
              local_fire_department
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-text">
                {currentStreak > 0 ? `${currentStreak}-Day Learning Streak` : 'Start Your Learning Streak'}
              </h2>
              {isTodayCompleted ? (
                <span className="px-2 py-0.5 rounded-full bg-primary-tint border border-primary/20 text-primary-text font-semibold text-[10px] uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  Active Today
                </span>
              ) : currentStreak > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-surface border border-accent/30 text-accent-text font-semibold text-[10px] uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                  Action Needed Today
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-surface-2 border border-border text-muted font-semibold text-[10px] uppercase">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-xs text-muted font-medium mt-0.5">
              {isTodayCompleted
                ? <>🔥 Great job! You completed today's learning goal. {daysUntilBonus > 0 && daysUntilBonus < 7 ? <span className="text-accent-text font-bold">{daysUntilBonus} day(s) until your next +20 Bonus Points!</span> : <span className="text-accent-text font-bold">Reach your 7-day milestone to claim +20 Bonus Points!</span>}</>
                : <>Keep learning every day. Complete 1 session or answer a discussion question to reach 7 days and claim <span className="text-accent-text font-bold">+20 Bonus Points!</span></>}
            </p>
          </div>
        </div>

        {/* 7-Day Streak & Weekly Calendar Tracker */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 self-stretch sm:self-auto justify-between sm:justify-start">
          <div className="flex items-center gap-1.5">
            {weeklyTrackerDays.map((item, idx) => {
              const isFinished = item.wasActive;
              const isToday = item.isToday;
              const isGift = item.isGift;

              return (
                <div 
                  key={idx} 
                  className="flex flex-col items-center gap-1 group cursor-default" 
                  title={`${item.full} (${item.dateStr}): ${isFinished ? 'Completed ✓' : isToday ? (isTodayCompleted ? 'Completed Today 🔥' : 'Pending: Complete session or reply today!') : isGift ? '+20 Bonus Points on Day 7 🎁' : 'Upcoming'}`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-bold border transition-all ${
                      isFinished
                        ? 'bg-primary text-on-primary border-primary shadow-xs'
                        : isToday
                          ? isTodayCompleted
                            ? 'bg-surface text-accent border-accent ring-2 ring-accent ring-offset-1 ring-offset-surface'
                            : 'bg-surface text-accent border-accent ring-2 ring-accent ring-offset-1 ring-offset-surface animate-pulse'
                          : isGift
                            ? canClaimBonus
                              ? 'bg-accent text-on-primary border-accent shadow-md animate-bounce cursor-pointer'
                              : 'bg-surface text-accent-text border-border'
                            : 'bg-surface text-muted border-border'
                    }`}
                  >
                    {isFinished ? (
                      '✓'
                    ) : isToday ? (
                      <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        local_fire_department
                      </span>
                    ) : isGift ? (
                      '🎁'
                    ) : (
                      item.num
                    )}
                  </div>
                  <div className="flex flex-col items-center leading-none">
                    <span className={`text-[9px] ${isToday ? 'text-accent-text font-bold' : 'text-muted font-medium'}`}>
                      Day {item.num}
                    </span>
                    <span className={`text-[8px] mt-0.5 ${isToday ? 'text-accent-text font-extrabold' : 'text-muted'}`}>
                      {item.day}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Claim Bonus Button when eligible */}
          {canClaimBonus && (
            <Button
              variant="primary"
              disabled={isClaimingStreak}
              onClick={handleClaimStreakReward}
              className="text-xs font-bold py-1.5 px-3 bg-accent hover:opacity-90 text-on-primary shadow animate-pulse shrink-0"
            >
              {isClaimingStreak ? 'Claiming...' : '🎁 Claim +20 Pts'}
            </Button>
          )}
          {streakClaimSuccess && (
            <span className="text-xs font-bold text-accent-text animate-fade-in shrink-0">
              ✓ +20 Pts Claimed!
            </span>
          )}
        </div>
      </div>

      {/* Today's Note Compact Card */}
      <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-2xl bg-primary-tint text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <span className="material-symbols-outlined text-2xl">edit_note</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-text">Today's Note</h3>
              {noteStreak > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-accent-tint text-accent-text font-bold text-[10px] flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">local_fire_department</span>
                  <span>{noteStreak}-day note streak</span>
                </span>
              )}
            </div>
            {todayNote ? (
              <p className="text-xs text-muted truncate mt-0.5">
                <strong className="text-text">{todayNote.title || 'Today’s Note'}:</strong> {(todayNote.content || '').replace(/<[^>]*>/g, ' ').slice(0, 80)}...
              </p>
            ) : (
              <p className="text-xs text-muted mt-0.5">
                Start your daily learning log or jot down a quick takeaway.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0">
          {!todayNote ? (
            <div className="flex items-center gap-1.5 flex-1 md:flex-initial">
              <input
                type="text"
                value={todayNoteInput}
                onChange={e => setTodayNoteInput(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && todayNoteInput.trim()) {
                    setIsSavingTodayNote(true);
                    try {
                      const saved = await api.saveNote({
                        type: 'daily',
                        title: `Quick Note • ${todayStr}`,
                        content: `<p>${todayNoteInput.trim()}</p>`,
                        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
                      });
                      setTodayNote(saved);
                      setTodayNoteInput('');
                      addNotification({
                        type: 'session',
                        title: 'Note Saved',
                        body: 'Today’s daily note has been initialized.'
                      });
                    } catch (err: any) {
                      alert(err.message || 'Failed to save note');
                    } finally {
                      setIsSavingTodayNote(false);
                    }
                  }
                }}
                placeholder="Jot down a quick thought..."
                className="bg-surface-2 text-text border border-border rounded-xl px-3 py-1.5 text-xs focus:border-primary focus:outline-hidden min-w-[200px]"
              />
              <Button
                variant="primary"
                disabled={!todayNoteInput.trim() || isSavingTodayNote}
                onClick={async () => {
                  if (!todayNoteInput.trim()) return;
                  setIsSavingTodayNote(true);
                  try {
                    const saved = await api.saveNote({
                      type: 'daily',
                      title: `Quick Note • ${todayStr}`,
                      content: `<p>${todayNoteInput.trim()}</p>`,
                      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
                    });
                    setTodayNote(saved);
                    setTodayNoteInput('');
                    addNotification({
                      type: 'session',
                      title: 'Note Saved',
                      body: 'Today’s daily note has been initialized.'
                    });
                  } catch (err: any) {
                    alert(err.message || 'Failed to save note');
                  } finally {
                    setIsSavingTodayNote(false);
                  }
                }}
                className="text-xs font-bold py-1.5 px-3"
              >
                {isSavingTodayNote ? 'Saving...' : 'Save'}
              </Button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/notes/daily')}
              className="px-3.5 py-1.5 bg-primary-tint text-primary-text hover:bg-primary hover:text-on-primary rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1"
            >
              <span>Continue writing</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          )}

          <button
            onClick={() => navigate('/notes/daily')}
            className="text-xs font-semibold text-muted hover:text-text px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
          >
            Open full note →
          </button>
        </div>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <div 
            key={i} 
            onClick={() => navigate(stat.path)}
            className="bg-surface border border-border rounded-2xl p-5 shadow hover:border-primary/40 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted mb-0.5">{stat.label}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-text">{stat.value}</span>
                  <span className="text-xs font-semibold text-muted">{stat.unit}</span>
                </div>
              </div>
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} ${stat.iconColor} ${stat.borderColor} border flex items-center justify-center`}>
                <span className="material-symbols-outlined text-xl">{stat.icon}</span>
              </div>
            </div>

            {stat.progress !== undefined && (
              <div className="mt-2 space-y-1">
                <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-300 bg-primary" 
                    style={{ width: `${stat.progress}%` }} 
                  />
                </div>
              </div>
            )}

            {stat.sub && (
              <p className="text-[11px] mt-2 text-muted hover:text-primary transition-colors flex items-center gap-1 font-medium">
                {stat.sub.includes('pending due') ? (
                  <span className="text-accent-text font-semibold">{stat.sub}</span>
                ) : (
                  stat.sub
                )} <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </p>
            )}

            {stat.tags && (
              <div className="flex gap-1 mt-2">
                {stat.tags.map((t: string) => (
                  <span key={t} className="px-2 py-0.5 bg-primary-tint text-primary-text border border-primary/20 rounded-md text-[10px] font-semibold truncate max-w-[80px]">{t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recommended Match Preview */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-surface rounded-2xl p-6 shadow border border-border">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-base font-bold text-text flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">recommend</span> Recommended Peer Match
                </h3>
                <p className="text-xs text-muted font-medium mt-0.5">Top peer recommendation based on your skill interests</p>
              </div>
              <button 
                onClick={() => navigate('/match-finder')} 
                className="text-xs px-3 py-1.5 text-primary-text hover:underline font-semibold cursor-pointer"
              >
                Browse All Matches →
              </button>
            </div>
            
            {recommendedPeerMatch ? (
              <div 
                onClick={() => navigate('/match-finder')}
                className="bg-surface-2 rounded-xl p-5 flex flex-col md:flex-row gap-5 items-start md:items-center hover:bg-surface-2/80 transition-colors cursor-pointer border border-border"
              >
                <div className="relative shrink-0">
                  <img 
                    className="w-12 h-12 rounded-full object-cover border border-border" 
                    src={recommendedPeerMatch.peer.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'} 
                    alt={`${recommendedPeerMatch.peer.name || 'Peer'} profile avatar`} 
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary rounded-full ring-2 ring-surface" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="text-sm font-bold text-text">{recommendedPeerMatch.peer.name || 'Peer Scholar'}</h4>
                    <span className="px-2 py-0.5 bg-primary-tint text-primary-text rounded-md text-[10px] font-bold">
                      {recommendedPeerMatch.matchScore}% Match
                    </span>
                    <span className="text-[11px] text-muted font-medium">
                      • {recommendedPeerMatch.peer.isAvailableNow ? 'Available Today' : 'Available for Booking'}
                    </span>
                  </div>
                  
                  <p className="text-xs text-muted mb-2">
                    Can teach <strong className="text-text font-semibold">{recommendedPeerMatch.teachStr}</strong> • Wants to learn <strong className="text-text font-semibold">{recommendedPeerMatch.learnStr}</strong>
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-muted font-medium">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-accent">star</span> 
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
              <div className="p-6 text-center bg-surface-2 rounded-xl border border-border space-y-2">
                <span className="material-symbols-outlined text-3xl text-muted">person_search</span>
                <p className="text-xs font-bold text-text">No Peer Recommendations Available Yet</p>
                <p className="text-[11px] text-muted max-w-sm mx-auto">
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
          <section className="bg-surface rounded-2xl p-6 shadow border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text flex items-center gap-2">
                  <span className="material-symbols-outlined text-accent text-xl">military_tech</span>
                  Community Champions
                </h3>
                <p className="text-xs text-muted font-medium mt-0.5">
                  Top mentors & active peer scholars this week
                </p>
              </div>
              <button
                onClick={() => navigate('/discussions')}
                className="text-xs px-3 py-1.5 text-primary-text hover:underline font-semibold cursor-pointer"
              >
                Join Discussions →
              </button>
            </div>

            {loadingChampions ? (
              <div className="p-4 text-center text-xs text-muted font-medium animate-pulse">
                Loading community rankings...
              </div>
            ) : champions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {champions.map((champion, idx) => (
                  <div key={champion.id || idx} className="p-3.5 rounded-xl border border-border bg-surface-2 flex items-center gap-3">
                    <img 
                      src={champion.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'} 
                      alt={champion.name} 
                      className="w-10 h-10 rounded-full object-cover border border-border shrink-0" 
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text truncate">{champion.name}</span>
                        <span className="text-[10px] font-extrabold text-accent-text shrink-0">{champion.badge}</span>
                      </div>
                      <p className="text-[10px] text-muted truncate">{champion.role}</p>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-primary mt-0.5">
                        <span>★ {champion.rating}</span>
                        <span>•</span>
                        <span>{champion.score}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 text-center bg-surface-2 rounded-xl border border-border space-y-1">
                <span className="material-symbols-outlined text-2xl text-accent">emoji_events</span>
                <p className="text-xs font-bold text-text">Leaderboard Opening Soon</p>
                <p className="text-[11px] text-muted">
                  Participate in sessions and community discussions to claim your place on the podium!
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Upcoming Sessions Card */}
        <div className="space-y-6">
          <section className="bg-surface rounded-2xl shadow border border-border overflow-hidden flex flex-col h-full">
            <div className="p-4 sm:p-5 bg-surface-2 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">calendar_today</span> Upcoming Sessions
              </h3>
              <span className="text-[11px] font-semibold text-primary-text hover:underline cursor-pointer" onClick={() => navigate('/schedule')}>Calendar</span>
            </div>
            <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3">
              {filteredSessions.length === 0 ? (
                <div className="text-center py-8 text-muted flex flex-col items-center justify-center space-y-2">
                  <span className="material-symbols-outlined text-3xl text-muted">event_available</span>
                  <p className="font-semibold text-text text-xs sm:text-sm">No scheduled sessions</p>
                  <p className="text-[11px] text-muted">Match with a peer to schedule your next session.</p>
                  <Button variant="primary" className="text-xs font-semibold py-1.5 px-3.5 mt-2" onClick={() => navigate('/match-finder')}>
                    Find a Match
                  </Button>
                </div>
              ) : (
                filteredSessions.map(session => {
                  const isLive = isSessionLiveNow(session.scheduledAt);
                  const countdown = getCountdownLabel(session.scheduledAt);
                  return (
                    <div key={session.id} className="bg-surface rounded-xl p-4 border border-border shadow hover:border-primary/40 transition-colors space-y-3">
                      <div className="flex justify-between items-start">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 ${
                          isLive 
                            ? 'bg-primary text-on-primary animate-pulse shadow-xs' 
                            : 'bg-primary-tint border border-primary/20 text-primary-text'
                        }`}>
                          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-on-primary animate-ping" />}
                          {countdown}
                        </span>
                        <span className="text-xs text-muted font-bold">
                          {new Date(session.scheduledAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-text mb-0.5">{session.title}</h4>
                        <p className="text-[11px] text-muted flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-muted">person</span> 
                          {session.teacherId === currentUser?.id ? `Teaching ${session.student?.name || 'Student'}` : `Learning from ${session.teacher?.name || 'Teacher'}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          onClick={() => setSelectedSessionForNotes(session)}
                          title="Session Notes"
                          className="flex-1 py-1.5 px-2 bg-surface-2 hover:bg-surface text-text rounded-lg text-[10px] font-bold border border-border transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs text-primary">edit_note</span>
                          <span>Notes</span>
                          {(sessionNoteCounts[session.id] || 0) > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-primary-tint text-primary-text text-[9px] font-extrabold border border-primary/20">
                              {sessionNoteCounts[session.id]}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => window.open(getGoogleCalendarUrl(session), '_blank')}
                          title="Add to Google Calendar"
                          className="py-1.5 px-2 bg-surface-2 hover:bg-surface text-text rounded-lg text-[10px] font-bold border border-border transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs text-primary">calendar_month</span>
                          <span>Cal</span>
                        </button>
                        <button
                          onClick={() => handleDownloadIcs(session)}
                          title="Download .ics event file"
                          className="py-1.5 px-2 bg-surface-2 hover:bg-surface text-text rounded-lg text-[10px] font-bold border border-border transition-colors flex items-center justify-center cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs">download</span>
                          <span className="text-[9px] font-extrabold uppercase">.ics</span>
                        </button>
                      </div>
                      <Button 
                        variant={isLive ? "primary" : "secondary"} 
                        className="w-full flex items-center justify-center gap-1.5 font-bold text-xs py-2" 
                        onClick={() => navigate(`/live/${session.id}`)}
                      >
                        <span className="material-symbols-outlined text-sm">videocam</span> 
                        {isLive ? 'Join Live Classroom' : 'Enter Classroom'}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Session Notes Modal Panel */}
      {selectedSessionForNotes && (
        <SessionNotesPanel
          isOpen={Boolean(selectedSessionForNotes)}
          onClose={() => {
            setSelectedSessionForNotes(null);
            api.getNotes().then((notesData: any[]) => {
              if (Array.isArray(notesData)) {
                const counts: Record<string, number> = {};
                for (const n of notesData) {
                  if (n.sessionId) {
                    counts[n.sessionId] = (counts[n.sessionId] || 0) + 1;
                  }
                }
                setSessionNoteCounts(counts);
              }
            }).catch(() => {});
          }}
          session={selectedSessionForNotes}
          currentUserId={currentUser?.id}
        />
      )}
    </div>
  );
}
