import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/Button';
import { useAppStore } from '../store/useAppStore';
import { api, onSessionsUpdated, onPeersUpdated, calculateSeatPrice, getCapacityDetails } from '../lib/api';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import { UpiPaymentModal, type UpiPaymentSession } from '../components/payment/UpiPaymentModal';
import { SessionNotesPanel } from '../components/notes/SessionNotesPanel';

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]; // 8 AM to 9 PM

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

export function Schedule() {
  const [activeTab, setActiveTab] = useState('confirmed');
  const [sessions, setSessions] = useState<any[]>([]);
  const [peers, setPeers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const { searchQuery, currentUser } = useAppStore();
  const navigate = useNavigate();

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
        <span className="px-2 py-0.5 rounded-full bg-primary-tint text-primary-text border border-primary/20 font-black text-[10px] animate-pulse flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          ● LIVE CLASSROOM READY
        </span>
      );
    }
    if (diffMin > 0 && diffMin <= 60) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-accent-tint text-accent-text border border-accent/20 font-bold text-[10px]">
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

  // Loaded week start
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
  });

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
      if (typeof window !== 'undefined' && localStorage.getItem('mindroot_auth_token')) {
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

  const handleNextWeek = () => {
    setWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7);
      return next;
    });
  };

  const handlePrevWeek = () => {
    setWeekStart(prev => {
      const prior = new Date(prev);
      prior.setDate(prior.getDate() - 7);
      return prior;
    });
  };

  // Get week range string
  const getWeekRangeString = () => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  // Filter sessions involving current user (teacher, student, or enrolled in cohort)
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

  // Filter by active status tab: past sessions are removed from Confirmed and listed under Completed. Pending stays in pending until resolved.
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

  // Filter by global search query
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

  // Check if a session lands on a given day/hour of the active week
  const getSessionForSlot = (dayIndex: number, hour: number) => {
    const slotDate = new Date(weekStart);
    slotDate.setDate(slotDate.getDate() + dayIndex);
    
    return userSessions.find(s => {
      if (s.status === 'completed' || isPastSession(s)) return false;
      const sDate = new Date(s.scheduledAt);
      const matchesSlot = (
        sDate.getFullYear() === slotDate.getFullYear() &&
        sDate.getMonth() === slotDate.getMonth() &&
        sDate.getDate() === slotDate.getDate() &&
        sDate.getHours() === hour
      );
      if (!matchesSlot) return false;
      if (searchQuery.trim() === '') return true;
      const query = searchQuery.toLowerCase();
      const titleMatch = s.title?.toLowerCase().includes(query);
      const peerName = s.teacherId === currentUser?.id ? s.student?.name : s.teacher?.name;
      const peerMatch = peerName?.toLowerCase().includes(query);
      return titleMatch || peerMatch;
    });
  };

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

  // Real-time pre-flight availability check on date/time/peer change
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
      if (err.conflict) {
        setIsSlotAvailable(false);
        setConflictData({
          nearestSlot: err.nearestSlot || null,
          nearestSlotFormatted: err.nearestSlotFormatted || (err.nearestSlot ? new Date(err.nearestSlot).toLocaleString() : null),
          noAvailability: Boolean(err.noAvailability || (!err.nearestSlot && err.hasAvailability === false)),
          message: err.message
        });
        const peerName = peers.find(p => p.id === selectedPeerId)?.name || 'this teacher';
        setBookingError(err.message || `This time slot is already booked for ${peerName}.`);
      } else if (err.message && (err.message.includes('Unauthorized') || err.message.includes('authentication token') || err.message.includes('token'))) {
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

  return (
    <div className="max-w-container_max mx-auto h-full flex flex-col space-y-6 pb-12 select-none">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-text">Schedule & Bookings</h2>
          <p className="text-sm font-medium text-muted">Manage your availability and upcoming peer sessions.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={loadData} className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">sync</span> Sync Calendar
          </Button>
          <Button variant="primary" onClick={() => handleOpenBookingModal()} className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">add</span> New Booking
          </Button>
        </div>
      </div>

      {/* Active Live Cohort Classes Banner (Zoom-like 1-Click Join) */}
      {activeGroupCohorts.length > 0 && (
        <div className="bg-surface-2 border border-border rounded-3xl p-5 sm:p-6 text-text shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-primary animate-ping" />
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-primary-text">Live Joint Classroom Active</span>
                <h3 className="text-base sm:text-lg font-black text-text">Join Your Cohort Batch Live Studio</h3>
              </div>
            </div>
            <p className="text-xs text-muted font-medium">All students & the instructor enter the exact same video room.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {activeGroupCohorts.map(cohort => {
              const enrolled = Array.isArray(cohort.students) ? cohort.students.length : 1;
              const cap = cohort.maxCapacity || 3;

              return (
                <div key={cohort.id} className="bg-surface border border-border rounded-2xl p-4 transition-all flex flex-col justify-between gap-3 shadow-sm">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 bg-primary-tint text-primary-text border border-primary/20 rounded-full text-[10px] font-bold uppercase">
                        {cap}-Student Batch
                      </span>
                      <span className="text-xs font-bold text-primary-text flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Room Active
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-text mt-1.5">{cohort.title}</h4>
                    <p className="text-xs text-muted mt-0.5">
                      Teacher: <strong className="text-text">{cohort.teacher?.name || 'Instructor'}</strong> · {enrolled}/{cap} Students Enrolled
                    </p>
                  </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button
                      variant="primary"
                      onClick={() => navigate(`/live/${cohort.id}`)}
                      className="flex-1 py-2 text-xs font-black shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">videocam</span>
                      <span>Join Live Room (All {cap} Students + Teacher)</span>
                    </Button>
                    <button
                      onClick={() => setSelectedSessionForNotes(cohort)}
                      className="p-2 bg-surface-2 hover:bg-surface text-text rounded-xl border border-border text-xs active:scale-95 flex items-center gap-1 cursor-pointer"
                      title="Cohort Notes"
                    >
                      <span className="material-symbols-outlined text-[16px] text-primary">edit_note</span>
                      {(sessionNoteCounts[cohort.id] || 0) > 0 && (
                        <span className="px-1 rounded-full bg-primary-tint text-primary-text text-[9px] font-black">
                          {sessionNoteCounts[cohort.id]}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => handleCopySessionLink(cohort.id)}
                      className="p-2 bg-surface-2 hover:bg-surface text-text rounded-xl border border-border text-xs active:scale-95 cursor-pointer"
                      title="Copy Direct Link"
                    >
                      <span className="material-symbols-outlined text-[16px]">{copiedSessionId === cohort.id ? 'check' : 'content_copy'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted py-16 animate-pulse text-sm font-bold">Loading schedule details...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Weekly Grid */}
          <div className="lg:col-span-8 flex flex-col p-0 overflow-hidden shadow-sm border border-border rounded-3xl bg-surface">
            <div className="p-4 sm:p-6 border-b border-border flex justify-between items-center bg-surface-2">
              <h3 className="font-extrabold text-base sm:text-lg text-text">Weekly Availability</h3>
              <div className="flex items-center gap-1.5 sm:gap-2 bg-surface px-2.5 sm:px-3 py-1.5 rounded-xl border border-border shadow-sm">
                <button onClick={handlePrevWeek} aria-label="Previous week" className="p-1 hover:bg-surface-2 rounded-lg transition-colors text-muted hover:text-text">
                  <span className="material-symbols-outlined text-md">chevron_left</span>
                </button>
                <span className="text-[11px] sm:text-xs font-bold text-text">{getWeekRangeString()}</span>
                <button onClick={handleNextWeek} aria-label="Next week" className="p-1 hover:bg-surface-2 rounded-lg transition-colors text-muted hover:text-text">
                  <span className="material-symbols-outlined text-md">chevron_right</span>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 overflow-x-auto custom-scrollbar">
              <div className="min-w-[640px] sm:min-w-[700px]">
                {/* Header Row */}
                <div className="grid grid-cols-8 gap-2 mb-4 border-b border-border pb-3">
                  <div className="text-right pr-4 text-xs font-bold text-muted pt-2">GMT</div>
                  {DAYS_SHORT.map((day, idx) => {
                    const date = new Date(weekStart);
                    date.setDate(date.getDate() + idx);
                    const isToday = new Date().toDateString() === date.toDateString();
                    return (
                      <div key={day} className="text-center">
                        <div className={clsx("text-xs uppercase tracking-wider font-extrabold", isToday ? "text-primary-text" : "text-muted")}>{day}</div>
                        <div className={clsx("text-xs font-extrabold w-7 h-7 mx-auto flex items-center justify-center mt-1 rounded-full transition-transform hover:scale-105", isToday ? "bg-primary text-on-primary shadow-sm" : "text-text bg-surface-2")}>
                          {date.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Grid Slots */}
                <div className="space-y-2">
                  {HOURS.map(hour => (
                    <div key={hour} className="grid grid-cols-8 gap-2 h-14 items-center">
                      <div className="text-right pr-4 text-xs font-bold text-muted">{formatHour(hour)}</div>
                      {DAYS_SHORT.map((_, dayIdx) => {
                        const cellSession = getSessionForSlot(dayIdx, hour);
                        if (cellSession) {
                          const isTeacher = cellSession.teacherId === currentUser?.id;
                          return (
                            <div 
                              key={dayIdx} 
                              onClick={() => {
                                if (cellSession.status === 'confirmed' || cellSession.status === 'live') {
                                  navigate(`/live/${cellSession.id}`);
                                }
                              }}
                              className={clsx(
                                "h-full rounded-xl p-2 overflow-hidden cursor-pointer select-none transition-all flex flex-col justify-between border-l-4 shadow-sm hover:-translate-y-0.5",
                                isTeacher 
                                  ? "bg-accent-tint border-l-accent text-accent-text hover:bg-accent-tint/80" 
                                  : "bg-primary-tint border-l-primary text-primary-text hover:bg-primary-tint/80",
                                cellSession.status === 'live' && "bg-danger/10 border-l-danger animate-pulse text-danger"
                              )}
                            >
                              <div className="text-xs truncate font-extrabold">{cellSession.title}</div>
                              <div className="text-[10px] opacity-90 font-bold truncate flex items-center gap-1">
                                <span className={clsx("w-1.5 h-1.5 rounded-full", isTeacher ? "bg-accent" : "bg-primary")} />
                                {isTeacher ? `Teaching ${cellSession.student?.name}` : `Learning from ${cellSession.teacher?.name}`}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div 
                            key={dayIdx} 
                            onClick={() => {
                              const cellDate = new Date(weekStart);
                              cellDate.setDate(cellDate.getDate() + dayIdx);
                              const year = cellDate.getFullYear();
                              const month = String(cellDate.getMonth() + 1).padStart(2, '0');
                              const date = String(cellDate.getDate()).padStart(2, '0');
                              setBookingDate(`${year}-${month}-${date}`);
                              setBookingTime(`${String(hour).padStart(2, '0')}:00`);
                              setIsBookingOpen(true);
                            }}
                            className="h-full rounded-xl bg-surface-2 border border-dashed border-border hover:border-primary/40 hover:bg-primary-tint/30 cursor-pointer transition-all duration-200"
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-4 sm:px-6 py-4 border-t border-border flex flex-wrap gap-3 sm:gap-5 text-xs font-bold text-muted bg-surface-2">
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-primary"></span> Learning Session</div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-accent"></span> Teaching Session</div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse"></span> Live Room</div>
            </div>
          </div>

          {/* Appointments Column */}
          <div className="lg:col-span-4 flex flex-col p-0 overflow-hidden shadow-sm border border-border rounded-2xl bg-surface h-auto lg:h-[620px] max-h-[620px]">
            <div className="p-4 sm:p-6 border-b border-border bg-surface-2 shrink-0">
              <h3 className="font-extrabold text-base sm:text-lg text-text mb-3 sm:mb-4">Appointments</h3>
              <div className="flex p-1 bg-surface-2 rounded-xl gap-1 border border-border">
                {['confirmed', 'pending', 'completed'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      "flex-1 py-1.5 px-2 sm:px-3 rounded-lg text-xs font-extrabold text-center transition-all duration-200 capitalize",
                      activeTab === tab ? "bg-surface text-primary-text shadow-sm" : "text-muted hover:text-text"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-2/40 custom-scrollbar">
              {filteredSessions.length === 0 ? (
                <div className="text-center text-muted text-xs py-16 flex flex-col items-center justify-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-primary-tint text-primary-text border border-primary/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">event_available</span>
                  </div>
                  <div>
                    <p className="font-bold text-text text-sm">No {activeTab} sessions yet</p>
                    <p className="text-muted text-xs mt-1">Find a match or book a new session!</p>
                  </div>
                  <Button variant="primary" className="py-2 text-xs" onClick={() => setIsBookingOpen(true)}>
                    + Schedule Session
                  </Button>
                </div>
              ) : (
                filteredSessions.map((session, i) => {
                  const isTeacher = session.teacherId === currentUser?.id || session.teacher?.id === currentUser?.id;
                  const partner = isTeacher ? session.student : session.teacher;

                  // Student-specific payment state in cohorts
                  const currentStudentEntry = Array.isArray(session.students) 
                    ? session.students.find((st: any) => st.id === currentUser?.id || (st.name && currentUser?.name && st.name.toLowerCase() === currentUser.name.toLowerCase()))
                    : null;
                  const isPaidByMe = currentStudentEntry 
                    ? currentStudentEntry.paymentStatus === 'paid' 
                    : (session.studentId === currentUser?.id && session.paymentStatus === 'paid');

                  // Teacher-specific cohort revenue calculations
                  const paidStudentsList = Array.isArray(session.students) 
                    ? session.students.filter((st: any) => st.paymentStatus === 'paid') 
                    : (session.paymentStatus === 'paid' ? [session.student] : []);
                  const totalEnrolledCount = Array.isArray(session.students) ? session.students.length : (session.studentId ? 1 : 0);
                  const teacherRevenueReceived = paidStudentsList.reduce((sum: number, st: any) => sum + (Number(st.amountPaid) || Number(session.pricePerStudent) || Number(session.amount) || 499), 0);

                  const isSwap = Boolean(session.isSwap || (session.title && session.title.includes('↔')) || session.paymentStatus === 'swap');
                  const isProposer = session.proposerId ? session.proposerId === currentUser?.id : session.studentId === currentUser?.id;
                  const isRecipient = isSwap ? !isProposer : isTeacher;

                  return (
                    <div 
                      key={session.id} 
                      className={clsx(
                        "p-4 rounded-2xl border-l-4 bg-surface shadow-sm hover:shadow-md transition-all duration-200 group border-y border-r border-border",
                        isSwap ? "border-l-primary" : (isTeacher ? "border-l-accent" : "border-l-primary")
                      )}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img 
                              src={`https://i.pravatar.cc/150?img=${i + 15}`} 
                              alt={partner?.name ? `${partner.name}'s profile avatar` : "Peer avatar"} 
                              className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20" 
                            />
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary rounded-full ring-2 ring-surface" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-sm text-text">{partner?.name}</p>
                              {isSwap && (
                                <span className="px-1.5 py-0.2 rounded bg-primary-tint text-primary-text border border-primary/20 text-[9px] font-black uppercase tracking-wider">
                                  Swap
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted truncate max-w-[200px]">{partner?.email ? `${partner.email} • ` : ''}{isTeacher ? 'Student' : 'Mentor'}</p>
                            <p className="text-xs text-text font-medium truncate max-w-[200px]">{session.title}</p>
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
                                className="px-1.5 py-0.5 rounded-full bg-primary-tint text-primary-text text-[10px] font-bold border border-primary/20 flex items-center gap-0.5 hover:opacity-80 transition cursor-pointer"
                                title={`${sessionNoteCounts[session.id]} session note${sessionNoteCounts[session.id] !== 1 ? 's' : ''}`}
                              >
                                <span className="material-symbols-outlined text-[11px]">description</span>
                                <span>{sessionNoteCounts[session.id]}</span>
                              </button>
                            )}
                            <span className={clsx(
                              "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              session.status === 'confirmed' && "bg-primary-tint text-primary-text border border-primary/20",
                              session.status === 'pending' && "bg-accent-tint text-accent-text border border-accent/20",
                              session.status === 'completed' && "bg-surface-2 text-muted border border-border"
                            )}>
                              {session.status}
                            </span>
                          </div>
                          {isSwap ? (
                            <span className="text-[10px] font-bold text-primary-text bg-primary-tint border border-primary/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[11px]">swap_horiz</span>
                              Skill Swap (Free)
                            </span>
                          ) : isTeacher ? (
                            paidStudentsList.length > 0 ? (
                              <span className="text-[10px] font-bold text-primary-text bg-primary-tint border border-primary/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px]">verified</span>
                                Received ₹{teacherRevenueReceived} ({paidStudentsList.length}/{Math.max(1, totalEnrolledCount)} Paid)
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-accent-text bg-accent-tint border border-accent/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px]">schedule</span>
                                Pending (0/{Math.max(1, totalEnrolledCount)} Paid)
                              </span>
                            )
                          ) : (
                            isPaidByMe ? (
                              <span className="text-[10px] font-bold text-primary-text bg-primary-tint border border-primary/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px]">verified</span>
                                Paid ₹{currentStudentEntry?.amountPaid || session.pricePerStudent || session.amount || 499}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-accent-text bg-accent-tint border border-accent/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px]">schedule</span>
                                Pay After Class: ₹{session.pricePerStudent || session.amount || 499}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                      {/* Group Cohort Badge & Classmates Roster */}
                      {(session.maxCapacity || 1) > 1 && (
                        <div className="flex items-center justify-between bg-surface-2 border border-border p-2 rounded-xl text-[11px] mb-3">
                          <span className="font-bold text-text flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-primary-text">groups</span>
                            Cohort ({Array.isArray(session.students) ? session.students.length : (session.studentId ? 1 : 0)}/{session.maxCapacity || 5} Students)
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

                      <div className="flex items-center gap-4 text-xs font-medium text-muted mb-4">
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
                      <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                        {/* Post-Lecture Payment Button for Students (Regular mentoring only) */}
                        {!isTeacher && !isPaidByMe && !isSwap && (
                          <button 
                            onClick={() => handlePayForSession(session)}
                            className="w-full py-2 px-3 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 mb-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">payments</span>
                            Pay ₹{session.pricePerStudent || session.amount || session.teacher?.hourlyRate || 499} to Mentor via UPI / Direct
                          </button>
                        )}
                        {(session.status === 'confirmed' || session.status === 'live') && (
                          <button 
                            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                              isSessionLiveNow(session.scheduledAt)
                                ? 'bg-primary hover:bg-primary-hover text-on-primary animate-pulse ring-2 ring-primary/30'
                                : 'bg-primary hover:bg-primary-hover text-on-primary'
                            }`}
                            onClick={() => navigate(`/live/${session.id}`)}
                          >
                            <span className="material-symbols-outlined text-[15px]">videocam</span>
                            <span>
                              {isSessionLiveNow(session.scheduledAt)
                                ? '● Join Live Classroom'
                                : (session.maxCapacity || 1) > 1 
                                  ? `Join Live Batch (${session.maxCapacity || 3} Students + Teacher)` 
                                  : 'Join Live Room'}
                            </span>
                          </button>
                        )}
                        {session.status === 'pending' && (
                          isSwap ? (
                            isProposer ? (
                              <div className="flex-1 py-1.5 px-3 bg-accent-tint text-accent-text border border-accent/20 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5">
                                <span className="material-symbols-outlined text-[16px] text-accent">hourglass_top</span>
                                <span>Awaiting Peer Response</span>
                              </div>
                            ) : (
                              <div className="flex-1 flex gap-2">
                                <button
                                  onClick={() => handleApproveSession(session.id)}
                                  className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                                  <span>Accept Swap</span>
                                </button>
                                <button
                                  onClick={() => handleDeclineSession(session.id)}
                                  className="py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                >
                                  <span>Decline</span>
                                </button>
                              </div>
                            )
                          ) : (
                            isTeacher ? (
                              <div className="flex-1 flex gap-2">
                                <button
                                  onClick={() => handleApproveSession(session.id)}
                                  className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                                  <span>Accept Request</span>
                                </button>
                                <button
                                  onClick={() => handleDeclineSession(session.id)}
                                  className="py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                >
                                  <span>Decline</span>
                                </button>
                              </div>
                            ) : (
                              <div className="flex-1 py-1.5 px-3 bg-accent-tint text-accent-text border border-accent/20 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5">
                                <span className="material-symbols-outlined text-[16px] text-accent">hourglass_top</span>
                                <span>Waiting for Teacher Approval</span>
                              </div>
                            )
                          )
                        )}
                        <button
                          onClick={() => setSelectedSessionForNotes(session)}
                          className="px-2.5 py-1.5 bg-surface-2 hover:bg-surface text-text border border-border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-xs cursor-pointer"
                          title="View or add session notes"
                        >
                          <span className="material-symbols-outlined text-[15px] text-primary">edit_note</span>
                          <span>Notes</span>
                          {(sessionNoteCounts[session.id] || 0) > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-primary-tint text-primary-text font-black text-[10px] border border-primary/20">
                              {sessionNoteCounts[session.id]}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => handleCopySessionLink(session.id)}
                          className="px-2.5 py-1.5 bg-primary-tint text-primary-text border border-primary/20 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 active:scale-95 shadow-sm cursor-pointer"
                          title="Copy direct invite link for this session"
                        >
                          <span className="material-symbols-outlined text-[14px]">{copiedSessionId === session.id ? 'check' : 'content_copy'}</span>
                          <span>{copiedSessionId === session.id ? 'Copied!' : 'Copy Link'}</span>
                        </button>
                        {session.status === 'confirmed' && (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => window.open(getGoogleCalendarUrl(session), '_blank')}
                              className="px-2.5 py-1.5 bg-primary-tint hover:bg-primary-tint/80 text-primary-text border border-primary/20 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 active:scale-95 shadow-xs"
                              title="Add to Google Calendar"
                            >
                              <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                              <span>Google Cal</span>
                            </button>
                            <button
                              onClick={() => handleDownloadIcs(session)}
                              className="px-2 py-1.5 bg-surface-2 hover:bg-surface text-text border border-border rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95"
                              title="Download .ics event file for Apple / Outlook Calendar"
                            >
                              <span className="material-symbols-outlined text-[14px]">download</span>
                              <span>.ics</span>
                            </button>
                          </div>
                        )}
                        {session.status === 'pending' && (
                          isSwap ? (
                            isRecipient ? (
                              <>
                                <Button 
                                  variant="primary" 
                                  className="py-1.5 px-3 text-xs font-bold flex items-center gap-1 shadow-sm" 
                                  onClick={() => handleApproveSession(session.id)}
                                >
                                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                                  <span>Accept Swap</span>
                                </Button>
                                <Button 
                                  variant="danger" 
                                  className="py-1.5 px-3 text-xs font-bold" 
                                  onClick={() => handleDeclineSession(session.id)}
                                >
                                  Decline
                                </Button>
                              </>
                            ) : (
                              <Button 
                                variant="ghost" 
                                className="py-1.5 px-3 font-bold text-[11px] text-muted hover:text-danger" 
                                onClick={() => handleDeleteSession(session.id)}
                              >
                                Cancel Request
                              </Button>
                            )
                          ) : (
                            isTeacher ? (
                              <>
                                <Button 
                                  variant="primary" 
                                  className="py-1.5 px-3 text-xs font-bold flex items-center gap-1 shadow-sm" 
                                  onClick={() => handleApproveSession(session.id)}
                                >
                                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                                  <span>Accept & Confirm</span>
                                </Button>
                                <Button 
                                  variant="danger" 
                                  className="py-1.5 px-3 text-xs font-bold" 
                                  onClick={() => handleDeclineSession(session.id)}
                                >
                                  Decline
                                </Button>
                              </>
                            ) : null
                          )
                        )}
                        {session.status === 'confirmed' && isTeacher && !isSwap && (
                          <Button variant="primary" className="py-1.5 px-3 text-xs font-bold" onClick={() => handleCompleteSession(session.id)}>
                            Complete
                          </Button>
                        )}
                        {session.status !== 'pending' && session.status !== 'completed' && (
                          <Button variant="ghost" className="py-1.5 px-3 font-bold text-[11px] text-muted hover:text-danger" onClick={() => handleDeleteSession(session.id)}>
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
      )}

      {/* New Booking Modal */}
      {isBookingOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-lg shadow-lg relative max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-border flex items-start justify-between shrink-0 bg-surface">
              <div>
                <h3 className="text-xl font-extrabold text-text">New Booking</h3>
                <p className="text-xs text-muted font-medium mt-0.5">
                  Choose 1-on-1 private lecture or group study cohort (Requires Teacher Approval).
                </p>
              </div>
              <button 
                onClick={() => { setIsBookingOpen(false); setConflictData(null); }}
                aria-label="Close new booking modal"
                className="text-muted hover:text-text hover:bg-surface-2 rounded-full p-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
              {bookingError && (
                <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-danger">error</span>
                  {bookingError}
                </div>
              )}

              {/* Nearest Slot Recommendation Banner */}
              {conflictData && (
                conflictData.noAvailability || !conflictData.nearestSlot ? (
                  <div className="bg-accent-tint border border-accent/20 rounded-xl p-3.5 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-accent-text">
                      <span className="material-symbols-outlined text-accent text-base">event_busy</span>
                      <span>No Availability Set</span>
                    </div>
                    <p className="text-accent-text/90 font-medium">
                      This teacher hasn't set availability yet. Please reach out or check back later once their schedule is published.
                    </p>
                  </div>
                ) : (
                  <div className="bg-accent-tint border border-accent/20 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-accent-text">
                      <span className="material-symbols-outlined text-accent text-base">schedule</span>
                      <span>Requested Slot Booked! Nearest Slot Found:</span>
                    </div>
                    <p className="text-accent-text/90">
                      The nearest available time slot with <strong>{selectedPeer?.name || 'this mentor'}</strong> is:
                      <br />
                      <span className="font-extrabold text-accent-text text-sm">{conflictData.nearestSlotFormatted}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCreateBooking(conflictData.nearestSlot || undefined)}
                      className="w-full py-2 bg-accent hover:bg-accent/90 text-text font-black rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm active:scale-98 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">event_available</span>
                      <span>Book Nearest Slot ({conflictData.nearestSlotFormatted})</span>
                    </button>
                  </div>
                )
              )}

              <div>
                <label className="block text-xs font-extrabold text-text uppercase tracking-wider mb-2">Select Peer</label>
                <select 
                  className="w-full rounded-xl border border-border bg-surface text-xs font-bold text-text p-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name} — ₹{p.hourlyRate || 499}/hr</option>
                    ))}
                </select>
              </div>

              {/* Lecture Format & Capacity Choice */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-text uppercase tracking-wider">Lecture Format (Student Choice)</label>
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
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center ${
                          isSel ? 'bg-primary-tint border-primary text-primary-text font-bold shadow-sm' : 'bg-surface-2 border-border text-muted hover:bg-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg mb-0.5">{item.icon}</span>
                        <span className="text-[10px] font-bold">{item.label}</span>
                        <span className="text-[10px] font-extrabold mt-0.5 text-primary-text">₹{price}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="bg-primary-tint/50 border border-primary/20 text-primary-text p-2.5 rounded-xl text-[11px] flex items-center justify-between mt-1">
                  <span className="font-semibold">{getCapacityDetails(bookingCapacity).label}:</span>
                  <span className="text-primary-text font-bold">{getCapacityDetails(bookingCapacity).desc}</span>
                </div>
              </div>

              {selectedPeerId && (
                <div>
                  <label className="block text-xs font-extrabold text-text uppercase tracking-wider mb-2">Select Skill</label>
                  <select 
                    className="w-full rounded-xl border border-border bg-surface text-xs font-bold text-text p-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
                <label className="block text-xs font-extrabold text-text uppercase tracking-wider mb-2">Session Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Intro to React"
                  className="w-full rounded-xl border border-border bg-surface text-xs font-medium text-text p-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  value={bookingTitle}
                  onChange={(e) => setBookingTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-text uppercase tracking-wider mb-2">Date</label>
                  <input 
                    type="date" 
                    className="w-full rounded-xl border border-border bg-surface text-xs font-bold text-text p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
                  <label className="block text-xs font-extrabold text-text uppercase tracking-wider mb-2">Time</label>
                  <input 
                    type="time" 
                    className="w-full rounded-xl border border-border bg-surface text-xs font-bold text-text p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
            <div className="p-4 px-6 border-t border-border bg-surface-2 flex items-center justify-end gap-3 shrink-0 rounded-b-3xl">
              <Button variant="ghost" onClick={() => setIsBookingOpen(false)}>Cancel</Button>
              <Button 
                variant="primary" 
                onClick={() => handleCreateBooking()}
                disabled={isCheckingAvailability || isSlotAvailable === false || Boolean(conflictData?.conflict)}
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
