import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { api, onPeersUpdated } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { useDebounce } from '../hooks/useDebounce';
import { motion, AnimatePresence } from 'framer-motion';

const categories = ['All', 'Software & AI', 'Design & 3D', 'Languages', 'Business'];

export function MatchFinder() {
  const navigate = useNavigate();
  const [peers, setPeers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const searchQuery = useAppStore(state => state.searchQuery);
  const currentUser = useAppStore(state => state.currentUser);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

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

  useEffect(() => {
    let mounted = true;
    const loadPeers = () => {
      api.getPeers().then(data => {
        if (mounted) {
          setPeers(data);
          setLoading(false);
        }
      }).catch(console.error);
    };

    loadPeers();
    const unsubscribe = onPeersUpdated(loadPeers);
    return () => {
      mounted = false;
      unsubscribe();
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
      await api.postSession({
        title: `${giveSkill ? giveSkill.skill.name : 'Skill'} ↔ ${takeSkill ? takeSkill.skill.name : 'Exchange'}${titleSuffix}`,
        teacherId: proposalPeer.id,
        studentId: currentUser.id,
        skillId: takeSkill ? takeSkill.skill.id : undefined,
        scheduledAt: scheduledAt.toISOString(),
        durationMin: 60,
        maxCapacity: proposalCapacity
      });
      setSuccessMsg(`Proposal request sent to ${proposalPeer.name} for ${proposalCapacity > 1 ? `${proposalCapacity}-Student Batch` : '1-on-1'}!`);
      setErrorMsg('');
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
      <div className="mb-8">
        <h2 className="text-headline-lg font-headline-lg text-on-surface mb-2">Smart Match Finder</h2>
        <p className="text-body-md font-body-md text-on-surface-variant">Discover the perfect peer based on your skill goals and availability.</p>
      </div>

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
                      <span className="material-symbols-outlined text-teaching-emerald text-xs">payments</span>
                      ₹{peer.hourlyRate || 499}/hr
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
                  <Button variant="primary" className="font-semibold text-xs py-1.5 px-4" onClick={() => handleOpenProposal(peer)}>
                    Propose Exchange
                  </Button>
                </div>
              </div>
            );
          })}
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
                    {giveSkill ? giveSkill.skill.name : 'React / Coding Skills'}
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
                      ✨ All {proposalCapacity} students and the mentor will join the live studio room together.
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
