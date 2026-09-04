import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { api, onMessagesUpdated, onSessionsUpdated, calcSessionRewardPoints } from '../lib/api';
import { triggerNativeNotification, registerServiceWorker, requestNotificationPermission } from '../lib/notifications';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// Web Audio API sound chime synthesizer for native audio feedback without external audio files
function playNotificationChime(type: 'message' | 'reminder') {
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

    if (type === 'reminder') {
      // Urgent 2-tone bell chime for 5-min lecture reminder
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
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

  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'message' | 'reminder';
    title: string;
    body: string;
    link?: string;
    avatar?: string;
  }>>([]);

  const seenMessageIds = useRef<Set<string>>(new Set());
  const remindedSessionIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  const triggerToast = useCallback((
    type: 'message' | 'reminder',
    title: string,
    body: string,
    link?: string,
    avatar?: string
  ) => {
    const toastId = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newToast = { id: toastId, type, title, body, link, avatar };
    
    setToasts(prev => [newToast, ...prev].slice(0, 4));
    playNotificationChime(type);

    // Native browser push notification if permitted
    triggerNativeNotification({ title, body, url: link, icon: avatar });

    // Auto dismiss after 7 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 7000);
  }, []);

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
        const sessions = await api.getSessions();
        if (!Array.isArray(sessions)) return;

        const now = Date.now();

        sessions.forEach(session => {
          if (!session || !session.id) return;

          const isTeacher = session.teacherId === currentUser.id || session.teacher?.id === currentUser.id;
          const isStudent = session.studentId === currentUser.id || (Array.isArray(session.students) && session.students.some((st: any) => st.id === currentUser.id));

          if (!isTeacher && !isStudent) return;

          const prevState = notifiedSessionStates.current.get(session.id);
          const currentState = session.status;

          // 1. Alert Teacher when a new student booking request arrives (status = pending)
          if (isTeacher && currentState === 'pending' && prevState !== 'pending') {
            notifiedSessionStates.current.set(session.id, 'pending');
            const studentName = session.student?.name || 'Student';
            const title = `📩 New Student Booking Request`;
            const body = `${studentName} requested to book "${session.title}". Click to review and approve in Teacher Portal.`;
            const link = `/teacher`;

            addNotification({
              type: 'session',
              title,
              body,
              link,
              avatar: session.student?.avatar || `https://i.pravatar.cc/150?img=11`
            });
            triggerToast('reminder', title, body, link);
          }

          // 2. Alert Student when Teacher approves their booking request (status = confirmed)
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

          // 3. Trigger 5-minute reminder if lecture is starting in <= 5 minutes
          if (currentState === 'confirmed' || currentState === 'live') {
            if (!session.scheduledAt || remindedSessionIds.current.has(session.id)) return;

            const startTime = new Date(session.scheduledAt).getTime();
            const timeUntilStart = startTime - now;
            const fiveMinMs = 5 * 60 * 1000;

            if (timeUntilStart <= fiveMinMs && timeUntilStart >= -2 * 60 * 1000) {
              remindedSessionIds.current.add(session.id);
              const partnerName = isTeacher ? (session.student?.name || 'Student') : (session.teacher?.name || 'Teacher');
              const title = `⏰ Lecture Starting in 5 Minutes!`;
              const body = `"${session.title}" with ${partnerName} is starting soon. Click to join classroom!`;
              const link = `/live/${session.id}`;

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
    const interval = setInterval(checkLectureReminders, 5000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [currentUser, addNotification, triggerToast]);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

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
              if (toast.link) {
                navigate(toast.link);
                dismissToast(toast.id);
              }
            }}
          >
            <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${toast.type === 'reminder' ? 'bg-learning-amber' : 'bg-primary'}`} />

            <div className="flex items-start justify-between gap-3 pl-1">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {toast.avatar ? (
                  <img src={toast.avatar} alt="Avatar" className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-primary/30" />
                ) : (
                  <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center ${toast.type === 'reminder' ? 'bg-learning-amber-container text-on-learning-amber-container' : 'bg-primary-container text-on-primary-container'}`}>
                    <span className="material-symbols-outlined text-lg">{toast.type === 'reminder' ? 'alarm' : 'chat'}</span>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-xs font-black text-on-surface truncate">{toast.title}</h4>
                  </div>
                  <p className="text-xs text-on-surface-variant font-medium line-clamp-2 leading-relaxed">{toast.body}</p>

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
