import { useState, useEffect, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { api, onPeersUpdated, onMessagesUpdated } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { AISkillMatchBanner } from '../components/chat/AISkillMatchBanner';

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

  useEffect(() => {
    if (targetPeerId) {
      setActivePeerId(targetPeerId);
    }
  }, [targetPeerId]);

  const loadData = useCallback(() => {
    const activeUser = currentUser || { id: 'user-guest', name: 'Guest' };
    Promise.all([api.getPeers(), api.getMessages(activeUser.id)])
      .then(([peersData, messagesData]) => {
        const validPeers = Array.isArray(peersData) ? peersData : [];
        const validMsgs = Array.isArray(messagesData) ? messagesData : [];
        setPeers(validPeers);
        setMessages(prev => {
          // Preserve any optimistic messages that are currently sending/failed
          const pendingOpt = prev.filter(m => m.status === 'sending' || m.status === 'failed');
          const merged = [...validMsgs];
          pendingOpt.forEach(opt => {
            if (!merged.some(m => m.id === opt.id)) {
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
                if (!merged.some(m => m.id === opt.id)) {
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
                if (!merged.some(m => m.id === opt.id)) {
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
    if (searchQuery.trim() === '') return true;
    const query = searchQuery.toLowerCase();
    const nameMatch = peer.name?.toLowerCase().includes(query);
    const lastMsg = getPeerLastMessage(peer.id).toLowerCase();
    const msgMatch = lastMsg.includes(query);
    const skillMatch = Array.isArray(peer.userSkills) && peer.userSkills.some((us: any) => us.skill?.name?.toLowerCase().includes(query));
    return nameMatch || msgMatch || skillMatch;
  });

  return (
    <div className="max-w-container_max mx-auto h-[calc(100vh-160px)] flex flex-col select-none">
      <div className="mb-6 shrink-0">
        <h2 className="text-headline-lg font-headline-lg text-on-surface mb-1">Messages</h2>
        <p className="text-body-md font-body-md text-on-surface-variant">Chat with peers to coordinate exchanges.</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-on-surface-variant">Loading conversation channels...</div>
      ) : (
        <div className="flex flex-1 gap-6 min-h-0">
          {/* Conversations List */}
          <div className="w-80 shrink-0 bg-surface border border-outline-variant rounded-2xl overflow-hidden flex flex-col shadow-elevation-1">
            <div className="p-5 border-b border-outline-variant bg-surface-container-low shrink-0">
              <h3 className="font-black text-base text-on-surface">Conversations</h3>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {filteredPeers.length === 0 ? (
                <div className="p-6 text-center text-xs text-on-surface-variant font-bold">No contacts found</div>
              ) : (
                filteredPeers.map((peer, i) => (
                  <button
                    key={peer.id}
                    onClick={() => setActivePeerId(peer.id)}
                    className={`w-full flex items-center gap-3 p-4 border-b border-outline-variant text-left transition-all duration-200 ${
                      activePeerId === peer.id 
                        ? 'bg-primary-container border-l-4 border-l-primary text-on-primary-container font-bold' 
                        : 'hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img src={`https://i.pravatar.cc/150?img=${i + 11}`} alt={`${peer.name}'s profile avatar`} className="w-10 h-10 rounded-full object-cover ring-2 ring-teaching-emerald/30" />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-teaching-emerald rounded-full ring-2 ring-surface" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-black truncate text-on-surface">{peer.name}</span>
                      </div>
                      <p className="text-xs text-on-surface-variant truncate font-bold">{getPeerLastMessage(peer.id)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Active Thread */}
          <div className="flex-1 bg-surface border border-outline-variant rounded-2xl overflow-hidden flex flex-col shadow-elevation-1 min-h-0">
            {activePeer ? (
              <>
                <div className="p-4 border-b border-outline-variant bg-surface-container-low flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img src="https://i.pravatar.cc/150?img=12" alt={`${activePeer.name}'s profile avatar`} className="w-10 h-10 rounded-full object-cover ring-2 ring-teaching-emerald/30" />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-teaching-emerald rounded-full ring-2 ring-surface" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-on-surface">{activePeer.name}</h4>
                      <span className="text-xs text-teaching-emerald flex items-center gap-1 font-bold">
                        <span className="w-2 h-2 rounded-full bg-teaching-emerald inline-block" /> ₹{activePeer.hourlyRate || 499}/hr • Available
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        const amount = activePeer.hourlyRate || 499;
                        const orderData = await api.createSessionPaymentOrder({
                          sessionId: `msg-pay-${Date.now()}`,
                          mentorId: activePeer.id,
                          amount
                        });

                        const options = {
                          key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TUrtuundUxD7Jh',
                          amount: orderData.amount,
                          currency: orderData.currency || 'INR',
                          name: 'Mindroot Skill Exchange',
                          description: `Payment to ${activePeer.name}`,
                          image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
                          order_id: orderData.orderId,
                          handler: async (response: any) => {
                            await api.verifySessionPayment({
                              razorpay_order_id: response.razorpay_order_id,
                              razorpay_payment_id: response.razorpay_payment_id,
                              razorpay_signature: response.razorpay_signature,
                              amount,
                              sessionData: {
                                title: `Mentoring Payment to ${activePeer.name}`,
                                teacherId: activePeer.id,
                                teacherName: activePeer.name,
                                studentId: currentUser?.id || 'alex-id',
                                studentName: currentUser?.name || 'Alex Chen'
                              }
                            });

                            // Post payment confirmation in chat
                            const payMsg = {
                              senderId: currentUser?.id || 'alex-id',
                              receiverId: activePeer.id,
                              text: `💳 Sent payment of ₹${amount} via Razorpay (Ref: ${response.razorpay_payment_id})`
                            };
                            api.postMessage(payMsg).then(m => {
                              if (m) setMessages(prev => [...prev, m]);
                            });
                          },
                          prefill: {
                            name: currentUser?.name || 'Alex Chen',
                            email: currentUser?.email || 'alex@mindroot.edu'
                          },
                          theme: { color: '#2563eb' }
                        };

                        const rzp = new (window as any).Razorpay(options);
                        rzp.open();
                      } catch (err) {
                        console.error('Chat payment error:', err);
                        alert('Could not start payment. Please try again.');
                      }
                    }}
                    className="px-3.5 py-1.5 bg-teaching-emerald hover:bg-teaching-emerald-hover text-on-teaching-emerald rounded-xl text-xs font-black flex items-center gap-1.5 shadow-elevation-1 transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[15px]">payments</span>
                    Pay ₹{activePeer.hourlyRate || 499}
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-container-low/40 custom-scrollbar">
                  <AISkillMatchBanner
                    currentUser={currentUser}
                    peer={activePeer}
                    onProposeExchange={async (give, take) => {
                      const proposalText = `🤝 SKILL EXCHANGE PROPOSAL:\nI teach: ${give}\nYou teach: ${take}\nWould you like to schedule a 45-minute live barter session?`;
                      handleSend(proposalText);
                    }}
                  />

                  {currentConversation.length === 0 ? (
                    <div className="text-center text-on-surface-variant py-16 text-xs flex flex-col items-center justify-center space-y-2">
                      <span className="material-symbols-outlined text-3xl text-primary">chat</span>
                      <p className="font-bold text-on-surface">No messages yet</p>
                      <p className="text-on-surface-variant font-medium">Send a message to coordinate your exchange!</p>
                    </div>
                  ) : (
                    currentConversation.map((msg, i) => {
                      const isMe = msg.senderId === currentUser?.id;
                      const isSending = msg.status === 'sending';
                      const isFailed = msg.status === 'failed';
                      return (
                        <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-xs relative ${
                            isFailed
                              ? 'bg-alert-rose-container text-on-alert-rose-container border border-alert-rose/20 rounded-tr-none font-medium'
                              : isMe
                                ? `bg-primary text-on-primary rounded-tr-none font-bold shadow-elevation-1 ${isSending ? 'opacity-70' : ''}`
                                : 'bg-surface text-on-surface rounded-tl-none shadow-elevation-1 border border-outline-variant font-medium'
                          }`}>
                            <p>{msg.text}</p>
                            {isSending && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-on-primary/80 font-normal mt-1">
                                <span className="material-symbols-outlined text-[12px] animate-spin">schedule</span> Sending...
                              </span>
                            )}
                          </div>
                          {isFailed && (
                            <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-alert-rose">
                              <span className="flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-xs">error</span> Failed to send
                              </span>
                              <button 
                                onClick={() => handleSend(msg.text, msg.id)}
                                className="underline hover:text-alert-rose-hover"
                              >
                                Retry
                              </button>
                              <span>•</span>
                              <button 
                                onClick={() => handleRemoveFailedMsg(msg.id)}
                                className="underline hover:text-alert-rose-hover"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-4 border-t border-outline-variant bg-surface shrink-0 flex gap-3 items-center">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-medium text-on-surface placeholder:text-neutral-subtle focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-surface transition-all duration-200"
                  />
                  <Button variant="primary" className="px-4 py-2 font-bold" onClick={() => handleSend()}>
                    <span className="material-symbols-outlined text-sm">send</span>
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-on-surface-variant">
                Select a conversation to start chatting.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
