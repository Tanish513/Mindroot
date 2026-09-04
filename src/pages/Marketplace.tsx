import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { api, onPeersUpdated, onSessionsUpdated, calculateSeatPrice, getCapacityDetails } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';

const categories = ['All Skills', 'Software & AI', 'Design & 3D', 'Languages', 'Business', 'Music & Audio', 'Academics'];

export function Marketplace() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('All Skills');
  const [activeTab, setActiveTab] = useState<'mentors' | 'group_batches'>('mentors');
  const [roleFilter, setRoleFilter] = useState<'all' | 'teacher' | 'both'>('all');
  const [peers, setPeers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { searchQuery, currentUser } = useAppStore();

  // Booking Modal State
  const [bookingPeer, setBookingPeer] = useState<any | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<any | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingCapacity, setBookingCapacity] = useState<number>(1);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [confirmedSession, setConfirmedSession] = useState<any | null>(null);
  const [bookingError, setBookingError] = useState('');
  const [conflictData, setConflictData] = useState<{ nearestSlot: string; nearestSlotFormatted: string } | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);

  // Quick Join Group Batch State
  const [joiningBatch, setJoiningBatch] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadAll = () => {
      Promise.all([api.getPeers(), api.getSessions()]).then(([pData, sData]) => {
        if (mounted) {
          setPeers(pData);
          setSessions(sData);
          setLoading(false);
        }
      }).catch(console.error);
    };

    loadAll();
    const unsubPeers = onPeersUpdated(loadAll);
    const unsubSessions = onSessionsUpdated(loadAll);
    return () => {
      mounted = false;
      unsubPeers();
      unsubSessions();
    };
  }, []);

  // Total count of eligible mentors (teachers and both) excluding admin and current user
  const totalEligibleMentors = peers.filter(p => {
    if (p.role === 'admin' || p.id === 'user-admin') return false;
    if (currentUser && p.id === currentUser.id) return false;
    const r = (p.role || '').toLowerCase().trim();
    return r === 'teacher' || r === 'both';
  }).length;

  const filteredPeers = peers.filter(peer => {
    // Exclude platform administrators and the logged-in user themselves
    if (peer.role === 'admin' || peer.id === 'user-admin') return false;
    if (currentUser && peer.id === currentUser.id) return false;

    // Strict Role Filtering:
    // Marketplace is strictly for booking mentoring sessions.
    // Profiles registered as 'student' should NEVER be displayed in the marketplace.
    // Marketplace must only display profiles whose role is 'teacher' or 'both'.
    const normalizedRole = (peer.role || '').toLowerCase().trim();
    if (normalizedRole !== 'teacher' && normalizedRole !== 'both') {
      return false;
    }

    // Role sub-filter (All Mentors, Teacher only, or Both only)
    if (roleFilter === 'teacher' && normalizedRole !== 'teacher') return false;
    if (roleFilter === 'both' && normalizedRole !== 'both') return false;

    // Category Filter
    if (activeCategory !== 'All Skills') {
      const matchesCategory = Array.isArray(peer.userSkills) && peer.userSkills.some((us: any) => us.skill?.category === activeCategory);
      if (!matchesCategory) return false;
    }

    // Search Query Filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const nameMatches = peer.name?.toLowerCase().includes(query);
      const roleMatches = peer.role?.toLowerCase().includes(query);
      const teachesMatches = (peer.skillsTaught || []).some((s: any) => (typeof s === 'string' ? s : s.name || '').toLowerCase().includes(query));
      const learnsMatches = (peer.skillsLearned || []).some((s: any) => (typeof s === 'string' ? s : s.name || '').toLowerCase().includes(query));
      const skillMatches = Array.isArray(peer.userSkills) && peer.userSkills.some((us: any) => 
        us.skill?.name?.toLowerCase().includes(query) || us.skill?.category?.toLowerCase().includes(query)
      );
      if (!nameMatches && !roleMatches && !teachesMatches && !learnsMatches && !skillMatches) return false;
    }

    return true;
  });

  // Prioritize and pin featured mentors to top
  const sortedPeers = [...filteredPeers].sort((a, b) => {
    const aFeat = a.isFeatured ? 1 : 0;
    const bFeat = b.isFeatured ? 1 : 0;
    return bFeat - aFeat;
  });

  // Filter open group sessions with capacity > 1
  const openGroupBatches = sessions.filter(s => {
    if (!s || (s.maxCapacity || 1) <= 1) return false;
    const enrolled = Array.isArray(s.students) ? s.students.length : (s.studentId ? 1 : 0);
    const maxCap = s.maxCapacity || 5;
    return enrolled < maxCap && s.status !== 'completed' && s.status !== 'declined';
  });

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

const getNextDateForDay = (dayAbbr: string) => {
  const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  const targetDay = dayMap[dayAbbr];
  if (targetDay === undefined) return getTodayDateString();
  const d = new Date();
  const currentDay = d.getDay();
  let diff = targetDay - currentDay;
  if (diff <= 0) diff += 7;
  d.setDate(d.getDate() + diff);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const convert12to24 = (time12: string) => {
  const parts = time12.trim().split(' ');
  const time = parts[0];
  const modifier = parts[1];
  let [hours, minutes] = time.split(':');
  if (hours === '12') hours = '00';
  if (modifier === 'PM') hours = String(parseInt(hours, 10) + 12).padStart(2, '0');
  return `${hours}:${minutes}`;
};

  const handleOpenBooking = (peer: any) => {
    const normRole = (peer?.role || '').toLowerCase().trim();
    if (normRole !== 'teacher' && normRole !== 'both') {
      alert('Cannot book a session with a student profile. Mentoring sessions are only offered by mentors registered as teacher or both.');
      return;
    }
    setBookingPeer(peer);
    const peerSkills = Array.isArray(peer.userSkills) && peer.userSkills.length > 0
      ? peer.userSkills 
      : (Array.isArray(peer.skillsTaught) ? peer.skillsTaught.map((t: string) => ({ id: 's-' + t, type: 'teaches', skill: { id: 's-' + t, name: t } })) : []);
    const teachesSkills = peerSkills.filter((us: any) => us && us.type === 'teaches');
    const defaultSkill = teachesSkills[0] || (peer.skillsTaught?.[0] ? { id: 's-' + peer.skillsTaught[0], type: 'teaches', skill: { id: 's-' + peer.skillsTaught[0], name: peer.skillsTaught[0] } } : { id: 's-general', type: 'teaches', skill: { id: 's-general', name: 'General Mentoring' } });
    setSelectedSkill(defaultSkill);
    setBookingDate(getTodayDateString());
    setBookingTime(getDefaultTimeString());
    setBookingCapacity(1);
    setBookingSuccess(false);
    setConfirmedSession(null);
    setBookingError('');
    setConflictData(null);
    setSelectedVoucherId(null);
  };

  const currentSeatPrice = bookingPeer ? calculateSeatPrice(bookingPeer, bookingCapacity) : 499;

  const availableVouchers = (Array.isArray(currentUser?.vouchers) ? currentUser.vouchers : []).filter((v: any) => !v.isUsed);
  const selectedVoucher = availableVouchers.find((v: any) => v.id === selectedVoucherId);
  const voucherDiscount = selectedVoucher 
    ? (selectedVoucher.discountType === 'percent'
        ? Math.round(currentSeatPrice * (selectedVoucher.discountValue / 100))
        : Math.min(currentSeatPrice, selectedVoucher.discountValue))
    : 0;
  const finalSeatPrice = Math.max(0, currentSeatPrice - voucherDiscount);

  const handleReserveBooking = async (overrideSlotISO?: string) => {
    if (!bookingPeer) return;
    if (!overrideSlotISO && (!bookingDate || !bookingTime)) {
      setBookingError('Please select both date and time.');
      return;
    }

    const scheduledAt = overrideSlotISO ? new Date(overrideSlotISO) : new Date(`${bookingDate}T${bookingTime}`);
    if (isNaN(scheduledAt.getTime())) {
      setBookingError('Invalid date or time selected.');
      return;
    }

    setIsProcessingPayment(true);
    setBookingError('');
    setConflictData(null);

    try {
      const skillName = selectedSkill?.skill?.name || selectedSkill?.name || (bookingPeer.skillsTaught?.[0] || 'General Mentoring');
      const sessionTitle = `${skillName} Mentoring`;
      const seatPrice = calculateSeatPrice(bookingPeer, bookingCapacity);
      const discount = selectedVoucher
        ? (selectedVoucher.discountType === 'percent'
            ? Math.round(seatPrice * (selectedVoucher.discountValue / 100))
            : Math.min(seatPrice, selectedVoucher.discountValue))
        : 0;
      const finalPrice = Math.max(0, seatPrice - discount);

      // Book session with zero upfront payment (Pay after lecture, requires teacher approval)
      const newSession = await api.postSession({
        title: sessionTitle,
        teacherId: bookingPeer.id,
        studentId: currentUser?.id || 'user-alex',
        skillId: selectedSkill?.skill?.id || selectedSkill?.id || 's-general',
        scheduledAt: scheduledAt.toISOString(),
        durationMin: 60,
        amount: finalPrice,
        pricePerStudent: finalPrice,
        maxCapacity: bookingCapacity,
        voucherId: selectedVoucherId || undefined,
        discountApplied: discount
      });

      // Optimistically mark applied voucher as used
      if (selectedVoucherId && currentUser) {
        const updatedVouchers = (currentUser.vouchers || []).map((v: any) => 
          v.id === selectedVoucherId ? { ...v, isUsed: true, usedInSessionId: newSession?.id } : v
        );
        useAppStore.getState().setCurrentUser({ ...currentUser, vouchers: updatedVouchers });
      }

      setConfirmedSession(newSession);
      setBookingSuccess(true);
    } catch (err: any) {
      console.error('Booking error:', err);
      if (err.conflict && err.nearestSlot) {
        setConflictData({
          nearestSlot: err.nearestSlot,
          nearestSlotFormatted: err.nearestSlotFormatted || new Date(err.nearestSlot).toLocaleString()
        });
        setBookingError(err.message || 'Requested time slot is already booked.');
      } else {
        setBookingError(err.message || 'Booking initiation failed. Please try again.');
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Direct Join Open Batch with Zero Upfront (Pay After Lecture)
  const handleJoinOpenBatch = async (batch: any) => {
    setJoiningBatch(batch);
    const seatPrice = batch.pricePerStudent || batch.amount || 249;

    try {
      await api.joinGroupSession(batch.id, {
        id: currentUser?.id || 'user-alex',
        name: currentUser?.name || 'Alex (Student)',
        avatar: currentUser?.avatar || 'https://i.pravatar.cc/150?img=11',
        paymentStatus: 'pending',
        amountDue: seatPrice
      });
      navigate('/schedule');
    } catch (err: any) {
      console.error('Error joining batch:', err);
    } finally {
      setJoiningBatch(null);
    }
  };

  return (
    <div className="max-w-container_max mx-auto relative select-none space-y-6">
      {/* Header with Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">Skill Marketplace & Group Batches</h2>
            <span className="px-2.5 py-0.5 bg-primary-container text-on-primary-container border border-primary/20 rounded-full text-[11px] font-bold">
              Pay After Lecture
            </span>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant font-medium mt-0.5">Book 1-on-1 private mentoring or group study batches (up to 5 seats) for ₹0 upfront. Pay after your lecture!</p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex bg-surface-container p-1 rounded-xl border border-outline-variant self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('mentors')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'mentors' 
                ? 'bg-surface text-primary shadow-elevation-1' 
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-sm">person_search</span>
            <span>All Mentors ({totalEligibleMentors})</span>
          </button>
          <button
            onClick={() => setActiveTab('group_batches')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'group_batches' 
                ? 'bg-surface text-primary shadow-elevation-1' 
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-sm">groups</span>
            <span>Open Cohorts ({openGroupBatches.length})</span>
          </button>
        </div>
      </div>

      {/* Trust & Pay After Class Info Banner */}
      <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-on-surface shadow-elevation-1">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-primary text-xl shrink-0">verified_user</span>
          <span>
            <strong>Post-Lecture Payment Guarantee:</strong> Reserve your seat for ₹0 today. Attend the live studio lecture first and pay your mentor via Razorpay only after class ends.
          </span>
        </div>
      </div>

      {/* Controls: Role Filter & Category Bar */}
      <div className="space-y-2.5">
        {/* Role Filter Chips: All Mentors, Teachers Only, Both (Teach & Learn) */}
        {activeTab === 'mentors' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1 mr-1">
              <span className="material-symbols-outlined text-sm text-primary">filter_list</span>
              Role Filter:
            </span>
            {[
              { id: 'all', label: 'All Mentors (Teacher & Both)' },
              { id: 'teacher', label: 'Teacher Only' },
              { id: 'both', label: 'Both (Teach & Learn)' }
            ].map(rf => (
              <button
                key={rf.id}
                onClick={() => setRoleFilter(rf.id as 'all' | 'teacher' | 'both')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                  roleFilter === rf.id
                    ? 'bg-primary text-on-primary border-primary shadow-elevation-1'
                    : 'bg-surface text-on-surface-variant border-outline-variant hover:border-primary/40 hover:text-on-surface'
                }`}
              >
                {rf.label}
              </button>
            ))}
          </div>
        )}

        {/* Categories Bar */}
        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                activeCategory === cat 
                  ? 'bg-primary text-on-primary border-primary shadow-elevation-1' 
                  : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'mentors' ? (
        /* MENTORS LISTING */
        loading ? (
          <div className="text-on-surface-variant p-8 text-center font-semibold text-xs animate-pulse">Loading mentors...</div>
        ) : filteredPeers.length === 0 ? (
          <div className="text-on-surface-variant p-12 text-center border border-dashed border-outline rounded-2xl bg-surface shadow-elevation-1">
            <span className="material-symbols-outlined text-4xl mb-2 text-outline">search_off</span>
            <p className="font-bold text-on-surface text-sm">No peers found matching your query</p>
            <p className="text-xs text-on-surface-variant mt-1">Try searching for another topic or selecting a different category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {sortedPeers.map((peer, i) => (
              <div 
                key={peer.id} 
                className={`flex flex-col h-full justify-between p-5 bg-surface rounded-xl border shadow-elevation-1 hover:shadow-elevation-2 transition-all group ${
                  peer.isFeatured ? 'border-learning-amber/60 ring-1 ring-learning-amber/30' : 'border-outline-variant hover:border-outline'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-3 mb-4">
                    <div className="flex gap-3 items-center">
                      <div className="relative shrink-0">
                        <img src={`https://i.pravatar.cc/150?img=${i + 10}`} alt={`${peer.name}'s profile avatar`} className="w-10 h-10 rounded-full object-cover border border-outline-variant" />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-teaching-emerald rounded-full ring-2 ring-surface" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-on-surface flex items-center gap-1 group-hover:text-primary transition-colors">
                          {peer.name} {peer.trustScore > 4.8 && <span className="material-symbols-outlined text-primary text-sm">verified</span>}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[11px] font-medium text-on-surface-variant capitalize">{peer.role}</span>
                          {peer.isFeatured && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.2 rounded-md bg-learning-amber-container text-on-learning-amber-container border border-learning-amber/40 text-[10px] font-black uppercase tracking-wide shadow-xs">
                              <span className="material-symbols-outlined text-xs text-learning-amber">star</span>
                              Featured
                            </span>
                          )}
                          {peer.isAvailableNow && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/30 text-[10px] font-black uppercase tracking-wide">
                              <span className="material-symbols-outlined text-xs text-teaching-emerald">bolt</span>
                              Live Now
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-1 bg-teaching-emerald-container border border-teaching-emerald/20 text-on-teaching-emerald-container rounded-lg text-xs font-bold flex items-center gap-1">
                        <span>₹{peer.hourlyRate || 499}</span>
                        <span className="text-[10px] font-normal text-on-teaching-emerald-container/80">/hr</span>
                      </span>
                      <span className="text-[9px] text-on-surface-variant block font-semibold mt-0.5">Pay after class</span>
                    </div>
                  </div>

                  <div className="mb-3.5">
                    <p className="text-[10px] font-bold text-teaching-emerald tracking-wider uppercase mb-1">TEACHES</p>
                    <div className="flex flex-wrap gap-1">
                      {(peer.userSkills || []).filter((s: any) => s && s.type === 'teaches').length === 0 && <span className="text-xs text-on-surface-variant italic">None</span>}
                      {(peer.userSkills || []).filter((s: any) => s && s.type === 'teaches').map((s: any, sIdx: number) => (
                        <span key={s.id || s.skill?.id || sIdx} className="px-2 py-0.5 bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20 rounded-md text-xs font-semibold">
                          {s.skill?.name || 'Skill'}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-[10px] font-bold text-learning-amber tracking-wider uppercase mb-1">WANTS TO LEARN</p>
                    <div className="flex flex-wrap gap-1">
                      {(peer.userSkills || []).filter((s: any) => s && s.type === 'wants_to_learn').length === 0 && <span className="text-xs text-on-surface-variant italic">None</span>}
                      {(peer.userSkills || []).filter((s: any) => s && s.type === 'wants_to_learn').map((s: any, sIdx: number) => (
                        <span key={s.id || s.skill?.id || sIdx} className="px-2 py-0.5 bg-learning-amber-container text-on-learning-amber-container border border-learning-amber/20 rounded-md text-xs font-semibold">
                          {s.skill?.name || 'Skill'}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Group Capacity Pricing Teaser */}
                  <div className="mb-4 p-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-[11px] text-on-surface-variant flex items-center justify-between">
                    <span className="flex items-center gap-1 font-semibold text-on-surface">
                      <span className="material-symbols-outlined text-sm text-primary">groups</span>
                      Group Option:
                    </span>
                    <span className="text-teaching-emerald font-bold">From ₹{calculateSeatPrice(peer, 5)}/seat (Pay later)</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-3.5 border-t border-outline-variant">
                  <Button 
                    variant="secondary" 
                    className="flex-1 font-semibold text-xs py-1.5"
                    onClick={() => navigate(`/messages?peerId=${peer.id}`, { state: { peerId: peer.id } })}
                  >
                    Chat
                  </Button>
                  <Button variant="primary" className="flex-1 font-semibold text-xs py-1.5 flex items-center justify-center gap-1" onClick={() => handleOpenBooking(peer)}>
                    <span className="material-symbols-outlined text-sm">calendar_month</span>
                    Book Lecture
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* OPEN GROUP BATCHES LISTING */
        <div className="space-y-4">
          {/* Cohort Batch Filter Chips */}
          <div className="flex items-center gap-2 pb-1">
            <span className="text-xs font-bold text-on-surface-variant mr-1">Filter Batch Size:</span>
            {[
              { id: 'all', label: 'All Batches' },
              { id: '3', label: '3-Student Batches (Trio)' },
              { id: '5', label: '5-Student Batches (Masterclass)' }
            ].map(bTab => (
              <button
                key={bTab.id}
                onClick={() => setBookingCapacity(bTab.id === '3' ? 3 : bTab.id === '5' ? 5 : 1)}
                className="px-3 py-1 bg-surface border border-outline-variant hover:border-teaching-emerald/40 rounded-lg text-xs font-bold text-on-surface shadow-elevation-1"
              >
                {bTab.label}
              </button>
            ))}
          </div>

          {openGroupBatches.length === 0 ? (
            <div className="bg-surface border border-outline-variant rounded-2xl p-12 text-center space-y-3 shadow-elevation-1">
              <span className="material-symbols-outlined text-5xl text-teaching-emerald">groups</span>
              <h3 className="text-base font-bold text-on-surface">No Open Group Cohorts Right Now</h3>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                Be the first to start a group cohort! Choose a mentor above, select a <strong>3-Student or 5-Student Batch</strong>, and invite peers to join your batch (Pay ₹0 upfront, pay after lecture).
              </p>
              <Button variant="primary" onClick={() => setActiveTab('mentors')} className="mt-2 text-xs">
                Browse Mentors
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {openGroupBatches.map(batch => {
                const enrolledCount = Array.isArray(batch.students) ? batch.students.length : (batch.studentId ? 1 : 0);
                const maxCap = batch.maxCapacity || 5;
                const seatsLeft = maxCap - enrolledCount;
                const isEnrolled = currentUser && Array.isArray(batch.students) && batch.students.some((st: any) => st.id === currentUser.id);
                const isBatchReady = enrolledCount >= maxCap;

                return (
                  <div key={batch.id} className="bg-surface border border-outline-variant rounded-2xl p-5 shadow-elevation-1 hover:shadow-elevation-2 transition-all space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            maxCap === 3 
                              ? 'bg-primary-container text-on-primary-container border border-primary/20' 
                              : 'bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20'
                          }`}>
                            {maxCap}-Student Group Cohort
                          </span>
                          {isBatchReady && (
                            <span className="px-2 py-0.5 bg-teaching-emerald-container text-on-teaching-emerald-container text-[10px] font-extrabold rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-teaching-emerald animate-ping" />
                              Ready to Join
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-on-surface mt-1">{batch.title}</h3>
                        <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                          <span>Mentor:</span>
                          <strong className="text-on-surface">{batch.teacher?.name || 'Mentor'}</strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-black text-teaching-emerald">₹{batch.pricePerStudent || batch.amount || 249}</div>
                        <div className="text-[10px] text-on-surface-variant">per seat • pay after class</div>
                      </div>
                    </div>

                    {/* Enrolled Students Avatars & Capacity Progress */}
                    <div className="space-y-1.5 p-3 bg-surface-container-low border border-outline-variant rounded-xl">
                      <div className="flex justify-between text-xs font-semibold text-on-surface">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-teaching-emerald animate-pulse" />
                          {enrolledCount} / {maxCap} Students Joined
                        </span>
                        <span className="text-primary font-bold">
                          {seatsLeft > 0 ? `${seatsLeft} Seat${seatsLeft > 1 ? 's' : ''} Left` : 'Batch Full & Ready!'}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-teaching-emerald h-full rounded-full transition-all duration-300"
                          style={{ width: `${(enrolledCount / maxCap) * 100}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-on-surface-variant font-bold uppercase">Classmates:</span>
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {(batch.students || []).map((st: any, sI: number) => (
                              <img 
                                key={st.id || sI} 
                                src={st.avatar || `https://i.pravatar.cc/150?img=${sI + 11}`} 
                                alt={st.name} 
                                title={st.name}
                                className="inline-block h-6 w-6 rounded-full ring-2 ring-surface object-cover" 
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-[10px] text-on-surface-variant font-semibold">All join room together</span>
                      </div>
                    </div>

                    {/* Scheduled Time and Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-outline-variant text-xs">
                      <div className="text-on-surface-variant font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-base text-outline">schedule</span>
                        <span>{batch.scheduledAt ? new Date(batch.scheduledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Scheduled Soon'}</span>
                      </div>

                      {isEnrolled ? (
                        <Button
                          variant="primary"
                          onClick={() => navigate(`/live/${batch.id}`)}
                          className="font-bold text-xs py-1.5 px-3 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">videocam</span>
                          <span>Join Live Batch Room</span>
                        </Button>
                      ) : (
                        <Button
                          variant="mint"
                          onClick={() => handleJoinOpenBatch(batch)}
                          disabled={joiningBatch?.id === batch.id}
                          className="font-bold text-xs py-1.5 px-4 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">how_to_reg</span>
                          <span>Join Batch (Pay ₹{batch.pricePerStudent || batch.amount || 249} Later)</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Booking Modal with Student Choice (Pay After Lecture) */}
      <AnimatePresence>
        {bookingPeer && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="bg-surface border border-outline-variant rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-elevation-3 relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => setBookingPeer(null)}
                aria-label="Close booking modal"
                className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl p-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>

              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-10 h-10 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">school</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-on-surface">Book Mentoring Lecture</h3>
                  <p className="text-xs text-on-surface-variant">Mentor: <strong className="text-on-surface">{bookingPeer.name}</strong> · Pay After Class</p>
                </div>
              </div>

              {bookingSuccess ? (
                <div className="space-y-4 pt-4">
                  <div className="bg-teaching-emerald-container border border-teaching-emerald/20 text-on-teaching-emerald-container rounded-2xl p-5 text-xs">
                    <div className="flex items-center gap-2 font-bold text-sm text-on-teaching-emerald-container mb-1.5">
                      <span className="material-symbols-outlined text-teaching-emerald text-xl">verified</span>
                      Lecture Reserved Successfully!
                    </div>
                    <p className="text-on-teaching-emerald-container/90 leading-relaxed">
                      Your <strong>{confirmedSession?.maxCapacity ? (confirmedSession.maxCapacity > 1 ? `${confirmedSession.maxCapacity}-Student Group Cohort` : '1-on-1 Private') : (bookingCapacity > 1 ? `${bookingCapacity}-Student Group Cohort` : '1-on-1 Private')}</strong> lecture with <strong>{bookingPeer.name}</strong> is scheduled.
                    </p>
                    <div className="mt-3 p-3 bg-surface rounded-xl border border-teaching-emerald/20 flex items-center justify-between font-bold text-on-surface">
                      <span>Amount Due (Pay After Lecture):</span>
                      <span className="text-teaching-emerald text-sm font-black">₹{currentSeatPrice}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={() => setBookingPeer(null)}>Done</Button>
                    <Button variant="primary" onClick={() => { setBookingPeer(null); navigate('/schedule'); }}>
                      Go to Schedule
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4.5 pt-4">
                  {bookingError && (
                    <div className="bg-alert-rose-container border border-alert-rose/20 text-on-alert-rose-container rounded-xl p-3 text-xs flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">error</span>
                      {bookingError}
                    </div>
                  )}

                  {/* Nearest Available Slot Recommendation Banner */}
                  {conflictData && (
                    <div className="bg-learning-amber-container border border-learning-amber/20 rounded-xl p-3.5 space-y-2 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-on-learning-amber-container">
                        <span className="material-symbols-outlined text-learning-amber text-base">schedule</span>
                        <span>Requested Slot Booked! Nearest Available Slot Found:</span>
                      </div>
                      <p className="text-on-learning-amber-container/90">
                        The nearest open slot for <strong>{bookingPeer?.name}</strong> is:
                        <br />
                        <span className="font-extrabold text-on-learning-amber-container text-sm">{conflictData.nearestSlotFormatted}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => handleReserveBooking(conflictData.nearestSlot)}
                        className="w-full py-2 bg-learning-amber hover:bg-learning-amber-hover text-on-learning-amber font-black rounded-xl text-xs flex items-center justify-center gap-1 shadow-elevation-1 active:scale-98 transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">event_available</span>
                        <span>Book Nearest Slot ({conflictData.nearestSlotFormatted})</span>
                      </button>
                    </div>
                  )}

                  {/* Student Choice: Lecture Format & Capacity */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                        Choose Your Lecture Format
                      </label>
                      <span className="text-[11px] text-teaching-emerald font-bold">Max 5 Students</span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { cap: 1, label: '1-on-1', icon: 'person' },
                        { cap: 2, label: 'Duo (2)', icon: 'group' },
                        { cap: 3, label: 'Trio (3)', icon: 'groups' },
                        { cap: 4, label: 'Quad (4)', icon: 'diversity_3' },
                        { cap: 5, label: 'Batch (5)', icon: 'school' }
                      ].map(item => {
                        const price = calculateSeatPrice(bookingPeer, item.cap);
                        const base1on1 = calculateSeatPrice(bookingPeer, 1);
                        const disc = item.cap > 1 && base1on1 > price ? Math.round(((base1on1 - price) / base1on1) * 100) : 0;
                        const isSelected = bookingCapacity === item.cap;

                        return (
                          <button
                            key={item.cap}
                            type="button"
                            onClick={() => setBookingCapacity(item.cap)}
                            className={`p-2 rounded-xl border flex flex-col items-center justify-between text-center transition-all ${
                              isSelected 
                                ? 'bg-primary-container border-primary text-on-primary-container shadow-elevation-1 ring-2 ring-primary/20' 
                                : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container'
                            }`}
                          >
                            <span className="material-symbols-outlined text-lg mb-0.5">{item.icon}</span>
                            <span className="text-[10px] font-bold leading-tight">{item.label}</span>
                            <span className={`text-[11px] font-black mt-1 ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                              ₹{price}
                            </span>
                            {disc > 0 ? (
                              <span className="text-[9px] font-bold text-on-teaching-emerald-container bg-teaching-emerald-container px-1 rounded mt-0.5">
                                -{disc}%
                              </span>
                            ) : (
                              <span className="text-[9px] text-transparent mt-0.5">.</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="bg-primary-container/50 border border-primary/20 text-on-primary-container p-2.5 rounded-xl text-[11px] flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-primary">info</span>
                        {getCapacityDetails(bookingCapacity).label}:
                      </span>
                      <strong className="text-primary">{getCapacityDetails(bookingCapacity).desc}</strong>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1.5">Select Topic / Skill</label>
                    {(() => {
                      const peerSkills = Array.isArray(bookingPeer.userSkills) && bookingPeer.userSkills.length > 0
                        ? bookingPeer.userSkills
                        : (Array.isArray(bookingPeer.skillsTaught) ? bookingPeer.skillsTaught.map((t: string) => ({ id: 's-' + t, type: 'teaches', skill: { id: 's-' + t, name: t } })) : []);
                      const teachesSkills = peerSkills.filter((us: any) => us && us.type === 'teaches');

                      return (
                        <select 
                          className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface text-xs font-medium p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-elevation-1"
                          value={selectedSkill ? (selectedSkill.id || selectedSkill.skill?.id) : ''}
                          onChange={(e) => {
                            const skill = teachesSkills.find((us: any) => (us.id === e.target.value || us.skill?.id === e.target.value));
                            setSelectedSkill(skill || (e.target.value ? { id: e.target.value, skill: { id: e.target.value, name: e.target.value } } : null));
                          }}
                        >
                          {teachesSkills.length > 0 ? (
                            teachesSkills.map((us: any, uIdx: number) => (
                              <option key={us.id || us.skill?.id || uIdx} value={us.id || us.skill?.id}>
                                {us.skill?.name || us.name || 'Mentoring Skill'}
                              </option>
                            ))
                          ) : (
                            <option value="s-general">General Peer Mentoring</option>
                          )}
                        </select>
                      );
                    })()}
                  </div>

                  {/* Mentor Instant Tutoring Banner */}
                  {bookingPeer.isAvailableNow && (
                    <div className="p-3 rounded-2xl bg-teaching-emerald-container/30 border border-teaching-emerald/40 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-teaching-emerald text-lg">bolt</span>
                        <div>
                          <p className="text-xs font-black text-on-surface">Mentor is Online Right Now</p>
                          <p className="text-[10px] text-on-surface-variant font-medium">Ready for an immediate 1-on-1 drop-in session</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBookingDate(getTodayDateString());
                          setBookingTime(new Date().toTimeString().slice(0, 5));
                        }}
                        className="px-2.5 py-1 bg-teaching-emerald text-on-teaching-emerald rounded-lg text-xs font-bold hover:opacity-90 transition-all cursor-pointer shrink-0"
                      >
                        Set to Now
                      </button>
                    </div>
                  )}

                  {/* Mentor's Open Weekly Slots */}
                  {(() => {
                    const avail = bookingPeer.availability;
                    if (!avail || typeof avail !== 'object') return null;
                    const openSlots = Object.entries(avail).filter(([_, isOpen]) => Boolean(isOpen)).map(([slotKey]) => slotKey);
                    if (openSlots.length === 0) return null;

                    return (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-on-surface">
                          ⚡ Quick Availability Slots (Click to Select)
                        </label>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar p-1">
                          {openSlots.slice(0, 8).map(slot => {
                            const [day, time12] = slot.split('-');
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => {
                                  setBookingDate(getNextDateForDay(day));
                                  setBookingTime(convert12to24(time12));
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-surface-container hover:bg-primary-container hover:text-on-primary-container text-on-surface-variant border border-outline-variant transition-all cursor-pointer flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-xs">schedule</span>
                                <span>{day} {time12}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-1.5">Date</label>
                      <input 
                        type="date" 
                        className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface text-xs font-medium p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-elevation-1"
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-1.5">Time</label>
                      <input 
                        type="time" 
                        className="w-full rounded-xl border border-outline-variant bg-surface text-on-surface text-xs font-medium p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-elevation-1"
                        value={bookingTime}
                        onChange={(e) => setBookingTime(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Price Breakdown Card */}
                  <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs text-on-surface-variant">
                      <span>Base Mentor Rate (1-on-1)</span>
                      <span className="font-semibold text-on-surface-variant/80 line-through">₹{bookingPeer.hourlyRate || 499}</span>
                    </div>
                    {bookingCapacity > 1 && (
                      <div className="flex justify-between items-center text-xs text-teaching-emerald font-semibold">
                        <span>Group Batch Discount ({getCapacityDetails(bookingCapacity).discountPercent}%)</span>
                        <span>-₹{(bookingPeer.hourlyRate || 499) - currentSeatPrice}</span>
                      </div>
                    )}

                    {/* Active Reward Voucher Selection */}
                    {availableVouchers.length > 0 && (
                      <div className="pt-2 border-t border-outline-variant/60 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-on-surface">
                          <span className="flex items-center gap-1 text-primary">
                            <span className="material-symbols-outlined text-sm">confirmation_number</span>
                            Apply Reward Voucher:
                          </span>
                          {selectedVoucher && (
                            <button
                              type="button"
                              onClick={() => setSelectedVoucherId(null)}
                              className="text-[10px] text-alert-rose hover:underline"
                            >
                              Remove Voucher
                            </button>
                          )}
                        </div>
                        <select
                          className="w-full rounded-xl border border-primary/30 bg-surface text-on-surface text-xs font-medium p-2 outline-none shadow-xs"
                          value={selectedVoucherId || ''}
                          onChange={(e) => setSelectedVoucherId(e.target.value || null)}
                        >
                          <option value="">No voucher applied</option>
                          {availableVouchers.map((v: any) => (
                            <option key={v.id} value={v.id}>
                              {v.title} ({v.discountType === 'percent' ? `${v.discountValue}% OFF` : `₹${v.discountValue} OFF`}) • {v.code}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {voucherDiscount > 0 && (
                      <div className="flex justify-between items-center text-xs text-primary font-bold">
                        <span>Voucher Discount ({selectedVoucher?.code})</span>
                        <span>-₹{voucherDiscount}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-xs text-teaching-emerald font-semibold">
                      <span>Upfront Payment Today</span>
                      <span>₹0 (Pay After Class)</span>
                    </div>
                    <div className="pt-2 border-t border-outline-variant flex justify-between items-center text-sm font-bold text-on-surface">
                      <span>Due After Lecture</span>
                      <div className="text-right">
                        <span className="text-primary text-lg font-black">₹{finalSeatPrice}</span>
                        <span className="text-[10px] text-on-surface-variant block font-normal">payable after session</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
                    <Button variant="ghost" onClick={() => setBookingPeer(null)} disabled={isProcessingPayment}>
                      Cancel
                    </Button>
                    <Button 
                      variant="primary" 
                      className="flex items-center gap-1.5 px-5 font-bold"
                      onClick={() => handleReserveBooking()}
                      disabled={isProcessingPayment}
                    >
                      {isProcessingPayment ? (
                        <>
                          <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                          <span>Reserving...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          <span>Reserve Seat (Pay ₹{finalSeatPrice} After Lecture)</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
