import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HOURS = ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '03:00 PM'];

const defaultSlots: Record<string, boolean> = {
  'Mon-09:00 AM': false, 'Mon-10:00 AM': true, 'Mon-11:00 AM': false,
  'Tue-09:00 AM': true, 'Tue-10:00 AM': false, 'Tue-11:00 AM': true,
  'Wed-09:00 AM': false, 'Wed-10:00 AM': false, 'Wed-11:00 AM': false,
  'Thu-09:00 AM': true, 'Thu-10:00 AM': true, 'Thu-11:00 AM': false,
  'Fri-09:00 AM': false, 'Fri-10:00 AM': true, 'Fri-11:00 AM': false,
};

const avatars = [
  'https://i.pravatar.cc/150?img=11',
  'https://i.pravatar.cc/150?img=12',
  'https://i.pravatar.cc/150?img=13',
];

export function TeacherPortal() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const { currentUser, setCurrentUser, searchQuery } = useAppStore();

  const [slots, setSlots] = useState<Record<string, boolean>>(() => {
    if (currentUser?.availability && typeof currentUser.availability === 'object') {
      return { ...defaultSlots, ...currentUser.availability };
    }
    return defaultSlots;
  });
  const [isAvailableNow, setIsAvailableNow] = useState<boolean>(Boolean(currentUser?.isAvailableNow));
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const [portalRates, setPortalRates] = useState<Record<number, number>>(() => {
    if (currentUser?.batchPricing && typeof currentUser.batchPricing === 'object') {
      return { ...currentUser.batchPricing };
    }
    const base = currentUser?.hourlyRate || 499;
    return {
      1: base,
      2: Math.round(base * 0.8),
      3: Math.round(base * 0.7),
      4: Math.round(base * 0.6),
      5: Math.round(base * 0.5)
    };
  });
  const [savingRates, setSavingRates] = useState(false);
  const [ratesSavedNotice, setRatesSavedNotice] = useState(false);

  const loadData = useCallback(() => {
    if (!currentUser) {
      api.getMe().then(user => {
        setCurrentUser(user);
        if (user?.availability && typeof user.availability === 'object') {
          setSlots(prev => ({ ...prev, ...user.availability }));
        }
        if (typeof user?.isAvailableNow === 'boolean') {
          setIsAvailableNow(user.isAvailableNow);
        }
        if (user?.batchPricing && typeof user.batchPricing === 'object') {
          setPortalRates({ ...user.batchPricing });
        } else if (user?.hourlyRate) {
          const base = user.hourlyRate;
          setPortalRates({
            1: base,
            2: Math.round(base * 0.8),
            3: Math.round(base * 0.7),
            4: Math.round(base * 0.6),
            5: Math.round(base * 0.5)
          });
        }
      }).catch(console.error);
    } else {
      if (currentUser.availability && typeof currentUser.availability === 'object') {
        setSlots(prev => ({ ...prev, ...currentUser.availability }));
      }
      if (typeof currentUser.isAvailableNow === 'boolean') {
        setIsAvailableNow(currentUser.isAvailableNow);
      }
      if (currentUser.batchPricing && typeof currentUser.batchPricing === 'object') {
        setPortalRates({ ...currentUser.batchPricing });
      } else if (currentUser.hourlyRate) {
        const base = currentUser.hourlyRate;
        setPortalRates({
          1: base,
          2: Math.round(base * 0.8),
          3: Math.round(base * 0.7),
          4: Math.round(base * 0.6),
          5: Math.round(base * 0.5)
        });
      }
    }
    api.getSessions().then(setSessions).catch(console.error);
    api.getTransactions().then(setTransactions).catch(console.error);
  }, [currentUser, setCurrentUser]);

  const handleSaveRates = async () => {
    if (!currentUser?.id) return;
    setSavingRates(true);
    try {
      const base1on1 = portalRates[1] || currentUser.hourlyRate || 499;
      await api.updateUser(currentUser.id, {
        hourlyRate: base1on1,
        batchPricing: portalRates
      });
      setCurrentUser({
        ...currentUser,
        hourlyRate: base1on1,
        batchPricing: portalRates
      });
      api.syncNetworkUser({
        ...currentUser,
        hourlyRate: base1on1,
        batchPricing: portalRates
      });
      setRatesSavedNotice(true);
      setTimeout(() => setRatesSavedNotice(false), 2500);
    } catch (err) {
      console.error('Failed to save rates:', err);
    } finally {
      setSavingRates(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const teacherSessions = sessions.filter(s => currentUser && (s.teacherId === currentUser.id || s.teacher?.id === currentUser.id));
  const pendingSessions = teacherSessions.filter(s => s.status === 'pending');
  const confirmedSessions = teacherSessions.filter(s => s.status === 'confirmed' || s.status === 'live');

  // Calculate live teacher revenue from earned transactions
  const teacherEarnedTransactions = transactions.filter(t => 
    t.type === 'EARNED' && t.userId === currentUser?.id
  );
  const totalEarnedRevenue = teacherEarnedTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const hoursTaughtCount = teacherSessions.reduce((sum, s) => sum + ((s.durationMin || 60) / 60), 0);

  const filteredPending = pendingSessions.filter(s => {
    if (searchQuery.trim() === '') return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = s.title?.toLowerCase().includes(query) ?? false;
    const studentMatch = s.student?.name?.toLowerCase().includes(query) ?? false;
    return titleMatch || studentMatch;
  });

  const handleApprove = async (id: string) => {
    await api.patchSession(id, { status: 'confirmed' });
    loadData();
  };

  const handleDecline = async (id: string) => {
    await api.patchSession(id, { status: 'declined' });
    loadData();
  };

  const handleSaveAvailability = async (targetSlots = slots, targetNow = isAvailableNow) => {
    if (!currentUser?.id) return;
    setSavingAvailability(true);
    try {
      await api.updateUser(currentUser.id, {
        availability: targetSlots,
        isAvailableNow: targetNow
      });
      setCurrentUser({
        ...currentUser,
        availability: targetSlots,
        isAvailableNow: targetNow
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } catch (err) {
      console.error('Failed to save availability:', err);
    } finally {
      setSavingAvailability(false);
    }
  };

  const handleToggleSlot = (key: string) => {
    setSlots(prev => {
      const next = { ...prev, [key]: !prev[key] };
      handleSaveAvailability(next, isAvailableNow);
      return next;
    });
  };

  const handleToggleInstant = () => {
    const nextNow = !isAvailableNow;
    setIsAvailableNow(nextNow);
    handleSaveAvailability(slots, nextNow);
  };

  return (
    <div className="max-w-container_max mx-auto select-none space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">Teacher Portal & Mentoring Hub</h2>
          <p className="text-xs sm:text-sm text-on-surface-variant font-medium mt-1">Manage your mentoring schedule, student payments, and group cohorts.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => navigate('/wallet')}
          className="font-extrabold text-xs px-4 py-2 flex items-center gap-1.5 shrink-0"
        >
          <span className="material-symbols-outlined text-base">payments</span>
          View Earnings & Wallet
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { 
            label: 'Total Revenue Received', 
            value: `₹${totalEarnedRevenue.toLocaleString('en-IN')}`, 
            icon: 'payments', 
            bgColor: 'bg-teaching-emerald-container', 
            iconColor: 'text-on-teaching-emerald-container', 
            borderColor: 'border-teaching-emerald/20', 
            sub: `${teacherEarnedTransactions.length} student payout${teacherEarnedTransactions.length !== 1 ? 's' : ''} recorded`,
            onClick: () => navigate('/wallet')
          },
          { 
            label: 'Hours Taught', 
            value: hoursTaughtCount > 0 ? hoursTaughtCount.toString() : '12', 
            icon: 'schedule', 
            bgColor: 'bg-primary-container', 
            iconColor: 'text-on-primary-container', 
            borderColor: 'border-primary/20', 
            sub: 'Across active sessions' 
          },
          { label: 'Avg Rating', value: currentUser?.trustScore ? currentUser.trustScore.toFixed(2) : '5.00', icon: 'verified', bgColor: 'bg-surface-container', iconColor: 'text-on-surface', borderColor: 'border-outline-variant', sub: 'Top 5% of Mentors' },
        ].map((stat, i) => (
          <div 
            key={i} 
            onClick={stat.onClick}
            className={`bg-surface border border-outline-variant rounded-xl p-5 shadow-elevation-1 flex flex-col justify-between ${stat.onClick ? 'cursor-pointer hover:border-teaching-emerald/40 hover:shadow-elevation-2 transition-all' : ''}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant">{stat.label}</h3>
                <p className="text-2xl font-bold text-on-surface mt-0.5">{stat.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} ${stat.iconColor} ${stat.borderColor} border flex items-center justify-center`}>
                <span className="material-symbols-outlined text-xl">{stat.icon}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-teaching-emerald">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span>{stat.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Batch & Lecture Pricing Card */}
      <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-elevation-1 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-xl">payments</span>
                <span>Your Mentoring Pricing & Batch Rates</span>
              </h3>
              {ratesSavedNotice && (
                <span className="text-xs font-bold text-teaching-emerald flex items-center gap-1 bg-teaching-emerald-container px-2 py-0.5 rounded-md border border-teaching-emerald/20">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Rates Updated!
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Set the price students pay per seat for each lecture format. These prices are used directly across the marketplace.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={handleSaveRates}
            disabled={savingRates}
            className="text-xs font-bold px-4 py-2 shrink-0 flex items-center gap-1.5"
          >
            {savingRates ? (
              <>
                <span className="w-3 h-3 border border-on-primary border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">save</span>
                <span>Save All Rates</span>
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { cap: 1, label: '1-on-1 Lecture', icon: 'person', desc: '1 Student (Base Rate)' },
            { cap: 2, label: 'Duo Study', icon: 'group', desc: '2 Students' },
            { cap: 3, label: 'Trio Batch', icon: 'groups', desc: '3 Students' },
            { cap: 4, label: 'Small Cohort', icon: 'diversity_3', desc: '4 Students' },
            { cap: 5, label: 'Masterclass Batch', icon: 'school', desc: '5 Students (Max)' },
          ].map(tier => {
            const price = portalRates[tier.cap] ?? (tier.cap === 1 ? (currentUser?.hourlyRate || 499) : Math.round((currentUser?.hourlyRate || 499) * (1 - tier.cap * 0.1)));
            const totalHour = price * tier.cap;
            return (
              <div key={tier.cap} className="p-3 bg-surface-container-low rounded-xl border border-outline-variant flex flex-col justify-between space-y-2 hover:border-primary/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-primary">{tier.icon}</span>
                    {tier.label}
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-medium">{tier.cap} Seat{tier.cap > 1 ? 's' : ''}</span>
                </div>
                <div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs font-bold text-on-surface-variant">₹</span>
                    <input 
                      type="number"
                      min={25}
                      max={10000}
                      step={25}
                      value={price}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setPortalRates(prev => ({ ...prev, [tier.cap]: val }));
                      }}
                      className="w-full pl-6 pr-2 py-1.5 text-xs font-bold rounded-lg border border-outline-variant bg-surface text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <span className="text-[10px] text-on-surface-variant block mt-0.5 text-right font-medium">per student</span>
                </div>
                <div className="pt-1.5 border-t border-outline-variant flex items-center justify-between text-[11px] font-extrabold">
                  <span className="text-on-surface-variant font-semibold">Cohort Earnings:</span>
                  <span className="text-teaching-emerald font-black">₹{totalHour}/hr</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Availability Grid */}
        <div className="md:col-span-8 bg-surface border border-outline-variant rounded-xl shadow-elevation-1 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-on-surface">Weekly Availability Schedule</h3>
                {savedNotice && (
                  <span className="text-[11px] font-extrabold text-teaching-emerald flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    Saved
                  </span>
                )}
                {savingAvailability && (
                  <span className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
                    <span className="w-2.5 h-2.5 border border-primary border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant">Click any slot to open or close booking windows for students</p>
            </div>

            {/* Instant Tutoring Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleInstant}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  isAvailableNow
                    ? 'bg-teaching-emerald-container text-on-teaching-emerald-container border-teaching-emerald/40 shadow-xs'
                    : 'bg-surface hover:bg-surface-container text-on-surface-variant border-outline-variant'
                }`}
                title="Toggle instant drop-in tutoring visibility"
              >
                <span className="material-symbols-outlined text-base leading-none text-teaching-emerald">
                  {isAvailableNow ? 'bolt' : 'flash_off'}
                </span>
                <span>{isAvailableNow ? 'Available Now (Online)' : 'Go Available Now'}</span>
              </button>
            </div>
          </div>
          <div className="p-5 overflow-x-auto custom-scrollbar">
            <div className="grid gap-2 min-w-[500px]" style={{ gridTemplateColumns: '80px repeat(5, 1fr)' }}>
              <div />
              {DAYS.map(d => (
                <div key={d} className="text-center text-xs font-bold text-on-surface py-1.5">{d}</div>
              ))}
              {HOURS.map(hour => (
                <div key={hour} className="contents">
                  <div className="text-right pr-3 text-[11px] font-medium text-on-surface-variant py-2.5 self-center">{hour}</div>
                  {DAYS.map(day => {
                    const key = `${day}-${hour}`;
                    const isFree = slots[key];
                    return (
                      <div
                        key={key}
                        onClick={() => handleToggleSlot(key)}
                        className={`h-9 rounded-lg border text-center flex items-center justify-center text-xs font-semibold cursor-pointer transition-colors ${
                          isFree
                            ? 'bg-teaching-emerald-container border-teaching-emerald/20 text-on-teaching-emerald-container font-extrabold shadow-xs'
                            : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        {isFree ? 'Open' : '—'}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pending Session Requests */}
        <div className="md:col-span-4 bg-surface border border-outline-variant rounded-xl shadow-elevation-1 overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
            <h3 className="text-sm font-bold text-on-surface">Student Requests</h3>
            <span className="bg-learning-amber-container text-on-learning-amber-container text-[10px] font-bold px-2 py-0.5 rounded-full">
              {filteredPending.length} pending
            </span>
          </div>
          <div className="p-4 flex-1 space-y-3 overflow-y-auto max-h-[420px] custom-scrollbar">
            {filteredPending.length === 0 ? (
              <div className="text-center py-10 text-on-surface-variant text-xs">
                <span className="material-symbols-outlined text-3xl text-outline mb-1">task_alt</span>
                <p className="font-semibold text-on-surface">No pending student requests</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">New session bookings will appear here.</p>
              </div>
            ) : (
              filteredPending.map((session, idx) => (
                <div key={session.id} className="bg-surface border border-outline-variant rounded-xl p-3.5 shadow-elevation-1 space-y-2.5">
                  <div className="flex items-center gap-3">
                    <img
                      src={avatars[idx % avatars.length]}
                      alt="Student Avatar"
                      className="w-9 h-9 rounded-full object-cover border border-outline-variant"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-on-surface truncate">{session.student?.name || 'Student'}</p>
                      <p className="text-[11px] text-on-surface-variant font-medium truncate">{session.title}</p>
                    </div>
                    {(session.maxCapacity || 1) > 1 && (
                      <span className="px-2 py-0.5 bg-teaching-emerald-container text-on-teaching-emerald-container text-[10px] font-bold rounded-md border border-teaching-emerald/20 shrink-0">
                        {session.maxCapacity}-Seat Cohort
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1 border-t border-outline-variant">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-outline">event</span>
                      {new Date(session.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-outline">schedule</span>
                      {new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="secondary"
                      className="flex-1 py-1 text-xs font-semibold"
                      onClick={() => handleDecline(session.id)}
                    >
                      Decline
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1 py-1 text-xs font-semibold"
                      onClick={() => handleApprove(session.id)}
                    >
                      Accept
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Confirmed Live Classes & Cohorts */}
      <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-elevation-1 space-y-4">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div>
            <h3 className="text-base font-bold text-on-surface">Your Scheduled & Live Cohort Lectures</h3>
            <p className="text-xs text-on-surface-variant">Enter the live studio room to meet and mentor your enrolled students.</p>
          </div>
          <span className="px-2.5 py-1 bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20 rounded-full text-xs font-bold">
            {confirmedSessions.length} Confirmed
          </span>
        </div>

        {confirmedSessions.length === 0 ? (
          <div className="text-center py-8 text-on-surface-variant text-xs">
            <span className="material-symbols-outlined text-3xl text-outline mb-1">event_available</span>
            <p className="font-semibold text-on-surface">No confirmed lectures scheduled yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {confirmedSessions.map(session => {
              const cap = session.maxCapacity || 1;
              return (
                <div key={session.id} className="border border-outline-variant rounded-xl p-4 space-y-3 bg-surface-container-low hover:bg-surface-container transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        cap > 1 ? 'bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20' : 'bg-primary-container text-on-primary-container border border-primary/20'
                      }`}>
                        {cap > 1 ? `${cap}-Student Cohort Batch` : '1-on-1 Lecture'}
                      </span>
                      <h4 className="text-sm font-bold text-on-surface mt-1">{session.title}</h4>
                      <p className="text-xs text-on-surface-variant">{session.student?.name ? `Student: ${session.student.name}` : 'Group Batch'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-on-surface-variant font-medium">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">event</span>
                      {new Date(session.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">schedule</span>
                      {new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Multi-student cohort revenue tracker */}
                  {(() => {
                    const paidList = Array.isArray(session.students) ? session.students.filter((st: any) => st.paymentStatus === 'paid') : (session.paymentStatus === 'paid' ? [session.student] : []);
                    const totalStudents = Array.isArray(session.students) ? session.students.length : (session.studentId ? 1 : 0);
                    const earnedFromSession = paidList.reduce((sum: number, st: any) => sum + (Number(st.amountPaid) || Number(session.pricePerStudent) || Number(session.amount) || 499), 0);
                    return (
                      <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-outline-variant">
                        <span className="text-on-surface-variant">Collected Revenue:</span>
                        <span className="text-teaching-emerald font-black">₹{earnedFromSession} ({paidList.length}/{Math.max(1, totalStudents)} Paid)</span>
                      </div>
                    );
                  })()}

                  <Button
                    variant="primary"
                    onClick={() => navigate(`/live/${session.id}`)}
                    className="w-full py-1.5 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">videocam</span>
                    <span>{cap > 1 ? `Start Live Room (${cap} Students + You)` : 'Start Live 1-on-1 Studio'}</span>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
