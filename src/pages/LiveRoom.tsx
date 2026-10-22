import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { io, type Socket } from 'socket.io-client';
import { useAppStore } from '../store/useAppStore';
import { api, resolveSessionRole, getAuthItem } from '../lib/api';
import { UpiPaymentModal } from '../components/payment/UpiPaymentModal';
import { SessionNotesPanel } from '../components/notes/SessionNotesPanel';

const safeUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
};

type Workspace = 'whiteboard' | 'notes' | 'code' | 'screenshare' | 'none';
type ChatMessage = { id: string; sender: string; text: string; role?: string; own?: boolean };
type DrawingTool = 'pen' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'rect' | 'circle';

export type Participant = {
  id: string;
  name: string;
  role: string;
  stream: MediaStream;
  handRaised?: boolean;
  micOff?: boolean;
  cameraOff?: boolean;
  isSimulated?: boolean;
};

type RoomEvent = 
  | { type: 'chat'; sender: string; text: string; role?: string } 
  | { type: 'hand'; sender: string; senderId?: string; raised: boolean } 
  | { type: 'workspace'; workspace: Workspace } 
  | { type: 'fullscreen'; isFullscreen: boolean }
  | { type: 'screenshare'; sharing: boolean; sharerName: string }
  | { type: 'notes'; value: string } 
  | { type: 'code'; value: string } 
  | { type: 'code-lang'; lang: string }
  | { type: 'canvas'; x: number; y: number; prevX: number; prevY: number; color: string; width: number; tool?: DrawingTool } 
  | { type: 'canvas-clear' }
  | { type: 'canvas-image'; dataUrl: string }
  | { type: 'sync-request' }
  | { type: 'sync-full-state'; workspace: Workspace; notes: string; code: string; canvasDataUrl?: string; isFullscreen?: boolean };

import { getBackendUrl } from '../lib/env';

const isForcedRelay = typeof window !== 'undefined' && (
  new URLSearchParams(window.location.search).get('forceRelay') === '1' ||
  new URLSearchParams(window.location.search).get('forceRelay') === 'true'
);

const defaultRtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ],
  ...(isForcedRelay ? { iceTransportPolicy: 'relay' } : {})
};

const toolTabs: { id: Workspace; icon: string; label: string }[] = [
  { id: 'whiteboard', icon: 'draw', label: 'Whiteboard Canvas' },
  { id: 'notes', icon: 'note_alt', label: 'Shared Notes & Plan' },
  { id: 'code', icon: 'code', label: 'Interactive Code Pad' }
];

import {
  findSenderForKind,
  createSyntheticVideoStream,
  createSyntheticAudioTrack,
  VideoTile,
  StreamVideo,
  RemoteAudioElement,
  VideoGrid,
  WhiteboardCanvas,
  NotesEditor,
  CodeRunnerPad,
  RoomChat,
  NoLectureScheduled,
  PreJoinLobby,
  PreSessionState,
  type SessionAccessState
} from '../components/liveroom';

export function LiveRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAppStore();
  const roomId = sessionId || 'demo-room';
  const userName = currentUser?.name || 'You';
  const [currentSession, setCurrentSession] = useState<any | null>(null);
  const userRole = resolveSessionRole(currentSession, currentUser?.id, currentUser?.role);
  const isTeacher = userRole === 'teacher';

  // Live Room State Machine & Pre-Join States
  const [sessionState, setSessionState] = useState<SessionAccessState | 'lobby' | 'picker' | 'empty' | 'loading'>('loading');
  const [isLobbyJoined, setIsLobbyJoined] = useState(false);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [demoMode, setDemoMode] = useState(false);

  const [workspace, setWorkspace] = useState<Workspace>('whiteboard');
  const [viewMode, setViewMode] = useState<'studio' | 'gallery'>('studio');
  const [isFullscreenWorkspace, setIsFullscreenWorkspace] = useState(false);
  const [showDevOverflow, setShowDevOverflow] = useState(false);
  const [showPipVideos, setShowPipVideos] = useState(true);
  const [showFullscreenChat, setShowFullscreenChat] = useState(false);

  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null);
  const [isPeerScreenSharing, setIsPeerScreenSharing] = useState(false);
  const [sharerName, setSharerName] = useState('');
  const [raisedHand, setRaisedHand] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatText, setChatText] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [isSessionNotesPanelOpen, setIsSessionNotesPanelOpen] = useState(false);

  // Live Room Side Panel Notes Tab State
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'notes'>('chat');
  const [inlineNoteTitle, setInlineNoteTitle] = useState('');
  const [inlineNoteContent, setInlineNoteContent] = useState('');
  const [isSavingInlineNote, setIsSavingInlineNote] = useState(false);
  const [sessionNotesList, setSessionNotesList] = useState<any[]>([]);
  const [loadingSessionNotes, setLoadingSessionNotes] = useState(false);

  const loadSessionNotesList = useCallback(() => {
    if (!currentSession?.id) return;
    setLoadingSessionNotes(true);
    api.getNotes({ sessionId: currentSession.id })
      .then(res => {
        if (Array.isArray(res)) setSessionNotesList(res);
      })
      .catch(() => {})
      .finally(() => setLoadingSessionNotes(false));
  }, [currentSession?.id]);

  useEffect(() => {
    if (sidebarTab === 'notes' && currentSession?.id) {
      loadSessionNotesList();
    }
  }, [sidebarTab, currentSession?.id, loadSessionNotesList]);

  const handleSaveInlineNote = async () => {
    if (!inlineNoteTitle.trim() && !inlineNoteContent.trim()) return;
    if (!currentSession?.id) return;
    setIsSavingInlineNote(true);
    try {
      await api.saveNote({
        type: 'regular',
        sessionId: currentSession.id,
        title: inlineNoteTitle.trim() || `Session Note (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        content: `<p>${inlineNoteContent.trim()}</p>`,
        visibility: 'private',
        tags: ['session-notes']
      });
      setInlineNoteTitle('');
      setInlineNoteContent('');
      loadSessionNotesList();
    } catch (err: any) {
      alert(err.message || 'Failed to save note');
    } finally {
      setIsSavingInlineNote(false);
    }
  };

  // Whiteboard drawing tools
  const [drawColor, setDrawColor] = useState('#2563eb');
  const [drawWidth, setDrawWidth] = useState(4);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('pen');

  // Code editor states
  const [selectedCodeLang, setSelectedCodeLang] = useState('javascript');
  const [codeOutput, setCodeOutput] = useState<string | null>(null);
  const [isRunningCode] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', sender: 'Mindroot System', text: 'Welcome to your live cohort studio! All enrolled batch students and the instructor join and collaborate here together.' }
  ]);
  const [notes, setNotes] = useState('## 🎯 Cohort Lesson Plan & Objectives\n\n- [x] Topic Introduction & Theory overview\n- [ ] Deep Dive with Interactive Diagrams on Whiteboard\n- [ ] Hands-on Live Code Session & Execution\n- [ ] Student Q&A and Concept Review\n\n> 💡 Tip: Click "Fullscreen Explanation Mode" on the top right for a wide focused workspace!');
  const [code, setCode] = useState('// 🚀 Live Interactive Cohort Code Pad\n// All students & the teacher can write and execute code together!\n\nfunction calculateCohortProgress(students: string[], topic: string) {\n  return {\n    topic,\n    totalStudents: students.length,\n    batchStatus: "3-Student Cohort Active 🎓",\n    studentList: students,\n    message: `All ${students.length} students are live with the instructor!`\n  };\n}\n\nconst cohort = calculateCohortProgress(["Alex", "Liam", "Sarah"], "React & TypeScript Systems");\nconsole.log("Cohort Session Info:", JSON.stringify(cohort, null, 2));\n');

  // Verify and resolve session access state
  useEffect(() => {
    let active = true;

    const resolveSessionAccess = async () => {
      try {
        setSessionState('loading');
        const [configRes, sessionsList] = await Promise.all([
          api.getConfig().catch(() => ({ demoMode: false })),
          api.getSessions().catch(() => [])
        ]);

        if (!active) return;
        const isDemo = Boolean(configRes?.demoMode);
        setDemoMode(isDemo);

        const currentUserId = currentUser?.id;
        const now = Date.now();

        // CASE A: /live-room with no sessionId, or sidebar click
        if (!sessionId) {
          if (!currentUserId || !Array.isArray(sessionsList) || sessionsList.length === 0) {
            setSessionState('empty');
            return;
          }

          // Filter sessions where current user is participant
          const mySessions = sessionsList.filter((s: any) => {
            if (!s || (s.status !== 'confirmed' && s.status !== 'live')) return false;
            const isT = s.teacherId === currentUserId || s.teacher?.id === currentUserId;
            const isS = s.studentId === currentUserId || s.student?.id === currentUserId ||
              (Array.isArray(s.students) && s.students.some((st: any) => (st.id || st) === currentUserId));
            return isT || isS;
          });

          // Check if any session is in its join window right now
          const joinable = mySessions.find((s: any) => {
            const isT = s.teacherId === currentUserId || s.teacher?.id === currentUserId;
            const rawDate = s.scheduledAt || s.date || s.time;
            if (!rawDate) return false;
            const start = new Date(rawDate).getTime();
            if (isNaN(start)) return false;
            const dur = (s.durationMin || s.duration || 60) * 60 * 1000;
            const grace = 15 * 60 * 1000;
            const ended = now > start + dur + grace;
            if (ended) return false;
            if (isT) return true;
            return now >= start - 10 * 60 * 1000;
          });

          if (joinable) {
            navigate(`/live-room/${joinable.id}`, { replace: true });
            return;
          }

          // Check upcoming sessions (not ended)
          const upcoming = mySessions.filter((s: any) => {
            const rawDate = s.scheduledAt || s.date || s.time;
            if (!rawDate) return false;
            const start = new Date(rawDate).getTime();
            if (isNaN(start)) return false;
            const dur = (s.durationMin || s.duration || 60) * 60 * 1000;
            const grace = 15 * 60 * 1000;
            return now < start + dur + grace;
          });

          if (upcoming.length > 1) {
            setUpcomingSessions(upcoming);
            setSessionState('picker');
          } else if (upcoming.length === 1) {
            navigate(`/live-room/${upcoming[0].id}`, { replace: true });
          } else {
            setSessionState('empty');
          }
          return;
        }

        // CASE B: Practice / Device Check room
        if (sessionId === 'practice') {
          if (!isDemo) {
            window.dispatchEvent(new CustomEvent('app-toast', {
              detail: { type: 'reminder', title: 'No lecture scheduled', body: 'Practice room is only available in demo mode.' }
            }));
            navigate('/schedule', { replace: true });
            return;
          }

          setCurrentSession({
            id: 'practice',
            title: 'Practice Room (Device Check)',
            status: 'confirmed',
            scheduledAt: new Date().toISOString()
          });
          setSessionState('lobby');
          return;
        }

        // CASE C: Specific Session ID
        const target = Array.isArray(sessionsList) ? sessionsList.find((s: any) => s.id === sessionId || s.meetingLink === `/live/${sessionId}` || s.meetingLink === `/live-room/${sessionId}` || s.meetingLink === sessionId) : null;

        if (!target) {
          window.dispatchEvent(new CustomEvent('app-toast', {
            detail: { type: 'reminder', title: 'No lecture scheduled', body: 'The requested lecture session was not found.' }
          }));
          navigate('/schedule', { replace: true });
          return;
        }

        setCurrentSession(target);
        if (target.studyNotes) {
          setNotes(target.studyNotes);
        }

        // Participant check
        const isT = target.teacherId === currentUserId || target.teacher?.id === currentUserId;
        const isS = target.studentId === currentUserId || target.student?.id === currentUserId ||
          (Array.isArray(target.students) && target.students.some((st: any) => (st.id || st) === currentUserId));
        const isAdmin = currentUser?.role === 'admin';

        if (!isT && !isS && !isAdmin) {
          setSessionState('no-access');
          return;
        }

        // Status checks
        if (target.status === 'pending') {
          setSessionState('pending');
          return;
        }
        if (target.status === 'declined' || target.status === 'cancelled' || target.status === 'expired') {
          setSessionState(target.status as SessionAccessState);
          return;
        }
        if (target.status === 'completed') {
          setSessionState('completed');
          return;
        }

        if (target.status === 'confirmed' || target.status === 'live') {
          const rawDate = target.scheduledAt || target.date || target.time;
          const start = new Date(rawDate).getTime();
          const dur = (target.durationMin || target.duration || 60) * 60 * 1000;
          const grace = 15 * 60 * 1000;

          if (!isNaN(start)) {
            const hasEnded = now > start + dur + grace;
            if (hasEnded) {
              setSessionState('ended');
              return;
            }

            const isEarly = now < start - 10 * 60 * 1000;
            if (!isT && !isAdmin && isEarly) {
              setSessionState('confirmed-early');
              return;
            }
          }

          // Inside join window (or teacher before start)
          setSessionState('lobby');
        } else {
          setSessionState('no-access');
        }
      } catch (err) {
        console.error('Error verifying session:', err);
        setSessionState('empty');
      }
    };

    resolveSessionAccess();

    return () => { active = false; };
  }, [sessionId, currentUser?.id, navigate]);

  // Auto-save study notes to session history
  useEffect(() => {
    if (currentSession?.id && notes) {
      const timer = setTimeout(() => {
        api.updateSessionNotes(currentSession.id, notes).catch(() => {});
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notes, currentSession?.id]);

  // Post-Session 30-Second Review States
  const [quickRating, setQuickRating] = useState<number>(5);
  const [selectedKarmaBadges, setSelectedKarmaBadges] = useState<string[]>(['Clear Explanations', 'Punctual']);
  const [reviewComment, setReviewComment] = useState('');
  const [isReviewSubmitted, setIsReviewSubmitted] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const handleQuickSubmitReview = async () => {
    if (!currentSession?.teacherId && !currentSession?.teacher?.id) return;
    setIsSubmittingReview(true);
    const teacherId = currentSession.teacherId || currentSession.teacher?.id;
    try {
      await api.postReview({
        targetId: teacherId,
        authorId: currentUser?.id || 'student-current',
        topic: currentSession?.title || 'Peer Mentorship',
        rating: quickRating,
        quote: reviewComment.trim() || selectedKarmaBadges.join(', ') || 'Excellent mentorship session!',
        chips: selectedKarmaBadges
      });
      setIsReviewSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingReview(false);
    }
  };
  const [notice, setNotice] = useState('Connecting to live cohort studio…');
  const [hardwareInfo, setHardwareInfo] = useState<{ cam: boolean; mic: boolean }>({ cam: false, mic: false });
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const generateAISummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const prompt = `Please provide an executive learning recap and study guide for this session:\n\nTopic: ${currentSession?.title || 'Interactive Learning Session'}\nNotes from session:\n${notes}\nCode snippet worked on:\n${code.slice(0, 500)}\n\nPlease format as:\n1. 📌 Key Concepts Mastered\n2. 💡 Important Code Insights\n3. 🎯 Recommended Next Exercises & Practice`;
      const res = await api.postAIChat({
        message: prompt,
        context: 'live-room-recap',
        userName: currentUser?.name || 'Student',
        tokenBalance: currentUser?.tokenBalance
      });
      if (res?.text) {
        setAiSummary(res.text);
      } else {
        setAiSummary(`### 📌 Session Recap: ${currentSession?.title || 'Learning Session'}\n\n- **Topics Covered**: Hands-on walkthrough with live whiteboard and interactive code execution.\n- **Action Items**: Review session notes and practice implementing the core logic on your local IDE.\n- **Next Steps**: Book a follow-up session or discuss questions on the Mindroot Community Forum!`);
      }
    } catch {
      setAiSummary(`### 📌 Session Recap: ${currentSession?.title || 'Learning Session'}\n\n- **Topics Covered**: Hands-on walkthrough with live whiteboard and interactive code execution.\n- **Action Items**: Review session notes and practice implementing the core logic on your local IDE.\n- **Next Steps**: Book a follow-up session or discuss questions on the Mindroot Community Forum!`);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const activeRtcConfigRef = useRef<RTCConfiguration>(defaultRtcConfig);

  // Fetch dynamic TURN credentials from backend
  useEffect(() => {
    let active = true;
    api.getTurnCredentials().then(res => {
      if (active && res?.iceServers && res.iceServers.length > 0) {
        console.log('📡 Dynamic TURN credentials loaded successfully:', res.iceServers.length, 'servers.');
        activeRtcConfigRef.current = {
          iceServers: res.iceServers,
          ...(isForcedRelay ? { iceTransportPolicy: 'relay' } : {})
        };
      }
    }).catch(err => {
      console.warn('⚠️ Failed to load TURN credentials, using default STUN fallback:', err);
    });
    return () => { active = false; };
  }, []);

  // Multi-participant states (Mesh WebRTC)
  type IceStatus = 'Connecting...' | 'Direct P2P' | 'TURNS Relay 443' | 'Connection Failed' | 'SIMULATED PLAYBACK (DEMO)';
  const [iceDiagnostic, setIceDiagnostic] = useState<IceStatus>('Connecting...');
  const [remoteParticipants, setRemoteParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Synchronize simulated stream state to ICE diagnostics
  useEffect(() => {
    if (remoteParticipants.length > 0 && remoteParticipants.every(p => p.isSimulated)) {
      setIceDiagnostic('SIMULATED PLAYBACK (DEMO)');
    } else if (remoteParticipants.length === 0) {
      setIceDiagnostic('Connecting...');
    }
  }, [remoteParticipants]);

  const localVideo = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const drawing = useRef({ active: false, x: 0, y: 0, startX: 0, startY: 0 });
  const snapshotRef = useRef<ImageData | null>(null);

  // Guaranteed unique peer instance ID per laptop/tab to prevent collision
  const [instancePeerId] = useState(() => {
    const base = currentUser?.id || 'guest';
    return `${base}_${Math.random().toString(36).substring(2, 9)}`;
  });
  const peerId = useRef(instancePeerId);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const seenSignals = useRef<Set<string>>(new Set());

  // ICE Candidate Queuing for asynchronous peer connection timing
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const queueIceCandidate = (targetPeerId: string, candidate: RTCIceCandidateInit) => {
    if (!pendingIceCandidates.current.has(targetPeerId)) {
      pendingIceCandidates.current.set(targetPeerId, []);
    }
    pendingIceCandidates.current.get(targetPeerId)!.push(candidate);
  };

  const flushIceCandidates = async (targetPeerId: string, peer: RTCPeerConnection) => {
    const queue = pendingIceCandidates.current.get(targetPeerId);
    if (queue && queue.length > 0) {
      for (const cand of queue) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn('[WebRTC] Error applying queued ICE candidate:', err);
        }
      }
      pendingIceCandidates.current.delete(targetPeerId);
    }
  };

  const workspaceRef = useRef(workspace);
  const notesRef = useRef(notes);
  const codeRef = useRef(code);
  const isFullscreenWorkspaceRef = useRef(isFullscreenWorkspace);

  useEffect(() => { workspaceRef.current = workspace; }, [workspace]);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { isFullscreenWorkspaceRef.current = isFullscreenWorkspace; }, [isFullscreenWorkspace]);

  // Camera & Mic Device Selection States
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showEndedModal, setShowEndedModal] = useState(false);

  const addMessage = useCallback((message: ChatMessage) => setMessages(previous => [...previous.slice(-49), message]), []);

  const broadcastSignal = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    const msgId = safeUUID();
    const data = { msgId, type, roomId, senderId: peerId.current, senderName: userName, senderRole: userRole, ...payload };
    socketRef.current?.emit(type, data);
    try {
      bcRef.current?.postMessage(data);
    } catch {}
  }, [roomId, userName, userRole]);

  const emitRoomEvent = useCallback((event: RoomEvent) => {
    broadcastSignal('room-event', { event });
  }, [broadcastSignal]);

  const toggleFullscreenMode = useCallback((fullscreen: boolean) => {
    setIsFullscreenWorkspace(fullscreen);
    emitRoomEvent({ type: 'fullscreen', isFullscreen: fullscreen });
  }, [emitRoomEvent]);

  // Escape key exits fullscreen and synchronizes with peer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreenWorkspace) {
        toggleFullscreenMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenWorkspace, toggleFullscreenMode]);

  const drawLine = useCallback((x: number, y: number, prevX: number, prevY: number, stroke: string, width: number, tool: DrawingTool = 'pen') => { 
    const element = canvas.current; 
    const context = element?.getContext('2d'); 
    if (!element || !context) return; 

    context.save();
    if (tool === 'eraser') {
      context.globalCompositeOperation = 'destination-out';
      context.beginPath();
      context.arc(x, y, width * 2, 0, Math.PI * 2);
      context.fill();
    } else if (tool === 'highlighter') {
      context.globalAlpha = 0.35;
      context.beginPath(); 
      context.moveTo(prevX, prevY); 
      context.lineTo(x, y); 
      context.strokeStyle = stroke; 
      context.lineWidth = width * 3; 
      context.lineCap = 'square'; 
      context.lineJoin = 'round'; 
      context.stroke(); 
    } else {
      context.beginPath(); 
      context.moveTo(prevX, prevY); 
      context.lineTo(x, y); 
      context.strokeStyle = stroke; 
      context.lineWidth = width; 
      context.lineCap = 'round'; 
      context.lineJoin = 'round'; 
      context.stroke(); 
    }
    context.restore();
  }, []);

  // Canvas stroke batching (~30ms throttle using RAF to minimize Socket.io payload frequency)
  const strokeBuffer = useRef<{ x: number; y: number; prevX: number; prevY: number; color: string; width: number; tool: DrawingTool }[]>([]);
  const batchRafId = useRef<number | null>(null);
  const lastBatchTime = useRef<number>(0);

  const flushStrokeBuffer = useCallback(() => {
    if (strokeBuffer.current.length > 0) {
      const itemsToEmit = [...strokeBuffer.current];
      strokeBuffer.current = [];
      itemsToEmit.forEach(point => {
        emitRoomEvent({
          type: 'canvas',
          x: point.x,
          y: point.y,
          prevX: point.prevX,
          prevY: point.prevY,
          color: point.color,
          width: point.width,
          tool: point.tool
        });
      });
    }
  }, [emitRoomEvent]);

  const scheduleStrokeFlush = useCallback(() => {
    if (batchRafId.current !== null) return;
    batchRafId.current = requestAnimationFrame((timestamp) => {
      batchRafId.current = null;
      if (timestamp - lastBatchTime.current >= 30) {
        lastBatchTime.current = timestamp;
        flushStrokeBuffer();
      } else {
        scheduleStrokeFlush();
      }
    });
  }, [flushStrokeBuffer]);

  const queueStrokePoint = useCallback((point: { x: number; y: number; prevX: number; prevY: number; color: string; width: number; tool: DrawingTool }) => {
    strokeBuffer.current.push(point);
    scheduleStrokeFlush();
  }, [scheduleStrokeFlush]);

  // Synchronize tracks with RTCPeerConnection reliably
  const syncLocalTracksToPeer = useCallback((peer: RTCPeerConnection) => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getTracks();

    tracks.forEach(track => {
      const existingSender = findSenderForKind(peer, track.kind as 'audio' | 'video');
      if (existingSender) {
        existingSender.replaceTrack(track).catch(err => {
          console.warn(`[WebRTC] replaceTrack warning for ${track.kind}:`, err);
        });
      } else {
        try {
          peer.addTrack(track, localStreamRef.current!);
        } catch (e) {
          console.warn(`[WebRTC] Track already added to peer (${track.kind}):`, e);
        }
      }
    });
  }, []);

  // Initialize or retrieve RTCPeerConnection for each peer in the multi-student mesh
  const getOrCreatePeerConnection = useCallback((remotePeerId: string, remoteName?: string, remoteRole?: string) => {
    const existing = peersRef.current.get(remotePeerId);
    if (existing && existing.signalingState !== 'closed') {
      return existing;
    }

    const peer = new RTCPeerConnection(activeRtcConfigRef.current);
    peersRef.current.set(remotePeerId, peer);

    // 1. Attach local tracks immediately if available
    if (localStreamRef.current && localStreamRef.current.getTracks().length > 0) {
      localStreamRef.current.getTracks().forEach(track => {
        try {
          peer.addTrack(track, localStreamRef.current!);
        } catch (e) {
          console.warn('Track already added to peer:', e);
        }
      });
      // Guarantee both audio & video transceivers exist even if local stream only has one kind yet
      const hasAudio = localStreamRef.current.getAudioTracks().length > 0;
      const hasVideo = localStreamRef.current.getVideoTracks().length > 0;
      if (!hasAudio) {
        try { peer.addTransceiver('audio', { direction: 'sendrecv' }); } catch {}
      }
      if (!hasVideo) {
        try { peer.addTransceiver('video', { direction: 'sendrecv' }); } catch {}
      }
    } else {
      // 2. Add fallback transceivers for bi-directional streaming
      try {
        peer.addTransceiver('audio', { direction: 'sendrecv' });
        peer.addTransceiver('video', { direction: 'sendrecv' });
      } catch {}
    }

    peer.onicecandidate = ({ candidate }) => {
      if (candidate) {
        broadcastSignal('ice-candidate', { targetId: remotePeerId, candidate: candidate.toJSON() });
      }
    };

    peer.ontrack = (event) => {
      console.log(`🎥 WebRTC Remote track received from ${remotePeerId} (${remoteName}):`, event.track.kind, event.track.id);
      
      setRemoteParticipants(prev => {
        const pIdx = prev.findIndex(p => p.id === remotePeerId);
        const resolvedName = remoteName || (pIdx >= 0 ? prev[pIdx].name : 'Peer');
        const resolvedRole = remoteRole || (pIdx >= 0 ? prev[pIdx].role : 'student');

        // Extract tracks from existing stream, event.streams[0], and event.track
        const existingTracks = pIdx >= 0 ? prev[pIdx].stream.getTracks() : [];
        const incomingStreamTracks = event.streams[0] ? event.streams[0].getTracks() : [];

        const trackMap = new Map<string, MediaStreamTrack>();
        existingTracks.forEach(t => {
          if (t.readyState !== 'ended') trackMap.set(t.id, t);
        });
        incomingStreamTracks.forEach(t => {
          if (t.readyState !== 'ended') trackMap.set(t.id, t);
        });
        trackMap.set(event.track.id, event.track);

        const freshStream = new MediaStream(Array.from(trackMap.values()));

        if (pIdx >= 0) {
          const updated = [...prev];
          updated[pIdx] = {
            ...prev[pIdx],
            name: resolvedName,
            role: resolvedRole,
            stream: freshStream
          };
          return updated;
        }

        return [...prev, {
          id: remotePeerId,
          name: resolvedName,
          role: resolvedRole,
          stream: freshStream,
          handRaised: false
        }];
      });

      setNotice(`Live feed connected: ${remoteName || 'Peer'}`);
    };

    // Negotiation is deterministically initiated by joining participants via room-participants signal
    peer.onnegotiationneeded = null;

    peer.onsignalingstatechange = async () => {
      console.log(`[WebRTC] Peer ${remotePeerId} signaling state: ${peer.signalingState}`);
      if (peer.signalingState === 'stable') {
        await flushIceCandidates(remotePeerId, peer);
        if (localStreamRef.current) {
          syncLocalTracksToPeer(peer);
        }
      }
    };

    peer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;
      console.log(`[WebRTC] Peer ${remotePeerId} ICE connection state: ${state}`);
      if (state === 'failed' || state === 'disconnected') {
        setIceDiagnostic('Connection Failed');
        setIsReconnecting(true);
        // Automatic renegotiation path for failure recovery
        (async () => {
          try {
            console.log(`[WebRTC Recovery] Attempting ICE renegotiation for peer ${remotePeerId}...`);
            const offer = await peer.createOffer({ iceRestart: true });
            await peer.setLocalDescription(offer);
            broadcastSignal('sdp-offer', { targetId: remotePeerId, offer: peer.localDescription });
          } catch (err) {
            console.warn('[WebRTC Recovery] Renegotiation error:', err);
          }
        })();

        // Surface visible reconnecting indicator if state doesn't recover within 10s
        setTimeout(() => {
          if (peer.iceConnectionState === 'failed' || peer.iceConnectionState === 'disconnected') {
            setNotice('Connection lost — reconnecting...');
          }
        }, 10000);
      } else if (state === 'connected' || state === 'completed') {
        setIsReconnecting(false);
        (async () => {
          try {
            const stats = await peer.getStats();
            let isRelay = false;
            stats.forEach((report: any) => {
              if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated) && (report.selected || report.nominated)) {
                const localCand = stats.get(report.localCandidateId);
                const remoteCand = stats.get(report.remoteCandidateId);
                if (localCand?.candidateType === 'relay' || remoteCand?.candidateType === 'relay') {
                  isRelay = true;
                }
              }
            });
            setIceDiagnostic(isRelay ? 'TURNS Relay 443' : 'Direct P2P');
          } catch {
            setIceDiagnostic('Direct P2P');
          }
        })();
      } else if (state === 'checking') {
        setIceDiagnostic('Connecting...');
      }
    };

    peer.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${remotePeerId} connection state: ${peer.connectionState}`);
      if (peer.connectionState === 'failed') {
        try {
          peer.restartIce();
        } catch {}
      }
      if (peer.connectionState === 'closed') {
        peersRef.current.delete(remotePeerId);
        pendingIceCandidates.current.delete(remotePeerId);
        setRemoteParticipants(prev => prev.filter(p => p.id !== remotePeerId));
      }
    };

    return peer;
  }, [broadcastSignal]);

  const loadDevices = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const video = devices.filter(d => d.kind === 'videoinput');
      const audio = devices.filter(d => d.kind === 'audioinput');
      setVideoDevices(video);
      setAudioDevices(audio);

      if (video.length > 0 && !selectedVideoId) {
        const laptopCam = video.find(v => {
          const l = v.label.toLowerCase();
          return l.includes('integrated') || l.includes('built-in') || l.includes('laptop') || l.includes('internal') || l.includes('webcam') || l.includes('hd camera');
        });
        const defaultCam = laptopCam || video[0];
        if (defaultCam) {
          setSelectedVideoId(defaultCam.deviceId);
        }
      }
      if (audio.length > 0 && !selectedAudioId) {
        setSelectedAudioId(audio[0].deviceId);
      }
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
    }
  }, [selectedVideoId, selectedAudioId]);

  const changeVideoDevice = async (deviceId: string) => {
    if (!deviceId) return;
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId },
          audio: false
        });
      }
      const newVideoTrack = stream.getVideoTracks()[0];
      
      if (localStreamRef.current) {
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localStreamRef.current.addTrack(newVideoTrack);
      }
      
      cameraTrackRef.current = newVideoTrack;
      newVideoTrack.enabled = cameraOn;
      
      setLocalStream(new MediaStream(localStreamRef.current ? localStreamRef.current.getTracks() : [newVideoTrack]));
      
      peersRef.current.forEach(peer => {
        const sender = findSenderForKind(peer, 'video');
        if (sender) sender.replaceTrack(newVideoTrack).catch(() => undefined);
      });
      
      setSelectedVideoId(deviceId);
      setShowVideoMenu(false);
      setHardwareInfo(prev => ({ ...prev, cam: true }));
      setNotice('Switched camera device successfully.');
    } catch (err) {
      console.error('Failed to switch camera device:', err);
      setNotice('Failed to switch camera device.');
    }
  };

  const cycleNextCamera = () => {
    if (videoDevices.length < 2) return;
    const currentIndex = videoDevices.findIndex(d => d.deviceId === selectedVideoId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDevice = videoDevices[nextIndex];
    if (nextDevice) {
      changeVideoDevice(nextDevice.deviceId);
    }
  };

  const changeAudioDevice = async (deviceId: string) => {
    if (deviceId === selectedAudioId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: { deviceId: { exact: deviceId } }
      });
      const newAudioTrack = stream.getAudioTracks()[0];
      
      if (localStreamRef.current) {
        const oldTrack = localStreamRef.current.getAudioTracks()[0];
        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localStreamRef.current.addTrack(newAudioTrack);
      }
      
      micTrackRef.current = newAudioTrack;
      newAudioTrack.enabled = micOn;
      
      setLocalStream(new MediaStream(localStreamRef.current ? localStreamRef.current.getTracks() : [newAudioTrack]));
      
      peersRef.current.forEach(peer => {
        const sender = findSenderForKind(peer, 'audio');
        if (sender) sender.replaceTrack(newAudioTrack).catch(() => undefined);
      });
      
      setSelectedAudioId(deviceId);
      setShowAudioMenu(false);
      setHardwareInfo(prev => ({ ...prev, mic: true }));
      setNotice('Switched microphone successfully.');
    } catch (err) {
      console.error('Failed to switch microphone device:', err);
      setNotice('Failed to switch microphone.');
    }
  };

  // Pre-join Lobby media initialization (camera & microphone device access)
  useEffect(() => {
    if (sessionState !== 'lobby') return;
    let disposed = false;

    const initMedia = async () => {
      let videoTrack: MediaStreamTrack | null = null;
      let audioTrack: MediaStreamTrack | null = null;
      let physicalCam = false;
      let physicalMic = false;

      const audioConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const combined = await navigator.mediaDevices.getUserMedia({ video: true, audio: audioConstraints });
          videoTrack = combined.getVideoTracks()[0] || null;
          audioTrack = combined.getAudioTracks()[0] || null;
          if (videoTrack) physicalCam = true;
          if (audioTrack) physicalMic = true;
        } catch {
          try {
            const vStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            videoTrack = vStream.getVideoTracks()[0] || null;
            if (videoTrack) physicalCam = true;
          } catch (e) {
            console.warn('Physical camera unavailable:', e);
          }

          try {
            const aStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: audioConstraints });
            audioTrack = aStream.getAudioTracks()[0] || null;
            if (audioTrack) physicalMic = true;
          } catch (e) {
            console.warn('Physical microphone unavailable:', e);
          }
        }
      }

      if (!videoTrack) {
        const syntheticVStream = createSyntheticVideoStream(userName);
        videoTrack = syntheticVStream.getVideoTracks()[0] || null;
      }

      if (!audioTrack) {
        audioTrack = createSyntheticAudioTrack();
      }

      const stream = new MediaStream();
      if (videoTrack) {
        stream.addTrack(videoTrack);
        cameraTrackRef.current = videoTrack;
      }
      if (audioTrack) {
        stream.addTrack(audioTrack);
        micTrackRef.current = audioTrack;
      }

      if (disposed) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setHardwareInfo({ cam: physicalCam, mic: physicalMic });

      if (localVideo.current) {
        localVideo.current.srcObject = stream;
        localVideo.current.play().catch(() => undefined);
      }

      await loadDevices();
    };

    initMedia();

    return () => {
      disposed = true;
    };
  }, [sessionState, userName, loadDevices]);

  // Main Classroom Signaling & Mesh Peer Connection Effect
  useEffect(() => {
    // Only connect socket when user has passed lobby verification and joined room
    if (!isLobbyJoined || sessionState !== 'lobby') return;

    // 1. BroadcastChannel for instant local multi-tab testing
    const channel = new BroadcastChannel(`mindroot-room-${roomId}`);
    bcRef.current = channel;

    // 2. Socket.io: backend URL resolved from shared env helper
    const socketUrl = getBackendUrl();
    const token = getAuthItem('mindroot_auth_token');
    const socket = io(socketUrl, { 
      transports: ['websocket', 'polling'],
      auth: { token }
    });
    socketRef.current = socket;

    type SignalData = {
      msgId?: string;
      type: string;
      senderId?: string;
      senderName?: string;
      senderRole?: string;
      targetId?: string;
      roomId?: string;
      offer?: RTCSessionDescriptionInit;
      answer?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
      event?: RoomEvent;
    };

    const handleSignalData = async (data: SignalData) => {
      if (!data || data.senderId === peerId.current) return;
      if (data.roomId && data.roomId !== roomId) return;

      // Filter targeted signals (if targeted to another peer in mesh)
      if (data.targetId && data.targetId !== peerId.current) return;

      // Deduplicate signals received across both BroadcastChannel & Socket.io
      if (data.msgId) {
        if (seenSignals.current.has(data.msgId)) return;
        seenSignals.current.add(data.msgId);
        if (seenSignals.current.size > 300) {
          const first = seenSignals.current.values().next().value;
          if (first) seenSignals.current.delete(first);
        }
      }

      const remoteSender = data.senderId || 'remote-peer';

      // 1. Room Participants list from server (for joining newcomer)
      // 1. Room Participants list from server (for joining newcomer)
      if (data.type === 'room-participants' && Array.isArray((data as any).participants)) {
        console.log(`📋 Received room-participants list (${(data as any).participants.length} peers)`);
        (data as any).participants.forEach((p: any) => {
          if (p.peerId && p.peerId !== peerId.current) {
            console.log(`🤝 Initiating offer to existing room participant: ${p.peerId} (${p.userName})`);
            const peer = getOrCreatePeerConnection(p.peerId, p.userName, p.userRole);
            if (localStreamRef.current) {
              syncLocalTracksToPeer(peer);
            }
            peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
              .then(offer => {
                if (offer.sdp) {
                  offer.sdp = offer.sdp.replace(/useinbandfec=1/g, 'useinbandfec=1;usedtx=0;minptime=10;maxptime=20');
                }
                return peer.setLocalDescription(offer).then(() => {
                  broadcastSignal('sdp-offer', { targetId: p.peerId, offer: peer.localDescription });
                });
              })
              .catch(err => console.warn(`Error offering to existing peer ${p.peerId}:`, err));
          }
        });
      }
      // 2. Peer joined (broadcast from newcomer)
      else if (data.type === 'peer-joined' || data.type === 'join-room') {
        const pName = data.senderName || (data as any).userName;
        const pRole = data.senderRole || (data as any).userRole;
        console.log(`👋 Peer joined room: ${remoteSender} (${pName})`);
        const peer = getOrCreatePeerConnection(remoteSender, pName, pRole);
        if (localStreamRef.current) {
          syncLocalTracksToPeer(peer);
        }
      } 
      // 3. SDP Offer received
      else if (data.type === 'sdp-offer' && data.offer) {
        const peer = getOrCreatePeerConnection(remoteSender, data.senderName, data.senderRole);

        try {
          if (peer.signalingState !== 'stable') {
            try {
              await peer.setLocalDescription({ type: 'rollback' });
            } catch {}
          }
          await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
          await flushIceCandidates(remoteSender, peer);
          if (localStreamRef.current) {
            syncLocalTracksToPeer(peer);
          }

          const answer = await peer.createAnswer();
          if (answer.sdp) {
            answer.sdp = answer.sdp.replace(/useinbandfec=1/g, 'useinbandfec=1;usedtx=0;minptime=10;maxptime=20');
          }
          await peer.setLocalDescription(answer);
          broadcastSignal('sdp-answer', { targetId: remoteSender, answer: peer.localDescription });
        } catch (err) {
          console.warn(`[WebRTC] Error processing SDP offer from ${remoteSender}:`, err);
        }
      } 
      // 4. SDP Answer received
      else if (data.type === 'sdp-answer' && data.answer) {
        const peer = peersRef.current.get(remoteSender);
        if (peer && (peer.signalingState === 'have-local-offer' || peer.signalingState === 'have-remote-pranswer')) {
          try {
            await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
            await flushIceCandidates(remoteSender, peer);
          } catch (err) {
            console.warn(`[WebRTC] Error handling SDP answer from ${remoteSender}:`, err);
          }
        }
      } 
      // 5. ICE Candidate received
      else if (data.type === 'ice-candidate' && data.candidate) {
        const peer = peersRef.current.get(remoteSender);
        if (peer && peer.remoteDescription && peer.remoteDescription.type) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (err) {
            console.warn('[WebRTC] ICE candidate direct add warning:', err);
          }
        } else {
          queueIceCandidate(remoteSender, data.candidate);
        }
      } 
      // 6. Peer left
      else if (data.type === 'peer-left' || data.type === 'leave-room') {
        const peer = peersRef.current.get(remoteSender);
        if (peer) {
          peer.close();
          peersRef.current.delete(remoteSender);
        }
        pendingIceCandidates.current.delete(remoteSender);
        setRemoteParticipants(prev => prev.filter(p => p.id !== remoteSender));
      }
      // 7. Room Event
      else if (data.type === 'room-event' && data.event) {
        const event = data.event;
        if (event.type === 'chat') addMessage({ id: safeUUID(), sender: event.sender, text: event.text, role: event.role });
        if (event.type === 'hand') {
          setRemoteParticipants(prev => prev.map(p => (p.name === event.sender || p.id === event.senderId) ? { ...p, handRaised: event.raised } : p));
          if (event.raised) setNotice(`${event.sender} raised their hand`);
        }
        if (event.type === 'fullscreen') {
          setIsFullscreenWorkspace(event.isFullscreen);
          setNotice(event.isFullscreen ? 'Instructor synchronized Fullscreen Mode' : 'Exited Fullscreen Mode');
        }
        if (event.type === 'screenshare') {
          setIsPeerScreenSharing(event.sharing);
          setSharerName(event.sharerName || 'Teacher');
          if (event.sharing) {
            setIsFullscreenWorkspace(true);
            setShowPipVideos(true);
            setWorkspace('screenshare');
            setNotice(`📺 ${event.sharerName || 'Instructor'} is sharing screen`);
          } else {
            setIsPeerScreenSharing(false);
            setWorkspace('whiteboard');
            setNotice(`Screen sharing ended`);
          }
        }
        if (event.type === 'workspace') setWorkspace(event.workspace);
        if (event.type === 'notes') setNotes(event.value);
        if (event.type === 'code') setCode(event.value);
        if (event.type === 'code-lang') setSelectedCodeLang(event.lang);
        if (event.type === 'canvas') drawLine(event.x, event.y, event.prevX, event.prevY, event.color, event.width, event.tool);
        if (event.type === 'canvas-clear') canvas.current?.getContext('2d')?.clearRect(0, 0, canvas.current.width, canvas.current.height);
        if (event.type === 'canvas-image' && event.dataUrl) {
          const img = new Image();
          img.onload = () => {
            const ctx = canvas.current?.getContext('2d');
            if (ctx && canvas.current) {
              ctx.clearRect(0, 0, canvas.current.width, canvas.current.height);
              ctx.drawImage(img, 0, 0);
            }
          };
          img.src = event.dataUrl;
        }
        if (event.type === 'sync-request') {
          const dataUrl = canvas.current?.toDataURL();
          broadcastSignal('room-event', {
            event: {
              type: 'sync-full-state',
              workspace: workspaceRef.current,
              notes: notesRef.current,
              code: codeRef.current,
              canvasDataUrl: dataUrl,
              isFullscreen: isFullscreenWorkspaceRef.current
            }
          });
        }
        if (event.type === 'sync-full-state') {
          if (event.workspace) setWorkspace(event.workspace);
          if (event.notes !== undefined) setNotes(event.notes);
          if (event.code !== undefined) setCode(event.code);
          if (event.isFullscreen !== undefined) setIsFullscreenWorkspace(event.isFullscreen);
          if (event.canvasDataUrl) {
            const img = new Image();
            img.onload = () => {
              const ctx = canvas.current?.getContext('2d');
              if (ctx && canvas.current) {
                ctx.clearRect(0, 0, canvas.current.width, canvas.current.height);
                ctx.drawImage(img, 0, 0);
              }
            };
            img.src = event.canvasDataUrl;
          }
        }
      }
    };

    channel.onmessage = (event) => handleSignalData(event.data);

    socket.on('connect', () => {
      socket.emit('join-room', { roomId, senderId: peerId.current, userName, userRole });
      setNotice('Connected to cohort studio signaling server.');
    });

    socket.on('room-error', (err: any) => {
      console.error('Room access error from server:', err);
      if (err?.code === 'SESSION_NOT_FOUND') {
        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: { type: 'reminder', title: 'No lecture scheduled', body: err.error || 'Session not found.' }
        }));
        navigate('/schedule', { replace: true });
      } else if (err?.code === 'NOT_PARTICIPANT') {
        setSessionState('no-access');
        setIsLobbyJoined(false);
      } else if (err?.code === 'TOO_EARLY') {
        setSessionState('confirmed-early');
        setIsLobbyJoined(false);
      } else if (err?.code === 'SESSION_ENDED') {
        setSessionState('ended');
        setIsLobbyJoined(false);
      } else if (err?.code === 'DEMO_ONLY') {
        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: { type: 'reminder', title: 'Demo Only', body: err.error || 'Practice room is only available in demo mode.' }
        }));
        navigate('/schedule', { replace: true });
      } else {
        setNotice(err?.error || 'Classroom access error');
      }
    });

    socket.on('room-participants', (d) => handleSignalData({ type: 'room-participants', ...d }));
    socket.on('peer-joined', (d) => handleSignalData({ type: 'peer-joined', ...d }));
    socket.on('sdp-offer', (d) => handleSignalData({ type: 'sdp-offer', ...d }));
    socket.on('sdp-answer', (d) => handleSignalData({ type: 'sdp-answer', ...d }));
    socket.on('ice-candidate', (d) => handleSignalData({ type: 'ice-candidate', ...d }));
    socket.on('room-event', (d) => handleSignalData({ type: 'room-event', ...d }));
    socket.on('room-state-sync', (state: any) => {
      if (!state) return;
      if (state.workspace) setWorkspace(state.workspace);
      if (state.notes !== undefined) setNotes(state.notes);
      if (state.code !== undefined) setCode(state.code);
      if (state.codeLanguage) setSelectedCodeLang(state.codeLanguage);
      if (state.isFullscreen !== undefined) setIsFullscreenWorkspace(Boolean(state.isFullscreen));
      if (state.canvasDataUrl) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.current?.getContext('2d');
          if (ctx && canvas.current) {
            ctx.clearRect(0, 0, canvas.current.width, canvas.current.height);
            ctx.drawImage(img, 0, 0);
          }
        };
        img.src = state.canvasDataUrl;
      }
      if (Array.isArray(state.chatMessages) && state.chatMessages.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const incoming = state.chatMessages
            .filter((m: any) => !existingIds.has(m.id))
            .map((m: any) => ({
              ...m,
              own: m.sender === userName
            }));
          return [...prev, ...incoming];
        });
      }
    });

    // Announce join to other open tabs / peers
    broadcastSignal('join-room', {});

    // Sync existing local tracks to all active mesh peers
    if (localStreamRef.current) {
      peersRef.current.forEach(async (peer, remoteId) => {
        syncLocalTracksToPeer(peer);
        if (peer.signalingState === 'stable') {
          try {
            const offer = await peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
            if (offer.sdp) {
              offer.sdp = offer.sdp.replace(/useinbandfec=1/g, 'useinbandfec=1;usedtx=0;minptime=10;maxptime=20');
            }
            await peer.setLocalDescription(offer);
            broadcastSignal('sdp-offer', { targetId: remoteId, offer: peer.localDescription });
          } catch {}
        }
      });
    }

    // Auto-recovery mesh interval: check and restart failed ICE connections
    const recoveryInterval = setInterval(() => {
      peersRef.current.forEach((peer) => {
        if (peer.connectionState === 'failed') {
          try {
            peer.restartIce();
          } catch {}
        }
      });
    }, 4000);

    return () => {
      clearInterval(recoveryInterval);
      channel.close();
      socket.emit('leave-room', { roomId, senderId: peerId.current });
      socket.disconnect();
      peersRef.current.forEach(peer => peer.close());
      peersRef.current.clear();
      pendingIceCandidates.current.clear();
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      displayStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [addMessage, drawLine, getOrCreatePeerConnection, roomId, loadDevices, broadcastSignal, userName, syncLocalTracksToPeer, isLobbyJoined, sessionState, navigate, userRole]);

  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = micOn; });
    }
    if (micTrackRef.current) {
      micTrackRef.current.enabled = micOn;
    }
  }, [micOn]);

  useEffect(() => {
    if (cameraTrackRef.current) {
      cameraTrackRef.current.enabled = cameraOn;
    }
  }, [cameraOn]);

  // Global user interaction listener to instantly unlock browser audio context and audio playback
  useEffect(() => {
    const unlockAllAudio = () => {
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          const ctx = new AudioCtxClass();
          if (ctx.state === 'suspended') ctx.resume();
        }
      } catch {}

      const videoEls = document.querySelectorAll('video');
      videoEls.forEach(el => {
        if (el.srcObject) el.play().catch(() => undefined);
      });
      const audioEls = document.querySelectorAll('audio');
      audioEls.forEach(el => {
        if (el.srcObject) el.play().catch(() => undefined);
      });
      setAutoplayBlocked(false);
    };

    window.addEventListener('pointerdown', unlockAllAudio);
    window.addEventListener('touchstart', unlockAllAudio);
    window.addEventListener('keydown', unlockAllAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAllAudio);
      window.removeEventListener('touchstart', unlockAllAudio);
      window.removeEventListener('keydown', unlockAllAudio);
    };
  }, []);

  const toggleMicWithPermission = async () => {
    if (!micOn && localStreamRef.current && (!micTrackRef.current || !micTrackRef.current.enabled)) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack && localStreamRef.current) {
          const oldTrack = localStreamRef.current.getAudioTracks()[0];
          if (oldTrack) {
            localStreamRef.current.removeTrack(oldTrack);
            oldTrack.stop();
          }
          localStreamRef.current.addTrack(audioTrack);
          micTrackRef.current = audioTrack;
          peersRef.current.forEach(peer => {
            const sender = findSenderForKind(peer, 'audio');
            if (sender) sender.replaceTrack(audioTrack).catch(() => undefined);
          });
        }
      } catch (err) {
        console.warn('Microphone permission request error:', err);
      }
    }
    setMicOn(v => !v);
  };

  const toggleCameraWithPermission = async () => {
    if (!cameraOn) {
      try {
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch {}
        }

        let videoTrack = stream?.getVideoTracks()[0] || null;
        let isHardwareCam = true;
        if (!videoTrack) {
          const synthStream = createSyntheticVideoStream(userName, isTeacher ? 'INSTRUCTOR CAMERA' : 'STUDENT CAMERA');
          videoTrack = synthStream.getVideoTracks()[0] || null;
          isHardwareCam = false;
        }

        if (videoTrack) {
          if (localStreamRef.current) {
            const oldTrack = localStreamRef.current.getVideoTracks()[0];
            if (oldTrack) {
              localStreamRef.current.removeTrack(oldTrack);
              oldTrack.stop();
            }
            localStreamRef.current.addTrack(videoTrack);
          } else {
            localStreamRef.current = new MediaStream([videoTrack]);
          }
          cameraTrackRef.current = videoTrack;
          peersRef.current.forEach(peer => {
            const sender = findSenderForKind(peer, 'video');
            if (sender) sender.replaceTrack(videoTrack!).catch(() => undefined);
          });
          setHardwareInfo(prev => ({ ...prev, cam: isHardwareCam }));
        }
      } catch (err) {
        console.warn('Camera error:', err);
      }

      if (cameraTrackRef.current) cameraTrackRef.current.enabled = true;
      if (localStreamRef.current) setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setCameraOn(true);
      setNotice('Camera enabled');
    } else {
      if (cameraTrackRef.current) {
        cameraTrackRef.current.enabled = false;
        cameraTrackRef.current.stop();
        if (localStreamRef.current) localStreamRef.current.removeTrack(cameraTrackRef.current);
        cameraTrackRef.current = null;
      }

      const synthStream = createSyntheticVideoStream(userName, isTeacher ? 'INSTRUCTOR (OFF)' : 'STUDENT (OFF)');
      const synthTrack = synthStream.getVideoTracks()[0];
      peersRef.current.forEach(peer => {
        const sender = findSenderForKind(peer, 'video');
        if (sender && synthTrack) sender.replaceTrack(synthTrack).catch(() => undefined);
      });

      if (localStreamRef.current) setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setCameraOn(false);
      setNotice('Camera disabled');
    }
  };

  const chooseWorkspace = (next: Workspace) => { 
    setWorkspace(next); 
    emitRoomEvent({ type: 'workspace', workspace: next }); 
  };
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };



  const unlockAudio = () => {
    const audioEls = document.querySelectorAll('audio');
    audioEls.forEach(el => {
      if (el.srcObject) el.play().catch(() => undefined);
    });
    setAutoplayBlocked(false);
  };

  const toggleHand = () => { 
    const next = !raisedHand; 
    setRaisedHand(next); 
    emitRoomEvent({ type: 'hand', sender: userName, senderId: peerId.current, raised: next }); 
  };
  
  const sendChat = () => { 
    const text = chatText.trim(); 
    if (!text) return; 
    addMessage({ id: safeUUID(), sender: userName, text, role: userRole, own: true }); 
    emitRoomEvent({ type: 'chat', sender: userName, text, role: userRole }); 
    setChatText(''); 
  };
  
  const toggleShare = async () => { 
    if (sharing) { 
      peersRef.current.forEach(peer => {
        const sender = findSenderForKind(peer, 'video'); 
        if (sender && cameraTrackRef.current) sender.replaceTrack(cameraTrackRef.current).catch(() => undefined);
      });
      if (displayStreamRef.current) {
        displayStreamRef.current.getTracks().forEach(track => track.stop()); 
        displayStreamRef.current = null; 
      }
      setDisplayStream(null);
      setSharing(false);
      setWorkspace('whiteboard');
      setIsFullscreenWorkspace(false);
      emitRoomEvent({ type: 'screenshare', sharing: false, sharerName: userName });
      return; 
    } 
    try { 
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { cursor: 'always' } as MediaTrackConstraints, 
        audio: false 
      }); 
      const track = stream.getVideoTracks()[0]; 
      if (!track) return;

      displayStreamRef.current = stream; 
      setDisplayStream(stream);

      peersRef.current.forEach(peer => {
        const sender = findSenderForKind(peer, 'video'); 
        if (sender) sender.replaceTrack(track).catch(() => undefined);
      });

      setSharing(true); 
      setWorkspace('screenshare');
      setIsFullscreenWorkspace(true);
      setShowPipVideos(true);
      emitRoomEvent({ type: 'screenshare', sharing: true, sharerName: userName });

      track.onended = () => { 
        if (displayStreamRef.current) {
          peersRef.current.forEach(peer => {
            const sender = findSenderForKind(peer, 'video'); 
            if (sender && cameraTrackRef.current) sender.replaceTrack(cameraTrackRef.current).catch(() => undefined);
          });
          displayStreamRef.current.getTracks().forEach(t => t.stop());
          displayStreamRef.current = null;
          setDisplayStream(null);
          setSharing(false);
          setWorkspace('whiteboard');
          setIsFullscreenWorkspace(false);
          emitRoomEvent({ type: 'screenshare', sharing: false, sharerName: userName });
        }
      }; 
    } catch { 
      setNotice('Screen sharing was cancelled.'); 
    } 
  };
  
  const canvasPosition = (event: React.PointerEvent<HTMLCanvasElement>) => { 
    const rect = event.currentTarget.getBoundingClientRect(); 
    return { 
      x: ((event.clientX - rect.left) / rect.width) * event.currentTarget.width, 
      y: ((event.clientY - rect.top) / rect.height) * event.currentTarget.height 
    }; 
  };
  
  const beginDraw = (event: React.PointerEvent<HTMLCanvasElement>) => { 
    const p = canvasPosition(event); 
    drawing.current = { active: true, x: p.x, y: p.y, startX: p.x, startY: p.y }; 
    event.currentTarget.setPointerCapture(event.pointerId); 

    const ctx = canvas.current?.getContext('2d');
    if (ctx && canvas.current) {
      snapshotRef.current = ctx.getImageData(0, 0, canvas.current.width, canvas.current.height);
    }
  };
  
  const continueDraw = (event: React.PointerEvent<HTMLCanvasElement>) => { 
    if (!drawing.current.active) return; 
    const p = canvasPosition(event); 
    const previous = drawing.current; 
    const strokeColor = drawingTool === 'eraser' ? '#ffffff' : drawColor;
    const strokeWidth = drawWidth;

    if (drawingTool === 'pen' || drawingTool === 'highlighter' || drawingTool === 'eraser') {
      drawLine(p.x, p.y, previous.x, previous.y, strokeColor, strokeWidth, drawingTool); 
      queueStrokePoint({ x: p.x, y: p.y, prevX: previous.x, prevY: previous.y, color: strokeColor, width: strokeWidth, tool: drawingTool }); 
      drawing.current.x = p.x;
      drawing.current.y = p.y;
    } else {
      // Shape tools with live preview
      const ctx = canvas.current?.getContext('2d');
      if (ctx && snapshotRef.current) {
        ctx.putImageData(snapshotRef.current, 0, 0);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (drawingTool === 'line') {
          ctx.moveTo(previous.startX, previous.startY);
          ctx.lineTo(p.x, p.y);
        } else if (drawingTool === 'arrow') {
          const fromX = previous.startX;
          const fromY = previous.startY;
          const toX = p.x;
          const toY = p.y;
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(toX, toY);
          const headLen = Math.max(12, strokeWidth * 3);
          const angle = Math.atan2(toY - fromY, toX - fromX);
          ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(toX, toY);
          ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
        } else if (drawingTool === 'rect') {
          ctx.strokeRect(previous.startX, previous.startY, p.x - previous.startX, p.y - previous.startY);
        } else if (drawingTool === 'circle') {
          const radius = Math.hypot(p.x - previous.startX, p.y - previous.startY);
          ctx.arc(previous.startX, previous.startY, radius, 0, Math.PI * 2);
        }
        ctx.stroke();
      }
    }
  };

  const endDraw = () => {
    if (drawing.current.active) {
      drawing.current.active = false;
      flushStrokeBuffer();
      const dataUrl = canvas.current?.toDataURL();
      if (dataUrl) {
        emitRoomEvent({ type: 'canvas-image', dataUrl });
      }
    }
  };

  const downloadWhiteboard = () => {
    const dataUrl = canvas.current?.toDataURL('image/png');
    if (dataUrl) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `mindroot-whiteboard-${Date.now()}.png`;
      a.click();
    }
  };

  const syncWorkspaceWithPeer = () => {
    const dataUrl = canvas.current?.toDataURL();
    emitRoomEvent({
      type: 'sync-full-state',
      workspace,
      notes,
      code,
      canvasDataUrl: dataUrl
    });
    setNotice('Synced whiteboard & code workspace with all classmates!');
  };

  // Simulate 3rd / 4th classmates for instant testing
  const addSimulatedBatchStudents = (count: number) => {
    const names = [
      { name: 'Maya S. (Teacher)', role: 'teacher' },
      { name: 'Liam K. (Classmate 2)', role: 'student' },
      { name: 'Sarah M. (Classmate 3)', role: 'student' },
      { name: 'David R. (Classmate 4)', role: 'student' },
      { name: 'Emma T. (Classmate 5)', role: 'student' }
    ];

    const currentSimCount = remoteParticipants.filter(p => p.isSimulated).length;
    const newSims: Participant[] = [];

    for (let i = 0; i < count; i++) {
      const slot = names[(currentSimCount + i) % names.length];
      const simId = `sim-${Date.now()}-${i}`;
      const simStream = createSyntheticVideoStream(slot.name, `${slot.role.toUpperCase()} STREAM`, '#1a1e26');
      newSims.push({
        id: simId,
        name: slot.name,
        role: slot.role,
        stream: simStream,
        isSimulated: true
      });
      addMessage({ id: safeUUID(), sender: slot.name, text: `Joined the cohort! Ready for class.`, role: slot.role });
    }

    setRemoteParticipants(prev => [...prev, ...newSims]);
    setNotice(`Simulated ${count} cohort participants for 3-5 student batch testing!`);
  };

  const clearSimulatedStudents = () => {
    setRemoteParticipants(prev => prev.filter(p => !p.isSimulated));
    setNotice('Cleared simulated participants.');
  };

  const handlePayPostLecture = () => {
    if (!currentSession) {
      navigate('/schedule');
      return;
    }
    setIsUpiModalOpen(true);
  };

  const handleEndCall = () => {
    try {
      broadcastSignal('room-event', { event: { type: 'chat', sender: 'System', text: `${userName} left the session.` } });
    } catch {}

    setLocalStream(null);
    setRemoteParticipants([]);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach(track => track.stop());
      displayStreamRef.current = null;
    }

    peersRef.current.forEach(peer => peer.close());
    peersRef.current.clear();

    if (bcRef.current) {
      bcRef.current.close();
      bcRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setShowEndedModal(true);
  };

  const clearBoard = () => { canvas.current?.getContext('2d')?.clearRect(0, 0, canvas.current.width, canvas.current.height); emitRoomEvent({ type: 'canvas-clear' }); };

  if (sessionState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] p-6 select-none">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 animate-spin">
          <span className="material-symbols-outlined text-3xl">sync</span>
        </div>
        <p className="text-sm font-bold text-on-surface-variant">Checking lecture access...</p>
      </div>
    );
  }

  if (sessionState === 'empty') {
    return <NoLectureScheduled demoMode={demoMode} />;
  }

  if (sessionState === 'picker') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] p-6 select-none">
        <div className="w-full max-w-2xl bg-surface border border-outline-variant rounded-3xl p-8 shadow-elevation-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary-container text-primary flex items-center justify-center shadow-elevation-1">
              <span className="material-symbols-outlined text-2xl">event_upcoming</span>
            </div>
            <div>
              <h1 className="text-xl font-black text-on-surface">Upcoming Lectures</h1>
              <p className="text-xs text-on-surface-variant font-bold">You have multiple scheduled sessions. Choose one to enter:</p>
            </div>
          </div>

          <div className="space-y-3">
            {upcomingSessions.map((s: any) => {
              const start = new Date(s.scheduledAt || s.date || s.time);
              const formattedTime = isNaN(start.getTime()) ? 'Scheduled' : start.toLocaleString([], {
                weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              });
              const isTeacher = s.teacherId === currentUser?.id || s.teacher?.id === currentUser?.id;

              return (
                <div
                  key={s.id}
                  className="p-4 rounded-2xl border border-outline-variant bg-surface-container hover:border-primary/40 transition-all flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-primary/10 text-primary border border-primary/20">
                        {isTeacher ? 'Host / Mentor' : 'Student'}
                      </span>
                      <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        {formattedTime}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-on-surface truncate">{s.title || 'Live Mentoring Session'}</h3>
                    <p className="text-xs text-on-surface-variant truncate">
                      {isTeacher ? `Student: ${s.student?.name || 'Classmate'}` : `Mentor: ${s.teacher?.name || 'Instructor'}`}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/live-room/${s.id}`)}
                    className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-elevation-1 hover:brightness-110 shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Enter Session</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-outline-variant flex items-center justify-between">
            <button
              onClick={() => navigate('/schedule')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container-high transition-all cursor-pointer"
            >
              Back to Schedule
            </button>
            {demoMode && (
              <button
                onClick={() => navigate('/live-room/practice')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-amber-500 hover:bg-amber-500/10 border border-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">handyman</span>
                <span>Open Practice Room</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (sessionState && sessionState !== 'lobby') {
    return (
      <PreSessionState
        state={sessionState}
        session={currentSession}
        userRole={userRole}
        onJoinLobby={() => {
          setSessionState('lobby');
        }}
      />
    );
  }

  if (sessionState === 'lobby' && !isLobbyJoined) {
    return (
      <PreJoinLobby
        session={currentSession}
        isPractice={roomId === 'practice'}
        userRole={userRole}
        userName={userName}
        micOn={micOn}
        setMicOn={setMicOn}
        cameraOn={cameraOn}
        setCameraOn={setCameraOn}
        selectedAudioDevice={selectedAudioId}
        setSelectedAudioDevice={setSelectedAudioId}
        selectedVideoDevice={selectedVideoId}
        setSelectedVideoDevice={setSelectedVideoId}
        audioDevices={audioDevices}
        videoDevices={videoDevices}
        localStream={localStream}
        onJoin={() => {
          setIsLobbyJoined(true);
        }}
      />
    );
  }

  const totalParticipantsCount = 1 + remoteParticipants.length;
  const batchCapacity = currentSession?.maxCapacity || 3;
  const maxVideoPeers = 3; // 3 remote + 1 local = 4 total video tiles max
  const videoRemoteParticipants = remoteParticipants.slice(0, maxVideoPeers);
  const overflowAudioParticipants = remoteParticipants.slice(maxVideoPeers);

  const isDevOrDemo = Boolean(demoMode || currentUser?.role === 'admin');

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-8rem)] max-h-full w-full max-w-[1600px] mx-auto overflow-hidden rounded-2xl sm:rounded-3xl bg-background border border-border shadow-elevation-2 text-text p-2 sm:p-3 relative transition-all duration-300 select-none min-h-0">
      {/* Remote Audio Track Elements for all connected mesh peers */}
      {remoteParticipants.map(participant => (
        <RemoteAudioElement key={participant.id} stream={participant.stream} onUnlockAudio={unlockAudio} />
      ))}

      {autoplayBlocked && (
        <div 
          onClick={unlockAudio}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-surface-2 text-text px-4 py-2 rounded-xl shadow-elevation-3 font-extrabold text-xs flex items-center gap-2 cursor-pointer animate-pulse border border-border"
        >
          <span className="material-symbols-outlined text-base text-accent">volume_up</span>
          <span>Click anywhere to enable live cohort audio</span>
        </div>
      )}

      {isReconnecting && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-accent-tint text-accent-text px-4 py-2 rounded-xl shadow-elevation-3 font-extrabold text-xs flex items-center gap-2 border border-accent/20 animate-pulse">
          <span className="material-symbols-outlined text-base animate-spin">sync</span>
          <span>Connection lost — reconnecting...</span>
        </div>
      )}

      <div className="relative flex h-full flex-col gap-2 min-h-0">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-3 py-2 shadow-xs shrink-0 text-text">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-on-primary shadow-xs shrink-0">
              <span className="material-symbols-outlined text-lg">groups</span>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xs sm:text-sm font-black text-text truncate">
                  {roomId === 'practice' ? 'Practice Room (Device Check)' : (currentSession?.title || (batchCapacity > 1 ? `${batchCapacity}-Student Batch Studio` : 'Live Mentoring Studio'))}
                </h1>
                {roomId === 'practice' ? (
                  <span className="px-2 py-0.5 bg-accent-tint text-accent-text border border-accent/30 rounded-full text-[10px] font-black uppercase shrink-0">
                    Practice Room
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-primary-tint text-primary-text border border-primary/20 rounded-full text-[10px] font-black uppercase shrink-0">
                    {batchCapacity > 1 ? `${batchCapacity}-Student Batch` : '1-on-1'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-muted font-medium truncate">
                  Room: <span className="text-text font-bold">{roomId.slice(0, 16)}</span> · <span className="text-primary font-bold">● {totalParticipantsCount} Live</span>
                </p>
              </div>
            </div>
          </div>

          {/* Center View Switcher Segmented Control */}
          <div className="flex items-center bg-surface-2 p-1 rounded-xl border border-border" role="group" aria-label="Room view mode">
            <button
              onClick={() => {
                if (isFullscreenWorkspace) toggleFullscreenMode(false);
                setViewMode('studio');
              }}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                viewMode === 'studio' && !isFullscreenWorkspace
                  ? "bg-surface text-primary shadow-xs border border-border"
                  : "text-muted hover:text-text"
              )}
              aria-label="Studio View"
              title="Studio View (Whiteboard + Video Strip)"
            >
              <span className="material-symbols-outlined text-[15px]">draw</span>
              <span className="hidden sm:inline">Studio</span>
            </button>

            <button
              onClick={() => {
                if (isFullscreenWorkspace) toggleFullscreenMode(false);
                setViewMode('gallery');
              }}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                viewMode === 'gallery' && !isFullscreenWorkspace
                  ? "bg-surface text-primary shadow-xs border border-border"
                  : "text-muted hover:text-text"
              )}
              aria-label="Gallery View"
              title="Gallery Grid View (2x2 All Cameras)"
            >
              <span className="material-symbols-outlined text-[15px]">grid_view</span>
              <span className="hidden sm:inline">Gallery</span>
            </button>

            <button
              onClick={() => toggleFullscreenMode(!isFullscreenWorkspace)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                isFullscreenWorkspace
                  ? "bg-surface text-primary shadow-xs border border-border"
                  : "text-muted hover:text-text"
              )}
              aria-label={isFullscreenWorkspace ? "Exit Fullscreen" : "Fullscreen View"}
              title={isFullscreenWorkspace ? "Exit Fullscreen" : "Fullscreen Focus Mode"}
            >
              <span className="material-symbols-outlined text-[15px]">{isFullscreenWorkspace ? 'fullscreen_exit' : 'open_in_full'}</span>
              <span className="hidden sm:inline">Fullscreen</span>
            </button>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Dev / Demo Overflow Menu */}
            {isDevOrDemo && (
              <div className="relative">
                <button
                  onClick={() => setShowDevOverflow(v => !v)}
                  className={clsx(
                    "grid h-8 w-8 place-items-center rounded-xl border border-border transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                    showDevOverflow ? "bg-surface-2 text-primary" : "bg-surface text-muted hover:text-text hover:bg-surface-2"
                  )}
                  title="Developer & Demo Controls"
                  aria-label="Developer and Demo controls"
                >
                  <span className="material-symbols-outlined text-[17px]">more_vert</span>
                </button>

                {showDevOverflow && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDevOverflow(false)} />
                    <div className="absolute right-0 top-10 z-50 w-64 rounded-2xl border border-border bg-surface p-2.5 text-text shadow-elevation-3 animate-in fade-in slide-in-from-top-2 duration-150 space-y-2">
                      <div className="text-[11px] font-bold text-muted px-1 uppercase tracking-wider">
                        Dev & Demo Controls
                      </div>

                      {/* WebRTC ICE Diagnostic */}
                      <div 
                        title="WebRTC ICE Connection Status"
                        className={clsx(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border shadow-2xs transition-all",
                          iceDiagnostic === 'Direct P2P' && "bg-primary-tint text-primary-text border-primary/30",
                          iceDiagnostic === 'TURNS Relay 443' && "bg-sky-500/10 text-sky-400 border-sky-500/30",
                          iceDiagnostic === 'Connecting...' && "bg-accent-tint text-accent-text border-accent/30 animate-pulse",
                          iceDiagnostic === 'Connection Failed' && "bg-danger/10 text-danger border-danger/30",
                          iceDiagnostic === 'SIMULATED PLAYBACK (DEMO)' && "bg-accent-tint text-accent-text border-accent/30"
                        )}
                      >
                        <span className="h-2 w-2 rounded-full shrink-0 bg-current animate-pulse" />
                        <span>ICE: {iceDiagnostic}</span>
                      </div>

                      {/* Simulated Students */}
                      {remoteParticipants.length < 3 ? (
                        <button
                          onClick={() => {
                            addSimulatedBatchStudents(remoteParticipants.length === 0 ? 3 : 3 - remoteParticipants.length);
                            setShowDevOverflow(false);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold bg-primary-tint text-primary-text border border-primary/20 hover:bg-primary-tint/80 transition-all cursor-pointer"
                          title="Simulate 3 students joining for testing"
                        >
                          <span className="material-symbols-outlined text-sm">group_add</span>
                          <span>Simulate 3 Students</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            clearSimulatedStudents();
                            setShowDevOverflow(false);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold bg-surface-2 text-text hover:bg-surface-2/80 border border-border transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                          <span>Clear Sims</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1 rounded-xl bg-surface-2 hover:bg-surface-2/80 text-text px-2.5 py-1.5 text-xs font-bold border border-border transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              aria-label="Invite link"
              title="Copy Room Invitation Link"
            >
              <span className="material-symbols-outlined text-sm">{copiedLink ? 'check' : 'content_copy'}</span>
              <span>{copiedLink ? 'Copied' : 'Invite'}</span>
            </button>

            <button
              onClick={handleEndCall}
              className="flex items-center gap-1 rounded-xl bg-danger hover:opacity-90 text-white px-3 py-1.5 text-xs font-bold transition-all active:scale-95 shadow-xs focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none"
              aria-label="Leave lecture call"
              title="Leave Room"
            >
              <span className="material-symbols-outlined text-sm">call_end</span>
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </header>

        {/* Main Stage Content */}
        {viewMode === 'gallery' ? (
          <VideoGrid
            localStream={localStream}
            userName={userName}
            userRole={userRole}
            raisedHand={raisedHand}
            cameraOn={cameraOn}
            micOn={micOn}
            cycleNextCamera={cycleNextCamera}
            videoDevices={videoDevices}
            hardwareCam={hardwareInfo.cam}
            remoteParticipants={remoteParticipants}
            videoRemoteParticipants={videoRemoteParticipants}
            overflowAudioParticipants={overflowAudioParticipants}
            totalParticipantsCount={totalParticipantsCount}
            unlockAudio={unlockAudio}
            onOpenWhiteboardStudio={() => setViewMode('studio')}
            onSimulateStudents={() => addSimulatedBatchStudents(3)}
            isTeacher={isTeacher}
          />
        ) : (
          /* STUDIO VIEW: Compact Video Strip (~120-140px) + Main Workspace + Responsive Sidebar */
          <section className="grid min-h-0 flex-1 gap-2 sm:gap-2.5 lg:grid-cols-[minmax(0,1fr)_320px] overflow-hidden min-w-0">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden gap-2 sm:gap-2.5 transition-all duration-300">
              {/* Compact Video Strip: ~120-140px high */}
              <div className={clsx(
                "grid gap-2 sm:gap-2.5 w-full shrink-0 h-32 sm:h-36 transition-all duration-300",
                totalParticipantsCount === 1 ? 'grid-cols-1 sm:grid-cols-2' :
                totalParticipantsCount === 2 ? 'grid-cols-2' :
                totalParticipantsCount === 3 ? 'grid-cols-1 sm:grid-cols-3' :
                totalParticipantsCount === 4 ? 'grid-cols-2 sm:grid-cols-4' :
                'grid-cols-2 sm:grid-cols-3 md:grid-cols-6'
              )}>
                {/* Local Participant Card */}
                <VideoTile 
                  stream={localStream} 
                  name={userName + ' (You)'} 
                  role={userRole}
                  muted 
                  waiting={false} 
                  raised={raisedHand} 
                  cameraOff={!cameraOn} 
                  micOff={!micOn}
                  accent={isTeacher ? "bg-primary" : "bg-accent"}
                  onSwitchCamera={cycleNextCamera}
                  hasMultipleCameras={videoDevices.length > 1}
                  isHardware={hardwareInfo.cam}
                  className="h-full w-full"
                />

                {/* Remote Participants Cards (Max 3 Video Mesh Streams) */}
                {videoRemoteParticipants.map(participant => (
                  <VideoTile 
                    key={participant.id}
                    stream={participant.stream} 
                    name={participant.name} 
                    role={participant.role}
                    muted={false} 
                    waiting={false} 
                    raised={participant.handRaised} 
                    isSimulated={participant.isSimulated}
                    accent={participant.role === 'teacher' ? "bg-primary" : "bg-accent"} 
                    isRemote
                    onUnlockAudio={unlockAudio}
                    className="h-full w-full"
                  />
                ))}

                {/* Overflow Mesh Participants as Audio-only Avatar Tiles */}
                {overflowAudioParticipants.map(participant => (
                  <div 
                    key={participant.id} 
                    className="relative overflow-hidden rounded-2xl border border-border bg-surface-2 p-2.5 flex flex-col items-center justify-center text-center shadow-2xs h-full w-full select-none"
                    title="Audio-only mode: peer mesh capped at 4 video tiles to preserve bandwidth"
                  >
                    <div className="h-9 w-9 rounded-xl bg-surface border border-border flex items-center justify-center text-text font-bold text-xs mb-1">
                      {participant.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="text-xs font-bold text-text truncate max-w-[120px]">{participant.name}</div>
                    <span className="text-[10px] text-accent-text font-bold mt-0.5 flex items-center gap-1 bg-accent-tint px-2 py-0.5 rounded-full border border-accent/20">
                      <span className="material-symbols-outlined text-xs">volume_up</span> Audio-Only
                    </span>
                  </div>
                ))}

                {/* Companion Placeholder Card when alone */}
                {remoteParticipants.length === 0 && (
                  isDevOrDemo ? (
                    <div 
                      onClick={() => addSimulatedBatchStudents(3)}
                      className="h-full w-full rounded-2xl border-2 border-dashed border-border bg-surface-2/60 hover:bg-surface-2 flex flex-col items-center justify-center p-2.5 text-center cursor-pointer transition-all group select-none shadow-2xs"
                      title="Click to simulate 3 classmates joining"
                      role="button"
                      tabIndex={0}
                      aria-label="Simulate 3 classmates joining"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary-tint text-primary-text group-hover:scale-105 flex items-center justify-center mb-1 transition-transform">
                        <span className="material-symbols-outlined text-base">group_add</span>
                      </div>
                      <span className="text-xs font-bold text-text">Waiting for Classmates</span>
                      <span className="text-[11px] text-primary font-bold mt-0.5 group-hover:underline">
                        + Click to Simulate 3 Students
                      </span>
                    </div>
                  ) : (
                    <div 
                      className="h-full w-full rounded-2xl border border-dashed border-border bg-surface-2/40 flex flex-col items-center justify-center p-2.5 text-center select-none shadow-2xs"
                    >
                      <div className="w-8 h-8 rounded-full bg-surface-2 text-muted flex items-center justify-center mb-1">
                        <span className="material-symbols-outlined text-base">schedule</span>
                      </div>
                      <span className="text-xs font-bold text-text">Waiting for Classmates</span>
                      <span className="text-[11px] text-muted font-medium mt-0.5">
                        Students will appear here once connected
                      </span>
                    </div>
                  )
                )}
              </div>

              {/* Main Workspace (Whiteboard / Notes / Code Pad) */}
              {workspace !== 'none' && (
                <div className="min-h-0 min-w-0 flex-1 h-full w-full overflow-hidden transition-all duration-300">
                  <WorkspaceContent
                    workspace={workspace}
                    chooseWorkspace={chooseWorkspace}
                    isFullscreen={false}
                    drawColor={drawColor}
                    setDrawColor={setDrawColor}
                    drawWidth={drawWidth}
                    setDrawWidth={setDrawWidth}
                    drawingTool={drawingTool}
                    setDrawingTool={setDrawingTool}
                    syncWorkspaceWithPeer={syncWorkspaceWithPeer}
                    downloadWhiteboard={downloadWhiteboard}
                    clearBoard={clearBoard}
                    canvasRef={canvas}
                    beginDraw={beginDraw}
                    continueDraw={continueDraw}
                    endDraw={endDraw}
                    notes={notes}
                    setNotes={setNotes}
                    emitRoomEvent={emitRoomEvent}
                    code={code}
                    setCode={setCode}
                    selectedCodeLang={selectedCodeLang}
                    setSelectedCodeLang={setSelectedCodeLang}
                    codeOutput={codeOutput}
                    onClearCodeOutput={() => setCodeOutput(null)}
                    isRunningCode={isRunningCode}
                    copiedCode={copiedCode}
                    handleCopyCode={handleCopyCode}
                    sharing={sharing}
                    isPeerScreenSharing={isPeerScreenSharing}
                    sharerName={sharerName}
                    displayStream={displayStream || displayStreamRef.current}
                    remoteStream={remoteParticipants.find(p => p.name === sharerName || p.role === 'teacher')?.stream || remoteParticipants[0]?.stream || null}
                    onUnlockAudio={unlockAudio}
                  />
                </div>
              )}
            </div>
            
            {/* Right Sidebar: Chat & Session Notes Tabs */}
            <aside 
              aria-label="Live room sidebar"
              className={clsx(
                'min-h-0 min-w-0 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-elevation-1 transition-all duration-300 flex-col text-text w-full lg:w-80 box-border',
                chatOpen ? 'flex' : 'hidden lg:flex'
              )}
            >
              {/* Tab Header */}
              <div className="flex items-center border-b border-border bg-surface-2 p-1.5 shrink-0 gap-1.5 min-w-0 box-border" role="tablist">
                <button
                  role="tab"
                  aria-selected={sidebarTab === 'chat'}
                  onClick={() => setSidebarTab('chat')}
                  className={clsx(
                    "flex-1 min-w-0 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                    sidebarTab === 'chat'
                      ? "bg-surface text-primary shadow-xs border border-border"
                      : "text-muted hover:text-text"
                  )}
                >
                  <span className="material-symbols-outlined text-[15px] shrink-0">forum</span>
                  <span className="truncate">Live Chat</span>
                </button>
                <button
                  role="tab"
                  aria-selected={sidebarTab === 'notes'}
                  onClick={() => setSidebarTab('notes')}
                  className={clsx(
                    "flex-1 min-w-0 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                    sidebarTab === 'notes'
                      ? "bg-surface text-primary shadow-xs border border-border"
                      : "text-muted hover:text-text"
                  )}
                >
                  <span className="material-symbols-outlined text-[15px] shrink-0">edit_note</span>
                  <span className="truncate">Quick Notes</span>
                  {sessionNotesList.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-primary-tint text-primary-text text-xs font-black shrink-0 leading-none">
                      {sessionNotesList.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Body */}
              {sidebarTab === 'chat' ? (
                <div className="flex-1 min-h-0 min-w-0 flex flex-col">
                  <RoomChat
                    messages={messages}
                    chatText={chatText}
                    setChatText={setChatText}
                    sendChat={sendChat}
                    chatOpen={true}
                  />
                </div>
              ) : (
                <div className="flex-1 min-h-0 min-w-0 flex flex-col bg-surface p-3 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-3 box-border">
                  {/* Inline Add Note Section */}
                  <div className="p-3 bg-surface-2 rounded-xl border border-border space-y-2 shrink-0 min-w-0 box-border">
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-text flex items-center gap-1 min-w-0 truncate">
                        <span className="material-symbols-outlined text-sm text-primary shrink-0">add_circle</span>
                        <span className="truncate">Quick Inline Note</span>
                      </span>
                      <button
                        onClick={() => setIsSessionNotesPanelOpen(true)}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer shrink-0 focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none rounded"
                        title="Open full-page rich text editor & attachments"
                        aria-label="Open full-page rich text editor"
                      >
                        <span>Full Editor</span>
                        <span className="material-symbols-outlined text-xs">open_in_new</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={inlineNoteTitle}
                      onChange={e => setInlineNoteTitle(e.target.value)}
                      placeholder="Note title (e.g. Key formula)..."
                      className="w-full bg-surface text-text text-xs rounded-lg px-2.5 py-1.5 border border-border focus:border-primary focus:outline-hidden box-border"
                    />
                    <textarea
                      value={inlineNoteContent}
                      onChange={e => setInlineNoteContent(e.target.value)}
                      placeholder="Key takeaway, question, action item..."
                      rows={2}
                      className="w-full bg-surface text-text text-xs rounded-lg px-2.5 py-1.5 border border-border focus:border-primary focus:outline-hidden resize-none box-border"
                    />
                    <button
                      disabled={isSavingInlineNote || (!inlineNoteTitle.trim() && !inlineNoteContent.trim())}
                      onClick={handleSaveInlineNote}
                      className="w-full py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-on-primary rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer box-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                    >
                      <span className="material-symbols-outlined text-sm">save</span>
                      <span>{isSavingInlineNote ? 'Saving...' : 'Save to Session'}</span>
                    </button>
                  </div>

                  {/* Notes List for this session */}
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center justify-between text-xs font-bold text-muted px-1 min-w-0">
                      <span className="truncate min-w-0 flex-1">Notes in this Lecture ({sessionNotesList.length})</span>
                      <button
                        onClick={loadSessionNotesList}
                        className="hover:text-primary transition-colors cursor-pointer p-1 rounded-md shrink-0 flex items-center justify-center text-muted hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                        title="Refresh session notes"
                        aria-label="Refresh session notes"
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span>
                      </button>
                    </div>

                    {loadingSessionNotes ? (
                      <div className="py-6 text-center text-xs text-muted font-bold animate-pulse">
                        Loading session notes...
                      </div>
                    ) : sessionNotesList.length === 0 ? (
                      <div className="p-4 text-center bg-surface-2/60 border border-dashed border-border rounded-xl space-y-1.5 min-w-0">
                        <span className="material-symbols-outlined text-xl text-muted">description</span>
                        <p className="text-xs font-bold text-text">No notes yet</p>
                        <p className="text-xs text-muted leading-relaxed">
                          Write quick notes in the sidebar or launch the full editor for markdown and rich attachments.
                        </p>
                      </div>
                    ) : (
                      sessionNotesList.map(n => {
                        const isShared = n.visibility === 'shared';
                        const isAuthor = n.authorId === currentUser?.id;
                        const preview = (n.content || '').replace(/<[^>]*>/g, ' ').slice(0, 100);
                        return (
                          <div
                            key={n.id}
                            onClick={() => setIsSessionNotesPanelOpen(true)}
                            className="p-2.5 rounded-xl border border-border bg-surface-2 hover:border-primary/50 transition-all cursor-pointer space-y-1.5 shadow-2xs group min-w-0 box-border"
                          >
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <span className="text-xs font-bold text-text group-hover:text-primary truncate min-w-0 flex-1">
                                {n.title || 'Untitled Note'}
                              </span>
                              {isShared ? (
                                <span className="px-2 py-0.5 rounded-md bg-accent-tint text-accent-text text-xs font-extrabold shrink-0 border border-accent/30">
                                  {isAuthor ? 'Shared' : 'Shared by Mentor'}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-surface text-muted text-xs font-bold shrink-0 border border-border">
                                  Private
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                              {preview || 'No content...'}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </aside>
          </section>
        )}

        {/* Bottom Control Bar in Standard View */}
        <footer className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-3 py-2 shadow-xs sm:px-4 shrink-0 z-30 relative text-text">
          <p className="hidden max-w-[260px] text-xs text-muted xl:block font-medium truncate">{notice}</p>
          
          <div className="flex flex-1 items-center justify-center gap-2 sm:gap-2.5">
            {/* Microphone Pill Control */}
            <div className="relative flex items-center bg-surface border border-border rounded-full shadow-xs hover:border-primary/40 transition duration-200">
              <button
                onClick={toggleMicWithPermission}
                title={micOn ? 'Mute microphone' : 'Unmute microphone'}
                aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
                className={clsx(
                  'grid h-10 w-10 place-items-center rounded-full transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                  !micOn
                    ? 'bg-danger text-white shadow-xs'
                    : 'text-muted hover:bg-surface-2 hover:text-text'
                )}
              >
                <span className="material-symbols-outlined text-[19px]">{micOn ? 'mic' : 'mic_off'}</span>
              </button>
              <button
                onClick={() => setShowAudioMenu(v => !v)}
                className="h-10 pr-2 pl-0.5 flex items-center justify-center text-muted hover:text-text transition-colors border-l border-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded-r-full"
                title="Select microphone device"
                aria-label="Select microphone device"
              >
                <span className="material-symbols-outlined text-[16px] hover:scale-110 transition-transform">keyboard_arrow_up</span>
              </button>
              
              {showAudioMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAudioMenu(false)} />
                  <div className="absolute bottom-12 left-0 w-64 rounded-2xl border border-border bg-surface text-text p-2 shadow-elevation-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="text-xs font-bold text-muted px-2.5 py-1.5 border-b border-border uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-primary">mic</span> Select Microphone
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-0.5 mt-1.5 custom-scrollbar">
                      {audioDevices.length === 0 ? (
                        <div className="text-xs text-muted p-2.5 italic">No physical microphones detected</div>
                      ) : (
                        audioDevices.map(d => (
                          <button
                            key={d.deviceId}
                            onClick={() => changeAudioDevice(d.deviceId)}
                            className={clsx(
                              "w-full text-left px-2.5 py-1.5 text-xs rounded-xl transition-colors flex items-center justify-between",
                              selectedAudioId === d.deviceId ? "bg-primary text-on-primary font-bold" : "hover:bg-surface-2 text-text"
                            )}
                          >
                            <span className="truncate">{d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</span>
                            {selectedAudioId === d.deviceId && <span className="material-symbols-outlined text-xs">check</span>}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Camera Pill Control */}
            <div className="relative flex items-center bg-surface border border-border rounded-full shadow-xs hover:border-primary/40 transition duration-200">
              <button
                onClick={toggleCameraWithPermission}
                title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
                aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
                className={clsx(
                  'grid h-10 w-10 place-items-center rounded-full transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                  !cameraOn
                    ? 'bg-danger text-white shadow-xs'
                    : 'text-muted hover:bg-surface-2 hover:text-text'
                )}
              >
                <span className="material-symbols-outlined text-[19px]">{cameraOn ? 'videocam' : 'videocam_off'}</span>
              </button>
              <button
                onClick={() => setShowVideoMenu(v => !v)}
                className="h-10 pr-2 pl-0.5 flex items-center justify-center text-muted hover:text-text transition-colors border-l border-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded-r-full"
                title="Select camera device"
                aria-label="Select camera device"
              >
                <span className="material-symbols-outlined text-[16px] hover:scale-110 transition-transform">keyboard_arrow_up</span>
              </button>

              {showVideoMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowVideoMenu(false)} />
                  <div className="absolute bottom-12 left-0 w-64 rounded-2xl border border-border bg-surface text-text p-2 shadow-elevation-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="text-xs font-bold text-muted px-2.5 py-1.5 border-b border-border uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-primary">videocam</span> Select Camera</span>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                            stream.getTracks().forEach(t => t.stop());
                          } catch {}
                          await loadDevices();
                        }}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                        title="Re-scan connected camera hardware"
                      >
                        <span className="material-symbols-outlined text-xs">sync</span> Rescan
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-0.5 mt-1.5 custom-scrollbar">
                      {videoDevices.length === 0 ? (
                        <div className="p-2 space-y-1.5 text-center">
                          <p className="text-xs text-muted italic font-medium">No physical camera detected or permission blocked.</p>
                          <button
                            onClick={async () => {
                              try {
                                await toggleCameraWithPermission();
                              } catch {}
                              await loadDevices();
                            }}
                            className="w-full py-1.5 px-2 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-bold transition-all shadow-xs"
                          >
                            Grant Camera Access
                          </button>
                        </div>
                      ) : (
                        videoDevices.map(d => {
                          const isLaptopCam = /integrated|built-in|laptop|internal|webcam|hd camera/i.test(d.label);
                          return (
                            <button
                              key={d.deviceId}
                              onClick={() => changeVideoDevice(d.deviceId)}
                              className={clsx(
                                "w-full text-left px-2.5 py-1.5 text-xs rounded-xl transition-colors flex items-center justify-between",
                                selectedVideoId === d.deviceId ? "bg-primary text-on-primary font-bold" : "hover:bg-surface-2 text-text"
                              )}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="material-symbols-outlined text-sm">{isLaptopCam ? 'laptop' : 'videocam'}</span>
                                <span className="truncate">{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</span>
                              </div>
                              {selectedVideoId === d.deviceId && <span className="material-symbols-outlined text-xs">check</span>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Hand Raise Control (Students Only) */}
            {!isTeacher && (
              <Control
                active={raisedHand}
                icon="pan_tool"
                label="Raise hand"
                highlighted={raisedHand}
                onClick={toggleHand}
              />
            )}

            {/* Screen Share Control */}
            <Control
              active={sharing}
              icon="present_to_all"
              label="Share screen"
              highlighted={sharing}
              onClick={toggleShare}
            />

            {/* Chat Toggle Button */}
            <button
              onClick={() => setChatOpen(value => !value)}
              className={clsx(
                "grid h-10 w-10 place-items-center rounded-full border transition hover:-translate-y-0.5 active:translate-y-0 active:scale-95 shadow-xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                chatOpen ? "bg-primary text-on-primary border-primary" : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-text"
              )}
              title="Toggle Live Chat"
              aria-label="Toggle live chat"
            >
              <span className="material-symbols-outlined text-[18px]">chat</span>
            </button>

            {/* Session Notes Panel Toggle Button */}
            {currentSession && (
              <button
                onClick={() => setIsSessionNotesPanelOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-muted hover:bg-surface-2 hover:text-primary transition hover:-translate-y-0.5 active:translate-y-0 active:scale-95 shadow-xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                title="View & Add Session Notes"
                aria-label="Open session notes editor"
              >
                <span className="material-symbols-outlined text-[18px]">edit_note</span>
              </button>
            )}
          </div>

          {/* Leave Call Button */}
          <button
            onClick={handleEndCall}
            className="grid h-10 w-12 place-items-center rounded-full bg-danger text-white shadow-xs transition hover:-translate-y-0.5 hover:opacity-90 hover:scale-105 active:translate-y-0 active:scale-95 duration-200 focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none"
            title="Disconnect call & release devices"
            aria-label="Leave call"
          >
            <span className="material-symbols-outlined text-[20px]">call_end</span>
          </button>
        </footer>
      </div>

      {/* FULLSCREEN EXPLANATION WORKSPACE OVERLAY */}
      {isFullscreenWorkspace && (
        <div className="fixed inset-0 z-50 bg-bg/95 backdrop-blur-md flex flex-col p-2 sm:p-3 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
          {/* Fullscreen Top Navigation */}
          <header className="mb-2 flex items-center justify-between gap-2 rounded-2xl bg-surface border border-border px-4 py-2.5 text-text shadow-xs">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-on-primary">
                <span className="material-symbols-outlined text-[19px]">fit_screen</span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-wide text-text uppercase">Fullscreen Focus Mode</span>
                  <span className="rounded-full bg-primary-tint border border-primary/30 px-2 py-0.5 text-xs font-extrabold text-primary-text animate-pulse">
                    ● Live Focus
                  </span>
                </div>
                <p className="text-xs text-muted font-medium">Room: {roomId.slice(0, 14)} · Press <kbd className="bg-surface-2 px-1.5 py-0.5 rounded text-xs border border-border text-text font-mono">ESC</kbd> to exit</p>
              </div>
            </div>

            {/* Quick Actions in Fullscreen */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPipVideos(v => !v)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                  showPipVideos ? "bg-surface-2 border-primary/30 text-primary" : "bg-transparent border-border text-muted hover:bg-surface-2"
                )}
                title="Toggle Floating Video Feeds"
                aria-label="Toggle floating video feeds"
              >
                <span className="material-symbols-outlined text-[16px]">{showPipVideos ? 'picture_in_picture_alt' : 'visibility_off'}</span>
                <span className="hidden md:inline">{showPipVideos ? 'Hide Video PiP' : 'Show Video PiP'}</span>
              </button>

              <button
                onClick={() => setShowFullscreenChat(v => !v)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                  showFullscreenChat ? "bg-primary border-primary text-on-primary" : "bg-surface-2 border-border text-text hover:bg-surface-2/80"
                )}
                title="Open Chat Drawer"
                aria-label="Open chat drawer"
              >
                <span className="material-symbols-outlined text-[16px]">forum</span>
                <span className="hidden md:inline">Chat</span>
              </button>

              <button
                onClick={() => toggleFullscreenMode(false)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-2/80 text-text text-xs font-bold border border-border transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                title="Exit Fullscreen Mode"
                aria-label="Exit Fullscreen Mode"
              >
                <span className="material-symbols-outlined text-[17px]">fullscreen_exit</span>
                <span>Exit Fullscreen</span>
              </button>
            </div>
          </header>

          {/* Fullscreen Workspace Main Body */}
          <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden border border-white/10 bg-slate-900 shadow-2xl flex">
            {/* Main Interactive Expanded View */}
            <div className="flex-1 flex flex-col min-h-0 bg-surface text-on-surface">
              <WorkspaceContent
                workspace={workspace}
                chooseWorkspace={chooseWorkspace}
                isFullscreen={true}
                drawColor={drawColor}
                setDrawColor={setDrawColor}
                drawWidth={drawWidth}
                setDrawWidth={setDrawWidth}
                drawingTool={drawingTool}
                setDrawingTool={setDrawingTool}
                syncWorkspaceWithPeer={syncWorkspaceWithPeer}
                downloadWhiteboard={downloadWhiteboard}
                clearBoard={clearBoard}
                canvasRef={canvas}
                beginDraw={beginDraw}
                continueDraw={continueDraw}
                endDraw={endDraw}
                notes={notes}
                setNotes={setNotes}
                emitRoomEvent={emitRoomEvent}
                code={code}
                setCode={setCode}
                selectedCodeLang={selectedCodeLang}
                setSelectedCodeLang={setSelectedCodeLang}
                codeOutput={codeOutput}
                onClearCodeOutput={() => setCodeOutput(null)}
                isRunningCode={isRunningCode}
                copiedCode={copiedCode}
                handleCopyCode={handleCopyCode}
                sharing={sharing}
                isPeerScreenSharing={isPeerScreenSharing}
                sharerName={sharerName}
                displayStream={displayStream || displayStreamRef.current}
                remoteStream={remoteParticipants.find(p => p.name === sharerName || p.role === 'teacher')?.stream || remoteParticipants[0]?.stream || null}
                onUnlockAudio={unlockAudio}
              />
            </div>

            {/* Fullscreen Floating Video PiP Box in Top Right */}
            {showPipVideos && (
              <div className="absolute top-4 right-4 z-40 flex flex-col gap-2 p-2.5 bg-slate-950/90 border border-white/20 rounded-2xl shadow-2xl backdrop-blur-md w-72 sm:w-96 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between px-1 text-[11px] font-black text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className={clsx("h-2 w-2 rounded-full", totalParticipantsCount > 1 ? "bg-teaching-emerald animate-pulse" : "bg-learning-amber")} />
                    <span>Live Video Feeds ({totalParticipantsCount} in Class)</span>
                  </span>
                  <button 
                    onClick={() => setShowPipVideos(false)}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Minimize Video Box"
                  >
                    <span className="material-symbols-outlined text-[15px]">close</span>
                  </button>
                </div>

                <div className={`grid gap-2 ${totalParticipantsCount > 2 ? 'grid-cols-2 max-h-56 overflow-y-auto custom-scrollbar' : 'grid-cols-2'}`}>
                  {/* Local video tile in PiP */}
                  <VideoTile 
                    stream={localStream} 
                    name={userName + ' (You)'} 
                    role={userRole}
                    muted 
                    waiting={false} 
                    raised={raisedHand} 
                    cameraOff={!cameraOn} 
                    micOff={!micOn}
                    accent={isTeacher ? "bg-teaching-emerald" : "bg-learning-amber"}
                    onSwitchCamera={cycleNextCamera}
                    hasMultipleCameras={videoDevices.length > 1}
                    isHardware={hardwareInfo.cam}
                    className="h-28 w-full"
                  />

                  {/* Remote participants in PiP (Max 3 Video Mesh Streams) */}
                  {videoRemoteParticipants.map(p => (
                    <VideoTile 
                      key={p.id}
                      stream={p.stream} 
                      name={p.name} 
                      role={p.role}
                      muted={false} 
                      waiting={false} 
                      raised={p.handRaised} 
                      isSimulated={p.isSimulated}
                      accent={p.role === 'teacher' ? "bg-teaching-emerald" : "bg-learning-amber"} 
                      isRemote
                      onUnlockAudio={unlockAudio}
                      className="h-28 w-full"
                    />
                  ))}
                  {overflowAudioParticipants.map(p => (
                    <div 
                      key={p.id} 
                      className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-2 flex flex-col items-center justify-center text-center shadow-sm h-28 w-full"
                      title="Audio-only mode: peer mesh capped at 4 video tiles to preserve bandwidth"
                    >
                      <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-bold text-xs mb-1">
                        {p.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="text-[10px] font-bold text-white truncate max-w-[90px]">{p.name}</div>
                      <span className="text-[8px] text-amber-400 font-bold mt-1 flex items-center gap-0.5 bg-amber-400/10 px-1 py-0.5 rounded-full border border-amber-400/20">
                        <span className="material-symbols-outlined text-[9px]">volume_up</span> Audio Cap
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fullscreen Floating Chat Drawer */}
            {showFullscreenChat && (
              <RoomChat
                messages={messages}
                chatText={chatText}
                setChatText={setChatText}
                sendChat={sendChat}
                isDrawer={true}
                onClose={() => setShowFullscreenChat(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* Session Ended Modal */}
      {showEndedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface text-on-surface rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-elevation-3 border border-outline-variant relative space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-teaching-emerald-container text-on-teaching-emerald-container flex items-center justify-center mx-auto border border-teaching-emerald/20 shadow-elevation-1">
              <span className="material-symbols-outlined text-3xl">task_alt</span>
            </div>
            
            <div>
              <h3 className="text-xl font-black text-on-surface">Lecture Completed!</h3>
              <p className="text-xs text-on-surface-variant font-medium mt-1">
                Your live mentoring session has concluded.
              </p>
            </div>

            {/* Post-Lecture Payment Section for Students */}
            {!isTeacher && currentSession?.paymentStatus !== 'paid' && currentSession?.paymentStatus !== 'confirmed' && currentSession?.type !== 'swap' && (
              <div className="bg-teaching-emerald-container/50 border border-teaching-emerald/20 rounded-2xl p-4 text-left space-y-2 text-on-teaching-emerald-container">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span>Mentor Fee Due:</span>
                  <span className="text-teaching-emerald text-base font-black">
                    ₹{currentSession?.pricePerStudent || currentSession?.amount || 499}
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                  As part of our Pay After Lecture guarantee, please complete your fee payment via UPI / Direct Transfer.
                </p>
                <button
                  onClick={handlePayPostLecture}
                  className="w-full py-2.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-black transition-all shadow-elevation-1 active:scale-95 flex items-center justify-center gap-1.5 mt-1"
                >
                  <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
                  <span>Pay ₹{currentSession?.pricePerStudent || currentSession?.amount || 499} via UPI</span>
                </button>
              </div>
            )}

            {/* AI Session Recap Card */}
            <div className="bg-surface-container-low border border-primary/20 rounded-2xl p-4 text-left space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">auto_awesome</span>
                  <span className="text-xs font-black text-on-surface">AI Study Guide & Session Recap</span>
                </div>
                {!aiSummary && (
                  <button
                    onClick={generateAISummary}
                    disabled={isGeneratingSummary}
                    className="px-2.5 py-1 bg-primary text-on-primary rounded-lg text-[11px] font-bold hover:bg-primary/90 flex items-center gap-1 transition-all"
                  >
                    <span className="material-symbols-outlined text-xs">{isGeneratingSummary ? 'hourglass_top' : 'psychology'}</span>
                    {isGeneratingSummary ? 'Generating…' : 'Generate'}
                  </button>
                )}
              </div>

              {aiSummary ? (
                <div className="space-y-2">
                  <div className="max-h-48 overflow-y-auto p-3 bg-surface rounded-xl border border-outline-variant text-[11px] font-mono leading-relaxed text-on-surface whitespace-pre-line custom-scrollbar">
                    {aiSummary}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(aiSummary);
                      alert('AI Study Guide copied to clipboard!');
                    }}
                    className="w-full py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all"
                  >
                    <span className="material-symbols-outlined text-xs">content_copy</span>
                    Copy AI Recap
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Synthesize key takeaways, diagrams, and code snippets from this lecture into personalized revision notes.
                </p>
              )}
            </div>

            {/* Quick 30-Second Karma & Mentor Rating Card (Students Only) */}
            {!isTeacher && (
              <div className="p-4 bg-surface-container/60 rounded-2xl border border-outline-variant/60 space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-on-surface">
                    <span className="material-symbols-outlined text-learning-amber text-base">award_star</span>
                    <span>Rate Mentor: {currentSession?.teacher?.name || 'Instructor'}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-learning-amber/15 text-learning-amber rounded-full font-bold">
                    +15 Karma Pts
                  </span>
                </div>

                {isReviewSubmitted ? (
                  <div className="p-3 bg-teaching-emerald-container text-on-teaching-emerald-container rounded-xl text-xs font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>Rating submitted! Mentor trust score boosted.</span>
                  </div>
                ) : (
                  <>
                    {/* Star Selector */}
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setQuickRating(star)}
                          className={`p-1 rounded-lg transition-transform hover:scale-110 ${star <= quickRating ? 'text-learning-amber' : 'text-outline-variant'}`}
                        >
                          <span className="material-symbols-outlined text-xl">star</span>
                        </button>
                      ))}
                      <span className="text-xs font-bold text-on-surface ml-1">{quickRating}.0 / 5.0</span>
                    </div>

                    {/* Quick Karma Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {['Clear Explanations', 'Great Code Walkthrough', 'Patient & Friendly', 'Punctual'].map(badge => {
                        const isSelected = selectedKarmaBadges.includes(badge);
                        return (
                          <button
                            key={badge}
                            type="button"
                            onClick={() => {
                              setSelectedKarmaBadges(prev => 
                                isSelected ? prev.filter(b => b !== badge) : [...prev, badge]
                              );
                            }}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors ${
                              isSelected
                                ? 'bg-primary text-on-primary'
                                : 'bg-surface border border-outline-variant text-on-surface-variant'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}{badge}
                          </button>
                        );
                      })}
                    </div>

                    <input
                      type="text"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Add brief note (optional)..."
                      className="w-full px-2.5 py-1.5 text-xs bg-surface border border-outline-variant rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
                    />

                    <button
                      type="button"
                      onClick={handleQuickSubmitReview}
                      disabled={isSubmittingReview}
                      className="w-full py-2 bg-teaching-emerald hover:bg-teaching-emerald/90 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">thumb_up</span>
                      <span>{isSubmittingReview ? 'Submitting...' : 'Submit 30-Sec Review'}</span>
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="space-y-2 pt-1">
              {/* Add notes from this session prompt */}
              {currentSession && !localStorage.getItem(`mindroot_prompted_notes_${currentSession.id}`) && (
                <div className="p-3 bg-primary-tint border border-primary/20 rounded-2xl flex items-center justify-between gap-2 text-left">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-primary text-base shrink-0">edit_note</span>
                    <span className="text-xs font-bold text-primary-text truncate">Add notes from this session</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        localStorage.setItem(`mindroot_prompted_notes_${currentSession.id}`, 'true');
                        setIsSessionNotesPanelOpen(true);
                      }}
                      className="px-2.5 py-1 bg-primary text-on-primary rounded-lg text-xs font-bold hover:bg-primary-hover shadow-xs cursor-pointer"
                    >
                      Write Notes
                    </button>
                    <button
                      onClick={() => {
                        localStorage.setItem(`mindroot_prompted_notes_${currentSession.id}`, 'true');
                        // Force re-render
                        setCurrentSession({ ...currentSession });
                      }}
                      className="p-1 text-muted hover:text-text rounded-md cursor-pointer"
                      title="Dismiss"
                      aria-label="Dismiss note prompt"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate('/schedule')}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-extrabold transition-all shadow-elevation-1 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">calendar_month</span>
                Return to Schedule
              </button>

              {!isTeacher && (
                <button
                  onClick={() => navigate('/feedback')}
                  className="w-full py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-extrabold transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[17px]">star</span>
                  Leave Session Feedback
                </button>
              )}

              <button
                onClick={() => navigate(isTeacher ? '/teacher' : '/dashboard')}
                className="w-full py-2 bg-transparent hover:bg-surface-container text-on-surface-variant rounded-xl text-xs font-bold transition-all"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remote Audio Outputs for All Connected Classmates/Teacher */}
      <div className="hidden" aria-hidden="true">
        {remoteParticipants.map(p => (
          <RemoteAudioElement
            key={`remote-audio-${p.id}`}
            stream={p.stream}
            onUnlockAudio={unlockAudio}
          />
        ))}
      </div>

      {/* Post-Lecture UPI Payment Modal */}
      <UpiPaymentModal
        isOpen={isUpiModalOpen}
        onClose={() => {
          setIsUpiModalOpen(false);
          navigate('/schedule');
        }}
        session={currentSession ? {
          id: currentSession.id,
          title: currentSession.title || 'Cohort Mentoring Lecture',
          amount: currentSession.pricePerStudent || currentSession.amount || 349,
          teacherId: currentSession.teacherId,
          teacherName: currentSession.teacher?.name || 'Mentor',
          teacherAvatar: currentSession.teacher?.avatar,
          teacherUpiId: currentSession.teacher?.upiId
        } : null}
        onSuccess={() => {
          setIsUpiModalOpen(false);
          if (currentSession) {
            currentSession.paymentStatus = 'paid';
          }
          navigate('/schedule');
        }}
      />

      {/* Session Notes Panel */}
      {currentSession && (
        <SessionNotesPanel
          isOpen={isSessionNotesPanelOpen}
          onClose={() => setIsSessionNotesPanelOpen(false)}
          session={currentSession}
          currentUserId={currentUser?.id}
        />
      )}
    </div>
  );
}

// Subcomponent: Workspace Content (Whiteboard, Notes, Code Editor)
function WorkspaceContent({
  workspace,
  chooseWorkspace,
  isFullscreen,
  drawColor,
  setDrawColor,
  drawWidth,
  setDrawWidth,
  drawingTool,
  setDrawingTool,
  syncWorkspaceWithPeer,
  downloadWhiteboard,
  clearBoard,
  canvasRef,
  beginDraw,
  continueDraw,
  endDraw,
  notes,
  setNotes,
  emitRoomEvent,
  code,
  setCode,
  selectedCodeLang,
  setSelectedCodeLang,
  codeOutput,
  onClearCodeOutput,
  isRunningCode,
  copiedCode,
  handleCopyCode,
  sharing,
  isPeerScreenSharing,
  sharerName,
  displayStream,
  remoteStream,
  onUnlockAudio
}: {
  workspace: Workspace;
  chooseWorkspace: (w: Workspace) => void;
  isFullscreen: boolean;
  drawColor: string;
  setDrawColor: (c: string) => void;
  drawWidth: number;
  setDrawWidth: (w: number) => void;
  drawingTool: DrawingTool;
  setDrawingTool: (t: DrawingTool) => void;
  syncWorkspaceWithPeer: () => void;
  downloadWhiteboard: () => void;
  clearBoard: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  beginDraw: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  continueDraw: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  endDraw: () => void;
  notes: string;
  setNotes: (n: string) => void;
  emitRoomEvent: (e: RoomEvent) => void;
  code: string;
  setCode: (c: string) => void;
  selectedCodeLang: string;
  setSelectedCodeLang: (l: string) => void;
  codeOutput: string | null;
  onClearCodeOutput: () => void;
  isRunningCode: boolean;
  copiedCode: boolean;
  handleCopyCode: () => void;
  sharing?: boolean;
  isPeerScreenSharing?: boolean;
  sharerName?: string;
  displayStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  onUnlockAudio?: () => void;
}) {
  return (
    <div className={clsx("flex flex-col h-full w-full min-h-0 overflow-hidden", isFullscreen ? "bg-surface" : "flex-1 rounded-2xl border border-border bg-surface shadow-xs")}>
      {/* Workspace Subheader Navigation */}
      <nav className="flex items-center justify-between gap-2 border-b border-border bg-surface-2 p-1.5 overflow-x-auto text-text">
        <div className="flex items-center gap-1.5">
          {toolTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => chooseWorkspace(tab.id)}
              className={clsx(
                'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                workspace === tab.id
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-muted hover:bg-surface hover:text-text'
              )}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}

          {(sharing || isPeerScreenSharing) && (
            <button
              onClick={() => chooseWorkspace('screenshare')}
              className={clsx(
                'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 border focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                workspace === 'screenshare'
                  ? 'bg-primary text-on-primary border-primary shadow-xs animate-pulse'
                  : 'bg-primary-tint text-primary-text border-primary/20 hover:bg-primary-tint/80'
              )}
            >
              <span className="material-symbols-outlined text-[16px]">screen_share</span>
              <span>📺 Live Shared Screen View</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Workspace Body */}
      <div className="relative min-h-0 flex-1 bg-surface-2/20 overflow-hidden flex flex-col">
        {/* 1. Whiteboard Canvas */}
        {workspace === 'whiteboard' && (
          <WhiteboardCanvas
            canvasRef={canvasRef}
            drawingTool={drawingTool}
            setDrawingTool={setDrawingTool}
            drawColor={drawColor}
            setDrawColor={setDrawColor}
            drawWidth={drawWidth}
            setDrawWidth={setDrawWidth}
            clearBoard={clearBoard}
            syncWorkspaceWithPeer={syncWorkspaceWithPeer}
            downloadWhiteboard={downloadWhiteboard}
            beginDraw={beginDraw}
            continueDraw={continueDraw}
            endDraw={endDraw}
          />
        )}

        {/* 2. Shared Notes & Plan */}
        {workspace === 'notes' && (
          <NotesEditor
            notes={notes}
            setNotes={setNotes}
            emitRoomEvent={emitRoomEvent}
          />
        )}

        {/* 3. Interactive Code Pad */}
        {workspace === 'code' && (
          <CodeRunnerPad
            code={code}
            setCode={setCode}
            selectedCodeLang={selectedCodeLang}
            setSelectedCodeLang={setSelectedCodeLang}
            codeOutput={codeOutput}
            onClearCodeOutput={onClearCodeOutput}
            isRunningCode={isRunningCode}
            copiedCode={copiedCode}
            handleCopyCode={handleCopyCode}
            emitRoomEvent={emitRoomEvent}
          />
        )}

        {/* 4. Live Shared Screen Viewport */}
        {workspace === 'screenshare' && (
          <div className="relative h-full w-full bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2.5 px-3.5 py-1.5 bg-slate-900/90 border border-white/10 rounded-xl text-white text-xs font-bold backdrop-blur-md shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{sharing ? 'You are sharing your screen' : `${sharerName || 'Teacher'} is sharing screen`}</span>
              <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] rounded uppercase font-extrabold">HD 1080p Stream</span>
            </div>

            <StreamVideo
              stream={sharing ? (displayStream || null) : (remoteStream || null)}
              muted={sharing}
              isRemote={!sharing}
              onUnlockAudio={onUnlockAudio}
              className="h-full w-full bg-slate-950 object-contain"
            />
          </div>
        )}
      </div>
    </div>
  );
}



function Control({ active, icon, label, off, highlighted, onClick }: { active: boolean; icon: string; label: string; off?: boolean; highlighted?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={clsx(
        'grid h-10 w-10 place-items-center rounded-full border transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 active:translate-y-0 active:scale-95 shadow-elevation-1',
        off
          ? 'border-alert-rose/40 bg-alert-rose text-on-alert-rose shadow-elevation-1'
          : highlighted
          ? 'border-learning-amber bg-learning-amber-container text-on-learning-amber-container shadow-elevation-1 animate-pulse font-bold'
          : active
          ? 'border-primary bg-primary-container text-on-primary-container hover:bg-primary-container/80'
          : 'border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
      )}
    >
      <span className="material-symbols-outlined text-[19px]">{icon}</span>
    </button>
  );
}
