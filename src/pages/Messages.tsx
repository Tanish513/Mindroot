import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { api, onPeersUpdated, onMessagesUpdated } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { AISkillMatchBanner } from '../components/chat/AISkillMatchBanner';
import { UpiPaymentModal, type UpiPaymentSession } from '../components/payment/UpiPaymentModal';
import { MobileMessagesView } from '../components/mobile/MobileMessagesView';

export function Messages() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const targetPeerId = searchParams.get('peerId') || location.state?.peerId || '';

  const currentUser = useAppStore(state => state.currentUser);
  const searchQuery = useAppStore(state => state.searchQuery);
  const [peers, setPeers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [activePeerId, setActivePeerId] = useState<string>(targetPeerId);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [upiSession, setUpiSession] = useState<UpiPaymentSession | null>(null);
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (targetPeerId) {
      setActivePeerId(targetPeerId);
    }
  }, [targetPeerId]);

  const loadData = useCallback(() => {
    const activeUser = currentUser || { id: 'user-guest', name: 'Guest' };
    Promise.all([api.getPeers(), api.getMessages(activeUser.id)])
      .then(([peersData, messagesData]) => {
        const rawPeers = Array.isArray(peersData) ? peersData : [];
        // Filter out logged-in user so they do not see themselves in chat contacts
        const validPeers = rawPeers.filter(p => p && p.id && (!activeUser.id || p.id !== activeUser.id));
        const validMsgs = Array.isArray(messagesData) ? messagesData : [];
        setPeers(validPeers);
        setMessages(prev => {
          // Preserve any optimistic messages that are currently sending/failed
          const pendingOpt = prev.filter(m => m.status === 'sending' || m.status === 'failed');
          const merged = [...validMsgs];
          pendingOpt.forEach(opt => {
            const alreadyDelivered = merged.some(m => 
              m.id === opt.id || 
              (m.senderId === opt.senderId && m.receiverId === opt.receiverId && m.text === opt.text)
            );
            if (!alreadyDelivered) {
              merged.push(opt);
            }
          });
          return merged;
        });
        if (validPeers.length > 0 && !activePeerId && !targetPeerId) {
          setActivePeerId(validPeers[0].id);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load messages data:', err);
        setLoading(false);
      });
  }, [currentUser, activePeerId, targetPeerId]);

  useEffect(() => {
    loadData();
    const unsubPeers = onPeersUpdated(() => {
      loadData();
    });
    const unsubMsgs = onMessagesUpdated(() => {
      const activeUser = currentUser || { id: 'user-guest', name: 'Guest' };
      api.getMessages(activeUser.id)
        .then(data => {
          if (Array.isArray(data)) {
            setMessages(prev => {
              const pendingOpt = prev.filter(m => m.status === 'sending' || m.status === 'failed');
              const merged = [...data];
              pendingOpt.forEach(opt => {
                const alreadyDelivered = merged.some(m => 
                  m.id === opt.id || 
                  (m.senderId === opt.senderId && m.receiverId === opt.receiverId && m.text === opt.text)
                );
                if (!alreadyDelivered) {
                  merged.push(opt);
                }
              });
              return merged;
            });
          }
        })
        .catch(console.error);
    });
    // Setup message polling as fallback for multi-laptop sync
    const interval = setInterval(() => {
      const activeUser = currentUser || { id: 'user-guest', name: 'Guest' };
      api.getMessages(activeUser.id)
        .then(data => {
          if (Array.isArray(data)) {
            setMessages(prev => {
              const pendingOpt = prev.filter(m => m.status === 'sending' || m.status === 'failed');
              const merged = [...data];
              pendingOpt.forEach(opt => {
                const alreadyDelivered = merged.some(m => 
                  m.id === opt.id || 
                  (m.senderId === opt.senderId && m.receiverId === opt.receiverId && m.text === opt.text)
                );
                if (!alreadyDelivered) {
                  merged.push(opt);
                }
              });
              return merged;
            });
          }
        })
        .catch(console.error);
    }, 2000);
    return () => {
      unsubPeers();
      unsubMsgs();
      clearInterval(interval);
    };
  }, [loadData, currentUser]);

  const activePeer = peers.find(p => p.id === activePeerId);

  // Filter messages belonging to the current conversation
  const currentConversation = (Array.isArray(messages) ? messages : []).filter(m => {
    const activeUser = currentUser || { id: 'user-guest', name: 'Guest' };
    if (!activePeerId || !m) return false;
    const isSentToActive = m.senderId === activeUser.id && m.receiverId === activePeerId;
    const isRecvFromActive = m.senderId === activePeerId && m.receiverId === activeUser.id;
    return isSentToActive || isRecvFromActive;
  });

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation.length, activePeerId]);

  const handleSend = (msgTextOverride?: string, failedIdToRemove?: string) => {
    const activeUser = currentUser || { id: 'user-guest', name: 'Guest' };
    const textToSend = msgTextOverride || inputText;
    if (!textToSend.trim() || !activePeerId) return;

    const tempId = failedIdToRemove || ('opt-msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6));
    const optimisticMsg = {
      id: tempId,
      senderId: activeUser.id,
      receiverId: activePeerId,
      text: textToSend,
      status: 'sending' as const,
      createdAt: new Date().toISOString()
    };

    if (failedIdToRemove) {
      setMessages(prev => prev.map(m => m.id === failedIdToRemove ? optimisticMsg : m));
    } else {
      setMessages(prev => [...(Array.isArray(prev) ? prev : []), optimisticMsg]);
      setInputText('');
    }

    const payload = {
      senderId: activeUser.id,
      receiverId: activePeerId,
      text: textToSend
    };

    api.postMessage(payload)
      .then(savedMsg => {
        if (savedMsg) {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...savedMsg, status: 'sent' } : m));
        } else {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
        }
      })
      .catch(err => {
        console.error('Failed to send message:', err);
        // Mark optimistic message as failed with retry/remove option
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      });
  };

  const handleRemoveFailedMsg = (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  // Get preview of last message for each peer
  const getPeerLastMessage = (peerId: string) => {
    if (!currentUser) return 'No messages yet';
    const peerMsgs = messages.filter(m => 
      (m.senderId === currentUser.id && m.receiverId === peerId) || 
      (m.senderId === peerId && m.receiverId === currentUser.id)
    );
    if (peerMsgs.length === 0) return 'No messages yet';
    return peerMsgs[peerMsgs.length - 1].text;
  };

  const filteredPeers = peers.filter(peer => {
    if (currentUser?.id && peer.id === currentUser.id) return false;
    if (searchQuery.trim() === '') return true;
    const query = searchQuery.toLowerCase();
    const nameMatch = peer.name?.toLowerCase().includes(query);
    const lastMsg = getPeerLastMessage(peer.id).toLowerCase();
    const msgMatch = lastMsg.includes(query);
    const skillMatch = Array.isArray(peer.userSkills) && peer.userSkills.some((us: any) => us.skill?.name?.toLowerCase().includes(query));
    return nameMatch || msgMatch || skillMatch;
  });

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col space-y-4">
      {/* Dedicated Mobile Chat Thread (< md) */}
      <div className="block md:hidden flex-1 min-h-0">
        <MobileMessagesView
          peers={peers}
          activePeerId={activePeerId}
          setActivePeerId={setActivePeerId}
          messages={messages}
          currentUser={currentUser}
          inputText={inputText}
          setInputText={setInputText}
          onSend={handleSend}
          onRemoveFailedMsg={handleRemoveFailedMsg}
          onOpenUpiModal={(session) => {
            setUpiSession(session);
            setIsUpiModalOpen(true);
          }}
        />
      </div>

      {/* Untouched Desktop Chat View (>= md) */}
      <div className="hidden md:flex flex-col flex-1 min-h-0 space-y-4">
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Messages & Coordination</h1>
          <p className="text-xs text-muted mt-0.5">Direct chat with verified peers and mentors to arrange live sessions.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted text-xs font-semibold">
          Loading conversation channels...
        </div>
      ) : (
        <div className="flex flex-1 gap-5 min-h-0">
          {/* Conversations List */}
          <div className="w-80 shrink-0 bg-surface border border-border rounded-2xl overflow-hidden flex flex-col shadow-xs">
            <div className="p-4 border-b border-border bg-surface-2 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-sm text-text">Conversations</h2>
              <span className="text-[11px] font-semibold text-muted bg-surface px-2 py-0.5 rounded-md border border-border">
                {filteredPeers.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-border/60">
              {filteredPeers.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted font-medium">No contacts found</div>
              ) : (
                filteredPeers.map((peer, i) => (
                  <button
                    key={peer.id}
                    onClick={() => setActivePeerId(peer.id)}
                    className={`w-full flex items-center gap-3 p-3.5 text-left transition-all cursor-pointer ${
                      activePeerId === peer.id 
                        ? 'bg-primary-tint/60 border-l-4 border-l-primary text-text font-bold' 
                        : 'hover:bg-surface-2 text-muted'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img 
                        src={peer.avatar || `https://i.pravatar.cc/150?img=${i + 11}`} 
                        alt={`${peer.name}'s profile avatar`} 
                        className="w-10 h-10 rounded-xl object-cover border border-border" 
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full ring-2 ring-surface" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-bold truncate text-text">{peer.name}</span>
                        {peer.hourlyRate && (
                          <span className="text-[10px] text-primary font-bold">₹{peer.hourlyRate}/hr</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted truncate font-normal">{getPeerLastMessage(peer.id)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Active Thread */}
          <div className="flex-1 bg-surface border border-border rounded-2xl overflow-hidden flex flex-col shadow-xs min-h-0">
            {activePeer ? (
              <>
                <div className="p-3.5 border-b border-border bg-surface-2 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <img 
                        src={activePeer.avatar || "https://i.pravatar.cc/150?img=12"} 
                        alt={`${activePeer.name}'s profile avatar`} 
                        className="w-10 h-10 rounded-xl object-cover border border-border" 
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full ring-2 ring-surface" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-text flex items-center gap-1.5">
                        <span>{activePeer.name}</span>
                        {activePeer.trustScore > 4.8 && (
                          <span className="material-symbols-outlined text-primary text-sm" title="Verified Peer">verified</span>
                        )}
                      </h3>
                      <span className="text-[11px] text-muted flex items-center gap-1 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                        ₹{activePeer.hourlyRate || 499}/hr • Available for Mentoring
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    onClick={() => {
                      setUpiSession({
                        id: `msg-pay-${Date.now()}`,
                        title: `Mentoring Session with ${activePeer.name}`,
                        amount: activePeer.hourlyRate || 499,
                        teacherId: activePeer.id,
                        teacherName: activePeer.name,
                        teacherAvatar: activePeer.avatar,
                        teacherUpiId: activePeer.upiId
                      });
                      setIsUpiModalOpen(true);
                    }}
                    className="text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold"
                  >
                    <span className="material-symbols-outlined text-sm">payments</span>
                    <span>Pay ₹{activePeer.hourlyRate || 499}</span>
                  </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-2/30 custom-scrollbar">
                  <AISkillMatchBanner
                    currentUser={currentUser}
                    peer={activePeer}
                    onProposeExchange={async (give, take) => {
                      const proposalText = `🤝 SKILL EXCHANGE PROPOSAL:\nI teach: ${give}\nYou teach: ${take}\nWould you like to schedule a 45-minute live barter session?`;
                      handleSend(proposalText);
                    }}
                  />

                  {currentConversation.length === 0 ? (
                    <EmptyState
                      icon="forum"
                      title="No messages yet"
                      description="Send a message or propose a skill exchange to coordinate your lecture!"
                    />
                  ) : (
                    currentConversation.map((msg, i) => {
                      const isMe = msg.senderId === currentUser?.id;
                      const isSending = msg.status === 'sending';
                      const isFailed = msg.status === 'failed';
                      return (
                        <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-xs relative leading-relaxed ${
                            isFailed
                              ? 'bg-danger/10 text-danger border border-danger/20 rounded-tr-xs font-medium'
                              : isMe
                                ? `bg-primary text-on-primary rounded-tr-xs font-medium shadow-xs ${isSending ? 'opacity-70' : ''}`
                                : 'bg-surface text-text rounded-tl-xs shadow-xs border border-border font-medium'
                          }`}>
                            <p>{msg.text}</p>
                            {isSending && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-on-primary/80 font-normal mt-1">
                                <span className="material-symbols-outlined text-xs animate-spin">schedule</span> Sending...
                              </span>
                            )}
                          </div>
                          {isFailed && (
                            <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-danger">
                              <span className="flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-xs">error</span> Failed to send
                              </span>
                              <button 
                                onClick={() => handleSend(msg.text, msg.id)}
                                className="underline hover:opacity-80 cursor-pointer"
                              >
                                Retry
                              </button>
                              <span>•</span>
                              <button 
                                onClick={() => handleRemoveFailedMsg(msg.id)}
                                className="underline hover:opacity-80 cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-3 border-t border-border bg-surface shrink-0 flex gap-2.5 items-center">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message to your peer..."
                    className="flex-1 px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-xs font-medium text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-surface transition-all"
                  />
                  <Button variant="primary" className="px-4 py-2 font-bold flex items-center gap-1" onClick={() => handleSend()}>
                    <span className="material-symbols-outlined text-sm">send</span>
                    <span>Send</span>
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <EmptyState
                  icon="chat"
                  title="No conversation selected"
                  description="Choose a peer from the left panel to begin discussing exchanges or live sessions."
                />
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Direct UPI Payment Modal in Chat */}
      <UpiPaymentModal
        isOpen={isUpiModalOpen}
        onClose={() => setIsUpiModalOpen(false)}
        session={upiSession}
        onSuccess={(details) => {
          const payMsgText = `💳 Sent UPI payment of ₹${details.amount} (Ref: ${details.utr}${details.isDemo ? ' [Demo Mode]' : ''})`;
          handleSend(payMsgText);
          setIsUpiModalOpen(false);
        }}
      />
    </div>
  );
}
