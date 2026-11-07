import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '../components/ui/Button';
import { useAppStore } from '../store/useAppStore';
import { api, onSessionsUpdated, onTransactionsUpdated, onPeersUpdated, getSessionApproverId } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { SessionNotesPanel } from '../components/notes/SessionNotesPanel';
import { DashboardHeroHeader } from '../components/dashboard/DashboardHeroHeader';
import { SuggestedPeersCard } from '../components/dashboard/SuggestedPeersCard';
import { UpcomingSessionsWidget } from '../components/dashboard/UpcomingSessionsWidget';
import { OnboardingChecklistCard } from '../components/dashboard/OnboardingChecklistCard';

export function Dashboard() {
  const { currentUser, setCurrentUser, searchQuery, setSearchQuery, role, loginRole, addNotification } = useAppStore();
  const [sessions, setSessions] = useState<any[]>([]);
  const [peers, setPeers] = useState<any[]>([]);
  const [peerReviewsMap, setPeerReviewsMap] = useState<Record<string, { count: number; avgRating: number }>>({});
  const [transactions, setTransactions] = useState<any[]>([]);
  const [actingSessionId, setActingSessionId] = useState<string | null>(null);
  const [hasVisitedMatchFinder, setHasVisitedMatchFinder] = useState(() => {
    return localStorage.getItem('mindroot_onboarding_matched') === 'true';
  });
  const navigate = useNavigate();

  const visitRecordedRef = useRef<string | null>(null);

  // Dedicated daily visit recording effect (runs once per authenticated user session)
  useEffect(() => {
    if (!currentUser?.id) return;
    if (visitRecordedRef.current === currentUser.id) return;
    visitRecordedRef.current = currentUser.id;

    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    api.recordVisit(userTz).then((res: any) => {
      if (res?.success && res.user) {
        setCurrentUser(res.user);
      }
    }).catch(() => {
      // Fail closed: keep non-visited state
    });
  }, [currentUser?.id, setCurrentUser]);

  // Session Notes Panel State & Counts
  const [sessionNoteCounts, setSessionNoteCounts] = useState<Record<string, number>>({});
  const [selectedSessionForNotes, setSelectedSessionForNotes] = useState<any | null>(null);

  const loadData = () => {
    if (!currentUser) {
      api.getMe().then(setCurrentUser).catch(console.error);
    }
    api.getSessions().then(setSessions).catch(console.error);
    api.getPeers().then(data => {
      console.log('[DASHBOARD] getPeers loaded count:', Array.isArray(data) ? data.length : typeof data);
      setPeers(data);
    }).catch(err => console.error('[DASHBOARD] getPeers error:', err));
    api.getTransactions().then(setTransactions).catch(console.error);

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
      api.getPeers().then(data => {
        console.log('[DASHBOARD] getPeers loaded count:', Array.isArray(data) ? data.length : typeof data);
        setPeers(data);
      }).catch(err => console.error('[DASHBOARD] getPeers error:', err));
    });
    return () => {
      unsubSessions();
      unsubTx();
      unsubPeers();
    };
  }, [currentUser, setCurrentUser]);

  // Load reviews for peers to display truthful ratings / "New" badge
  useEffect(() => {
    if (!peers || peers.length === 0) return;
    const peerIds = peers.slice(0, 15).map((p: any) => p.id).filter(Boolean);
    Promise.all(
      peerIds.map(async (id: string) => {
        try {
          const reviews = await api.getReviews(id);
          if (Array.isArray(reviews) && reviews.length > 0) {
            const sum = reviews.reduce((acc: number, r: any) => acc + (Number(r.rating) || 5), 0);
            return { id, count: reviews.length, avgRating: sum / reviews.length };
          }
          return { id, count: 0, avgRating: 0 };
        } catch {
          return { id, count: 0, avgRating: 0 };
        }
      })
    ).then((results) => {
      const map: Record<string, { count: number; avgRating: number }> = {};
      for (const res of results) {
        if (res) map[res.id] = { count: res.count, avgRating: res.avgRating };
      }
      setPeerReviewsMap(map);
    });
  }, [peers]);

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
      const isVisited = isPast ? wasActive : isToday ? (isTodayCompleted || wasActive) : false;
      const isMissed = isPast && !wasActive;

      return {
        ...item,
        dateStr,
        isPast,
        isToday,
        isFuture,
        isGift,
        wasActive,
        isVisited,
        isMissed
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

  const isPastSession = (s: any) => {
    if (!s || !s.scheduledAt) return false;
    const startTime = new Date(s.scheduledAt).getTime();
    const durationMs = (s.durationMin || 60) * 60 * 1000;
    return startTime + durationMs <= Date.now();
  };

  const pendingRequestsForMe = useMemo(() => {
    if (!currentUser?.id) return [];
    return sessions.filter(s => s && s.status === 'pending' && getSessionApproverId(s) === currentUser.id);
  }, [sessions, currentUser?.id]);

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

  // Fallback to top community members if no personalized recommendations exist
  const suggestedPeersList = useMemo(() => {
    if (!currentUser || !peers || peers.length === 0) return [];

    const otherPeers = peers.filter(p => p && p.id && p.id !== currentUser.id && p.role !== 'admin');
    if (otherPeers.length === 0) return [];

    const formatRating = (peerId: string) => {
      const info = peerReviewsMap[peerId];
      if (info && info.count > 0) {
        return { rating: info.avgRating.toFixed(1), isNew: false, reviewCount: info.count };
      }
      return { rating: 'New', isNew: true, reviewCount: 0 };
    };

    const result: any[] = [];
    if (recommendedPeerMatch) {
      const rInfo = formatRating(recommendedPeerMatch.peer.id);
      result.push({
        id: recommendedPeerMatch.peer.id,
        name: recommendedPeerMatch.peer.name || 'Peer Scholar',
        avatar: recommendedPeerMatch.peer.avatar,
        role: `Teaches ${recommendedPeerMatch.teachStr} • Learns ${recommendedPeerMatch.learnStr}`,
        rating: rInfo.rating,
        isNew: rInfo.isNew,
        reviewCount: rInfo.reviewCount,
        matchScore: recommendedPeerMatch.matchScore,
        isAvailableNow: recommendedPeerMatch.peer.isAvailableNow
      });
    }

    for (const p of otherPeers) {
      if (result.some(r => r.id === p.id)) continue;
      const teaches = Array.isArray(p.skillsTaught) && p.skillsTaught.length > 0 
        ? p.skillsTaught.slice(0, 2).join(' & ') 
        : (Array.isArray(p.userSkills) 
          ? p.userSkills.filter((s: any) => s.type === 'teaches').map((s: any) => s.skill?.name).filter(Boolean).slice(0, 2).join(' & ') 
          : 'Peer Mentoring');
      const roleStr = p.role === 'teacher' ? `Mentor • Teaches ${teaches}` : `Student • Teaches ${teaches}`;
      const rInfo = formatRating(p.id);
      result.push({
        id: p.id,
        name: p.name || 'Peer Scholar',
        avatar: p.avatar,
        role: roleStr,
        rating: rInfo.rating,
        isNew: rInfo.isNew,
        reviewCount: rInfo.reviewCount,
        isAvailableNow: p.isAvailableNow
      });
      if (result.length >= 3) break;
    }

    return result;
  }, [currentUser, peers, recommendedPeerMatch, peerReviewsMap]);

  if (!currentUser) return <div className="p-8 text-center text-on-surface-variant font-bold animate-pulse text-sm">Loading dashboard...</div>;

  const isBothRole = loginRole === 'both' || currentUser?.role === 'both';
  const isTeacherRole = role === 'teacher' || (!isBothRole && (loginRole === 'teacher' || currentUser?.role === 'teacher'));

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

  const roleSubtitle = confirmedSessions.length === 0
    ? "Let's get your first session booked."
    : isTeacherRole 
      ? `You have ${confirmedSessions.length} active lecture${confirmedSessions.length !== 1 ? 's' : ''} scheduled with student payments enabled.`
      : `You have ${confirmedSessions.length} active learning session${confirmedSessions.length !== 1 ? 's' : ''} scheduled.`;

  // Onboarding status checks
  const isProfileComplete = Boolean(
    (currentUser?.skillsTaught && currentUser.skillsTaught.length > 0) ||
    (currentUser?.skillsLearned && currentUser.skillsLearned.length > 0) ||
    (currentUser?.userSkills && currentUser.userSkills.length > 0)
  );
  const hasBookedSession = confirmedSessions.length > 0 || sessions.length > 0;
  const showOnboarding = sessions.length === 0 || (!isProfileComplete || !hasVisitedMatchFinder || !hasBookedSession);

  // Build Stat Cards dynamically per role for slim strip
  const statCards = isTeacherRole ? [
    { 
      label: 'Mentoring Revenue', 
      value: `₹${totalEarned.toLocaleString('en-IN')}`, 
      unit: 'earned',
      icon: 'payments',
      path: '/wallet' 
    },
    { 
      label: 'Hours Taught', 
      value: hoursTaught.toString(), 
      unit: 'hrs',
      icon: 'schedule',
      path: '/teacher' 
    },
    { 
      label: 'Teaching Skills', 
      value: teachSkills.length.toString(), 
      unit: 'skills',
      icon: 'school',
      path: '/profile' 
    },
    { 
      label: 'Trust Rating', 
      value: trustScoreNum.toFixed(2), 
      unit: '/ 5.0',
      icon: 'star',
      path: '/feedback' 
    }
  ] : [
    { 
      label: 'Mentoring Payments', 
      value: `₹${totalSpent.toLocaleString('en-IN')}`, 
      unit: 'spent',
      icon: 'payments',
      path: '/wallet' 
    },
    { 
      label: 'Hours Learned', 
      value: hoursLearned.toString(), 
      unit: 'hrs',
      icon: 'schedule',
      path: '/schedule' 
    },
    { 
      label: isBothRole ? 'Active Skills' : 'Learning Goals', 
      value: activeTopicsCount, 
      unit: 'skills',
      icon: 'psychology',
      path: '/marketplace' 
    },
    { 
      label: 'Reliability Score', 
      value: `${Math.min(100, Math.round(trustScoreNum * 20))}%`, 
      unit: 'score',
      icon: 'verified_user',
      path: '/feedback' 
    }
  ];

  return (
    <>
      <div className="max-w-[1200px] mx-auto space-y-5 md:space-y-6 px-0 md:px-6 pb-6 md:pb-20 select-none">

      {/* Search Results Banner when search query is active */}
      {query && (
        <div className="bg-surface border border-primary/30 rounded-xl p-5 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">search</span>
              <h2 className="text-sm font-semibold text-text">
                Search Results for "<span className="text-primary font-bold">{searchQuery}</span>"
              </h2>
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-semibold text-muted hover:text-text flex items-center gap-1 cursor-pointer"
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
                <div key={peer.id} className="bg-surface border border-border rounded-lg p-3 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src={peer.avatar || 'https://i.pravatar.cc/150?img=11'} alt={peer.name} className="w-8 h-8 rounded-full object-cover border border-border" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text truncate">{peer.name}</p>
                      <p className="text-xs text-muted truncate">Teaches: {Array.isArray(peer.skillsTaught) ? peer.skillsTaught.join(', ') : 'Tech & Design'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/marketplace')}
                    className="py-1 px-2.5 text-xs font-medium bg-primary/10 text-primary-text border border-primary/20 rounded-md hover:bg-primary/20 transition-colors shrink-0 cursor-pointer"
                  >
                    View Mentor
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clean Dashboard Header (Directly on page background) */}
      <DashboardHeroHeader
        greeting={getGreeting()}
        userName={currentUser?.name?.split(' ')[0] || 'Peer'}
        roleBadgeLabel={roleBadgeLabel}
        roleSubtitle={roleSubtitle}
        isTeacherRole={isTeacherRole}
        onFindMatch={() => navigate('/match-finder')}
        onSchedule={() => navigate('/schedule')}
        streakCount={currentStreak}
        isTodayCompleted={isTodayCompleted}
        weeklyTrackerDays={weeklyTrackerDays}
        canClaimBonus={canClaimBonus}
        isClaimingStreak={isClaimingStreak}
        streakClaimSuccess={streakClaimSuccess}
        onClaimBonus={handleClaimStreakReward}
      />

      {(role === 'teacher' || currentUser?.role === 'teacher' || currentUser?.role === 'both') && !currentUser?.upiId && (
        <div className="bg-surface border border-border rounded-xl p-4 shadow-xs flex items-center justify-between gap-3 text-sm">
          <p className="text-muted min-w-0 text-xs">
            Payments are not set up. Add a UPI ID in your profile to accept student payments.
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="text-xs font-semibold text-primary hover:text-primary-hover shrink-0 cursor-pointer"
          >
            Set up
          </button>
        </div>
      )}

      {/* Pending Student Booking Requests Alert for Mentors */}
      {pendingRequestsForMe.length > 0 && (
        <div className="bg-surface border border-primary/30 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">mark_email_unread</span>
              <h3 className="text-sm font-semibold text-text">
                Pending Student Booking Requests ({pendingRequestsForMe.length})
                {isBothRole && role === 'student' && (
                  <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-500/30 ml-2">
                    Mentor Action Required
                  </span>
                )}
              </h3>
            </div>
            <span className="text-xs text-muted">Review & approve to unlock live classroom</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingRequestsForMe.map(req => (
              <div key={req.id} className="bg-surface rounded-lg p-4 border border-border flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <img
                    src={req.student?.avatar || `https://i.pravatar.cc/150?img=11`}
                    alt={req.student?.name || 'Student'}
                    className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-text truncate">{req.title}</h4>
                    <p className="text-xs text-muted mt-0.5">
                      Student: <strong className="text-text font-medium">{req.student?.name || 'Learner'}</strong>
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted mt-1">
                      <span>📅 {req.scheduledAt ? new Date(req.scheduledAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Flexible'}</span>
                      {req.paymentStatus === 'held' && (
                        <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent-text font-semibold border border-accent/20 text-xs">
                          Tokens Held
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <Button
                    variant="primary"
                    disabled={actingSessionId === req.id}
                    onClick={() => handleAcceptBooking(req.id)}
                    className="flex-1 py-1.5 text-xs font-medium flex items-center justify-center gap-1 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>{actingSessionId === req.id ? 'Confirming...' : 'Accept Request'}</span>
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actingSessionId === req.id}
                    onClick={() => handleDeclineBooking(req.id)}
                    className="flex-1 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 flex items-center justify-center gap-1 border border-border"
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

      {/* Slim Stats Strip - Single white card divided by vertical hairlines */}
      <div className="bg-surface border border-border rounded-xl shadow-xs grid grid-cols-2 lg:grid-cols-4 divide-y divide-border lg:divide-y-0 lg:divide-x overflow-hidden">
        {statCards.map((stat, i) => (
          <div 
            key={i} 
            onClick={() => navigate(stat.path)}
            className="p-3 sm:px-5 sm:py-3.5 flex items-center gap-2.5 sm:gap-3.5 hover:bg-surface-2/60 cursor-pointer transition-colors duration-150 min-w-0"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]" aria-hidden="true">
                {stat.icon}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted font-medium whitespace-normal leading-tight lg:truncate">{stat.label}</p>
              <div className="flex items-baseline mt-0.5 min-w-0 flex-wrap sm:flex-nowrap">
                <span className="text-lg sm:text-xl lg:text-2xl font-bold text-text leading-tight tracking-tight tabular-nums truncate">
                  {stat.value}
                </span>
                <span className="text-[11px] sm:text-xs text-muted font-normal ml-1 shrink-0">
                  {stat.unit}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Row 1: Your Next Step (8 cols) & Upcoming Sessions (4 cols) - Equal Height Stretch */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-stretch">
        {/* Left Column (8 cols): Your next step */}
        <div className="lg:col-span-8 flex flex-col">
          {showOnboarding ? (
            <OnboardingChecklistCard
              isProfileComplete={isProfileComplete}
              isMatched={hasVisitedMatchFinder}
              hasBookedSession={hasBookedSession}
              onEditProfile={() => navigate('/profile')}
              onFindMatch={() => {
                localStorage.setItem('mindroot_onboarding_matched', 'true');
                setHasVisitedMatchFinder(true);
                navigate('/match-finder');
              }}
              onSchedule={() => navigate('/schedule')}
            />
          ) : filteredSessions.length > 0 ? (
            <div className="bg-surface border border-border rounded-xl p-5 shadow-xs flex items-center justify-between gap-4 h-full">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">event</span>
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Your Next Step</span>
                  <h4 className="text-sm font-semibold text-text truncate mt-0.5">
                    {filteredSessions[0].title}
                  </h4>
                  <p className="text-xs text-muted truncate">
                    {filteredSessions[0].scheduledAt ? new Date(filteredSessions[0].scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Scheduled'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/live/${filteredSessions[0].id}`)}
                className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">videocam</span>
                <span>Enter Room</span>
              </button>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl p-5 shadow-xs flex items-center justify-between gap-4 h-full">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">school</span>
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Your Next Step</span>
                  <h4 className="text-sm font-semibold text-text truncate mt-0.5">
                    Find your next study partner or mentor
                  </h4>
                  <p className="text-xs text-muted truncate">
                    Explore peer topics and schedule a 1-on-1 collaborative exchange
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/marketplace')}
                className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                Find Peers
              </button>
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Upcoming Sessions Widget */}
        <div className="lg:col-span-4 flex flex-col">
          <UpcomingSessionsWidget
            sessions={filteredSessions}
            currentUserId={currentUser?.id}
            sessionNoteCounts={sessionNoteCounts}
            isSessionLiveNow={isSessionLiveNow}
            getCountdownLabel={getCountdownLabel}
            getGoogleCalendarUrl={getGoogleCalendarUrl}
            onDownloadIcs={handleDownloadIcs}
            onSelectSessionForNotes={(session) => setSelectedSessionForNotes(session)}
            onJoinRoom={(sessionId) => navigate(`/live/${sessionId}`)}
            onFindMatch={() => navigate('/match-finder')}
            onOpenSchedule={() => navigate('/schedule')}
          />
        </div>
      </div>

      {/* Main Row 2: Suggested Peers (12 cols full-width 3-card grid with 0 gap) */}
      <div className="w-full">
        <SuggestedPeersCard
          peers={suggestedPeersList}
          loading={peers.length === 0}
          onBrowseAll={() => navigate('/match-finder')}
          onConnect={(peerId) => navigate(`/messages?peerId=${peerId}`, { state: { peerId } })}
        />
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
    </>
  );
}
