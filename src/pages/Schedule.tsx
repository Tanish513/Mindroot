import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { SkeletonCard } from '../components/ui/Skeleton';
import { useAppStore } from '../store/useAppStore';
import { api, onSessionsUpdated, onPeersUpdated, calculateSeatPrice, getCapacityDetails, getAuthItem } from '../lib/api';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import { UpiPaymentModal, type UpiPaymentSession } from '../components/payment/UpiPaymentModal';
import { SessionNotesPanel } from '../components/notes/SessionNotesPanel';
import { getUserTimezone, getTimezoneAbbreviation } from '../lib/timezone';

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]; // 8 AM to 9 PM (14 hours, row height 48px)

function formatHour(h: number) {
  if (h === 12) return '12 PM';
  if (h > 12) return `${h - 12} PM`;
  return `${h} AM`;
}

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultTimeString = () => {
  const d = new Date();
  let hour = d.getHours() + 1;
  if (hour > 20 || hour < 8) hour = 9;
  return `${String(hour).padStart(2, '0')}:00`;
};

const isDateToday = (d: Date) => {
  const today = new Date();
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
};

export function Schedule() {
  const userTz = getUserTimezone();
  const tzAbbr = getTimezoneAbbreviation(userTz);
  const [activeTab, setActiveTab] = useState<'confirmed' | 'pending' | 'completed'>('confirmed');
  const [viewMode, setViewMode] = useState<'week' | 'day' | 'month'>('week');
  const [weekLayout, setWeekLayout] = useState<'agenda' | 'grid'>('agenda');
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [peers, setPeers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const { searchQuery, currentUser } = useAppStore();
  const navigate = useNavigate();

  const calendarScrollRef = useRef<HTMLDivElement>(null);

  // Direct Peer UPI Modal State
  const [upiModalSession, setUpiModalSession] = useState<UpiPaymentSession | null>(null);
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);

  // Session Notes Panel State & Counts
  const [sessionNoteCounts, setSessionNoteCounts] = useState<Record<string, number>>({});
  const [selectedSessionForNotes, setSelectedSessionForNotes] = useState<any | null>(null);

  const handleCopySessionLink = (sessionId: string) => {
    const link = `${window.location.origin}/live/${sessionId}`;
    navigator.clipboard.writeText(link);
    setCopiedSessionId(sessionId);
    setTimeout(() => setCopiedSessionId(null), 2500);
  };

  const getGoogleCalendarUrl = (session: any) => {
    const title = encodeURIComponent(session.title || 'Mindroot Peer Learning Session');
    const start = session.scheduledAt ? new Date(session.scheduledAt) : new Date();
    const durationMin = session.durationMin || 60;
    const end = new Date(start.getTime() + durationMin * 60000);
    const formatTime = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const dates = `${formatTime(start)}/${formatTime(end)}`;
    const details = encodeURIComponent(`Mindroot Peer Mentorship with ${session.teacher?.name || 'Mentor'}.\nClassroom link: ${window.location.origin}/live/${session.id}`);
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
      'PRODID:-//Mindroot//Peer Mentoring Platform//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:session-${session.id}@mindroot.com`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(start)}`,
      `DTEND:${formatDate(end)}`,
      `SUMMARY:${session.title || 'Mindroot Peer Session'}`,
      `DESCRIPTION:Peer learning session with ${session.teacher?.name || 'Mentor'}. Meeting link: ${window.location.origin}/live/${session.id}`,
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

  const getCountdownBadge = (scheduledAt?: string) => {
    if (!scheduledAt) return null;
    const diffMin = Math.round((new Date(scheduledAt).getTime() - Date.now()) / 60000);
    if (diffMin <= 15 && diffMin >= -60) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-primary-tint text-primary-text border border-primary/20 font-bold text-xs animate-pulse flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          ● LIVE CLASSROOM READY
        </span>
      );
    }
    if (diffMin > 0 && diffMin <= 60) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-accent-tint text-accent-text border border-accent/20 font-bold text-xs">
          Starts in {diffMin}m
        </span>
      );
    }
    return null;
  };

  const isSessionLiveNow = (scheduledAt?: string) => {
    if (!scheduledAt) return false;
    const diffMin = Math.round((new Date(scheduledAt).getTime() - Date.now()) / 60000);
    return diffMin <= 15 && diffMin >= -60;
  };

  // Active reference date and derived week start (Monday)
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d);
    mon.setDate(diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  }, [currentDate]);

  const loadData = useCallback(() => {
    Promise.all([api.getSessions(), api.getPeers(), api.getNotes().catch(() => [])])
      .then(([sessionsData, peersData, notesData]) => {
        setSessions(sessionsData);
        setPeers(peersData);
        if (Array.isArray(notesData)) {
          const counts: Record<string, number> = {};
          for (const n of notesData) {
            if (n.sessionId) {
              counts[n.sessionId] = (counts[n.sessionId] || 0) + 1;
            }
          }
          setSessionNoteCounts(counts);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
    const unsubSessions = onSessionsUpdated(() => {
      loadData();
    });
    const unsubPeers = onPeersUpdated(() => {
      loadData();
    });
    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && getAuthItem('mindroot_auth_token')) {
        api.getSessions()
          .then(setSessions)
          .catch(() => {});
      }
    }, 15000);
    return () => {
      unsubSessions();
      unsubPeers();
      clearInterval(interval);
    };
  }, [loadData]);

  // Auto-scroll calendar grid to current hour on load (only for hourly timeline views)
  useEffect(() => {
    if (calendarScrollRef.current) {
      if (viewMode === 'day' || (viewMode === 'week' && weekLayout === 'grid')) {
        const now = new Date();
        const currentHour = now.getHours();
        const targetHour = Math.min(Math.max(currentHour - 1, 8), 20);
        const scrollOffset = (targetHour - 8) * 48;
        calendarScrollRef.current.scrollTo({ top: scrollOffset, behavior: 'smooth' });
      } else {
        calendarScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [loading, viewMode, weekLayout]);

  const handleNextDate = () => {
    setCurrentDate(prev => {
      const next = new Date(prev);
      if (viewMode === 'day') {
        next.setDate(next.getDate() + 1);
      } else if (viewMode === 'month') {
        next.setMonth(next.getMonth() + 1);
      } else {
        next.setDate(next.getDate() + 7);
      }
      return next;
    });
  };

  const handlePrevDate = () => {
    setCurrentDate(prev => {
      const next = new Date(prev);
      if (viewMode === 'day') {
        next.setDate(next.getDate() - 1);
      } else if (viewMode === 'month') {
        next.setMonth(next.getMonth() - 1);
      } else {
        next.setDate(next.getDate() - 7);
      }
      return next;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getWeekRangeString = () => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return `${weekStart.toLocaleDateString('en-US', { timeZone: userTz, month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { timeZone: userTz, month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const getDateRangeString = () => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', {
        timeZone: userTz,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', {
        timeZone: userTz,
        month: 'long',
        year: 'numeric',
      });
    }
    return getWeekRangeString();
  };

  // Filter sessions involving current user
  const userSessions = sessions.filter(s => {
    if (!currentUser) return false;
    const isDirect = s.teacherId === currentUser.id || s.teacher?.id === currentUser.id || s.studentId === currentUser.id || s.student?.id === currentUser.id;
    const isInCohort = Array.isArray(s.students) && s.students.some((st: any) => st.id === currentUser.id);
    return isDirect || isInCohort;
  });

  const rawGroupCohorts = userSessions.filter(s => (s.maxCapacity || 1) > 1 && (s.status === 'confirmed' || s.status === 'live' || s.status === 'pending'));
  const cohortKeyMap = new Map<string, any>();
  rawGroupCohorts.forEach(cohort => {
    const tId = cohort.teacherId || cohort.teacher?.id;
    const titleKey = (cohort.title || '').toLowerCase().trim();
    const dayKey = cohort.scheduledAt ? new Date(cohort.scheduledAt).toDateString() : 'no-date';
    const key = `${tId}_${titleKey}_${dayKey}`;

    if (!cohortKeyMap.has(key)) {
      cohortKeyMap.set(key, { ...cohort });
    } else {
      const existing = cohortKeyMap.get(key);
      const curStudents = Array.isArray(existing.students) ? existing.students : [];
      const newStudents = Array.isArray(cohort.students) ? cohort.students : [];
      newStudents.forEach((st: any) => {
        if (st && st.id && !curStudents.some((e: any) => e.id === st.id)) {
          curStudents.push(st);
        }
      });
      existing.students = curStudents;
      if (cohort.status === 'confirmed' || cohort.status === 'live') {
        existing.status = cohort.status;
      }
    }
  });
  const activeGroupCohorts = Array.from(cohortKeyMap.values());

  const isPastSession = (s: any) => {
    if (!s || !s.scheduledAt) return false;
    const startTime = new Date(s.scheduledAt).getTime();
    const durationMs = (s.durationMin || 60) * 60 * 1000;
    return startTime + durationMs <= Date.now();
  };

  // Next upcoming session
  // Filter by active status tab
  const tabSessions = userSessions.filter(s => {
    const isPast = isPastSession(s);
    if (activeTab === 'confirmed') {
      return (s.status === 'confirmed' || s.status === 'live') && !isPast;
    }
    if (activeTab === 'pending') {
      return s.status === 'pending';
    }
    if (activeTab === 'completed') {
      return s.status === 'completed' || (s.status === 'confirmed' && isPast);
    }
    return s.status === activeTab;
  });

  const confirmedCount = userSessions.filter(s => (s.status === 'confirmed' || s.status === 'live') && !isPastSession(s)).length;
  const pendingCount = userSessions.filter(s => s.status === 'pending').length;
  const completedCount = userSessions.filter(s => s.status === 'completed' || (s.status === 'confirmed' && isPastSession(s))).length;

  const filteredSessions = tabSessions.filter(s => {
    if (searchQuery.trim() === '') return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = s.title?.toLowerCase().includes(query);
    const peerName = s.teacherId === currentUser?.id ? s.student?.name : s.teacher?.name;
    const peerMatch = peerName?.toLowerCase().includes(query);
    return titleMatch || peerMatch;
  });

  const handleDeleteSession = async (id: string) => {
    if (window.confirm('Are you sure you want to cancel this session?')) {
      try {
        await api.deleteSession(id);
        setSessions(prev => prev.filter(s => s.id !== id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handlePayForSession = (session: any) => {
    const amountToPay = session.pricePerStudent || session.amount || session.teacher?.hourlyRate || 499;
    setUpiModalSession({
      id: session.id,
      title: session.title || 'Mentoring Lecture',
      amount: amountToPay,
      teacherId: session.teacherId || session.teacher?.id,
      teacherName: session.teacher?.name || 'Mentor',
      teacherAvatar: session.teacher?.avatar,
      teacherUpiId: session.teacher?.upiId
    });
    setIsUpiModalOpen(true);
  };

  const handleCompleteSession = async (id: string) => {
    try {
      await api.patchSession(id, { status: 'completed' });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Check if a session lands on a given date and hour
  const getSessionForDateAndHour = useCallback((slotDate: Date, hour: number) => {
    return userSessions.find(s => {
      if (s.status === 'completed' || isPastSession(s)) return false;
      const sDate = new Date(s.scheduledAt);

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: userTz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        hourCycle: 'h23'
      });
      const sParts = formatter.formatToParts(sDate);
      const sY = sParts.find(p => p.type === 'year')?.value;
      const sM = sParts.find(p => p.type === 'month')?.value;
      const sD = sParts.find(p => p.type === 'day')?.value;
      const sH = parseInt(sParts.find(p => p.type === 'hour')?.value || '0', 10);

      const slotParts = formatter.formatToParts(slotDate);
      const slotY = slotParts.find(p => p.type === 'year')?.value;
      const slotM = slotParts.find(p => p.type === 'month')?.value;
      const slotD = slotParts.find(p => p.type === 'day')?.value;

      const matchesSlot = (
        sY === slotY &&
        sM === slotM &&
        sD === slotD &&
        sH === hour
      );
      if (!matchesSlot) return false;
      if (searchQuery.trim() === '') return true;
      const query = searchQuery.toLowerCase();
      const titleMatch = s.title?.toLowerCase().includes(query);
      const peerName = s.teacherId === currentUser?.id ? s.student?.name : s.teacher?.name;
      const peerMatch = peerName?.toLowerCase().includes(query);
      return titleMatch || peerMatch;
    });
  }, [userSessions, userTz, currentUser?.id, searchQuery]);

  // Check if a session lands on a given day/hour of the active week
  const getSessionForSlot = useCallback((dayIndex: number, hour: number) => {
    const slotDate = new Date(weekStart);
    slotDate.setDate(slotDate.getDate() + dayIndex);
    return getSessionForDateAndHour(slotDate, hour);
  }, [weekStart, getSessionForDateAndHour]);

  // Get all active sessions for a given calendar day (used by month view)
  const getSessionsForDay = useCallback((targetDate: Date) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const targetParts = formatter.formatToParts(targetDate);
    const tY = targetParts.find(p => p.type === 'year')?.value;
    const tM = targetParts.find(p => p.type === 'month')?.value;
    const tD = targetParts.find(p => p.type === 'day')?.value;

    return userSessions.filter(s => {
      if (s.status === 'completed' || isPastSession(s)) return false;
      const sDate = new Date(s.scheduledAt);
      const sParts = formatter.formatToParts(sDate);
      const sY = sParts.find(p => p.type === 'year')?.value;
      const sM = sParts.find(p => p.type === 'month')?.value;
      const sD = sParts.find(p => p.type === 'day')?.value;

      const matchesDay = sY === tY && sM === tM && sD === tD;
      if (!matchesDay) return false;
      if (searchQuery.trim() === '') return true;
      const query = searchQuery.toLowerCase();
      const titleMatch = s.title?.toLowerCase().includes(query);
      const peerName = s.teacherId === currentUser?.id ? s.student?.name : s.teacher?.name;
      const peerMatch = peerName?.toLowerCase().includes(query);
      return titleMatch || peerMatch;
    });
  }, [userSessions, userTz, currentUser?.id, searchQuery]);

  // Generate 35-42 days for month grid view (Mon-Sun)
  const monthGridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday is index 0 (0: Mon, 1: Tue, ... 6: Sun)
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Leading days from previous month
    for (let i = startDayOfWeek; i > 0; i--) {
      const prevDate = new Date(year, month, 1 - i);
      days.push({ date: prevDate, isCurrentMonth: false });
    }

    // Days of current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }

    // Trailing days from next month to fill grid to full weeks (35 or 42 cells)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    while (days.length < 35) {
      const nextDate = new Date(days[days.length - 1].date);
      nextDate.setDate(nextDate.getDate() + 1);
      days.push({ date: nextDate, isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  // Booking states
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedPeerId, setSelectedPeerId] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [bookingDate, setBookingDate] = useState(getTodayDateString());
  const [bookingTime, setBookingTime] = useState(getDefaultTimeString());
  const [bookingCapacity, setBookingCapacity] = useState<number>(1);
  const [bookingTitle, setBookingTitle] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [conflictData, setConflictData] = useState<{
    conflict?: boolean;
    nearestSlot?: string | null;
    nearestSlotFormatted?: string | null;
    noAvailability?: boolean;
    message?: string;
  } | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isSlotAvailable, setIsSlotAvailable] = useState<boolean | null>(null);

  // Pre-flight availability check
  useEffect(() => {
    if (!isBookingOpen || !selectedPeerId || !bookingDate || !bookingTime) {
      setIsCheckingAvailability(false);
      setIsSlotAvailable(null);
      setConflictData(null);
      setBookingError('');
      return;
    }

    const scheduledDate = new Date(`${bookingDate}T${bookingTime}`);
    if (isNaN(scheduledDate.getTime())) {
      setIsCheckingAvailability(false);
      setIsSlotAvailable(null);
      return;
    }

    setIsCheckingAvailability(true);
    setBookingError('');
    setConflictData(null);

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await api.checkSlotAvailability(selectedPeerId, scheduledDate.toISOString(), 60, controller.signal);
        if (res.available) {
          setIsSlotAvailable(true);
          setConflictData(null);
          setBookingError('');
        } else if (res.conflict) {
          setIsSlotAvailable(false);
          setConflictData({
            nearestSlot: res.nearestSlot || null,
            nearestSlotFormatted: res.nearestSlotFormatted || (res.nearestSlot ? new Date(res.nearestSlot).toLocaleString() : null),
            noAvailability: Boolean(res.noAvailability || (!res.nearestSlot && res.hasAvailability === false)),
            message: res.message
          });
          const peerName = peers.find(p => p.id === selectedPeerId)?.name || 'this teacher';
          setBookingError(`This time slot is already booked for ${peerName}.`);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Availability check failed:', err);
        }
      } finally {
        setIsCheckingAvailability(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isBookingOpen, selectedPeerId, bookingDate, bookingTime, bookingCapacity]);

  const handleOpenBookingModal = (peerId?: string, slotISO?: string) => {
    if (slotISO) {
      const sDate = new Date(slotISO);
      setBookingDate(sDate.toISOString().split('T')[0]);
      setBookingTime(sDate.toTimeString().slice(0, 5));
    } else {
      setBookingDate(getTodayDateString());
      setBookingTime(getDefaultTimeString());
    }

    if (peerId) {
      setSelectedPeerId(peerId);
      const peerObj = peers.find(p => p.id === peerId);
      const peerSkills = peerObj && Array.isArray(peerObj.userSkills)
        ? peerObj.userSkills.filter((us: any) => us && us.type === 'teaches')
        : (Array.isArray(peerObj?.skillsTaught) ? peerObj.skillsTaught.map((t: string) => ({ type: 'teaches', skill: { id: 's-' + t, name: t } })) : []);
      if (peerSkills.length > 0) {
        setSelectedSkillId(peerSkills[0].skill?.id || peerSkills[0].id);
        setBookingTitle(peerSkills[0].skill?.name || peerSkills[0].name || '');
      }
    } else {
      setSelectedPeerId('');
      setSelectedSkillId('');
      setBookingTitle('');
    }

    setBookingCapacity(1);
    setBookingError('');
    setConflictData(null);
    setIsSlotAvailable(null);
    setIsCheckingAvailability(false);
    setIsBookingOpen(true);
  };

  const handleApproveSession = async (id: string) => {
    try {
      await api.patchSession(id, { status: 'confirmed' });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeclineSession = async (id: string) => {
    try {
      await api.patchSession(id, { status: 'declined' });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateBooking = async (overrideSlotISO?: string) => {
    if (overrideSlotISO) {
      const parsedOverride = new Date(overrideSlotISO);
      if (!isNaN(parsedOverride.getTime())) {
        const yyyy = parsedOverride.getFullYear();
        const mm = String(parsedOverride.getMonth() + 1).padStart(2, '0');
        const dd = String(parsedOverride.getDate()).padStart(2, '0');
        const hh = String(parsedOverride.getHours()).padStart(2, '0');
        const min = String(parsedOverride.getMinutes()).padStart(2, '0');
        setBookingDate(`${yyyy}-${mm}-${dd}`);
        setBookingTime(`${hh}:${min}`);
      }
    }
    if (!selectedPeerId || (!overrideSlotISO && (!bookingDate || !bookingTime)) || !bookingTitle) {
      setBookingError('Please fill in all booking fields.');
      return;
    }
    const scheduledAt = overrideSlotISO ? new Date(overrideSlotISO) : new Date(`${bookingDate}T${bookingTime}`);
    if (isNaN(scheduledAt.getTime())) {
      setBookingError('Invalid date/time.');
      return;
    }
    try {
      setBookingError('');
      setConflictData(null);
      const seatPrice = calculateSeatPrice(selectedPeer, bookingCapacity);

      await api.postSession({
        title: bookingTitle,
        teacherId: selectedPeerId,
        studentId: currentUser?.id || 'user-alex',
        skillId: selectedSkillId || undefined,
        scheduledAt: scheduledAt.toISOString(),
        durationMin: 60,
        maxCapacity: bookingCapacity,
        pricePerStudent: seatPrice,
        amount: seatPrice
      });
      setIsBookingOpen(false);
      loadData();
      setBookingTitle('');
      setSelectedPeerId('');
      setSelectedSkillId('');
      setBookingDate(getTodayDateString());
      setBookingTime(getDefaultTimeString());
      setBookingCapacity(1);
      setBookingError('');
      setConflictData(null);
      setIsSlotAvailable(null);
    } catch (err: any) {
      if (err.code === 'MENTOR_PAYOUT_NOT_CONFIGURED' || err.message?.includes('MENTOR_PAYOUT_NOT_CONFIGURED') || err.message?.includes('payout address (VPA)')) {
        setBookingError('This mentor has not set up payments yet. Booking is currently unavailable for this mentor.');
      } else if (err.conflict) {
        setIsSlotAvailable(false);
        setConflictData({
          nearestSlot: err.nearestSlot || null,
          nearestSlotFormatted: err.nearestSlotFormatted || (err.nearestSlot ? new Date(err.nearestSlot).toLocaleString() : null),
          noAvailability: Boolean(err.noAvailability || (!err.nearestSlot && err.hasAvailability === false)),
          message: err.message
        });
        const peerName = peers.find(p => p.id === selectedPeerId)?.name || 'this teacher';
        setBookingError(err.message || `This time slot is already booked for ${peerName}.`);
      } else if (err.status === 401 || (err.message && (err.message.includes('Unauthorized') || err.message.includes('authentication token') || err.message.includes('auth token') || err.message.includes('session has expired')))) {
        setBookingError('Your session has expired or requires sign-in. Please sign in to reserve this lecture.');
      } else {
        setBookingError(err.message || 'Failed to create booking.');
      }
    }
  };

  const selectedPeer = peers.find(p => p.id === selectedPeerId);
  const selectedPeerSkills = selectedPeer && Array.isArray(selectedPeer.userSkills)
    ? selectedPeer.userSkills.filter((us: any) => us && us.type === 'teaches')
    : (Array.isArray(selectedPeer?.skillsTaught) ? selectedPeer.skillsTaught.map((t: string) => ({ type: 'teaches', skill: { id: 's-' + t, name: t } })) : []);

  // Shared session block renderer for time-slot views (Week and Day)
  const renderSessionBlock = (cellSession: any, hour: number) => {
    const isTeacher = cellSession.teacherId === currentUser?.id;
    const isLive = cellSession.status === 'live';
    return (
      <div
        className={clsx(
          "h-[40px] my-auto mx-0.5 px-2 rounded-r-md flex flex-col justify-center overflow-hidden shadow-xs cursor-pointer hover:brightness-95 transition-all text-left border-l-[3px]",
          isLive
            ? "bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-100 border-l-red-600 animate-pulse"
            : isTeacher
            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 border-l-amber-500"
            : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 border-l-emerald-600"
        )}
        title={`${cellSession.title} (${isTeacher ? 'Teaching' : 'Learning'})`}
      >
        <div className="flex items-center gap-1 text-xs font-bold truncate leading-tight">
          <span className="material-symbols-outlined text-[13px] shrink-0">
            {isLive ? 'videocam' : isTeacher ? 'school' : 'menu_book'}
          </span>
          <span className="truncate">{cellSession.title}</span>
        </div>
        <div className="text-xs font-medium opacity-85 truncate leading-tight">
          {formatHour(hour)} • {isTeacher ? (cellSession.student?.name || 'Student') : (cellSession.teacher?.name || 'Mentor')}
        </div>
      </div>
    );
  };

  // Current time metrics for red line indicator
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const isCurrentHourVisible = currentHour >= 8 && currentHour <= 21;

  return (
    <div className="max-w-[1280px] mx-auto w-full flex flex-col space-y-6 pb-12 select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Schedule & Bookings</h1>
          <p className="text-xs sm:text-sm text-muted">Manage your peer learning sessions, time slots, and upcoming lectures.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadData} className="flex items-center gap-1.5 cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>Sync</span>
          </Button>
          <Button variant="primary" size="sm" onClick={() => handleOpenBookingModal()} className="flex items-center gap-1.5 shadow-xs cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>New Booking</span>
          </Button>
        </div>
      </div>

      {/* Active Live Cohort Classes Banner */}
      {activeGroupCohorts.length > 0 && (
        <div className="bg-surface-2 border border-border rounded-2xl p-5 text-text shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
              <h3 className="text-sm sm:text-base font-bold text-text">Active Cohort Classrooms Ready</h3>
            </div>
            <p className="text-xs text-muted">All enrolled peers join the exact same interactive studio.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeGroupCohorts.map(cohort => {
              const enrolled = Array.isArray(cohort.students) ? cohort.students.length : 1;
              const cap = cohort.maxCapacity || 3;

              return (
                <div key={cohort.id} className="bg-surface border border-border rounded-xl p-3.5 flex flex-col justify-between gap-2.5 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 bg-primary-tint text-primary-text border border-primary/20 rounded-full text-xs font-bold uppercase">
                        {cap}-Student Batch
                      </span>
                      <span className="text-xs font-bold text-primary flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Room Active
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-text mt-1">{cohort.title}</h4>
                    <p className="text-xs text-muted">
                      Instructor: <strong className="text-text">{cohort.teacher?.name || 'Mentor'}</strong> · {enrolled}/{cap} Enrolled
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/live/${cohort.id}`)}
                      className="flex-1 py-1.5 text-xs font-bold shadow-xs flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">videocam</span>
                      <span>Join Live Room ({cap} Seats)</span>
                    </Button>
                    <button
                      onClick={() => setSelectedSessionForNotes(cohort)}
                      className="p-1.5 bg-surface-2 hover:bg-surface text-text rounded-lg border border-border text-xs cursor-pointer"
                      title="Cohort Notes"
                    >
                      <span className="material-symbols-outlined text-[15px] text-primary">edit_note</span>
                    </button>
                    <button
                      onClick={() => handleCopySessionLink(cohort.id)}
                      className="p-1.5 bg-surface-2 hover:bg-surface text-text rounded-lg border border-border text-xs cursor-pointer"
                      title="Copy Direct Link"
                    >
                      <span className="material-symbols-outlined text-[15px]">{copiedSessionId === cohort.id ? 'check' : 'content_copy'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4 py-8">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        /* Layout: max-width ~1280px, Two-column grid (Calendar ~70%, Side panel ~30%), 24px gap */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* COLUMN 1: Flat Weekly Calendar Grid (~70% -> lg:col-span-8) */}
          <div className="lg:col-span-8 bg-surface rounded-xl border border-border shadow-xs overflow-hidden flex flex-col lg:h-[585px]">
            {/* Clean White Card Header */}
            <div className="bg-surface border-b border-border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-base sm:text-lg font-semibold text-text">Weekly Availability</h2>
                <span className="text-xs text-muted font-normal">
                  {tzAbbr} ({userTz})
                </span>
                {/* Inline Legend */}
                <div className="hidden sm:flex items-center gap-3 text-xs text-muted font-medium pl-3 border-l border-border">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary" /> Learning
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-accent" /> Teaching
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> Live Room
                  </span>
                </div>
              </div>

              {/* Header Right: Segmented Toggle, Today Button, Range Navigator */}
              <div className="flex items-center gap-2">
                {/* View Dropdown: Week (default), Day, Month */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowViewDropdown(prev => !prev)}
                    className="flex items-center gap-1 bg-surface-2 border border-border rounded-lg text-xs font-semibold text-text px-2.5 py-1 cursor-pointer hover:bg-surface"
                    aria-label="Calendar view mode"
                    data-testid="calendar-view-dropdown"
                  >
                    <span className="capitalize">{viewMode}</span>
                    <span className="material-symbols-outlined text-sm text-muted">expand_more</span>
                  </button>
                  {showViewDropdown && (
                    <div className="absolute left-0 mt-1 w-28 bg-surface border border-border rounded-xl shadow-lg z-50 p-1 space-y-0.5">
                      {(['week', 'day', 'month'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          data-testid={`calendar-view-option-${mode}`}
                          onClick={() => { setViewMode(mode); setShowViewDropdown(false); }}
                          className={clsx(
                            "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors",
                            viewMode === mode ? "bg-primary-tint text-primary-text font-bold" : "text-text hover:bg-surface-2"
                          )}
                        >
                          <span>{mode}</span>
                          {viewMode === mode && (
                            <span className="material-symbols-outlined text-sm text-primary font-bold">check</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Today button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToday}
                  data-testid="calendar-today-button"
                  className="text-xs font-semibold px-2.5 py-1 h-auto cursor-pointer"
                >
                  Today
                </Button>

                {/* Date range with prev/next arrows */}
                <div className="flex items-center gap-1 bg-surface-2 px-2 py-1 rounded-lg border border-border">
                  <button
                    onClick={handlePrevDate}
                    aria-label={`Previous ${viewMode}`}
                    data-testid="calendar-prev-button"
                    className="p-0.5 hover:text-text text-muted transition-colors rounded cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <span
                    data-testid="calendar-date-range-label"
                    className="text-xs font-semibold text-text px-1 whitespace-nowrap"
                  >
                    {getDateRangeString()}
                  </span>
                  <button
                    onClick={handleNextDate}
                    aria-label={`Next ${viewMode}`}
                    data-testid="calendar-next-button"
                    className="p-0.5 hover:text-text text-muted transition-colors rounded cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>

                {/* When in Week view: Cards (Idea 2) vs Timeline Toggle */}
                {viewMode === 'week' && (
                  <div className="hidden sm:flex items-center bg-surface-2 p-0.5 rounded-lg border border-border text-xs">
                    <button
                      type="button"
                      onClick={() => setWeekLayout('agenda')}
                      data-testid="week-layout-cards-btn"
                      className={clsx(
                        "px-2 py-0.5 rounded-md font-semibold transition-colors flex items-center gap-1 cursor-pointer",
                        weekLayout === 'agenda' ? "bg-surface text-primary shadow-xs font-bold" : "text-muted hover:text-text"
                      )}
                      title="Agenda Cards view (Content-first)"
                    >
                      <span className="material-symbols-outlined text-[14px]">view_column</span>
                      <span>Cards</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeekLayout('grid')}
                      data-testid="week-layout-timeline-btn"
                      className={clsx(
                        "px-2 py-0.5 rounded-md font-semibold transition-colors flex items-center gap-1 cursor-pointer",
                        weekLayout === 'grid' ? "bg-surface text-primary shadow-xs font-bold" : "text-muted hover:text-text"
                      )}
                      title="Hourly Timeline grid"
                    >
                      <span className="material-symbols-outlined text-[14px]">calendar_view_week</span>
                      <span>Timeline</span>
                    </button>
                  </div>
                )}

                {/* Schedule Session Button */}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenBookingModal()}
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Schedule Session
                </Button>
              </div>
            </div>

            {/* Scrollable Flat Calendar Grid: 1px hairline borders, row height 48px */}
            <div ref={calendarScrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-auto relative custom-scrollbar bg-surface">
              {viewMode === 'day' && (
                <div data-testid="calendar-grid-day" className="w-full">
                  {/* Sticky Day-Header Row */}
                  <div className="grid grid-cols-[64px_1fr] sticky top-0 z-30 bg-surface border-b border-border shadow-xs">
                    <div className="sticky left-0 z-40 bg-surface border-r border-border flex items-center justify-center p-2 text-xs font-semibold text-muted select-none">
                      {tzAbbr}
                    </div>
                    <div
                      className={clsx(
                        "py-2 px-3 text-left transition-colors flex items-center gap-3",
                        isDateToday(currentDate) ? "bg-primary/[0.05]" : "bg-surface"
                      )}
                    >
                      <div
                        className={clsx(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-transform shrink-0",
                          isDateToday(currentDate)
                            ? "bg-primary text-white font-bold shadow-xs scale-105"
                            : "text-text font-bold"
                        )}
                      >
                        {currentDate.getDate()}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            "text-xs uppercase tracking-wide",
                            isDateToday(currentDate) ? "text-primary font-bold" : "text-muted font-semibold"
                          )}
                        >
                          {currentDate.toLocaleDateString('en-US', { timeZone: userTz, weekday: 'short' })}
                        </span>
                        <span className="text-xs text-muted">
                          {currentDate.toLocaleDateString('en-US', { timeZone: userTz, month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 14 Hour Grid Rows */}
                  <div className="relative divide-y divide-border/60 border-b border-border">
                    {HOURS.map(hour => {
                      const isColToday = isDateToday(currentDate);
                      const cellSession = getSessionForDateAndHour(currentDate, hour);
                      return (
                        <div key={hour} className="grid grid-cols-[64px_1fr] h-[48px]">
                          {/* Sticky Time Column */}
                          <div className="sticky left-0 z-20 bg-surface border-r border-border/80 px-2 flex items-center justify-end text-xs font-medium text-muted select-none">
                            {formatHour(hour)}
                          </div>

                          {/* 1 Flat Day Cell */}
                          <div
                            onClick={() => {
                              if (cellSession) {
                                if (cellSession.status === 'confirmed' || cellSession.status === 'live') {
                                  navigate(`/live/${cellSession.id}`);
                                } else {
                                  setSelectedSessionForNotes(cellSession);
                                }
                              } else {
                                const year = currentDate.toLocaleDateString('en-CA', { timeZone: userTz, year: 'numeric' });
                                const month = currentDate.toLocaleDateString('en-CA', { timeZone: userTz, month: '2-digit' });
                                const date = currentDate.toLocaleDateString('en-CA', { timeZone: userTz, day: '2-digit' });
                                setBookingDate(`${year}-${month}-${date}`);
                                setBookingTime(`${String(hour).padStart(2, '0')}:00`);
                                setIsBookingOpen(true);
                              }
                            }}
                            className={clsx(
                              "relative h-[48px] transition-colors p-0.5 select-none",
                              isColToday ? "bg-primary/[0.05]" : "bg-transparent",
                              !cellSession && "hover:bg-primary-tint/20 cursor-pointer"
                            )}
                          >
                            {/* Current Time Line */}
                            {isColToday && isCurrentHourVisible && hour === currentHour && (
                              <div
                                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                                style={{ top: `${(currentMinute / 60) * 48}px` }}
                              >
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-xs -ml-1.5 shrink-0" />
                                <div className="h-[2px] w-full bg-red-500 shadow-xs" />
                              </div>
                            )}

                            {cellSession && renderSessionBlock(cellSession, hour)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {viewMode === 'month' && (
                <div data-testid="calendar-grid-month" className="w-full flex flex-col h-full bg-surface">
                  {/* Days of week header (Mon - Sun) */}
                  <div className="grid grid-cols-7 border-b border-border bg-surface-2/60 text-center py-2.5 text-xs font-bold text-muted select-none">
                    {DAYS_SHORT.map(d => (
                      <div key={d} className="truncate uppercase tracking-wider">{d}</div>
                    ))}
                  </div>

                  {/* 7-column month grid */}
                  <div className="grid grid-cols-7 auto-rows-fr divide-y divide-border/60 border-b border-border min-h-[460px]">
                    {monthGridDays.map((item, idx) => {
                      const isToday = isDateToday(item.date);
                      const daySessions = getSessionsForDay(item.date);
                      return (
                        <button
                          type="button"
                          key={idx}
                          data-testid="month-day-cell"
                          onClick={() => {
                            setCurrentDate(item.date);
                            setViewMode('day');
                          }}
                          className={clsx(
                            "relative p-1.5 sm:p-2 border-r border-border/60 text-left flex flex-col justify-between transition-colors min-h-[68px] sm:min-h-[76px] cursor-pointer hover:bg-primary-tint/20 group focus:outline-none focus:ring-1 focus:ring-primary inset-ring-0",
                            (idx + 1) % 7 === 0 && "border-r-0",
                            item.isCurrentMonth ? "bg-surface text-text" : "bg-surface-2/30 text-muted/50",
                            isToday && "bg-primary/[0.05]"
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span
                              className={clsx(
                                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                                isToday
                                  ? "bg-primary text-white shadow-xs font-black"
                                  : item.isCurrentMonth
                                  ? "text-text group-hover:text-primary"
                                  : "text-muted/60"
                              )}
                            >
                              {item.date.getDate()}
                            </span>
                            {daySessions.length > 0 && (
                              <span className="text-[10px] font-bold text-primary px-1 bg-primary/10 rounded-full">
                                {daySessions.length}
                              </span>
                            )}
                          </div>

                          {/* Dots / Session Indicators */}
                          <div className="mt-1 flex flex-wrap items-center gap-1 min-h-[14px]">
                            {daySessions.slice(0, 3).map((s: any, sIdx: number) => {
                              const isTeacher = s.teacherId === currentUser?.id;
                              const isLive = s.status === 'live';
                              return (
                                <span
                                  key={s.id || sIdx}
                                  className={clsx(
                                    "w-2 h-2 rounded-full shrink-0",
                                    isLive ? "bg-red-500 animate-pulse" : isTeacher ? "bg-amber-500" : "bg-emerald-500"
                                  )}
                                  title={`${s.title} (${isTeacher ? 'Teaching' : 'Learning'})`}
                                />
                              );
                            })}
                            {daySessions.length > 3 && (
                              <span className="text-[9px] font-bold text-muted">+{daySessions.length - 3}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {viewMode === 'week' && (
                <div data-testid="calendar-grid-week" className="min-w-[680px]">
                  {/* Sticky Day-Header Row */}
                  <div className="grid grid-cols-8 grid-cols-[64px_repeat(7,1fr)] sticky top-0 z-30 bg-surface border-b border-border shadow-xs">
                    {/* Top-left corner time column header */}
                    <div className="sticky left-0 z-40 bg-surface border-r border-border flex items-center justify-center p-2 text-xs font-semibold text-muted select-none">
                      {tzAbbr}
                    </div>
                    {DAYS_SHORT.map((day, idx) => {
                      const colDate = new Date(weekStart);
                      colDate.setDate(colDate.getDate() + idx);
                      const isColToday = isDateToday(colDate);
                      return (
                        <div
                          key={day}
                          className={clsx(
                            "py-2 px-1 text-center border-r border-border/80 last:border-r-0 transition-colors",
                            isColToday ? "bg-primary/[0.05]" : "bg-surface"
                          )}
                        >
                          <div className={clsx(
                            "text-xs uppercase tracking-wide",
                            isColToday ? "text-primary font-bold" : "text-muted font-semibold"
                          )}>
                            {day}
                          </div>
                          <div className={clsx(
                            "w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs sm:text-sm mt-0.5 transition-transform",
                            isColToday
                              ? "bg-primary text-white font-bold shadow-xs scale-105"
                              : "text-text font-bold"
                          )}>
                            {colDate.getDate()}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {weekLayout === 'agenda' ? (
                    /* Idea 2: Weekly Agenda Day Columns (Content-First) */
                    <div className="grid grid-cols-8 grid-cols-[64px_repeat(7,1fr)] divide-x divide-border/60 min-h-[460px] bg-surface">
                      {/* Left Rail / Timezone Info */}
                      <div className="p-2 bg-surface-2/20 flex flex-col items-center justify-between text-muted text-xs font-semibold py-4 select-none">
                        <div className="flex flex-col items-center gap-1 text-center">
                          <span className="material-symbols-outlined text-base text-primary">view_column</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider">{tzAbbr}</span>
                        </div>
                        <div className="text-[10px] text-muted/70 text-center leading-tight">
                          Agenda
                        </div>
                      </div>

                      {/* 7 Day Columns */}
                      {DAYS_SHORT.map((day, dayIdx) => {
                        const colDate = new Date(weekStart);
                        colDate.setDate(colDate.getDate() + dayIdx);
                        const isColToday = isDateToday(colDate);
                        const daySessions = getSessionsForDay(colDate).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

                        return (
                          <div
                            key={day}
                            className={clsx(
                              "p-2 flex flex-col justify-between transition-colors",
                              isColToday ? "bg-primary/[0.03]" : "bg-surface"
                            )}
                          >
                            <div className="space-y-2">
                              {/* Sessions list */}
                              {daySessions.map((s: any) => {
                                const isTeacher = s.teacherId === currentUser?.id;
                                const isLive = s.status === 'live';
                                const sessionTime = new Date(s.scheduledAt).toLocaleTimeString('en-US', {
                                  timeZone: userTz,
                                  hour: 'numeric',
                                  minute: '2-digit'
                                });

                                return (
                                  <div
                                    key={s.id}
                                    onClick={() => {
                                      if (s.status === 'confirmed' || s.status === 'live') {
                                        navigate(`/live/${s.id}`);
                                      } else {
                                        setSelectedSessionForNotes(s);
                                      }
                                    }}
                                    className={clsx(
                                      "p-2.5 rounded-lg border-l-4 shadow-xs cursor-pointer transition-all text-left group hover:shadow hover:scale-[1.01]",
                                      isLive
                                        ? "bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-100 border-l-red-600 animate-pulse"
                                        : isTeacher
                                        ? "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 border-l-amber-500 hover:bg-amber-100/60"
                                        : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 border-l-emerald-600 hover:bg-emerald-100/60"
                                    )}
                                  >
                                    <div className="flex items-center justify-between text-xs font-bold gap-1 mb-1">
                                      <span className="truncate">{sessionTime}</span>
                                      {isLive ? (
                                        <span className="px-1.5 py-0.2 text-[9px] font-black uppercase rounded-full bg-red-600 text-white shrink-0">
                                          LIVE
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-medium text-muted shrink-0">
                                          {s.durationMin || 60}m
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs font-bold truncate text-text group-hover:text-primary transition-colors">
                                      {s.title}
                                    </div>
                                    <div className="text-[11px] font-medium text-muted truncate mt-0.5 flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[12px] shrink-0">
                                        {isTeacher ? 'school' : 'menu_book'}
                                      </span>
                                      <span className="truncate">
                                        {isTeacher ? (s.student?.name || 'Student') : (s.teacher?.name || 'Mentor')}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Empty day placeholder */}
                              {daySessions.length === 0 && (
                                <div className="flex flex-col items-center justify-center p-3 text-center my-3 rounded-xl border border-dashed border-border/80 bg-surface-2/20">
                                  <span className="material-symbols-outlined text-lg text-muted/50 mb-1">event_available</span>
                                  <span className="text-xs text-muted font-medium">Free day</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const year = colDate.toLocaleDateString('en-CA', { timeZone: userTz, year: 'numeric' });
                                      const month = colDate.toLocaleDateString('en-CA', { timeZone: userTz, month: '2-digit' });
                                      const date = colDate.toLocaleDateString('en-CA', { timeZone: userTz, day: '2-digit' });
                                      setBookingDate(`${year}-${month}-${date}`);
                                      setBookingTime('10:00');
                                      setIsBookingOpen(true);
                                    }}
                                    className="mt-2 text-xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                                  >
                                    <span className="material-symbols-outlined text-sm">add</span>
                                    Book
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Add button when day has sessions */}
                            {daySessions.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const year = colDate.toLocaleDateString('en-CA', { timeZone: userTz, year: 'numeric' });
                                  const month = colDate.toLocaleDateString('en-CA', { timeZone: userTz, month: '2-digit' });
                                  const date = colDate.toLocaleDateString('en-CA', { timeZone: userTz, day: '2-digit' });
                                  setBookingDate(`${year}-${month}-${date}`);
                                  setBookingTime('14:00');
                                  setIsBookingOpen(true);
                                }}
                                className="w-full py-1 text-[11px] font-semibold text-muted hover:text-primary hover:bg-surface-2 rounded transition-colors flex items-center justify-center gap-1 cursor-pointer mt-2"
                              >
                                <span className="material-symbols-outlined text-[13px]">add</span>
                                Add
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Hourly Timeline Grid fallback */
                    <div className="relative divide-y divide-border/60 border-b border-border">
                      {HOURS.map(hour => (
                        <div key={hour} className="grid grid-cols-[64px_repeat(7,1fr)] h-[48px]">
                          {/* Sticky Time Column */}
                          <div className="sticky left-0 z-20 bg-surface border-r border-border/80 px-2 flex items-center justify-end text-xs font-medium text-muted select-none">
                            {formatHour(hour)}
                          </div>

                          {/* 7 Flat Day Cells with 1px hairline borders */}
                          {DAYS_SHORT.map((_, dayIdx) => {
                            const colDate = new Date(weekStart);
                            colDate.setDate(colDate.getDate() + dayIdx);
                            const isColToday = isDateToday(colDate);
                            const cellSession = getSessionForSlot(dayIdx, hour);

                            return (
                              <div
                                key={dayIdx}
                                onClick={() => {
                                  if (cellSession) {
                                    if (cellSession.status === 'confirmed' || cellSession.status === 'live') {
                                      navigate(`/live/${cellSession.id}`);
                                    } else {
                                      setSelectedSessionForNotes(cellSession);
                                    }
                                  } else {
                                    const year = colDate.toLocaleDateString('en-CA', { timeZone: userTz, year: 'numeric' });
                                    const month = colDate.toLocaleDateString('en-CA', { timeZone: userTz, month: '2-digit' });
                                    const date = colDate.toLocaleDateString('en-CA', { timeZone: userTz, day: '2-digit' });
                                    setBookingDate(`${year}-${month}-${date}`);
                                    setBookingTime(`${String(hour).padStart(2, '0')}:00`);
                                    setIsBookingOpen(true);
                                  }
                                }}
                                className={clsx(
                                  "relative h-[48px] border-r border-border/60 last:border-r-0 transition-colors p-0.5 select-none",
                                  isColToday ? "bg-primary/[0.05]" : "bg-transparent",
                                  !cellSession && "hover:bg-primary-tint/20 cursor-pointer"
                                )}
                              >
                                {/* Current Time Thin Red Line with Dot for Today */}
                                {isColToday && isCurrentHourVisible && hour === currentHour && (
                                  <div
                                    className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                                    style={{ top: `${(currentMinute / 60) * 48}px` }}
                                  >
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-xs -ml-1.5 shrink-0" />
                                    <div className="h-[2px] w-full bg-red-500 shadow-xs" />
                                  </div>
                                )}

                                {/* Session Event Block */}
                                {cellSession && renderSessionBlock(cellSession, hour)}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: Appointments Side Panel (~30% -> lg:col-span-4, equal height to calendar card) */}
          <div className="lg:col-span-4 flex flex-col h-[585px]">
            <div className="h-full bg-surface rounded-xl border border-border shadow-xs overflow-hidden flex flex-col">
              {/* Simple Underline Tabs: equal-width, 14px, weight 500, muted when inactive, primary green + 2px bottom border when active */}
              <div className="flex w-full border-b border-border/80 bg-surface shrink-0">
                {(['confirmed', 'pending', 'completed'] as const).map(tab => {
                  const count = tab === 'confirmed' ? confirmedCount : tab === 'pending' ? pendingCount : completedCount;
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={clsx(
                        "flex-1 py-2.5 text-sm font-medium text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 border-b-2",
                        isActive
                          ? "text-primary border-primary font-semibold"
                          : "text-muted hover:text-text border-transparent"
                      )}
                    >
                      <span className="capitalize">{tab}</span>
                      <span className={clsx(
                        "text-xs px-1.5 py-0.2 rounded-full font-medium transition-colors",
                        isActive ? "bg-primary-tint text-primary-text" : "bg-surface-2 text-muted"
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Scrollable Appointments List */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">
                {filteredSessions.length === 0 ? (
                  <div className="py-6 px-4 flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-[32px] text-muted/70 mb-2 select-none" aria-hidden="true">
                      {activeTab === 'confirmed' ? 'event_available' : activeTab === 'pending' ? 'hourglass_empty' : 'task_alt'}
                    </span>
                    <h4 className="text-sm font-semibold text-text mb-1">
                      {activeTab === 'confirmed' && 'No confirmed sessions'}
                      {activeTab === 'pending' && 'No pending requests'}
                      {activeTab === 'completed' && 'No completed sessions yet'}
                    </h4>
                    <p className="text-[13px] text-muted mb-4 max-w-xs">
                      {activeTab === 'confirmed' && "Sessions you've confirmed will appear here"}
                      {activeTab === 'pending' && "Sessions waiting for approval will appear here"}
                      {activeTab === 'completed' && "Past completed sessions will appear here"}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenBookingModal()}
                      className="text-xs font-semibold px-3 py-1.5 cursor-pointer"
                    >
                      Book a session
                    </Button>
                  </div>
                ) : (
                  filteredSessions.map((session, i) => {
                    const isTeacher = session.teacherId === currentUser?.id || session.teacher?.id === currentUser?.id;
                    const partner = isTeacher ? session.student : session.teacher;

                    const currentStudentEntry = Array.isArray(session.students)
                      ? session.students.find((st: any) => st.id === currentUser?.id || (st.name && currentUser?.name && st.name.toLowerCase() === currentUser.name.toLowerCase()))
                      : null;
                    const isPaidByMe = currentStudentEntry
                      ? currentStudentEntry.paymentStatus === 'paid'
                      : (session.studentId === currentUser?.id && session.paymentStatus === 'paid');

                    const paidStudentsList = Array.isArray(session.students)
                      ? session.students.filter((st: any) => st.paymentStatus === 'paid')
                      : (session.paymentStatus === 'paid' ? [session.student] : []);
                    const totalEnrolledCount = Array.isArray(session.students) ? session.students.length : (session.studentId ? 1 : 0);
                    const teacherRevenueReceived = paidStudentsList.reduce((sum: number, st: any) => sum + (Number(st.amountPaid) || Number(session.pricePerStudent) || Number(session.amount) || 499), 0);

                    const isSwap = Boolean(session.isSwap || (session.title && session.title.includes('↔')) || session.paymentStatus === 'swap');
                    const isProposer = session.proposerId ? session.proposerId === currentUser?.id : session.studentId === currentUser?.id;

                    return (
                      <div
                        key={session.id}
                        className={clsx(
                          "p-3.5 rounded-xl border-l-[3px] bg-surface shadow-xs hover:shadow-sm transition-all duration-150 border-y border-r border-border",
                          isSwap ? "border-l-primary" : (isTeacher ? "border-l-accent" : "border-l-primary")
                        )}
                      >
                        <div className="flex justify-between items-start mb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="relative">
                              <img
                                src={`https://i.pravatar.cc/150?img=${i + 15}`}
                                alt={partner?.name ? `${partner.name}'s profile avatar` : "Peer avatar"}
                                className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/20 shrink-0"
                              />
                              <span className="absolute bottom-0 right-0 w-2 h-2 bg-primary rounded-full ring-2 ring-surface" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-bold text-xs sm:text-sm text-text truncate">{partner?.name}</p>
                                {isSwap && (
                                  <span className="px-1.5 py-0.2 rounded bg-primary-tint text-primary-text border border-primary/20 text-xs font-bold uppercase tracking-wider">
                                    Swap
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted truncate">{partner?.email ? `${partner.email} • ` : ''}{isTeacher ? 'Student' : 'Mentor'}</p>
                              <p className="text-xs text-text font-medium truncate max-w-[180px]">{session.title}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5">
                              {(sessionNoteCounts[session.id] || 0) > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSessionForNotes(session);
                                  }}
                                  className="px-1.5 py-0.5 rounded-full bg-primary-tint text-primary-text text-xs font-bold border border-primary/20 flex items-center gap-0.5 hover:opacity-80 transition cursor-pointer"
                                  title={`${sessionNoteCounts[session.id]} notes`}
                                >
                                  <span className="material-symbols-outlined text-xs">description</span>
                                  <span>{sessionNoteCounts[session.id]}</span>
                                </button>
                              )}
                              <StatusBadge
                                status={session.status === 'confirmed' ? 'confirmed' : session.status === 'pending' ? 'pending' : session.status === 'live' ? 'live' : 'completed'}
                                label={session.status}
                                size="sm"
                              />
                            </div>
                            {isSwap ? (
                              <span className="text-xs font-bold text-primary-text bg-primary-tint border border-primary/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-xs">swap_horiz</span>
                                Skill Swap
                              </span>
                            ) : isTeacher ? (
                              paidStudentsList.length > 0 ? (
                                <span className="text-xs font-bold text-primary-text bg-primary-tint border border-primary/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-xs">verified</span>
                                  ₹{teacherRevenueReceived} ({paidStudentsList.length}/{Math.max(1, totalEnrolledCount)} Paid)
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-accent-text bg-accent-tint border border-accent/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-xs">schedule</span>
                                  Pending (0/{Math.max(1, totalEnrolledCount)})
                                </span>
                              )
                            ) : (
                              isPaidByMe ? (
                                <span className="text-xs font-bold text-primary-text bg-primary-tint border border-primary/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-xs">verified</span>
                                  Paid ₹{currentStudentEntry?.amountPaid || session.pricePerStudent || session.amount || 499}
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-accent-text bg-accent-tint border border-accent/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-xs">schedule</span>
                                  Pay: ₹{session.pricePerStudent || session.amount || 499}
                                </span>
                              )
                            )}
                          </div>
                        </div>

                        {/* Group Cohort Badge */}
                        {(session.maxCapacity || 1) > 1 && (
                          <div className="flex items-center justify-between bg-surface-2 border border-border p-2 rounded-lg text-xs mb-2.5">
                            <span className="font-semibold text-text flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm text-primary">groups</span>
                              Cohort ({Array.isArray(session.students) ? session.students.length : (session.studentId ? 1 : 0)}/{session.maxCapacity || 5})
                            </span>
                            <div className="flex -space-x-1.5 overflow-hidden">
                              {(session.students || []).map((st: any, sIdx: number) => (
                                <img
                                  key={st.id || sIdx}
                                  src={st.avatar || `https://i.pravatar.cc/150?img=${sIdx + 11}`}
                                  alt={st.name}
                                  title={`${st.name} (${st.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'})`}
                                  className={`inline-block h-5 w-5 rounded-full ring-1 ${st.paymentStatus === 'paid' ? 'ring-primary' : 'ring-accent'} object-cover`}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-xs font-medium text-muted mb-3">
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-muted">event</span>
                            {new Date(session.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-muted">schedule</span>
                            {new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {getCountdownBadge(session.scheduledAt)}
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
                          {/* Post-Lecture Payment Button for Students */}
                          {!isTeacher && !isPaidByMe && !isSwap && (
                            <button
                              onClick={() => handlePayForSession(session)}
                              className="w-full py-1.5 px-3 bg-primary hover:bg-primary-hover text-on-primary rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 mb-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[15px]">payments</span>
                              Pay ₹{session.pricePerStudent || session.amount || session.teacher?.hourlyRate || 499} to Mentor via UPI
                            </button>
                          )}

                          {(session.status === 'confirmed' || session.status === 'live') && (
                            <button
                              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer ${
                                isSessionLiveNow(session.scheduledAt)
                                  ? 'bg-primary hover:bg-primary-hover text-on-primary animate-pulse ring-2 ring-primary/30'
                                  : 'bg-primary hover:bg-primary-hover text-on-primary'
                              }`}
                              onClick={() => navigate(`/live/${session.id}`)}
                            >
                              <span className="material-symbols-outlined text-[15px]">videocam</span>
                              <span>{isSessionLiveNow(session.scheduledAt) ? '● Join Now' : 'Join Room'}</span>
                            </button>
                          )}

                          {session.status === 'pending' && (
                            isSwap ? (
                              isProposer ? (
                                <div className="flex-1 py-1 px-2.5 bg-accent-tint text-accent-text border border-accent/20 rounded-lg text-xs font-semibold flex items-center justify-center gap-1">
                                  <span className="material-symbols-outlined text-[15px] text-accent">hourglass_top</span>
                                  <span>Awaiting Response</span>
                                </div>
                              ) : (
                                <div className="flex-1 flex gap-1.5">
                                  <button
                                    onClick={() => handleApproveSession(session.id)}
                                    className="flex-1 py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                                    <span>Accept</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeclineSession(session.id)}
                                    className="py-1 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                                  >
                                    <span>Decline</span>
                                  </button>
                                </div>
                              )
                            ) : (
                              isTeacher ? (
                                <div className="flex-1 flex gap-1.5">
                                  <button
                                    onClick={() => handleApproveSession(session.id)}
                                    className="flex-1 py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                                    <span>Accept</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeclineSession(session.id)}
                                    className="py-1 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                                  >
                                    <span>Decline</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex-1 py-1 px-2.5 bg-accent-tint text-accent-text border border-accent/20 rounded-lg text-xs font-semibold flex items-center justify-center gap-1">
                                  <span className="material-symbols-outlined text-[15px] text-accent">hourglass_top</span>
                                  <span>Pending Mentor Approval</span>
                                </div>
                              )
                            )
                          )}

                          <button
                            onClick={() => setSelectedSessionForNotes(session)}
                            className="px-2 py-1 bg-surface-2 hover:bg-surface text-text border border-border rounded-lg text-xs font-semibold transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                            title="Notes"
                          >
                            <span className="material-symbols-outlined text-[15px] text-primary">edit_note</span>
                            <span>Notes</span>
                          </button>

                          <button
                            onClick={() => handleCopySessionLink(session.id)}
                            className="px-2 py-1 bg-primary-tint text-primary-text border border-primary/20 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                            title="Copy Link"
                          >
                            <span className="material-symbols-outlined text-[14px]">{copiedSessionId === session.id ? 'check' : 'content_copy'}</span>
                          </button>

                          {session.status === 'confirmed' && (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => window.open(getGoogleCalendarUrl(session), '_blank')}
                                className="px-2 py-1 bg-surface-2 hover:bg-surface text-text border border-border rounded-lg text-xs font-semibold transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                                title="Add to Google Calendar"
                              >
                                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                <span>GCal</span>
                              </button>
                              <button
                                onClick={() => handleDownloadIcs(session)}
                                className="px-1.5 py-1 bg-surface-2 hover:bg-surface text-text border border-border rounded-lg text-xs font-semibold transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                                title="Download .ics event"
                              >
                                <span className="material-symbols-outlined text-[14px]">download</span>
                              </button>
                            </div>
                          )}

                          {session.status === 'confirmed' && isTeacher && !isSwap && (
                            <Button variant="primary" size="sm" className="py-1 px-2.5 text-xs font-bold" onClick={() => handleCompleteSession(session.id)}>
                              Complete
                            </Button>
                          )}

                          {session.status !== 'pending' && session.status !== 'completed' && (
                            <Button variant="ghost" size="sm" className="py-1 px-2 font-medium text-xs text-muted hover:text-danger" onClick={() => handleDeleteSession(session.id)}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Booking Modal */}
      {isBookingOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-xl relative max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 pb-3 border-b border-border flex items-start justify-between shrink-0 bg-surface">
              <div>
                <h3 className="text-lg font-bold text-text">New Booking</h3>
                <p className="text-xs text-muted font-medium mt-0.5">
                  Choose 1-on-1 private lecture or group study cohort.
                </p>
              </div>
              <button
                onClick={() => { setIsBookingOpen(false); setConflictData(null); }}
                aria-label="Close new booking modal"
                className="text-muted hover:text-text hover:bg-surface-2 rounded-full p-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
              {bookingError && (
                <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-danger">error</span>
                  {bookingError}
                </div>
              )}

              {/* Nearest Slot Recommendation Banner */}
              {conflictData && (
                conflictData.noAvailability || !conflictData.nearestSlot ? (
                  <div className="bg-accent-tint border border-accent/20 rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-accent-text">
                      <span className="material-symbols-outlined text-accent text-base">event_busy</span>
                      <span>No Availability Set</span>
                    </div>
                    <p className="text-accent-text/90 font-medium">
                      This teacher hasn't set availability yet. Please reach out or check back later once their schedule is published.
                    </p>
                  </div>
                ) : (
                  <div className="bg-accent-tint border border-accent/20 rounded-xl p-3 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-accent-text">
                      <span className="material-symbols-outlined text-accent text-base">schedule</span>
                      <span>Requested Slot Booked! Nearest Slot Found:</span>
                    </div>
                    <p className="text-accent-text/90">
                      The nearest available time slot with <strong>{selectedPeer?.name || 'this mentor'}</strong> is:
                      <br />
                      <span className="font-bold text-accent-text text-sm">{conflictData.nearestSlotFormatted}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCreateBooking(conflictData.nearestSlot || undefined)}
                      className="w-full py-2 bg-accent hover:bg-accent/90 text-text font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow-xs active:scale-98 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">event_available</span>
                      <span>Book Nearest Slot ({conflictData.nearestSlotFormatted})</span>
                    </button>
                  </div>
                )
              )}

              <div>
                <label className="block text-xs font-bold text-text uppercase tracking-wider mb-1.5">Select Peer</label>
                <select
                  className="w-full rounded-xl border border-border bg-surface text-xs font-semibold text-text p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                  value={selectedPeerId}
                  onChange={(e) => {
                    const peerId = e.target.value;
                    setSelectedPeerId(peerId);
                    setConflictData(null);
                    setBookingError('');
                    setIsSlotAvailable(null);
                    const peerObj = peers.find(p => p.id === peerId);
                    const peerSkills = peerObj && Array.isArray(peerObj.userSkills)
                      ? peerObj.userSkills.filter((us: any) => us && us.type === 'teaches')
                      : (Array.isArray(peerObj?.skillsTaught) ? peerObj.skillsTaught.map((t: string) => ({ type: 'teaches', skill: { id: 's-' + t, name: t } })) : []);
                    if (peerSkills.length > 0) {
                      setSelectedSkillId(peerSkills[0].skill?.id || peerSkills[0].id);
                      setBookingTitle(peerSkills[0].skill?.name || peerSkills[0].name || '');
                    } else {
                      setSelectedSkillId('');
                    }
                  }}
                >
                  <option value="">-- Choose Peer --</option>
                  {peers
                    .filter(p => p.role === 'teacher' || p.role === 'both' || (Array.isArray(p.skillsTaught) && p.skillsTaught.length > 0) || (Array.isArray(p.userSkills) && p.userSkills.some((us: any) => us.type === 'teaches')))
                    .map(p => {
                      const hasUpi = Boolean(p.upiId || p.hasUpiConfigured);
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} {hasUpi ? `— ₹${p.hourlyRate || 499}/hr` : '(Payments Not Set Up)'}
                        </option>
                      );
                    })}
                </select>
                {selectedPeer && !selectedPeer.upiId && !selectedPeer.hasUpiConfigured && (
                  <div className="p-2.5 rounded-xl bg-accent-tint border border-accent/40 text-accent-text text-xs flex items-center gap-2 mt-2">
                    <span className="material-symbols-outlined text-base shrink-0">warning</span>
                    <span>This mentor has not set up payments yet. Booking is currently unavailable for this mentor.</span>
                  </div>
                )}
              </div>

              {/* Lecture Format & Capacity Choice */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-text uppercase tracking-wider">Lecture Format (Student Choice)</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { cap: 1, label: '1-on-1', icon: 'person' },
                    { cap: 2, label: 'Duo (2)', icon: 'group' },
                    { cap: 3, label: 'Trio (3)', icon: 'groups' },
                    { cap: 4, label: 'Quad (4)', icon: 'diversity_3' },
                    { cap: 5, label: 'Batch (5)', icon: 'school' }
                  ].map(item => {
                    const price = calculateSeatPrice(selectedPeer, item.cap);
                    const isSel = bookingCapacity === item.cap;
                    return (
                      <button
                        key={item.cap}
                        type="button"
                        onClick={() => setBookingCapacity(item.cap)}
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center cursor-pointer ${
                          isSel ? 'bg-primary-tint border-primary text-primary-text font-bold shadow-xs' : 'bg-surface-2 border-border text-muted hover:bg-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-base mb-0.5">{item.icon}</span>
                        <span className="text-xs font-bold">{item.label}</span>
                        <span className="text-xs font-extrabold mt-0.5 text-primary-text">₹{price}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="bg-primary-tint/50 border border-primary/20 text-primary-text p-2 rounded-xl text-xs flex items-center justify-between mt-1">
                  <span className="font-semibold">{getCapacityDetails(bookingCapacity).label}:</span>
                  <span className="text-primary-text font-bold">{getCapacityDetails(bookingCapacity).desc}</span>
                </div>
              </div>

              {selectedPeerId && (
                <div>
                  <label className="block text-xs font-bold text-text uppercase tracking-wider mb-1.5">Select Skill</label>
                  <select
                    className="w-full rounded-xl border border-border bg-surface text-xs font-semibold text-text p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                    value={selectedSkillId}
                    onChange={(e) => {
                      setSelectedSkillId(e.target.value);
                      const skillObj = selectedPeerSkills.find((us: any) => (us.skill?.id === e.target.value || us.id === e.target.value));
                      setBookingTitle(skillObj?.skill?.name || skillObj?.name || '');
                    }}
                  >
                    <option value="">-- Choose Skill --</option>
                    {selectedPeerSkills.map((us: any) => (
                      <option key={us.skill?.id || us.id} value={us.skill?.id || us.id}>{us.skill?.name || us.name || 'Skill'}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-text uppercase tracking-wider mb-1.5">Session Title</label>
                <input
                  type="text"
                  placeholder="e.g. Intro to React"
                  className="w-full rounded-xl border border-border bg-surface text-xs font-medium text-text p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  value={bookingTitle}
                  onChange={(e) => setBookingTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text uppercase tracking-wider mb-1.5">Date</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-border bg-surface text-xs font-semibold text-text p-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    value={bookingDate}
                    onChange={(e) => {
                      setBookingDate(e.target.value);
                      setConflictData(null);
                      setBookingError('');
                      setIsSlotAvailable(null);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Time</span>
                    <span className="text-xs font-semibold text-muted px-1.5 py-0.2 rounded bg-surface-2 border border-border">{tzAbbr}</span>
                  </label>
                  <input
                    type="time"
                    className="w-full rounded-xl border border-border bg-surface text-xs font-semibold text-text p-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    value={bookingTime}
                    onChange={(e) => {
                      setBookingTime(e.target.value);
                      setConflictData(null);
                      setBookingError('');
                      setIsSlotAvailable(null);
                    }}
                  />
                </div>
              </div>

              {/* Real-time slot availability status */}
              {isCheckingAvailability && (
                <div className="flex items-center gap-1.5 text-xs text-muted font-medium py-1">
                  <span className="animate-spin material-symbols-outlined text-sm text-primary">progress_activity</span>
                  <span>Checking availability...</span>
                </div>
              )}
              {!isCheckingAvailability && isSlotAvailable === true && !conflictData && (
                <div className="flex items-center gap-1.5 text-xs text-primary font-bold py-1">
                  <span className="material-symbols-outlined text-sm text-primary">check_circle</span>
                  <span>Time slot is available</span>
                </div>
              )}
            </div>

            {/* Modal Fixed Footer */}
            <div className="p-4 px-5 border-t border-border bg-surface-2 flex items-center justify-end gap-2.5 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setIsBookingOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleCreateBooking()}
                disabled={isCheckingAvailability || isSlotAvailable === false || Boolean(conflictData?.conflict) || Boolean(selectedPeer && !selectedPeer.upiId && !selectedPeer.hasUpiConfigured)}
              >
                {isCheckingAvailability ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                    <span>Checking...</span>
                  </>
                ) : (
                  <span>Book for ₹{calculateSeatPrice(selectedPeer, bookingCapacity)}</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Peer-to-Peer UPI Payment Modal */}
      <UpiPaymentModal
        isOpen={isUpiModalOpen}
        onClose={() => {
          setIsUpiModalOpen(false);
          setUpiModalSession(null);
        }}
        session={upiModalSession}
        onSuccess={() => {
          loadData();
        }}
      />

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
