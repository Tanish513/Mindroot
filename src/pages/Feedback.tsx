import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

const ENDORSEMENT_CHIPS = ['Punctual', 'Respectful Learner', 'Active Listener', 'Clear Explanations', 'Patient', 'Deep Knowledge', 'Well-Prepared', 'Engaging'];

function StarRating({ rating, interactive = false, onChange }: { rating: number; interactive?: boolean; onChange?: (r: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || rating;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          className={`material-symbols-outlined text-[28px] cursor-${interactive ? 'pointer' : 'default'} transition-colors ${star <= display ? 'text-learning-amber' : 'text-outline'}`}
          style={{ fontVariationSettings: star <= display ? "'FILL' 1" : "'FILL' 0" }}
          onMouseEnter={() => interactive && setHovered(star)}
          onMouseLeave={() => interactive && setHovered(0)}
          onClick={() => interactive && onChange?.(star)}
        >
          star
        </span>
      ))}
    </div>
  );
}

export function Feedback() {
  const currentUser = useAppStore(state => state.currentUser);
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const searchQuery = useAppStore(state => state.searchQuery);
  const role = useAppStore(state => state.role);

  const [rating, setRating] = useState(0);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [testimonial, setTestimonial] = useState('');
  const [reviews, setReviews] = useState<any[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submittingError, setSubmittingError] = useState('');
  const [peers, setPeers] = useState<any[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('React Fundamentals');

  const isStudentRole = role === 'student';
  const reliabilityScore = Math.min(100, Math.round((currentUser?.trustScore ?? 5.0) * 20));

  const filteredReviews = reviews.filter(r => {
    if (searchQuery.trim() === '') return true;
    const query = searchQuery.toLowerCase();
    const authorMatch = r.author?.name?.toLowerCase().includes(query);
    const topicMatch = r.topic?.toLowerCase().includes(query);
    const quoteMatch = r.quote?.toLowerCase().includes(query);
    const chipMatch = Array.isArray(r.chips) && r.chips.some((c: string) => c.toLowerCase().includes(query));
    return authorMatch || topicMatch || quoteMatch || chipMatch;
  });

  const loadReviews = useCallback(() => {
    if (!currentUser) return;
    api.getReviews(currentUser.id)
      .then(setReviews)
      .catch(console.error);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      api.getMe().then(setCurrentUser).catch(console.error);
    }
    api.getPeers().then(data => {
      setPeers(data);
      if (data.length > 0) {
        setTargetUserId(data[0].id);
      }
    }).catch(console.error);
  }, [currentUser, setCurrentUser]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const toggleChip = (chip: string) => {
    setSelectedChips(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]);
  };

  const handleSubmit = () => {
    if (rating === 0 || !currentUser || !targetUserId) return;
    
    const tempId = 'opt-rev-' + Date.now();
    const targetPeer = peers.find(p => p.id === targetUserId);
    const reviewPayload = {
      id: tempId,
      authorId: currentUser.id,
      author: currentUser,
      targetId: targetUserId,
      target: targetPeer,
      topic: selectedTopic,
      rating,
      quote: testimonial || 'Excellent session!',
      chips: selectedChips,
      createdAt: new Date().toISOString(),
      status: 'submitting' as const
    };

    // Preserve form state in case rollback is needed
    const prevRating = rating;
    const prevChips = selectedChips;
    const prevTestimonial = testimonial;

    // Optimistically update UI
    setReviews(prev => [reviewPayload, ...prev]);
    setRating(0);
    setSelectedChips([]);
    setTestimonial('');
    setSubmitted(true);
    setSubmittingError('');

    api.postReview({
      authorId: currentUser.id,
      targetId: targetUserId,
      topic: selectedTopic,
      rating: prevRating,
      quote: prevTestimonial || 'Excellent session!',
      chips: prevChips
    })
      .then(savedRev => {
        if (savedRev && savedRev.id) {
          setReviews(prev => prev.map(r => r.id === tempId ? { ...savedRev, status: 'confirmed' } : r));
        } else {
          setReviews(prev => prev.map(r => r.id === tempId ? { ...r, status: 'confirmed' } : r));
        }
        loadReviews();
        api.getMe().then(setCurrentUser).catch(console.error);
        setTimeout(() => setSubmitted(false), 3000);
      })
      .catch(err => {
        console.error('Failed to submit review:', err);
        // ROLLBACK: Remove optimistic entry, restore form state, surface failure message
        setReviews(prev => prev.filter(r => r.id !== tempId));
        setSubmitted(false);
        setRating(prevRating);
        setSelectedChips(prevChips);
        setTestimonial(prevTestimonial);
        setSubmittingError('Failed to submit feedback. Form state restored — please try submitting again.');
      });
  };

  return (
    <div className="max-w-container_max mx-auto space-y-10 select-none">
      <div>
        <h2 className="text-headline-lg font-headline-lg text-on-surface mb-2">
          {isStudentRole ? 'Feedback & Peer Reliability' : 'Feedback & Trust'}
        </h2>
        <p className="text-body-md font-body-md text-on-surface-variant">
          {isStudentRole 
            ? 'Review recent peer exchanges, endorse skills, and track your session attendance & peer conduct score.' 
            : 'Review recent peer exchanges, endorse skills, and track your overall teaching score.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reliability / Trust Score Card */}
        <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-elevation-1 lg:col-span-1 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center mb-2 shadow-elevation-1">
            <span className="material-symbols-outlined text-2xl">
              {isStudentRole ? 'verified_user' : 'verified'}
            </span>
          </div>
          <h3 className="text-lg font-black text-on-surface mb-1">
            {isStudentRole ? 'Your Reliability Score' : 'Your Teaching Rating'}
          </h3>
          
          {isStudentRole ? (
            <>
              <div className="text-[56px] leading-none font-black text-teaching-emerald my-3">
                {reliabilityScore}%
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-on-teaching-emerald-container bg-teaching-emerald-container px-3 py-1 rounded-full border border-teaching-emerald/20 mb-2">
                <span className="material-symbols-outlined text-sm">shield_check</span>
                Excellent Attendance & Conduct
              </span>
            </>
          ) : (
            <>
              <div className="text-[56px] leading-none font-black text-primary my-3">
                {(currentUser?.trustScore ?? 5.0).toFixed(2)}
              </div>
              <StarRating rating={Math.round(currentUser?.trustScore || 5)} />
            </>
          )}
          
          {/* Progress Bar for Goal */}
          <div className="w-full max-w-xs mt-4 space-y-1">
            <div className="flex justify-between text-[11px] font-bold text-on-surface-variant">
              <span>{isStudentRole ? 'Session Attendance Rate' : 'Overall Score'}</span>
              <span>{isStudentRole ? `${reliabilityScore}%` : `${(currentUser?.trustScore ?? 5.0).toFixed(2)} / 5.0`}</span>
            </div>
            <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${isStudentRole ? 'bg-teaching-emerald' : 'bg-primary'}`} 
                style={{ width: `${isStudentRole ? reliabilityScore : (((currentUser?.trustScore || 5) / 5) * 100)}%` }} 
              />
            </div>
          </div>

          <p className="text-xs font-bold text-on-surface-variant mt-4">
            Based on {reviews.length} verified peer sessions & feedback.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {isStudentRole ? (
              <>
                <span className="bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20 px-3 py-1 rounded-full text-xs font-extrabold shadow-elevation-1">Punctual Learner</span>
                <span className="bg-primary-container text-on-primary-container border border-primary/20 px-3 py-1 rounded-full text-xs font-extrabold shadow-elevation-1">Respectful Peer</span>
              </>
            ) : (
              <>
                <span className="bg-primary-container text-on-primary-container border border-primary/20 px-3 py-1 rounded-full text-xs font-extrabold shadow-elevation-1">Verified Peer</span>
                <span className="bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20 px-3 py-1 rounded-full text-xs font-extrabold shadow-elevation-1">Active Contributor</span>
              </>
            )}
          </div>
        </div>

        {/* Rate Recent Session Form */}
        <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-elevation-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-6 border-b border-outline-variant pb-4">
            <h3 className="text-lg font-black text-on-surface">Rate Recent Session</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-on-surface-variant">Review for:</span>
              <select 
                value={targetUserId}
                onChange={e => setTargetUserId(e.target.value)}
                className="rounded-xl border border-outline-variant bg-surface text-xs font-bold text-on-surface p-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {peers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {submittingError && (
            <div className="mb-4 p-3.5 bg-alert-rose-container border border-alert-rose/20 text-on-alert-rose-container rounded-xl text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-alert-rose text-base">error</span>
              {submittingError}
            </div>
          )}

          {submitted && (
            <div className="mb-4 p-3.5 bg-teaching-emerald-container border border-teaching-emerald/20 text-on-teaching-emerald-container rounded-xl text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-teaching-emerald text-base">check_circle</span>
              Feedback submitted successfully! Thank you for rating your peer.
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-1">How was your session?</label>
                <p className="text-[11px] font-medium text-on-surface-variant mb-2">
                  {isStudentRole ? 'Rate tutor explanation & session quality' : 'Evaluate peer punctuality & conduct'}
                </p>
                <StarRating rating={rating} interactive onChange={setRating} />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-2">Topic</label>
                <input 
                  type="text" 
                  value={selectedTopic}
                  onChange={e => setSelectedTopic(e.target.value)}
                  placeholder="e.g. React Fundamentals"
                  className="w-full rounded-xl border border-outline-variant bg-surface text-xs font-medium text-on-surface p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-2">Endorse Skills (Optional)</label>
              <div className="flex flex-wrap gap-2">
                {ENDORSEMENT_CHIPS.map(chip => (
                  <button
                    key={chip}
                    onClick={() => toggleChip(chip)}
                    type="button"
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 ${
                      selectedChips.includes(chip)
                        ? 'bg-primary-container text-on-primary-container border-primary/30 shadow-elevation-1'
                        : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-2">Written Testimonial</label>
              <textarea
                className="w-full rounded-xl border border-outline-variant bg-surface text-xs font-medium text-on-surface p-3 outline-none focus:border-primary transition-all"
                placeholder="Share your experience working with this peer..."
                rows={3}
                value={testimonial}
                onChange={e => setTestimonial(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <Button variant="primary" onClick={handleSubmit} className={`font-bold px-6 ${rating === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                Submit Feedback
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Wall of Reviews */}
      <div>
        <h3 className="text-xl font-black text-on-surface mb-6">Wall of Reviews</h3>
        {filteredReviews.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-outline-variant bg-surface rounded-2xl text-on-surface-variant text-xs flex flex-col items-center justify-center space-y-2">
            <span className="material-symbols-outlined text-3xl text-primary">rate_review</span>
            <p className="font-bold text-on-surface">No reviews found matching search</p>
            <p className="text-on-surface-variant font-medium">Try searching for a different skill, topic, or reviewer!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReviews.map((review, i) => (
              <div key={review.id || i} className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-elevation-1 hover:border-outline hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img 
                        src={`https://i.pravatar.cc/150?img=${(i % 10) + 10}`} 
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-teaching-emerald/30" 
                        alt={review.author?.name || 'Peer'} 
                      />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-teaching-emerald rounded-full ring-2 ring-surface" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-on-surface">{review.author?.name || 'Anonymous'}</h4>
                      <span className="text-xs font-bold text-on-surface-variant">{review.topic}</span>
                    </div>
                  </div>
                  <StarRating rating={review.rating} />
                </div>
                <p className="text-xs text-on-surface-variant font-medium flex-grow mb-4 leading-relaxed">"{review.quote}"</p>
                <div className="flex gap-1.5 flex-wrap mt-auto">
                  {review.chips.map((chip: string) => (
                    <span key={chip} className="bg-primary-container text-on-primary-container border border-primary/20 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold">{chip}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
