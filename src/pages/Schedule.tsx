import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/Button';
import { useAppStore } from '../store/useAppStore';
import { api, onSessionsUpdated, onPeersUpdated, calculateSeatPrice, getCapacityDetails } from '../lib/api';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';

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

  const handleCopySessionLink = (sessionId: string) => {
    const link = `${window.location.origin}/live/${sessionId}`;
    navigator.clipboard.writeText(link);
    setCopiedSessionId(sessionId);
    setTimeout(() => setCopiedSessionId(null), 2500);
  };

  // Loaded week start
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
  });

  const loadData = useCallback(() => {
    Promise.all([api.getSessions(), api.getPeers()])
      .then(([sessionsData, peersData]) => {
        setSessions(sessionsData);
        setPeers(peersData);
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
      api.getSessions()
        .then(setSessions)
        .catch(console.error);
    }, 4000);
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

  // Filter by active status tab: past sessions are removed from Confirmed/Pending and listed under Completed
  const tabSessions = userSessions.filter(s => {
    const isPast = isPastSession(s);
    if (activeTab === 'confirmed') {
      return (s.status === 'confirmed' || s.status === 'live') && !isPast;
    }
    if (activeTab === 'pending') {
      return s.status === 'pending' && !isPast;
    }
    if (activeTab === 'completed') {
      return s.status === 'completed' || isPast;
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

  const loadRazorpaySDK = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayForSession = async (session: any) => {
    try {
      const sdkLoaded = await loadRazorpaySDK();
      if (!sdkLoaded) {
        alert('Could not load Razorpay checkout SDK.');
        return;
      }

      const amountToPay = session.pricePerStudent || session.amount || session.teacher?.hourlyRate || 499;
      const orderData = await api.createSessionPaymentOrder({
        sessionId: session.id,
        teacherId: session.teacherId,
        studentId: currentUser?.id || 'user-alex',
        amount: amountToPay,
        title: session.title || 'Mentoring Lecture'
      });

      const options = {
        key: orderData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TUrtuundUxD7Jh',
        amount: orderData.amountInPaise || (amountToPay * 100),
        currency: orderData.currency || 'INR',
        name: 'Mindroot Skill Exchange',
        description: `Mentoring Fee: ${session.title}`,
        image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            await api.verifySessionPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: amountToPay,
              sessionData: {
                sessionId: session.id,
                title: session.title,
                teacherId: session.teacherId,
                teacherName: session.teacher?.name,
                studentId: currentUser?.id || 'user-alex',
                studentName: currentUser?.name || 'Student',
                amount: amountToPay
              }
            });
            loadData();
          } catch (err: any) {
            console.error('Session payment verification error:', err);
            loadData();
          }
        },
        prefill: {
          name: currentUser?.name || 'Alex Student',
          email: currentUser?.email || 'alex@mindroot.edu',
          contact: '9999999999'
        },
        theme: {
          color: '#2563eb'
        }
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();
    } catch (err) {
      console.error('Failed to open payment modal:', err);
      alert('Payment initialization failed. Please try again.');
    }
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
  const [conflictData, setConflictData] = useState<{ nearestSlot: string; nearestSlotFormatted: string } | null>(null);

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

  const handleCreateBooking = async (overrideSlotISO?: string) => {
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
      const baseRate = selectedPeer?.hourlyRate || 499;
      const seatPrice = calculateSeatPrice(baseRate, bookingCapacity);

      await api.postSession({
        title: bookingTitle,
        teacherId: selectedPeerId,
        studentId: currentUser?.id || '',
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
    } catch (err: any) {
      if (err.conflict && err.nearestSlot) {
        setConflictData({
          nearestSlot: err.nearestSlot,
          nearestSlotFormatted: err.nearestSlotFormatted || new Date(err.nearestSlot).toLocaleString()
        });
        setBookingError(err.message || 'Requested time slot is already booked.');
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
          <h2 className="text-headline-lg font-headline-lg md:text-display text-on-surface">Schedule & Bookings</h2>
          <p className="text-body-md font-body-md text-on-surface-variant">Manage your availability and upcoming peer sessions.</p>
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
        <div className="bg-surface-container border border-outline-variant rounded-3xl p-5 sm:p-6 text-on-surface shadow-elevation-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-teaching-emerald animate-ping" />
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-primary">Live Joint Classroom Active</span>
                <h3 className="text-base sm:text-lg font-black text-on-surface">Join Your Cohort Batch Live Studio</h3>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant font-medium">All students & the instructor enter the exact same video room.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {activeGroupCohorts.map(cohort => {
              const enrolled = Array.isArray(cohort.students) ? cohort.students.length : 1;
              const cap = cohort.maxCapacity || 3;

              return (
                <div key={cohort.id} className="bg-surface border border-outline-variant rounded-2xl p-4 transition-all flex flex-col justify-between gap-3 shadow-elevation-1">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 bg-primary-container text-on-primary-container border border-primary/20 rounded-full text-[10px] font-bold uppercase">
                        {cap}-Student Batch
                      </span>
                      <span className="text-xs font-bold text-teaching-emerald flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-teaching-emerald animate-pulse" />
                        Room Active
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-on-surface mt-1.5">{cohort.title}</h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Teacher: <strong className="text-on-surface">{cohort.teacher?.name || 'Instructor'}</strong> · {enrolled}/{cap} Students Enrolled
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-outline-variant">
                    <Button
                      variant="primary"
                      onClick={() => navigate(`/live/${cohort.id}`)}
                      className="flex-1 py-2 text-xs font-black shadow-elevation-1 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">videocam</span>
                      <span>Join Live Room (All {cap} Students + Teacher)</span>
                    </Button>
                    <button
                      onClick={() => handleCopySessionLink(cohort.id)}
                      className="p-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl border border-outline-variant text-xs active:scale-95"
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
        <div className="text-center text-on-surface-variant py-16 animate-pulse text-sm font-bold">Loading schedule details...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Weekly Grid */}
          <div className="lg:col-span-8 flex flex-col p-0 overflow-hidden shadow-elevation-1 border border-outline-variant rounded-3xl bg-surface">
            <div className="p-4 sm:p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="font-extrabold text-base sm:text-lg text-on-surface">Weekly Availability</h3>
              <div className="flex items-center gap-1.5 sm:gap-2 bg-surface px-2.5 sm:px-3 py-1.5 rounded-xl border border-outline-variant shadow-elevation-1">
                <button onClick={handlePrevWeek} aria-label="Previous week" className="p-1 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined text-md">chevron_left</span>
                </button>
                <span className="text-[11px] sm:text-xs font-bold text-on-surface">{getWeekRangeString()}</span>
                <button onClick={handleNextWeek} aria-label="Next week" className="p-1 hover:bg-surface-container rounded-lg transition-colors text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined text-md">chevron_right</span>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 overflow-x-auto custom-scrollbar">
              <div className="min-w-[640px] sm:min-w-[700px]">
                {/* Header Row */}
                <div className="grid grid-cols-8 gap-2 mb-4 border-b border-outline-variant pb-3">
                  <div className="text-right pr-4 text-xs font-bold text-on-surface-variant pt-2">GMT</div>
                  {DAYS_SHORT.map((day, idx) => {
                    const date = new Date(weekStart);
                    date.setDate(date.getDate() + idx);
                    const isToday = new Date().toDateString() === date.toDateString();
                    return (
                      <div key={day} className="text-center">
                        <div className={clsx("text-xs uppercase tracking-wider font-extrabold", isToday ? "text-primary" : "text-on-surface-variant")}>{day}</div>
                        <div className={clsx("text-xs font-extrabold w-7 h-7 mx-auto flex items-center justify-center mt-1 rounded-full transition-transform hover:scale-105", isToday ? "bg-primary text-on-primary shadow-elevation-1" : "text-on-surface bg-surface-container")}>
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
                      <div className="text-right pr-4 text-xs font-bold text-on-surface-variant">{formatHour(hour)}</div>
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
                                "h-full rounded-xl p-2 overflow-hidden cursor-pointer select-none transition-all flex flex-col justify-between border-l-4 shadow-elevation-1 hover:-translate-y-0.5",
                                isTeacher 
                                  ? "bg-learning-amber-container border-l-learning-amber text-on-learning-amber-container hover:bg-learning-amber-container/80" 
                                  : "bg-primary-container border-l-primary text-on-primary-container hover:bg-primary-container/80",
                                cellSession.status === 'live' && "bg-alert-rose-container border-l-alert-rose animate-pulse text-on-alert-rose-container"
                              )}
                            >
                              <div className="text-xs truncate font-extrabold">{cellSession.title}</div>
                              <div className="text-[10px] opacity-80 font-bold truncate flex items-center gap-1">
                                <span className={clsx("w-1.5 h-1.5 rounded-full", isTeacher ? "bg-learning-amber" : "bg-primary")} />
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
                            className="h-full rounded-xl bg-surface-container border border-dashed border-outline-variant hover:border-primary/40 hover:bg-primary-container/30 cursor-pointer transition-all duration-200"
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-4 sm:px-6 py-4 border-t border-outline-variant flex flex-wrap gap-3 sm:gap-5 text-xs font-bold text-on-surface-variant bg-surface-container-low">
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-primary"></span> Learning Session</div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-learning-amber"></span> Teaching Session</div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-alert-rose animate-pulse"></span> Live Room</div>
            </div>
          </div>

          {/* Appointments Column */}
          <div className="lg:col-span-4 flex flex-col p-0 overflow-hidden shadow-elevation-1 border border-outline-variant rounded-2xl bg-surface h-auto lg:h-[620px] max-h-[620px]">
            <div className="p-4 sm:p-6 border-b border-outline-variant bg-surface-container-low shrink-0">
              <h3 className="font-extrabold text-base sm:text-lg text-on-surface mb-3 sm:mb-4">Appointments</h3>
              <div className="flex p-1 bg-surface-container rounded-xl gap-1 border border-outline-variant">
                {['confirmed', 'pending', 'completed'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      "flex-1 py-1.5 px-2 sm:px-3 rounded-lg text-xs font-extrabold text-center transition-all duration-200 capitalize",
                      activeTab === tab ? "bg-surface text-primary shadow-elevation-1" : "text-on-surface-variant hover:text-on-surface"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-container-low/50 custom-scrollbar">
              {filteredSessions.length === 0 ? (
                <div className="text-center text-on-surface-variant text-xs py-16 flex flex-col items-center justify-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-3xl">event_available</span>
                  </div>
                  <div>
                    <p className="font-bold text-on-surface text-sm">No {activeTab} sessions yet</p>
                    <p className="text-on-surface-variant text-xs mt-1">Find a match or book a new session!</p>
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

                  return (
                    <div 
                      key={session.id} 
                      className={clsx(
                        "p-4 rounded-2xl border-l-4 bg-surface shadow-elevation-1 hover:shadow-elevation-2 transition-all duration-200 group border-y border-r border-outline-variant",
                        isTeacher ? "border-l-learning-amber" : "border-l-primary"
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
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-teaching-emerald rounded-full ring-2 ring-surface" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-on-surface">{partner?.name}</p>
                            <p className="text-xs text-on-surface-variant font-medium truncate max-w-[130px]">{session.title}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={clsx(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            session.status === 'confirmed' && "bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20",
                            session.status === 'pending' && "bg-learning-amber-container text-on-learning-amber-container border border-learning-amber/20",
                            session.status === 'completed' && "bg-surface-container text-on-surface-variant border border-outline-variant"
                          )}>
                            {session.status}
                          </span>
                          {isTeacher ? (
                            paidStudentsList.length > 0 ? (
                              <span className="text-[10px] font-bold text-on-teaching-emerald-container bg-teaching-emerald-container border border-teaching-emerald/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px]">verified</span>
                                Received ₹{teacherRevenueReceived} ({paidStudentsList.length}/{Math.max(1, totalEnrolledCount)} Paid)
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-on-learning-amber-container bg-learning-amber-container border border-learning-amber/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px]">schedule</span>
                                Pending (0/{Math.max(1, totalEnrolledCount)} Paid)
                              </span>
                            )
                          ) : (
                            isPaidByMe ? (
                              <span className="text-[10px] font-bold text-on-primary-container bg-primary-container border border-primary/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px]">verified</span>
                                Paid ₹{currentStudentEntry?.amountPaid || session.pricePerStudent || session.amount || 499}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-on-learning-amber-container bg-learning-amber-container border border-learning-amber/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[11px]">schedule</span>
                                Pay After Class: ₹{session.pricePerStudent || session.amount || 499}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                      {/* Group Cohort Badge & Classmates Roster */}
                      {(session.maxCapacity || 1) > 1 && (
                        <div className="flex items-center justify-between bg-surface-container-low border border-outline-variant p-2 rounded-xl text-[11px] mb-3">
                          <span className="font-bold text-on-surface flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-teaching-emerald">groups</span>
                            Cohort ({Array.isArray(session.students) ? session.students.length : (session.studentId ? 1 : 0)}/{session.maxCapacity || 5} Students)
                          </span>
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {(session.students || []).map((st: any, sIdx: number) => (
                              <img
                                key={st.id || sIdx}
                                src={st.avatar || `https://i.pravatar.cc/150?img=${sIdx + 11}`}
                                alt={st.name}
                                title={`${st.name} (${st.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'})`}
                                className={`inline-block h-5 w-5 rounded-full ring-1 ${st.paymentStatus === 'paid' ? 'ring-teaching-emerald' : 'ring-learning-amber'} object-cover`}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs font-medium text-on-surface-variant mb-4">
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-outline">event</span>
                          {new Date(session.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-outline">schedule</span>
                          {new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1 border-t border-outline-variant">
                        {/* Post-Lecture Payment Button for Students */}
                        {!isTeacher && !isPaidByMe && (
                          <button 
                            onClick={() => handlePayForSession(session)}
                            className="w-full py-2 px-3 bg-teaching-emerald hover:bg-teaching-emerald-hover text-on-teaching-emerald rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-elevation-1 transition-all active:scale-95 mb-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">payments</span>
                            Pay ₹{session.pricePerStudent || session.amount || session.teacher?.hourlyRate || 499} to Mentor with Razorpay
                          </button>
                        )}
                        {(session.status === 'confirmed' || session.status === 'live') && (
                          <Button 
                            variant="primary" 
                            className="flex-1 py-1.5 text-xs font-extrabold flex items-center justify-center gap-1 shadow-elevation-1" 
                            onClick={() => navigate(`/live/${session.id}`)}
                          >
                            <span className="material-symbols-outlined text-[15px]">videocam</span>
                            <span>{(session.maxCapacity || 1) > 1 ? `Join Live Batch (${session.maxCapacity || 3} Students + Teacher)` : 'Join Live Room'}</span>
                          </Button>
                        )}
                        {session.status === 'pending' && !isTeacher && (
                          <div className="flex-1 py-1.5 px-3 bg-learning-amber-container text-on-learning-amber-container border border-learning-amber/20 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-learning-amber">hourglass_top</span>
                            <span>Waiting for Teacher Approval</span>
                          </div>
                        )}
                        <button
                          onClick={() => handleCopySessionLink(session.id)}
                          className="px-2.5 py-1.5 bg-primary-container text-on-primary-container border border-primary/20 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 active:scale-95 shadow-elevation-1"
                          title="Copy direct invite link for this session"
                        >
                          <span className="material-symbols-outlined text-[14px]">{copiedSessionId === session.id ? 'check' : 'content_copy'}</span>
                          <span>{copiedSessionId === session.id ? 'Copied!' : 'Copy Link'}</span>
                        </button>
                        {session.status === 'confirmed' && (
                          <button
                            onClick={() => api.downloadCalendarIcs(session.id)}
                            className="px-2.5 py-1.5 bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 active:scale-95 shadow-elevation-1"
                            title="Download .ics event file to add to Calendar"
                          >
                            <span className="material-symbols-outlined text-[14px]">calendar_add_on</span>
                            <span>Add to Calendar</span>
                          </button>
                        )}
                        {session.status === 'pending' && isTeacher && (
                          <Button 
                            variant="primary" 
                            className="py-1.5 px-3 text-xs font-bold flex items-center gap-1 shadow-elevation-1" 
                            onClick={() => handleApproveSession(session.id)}
                          >
                            <span className="material-symbols-outlined text-[15px]">check_circle</span>
                            <span>Accept & Confirm</span>
                          </Button>
                        )}
                        {session.status === 'confirmed' && isTeacher && (
                          <Button variant="mint" className="py-1.5 px-3 text-xs font-bold" onClick={() => handleCompleteSession(session.id)}>
                            Complete
                          </Button>
                        )}
                        {session.status === 'pending' && (
                          <Button variant="danger" className="py-1.5 px-3 text-xs font-bold" onClick={() => handleDeleteSession(session.id)}>
                            Decline
                          </Button>
                        )}
                        {session.status !== 'completed' && (
                          <Button variant="ghost" className="py-1.5 px-3 font-bold text-[11px] text-on-surface-variant hover:text-alert-rose" onClick={() => handleDeleteSession(session.id)}>
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
          <div className="bg-surface border border-outline-variant rounded-3xl w-full max-w-lg shadow-elevation-3 relative max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-outline-variant flex items-start justify-between shrink-0 bg-surface">
              <div>
                <h3 className="text-xl font-extrabold text-on-surface">New Booking</h3>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                  Choose 1-on-1 private lecture or group study cohort (Requires Teacher Approval).
                </p>
              </div>
              <button 
                onClick={() => { setIsBookingOpen(false); setConflictData(null); }}
                aria-label="Close new booking modal"
                className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full p-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
              {bookingError && (
                <div className="bg-alert-rose-container border border-alert-rose/20 text-on-alert-rose-container rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-alert-rose">error</span>
                  {bookingError}
                </div>
              )}

              {/* Nearest Slot Recommendation Banner */}
              {conflictData && (
                <div className="bg-learning-amber-container border border-learning-amber/20 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-on-learning-amber-container">
                    <span className="material-symbols-outlined text-learning-amber text-base">schedule</span>
                    <span>Requested Slot Booked! Nearest Slot Found:</span>
                  </div>
                  <p className="text-on-learning-amber-container/90">
                    The nearest available time slot with <strong>{selectedPeer?.name || 'this mentor'}</strong> is:
                    <br />
                    <span className="font-extrabold text-on-learning-amber-container text-sm">{conflictData.nearestSlotFormatted}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCreateBooking(conflictData.nearestSlot)}
                    className="w-full py-2 bg-learning-amber hover:bg-learning-amber-hover text-on-learning-amber font-black rounded-lg text-xs flex items-center justify-center gap-1 shadow-elevation-1 active:scale-98 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">event_available</span>
                    <span>Book Nearest Slot ({conflictData.nearestSlotFormatted})</span>
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-extrabold text-on-surface uppercase tracking-wider mb-2">Select Peer</label>
                <select 
                  className="w-full rounded-xl border border-outline-variant bg-surface text-xs font-bold text-on-surface p-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  value={selectedPeerId}
                  onChange={(e) => {
                    const peerId = e.target.value;
                    setSelectedPeerId(peerId);
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
                <label className="block text-xs font-extrabold text-on-surface uppercase tracking-wider">Lecture Format (Student Choice)</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { cap: 1, label: '1-on-1', icon: 'person' },
                    { cap: 2, label: 'Duo (2)', icon: 'group' },
                    { cap: 3, label: 'Trio (3)', icon: 'groups' },
                    { cap: 4, label: 'Quad (4)', icon: 'diversity_3' },
                    { cap: 5, label: 'Batch (5)', icon: 'school' }
                  ].map(item => {
                    const price = calculateSeatPrice(selectedPeer?.hourlyRate || 499, item.cap);
                    const isSel = bookingCapacity === item.cap;
                    return (
                      <button
                        key={item.cap}
                        type="button"
                        onClick={() => setBookingCapacity(item.cap)}
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center ${
                          isSel ? 'bg-primary-container border-primary text-on-primary-container font-bold shadow-elevation-1' : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg mb-0.5">{item.icon}</span>
                        <span className="text-[10px] font-bold">{item.label}</span>
                        <span className="text-[10px] font-extrabold mt-0.5 text-primary">₹{price}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="bg-primary-container/50 border border-primary/20 text-on-primary-container p-2.5 rounded-xl text-[11px] flex items-center justify-between mt-1">
                  <span className="font-semibold">{getCapacityDetails(bookingCapacity).label}:</span>
                  <span className="text-primary font-bold">{getCapacityDetails(bookingCapacity).desc}</span>
                </div>
              </div>

              {selectedPeerId && (
                <div>
                  <label className="block text-xs font-extrabold text-on-surface uppercase tracking-wider mb-2">Select Skill</label>
                  <select 
                    className="w-full rounded-xl border border-outline-variant bg-surface text-xs font-bold text-on-surface p-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
                <label className="block text-xs font-extrabold text-on-surface uppercase tracking-wider mb-2">Session Title</label>
                <input 
                  type="text"
                  placeholder="e.g. Intro to React"
                  className="w-full rounded-xl border border-outline-variant bg-surface text-xs font-medium text-on-surface p-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  value={bookingTitle}
                  onChange={(e) => setBookingTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-on-surface uppercase tracking-wider mb-2">Date</label>
                  <input 
                    type="date" 
                    className="w-full rounded-xl border border-outline-variant bg-surface text-xs font-bold text-on-surface p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-on-surface uppercase tracking-wider mb-2">Time</label>
                  <input 
                    type="time" 
                    className="w-full rounded-xl border border-outline-variant bg-surface text-xs font-bold text-on-surface p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Modal Fixed Footer */}
            <div className="p-4 px-6 border-t border-outline-variant bg-surface-container-low flex items-center justify-end gap-3 shrink-0 rounded-b-3xl">
              <Button variant="ghost" onClick={() => setIsBookingOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => handleCreateBooking()}>
                Book for ₹{calculateSeatPrice(selectedPeer?.hourlyRate || 499, bookingCapacity)}
              </Button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
