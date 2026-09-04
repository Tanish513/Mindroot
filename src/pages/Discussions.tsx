import { useState, useEffect, useMemo, useCallback } from 'react';
import { api, onDiscussionsUpdated } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export interface DiscussionComment {
  id: string;
  discussionId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  content: string;
  upvotes: string[];
  isAccepted: boolean;
  createdAt: string;
}

export interface DiscussionItem {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  title: string;
  content: string;
  tags: string[];
  upvotes: string[];
  bounty?: {
    type: 'points' | 'tokens';
    amount: number;
  };
  isAnswered: boolean;
  acceptedCommentId?: string | null;
  comments: DiscussionComment[];
  createdAt: string;
  updatedAt: string;
}

const PRESET_TAGS = ['All', 'React', 'Python', 'JavaScript', 'DSA', 'System Design', 'Backend', 'Career', 'CSS'];

export function getTagColorStyle(tag: string): string {
  const t = tag.toLowerCase().trim();
  if (['react', 'frontend', 'ui/ux', 'css', 'web'].includes(t)) {
    return 'bg-electric-cyan-container text-on-electric-cyan-container border-electric-cyan/30';
  }
  if (['system design', 'architecture', 'devops', 'cloud', 'security'].includes(t)) {
    return 'bg-trust-purple-container text-on-trust-purple-container border-trust-purple/30';
  }
  if (['python', 'backend', 'dsa', 'java', 'sql', 'database'].includes(t)) {
    return 'bg-sky-blue-container text-on-sky-blue-container border-sky-blue/30';
  }
  if (['career', 'interview', 'guidance', 'resume'].includes(t)) {
    return 'bg-learning-amber-container text-on-learning-amber-container border-learning-amber/30';
  }
  if (['javascript', 'typescript', 'node'].includes(t)) {
    return 'bg-teaching-emerald-container text-on-teaching-emerald-container border-teaching-emerald/30';
  }
  return 'bg-surface-container text-on-surface-variant border-outline-variant/50';
}

export function Discussions() {
  const navigate = useNavigate();
  const currentUser = useAppStore(state => state.currentUser);
  const role = useAppStore(state => state.role);
  const addNotification = useAppStore(state => state.addNotification);

  const [discussions, setDiscussions] = useState<DiscussionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortTab, setSortTab] = useState<'newest' | 'votes' | 'unanswered' | 'bounty'>('newest');
  const [selectedThread, setSelectedThread] = useState<DiscussionItem | null>(null);

  // Modal State
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [askTitle, setAskTitle] = useState('');
  const [askContent, setAskContent] = useState('');
  const [askTags, setAskTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [bountyType, setBountyType] = useState<'none' | 'points' | 'tokens'>('none');
  const [bountyAmount, setBountyAmount] = useState<number>(10);
  const [submittingAsk, setSubmittingAsk] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  // Reply State
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Fetch discussions
  const loadDiscussions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDiscussions({
        tag: selectedTag !== 'All' ? selectedTag : undefined,
        search: searchQuery.trim() || undefined,
        sort: sortTab
      });
      if (Array.isArray(data)) {
        setDiscussions(data);
        if (selectedThread) {
          const fresh = data.find((d: DiscussionItem) => d.id === selectedThread.id);
          if (fresh) setSelectedThread(fresh);
        }
      }
    } catch (err) {
      console.warn('Failed to load discussions:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTag, searchQuery, sortTab, selectedThread?.id]);

  useEffect(() => {
    loadDiscussions();

    const unsub = onDiscussionsUpdated((updatedList: DiscussionItem[]) => {
      if (Array.isArray(updatedList)) {
        setDiscussions(updatedList);
        setSelectedThread(prev => {
          if (!prev) return null;
          return updatedList.find(d => d.id === prev.id) || prev;
        });
      }
    });

    return () => unsub();
  }, [selectedTag, sortTab]);

  // Handle Search Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      loadDiscussions();
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Filter & sort
  const filteredDiscussions = useMemo(() => {
    let list = [...discussions];
    if (selectedTag !== 'All') {
      list = list.filter(d => Array.isArray(d.tags) && d.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase()));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d =>
        d.title?.toLowerCase().includes(q) ||
        d.content?.toLowerCase().includes(q) ||
        d.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    if (sortTab === 'votes') {
      list.sort((a, b) => (b.upvotes?.length || 0) - (a.upvotes?.length || 0));
    } else if (sortTab === 'unanswered') {
      list = list.filter(d => !d.isAnswered);
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortTab === 'bounty') {
      list = list.filter(d => d.bounty && d.bounty.amount > 0);
      list.sort((a, b) => (b.bounty?.amount || 0) - (a.bounty?.amount || 0));
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [discussions, selectedTag, searchQuery, sortTab]);

  // Upvote Discussion
  const handleVoteDiscussion = async (e: React.MouseEvent, discId: string) => {
    e.stopPropagation();
    if (!currentUser?.id) return;
    const userId = currentUser.id;

    setDiscussions(prev =>
      prev.map(d => {
        if (d.id !== discId) return d;
        const up = Array.isArray(d.upvotes) ? [...d.upvotes] : [];
        const idx = up.indexOf(userId);
        if (idx !== -1) up.splice(idx, 1);
        else up.push(userId);
        return { ...d, upvotes: up };
      })
    );

    if (selectedThread && selectedThread.id === discId) {
      const up = Array.isArray(selectedThread.upvotes) ? [...selectedThread.upvotes] : [];
      const idx = up.indexOf(userId);
      if (idx !== -1) up.splice(idx, 1);
      else up.push(userId);
      setSelectedThread({ ...selectedThread, upvotes: up });
    }

    await api.voteDiscussion(discId, userId);
  };

  // Upvote Comment
  const handleVoteComment = async (commentId: string) => {
    if (!currentUser?.id || !selectedThread) return;
    const userId = currentUser.id;

    const updatedComments = (selectedThread.comments || []).map(c => {
      if (c.id !== commentId) return c;
      const up = Array.isArray(c.upvotes) ? [...c.upvotes] : [];
      const idx = up.indexOf(userId);
      if (idx !== -1) up.splice(idx, 1);
      else up.push(userId);
      return { ...c, upvotes: up };
    });

    const updatedThread = { ...selectedThread, comments: updatedComments };
    setSelectedThread(updatedThread);
    setDiscussions(prev => prev.map(d => d.id === selectedThread.id ? updatedThread : d));

    await api.voteDiscussionComment(commentId, userId);
  };

  // Accept Answer
  const handleAcceptAnswer = async (commentId: string) => {
    if (!currentUser?.id || !selectedThread) return;
    if (selectedThread.authorId !== currentUser.id && role !== 'admin') return;

    try {
      const res = await api.acceptDiscussionAnswer(selectedThread.id, commentId, currentUser.id);
      if (res?.success) {
        const updatedComments = (selectedThread.comments || []).map(c => ({
          ...c,
          isAccepted: c.id === commentId
        }));
        const updatedThread: DiscussionItem = {
          ...selectedThread,
          isAnswered: true,
          acceptedCommentId: commentId,
          comments: updatedComments
        };
        setSelectedThread(updatedThread);
        setDiscussions(prev => prev.map(d => d.id === selectedThread.id ? updatedThread : d));

        addNotification({
          type: 'reminder',
          title: '🏅 Solution Verified!',
          body: 'You marked this solution as verified. Points have been transferred.',
          link: '/discussions'
        });
      }
    } catch (err: any) {
      console.error('Failed to accept answer:', err);
    }
  };

  // Submit Reply
  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedThread || !currentUser) return;

    setSubmittingReply(true);
    setReplyError(null);

    try {
      const res = await api.addDiscussionComment(selectedThread.id, {
        content: replyText.trim(),
        authorId: currentUser.id,
        authorName: currentUser.name || 'Mindroot Learner',
        authorRole: role,
        authorAvatar: currentUser.avatar
      });

      if (res?.comment) {
        const newComments = [...(selectedThread.comments || []), res.comment];
        const updatedThread = { ...selectedThread, comments: newComments };
        setSelectedThread(updatedThread);
        setDiscussions(prev => prev.map(d => d.id === selectedThread.id ? updatedThread : d));
        setReplyText('');

        addNotification({
          type: 'reminder',
          title: '💬 Reply Posted!',
          body: 'You earned +5 Reward Points for contributing to peer discussions!',
          link: '/rewards'
        });
      }
    } catch (err: any) {
      setReplyError(err?.message || 'Failed to submit reply. Please try again.');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Submit New Question
  const handleSubmitAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askTitle.trim()) {
      setAskError('Please provide a descriptive question title.');
      return;
    }
    if (!askContent.trim()) {
      setAskError('Please provide context or details for your question.');
      return;
    }

    setSubmittingAsk(true);
    setAskError(null);

    const bounty = bountyType !== 'none' && bountyAmount > 0
      ? { type: bountyType, amount: bountyAmount }
      : undefined;

    // Check user balance
    if (bounty) {
      if (bounty.type === 'points' && (currentUser?.rewardPoints || 0) < bounty.amount) {
        setAskError(`You only have ${currentUser?.rewardPoints || 0} Reward Points available.`);
        setSubmittingAsk(false);
        return;
      }
      if (bounty.type === 'tokens' && (currentUser?.tokenBalance || 0) < bounty.amount) {
        setAskError(`You only have ${currentUser?.tokenBalance || 0} Tokens available.`);
        setSubmittingAsk(false);
        return;
      }
    }

    try {
      const created = await api.createDiscussion({
        title: askTitle.trim(),
        content: askContent.trim(),
        tags: askTags.length > 0 ? askTags : ['General'],
        bounty,
        authorId: currentUser?.id,
        authorName: currentUser?.name || 'Anonymous Student',
        authorRole: role,
        authorAvatar: currentUser?.avatar
      });

      if (created && created.id) {
        setDiscussions(prev => [created, ...prev]);
        setIsAskModalOpen(false);
        setAskTitle('');
        setAskContent('');
        setAskTags([]);
        setBountyType('none');
        setSelectedThread(created);

        addNotification({
          type: 'message',
          title: '🚀 Question Published!',
          body: 'Your question is now visible to peer mentors on the Community Board.',
          link: '/discussions'
        });
      }
    } catch (err: any) {
      setAskError(err?.message || 'Failed to post question. Please try again.');
    } finally {
      setSubmittingAsk(false);
    }
  };

  const handleAddTag = (tag: string) => {
    const clean = tag.trim().replace(/^#/, '');
    if (clean && !askTags.includes(clean) && askTags.length < 5) {
      setAskTags([...askTags, clean]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setAskTags(askTags.filter(t => t !== tag));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Hero / Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-surface border border-outline-variant p-6 md:p-8 shadow-elevation-1">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container text-on-surface border border-outline-variant text-xs font-semibold tracking-wide uppercase">
              <span className="material-symbols-outlined text-sm text-primary">forum</span>
              Peer Q&A & Community Hub
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-on-surface">
              Ask, Discuss & Master Together
            </h1>
            <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
              Stuck on a tricky bug or concept? Ask fellow learners and mentors, upvote verified solutions, and earn rewards for contributing!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <Button
              onClick={() => setIsAskModalOpen(true)}
              className="bg-primary hover:bg-primary/90 text-on-primary font-bold px-5 py-3 rounded-xl shadow-elevation-1 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">add_comment</span>
              Ask a Question
            </Button>
          </div>
        </div>

        {/* Search & Tag Chips */}
        <div className="relative z-10 mt-6 pt-5 border-t border-outline-variant/60 flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Search discussions, topics, or code keywords..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container-high/60 border border-outline-variant rounded-xl text-sm font-medium text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full custom-scrollbar">
            {PRESET_TAGS.map(tag => {
              const isSelected = selectedTag.toLowerCase() === tag.toLowerCase();
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant/50'
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {selectedThread ? (
        /* Detailed Thread View */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedThread(null)}
              className="inline-flex items-center gap-2 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back to All Discussions
            </button>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => navigate('/marketplace')}
                className="text-xs font-bold px-3 py-1.5 rounded-xl border-outline-variant hover:border-primary flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">person_search</span>
                Book 1-on-1 Mentor
              </Button>
            </div>
          </div>

          {/* Thread Question Card */}
          <div className="bg-surface border border-outline-variant rounded-3xl p-6 md:p-8 shadow-elevation-1 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={selectedThread.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'}
                  alt={selectedThread.authorName}
                  className="w-11 h-11 rounded-full object-cover border border-outline-variant"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-on-surface">{selectedThread.authorName}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-primary-container text-on-primary-container">
                      {selectedThread.authorRole}
                    </span>
                  </div>
                  <span className="text-xs text-on-surface-variant font-medium">
                    Asked {new Date(selectedThread.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex items-center gap-2">
                {selectedThread.bounty && selectedThread.bounty.amount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-learning-amber/20 text-learning-amber border border-learning-amber/40 text-xs font-extrabold shadow-xs">
                    <span className="material-symbols-outlined text-sm">stars</span>
                    +{selectedThread.bounty.amount} {selectedThread.bounty.type === 'tokens' ? 'Tokens' : 'Pts'} Bounty
                  </span>
                )}
                {selectedThread.isAnswered ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/30 text-xs font-extrabold">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Solved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs font-bold">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    Open
                  </span>
                )}
              </div>
            </div>

            {/* Question Title & Body */}
            <div className="space-y-3 pt-2">
              <h2 className="text-xl md:text-2xl font-black text-on-surface tracking-tight">
                {selectedThread.title}
              </h2>
              <div className="text-sm text-on-surface-variant font-medium leading-relaxed whitespace-pre-line bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 font-mono">
                {selectedThread.content}
              </div>
            </div>

            {/* Tags & Upvote CTA */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-outline-variant/50">
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedThread.tags?.map((t, idx) => (
                  <span
                    key={idx}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${getTagColorStyle(t)}`}
                  >
                    #{t}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => handleVoteDiscussion(e, selectedThread.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    selectedThread.upvotes?.includes(currentUser?.id)
                      ? 'bg-primary text-on-primary border-primary shadow-xs'
                      : 'bg-surface-container hover:bg-surface-container-high text-on-surface border-outline-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">thumb_up</span>
                  <span>{selectedThread.upvotes?.length || 0}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Answers & Replies Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-base font-black text-on-surface flex items-center gap-2">
                <span>{selectedThread.comments?.length || 0} Peer Solutions & Replies</span>
              </h3>
              <span className="text-xs text-on-surface-variant font-medium">
                Earn +5 Pts for contributing
              </span>
            </div>

            {/* List of Replies */}
            {selectedThread.comments && selectedThread.comments.length > 0 ? (
              <div className="space-y-3">
                {selectedThread.comments.map(comment => {
                  const isAccepted = comment.isAccepted || selectedThread.acceptedCommentId === comment.id;
                  const isAuthor = selectedThread.authorId === currentUser?.id || role === 'admin';

                  return (
                    <div
                      key={comment.id}
                      className={`rounded-2xl p-5 border transition-all ${
                        isAccepted
                          ? 'bg-teaching-emerald-container/20 border-teaching-emerald/50 shadow-elevation-1'
                          : 'bg-surface border-outline-variant'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={comment.authorAvatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=256&q=80'}
                            alt={comment.authorName}
                            className="w-9 h-9 rounded-full object-cover border border-outline-variant"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-on-surface">{comment.authorName}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-surface-container text-on-surface-variant">
                                {comment.authorRole}
                              </span>
                              {isAccepted && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teaching-emerald-container text-on-teaching-emerald-container text-[10px] font-black uppercase">
                                  <span className="material-symbols-outlined text-xs">verified</span>
                                  Accepted Solution
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-on-surface-variant font-medium">
                              {new Date(comment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {/* Actions: Accept solution or upvote */}
                        <div className="flex items-center gap-2">
                          {isAuthor && !isAccepted && (
                            <button
                              onClick={() => handleAcceptAnswer(comment.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-teaching-emerald hover:bg-teaching-emerald/10 border border-teaching-emerald/30 transition-colors"
                              title="Mark as accepted answer"
                            >
                              <span className="material-symbols-outlined text-sm">check_circle</span>
                              Accept Solution
                            </button>
                          )}

                          <button
                            onClick={() => handleVoteComment(comment.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                              comment.upvotes?.includes(currentUser?.id)
                                ? 'bg-primary text-on-primary border-primary'
                                : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border-outline-variant/60'
                            }`}
                          >
                            <span className="material-symbols-outlined text-xs">thumb_up</span>
                            <span>{comment.upvotes?.length || 0}</span>
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 text-xs md:text-sm text-on-surface font-medium leading-relaxed whitespace-pre-line bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 font-mono">
                        {comment.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 bg-surface rounded-2xl border border-outline-variant p-6 space-y-2">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant">chat_bubble_outline</span>
                <p className="text-sm font-bold text-on-surface">No answers yet!</p>
                <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                  Be the first to share an answer or helpful insight. You will earn reward loyalty points!
                </p>
              </div>
            )}

            {/* Reply Composer Form */}
            <form onSubmit={handleSubmitReply} className="bg-surface border border-outline-variant rounded-2xl p-5 space-y-3 shadow-elevation-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Post Your Solution or Insight
              </h4>
              {replyError && (
                <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-error text-xs font-bold">
                  {replyError}
                </div>
              )}
              <textarea
                rows={4}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Type your explanation, code snippets, or reference links..."
                className="w-full p-3.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-xs md:text-sm text-on-surface font-mono placeholder:text-on-surface-variant/70 focus:outline-none focus:border-primary transition-colors resize-y"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-on-surface-variant">
                  💡 Markdown & code block formatting supported
                </span>
                <Button
                  type="submit"
                  disabled={submittingReply || !replyText.trim()}
                  className="bg-primary hover:bg-primary/90 text-on-primary font-bold px-4 py-2 text-xs rounded-xl flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">send</span>
                  {submittingReply ? 'Posting...' : 'Post Solution'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* Discussion Thread List View */
        <div className="space-y-4">
          {/* Sorting / Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-2.5 rounded-2xl border border-outline-variant">
            <div className="flex items-center gap-1">
              {[
                { id: 'newest', label: 'Recent', icon: 'schedule' },
                { id: 'votes', label: 'Most Upvoted', icon: 'trending_up' },
                { id: 'unanswered', label: 'Unanswered', icon: 'help_outline' },
                { id: 'bounty', label: 'With Bounties', icon: 'stars' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSortTab(tab.id as any)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    sortTab === tab.id
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            <span className="text-xs font-bold text-on-surface-variant pr-2">
              {filteredDiscussions.length} Questions
            </span>
          </div>

          {/* Discussions Cards */}
          {loading ? (
            <div className="text-center py-16 bg-surface rounded-3xl border border-outline-variant space-y-3">
              <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
              <p className="text-xs font-bold text-on-surface-variant">Loading discussions...</p>
            </div>
          ) : filteredDiscussions.length === 0 ? (
            <div className="text-center py-16 bg-surface rounded-3xl border border-outline-variant p-8 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-3xl">question_answer</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-on-surface">No discussions found</h3>
                <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                  Be the pioneer! Ask a question or share a problem with the community to start the discussion.
                </p>
              </div>
              <Button
                onClick={() => setIsAskModalOpen(true)}
                className="bg-primary hover:bg-primary/90 text-on-primary font-bold px-4 py-2 rounded-xl text-xs"
              >
                Ask the First Question
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredDiscussions.map(disc => {
                const hasBounty = disc.bounty && disc.bounty.amount > 0;
                const isVoted = disc.upvotes?.includes(currentUser?.id);

                return (
                  <div
                    key={disc.id}
                    onClick={() => setSelectedThread(disc)}
                    className="group bg-surface hover:bg-surface-container-lowest border border-outline-variant hover:border-outline rounded-2xl p-5 shadow-elevation-1 hover:shadow-elevation-2 transition-all cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      {/* Upvote Pill */}
                      <button
                        onClick={(e) => handleVoteDiscussion(e, disc.id)}
                        className={`flex flex-col items-center justify-center min-w-[48px] h-12 rounded-xl border transition-colors ${
                          isVoted
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border-outline-variant/60'
                        }`}
                      >
                        <span className="material-symbols-outlined text-base leading-none">arrow_drop_up</span>
                        <span className="text-xs font-black leading-none">{disc.upvotes?.length || 0}</span>
                      </button>

                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm md:text-base font-black text-on-surface group-hover:text-primary transition-colors">
                            {disc.title}
                          </h3>
                          {disc.isAnswered && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-teaching-emerald-container text-on-teaching-emerald-container text-[10px] font-black uppercase">
                              <span className="material-symbols-outlined text-xs">check_circle</span>
                              Solved
                            </span>
                          )}
                          {hasBounty && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-learning-amber/20 text-learning-amber text-[10px] font-black uppercase">
                              <span className="material-symbols-outlined text-xs">stars</span>
                              +{disc.bounty?.amount} {disc.bounty?.type === 'tokens' ? 'Tokens' : 'Pts'}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-on-surface-variant font-medium line-clamp-2 max-w-3xl">
                          {disc.content}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {disc.tags?.map((t, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getTagColorStyle(t)}`}
                            >
                              #{t}
                            </span>
                          ))}
                          <span className="text-[11px] text-on-surface-variant/80 font-medium ml-1">
                            by <span className="font-bold text-on-surface">{disc.authorName}</span> • {new Date(disc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right side stats */}
                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high border border-outline-variant/60 text-xs font-bold text-on-surface-variant">
                        <span className="material-symbols-outlined text-base">chat_bubble</span>
                        <span>{disc.comments?.length || 0}</span>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">
                        chevron_right
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Ask Question Modal */}
      <AnimatePresence>
        {isAskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-outline-variant rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-elevation-4 max-h-[90vh] overflow-y-auto space-y-5 custom-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-outline-variant/60 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">help_center</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-on-surface">Ask the Community</h3>
                    <p className="text-xs text-on-surface-variant font-medium">
                      Get fast answers and mentor assistance from peer students.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAskModalOpen(false)}
                  className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {askError && (
                <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-error text-xs font-bold">
                  {askError}
                </div>
              )}

              <form onSubmit={handleSubmitAsk} className="space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-surface">
                    Question Title <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. How to implement binary search trees with iterative traversal in Python?"
                    value={askTitle}
                    onChange={e => setAskTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-xs md:text-sm font-medium text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Tags */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-surface">
                    Tags (Up to 5)
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {askTags.map(t => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-container text-on-primary-container text-xs font-bold"
                      >
                        #{t}
                        <button type="button" onClick={() => handleRemoveTag(t)}>
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add tag (e.g. Python, React, Algorithms) and press Add"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag(tagInput);
                        }
                      }}
                      className="flex-1 px-3.5 py-2 bg-surface-container-lowest border border-outline-variant rounded-xl text-xs font-medium text-on-surface focus:outline-none focus:border-primary"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleAddTag(tagInput)}
                      className="text-xs font-bold px-3 py-2 rounded-xl"
                    >
                      Add Tag
                    </Button>
                  </div>
                  {/* Preset tag hints */}
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    <span className="text-[10px] text-on-surface-variant font-bold mr-1">Suggestions:</span>
                    {['React', 'Python', 'DSA', 'SQL', 'JavaScript'].map(hint => (
                      <button
                        key={hint}
                        type="button"
                        onClick={() => handleAddTag(hint)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                      >
                        +{hint}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-surface">
                    Details & Code Snippet <span className="text-error">*</span>
                  </label>
                  <textarea
                    rows={5}
                    required
                    placeholder="Describe what you are trying to accomplish, what you tried, and paste relevant code snippets..."
                    value={askContent}
                    onChange={e => setAskContent(e.target.value)}
                    className="w-full p-3.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-xs md:text-sm text-on-surface font-mono placeholder:text-on-surface-variant/70 focus:outline-none focus:border-primary resize-y"
                  />
                </div>

                {/* Optional Bounty Card */}
                <div className="bg-surface-container-low border border-outline-variant/60 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-learning-amber text-lg">stars</span>
                      <span className="text-xs font-extrabold text-on-surface uppercase tracking-wide">
                        Incentive Bounty (Optional)
                      </span>
                    </div>
                    <span className="text-[11px] text-on-surface-variant">
                      Awarded to verified solution
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'none', label: 'No Bounty', icon: 'block' },
                      { id: 'points', label: 'Reward Pts', icon: 'military_tech' },
                      { id: 'tokens', label: 'Skill Tokens', icon: 'savings' }
                    ].map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setBountyType(b.id as any)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                          bountyType === b.id
                            ? 'bg-primary-container text-on-primary-container border-primary shadow-xs'
                            : 'bg-surface hover:bg-surface-container text-on-surface-variant border-outline-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">{b.icon}</span>
                        {b.label}
                      </button>
                    ))}
                  </div>

                  {bountyType !== 'none' && (
                    <div className="flex items-center gap-3 pt-2">
                      <label className="text-xs font-bold text-on-surface">Bounty Amount:</label>
                      <input
                        type="number"
                        min={bountyType === 'tokens' ? 1 : 5}
                        max={bountyType === 'tokens' ? 20 : 100}
                        value={bountyAmount}
                        onChange={e => setBountyAmount(parseInt(e.target.value, 10) || 0)}
                        className="w-24 px-3 py-1.5 bg-surface border border-outline-variant rounded-xl text-xs font-bold text-on-surface text-center focus:outline-none focus:border-primary"
                      />
                      <span className="text-xs font-bold text-on-surface-variant">
                        {bountyType === 'tokens' ? 'Tokens' : 'Points'} (Balance: {bountyType === 'tokens' ? (currentUser?.tokenBalance || 0) : (currentUser?.rewardPoints || 0)})
                      </span>
                    </div>
                  )}
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/60">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsAskModalOpen(false)}
                    className="text-xs font-bold px-4 py-2 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingAsk || !askTitle.trim() || !askContent.trim()}
                    className="bg-primary hover:bg-primary/90 text-on-primary font-bold px-5 py-2 text-xs rounded-xl flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">send</span>
                    {submittingAsk ? 'Publishing...' : 'Publish Question'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
