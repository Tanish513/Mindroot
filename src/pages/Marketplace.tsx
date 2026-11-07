import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SkillTag } from '../components/ui/SkillTag';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/Skeleton';
import { api, onPeersUpdated, onSessionsUpdated, calculateSeatPrice } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserTimezone, getTimezoneAbbreviation } from '../lib/timezone';
import { MatchFinder } from './MatchFinder';

const categories = ['All Skills', 'Software & AI', 'Design & 3D', 'Languages', 'Business', 'Music & Audio', 'Academics'];

export function Marketplace() {
  const userTz = getUserTimezone();
  const tzAbbr = getTimezoneAbbreviation(userTz);
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('All Skills');
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const initialTab = urlTab === 'swaps' ? 'swaps' : urlTab === 'group_batches' ? 'group_batches' : 'mentors';
  const [activeTab, setActiveTab] = useState<'mentors' | 'group_batches' | 'swaps'>(initialTab);
  const [isGuaranteeExpanded, setIsGuaranteeExpanded] = useState(false);

  const handleTabChange = (tab: 'mentors' | 'group_batches' | 'swaps') => {
    setActiveTab(tab);
    setSearchParams(tab === 'mentors' ? {} : { tab });
  };
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
  const [conflictData, setConflictData] = useState<{
    conflict?: boolean;
    nearestSlot?: string | null;
    nearestSlotFormatted?: string | null;
    noAvailability?: boolean;
    message?: string;
  } | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isSlotAvailable, setIsSlotAvailable] = useState<boolean | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);

  // Quick Join Group Batch State
  const [joiningBatch, setJoiningBatch] = useState<any | null>(null);

  // Real-time pre-flight availability check on date/time/peer change
  useEffect(() => {
    if (!bookingPeer || !bookingDate || !bookingTime) {
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
        const res = await api.checkSlotAvailability(bookingPeer.id, scheduledDate.toISOString(), 60, controller.signal);
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
          setBookingError(`This time slot is already booked for ${bookingPeer.name}.`);
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
  }, [bookingPeer?.id, bookingDate, bookingTime, bookingCapacity]);

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
    if (peer.role === 'admin' || peer.id === 'user-admin') return false;
    if (currentUser && peer.id === currentUser.id) return false;

    const normalizedRole = (peer.role || '').toLowerCase().trim();
    if (normalizedRole !== 'teacher' && normalizedRole !== 'both') {
      return false;
    }

    if (roleFilter === 'teacher' && normalizedRole !== 'teacher') return false;
    if (roleFilter === 'both' && normalizedRole !== 'both') return false;

    if (activeCategory !== 'All Skills') {
      const matchesCategory = Array.isArray(peer.userSkills) && peer.userSkills.some((us: any) => us.skill?.category === activeCategory);
      if (!matchesCategory) return false;
    }

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

  const sortedPeers = [...filteredPeers].sort((a, b) => {
    const aFeat = a.isFeatured ? 1 : 0;
    const bFeat = b.isFeatured ? 1 : 0;
    return bFeat - aFeat;
  });

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

  const handleOpenBooking = (peer: any) => {
    const normRole = (peer?.role || '').toLowerCase().trim();
    if (normRole !== 'teacher' && normRole !== 'both') {
      alert('Cannot book a session with a student profile. Mentoring sessions are only offered by mentors registered as teacher or both.');
      return;
    }
    if (!peer.upiId && !peer.hasUpiConfigured) {
      alert('This mentor has not set up payments yet. Booking is currently unavailable for this mentor.');
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
    setIsSlotAvailable(null);
    setIsCheckingAvailability(false);
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
      const rawSkillName = selectedSkill?.skill?.name || selectedSkill?.name || (bookingPeer.skillsTaught?.[0] || 'General Mentoring');
      const sessionTitle = rawSkillName.toLowerCase().endsWith('mentoring')
        ? rawSkillName
        : `${rawSkillName} Mentoring`;
      const seatPrice = calculateSeatPrice(bookingPeer, bookingCapacity);
      const discount = selectedVoucher
        ? (selectedVoucher.discountType === 'percent'
            ? Math.round(seatPrice * (selectedVoucher.discountValue / 100))
            : Math.min(seatPrice, selectedVoucher.discountValue))
        : 0;
      const finalPrice = Math.max(0, seatPrice - discount);

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
        setBookingError(err.message || `This time slot is already booked for ${bookingPeer.name}.`);
      } else if (err.status === 401 || (err.message && (err.message.includes('Unauthorized') || err.message.includes('authentication token') || err.message.includes('auth token') || err.message.includes('session has expired')))) {
        setBookingError('Your session has expired or requires sign-in. Please sign in to reserve this lecture.');
      } else {
        setBookingError(err.message || 'Booking initiation failed. Please try again.');
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleJoinOpenBatch = async (batch: any) => {
    setJoiningBatch(batch);
    const seatPrice = batch.pricePerStudent || batch.amount || 249;

    try {
      await api.joinGroupSession(batch.id, {
        id: currentUser?.id || 'user-alex',
        name: currentUser?.name || 'Aarav (Student)',
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
    <>
      <div className="max-w-6xl mx-auto space-y-6 select-none">
      {/* Header with Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">Find Peers & Mentors</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-tint text-primary-text border border-primary/20 whitespace-nowrap">
              ₹0 Upfront • Pay After Class
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Connect with verified student peers and mentors for 1-on-1 coaching, group cohorts, or free skill swaps.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex p-1 bg-surface-2 rounded-xl border border-border self-start sm:self-auto overflow-x-auto max-w-full no-scrollbar flex-nowrap">
          <button
            type="button"
            onClick={() => handleTabChange('mentors')}
            className={`whitespace-nowrap shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] sm:min-h-0 ${
              activeTab === 'mentors' 
                ? 'bg-surface text-primary shadow-xs' 
                : 'text-muted hover:text-text'
            }`}
          >
            <span className="material-symbols-outlined text-base">person_search</span>
            <span>All Mentors ({totalEligibleMentors})</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('group_batches')}
            className={`whitespace-nowrap shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] sm:min-h-0 ${
              activeTab === 'group_batches' 
                ? 'bg-surface text-primary shadow-xs' 
                : 'text-muted hover:text-text'
            }`}
          >
            <span className="material-symbols-outlined text-base">groups</span>
            <span>Open Cohorts ({openGroupBatches.length})</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('swaps')}
            className={`whitespace-nowrap shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] sm:min-h-0 ${
              activeTab === 'swaps' 
                ? 'bg-surface text-primary shadow-xs' 
                : 'text-muted hover:text-text'
            }`}
          >
            <span className="material-symbols-outlined text-base">swap_horiz</span>
            <span>Skill Swaps</span>
          </button>
        </div>
      </div>

      {/* Trust Guarantee Banner */}
      {activeTab !== 'swaps' && (
        <div className="bg-primary-tint/50 border border-primary/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-start sm:items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <span className="material-symbols-outlined text-base sm:text-lg">verified_user</span>
          </div>
          <div className="text-[11px] sm:text-xs text-text leading-relaxed flex-1 min-w-0">
            <p className={clsx("sm:block", !isGuaranteeExpanded && "line-clamp-2 sm:line-clamp-none")}>
              <strong className="text-primary-text font-bold">100% Student Guarantee:</strong> Reserve your seat for ₹0 upfront today. You attend the live interactive classroom first, and settle the mentoring fee directly via UPI only after your lecture is completed.
            </p>
            <button
              type="button"
              onClick={() => setIsGuaranteeExpanded(prev => !prev)}
              className="text-[11px] font-bold text-primary sm:hidden mt-0.5 hover:underline cursor-pointer"
            >
              {isGuaranteeExpanded ? 'Read less' : 'Read more'}
            </button>
          </div>
        </div>
      )}

      {/* Controls: Role Filter & Category Bar */}
      {activeTab !== 'swaps' && (
        <div className="space-y-3">
          {activeTab === 'mentors' && (
            <div className="flex items-center gap-2 overflow-x-auto flex-nowrap no-scrollbar pb-0.5 text-xs">
              <span className="font-semibold text-muted flex items-center gap-1 shrink-0">
                <span className="material-symbols-outlined text-sm text-primary">filter_list</span>
                Role:
              </span>
              {[
                { id: 'all', label: 'All Mentors' },
                { id: 'teacher', label: 'Mentors Only' },
                { id: 'both', label: 'Dual Mentors (Teach & Learn)' }
              ].map(rf => (
                <button
                  key={rf.id}
                  onClick={() => setRoleFilter(rf.id as 'all' | 'teacher' | 'both')}
                  className={`whitespace-nowrap shrink-0 px-3 py-1 rounded-lg font-semibold transition-all border cursor-pointer min-h-[36px] sm:min-h-0 flex items-center ${
                    roleFilter === rf.id
                      ? 'bg-primary text-on-primary border-primary shadow-xs'
                      : 'bg-surface text-muted border-border hover:border-primary/40 hover:text-text'
                  }`}
                >
                  {rf.label}
                </button>
              ))}
            </div>
          )}

          {/* Categories Bar */}
          <div className="flex gap-2 overflow-x-auto flex-nowrap no-scrollbar pb-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                  activeCategory === cat 
                    ? 'bg-primary text-on-primary border-primary shadow-xs' 
                    : 'bg-surface text-muted border-border hover:bg-surface-2 hover:text-text'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'mentors' ? (
        /* MENTORS LISTING */
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(k => (
              <SkeletonCard key={k} />
            ))}
          </div>
        ) : filteredPeers.length === 0 ? (
          <EmptyState
            icon="search_off"
            title="No mentors found matching your query"
            description="Try adjusting your search terms or picking another category to explore available peer mentors."
            actionLabel="Reset Category"
            onAction={() => { setActiveCategory('All Skills'); setRoleFilter('all'); }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedPeers.map((peer, i) => {
              const teachesList = (peer.userSkills || []).filter((s: any) => s && s.type === 'teaches');
              const fallbackTeaches = Array.isArray(peer.skillsTaught) ? peer.skillsTaught : [];
              const learnsList = (peer.userSkills || []).filter((s: any) => s && s.type === 'wants_to_learn');
              const fallbackLearns = Array.isArray(peer.skillsLearned) ? peer.skillsLearned : [];

              return (
                <Card 
                  key={peer.id} 
                  variant="interactive" 
                  className={`flex flex-col h-full justify-between p-3.5 sm:p-5 space-y-3 sm:space-y-4 ${
                    peer.isFeatured ? 'ring-2 ring-accent/60 border-accent/40' : ''
                  }`}
                >
                  <div className="space-y-3 sm:space-y-4">
                    {/* Header: Avatar, Name, Trust & Hourly Rate */}
                    <div className="flex justify-between items-start gap-2.5 sm:gap-3">
                      <div className="flex gap-2.5 sm:gap-3 items-center min-w-0">
                        <div className="relative shrink-0">
                          <img 
                            src={peer.avatar || `https://i.pravatar.cc/150?img=${i + 10}`} 
                            alt={`${peer.name}'s avatar`} 
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover border border-border" 
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-primary rounded-full ring-2 ring-surface" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-text truncate flex items-center gap-1">
                            <span className="truncate">{peer.name}</span>
                            {peer.trustScore > 4.8 && (
                              <span className="material-symbols-outlined text-primary text-[15px] shrink-0 inline-flex items-center" title="High Trust Peer">verified</span>
                            )}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-xs font-medium text-muted capitalize">{peer.role}</span>
                            {peer.isFeatured && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-accent-tint text-accent-text border border-accent/30 text-xs font-bold uppercase tracking-wider">
                                <span className="material-symbols-outlined text-xs">star</span>
                                Featured
                              </span>
                            )}
                            {peer.isAvailableNow && (
                              <StatusBadge status="live" label="Live Now" />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-base font-extrabold text-primary">
                          ₹{peer.hourlyRate || 499}
                          <span className="text-xs font-normal text-muted">/hr</span>
                        </div>
                        <span className="text-xs text-muted block font-medium">Post-class pay</span>
                      </div>
                    </div>

                    {/* Bio Snippet if present */}
                    {peer.bio && (
                      <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                        {peer.bio}
                      </p>
                    )}

                    {/* Dual-Sided Skill Tags: Teaches & Learns */}
                    <div className="space-y-2.5 pt-1">
                      <div>
                        <span className="text-xs font-bold text-primary-text tracking-wider uppercase block mb-1">
                          Teaches
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {teachesList.length > 0 ? (
                            teachesList.slice(0, 3).map((s: any, idx: number) => (
                              <SkillTag key={s.id || idx} label={s.skill?.name || s.name || 'Skill'} type="teaching" size="sm" />
                            ))
                          ) : fallbackTeaches.length > 0 ? (
                            fallbackTeaches.slice(0, 3).map((t: string, idx: number) => (
                              <SkillTag key={idx} label={t} type="teaching" size="sm" />
                            ))
                          ) : (
                            <span className="text-xs text-muted italic">General Mentoring</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-bold text-accent-text tracking-wider uppercase block mb-1">
                          Learning
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {learnsList.length > 0 ? (
                            learnsList.slice(0, 3).map((s: any, idx: number) => (
                              <SkillTag key={s.id || idx} label={s.skill?.name || s.name || 'Skill'} type="learning" size="sm" />
                            ))
                          ) : fallbackLearns.length > 0 ? (
                            fallbackLearns.slice(0, 3).map((l: string, idx: number) => (
                              <SkillTag key={idx} label={l} type="learning" size="sm" />
                            ))
                          ) : (
                            <span className="text-xs text-muted italic">Open to topics</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Group Discount Pill */}
                    <div className="p-2.5 bg-surface-2 border border-border rounded-xl text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium text-text">
                        <span className="material-symbols-outlined text-base text-primary">groups</span>
                        Group Cohort:
                      </span>
                      <span className="text-primary font-bold text-xs">
                        From ₹{calculateSeatPrice(peer, 5)}/seat
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-border">
                    {(!peer.upiId && !peer.hasUpiConfigured) ? (
                      <>
                        {/* Mobile: Full-width Chat with subtitle badge */}
                        <div className="flex sm:hidden flex-col w-full gap-1.5">
                          <Button 
                            variant="primary" 
                            className="w-full text-xs py-2.5 min-h-[44px]"
                            onClick={() => navigate(`/messages?peerId=${peer.id}`, { state: { peerId: peer.id } })}
                          >
                            Chat with Mentor
                          </Button>
                          <div className="flex items-center justify-center gap-1 text-[11px] text-muted font-medium text-center">
                            <span className="material-symbols-outlined text-xs">info</span>
                            <span>Payments Not Set Up • Booking unavailable</span>
                          </div>
                        </div>

                        {/* Desktop: Exact existing buttons preserved */}
                        <div className="hidden sm:flex gap-2">
                          <Button 
                            variant="secondary" 
                            className="flex-1 text-xs py-2"
                            onClick={() => navigate(`/messages?peerId=${peer.id}`, { state: { peerId: peer.id } })}
                          >
                            Chat
                          </Button>
                          <Button
                            variant="secondary"
                            disabled
                            className="flex-1 text-xs py-2 opacity-60 cursor-not-allowed"
                          >
                            Payments Not Set Up
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary" 
                          className="flex-1 text-xs py-2 min-h-[44px] sm:min-h-0"
                          onClick={() => navigate(`/messages?peerId=${peer.id}`, { state: { peerId: peer.id } })}
                        >
                          Chat
                        </Button>
                        <Button 
                          variant="primary" 
                          className="flex-1 text-xs py-2 flex items-center justify-center gap-1 min-h-[44px] sm:min-h-0"
                          onClick={() => handleOpenBooking(peer)}
                        >
                          <span className="material-symbols-outlined text-sm">calendar_month</span>
                          Book Lecture
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : activeTab === 'group_batches' ? (
        /* OPEN GROUP BATCHES LISTING */
        <div className="space-y-4">
          {openGroupBatches.length === 0 ? (
            <EmptyState
              icon="groups"
              title="No Open Group Cohorts Right Now"
              description="Be the first to start a group cohort! Choose a mentor above, select a 3-Student or 5-Student Batch, and invite peers to join your batch (Pay ₹0 upfront, pay after lecture)."
              actionLabel="Browse Mentors"
              onAction={() => setActiveTab('mentors')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {openGroupBatches.map(batch => {
                const enrolledCount = Array.isArray(batch.students) ? batch.students.length : (batch.studentId ? 1 : 0);
                const maxCap = batch.maxCapacity || 5;
                const seatsLeft = maxCap - enrolledCount;
                const isEnrolled = currentUser && Array.isArray(batch.students) && batch.students.some((st: any) => st.id === currentUser.id);

                return (
                  <Card key={batch.id} className="p-5 space-y-4">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-tint text-primary-text border border-primary/20">
                            {maxCap}-Student Cohort
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-text mt-1">{batch.title}</h3>
                        <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                          <span>Mentor:</span>
                          <strong className="text-text">{batch.teacher?.name || 'Mentor'}</strong>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-primary">₹{batch.pricePerStudent || batch.amount || 249}</div>
                        <div className="text-xs text-muted font-medium">per seat • pay later</div>
                      </div>
                    </div>

                    {/* Progress Bar & Seat Count */}
                    <div className="space-y-2 p-3 bg-surface-2 border border-border rounded-xl">
                      <div className="flex justify-between text-xs font-semibold text-text">
                        <span>{enrolledCount} of {maxCap} Students Joined</span>
                        <span className="text-primary font-bold">
                          {seatsLeft > 0 ? `${seatsLeft} Seat${seatsLeft > 1 ? 's' : ''} Left` : 'Cohort Full'}
                        </span>
                      </div>
                      <div className="w-full bg-surface h-2 rounded-full overflow-hidden border border-border">
                        <div 
                          className="bg-primary h-full rounded-full transition-all duration-300"
                          style={{ width: `${(enrolledCount / maxCap) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Schedule and Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                      <div className="text-muted font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">schedule</span>
                        <span>{batch.scheduledAt ? new Date(batch.scheduledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Scheduled Soon'}</span>
                      </div>

                      {isEnrolled ? (
                        <Button
                          variant="primary"
                          onClick={() => navigate(`/live/${batch.id}`)}
                          className="text-xs py-1.5 px-3 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">videocam</span>
                          <span>Join Classroom</span>
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={() => handleJoinOpenBatch(batch)}
                          disabled={joiningBatch?.id === batch.id}
                          className="text-xs py-1.5 px-4 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">how_to_reg</span>
                          <span>Join Batch (Pay ₹{batch.pricePerStudent || batch.amount || 249} Later)</span>
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* SKILL SWAPS TAB (MUTUAL MATCHES & PROPOSALS) */
        <MatchFinder embedded={true} />
      )}

      {/* Booking Modal with Student Choice (Pay After Lecture) */}
      </div>

      <AnimatePresence>
        {bookingPeer && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-surface border border-border rounded-2xl w-full max-w-lg p-6 shadow-xl relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => setBookingPeer(null)}
                aria-label="Close booking modal"
                className="absolute right-4 top-4 text-muted hover:text-text hover:bg-surface-2 rounded-xl p-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary-tint text-primary-text flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-xl">school</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text">Book Mentoring Lecture</h3>
                  <p className="text-xs text-muted">With <strong className="text-text">{bookingPeer.name}</strong> • Pay After Class</p>
                </div>
              </div>

              {bookingSuccess ? (
                <div className="space-y-4 pt-2">
                  <div className="bg-primary-tint border border-primary/20 text-primary-text rounded-xl p-4 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-sm text-primary-text">
                      <span className="material-symbols-outlined text-base">verified</span>
                      Lecture Reserved Successfully!
                    </div>
                    <p className="text-primary-text/90 leading-relaxed">
                      Your <strong>{confirmedSession?.maxCapacity ? (confirmedSession.maxCapacity > 1 ? `${confirmedSession.maxCapacity}-Student Cohort` : '1-on-1 Private') : (bookingCapacity > 1 ? `${bookingCapacity}-Student Cohort` : '1-on-1 Private')}</strong> lecture with <strong>{bookingPeer.name}</strong> is confirmed.
                    </p>
                    <div className="mt-2 p-3 bg-surface rounded-lg border border-primary/20 flex items-center justify-between font-bold text-text">
                      <span>Due After Lecture:</span>
                      <span className="text-primary text-base font-extrabold">₹{currentSeatPrice}</span>
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
                <div className="space-y-4">
                  {bookingError && (
                    <div className="bg-danger/10 border border-danger/30 text-danger rounded-xl p-3 text-xs flex items-center gap-2">
                      <span className="material-symbols-outlined text-base shrink-0">error</span>
                      <span>{bookingError}</span>
                    </div>
                  )}

                  {conflictData && conflictData.nearestSlot && (
                    <div className="bg-accent-tint border border-accent/20 rounded-xl p-3.5 space-y-2 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-accent-text">
                        <span className="material-symbols-outlined text-accent text-base">schedule</span>
                        <span>Requested slot booked! Nearest available slot:</span>
                      </div>
                      <p className="text-accent-text/90">
                        Nearest open slot: <strong className="text-accent-text">{conflictData.nearestSlotFormatted}</strong>
                      </p>
                      <button
                        type="button"
                        onClick={() => handleReserveBooking(conflictData.nearestSlot || undefined)}
                        className="w-full py-2 bg-accent hover:bg-accent/90 text-on-primary font-bold rounded-xl text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">event_available</span>
                        <span>Book Nearest Slot</span>
                      </button>
                    </div>
                  )}

                  {/* Lecture Format & Capacity */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-text">Choose Lecture Format</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { cap: 1, label: '1-on-1', icon: 'person' },
                        { cap: 2, label: 'Duo (2)', icon: 'group' },
                        { cap: 3, label: 'Trio (3)', icon: 'groups' },
                        { cap: 4, label: 'Quad (4)', icon: 'diversity_3' },
                        { cap: 5, label: 'Batch (5)', icon: 'school' }
                      ].map(item => {
                        const price = calculateSeatPrice(bookingPeer, item.cap);
                        const isSelected = bookingCapacity === item.cap;

                        return (
                          <button
                            key={item.cap}
                            type="button"
                            onClick={() => setBookingCapacity(item.cap)}
                            className={`p-2 rounded-xl border flex flex-col items-center justify-between text-center transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-primary-tint border-primary text-primary-text shadow-xs ring-2 ring-primary/20' 
                                : 'bg-surface-2 border-border text-muted hover:bg-surface'
                            }`}
                          >
                            <span className="material-symbols-outlined text-lg">{item.icon}</span>
                            <span className="text-xs font-bold mt-0.5">{item.label}</span>
                            <span className={`text-xs font-extrabold mt-1 ${isSelected ? 'text-primary' : 'text-text'}`}>
                              ₹{price}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Topic / Skill Selection */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-text">Topic / Skill</label>
                    {(() => {
                      const peerSkills = Array.isArray(bookingPeer.userSkills) && bookingPeer.userSkills.length > 0
                        ? bookingPeer.userSkills
                        : (Array.isArray(bookingPeer.skillsTaught) ? bookingPeer.skillsTaught.map((t: string) => ({ id: 's-' + t, type: 'teaches', skill: { id: 's-' + t, name: t } })) : []);
                      const teachesSkills = peerSkills.filter((us: any) => us && us.type === 'teaches');

                      return (
                        <select 
                          className="w-full rounded-xl border border-border bg-surface text-text text-xs font-medium p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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

                  {/* Quick Availability Slots */}
                  {bookingPeer?.availability && Object.keys(bookingPeer.availability).filter(k => bookingPeer.availability[k]).length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-text">
                          ⚡ Quick Availability Slots (Click to Select)
                        </label>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary-tint text-primary-text border border-primary/20">
                          {tzAbbr} ({userTz})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar p-1">
                        {Object.keys(bookingPeer.availability)
                          .filter(k => bookingPeer.availability[k])
                          .slice(0, 8)
                          .map(slot => {
                            const [day, time12] = slot.split('-');
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => {
                                  const today = new Date();
                                  const daysMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
                                  const targetDay = daysMap[day] ?? 1;
                                  const currentDay = today.getDay();
                                  let diff = targetDay - currentDay;
                                  if (diff <= 0) diff += 7;
                                  const targetDate = new Date(today);
                                  targetDate.setDate(today.getDate() + diff);
                                  const dateStr = targetDate.toISOString().slice(0, 10);
                                  setBookingDate(dateStr);
                                  
                                  if (time12) {
                                    const match = time12.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                                    if (match) {
                                      let h = parseInt(match[1], 10);
                                      const m = match[2];
                                      const isPM = match[3].toUpperCase() === 'PM';
                                      if (isPM && h < 12) h += 12;
                                      if (!isPM && h === 12) h = 0;
                                      setBookingTime(`${String(h).padStart(2, '0')}:${m}`);
                                    }
                                  }
                                  setConflictData(null);
                                  setBookingError('');
                                  setIsSlotAvailable(null);
                                }}
                                className="px-2 py-1 text-xs font-semibold bg-surface-2 hover:bg-primary-tint hover:text-primary-text rounded-lg border border-border text-muted transition-colors cursor-pointer"
                              >
                                {day} {time12}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Date & Time Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-text">Date</label>
                      <input 
                        type="date" 
                        className="w-full rounded-xl border border-border bg-surface text-text text-xs font-medium p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        value={bookingDate}
                        onChange={(e) => {
                          setBookingDate(e.target.value);
                          setConflictData(null);
                          setBookingError('');
                          setIsSlotAvailable(null);
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-text flex items-center justify-between">
                        <span>Time</span>
                        <span className="text-xs font-bold text-muted px-1.5 py-0.5 rounded bg-surface-2 border border-border">{tzAbbr}</span>
                      </label>
                      <input 
                        type="time" 
                        className="w-full rounded-xl border border-border bg-surface text-text text-xs font-medium p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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

                  {/* Price Breakdown */}
                  <div className="bg-surface-2 border border-border rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-muted">
                      <span>Base Rate</span>
                      <span className="font-semibold text-text">₹{bookingPeer.hourlyRate || 499}</span>
                    </div>
                    {bookingCapacity > 1 && (
                      <div className="flex justify-between items-center text-primary font-semibold">
                        <span>Cohort Discount</span>
                        <span>-₹{(bookingPeer.hourlyRate || 499) - currentSeatPrice}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-primary font-semibold">
                      <span>Upfront Payment</span>
                      <span>₹0 (Pay After Class)</span>
                    </div>
                    <div className="pt-2 border-t border-border flex justify-between items-center font-bold text-text">
                      <span>Total Due Post-Class:</span>
                      <span className="text-primary text-base font-extrabold">₹{finalSeatPrice}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-border">
                    <Button variant="ghost" onClick={() => setBookingPeer(null)} disabled={isProcessingPayment}>
                      Cancel
                    </Button>
                    <Button 
                      variant="primary" 
                      onClick={() => handleReserveBooking()}
                      disabled={isProcessingPayment || isCheckingAvailability || isSlotAvailable === false || Boolean(conflictData?.conflict)}
                    >
                      {isProcessingPayment ? 'Reserving...' : `Reserve (Pay ₹${finalSeatPrice} Later)`}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
