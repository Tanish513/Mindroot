import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { api, onPeersUpdated, onSessionsUpdated } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { useDebounce } from '../hooks/useDebounce';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

const categories = ['All', 'Software & AI', 'Design & 3D', 'Languages', 'Business'];

export function MatchFinder() {
  const navigate = useNavigate();
  const [peers, setPeers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeMainTab, setActiveMainTab] = useState<'matches' | 'swaps'>('matches');
  
  const searchQuery = useAppStore(state => state.searchQuery);
  const currentUser = useAppStore(state => state.currentUser);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Action status / feedback
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Exchange Proposal Modal State
  const [proposalPeer, setProposalPeer] = useState<any | null>(null);
  const [giveSkill, setGiveSkill] = useState<any | null>(null);
  const [takeSkill, setTakeSkill] = useState<any | null>(null);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState('');
  const [proposalCapacity, setProposalCapacity] = useState<number>(1);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [conflictData, setConflictData] = useState<{ nearestSlot: string; nearestSlotFormatted: string } | null>(null);

  const loadSessionsData = () => {
    api.getSessions().then(data => {
      setSessions(Array.isArray(data) ? data : []);
    }).catch(console.error);
  };

  useEffect(() => {
    let mounted = true;
    const loadPeers = () => {
      api.getPeers().then(data => {
        if (mounted) {
          setPeers(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      }).catch(console.error);
    };

    loadPeers();
    loadSessionsData();

    const unsubPeers = onPeersUpdated(loadPeers);
    const unsubSessions = onSessionsUpdated(loadSessionsData);

    return () => {
      mounted = false;
      unsubPeers();
      unsubSessions();
    };
  }, []);

  const getMatchScore = (peer: any) => {
    if (!currentUser || !peer) return 50;

    const myUserSkills = currentUser.userSkills || [
      ...(currentUser.skillsTaught || []).map((t: string) => ({ type: 'teaches', skill: { id: 's-' + t, name: t } })),
      ...(currentUser.skillsLearned || []).map((l: string) => ({ type: 'wants_to_learn', skill: { id: 's-' + l, name: l } }))
    ];
    const peerUserSkills = peer.userSkills || [
      ...(peer.skillsTaught || []).map((t: string) => ({ type: 'teaches', skill: { id: 's-' + t, name: t } })),
      ...(peer.skillsLearned || []).map((l: string) => ({ type: 'wants_to_learn', skill: { id: 's-' + l, name: l } }))
    ];

    if (!myUserSkills.length || !peerUserSkills.length) return 50;

    const myTeaches = myUserSkills.filter((us: any) => us.type === 'teaches');
    const myLearns = myUserSkills.filter((us: any) => us.type === 'wants_to_learn');
    const peerTeaches = peerUserSkills.filter((us: any) => us.type === 'teaches');
    const peerLearns = peerUserSkills.filter((us: any) => us.type === 'wants_to_learn');

    // Count skills the peer teaches that I want to learn
    const takeMatches = peerTeaches.filter((pt: any) =>
      myLearns.some((al: any) =>
        (pt.skill?.id && al.skill?.id && pt.skill.id === al.skill.id) ||
        (pt.skill?.name && al.skill?.name && pt.skill.name.toLowerCase() === al.skill.name.toLowerCase())
      )
    ).length;

    // Count skills I teach that the peer wants to learn
    const giveMatches = myTeaches.filter((at: any) =>
      peerLearns.some((pl: any) =>
        (at.skill?.id && pl.skill?.id && at.skill.id === pl.skill.id) ||
        (at.skill?.name && pl.skill?.name && at.skill.name.toLowerCase() === pl.skill.name.toLowerCase())
      )
    ).length;

    const totalMatches = takeMatches + giveMatches;
    if (totalMatches === 0) return 50;

    const maxPossibleMatches = Math.max(1, Math.min(myLearns.length + myTeaches.length, peerTeaches.length + peerLearns.length));
    const ratio = totalMatches / maxPossibleMatches;
    const score = Math.round(50 + ratio * 49);
    return Math.min(Math.max(score, 50), 99);
  };

  const handleOpenProposal = (peer: any) => {
    setProposalPeer(peer);
    
    // Skill to give: peer's wanted skill that Alex teaches
    const AlexTeaches = (currentUser?.userSkills || []).filter((us: any) => us && us.type === 'teaches');
    const peerLearns = (peer.userSkills || []).filter((us: any) => us && us.type === 'wants_to_learn');
    const giveMatch = AlexTeaches.find((at: any) => peerLearns.some((pl: any) => pl.skill?.id === at.skill?.id || pl.skill?.name === at.skill?.name));
    setGiveSkill(giveMatch || AlexTeaches[0] || null);

    // Skill to take: peer's taught skill that Alex wants
    const AlexLearns = (currentUser?.userSkills || []).filter((us: any) => us && us.type === 'wants_to_learn');
    const peerTeaches = (peer.userSkills || []).filter((us: any) => us && us.type === 'teaches');
    const takeMatch = peerTeaches.find((pt: any) => AlexLearns.some((al: any) => al.skill?.id === pt.skill?.id || al.skill?.name === pt.skill?.name));
    setTakeSkill(takeMatch || peerTeaches[0] || null);

    setProposedDate('');
    setProposedTime('');
    setProposalCapacity(1);
    setSuccessMsg('');
    setErrorMsg('');
    setConflictData(null);
  };

  const handleSendProposal = async (overrideSlotISO?: string) => {
    if (!proposalPeer || !currentUser) return;
    if (!overrideSlotISO && (!proposedDate || !proposedTime)) {
      setErrorMsg('Please select a date and time.');
      return;
    }

    const scheduledAt = overrideSlotISO ? new Date(overrideSlotISO) : new Date(`${proposedDate}T${proposedTime}`);
    if (isNaN(scheduledAt.getTime())) {
      setErrorMsg('Invalid date/time.');
      return;
    }

    try {
      setErrorMsg('');
      setConflictData(null);
      const isGroup = proposalCapacity > 1;
      const titleSuffix = isGroup ? ` (${proposalCapacity}-Student Cohort)` : '';
      const giveSkillName = giveSkill ? (giveSkill.skill?.name || giveSkill.name) : 'Coding';
      const takeSkillName = takeSkill ? (takeSkill.skill?.name || takeSkill.name) : 'Skill';

      await api.postSession({
        title: `${giveSkillName} ↔ ${takeSkillName}${titleSuffix}`,
        teacherId: proposalPeer.id,
        studentId: currentUser.id,
        proposerId: currentUser.id,
        isSwap: true,
        giveSkill: giveSkillName,
        takeSkill: takeSkillName,
        skillId: takeSkill ? (takeSkill.skill?.id || takeSkill.id) : undefined,
        scheduledAt: scheduledAt.toISOString(),
        durationMin: 60,
        maxCapacity: proposalCapacity
      });
      setSuccessMsg(`Swap proposal sent to ${proposalPeer.name}! You can track it under "My Swaps".`);
      setErrorMsg('');
      loadSessionsData();
      setTimeout(() => {
        setProposalPeer(null);
      }, 2000);
    } catch (err: any) {
      if (err.conflict && err.nearestSlot) {
        setConflictData({
          nearestSlot: err.nearestSlot,
          nearestSlotFormatted: err.nearestSlotFormatted || new Date(err.nearestSlot).toLocaleString()
        });
        setErrorMsg(err.message || 'Requested time slot is already booked.');
      } else {
        setErrorMsg(err.message || 'Failed to submit proposal');
      }
    }
  };

  // Swap Actions
  const handleAcceptSwap = async (sessionId: string) => {
    try {
      setActionLoadingId(sessionId);
      await api.acceptSwap(sessionId);
      setFeedbackNotice({ type: 'success', message: 'Swap offer accepted! The session is now confirmed on your schedule.' });
      loadSessionsData();
    } catch (err: any) {
      setFeedbackNotice({ type: 'error', message: err.message || 'Failed to accept swap offer.' });
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setFeedbackNotice(null), 4000);
    }
  };

  const handleDeclineSwap = async (sessionId: string) => {
    try {
      setActionLoadingId(sessionId);
      await api.declineSwap(sessionId);
      setFeedbackNotice({ type: 'success', message: 'Swap offer declined.' });
      loadSessionsData();
    } catch (err: any) {
      setFeedbackNotice({ type: 'error', message: err.message || 'Failed to decline swap offer.' });
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setFeedbackNotice(null), 4000);
    }
  };

  const handleCancelSwap = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to withdraw this swap proposal?')) return;
    try {
      setActionLoadingId(sessionId);
      await api.cancelSwap(sessionId);
      setFeedbackNotice({ type: 'success', message: 'Swap request withdrawn successfully.' });
      loadSessionsData();
    } catch (err: any) {
      setFeedbackNotice({ type: 'error', message: err.message || 'Failed to cancel swap request.' });
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setFeedbackNotice(null), 4000);
    }
  };

  // Calendar Helpers
  const getGoogleCalendarUrl = (session: any) => {
    const title = encodeURIComponent(session.title || 'Mindroot Skill Swap Session');
    const start = session.scheduledAt ? new Date(session.scheduledAt) : new Date();
    const durationMin = session.durationMin || 60;
    const end = new Date(start.getTime() + durationMin * 60000);
    const formatTime = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const dates = `${formatTime(start)}/${formatTime(end)}`;
    const details = encodeURIComponent(`Mindroot Skill Swap: ${session.title}.\nClassroom link: ${window.location.origin}/live/${session.id}`);
    const location = encodeURIComponent(`${window.location.origin}/live/${session.id}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  };

  const isSessionLiveNow = (scheduledAt?: string) => {
    if (!scheduledAt) return false;
    const diffMin = Math.round((new Date(scheduledAt).getTime() - Date.now()) / 60000);
    return diffMin <= 15 && diffMin >= -60;
  };

  // Swaps partitioning logic
  const isSwapSession = (s: any) => Boolean(s && (s.isSwap || (s.title && s.title.includes('↔')) || s.paymentStatus === 'swap'));

  const mySwaps = sessions.filter(s => {
    if (!currentUser || !isSwapSession(s)) return false;
    const isTeacher = s.teacherId === currentUser.id || s.teacher?.id === currentUser.id;
    const isStudent = s.studentId === currentUser.id || s.student?.id === currentUser.id;
    const isInCohort = Array.isArray(s.students) && s.students.some((st: any) => st.id === currentUser.id);
    return isTeacher || isStudent || isInCohort;
  });

  // 1. Incoming Offers: Received swap requests where currentUser is the recipient and status is 'pending'
  const incomingOffers = mySwaps.filter(s => {
    if (s.status !== 'pending') return false;
    if (s.proposerId) {
      return s.proposerId !== currentUser?.id;
    }
    return s.teacherId === currentUser?.id;
  });

  // 2. Sent Requests: Outgoing swap requests sent by currentUser where status is 'pending'
  const sentRequests = mySwaps.filter(s => {
    if (s.status !== 'pending') return false;
    if (s.proposerId) {
      return s.proposerId === currentUser?.id;
    }
    return s.studentId === currentUser?.id;
  });

  // 3. Active / Confirmed Swaps
  const activeSwaps = mySwaps.filter(s => s.status === 'confirmed' || s.status === 'live');

  // Helper to extract reciprocal skills & peer info
  const getSwapSkillDetails = (session: any) => {
    let teachA = session.giveSkill;
    let teachB = session.takeSkill;
    if (!teachA || !teachB) {
      const cleanTitle = (session.title || '').replace(/\(.*?\)/g, '');
      const parts = cleanTitle.split('↔').map((p: string) => p.trim());
      teachA = teachA || parts[0] || 'Skill';
      teachB = teachB || parts[1] || 'Skill';
    }

    const isProposer = session.proposerId ? session.proposerId === currentUser?.id : session.studentId === currentUser?.id;
    const peerUser = session.teacherId === currentUser?.id ? session.student : session.teacher;
    const peerName = peerUser?.name || 'Peer';

    // If I proposed: I teach teachA, Peer teaches teachB
    // If I received: Peer teaches teachA, I teach teachB
    const iTeach = isProposer ? teachA : teachB;
    const peerTeaches = isProposer ? teachB : teachA;

    return {
      peerName,
      peerAvatar: peerUser?.avatar || `https://i.pravatar.cc/150?u=${peerUser?.id || session.id}`,
      peerTrustScore: peerUser?.trustScore || 5.0,
      peerId: peerUser?.id || (session.teacherId === currentUser?.id ? session.studentId : session.teacherId),
      iTeach,
      peerTeaches
    };
  };

  const filteredPeers = peers.filter(peer => {
    // Exclude platform admin and current user
    if (peer.role === 'admin' || peer.id === 'user-admin' || (currentUser && peer.id === currentUser.id)) return false;

    // Category filter
    if (selectedCategory !== 'All') {
      const matchCat = Array.isArray(peer.userSkills) && peer.userSkills.some((us: any) => us.skill?.category === selectedCategory);
      if (!matchCat) return false;
    }

    // Search query filter
    if (debouncedSearchQuery.trim() !== '') {
      const query = debouncedSearchQuery.toLowerCase();
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

  return (
    <div className="max-w-container_max mx-auto relative select-none">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-headline-lg font-headline-lg text-on-surface mb-1">Skill Exchange & Match Finder</h2>
          <p className="text-body-md font-body-md text-on-surface-variant">Trade skills 1-for-1 with peers, accept swap proposals, and track your exchange requests.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-surface-container rounded-2xl border border-outline-variant shadow-xs self-start sm:self-auto">
          <button
            onClick={() => setActiveMainTab('matches')}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
              activeMainTab === 'matches'
                ? "bg-surface text-primary shadow-elevation-1"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            <span className="material-symbols-outlined text-base">group</span>
            <span>Explore Matches</span>
          </button>

          <button
            onClick={() => setActiveMainTab('swaps')}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all relative",
              activeMainTab === 'swaps'
                ? "bg-surface text-primary shadow-elevation-1"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            <span className="material-symbols-outlined text-base">swap_horiz</span>
            <span>My Swaps</span>
            {incomingOffers.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-alert-rose text-white shadow-xs animate-pulse">
                {incomingOffers.length}
              </span>
            )}
            {activeSwaps.length > 0 && incomingOffers.length === 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20">
                {activeSwaps.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedbackNotice && (
        <div className={clsx(
          "mb-6 p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-elevation-1 animate-in fade-in duration-200",
          feedbackNotice.type === 'success'
            ? "bg-teaching-emerald-container border-teaching-emerald/30 text-on-teaching-emerald-container"
            : "bg-alert-rose-container border-alert-rose/30 text-on-alert-rose-container"
        )}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">
              {feedbackNotice.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{feedbackNotice.message}</span>
          </div>
          <button onClick={() => setFeedbackNotice(null)} className="text-current opacity-70 hover:opacity-100">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* VIEW 1: EXPLORE MATCHES */}
      {activeMainTab === 'matches' && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-3 mb-6 custom-scrollbar">
            {categories.map(cat => (
              <button 
                key={cat} 
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  selectedCategory === cat 
                    ? 'bg-primary text-on-primary border-primary shadow-elevation-1' 
                    : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container hover:text-on-surface'
                }`} 
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center text-on-surface-variant py-12 font-semibold text-xs animate-pulse">Finding your best matches...</div>
          ) : (
            <div className="space-y-4">
              {filteredPeers.length === 0 && searchQuery.trim() !== '' && (
                <div className="flex flex-col md:flex-row items-start md:items-center gap-5 p-5 bg-surface rounded-xl border border-outline-variant shadow-elevation-1">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-lg shadow-elevation-1">
                      {searchQuery.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-teaching-emerald rounded-full ring-2 ring-surface" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                      <h4 className="text-sm font-bold text-on-surface">Peer Match for "{searchQuery}"</h4>
                      <span className="px-2 py-0.5 bg-primary-container text-on-primary-container rounded text-[10px] font-bold">
                        99% MATCH
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Offers to teach: <strong className="text-on-surface font-semibold">{searchQuery}</strong>
                      <br />
                      Status: <strong className="text-teaching-emerald font-semibold">Available for Exchange</strong>
                    </p>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
                    <Button 
                      variant="primary" 
                      className="font-semibold text-xs py-2 px-4 flex items-center gap-1 shadow-elevation-1" 
                      onClick={() => navigate(`/live/${encodeURIComponent(searchQuery.toLowerCase().replace(/\s+/g, '-'))}`)}
                    >
                      <span className="material-symbols-outlined text-sm">videocam</span>
                      Join Session
                    </Button>
                  </div>
                </div>
              )}

              {filteredPeers.length === 0 && searchQuery.trim() === '' && (
                <div className="text-on-surface-variant p-12 text-center border border-dashed border-outline rounded-2xl bg-surface shadow-elevation-1">
                  <span className="material-symbols-outlined text-4xl mb-2 text-outline">search_off</span>
                  <p className="font-bold text-on-surface text-sm">No matched peers found</p>
                  <p className="text-xs text-on-surface-variant mt-1">Try updating your learning skills in your profile to discover more matches.</p>
                </div>
              )}

              {filteredPeers.map((peer) => {
                const matchScore = getMatchScore(peer);
                const teaches = (peer.userSkills || []).filter((s: any) => s && s.type === 'teaches').map((s: any) => s.skill?.name || 'Skill');
                const learns = (peer.userSkills || []).filter((s: any) => s && s.type === 'wants_to_learn').map((s: any) => s.skill?.name || 'Skill');

                return (
                  <div 
                    key={peer.id} 
                    className="flex flex-col md:flex-row items-start md:items-center gap-5 p-5 bg-surface rounded-xl border border-outline-variant shadow-elevation-1 hover:border-outline hover:shadow-elevation-2 transition-all group"
                  >
                    <div className="relative shrink-0">
                      <img src={peer.avatar || `https://i.pravatar.cc/150?u=${peer.id}`} alt={`${peer.name}'s avatar`} className="w-12 h-12 rounded-full object-cover border border-outline-variant" />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-teaching-emerald rounded-full ring-2 ring-surface" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                        <h4 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{peer.name}</h4>
                        <span className="px-2 py-0.5 bg-primary-container text-on-primary-container rounded-md text-[10px] font-bold">
                          {matchScore}% MATCH
                        </span>
                        {peer.trustScore > 4.8 && (
                          <span className="material-symbols-outlined text-primary text-sm">verified</span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant mb-2 leading-relaxed">
                        {teaches.length > 0 && <>Teaches: <strong className="text-on-surface font-semibold">{teaches.join(', ')}</strong></>}
                        {teaches.length > 0 && learns.length > 0 && <span className="mx-1.5 text-outline">•</span>}
                        {learns.length > 0 && <>Wants: <strong className="text-on-surface font-semibold">{learns.join(', ')}</strong></>}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 bg-surface-container-low border border-outline-variant rounded-md text-[11px] font-semibold text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-learning-amber text-xs">star</span>
                          {peer.trustScore.toFixed(2)} Rating
                        </span>
                        <span className="px-2.5 py-0.5 bg-teaching-emerald-container border border-teaching-emerald/20 rounded-md text-[11px] font-semibold text-on-teaching-emerald-container flex items-center gap-1">
                          <span className="material-symbols-outlined text-teaching-emerald text-xs">swap_horiz</span>
                          Free Skill Swap Available
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto shrink-0 self-stretch md:self-center justify-end">
                      <Button 
                        variant="secondary" 
                        className="font-semibold text-xs py-1.5 px-4"
                        onClick={() => navigate(`/messages?peerId=${peer.id}`, { state: { peerId: peer.id } })}
                      >
                        Chat
                      </Button>
                      <Button variant="primary" className="font-semibold text-xs py-1.5 px-4 flex items-center gap-1.5" onClick={() => handleOpenProposal(peer)}>
                        <span className="material-symbols-outlined text-sm">swap_horiz</span>
                        <span>Propose Swap</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* VIEW 2: MY SWAPS HUB */}
      {activeMainTab === 'swaps' && (
        <div className="space-y-8">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface border border-outline-variant rounded-2xl p-4 shadow-elevation-1 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-on-surface-variant">Incoming Offers</p>
                <p className="text-2xl font-black text-on-surface mt-0.5">{incomingOffers.length}</p>
                <p className="text-[11px] text-learning-amber font-semibold mt-1">Requires your decision</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-learning-amber-container text-on-learning-amber-container flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">inbox</span>
              </div>
            </div>

            <div className="bg-surface border border-outline-variant rounded-2xl p-4 shadow-elevation-1 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-on-surface-variant">Sent Requests</p>
                <p className="text-2xl font-black text-on-surface mt-0.5">{sentRequests.length}</p>
                <p className="text-[11px] text-on-surface-variant font-medium mt-1">Pending peer response</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">outbox</span>
              </div>
            </div>

            <div className="bg-surface border border-outline-variant rounded-2xl p-4 shadow-elevation-1 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-on-surface-variant">Confirmed Swaps</p>
                <p className="text-2xl font-black text-on-surface mt-0.5">{activeSwaps.length}</p>
                <p className="text-[11px] text-teaching-emerald font-semibold mt-1">Ready for live sessions</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-teaching-emerald-container text-on-teaching-emerald-container flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">event_available</span>
              </div>
            </div>
          </div>

          {/* If completely empty */}
          {mySwaps.length === 0 && (
            <div className="text-center py-16 px-6 bg-surface border border-dashed border-outline rounded-3xl shadow-elevation-1">
              <div className="w-16 h-16 rounded-full bg-primary-container text-primary mx-auto flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl">swap_horiz</span>
              </div>
              <h3 className="text-lg font-extrabold text-on-surface mb-1">No Skill Swaps Yet</h3>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto mb-6">
                Trade your coding, design, or language skills 1-for-1 with other students without spending any tokens or money.
              </p>
              <Button variant="primary" className="py-2 px-5 text-xs font-bold" onClick={() => setActiveMainTab('matches')}>
                Browse Matching Peers
              </Button>
            </div>
          )}

          {/* SECTION 1: INCOMING OFFERS (ACTION REQUIRED) */}
          {incomingOffers.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-on-surface">Incoming Swap Offers</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-alert-rose text-white">
                    {incomingOffers.length} Action Needed
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {incomingOffers.map(session => {
                  const details = getSwapSkillDetails(session);
                  const isActing = actionLoadingId === session.id;

                  return (
                    <div 
                      key={session.id} 
                      className="p-5 rounded-2xl bg-surface border-2 border-learning-amber/40 shadow-elevation-2 flex flex-col justify-between gap-4 transition-all hover:border-learning-amber"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <img 
                              src={details.peerAvatar} 
                              alt={details.peerName} 
                              className="w-11 h-11 rounded-full object-cover ring-2 ring-learning-amber/30" 
                            />
                            <div>
                              <p className="font-extrabold text-sm text-on-surface">{details.peerName}</p>
                              <p className="text-[11px] text-learning-amber font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">hourglass_top</span>
                                Proposed a Skill Exchange
                              </p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-learning-amber-container text-on-learning-amber-container rounded-lg text-[10px] font-black uppercase tracking-wider border border-learning-amber/20">
                            Offer Pending
                          </span>
                        </div>

                        {/* Reciprocal Skills Visualizer */}
                        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-3 mb-3">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <div className="flex-1 pr-2">
                              <span className="text-[10px] text-on-surface-variant block uppercase font-bold tracking-wider">You Will Teach</span>
                              <span className="text-primary font-extrabold text-sm capitalize">{details.iTeach}</span>
                            </div>
                            <div className="shrink-0 px-2 flex items-center justify-center">
                              <span className="material-symbols-outlined text-teaching-emerald text-lg">swap_horiz</span>
                            </div>
                            <div className="flex-1 pl-2 text-right">
                              <span className="text-[10px] text-on-surface-variant block uppercase font-bold tracking-wider">{details.peerName} Teaches</span>
                              <span className="text-teaching-emerald font-extrabold text-sm capitalize">{details.peerTeaches}</span>
                            </div>
                          </div>
                        </div>

                        {/* Timing */}
                        <div className="flex items-center gap-3 text-xs font-medium text-on-surface-variant">
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-outline">event</span>
                            <span>{new Date(session.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-outline">schedule</span>
                            <span>{new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <span className="text-[11px] font-bold text-teaching-emerald ml-auto">Free 1-for-1 Swap</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-3 border-t border-outline-variant">
                        <Button 
                          variant="mint" 
                          disabled={isActing}
                          className="flex-1 py-2 text-xs font-extrabold flex items-center justify-center gap-1 shadow-elevation-1"
                          onClick={() => handleAcceptSwap(session.id)}
                        >
                          <span className="material-symbols-outlined text-base">check_circle</span>
                          <span>{isActing ? 'Accepting...' : 'Accept Swap'}</span>
                        </Button>

                        <button 
                          disabled={isActing}
                          onClick={() => handleDeclineSwap(session.id)}
                          className="px-3.5 py-2 text-xs font-bold rounded-xl border border-alert-rose/30 text-alert-rose hover:bg-alert-rose-container transition-all"
                          title="Decline Offer"
                        >
                          Decline
                        </button>

                        <button 
                          onClick={() => navigate(`/messages?peerId=${details.peerId}`, { state: { peerId: details.peerId } })}
                          className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all"
                          title="Message Peer"
                        >
                          <span className="material-symbols-outlined text-lg">chat</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 2: SENT REQUESTS (OUTGOING PENDING) */}
          {sentRequests.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-on-surface">Sent Swap Requests</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary-container text-on-primary-container">
                    {sentRequests.length} Awaiting Reply
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sentRequests.map(session => {
                  const details = getSwapSkillDetails(session);
                  const isActing = actionLoadingId === session.id;

                  return (
                    <div 
                      key={session.id} 
                      className="p-5 rounded-2xl bg-surface border border-outline-variant shadow-elevation-1 flex flex-col justify-between gap-4"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <img 
                              src={details.peerAvatar} 
                              alt={details.peerName} 
                              className="w-11 h-11 rounded-full object-cover ring-2 ring-primary/20" 
                            />
                            <div>
                              <p className="font-extrabold text-sm text-on-surface">{details.peerName}</p>
                              <p className="text-[11px] text-on-surface-variant font-medium">Request Sent to Peer</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant rounded-lg text-[10px] font-bold uppercase tracking-wider border border-outline-variant">
                            Pending Reply
                          </span>
                        </div>

                        {/* Reciprocal Skills Visualizer */}
                        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-3 mb-3">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <div className="flex-1 pr-2">
                              <span className="text-[10px] text-on-surface-variant block uppercase font-bold tracking-wider">You Will Teach</span>
                              <span className="text-primary font-extrabold text-sm capitalize">{details.iTeach}</span>
                            </div>
                            <div className="shrink-0 px-2 flex items-center justify-center">
                              <span className="material-symbols-outlined text-primary text-lg">swap_horiz</span>
                            </div>
                            <div className="flex-1 pl-2 text-right">
                              <span className="text-[10px] text-on-surface-variant block uppercase font-bold tracking-wider">{details.peerName} Teaches</span>
                              <span className="text-teaching-emerald font-extrabold text-sm capitalize">{details.peerTeaches}</span>
                            </div>
                          </div>
                        </div>

                        {/* Timing */}
                        <div className="flex items-center gap-3 text-xs font-medium text-on-surface-variant">
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-outline">event</span>
                            <span>{new Date(session.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-outline">schedule</span>
                            <span>{new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between pt-3 border-t border-outline-variant">
                        <button 
                          disabled={isActing}
                          onClick={() => handleCancelSwap(session.id)}
                          className="px-3 py-1.5 text-xs font-bold rounded-xl border border-outline-variant text-on-surface-variant hover:text-alert-rose hover:border-alert-rose/30 transition-all flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">cancel</span>
                          <span>{isActing ? 'Cancelling...' : 'Withdraw Proposal'}</span>
                        </button>

                        <button 
                          onClick={() => navigate(`/messages?peerId=${details.peerId}`, { state: { peerId: details.peerId } })}
                          className="px-3 py-1.5 text-xs font-bold rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high transition-all flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">chat</span>
                          <span>Chat with {details.peerName}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 3: CONFIRMED & ACTIVE SWAPS */}
          {activeSwaps.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-on-surface">Confirmed Swaps</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20">
                    {activeSwaps.length} Ready
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSwaps.map(session => {
                  const details = getSwapSkillDetails(session);
                  const isLive = isSessionLiveNow(session.scheduledAt);

                  return (
                    <div 
                      key={session.id} 
                      className="p-5 rounded-2xl bg-surface border border-outline-variant shadow-elevation-1 flex flex-col justify-between gap-4"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <img 
                              src={details.peerAvatar} 
                              alt={details.peerName} 
                              className="w-11 h-11 rounded-full object-cover ring-2 ring-teaching-emerald/30" 
                            />
                            <div>
                              <p className="font-extrabold text-sm text-on-surface">{details.peerName}</p>
                              <p className="text-[11px] text-teaching-emerald font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">verified</span>
                                Confirmed Mutual Swap
                              </p>
                            </div>
                          </div>
                          <span className={clsx(
                            "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                            isLive
                              ? "bg-teaching-emerald text-white animate-pulse"
                              : "bg-teaching-emerald-container text-on-teaching-emerald-container border-teaching-emerald/20"
                          )}>
                            {isLive ? '● Live Now' : 'Confirmed'}
                          </span>
                        </div>

                        {/* Reciprocal Skills Visualizer */}
                        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-3 mb-3">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <div className="flex-1 pr-2">
                              <span className="text-[10px] text-on-surface-variant block uppercase font-bold tracking-wider">You Will Teach</span>
                              <span className="text-primary font-extrabold text-sm capitalize">{details.iTeach}</span>
                            </div>
                            <div className="shrink-0 px-2 flex items-center justify-center">
                              <span className="material-symbols-outlined text-teaching-emerald text-lg">swap_horiz</span>
                            </div>
                            <div className="flex-1 pl-2 text-right">
                              <span className="text-[10px] text-on-surface-variant block uppercase font-bold tracking-wider">{details.peerName} Teaches</span>
                              <span className="text-teaching-emerald font-extrabold text-sm capitalize">{details.peerTeaches}</span>
                            </div>
                          </div>
                        </div>

                        {/* Timing */}
                        <div className="flex items-center gap-3 text-xs font-medium text-on-surface-variant">
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-outline">event</span>
                            <span>{new Date(session.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-outline">schedule</span>
                            <span>{new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-outline-variant">
                        <Button 
                          variant="primary" 
                          className={clsx(
                            "flex-1 py-2 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-elevation-1",
                            isLive && "bg-teaching-emerald hover:bg-teaching-emerald/90 text-white animate-pulse ring-2 ring-teaching-emerald/30"
                          )}
                          onClick={() => navigate(`/live/${session.id}`)}
                        >
                          <span className="material-symbols-outlined text-base">videocam</span>
                          <span>{isLive ? '● Enter Classroom' : 'Join Classroom'}</span>
                        </Button>

                        <button 
                          onClick={() => window.open(getGoogleCalendarUrl(session), '_blank')}
                          className="px-2.5 py-2 text-xs font-bold rounded-xl border border-outline-variant bg-surface hover:bg-surface-container transition-all flex items-center gap-1"
                          title="Add to Google Calendar"
                        >
                          <span className="material-symbols-outlined text-sm">calendar_today</span>
                          <span>Cal</span>
                        </button>

                        <button 
                          onClick={() => navigate(`/messages?peerId=${details.peerId}`, { state: { peerId: details.peerId } })}
                          className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all"
                          title="Message Peer"
                        >
                          <span className="material-symbols-outlined text-lg">chat</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Proposal Exchange Modal */}
      <AnimatePresence>
        {proposalPeer && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="bg-surface border border-outline-variant rounded-2xl w-full max-w-md p-6 shadow-elevation-3 relative"
            >
              <button 
                onClick={() => setProposalPeer(null)}
                className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg p-1 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>

              <h3 className="text-xl font-black text-on-surface mb-1">Propose Skill Exchange</h3>
              <p className="text-xs font-bold text-on-surface-variant mb-6">Create a direct 1-for-1 hour swap with {proposalPeer.name}.</p>

              {successMsg ? (
                <div className="bg-teaching-emerald-container border border-teaching-emerald/20 text-on-teaching-emerald-container rounded-xl p-3.5 text-xs font-semibold flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-teaching-emerald text-base">check_circle</span>
                  {successMsg}
                </div>
              ) : (
                <div className="space-y-4">
                {errorMsg && (
                  <div className="bg-alert-rose-container border border-alert-rose/20 text-on-alert-rose-container rounded-lg p-3 text-body-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    {errorMsg}
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
                      The nearest open slot for <strong>{proposalPeer?.name}</strong> is:
                      <br />
                      <span className="font-extrabold text-on-learning-amber-container text-sm">{conflictData.nearestSlotFormatted}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSendProposal(conflictData.nearestSlot)}
                      className="w-full py-2 bg-learning-amber hover:bg-learning-amber-hover text-on-learning-amber font-black rounded-xl text-xs flex items-center justify-center gap-1 shadow-elevation-1 active:scale-98 transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">event_available</span>
                      <span>Book Nearest Slot ({conflictData.nearestSlotFormatted})</span>
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-label-md font-label-md text-on-surface mb-1">What you will Teach them</label>
                  <div className="p-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm text-on-surface font-semibold capitalize">
                    {giveSkill ? (giveSkill.skill?.name || giveSkill.name) : 'React / Coding Skills'}
                  </div>
                </div>

                <div>
                  <label className="block text-label-md font-label-md text-on-surface mb-1">What you will Learn in return</label>
                  <select 
                    className="w-full rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    value={takeSkill?.id || takeSkill?.skill?.id || ''}
                    onChange={(e) => {
                      const skill = (proposalPeer.userSkills || []).find((us: any) => (us.id === e.target.value || us.skill?.id === e.target.value));
                      setTakeSkill(skill || null);
                    }}
                  >
                    {(proposalPeer.userSkills || []).filter((us: any) => us && us.type === 'teaches').map((us: any, idx: number) => (
                      <option key={us.id || us.skill?.id || idx} value={us.id || us.skill?.id}>{us.skill?.name || 'Skill'}</option>
                    ))}
                  </select>
                </div>

                {/* Batch Format Choice */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-on-surface">Lecture Format (Batch Choice)</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { cap: 1, label: '1-on-1 Private', icon: 'person' },
                      { cap: 3, label: '3 Students (Trio)', icon: 'groups' },
                      { cap: 5, label: '5 Students (Batch)', icon: 'school' }
                    ].map(item => {
                      const isSel = proposalCapacity === item.cap;
                      return (
                        <button
                          key={item.cap}
                          type="button"
                          onClick={() => setProposalCapacity(item.cap)}
                          className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-between ${
                            isSel ? 'bg-primary-container border-primary text-on-primary-container font-bold shadow-elevation-1' : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base mb-0.5">{item.icon}</span>
                          <span className="text-[10px] leading-tight">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {proposalCapacity > 1 && (
                    <p className="text-[10px] text-on-teaching-emerald-container font-bold bg-teaching-emerald-container border border-teaching-emerald/20 px-2 py-1 rounded-lg">
                      ✨ All {proposalCapacity} students and the peer will join the live studio room together.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-label-md font-label-md text-on-surface mb-2">Preferred Date</label>
                    <input 
                      type="date" 
                      className="w-full rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md p-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      value={proposedDate}
                      onChange={(e) => setProposedDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-label-md font-label-md text-on-surface mb-2">Preferred Time</label>
                    <input 
                      type="time" 
                      className="w-full rounded-lg border border-outline-variant bg-surface text-on-surface text-body-md p-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      value={proposedTime}
                      onChange={(e) => setProposedTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-outline-variant">
                  <Button variant="ghost" onClick={() => setProposalPeer(null)}>Cancel</Button>
                  <Button variant="primary" onClick={() => handleSendProposal()}>Submit Proposal</Button>
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
