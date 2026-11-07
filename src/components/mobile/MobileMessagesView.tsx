import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

interface MobileMessagesViewProps {
  peers: any[];
  activePeerId: string;
  setActivePeerId: (id: string) => void;
  messages: any[];
  currentUser: any;
  inputText: string;
  setInputText: (text: string) => void;
  onSend: (override?: string, failedId?: string) => void;
  onRemoveFailedMsg: (id: string) => void;
  onOpenUpiModal?: (session: any) => void;
}

export function MobileMessagesView({
  peers,
  activePeerId,
  setActivePeerId,
  messages,
  currentUser,
  inputText,
  setInputText,
  onSend,
  onRemoveFailedMsg,
}: MobileMessagesViewProps) {
  const [mobileSearch, setMobileSearch] = useState('');
  const [proposalAccepted, setProposalAccepted] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activePeer = peers.find(p => p.id === activePeerId);

  // Filter conversation
  const currentConversation = messages.filter(m => {
    const activeUserId = currentUser?.id || 'user-guest';
    if (!activePeerId || !m) return false;
    const isSentToActive = m.senderId === activeUserId && m.receiverId === activePeerId;
    const isRecvFromActive = m.senderId === activePeerId && m.receiverId === activeUserId;
    return isSentToActive || isRecvFromActive;
  });

  // Auto-scroll
  useEffect(() => {
    if (activePeerId) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentConversation.length, activePeerId]);

  // Last message helper
  const getPeerLastMessage = (peerId: string) => {
    if (!currentUser) return 'No messages yet';
    const peerMsgs = messages.filter(m => 
      (m.senderId === currentUser.id && m.receiverId === peerId) || 
      (m.senderId === peerId && m.receiverId === currentUser.id)
    );
    if (peerMsgs.length === 0) return 'No messages yet';
    return peerMsgs[peerMsgs.length - 1].text;
  };

  const filteredPeers = peers.filter(p => {
    if (currentUser?.id && p.id === currentUser.id) return false;
    if (!mobileSearch.trim()) return true;
    const q = mobileSearch.toLowerCase();
    const nameMatch = p.name?.toLowerCase().includes(q);
    const lastMsg = getPeerLastMessage(p.id).toLowerCase();
    return nameMatch || lastMsg.includes(q);
  });

  // If no peer is selected, show contacts list
  if (!activePeerId || !activePeer) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-120px)] pb-20 select-none">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-surface/95 backdrop-blur-md sticky top-0 z-30">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text">Messages</h1>
            <p className="text-xs text-muted">Direct chats with your peer mentors</p>
          </div>
          <span className="text-xs font-bold text-primary bg-primary-tint/30 px-2 py-0.5 rounded-full border border-primary/20">
            {filteredPeers.length} active
          </span>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted text-lg">
              search
            </span>
            <input
              type="text"
              value={mobileSearch}
              onChange={e => setMobileSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-xl text-xs font-medium text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 divide-y divide-border/60">
          {filteredPeers.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">
              No conversations found. Browse the Marketplace to connect with peers!
            </div>
          ) : (
            filteredPeers.map(peer => {
              const lastText = getPeerLastMessage(peer.id);
              return (
                <button
                  key={peer.id}
                  onClick={() => setActivePeerId(peer.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 active:bg-surface-2 transition-colors cursor-pointer"
                >
                  <div className="relative shrink-0">
                    <img
                      src={peer.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&q=80'}
                      alt={peer.name}
                      className="w-12 h-12 rounded-full object-cover border border-border"
                    />
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-surface" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text truncate">
                        {peer.name}
                      </span>
                      <span className="text-[10px] text-muted">Active</span>
                    </div>
                    <p className="text-xs text-muted truncate mt-0.5">
                      {lastText}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Active chat thread
  return (
    <div className="flex flex-col h-[calc(100dvh-120px)] relative select-none">
      {/* Sticky Thread Header */}
      <div className="px-3 py-2 bg-surface/95 backdrop-blur-md border-b border-border flex items-center justify-between sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setActivePeerId('')}
            aria-label="Back to messages list"
            className="w-8 h-8 rounded-full flex items-center justify-center text-text hover:bg-surface-2 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div className="relative shrink-0">
            <img
              src={activePeer.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&q=80'}
              alt={activePeer.name}
              className="w-9 h-9 rounded-full object-cover border border-border"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary rounded-full border-2 border-surface" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-text truncate">{activePeer.name}</h2>
            <div className="flex items-center gap-1 text-[10px] text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>Online • {activePeer.role === 'teacher' ? 'Verified Mentor' : 'Study Peer'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const offerText = `🤝 Hey ${activePeer.name}! Would you be up for a 45-minute skill swap session this week?`;
              onSend(offerText);
            }}
            title="Propose Study Exchange"
            className="px-2 py-1 bg-primary-tint/30 text-primary border border-primary/20 rounded-lg text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-xs">swap_horiz</span>
            <span>Swap</span>
          </button>
        </div>
      </div>

      {/* Pinned Micro-Bar for Active Session / Context */}
      <div className="px-3 py-1.5 bg-surface-2/80 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
          <p className="text-[11px] font-medium text-text truncate">
            Peer Match active • <span className="text-muted">Direct UPI & Token Barter supported</span>
          </p>
        </div>
        <span className="text-[10px] font-bold text-primary shrink-0">₹0 Fee</span>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5 pb-20 custom-scrollbar">
        {/* Day Divider */}
        <div className="flex items-center justify-center my-1">
          <span className="bg-surface-2 border border-border px-2.5 py-0.5 rounded-full text-muted text-[10px] font-bold tracking-tight">
            Today
          </span>
        </div>

        {/* Sample Interactive Proposal Card (Google Stitch Style) */}
        <div className="w-full bg-surface border border-border rounded-2xl p-3 shadow-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-accent-tint/40 flex items-center justify-center">
                <span className="material-symbols-outlined text-accent text-xs">swap_horiz</span>
              </div>
              <span className="text-xs font-bold text-text">Study Exchange Proposal</span>
            </div>
            <span className={clsx(
              "text-[10px] font-bold px-2 py-0.5 rounded-full",
              proposalAccepted ? "bg-primary-tint text-primary" : "bg-accent-tint text-accent"
            )}>
              {proposalAccepted ? 'Confirmed' : 'Pending'}
            </span>
          </div>

          <div className="bg-surface-2 rounded-xl p-2.5 my-2 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted text-[11px]">Topic</span>
              <span className="font-semibold text-text">Bipartite Graphs & DFS (45 min)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted text-[11px]">Exchange Mode</span>
              <span className="font-bold text-primary">1 Skill Token (Zero Upfront)</span>
            </div>
          </div>

          {!proposalAccepted ? (
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setProposalAccepted(true);
                  onSend("✅ I've accepted the study exchange proposal! Let's lock in the time slot.");
                }}
                className="flex-1 h-8 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-hover active:scale-95 transition-all flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">lock</span>
                <span>Accept & Lock Slot</span>
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-primary font-bold text-center py-0.5 flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>Session proposal locked</span>
            </div>
          )}
        </div>

        {/* Real Message Bubbles */}
        {currentConversation.map((msg, index) => {
          const isSent = msg.senderId === (currentUser?.id || 'user-guest');
          const isSending = msg.status === 'sending';
          const isFailed = msg.status === 'failed';

          // Format timestamp
          const time = msg.createdAt 
            ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            : 'Just now';

          return (
            <div
              key={msg.id || index}
              className={clsx(
                "flex flex-col max-w-[85%] gap-0.5",
                isSent ? "items-end self-end ml-auto" : "items-start self-start mr-auto"
              )}
            >
              <div
                className={clsx(
                  "px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs break-words",
                  isSent
                    ? "bg-primary text-on-primary rounded-tr-xs"
                    : "bg-surface border border-border text-text rounded-tl-xs"
                )}
              >
                <p>{msg.text}</p>
                {isSending && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-on-primary/80 font-normal mt-0.5">
                    <span className="material-symbols-outlined text-xs animate-spin">schedule</span> Sending...
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 px-1">
                <span className="text-[10px] text-muted">{time}</span>
                {isSent && !isSending && !isFailed && (
                  <span className="material-symbols-outlined text-xs text-primary">done_all</span>
                )}
              </div>

              {isFailed && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-danger px-1">
                  <span>Failed</span>
                  <button
                    onClick={() => onSend(msg.text, msg.id)}
                    className="underline hover:opacity-80"
                  >
                    Retry
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => onRemoveFailedMsg(msg.id)}
                    className="underline hover:opacity-80"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Audio Waveform Voice Note Simulation */}
        <div className="flex flex-col items-start max-w-[85%] gap-0.5">
          <div className="bg-surface border border-border rounded-2xl rounded-tl-xs px-3 py-2 shadow-xs flex items-center gap-2.5 min-w-[200px]">
            <button
              type="button"
              onClick={() => setIsPlayingAudio(prev => !prev)}
              aria-label="Play audio note"
              className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-lg">
                {isPlayingAudio ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <div className="flex-1 flex items-center gap-1 h-5">
              <span className={`w-1 rounded-full bg-primary ${isPlayingAudio ? 'h-4 animate-pulse' : 'h-2'}`} />
              <span className={`w-1 rounded-full bg-primary ${isPlayingAudio ? 'h-5 animate-pulse' : 'h-3.5'}`} />
              <span className={`w-1 rounded-full bg-primary ${isPlayingAudio ? 'h-3 animate-pulse' : 'h-2'}`} />
              <span className="w-1 h-4 bg-border rounded-full" />
              <span className="w-1 h-2.5 bg-border rounded-full" />
              <span className="w-1 h-4 bg-border rounded-full" />
              <span className="w-1 h-1.5 bg-border rounded-full" />
            </div>
            <span className="text-[10px] text-muted font-mono tabular-nums">0:42</span>
          </div>
          <span className="text-[10px] text-muted px-1">Voice note preview</span>
        </div>

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Bottom Composer Dock (Fixed above bottom nav) */}
      <div className="fixed bottom-16 inset-x-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-border px-3 py-2 shadow-elevation-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
          className="flex items-center gap-2 max-w-lg mx-auto"
        >
          {/* Quick Proposal or Attachment Button */}
          <button
            type="button"
            onClick={() => {
              const codeMsg = "```typescript\n// Quick code snippet:\nconst solve = (n: number) => n > 0;\n```";
              onSend(codeMsg);
            }}
            title="Attach Code"
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-surface-2 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-xl">code</span>
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={`Message ${activePeer.name.split(' ')[0]}...`}
              className="w-full h-10 bg-surface border border-border rounded-full pl-4 pr-10 text-xs font-medium text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-inner"
            />
          </div>

          {/* Deep Emerald Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center hover:bg-primary-hover active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs shrink-0"
            aria-label="Send message"
          >
            <span className="material-symbols-outlined text-lg">arrow_upward</span>
          </button>
        </form>
      </div>
    </div>
  );
}
