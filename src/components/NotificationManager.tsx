import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  api, 
  onMessagesUpdated, 
  onSessionsUpdated, 
  onPaymentReceived, 
  calcSessionRewardPoints,
  getSessionApproverId,
  shouldSendJoinReminder,
  onSessionRequestCreated,
  onSessionStatusUpdated
} from '../lib/api';
import { triggerNativeNotification, registerServiceWorker, requestNotificationPermission } from '../lib/notifications';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export interface ToastItem {
  id: string;
  type: 'message' | 'reminder' | 'payment' | 'request';
  title: string;
  body: string;
  link?: string;
  avatar?: string;
  sessionId?: string;
  sessionTitle?: string;
  studentName?: string;
  inFlight?: boolean;
}

// Web Audio API sound chime synthesizer for native audio feedback without external audio files
function playNotificationChime(type: 'message' | 'reminder' | 'payment' | 'request') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'payment') {
      // Triumphant 3-tone ascending fanfare for verified payment
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.start(now);
      osc.stop(now + 0.8);
    } else if (type === 'reminder') {
      // Urgent 2-tone bell chime for 5-min lecture reminder
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === 'request') {
      // Distinct double chime for student booking request
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.14); // E5
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.55);
    } else {
      // Soft pleasant pop chime for new message
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch {}
}

export function NotificationManager() {
  const { currentUser, addNotification } = useAppStore();
  const navigate = useNavigate();

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const seenMessageIds = useRef<Set<string>>(new Set());
  const remindedSessionIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const triggerToast = useCallback((
    type: 'message' | 'reminder' | 'payment' | 'request',
    title: string,
    body: string,
    link?: string,
    avatar?: string,
    sessionId?: string,
    sessionTitle?: string,
    studentName?: string
  ) => {
    const toastId = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newToast: ToastItem = { 
      id: toastId, 
      type, 
      title, 
      body, 
      link, 
      avatar,
      sessionId,
      sessionTitle,
      studentName
    };
    
    setToasts(prev => [newToast, ...prev].slice(0, 4));
    playNotificationChime(type);

    // Native browser push notification if permitted
    triggerNativeNotification({ title, body, url: link, icon: avatar });

    // Requests stay active longer (12 seconds) so teachers have ample time to accept/decline
    const timeoutMs = type === 'request' ? 12000 : 7000;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, timeoutMs);
  }, []);

  useEffect(() => {
    const handleCustomToast = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent?.detail;
      if (detail && detail.title) {
        triggerToast(
          detail.type || 'reminder',
          detail.title,
          detail.body || '',
          detail.link,
          detail.avatar
        );
      }
    };
    window.addEventListener('app-toast', handleCustomToast);
    return () => window.removeEventListener('app-toast', handleCustomToast);
  }, [triggerToast]);

  const handleAcceptRequest = async (toast: ToastItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!toast.sessionId || toast.inFlight) return;
    setToasts(prev => prev.map(t => t.id === toast.id ? { ...t, inFlight: true } : t));
    try {
      await api.acceptSession(toast.sessionId);
      dismissToast(toast.id);
      triggerToast('reminder', '✅ Booking Accepted!', `You confirmed "${toast.sessionTitle || 'Session'}". Classroom is ready.`, `/live-room/${toast.sessionId}`);
    } catch (err: any) {
      setToasts(prev => prev.map(t => t.id === toast.id ? { ...t, inFlight: false } : t));
      alert(err.message || 'Failed to accept session');
    }
  };

  const handleDeclineRequest = async (toast: ToastItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!toast.sessionId || toast.inFlight) return;
    setToasts(prev => prev.map(t => t.id === toast.id ? { ...t, inFlight: true } : t));
    try {
      await api.declineSession(toast.sessionId);
      dismissToast(toast.id);
      triggerToast('message', 'Booking Declined', `You declined the booking request for "${toast.sessionTitle || 'Session'}". Any held tokens have been refunded.`);
    } catch (err: any) {
      setToasts(prev => prev.map(t => t.id === toast.id ? { ...t, inFlight: false } : t));
      alert(err.message || 'Failed to decline session');
    }
  };

  // Real-time socket listener for incoming student booking requests
  useEffect(() => {
    if (!currentUser || !currentUser.id) return;
    const unsub = onSessionRequestCreated((session: any) => {
      if (!session || !session.id) return;
      if (getSessionApproverId(session) === currentUser.id && session.status === 'pending') {
        const studentName = session.student?.name || 'Student';
        const title = `📩 New Student Booking Request`;
        const body = `${studentName} requested to book "${session.title}". Accept or decline below.`;
        const link = `/teacher`;

        addNotification({
          type: 'session',
          title,
          body,
          link,
          avatar: session.student?.avatar || `https://i.pravatar.cc/150?img=11`
        });

        triggerToast('request', title, body, link, session.student?.avatar, session.id, session.title, studentName);
      }
    });

    const unsubStatus = onSessionStatusUpdated((updatedSession: any) => {
      if (!updatedSession || !updatedSession.id) return;
      // If a pending request was already resolved, remove any corresponding request toast
      if (updatedSession.status !== 'pending') {
        setToasts(prev => prev.filter(t => t.sessionId !== updatedSession.id));
      }
    });

    return () => {
      unsub();
      unsubStatus();
    };
  }, [currentUser, addNotification, triggerToast]);

  // Listen for real-time peer UPI payments via Socket.io
  useEffect(() => {
    if (!currentUser || !currentUser.id) return;
    const unsub = onPaymentReceived((paymentData: any) => {
      // Alert the mentor if they received this payment
      if (paymentData.teacherId === currentUser.id) {
        const title = `🎉 ₹${paymentData.amount} Payment Received!`;
        const body = `${paymentData.studentName || 'Student'} completed payment for "${paymentData.sessionTitle || 'Mentoring Session'}". Classroom unlocked!`;
        const link = `/live/${paymentData.sessionId}`;

        addNotification({
          type: 'session',
          title,
          body,
          link
        });

        triggerToast('payment', title, body, link);
      }
    });

    return () => unsub();
  }, [currentUser, addNotification, triggerToast]);

  // Register Service Worker & request browser notification permission
  useEffect(() => {
    registerServiceWorker();
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      const handleFirstClick = () => {
        requestNotificationPermission().catch(() => undefined);
        window.removeEventListener('click', handleFirstClick);
      };
      window.addEventListener('click', handleFirstClick);
      return () => window.removeEventListener('click', handleFirstClick);
    }
  }, []);

  // 1. Real-time New Message Notifications
  useEffect(() => {
    if (!currentUser || !currentUser.id) return;

    const checkMessages = async () => {
      try {
        const userMsgs = await api.getMessages(currentUser.id);
        if (!Array.isArray(userMsgs)) return;

        // Seed initial message IDs on first load to prevent alerting historical messages
        if (!initialLoadDone.current) {
          userMsgs.forEach(m => { if (m && m.id) seenMessageIds.current.add(m.id); });
          initialLoadDone.current = true;
          return;
        }

        userMsgs.forEach(m => {
          if (!m || !m.id) return;
          if (m.receiverId === currentUser.id && m.senderId !== currentUser.id) {
            if (!seenMessageIds.current.has(m.id)) {
              seenMessageIds.current.add(m.id);

              const senderName = m.sender?.name || 'Peer Student';
              const title = `💬 New Message from ${senderName}`;
              const body = m.text || 'Sent you a message.';
              const link = `/messages?peerId=${m.senderId}`;

              addNotification({
                type: 'message',
                title,
                body,
                link,
                avatar: m.sender?.avatar
              });

              triggerToast('message', title, body, link, m.sender?.avatar);
            }
          }
        });
      } catch (err) {
        console.warn('Error checking message notifications:', err);
      }
    };

    checkMessages();
    const unsub = onMessagesUpdated(() => checkMessages());
    const interval = setInterval(checkMessages, 5000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [currentUser, addNotification, triggerToast]);

  // 2. 5-Minute Lecture Reminder Check & Booking Request Alerts
  const notifiedSessionStates = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!currentUser || !currentUser.id) return;

    const checkLectureReminders = async () => {
      try {
        const token = localStorage.getItem('mindroot_auth_token');
        if (!token) return;
        const sessions = await api.getSessions();
        if (!Array.isArray(sessions)) return;

        const now = Date.now();

        sessions.forEach(session => {
          if (!session || !session.id) return;

          const approverId = getSessionApproverId(session);
          const isApprover = approverId === currentUser.id;
          const isParticipant = session.studentId === currentUser.id || session.teacherId === currentUser.id || (Array.isArray(session.students) && session.students.some((st: any) => st.id === currentUser.id));

          if (!isApprover && !isParticipant) return;

          const prevState = notifiedSessionStates.current.get(session.id);
          const currentState = session.status;

          // 1. Alert Approver (Teacher/Mentor) when a new student booking request arrives (status = pending)
          if (isApprover && currentState === 'pending' && prevState !== 'pending') {
            notifiedSessionStates.current.set(session.id, 'pending');
            const studentName = session.student?.name || 'Student';
            const title = `📩 New Student Booking Request`;
            const body = `${studentName} requested to book "${session.title}". Accept or decline below.`;
            const link = `/teacher`;

            addNotification({
              type: 'session',
              title,
              body,
              link,
              avatar: session.student?.avatar || `https://i.pravatar.cc/150?img=11`
            });
            triggerToast('request', title, body, link, session.student?.avatar, session.id, session.title, studentName);
          }

          // 2. Alert Student when Teacher approves their booking request (status = confirmed)
          const isStudent = session.studentId === currentUser.id || (Array.isArray(session.students) && session.students.some((st: any) => st.id === currentUser.id));
          if (isStudent && currentState === 'confirmed' && prevState === 'pending') {
            notifiedSessionStates.current.set(session.id, 'confirmed');
            const teacherName = session.teacher?.name || 'Mentor';
            const title = `✅ Booking Request Approved!`;
            const body = `${teacherName} approved your booking for "${session.title}". Your schedule has been updated!`;
            const link = `/schedule`;

            addNotification({
              type: 'session',
              title,
              body,
              link,
              avatar: session.teacher?.avatar || `https://i.pravatar.cc/150?img=12`
            });
            triggerToast('reminder', title, body, link);
          }

          // Alert Student when Teacher declines their booking request (status = declined or rejected)
          if (isStudent && (currentState === 'declined' || currentState === 'rejected') && prevState === 'pending') {
            notifiedSessionStates.current.set(session.id, currentState);
            const teacherName = session.teacher?.name || 'Mentor';
            const title = `❌ Booking Request Declined`;
            const body = `${teacherName} was unable to accept your booking for "${session.title}". Click to explore other mentors or select another time slot.`;
            const link = `/marketplace`;

            addNotification({
              type: 'session',
              title,
              body,
              link,
              avatar: session.teacher?.avatar || `https://i.pravatar.cc/150?img=12`
            });
            triggerToast('reminder', title, body, link);
          }

          // Alert Student when session is completed and loyalty reward points are earned
          const isTeacher = session.teacherId === currentUser.id || session.teacher?.id === currentUser.id;
          if (isStudent && !isTeacher && currentState === 'completed' && prevState && prevState !== 'completed') {
            notifiedSessionStates.current.set(session.id, 'completed');
            const points = calcSessionRewardPoints(session.durationMin);
            const title = `🏅 +${points} Reward Points Earned!`;
            const body = `You earned ${points} loyalty reward points for completing "${session.title}". Click to view available rewards!`;
            const link = `/rewards`;

            addNotification({
              type: 'session',
              title,
              body,
              link,
              avatar: session.teacher?.avatar || `https://i.pravatar.cc/150?img=12`
            });
            triggerToast('reminder', title, body, link);
          }

          // Track state
          if (!prevState) {
            notifiedSessionStates.current.set(session.id, currentState);
          }

          // 3. Trigger 5-minute reminder ONLY if confirmed/live and shouldSendJoinReminder returns true
          if (shouldSendJoinReminder(session, now)) {
            if (!remindedSessionIds.current.has(session.id)) {
              remindedSessionIds.current.add(session.id);
              const partnerName = isTeacher ? (session.student?.name || 'Student') : (session.teacher?.name || 'Teacher');
              const title = `⏰ Lecture Starting in 5 Minutes!`;
              const body = `"${session.title}" with ${partnerName} is starting soon. Click to join classroom!`;
              const link = `/live-room/${session.id}`;

              addNotification({
                type: 'reminder',
                title,
                body,
                link,
                avatar: `https://i.pravatar.cc/150?img=22`
              });

              triggerToast('reminder', title, body, link);
            }
          }
        });
      } catch (err) {
        console.warn('Error checking lecture reminders:', err);
      }
    };

    checkLectureReminders();
    const unsub = onSessionsUpdated(() => checkLectureReminders());
    const interval = setInterval(checkLectureReminders, 20000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [currentUser, addNotification, triggerToast]);

  return (
    <div className="fixed top-20 right-4 md:right-8 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="pointer-events-auto bg-surface text-on-surface border border-outline-variant rounded-2xl p-4 shadow-elevation-3 backdrop-blur-md relative overflow-hidden group cursor-pointer"
            onClick={() => {
              if (toast.link && toast.type !== 'request') {
                navigate(toast.link);
                dismissToast(toast.id);
              }
            }}
          >
            <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
              toast.type === 'request'
                ? 'bg-primary'
                : toast.type === 'reminder' 
                  ? 'bg-learning-amber' 
                  : (toast.type === 'payment' ? 'bg-teaching-emerald' : 'bg-primary')
            }`} />

            <div className="flex items-start justify-between gap-3 pl-1">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {toast.avatar ? (
                  <img src={toast.avatar} alt="Avatar" className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-primary/30" />
                ) : (
                  <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center ${
                    toast.type === 'request'
                      ? 'bg-primary/20 text-primary'
                      : toast.type === 'reminder' 
                        ? 'bg-learning-amber-container text-on-learning-amber-container' 
                        : (toast.type === 'payment' ? 'bg-teaching-emerald/20 text-teaching-emerald' : 'bg-primary-container text-on-primary-container')
                  }`}>
                    <span className="material-symbols-outlined text-lg">
                      {toast.type === 'request' ? 'mail' : (toast.type === 'reminder' ? 'alarm' : (toast.type === 'payment' ? 'payments' : 'chat'))}
                    </span>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-xs font-black text-on-surface truncate">{toast.title}</h4>
                  </div>
                  <p className="text-xs text-on-surface-variant font-medium line-clamp-2 leading-relaxed">{toast.body}</p>

                  {/* Request Toast: Interactive Accept & Decline Buttons */}
                  {toast.type === 'request' && toast.sessionId && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        disabled={toast.inFlight}
                        onClick={(e) => handleAcceptRequest(toast, e)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-teaching-emerald hover:bg-teaching-emerald/90 text-on-teaching-emerald font-black text-xs shadow-elevation-1 transition-all flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span>{toast.inFlight ? 'Accepting...' : 'Accept'}</span>
                      </button>
                      <button
                        disabled={toast.inFlight}
                        onClick={(e) => handleDeclineRequest(toast, e)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-surface-container hover:bg-alert-rose/15 text-alert-rose font-black text-xs border border-outline-variant transition-all flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">cancel</span>
                        <span>Decline</span>
                      </button>
                    </div>
                  )}

                  {toast.type === 'reminder' && (
                    <div className="mt-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (toast.link) navigate(toast.link);
                          dismissToast(toast.id);
                        }}
                        className="w-full py-1.5 px-3 rounded-xl bg-learning-amber hover:bg-learning-amber-hover text-on-learning-amber font-extrabold text-xs shadow-elevation-1 transition-all flex items-center justify-center gap-1 active:scale-98"
                      >
                        <span className="material-symbols-outlined text-sm">video_call</span>
                        <span>Join Classroom Live</span>
                      </button>
                    </div>
                  )}

                  {toast.type === 'payment' && (
                    <div className="mt-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (toast.link) navigate(toast.link);
                          dismissToast(toast.id);
                        }}
                        className="w-full py-1.5 px-3 rounded-xl bg-teaching-emerald hover:bg-teaching-emerald/90 text-on-teaching-emerald font-extrabold text-xs shadow-elevation-1 transition-all flex items-center justify-center gap-1 active:scale-98"
                      >
                        <span className="material-symbols-outlined text-sm">video_chat</span>
                        <span>Open Live Classroom</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast(toast.id);
                }}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors shrink-0"
                title="Dismiss"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
