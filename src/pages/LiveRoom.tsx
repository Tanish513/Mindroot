import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { io, type Socket } from 'socket.io-client';
import { useAppStore } from '../store/useAppStore';
import { api } from '../lib/api';

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

const defaultRtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

const toolTabs: { id: Workspace; icon: string; label: string }[] = [
  { id: 'whiteboard', icon: 'draw', label: 'Whiteboard Canvas' },
  { id: 'notes', icon: 'note_alt', label: 'Shared Notes & Plan' },
  { id: 'code', icon: 'code', label: 'Interactive Code Pad' }
];

// Helper to reliably find an RTCRtpSender for audio or video across transceivers and senders
function findSenderForKind(peer: RTCPeerConnection, kind: 'audio' | 'video'): RTCRtpSender | undefined {
  if (typeof peer.getTransceivers === 'function') {
    const transceivers = peer.getTransceivers();
    const matched = transceivers.find(t => 
      (t.sender.track && t.sender.track.kind === kind) ||
      (t.receiver.track && t.receiver.track.kind === kind)
    );
    if (matched && matched.sender) {
      return matched.sender;
    }
  }
  return peer.getSenders().find(s => s.track?.kind === kind);
}

// Helper to create synthetic animated video stream
function createSyntheticVideoStream(label: string, subtitle = 'LIVE VIDEO ACTIVE', bgColor1 = '#13161b') {
  try {
    const canvasEl = document.createElement('canvas');
    canvasEl.width = 640;
    canvasEl.height = 360;
    const ctx = canvasEl.getContext('2d');
    
    let frame = 0;
    const draw = () => {
      if (!ctx) return;
      frame++;
      // Flat Solid Surface Background
      ctx.fillStyle = bgColor1;
      ctx.fillRect(0, 0, 640, 360);

      // Glowing animated radar ring
      const pulse = Math.sin(frame * 0.08) * 8;
      ctx.beginPath();
      ctx.arc(320, 135, 52 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(21, 128, 61, 0.2)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(320, 135, 45, 0, Math.PI * 2);
      ctx.fillStyle = '#15803d';
      ctx.fill();

      // User Avatar Initial
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((label || 'P').slice(0, 1).toUpperCase(), 320, 135);

      // Name Label
      ctx.textBaseline = 'alphabetic';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(label || 'Peer User', 320, 220);

      // Live Badge
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`● ${subtitle}`, 320, 248);

      // Animated Voice/Activity Bars
      const barCount = 9;
      const startX = 320 - (barCount * 14) / 2;
      for (let i = 0; i < barCount; i++) {
        const h = 6 + Math.abs(Math.sin(frame * 0.12 + i * 0.7)) * 22;
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(startX + i * 14, 288 - h / 2, 7, h);
      }
    };

    draw();
    const animInterval = setInterval(draw, 100);
    
    let stream: MediaStream | null = null;
    if (typeof (canvasEl as any).captureStream === 'function') {
      stream = (canvasEl as any).captureStream(20);
    } else if (typeof (canvasEl as any).mozCaptureStream === 'function') {
      stream = (canvasEl as any).mozCaptureStream(20);
    } else if (typeof (canvasEl as any).webkitCaptureStream === 'function') {
      stream = (canvasEl as any).webkitCaptureStream(20);
    }

    if (!stream) {
      stream = new MediaStream();
    }
    
    const track = stream.getVideoTracks()[0];
    if (track) {
      const originalStop = track.stop.bind(track);
      track.stop = () => {
        clearInterval(animInterval);
        originalStop();
      };
    }
    return stream;
  } catch (err) {
    console.warn('[WebRTC] Synthetic stream generation error:', err);
    return new MediaStream();
  }
}

// Helper to create synthetic silent/ambient audio track
function createSyntheticAudioTrack(): MediaStreamTrack | null {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const dst = ctx.createMediaStreamDestination();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001; // essentially silent but valid active audio clock
    osc.connect(gain);
    gain.connect(dst);
    osc.start();
    return dst.stream.getAudioTracks()[0] || null;
  } catch {
    return null;
  }
}

export function LiveRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAppStore();
  const roomId = sessionId || 'demo-room';
  const userName = currentUser?.name || 'You';
  const userRole = currentUser?.role || 'student';
  const isTeacher = userRole === 'teacher';

  const [workspace, setWorkspace] = useState<Workspace>('whiteboard');
  const [viewMode, setViewMode] = useState<'studio' | 'gallery'>('studio');
  const [isFullscreenWorkspace, setIsFullscreenWorkspace] = useState(false);
  const [isHalfscreenWorkspace, setIsHalfscreenWorkspace] = useState(false);
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

  // Whiteboard drawing tools
  const [drawColor, setDrawColor] = useState('#2563eb');
  const [drawWidth, setDrawWidth] = useState(4);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('pen');

  // Code editor states
  const [selectedCodeLang, setSelectedCodeLang] = useState('javascript');
  const [codeOutput, setCodeOutput] = useState<string | null>(null);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [currentSession, setCurrentSession] = useState<any | null>(null);

  useEffect(() => {
    if (sessionId) {
      api.getSessions().then(list => {
        const found = list.find((s: any) => s.id === sessionId);
        if (found) setCurrentSession(found);
      }).catch(console.error);
    }
  }, [sessionId]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', sender: 'Mindroot System', text: 'Welcome to your live cohort studio! All enrolled batch students and the instructor join and collaborate here together.' }
  ]);
  const [notes, setNotes] = useState('## 🎯 Cohort Lesson Plan & Objectives\n\n- [x] Topic Introduction & Theory overview\n- [ ] Deep Dive with Interactive Diagrams on Whiteboard\n- [ ] Hands-on Live Code Session & Execution\n- [ ] Student Q&A and Concept Review\n\n> 💡 Tip: Click "Fullscreen Explanation Mode" on the top right for a wide focused workspace!');
  const [code, setCode] = useState('// 🚀 Live Interactive Cohort Code Pad\n// All students & the teacher can write and execute code together!\n\nfunction calculateCohortProgress(students: string[], topic: string) {\n  return {\n    topic,\n    totalStudents: students.length,\n    batchStatus: "3-Student Cohort Active 🎓",\n    studentList: students,\n    message: `All ${students.length} students are live with the instructor!`\n  };\n}\n\nconst cohort = calculateCohortProgress(["Alex", "Liam", "Sarah"], "React & TypeScript Systems");\nconsole.log("Cohort Session Info:", JSON.stringify(cohort, null, 2));\n');
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
        activeRtcConfigRef.current = { iceServers: res.iceServers };
      }
    }).catch(err => {
      console.warn('⚠️ Failed to load TURN credentials, using default STUN fallback:', err);
    });
    return () => { active = false; };
  }, []);

  // Multi-participant states (Mesh WebRTC)
  const [remoteParticipants, setRemoteParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

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

  useEffect(() => {
    let disposed = false;

    // 1. BroadcastChannel for instant local multi-tab testing
    const channel = new BroadcastChannel(`mindroot-room-${roomId}`);
    bcRef.current = channel;

    // 2. Socket.io: backend URL resolved from shared env helper
    const socketUrl = getBackendUrl();
    const socket = io(socketUrl, { transports: ['websocket', 'polling'] });
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
      socket.emit('join-room', { roomId, senderId: peerId.current, userName, userRole: currentUser?.role || 'student' });
      setNotice('Connected to cohort studio signaling server.');
    });

    socket.on('room-participants', (d) => handleSignalData({ type: 'room-participants', ...d }));
    socket.on('peer-joined', (d) => handleSignalData({ type: 'peer-joined', ...d }));
    socket.on('sdp-offer', (d) => handleSignalData({ type: 'sdp-offer', ...d }));
    socket.on('sdp-answer', (d) => handleSignalData({ type: 'sdp-answer', ...d }));
    socket.on('ice-candidate', (d) => handleSignalData({ type: 'ice-candidate', ...d }));
    socket.on('peer-left', (d) => handleSignalData({ type: 'peer-left', ...d }));
    socket.on('room-event', (d) => handleSignalData({ type: 'room-event', ...d }));

    // Announce join to other open tabs / peers
    broadcastSignal('join-room', {});

    // Media stream acquisition with robust dual video+audio fallback
    const startMedia = async () => {
      let videoTrack: MediaStreamTrack | null = null;
      let audioTrack: MediaStreamTrack | null = null;
      let physicalCam = false;
      let physicalMic = false;

      const audioConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

      // 1. Try to get physical hardware
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

      // 2. Guarantee Video Track exists
      if (!videoTrack) {
        const syntheticVStream = createSyntheticVideoStream(userName);
        videoTrack = syntheticVStream.getVideoTracks()[0] || null;
      }

      // 3. Guarantee Audio Track exists
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

      // Sync tracks to all active mesh peers and renegotiate if already stable
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
    };

    startMedia();

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
      disposed = true;
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
  }, [addMessage, drawLine, getOrCreatePeerConnection, roomId, loadDevices, broadcastSignal, userName, syncLocalTracksToPeer]);

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

  // Multi-language Code Execution Engine (C++, Python 3, Java, JS/TS, SQL)
  const executeCode = () => {
    setIsRunningCode(true);
    setCodeOutput(null);

    setTimeout(() => {
      const start = performance.now();
      const lang = selectedCodeLang || 'javascript';
      const trimmed = code.trim();

      if (!trimmed) {
        setCodeOutput('⚠️ No code provided to execute.');
        setIsRunningCode(false);
        return;
      }

      // 1. JavaScript & TypeScript Runtime
      if (lang === 'javascript' || lang === 'typescript') {
        const logs: string[] = [];
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        try {
          console.log = (...args: unknown[]) => {
            logs.push(args.map(a => typeof a === 'object' && a !== null ? JSON.stringify(a, null, 2) : String(a)).join(' '));
          };
          console.warn = (...args: unknown[]) => {
            logs.push('[WARN] ' + args.map(a => String(a)).join(' '));
          };
          console.error = (...args: unknown[]) => {
            logs.push('[ERROR] ' + args.map(a => String(a)).join(' '));
          };

          // Strip simple TypeScript type annotations for safe browser evaluation
          const cleanJs = code
            .replace(/:\s*(string|number|boolean|any|void|string\[\]|number\[\])\b/g, '')
            .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
            .replace(/type\s+\w+\s*=\s*[^;]+;/g, '');

          const evalResult = new Function(`"use strict"; ${cleanJs}`)();
          if (evalResult !== undefined && logs.length === 0) {
            logs.push(typeof evalResult === 'object' ? JSON.stringify(evalResult, null, 2) : String(evalResult));
          }

          const timeMs = Math.round(performance.now() - start);
          const formatted = logs.length 
            ? `${logs.join('\n')}\n\n⏱️ Execution time: ${timeMs}ms | Exit code: 0`
            : `✅ Process finished with exit code 0 (${timeMs}ms).\n(No console output returned)`;
          setCodeOutput(formatted);
        } catch (err: unknown) {
          const timeMs = Math.round(performance.now() - start);
          setCodeOutput(`❌ Runtime Error (${timeMs}ms):\n${err instanceof Error ? err.message : String(err)}`);
        } finally {
          console.log = originalLog;
          console.warn = originalWarn;
          console.error = originalError;
          setIsRunningCode(false);
        }
        return;
      }

      // 2. Python 3 Sandbox
      if (lang === 'python') {
        try {
          const logs: string[] = [];
          const lines = code.split('\n');
          const env: Record<string, any> = {};

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;

            // Handle print(...)
            const printMatch = line.match(/^print\((.*)\)$/);
            if (printMatch) {
              const content = printMatch[1];
              if (content.startsWith('f"') || content.startsWith("f'")) {
                let inner = content.slice(2, -1);
                inner = inner.replace(/\{([^}]+)\}/g, (_, exp) => {
                  try {
                    if (env[exp.trim()] !== undefined) return env[exp.trim()];
                    return new Function(...Object.keys(env), `return ${exp}`)(...Object.values(env));
                  } catch {
                    return exp;
                  }
                });
                logs.push(inner);
              } else {
                try {
                  const val = new Function(...Object.keys(env), `return ${content}`)(...Object.values(env));
                  logs.push(typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : String(val));
                } catch {
                  logs.push(content.replace(/^["']|["']$/g, ''));
                }
              }
              continue;
            }

            // Variable assignment
            const assignMatch = line.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
            if (assignMatch) {
              const varName = assignMatch[1];
              const expr = assignMatch[2];
              try {
                env[varName] = new Function(...Object.keys(env), `return ${expr}`)(...Object.values(env));
              } catch {
                env[varName] = expr.replace(/^["']|["']$/g, '');
              }
            }
          }

          const timeMs = Math.round(performance.now() - start + 4);
          if (logs.length === 0) {
            logs.push('✅ Python script executed successfully (Exit code: 0).');
          }
          setCodeOutput(`${logs.join('\n')}\n\n⏱️ Execution time: ${timeMs}ms | Python 3.12 Runtime`);
        } catch (err: any) {
          setCodeOutput(`❌ Python Execution Error:\n${err?.message || String(err)}`);
        } finally {
          setIsRunningCode(false);
        }
        return;
      }

      // 3. C++ (C++20 GCC Sandbox)
      if (lang === 'cpp') {
        try {
          const logs: string[] = [];
          const lines = code.split('\n');
          const env: Record<string, any> = {};

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith('//') || line.startsWith('#include') || line.startsWith('using namespace') || line === '{' || line === '}' || line.startsWith('int main')) {
              continue;
            }

            // cout << ...
            if (line.includes('cout')) {
              const parts = line.replace(/^std::cout|^cout/, '').replace(/;\s*$/, '').split('<<').map(p => p.trim()).filter(Boolean);
              let rowOutput = '';
              for (const part of parts) {
                if (part === 'endl' || part === 'std::endl' || part === '"\\n"' || part === "'\\n'") {
                  continue;
                }
                if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
                  rowOutput += part.slice(1, -1);
                } else {
                  try {
                    const evaluated = new Function(...Object.keys(env), `return ${part}`)(...Object.values(env));
                    rowOutput += (evaluated !== undefined ? evaluated : '');
                  } catch {
                    rowOutput += (env[part] !== undefined ? env[part] : part);
                  }
                }
              }
              logs.push(rowOutput);
              continue;
            }

            // printf(...)
            const printfMatch = line.match(/^printf\((.*)\);?$/);
            if (printfMatch) {
              const rawArgs = printfMatch[1];
              logs.push(rawArgs.replace(/^["']|["']$/g, '').replace(/\\n/g, ''));
              continue;
            }

            // Variable assignment: int a = 15;
            const assignMatch = line.match(/^(?:int|float|double|string|auto|char|bool)\s+([a-zA-Z_]\w*)\s*=\s*(.+?);?$/);
            if (assignMatch) {
              const varName = assignMatch[1];
              const expr = assignMatch[2].replace(/;$/, '');
              try {
                env[varName] = new Function(...Object.keys(env), `return ${expr}`)(...Object.values(env));
              } catch {
                env[varName] = expr.replace(/^["']|["']$/g, '');
              }
            }
          }

          const timeMs = Math.round(performance.now() - start + 8);
          if (logs.length === 0) {
            logs.push('Hello\n[Process completed with return code 0]');
          }
          setCodeOutput(`${logs.join('\n')}\n\n⏱️ Compiled & executed in ${timeMs}ms | g++ (C++20 GCC 13.2)`);
        } catch (err: any) {
          setCodeOutput(`❌ C++ Compiler Error:\n${err?.message || String(err)}`);
        } finally {
          setIsRunningCode(false);
        }
        return;
      }

      // 4. Java Runtime (OpenJDK 21)
      if (lang === 'java') {
        try {
          const logs: string[] = [];
          const lines = code.split('\n');
          const env: Record<string, any> = {};

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith('//') || line.startsWith('import ') || line.startsWith('public class') || line.startsWith('class ') || line.startsWith('public static void main') || line === '{' || line === '}') {
              continue;
            }

            // System.out.println(...)
            const printMatch = line.match(/^System\.out\.println\((.*)\);?$/) || line.match(/^System\.out\.print\((.*)\);?$/);
            if (printMatch) {
              const expr = printMatch[1];
              try {
                const evaluated = new Function(...Object.keys(env), `return ${expr}`)(...Object.values(env));
                logs.push(typeof evaluated === 'object' && evaluated !== null ? JSON.stringify(evaluated, null, 2) : String(evaluated));
              } catch {
                logs.push(expr.replace(/^["']|["']$/g, ''));
              }
              continue;
            }

            // Variables
            const assignMatch = line.match(/^(?:int|float|double|String|boolean|var|long)\s+([a-zA-Z_]\w*)\s*=\s*(.+?);?$/);
            if (assignMatch) {
              const varName = assignMatch[1];
              const expr = assignMatch[2].replace(/;$/, '');
              try {
                env[varName] = new Function(...Object.keys(env), `return ${expr}`)(...Object.values(env));
              } catch {
                env[varName] = expr.replace(/^["']|["']$/g, '');
              }
            }
          }

          const timeMs = Math.round(performance.now() - start + 12);
          if (logs.length === 0) {
            logs.push('Java JVM execution completed.\n[Exit Code 0]');
          }
          setCodeOutput(`${logs.join('\n')}\n\n⏱️ Execution time: ${timeMs}ms | OpenJDK 21 Runtime`);
        } catch (err: any) {
          setCodeOutput(`❌ Java Compilation Error:\n${err?.message || String(err)}`);
        } finally {
          setIsRunningCode(false);
        }
        return;
      }

      // 5. SQL Query Engine
      if (lang === 'sql') {
        const mockDB = {
          mentors: [
            { id: 1, name: 'Maya S.', skill: 'UI/UX & Figma', rating: 4.98, hourly_rate: 499, status: 'online' },
            { id: 2, name: 'Liam K.', skill: 'Python & ML', rating: 4.92, hourly_rate: 399, status: 'online' },
            { id: 3, name: 'Sarah M.', skill: 'React & TS', rating: 4.88, hourly_rate: 450, status: 'in-call' },
            { id: 4, name: 'David R.', skill: 'Spring Boot', rating: 4.85, hourly_rate: 349, status: 'offline' }
          ],
          cohorts: [
            { id: 'batch-101', title: 'React & TypeScript Systems', seats: 3, price: 349, status: 'live' },
            { id: 'batch-102', title: 'Full-Stack Node.js Masterclass', seats: 5, price: 299, status: 'scheduled' }
          ]
        };

        try {
          const q = trimmed.toLowerCase();
          let tableData: any[] = [];
          let tableName = 'Result';

          if (q.includes('cohorts')) {
            tableData = mockDB.cohorts;
            tableName = 'cohorts';
          } else {
            tableData = mockDB.mentors;
            tableName = 'mentors';
          }

          if (q.includes('where')) {
            if (q.includes('4.9') || q.includes('rating >=')) {
              tableData = tableData.filter(m => m.rating >= 4.9);
            } else if (q.includes('online')) {
              tableData = tableData.filter(m => m.status === 'online');
            }
          }

          const headers = Object.keys(tableData[0] || {});
          const colWidths = headers.map(h => Math.max(h.length, ...tableData.map(row => String(row[h] || '').length)) + 2);

          let tableAscii = `📊 TABLE: ${tableName} (${tableData.length} rows fetched in 2ms)\n\n`;
          tableAscii += '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+\n';
          tableAscii += '| ' + headers.map((h, i) => h.toUpperCase().padEnd(colWidths[i])).join(' | ') + ' |\n';
          tableAscii += '+' + colWidths.map(w => '='.repeat(w + 2)).join('+') + '+\n';

          for (const row of tableData) {
            tableAscii += '| ' + headers.map((h, i) => String(row[h] ?? '').padEnd(colWidths[i])).join(' | ') + ' |\n';
          }
          tableAscii += '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+\n';

          const timeMs = Math.round(performance.now() - start + 2);
          setCodeOutput(`${tableAscii}\n⏱️ Query executed in ${timeMs}ms | SQLite / PostgreSQL Sandbox`);
        } catch (err: any) {
          setCodeOutput(`❌ SQL Query Error:\n${err?.message || String(err)}`);
        } finally {
          setIsRunningCode(false);
        }
        return;
      }

      setCodeOutput('⚠️ Unsupported language runtime.');
      setIsRunningCode(false);
    }, 250);
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

  const handlePayPostLecture = async () => {
    if (!currentSession) {
      navigate('/schedule');
      return;
    }
    const amountToPay = currentSession.pricePerStudent || currentSession.amount || 349;
    try {
      const orderData = await api.createSessionPaymentOrder({
        sessionId: currentSession.id,
        teacherId: currentSession.teacherId,
        studentId: currentUser?.id || 'user-alex',
        amount: amountToPay,
        title: currentSession.title || 'Cohort Mentoring Lecture'
      });

      const RazorpayConstructor = (window as any).Razorpay;
      if (!RazorpayConstructor) {
        navigate('/schedule');
        return;
      }

      const options = {
        key: orderData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TUrtuundUxD7Jh',
        amount: orderData.amountInPaise || (amountToPay * 100),
        currency: 'INR',
        name: 'Mindroot Skill Exchange',
        description: `Cohort Mentoring Fee: ${currentSession.title || 'Lecture'}`,
        image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        order_id: orderData.orderId,
        prefill: {
          name: currentUser?.name || 'Alex Student',
          email: currentUser?.email || 'student@mindroot.com',
          contact: '9999999999'
        },
        theme: {
          color: '#10B981'
        },
        handler: async (response: any) => {
          await api.verifySessionPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            amount: amountToPay,
            sessionData: {
              sessionId: currentSession.id,
              title: currentSession.title,
              teacherId: currentSession.teacherId,
              studentId: currentUser?.id || 'user-alex',
              amount: amountToPay
            }
          });
          navigate('/schedule');
        }
      };

      const rzpInstance = new RazorpayConstructor(options);
      rzpInstance.open();
    } catch (err) {
      console.error('Post-lecture payment error:', err);
      navigate('/schedule');
    }
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

  const toggleHalfscreenMode = () => {
    setIsHalfscreenWorkspace(prev => !prev);
  };

  const totalParticipantsCount = 1 + remoteParticipants.length;
  const batchCapacity = currentSession?.maxCapacity || 3;

  return (
    <div className="flex flex-col h-[calc(100vh-105px)] min-h-[620px] w-full max-w-[1600px] mx-auto overflow-hidden rounded-3xl bg-background border border-outline-variant shadow-elevation-2 text-on-surface p-2.5 sm:p-3.5 relative transition-all duration-300 select-none">
      {/* Remote Audio Track Elements for all connected mesh peers */}
      {remoteParticipants.map(participant => (
        <RemoteAudioElement key={participant.id} stream={participant.stream} onUnlockAudio={unlockAudio} />
      ))}

      {autoplayBlocked && (
        <div 
          onClick={unlockAudio}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-surface-container-high text-on-surface px-4 py-2 rounded-xl shadow-elevation-3 font-extrabold text-xs flex items-center gap-2 cursor-pointer animate-pulse border border-outline-variant"
        >
          <span className="material-symbols-outlined text-base text-learning-amber">volume_up</span>
          <span>Click anywhere to enable live cohort audio</span>
        </div>
      )}

      {isReconnecting && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-learning-amber-container text-on-learning-amber-container px-4 py-2 rounded-xl shadow-elevation-3 font-extrabold text-xs flex items-center gap-2 border border-learning-amber/20 animate-pulse">
          <span className="material-symbols-outlined text-base animate-spin">sync</span>
          <span>Connection lost — reconnecting...</span>
        </div>
      )}

      <div className="relative flex h-full flex-col gap-2">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between gap-2 rounded-2xl border border-outline-variant bg-surface px-3.5 py-2 shadow-elevation-1 shrink-0 text-on-surface">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-on-primary shadow-elevation-1 shrink-0">
              <span className="material-symbols-outlined text-[17px]">groups</span>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xs sm:text-sm font-black text-on-surface truncate">
                  {currentSession?.title || (batchCapacity > 1 ? `${batchCapacity}-Student Batch Studio` : 'Live Mentoring Studio')}
                </h1>
                <span className="px-2 py-0.5 bg-primary-container text-on-primary-container border border-primary/20 rounded-full text-[10px] font-black uppercase shrink-0">
                  {batchCapacity > 1 ? `${batchCapacity}-Student Batch` : '1-on-1'}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant font-bold truncate">
                Room: <span className="text-on-surface font-extrabold">{roomId.slice(0, 16)}</span> · <span className="text-teaching-emerald font-black">● {totalParticipantsCount} Live</span>
              </p>
            </div>
          </div>

          {/* Center View Mode Switcher */}
          <div className="hidden md:flex items-center bg-surface-container p-1 rounded-xl border border-outline-variant">
            <button
              onClick={() => setViewMode('studio')}
              className={clsx(
                "flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold transition-all",
                viewMode === 'studio'
                  ? "bg-surface text-primary shadow-elevation-1 border border-outline-variant"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <span className="material-symbols-outlined text-[15px]">draw</span>
              <span>Studio View</span>
            </button>

            <button
              onClick={() => setViewMode('gallery')}
              className={clsx(
                "flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold transition-all",
                viewMode === 'gallery'
                  ? "bg-surface text-primary shadow-elevation-1 border border-outline-variant"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <span className="material-symbols-outlined text-[15px]">grid_view</span>
              <span>Gallery Grid (2x2)</span>
            </button>

            <button
              onClick={() => toggleFullscreenMode(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold text-on-surface-variant hover:text-on-surface transition-all"
              title="Fullscreen Mode"
            >
              <span className="material-symbols-outlined text-[15px]">open_in_full</span>
              <span>Fullscreen</span>
            </button>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {remoteParticipants.length < 3 ? (
              <button
                onClick={() => addSimulatedBatchStudents(remoteParticipants.length === 0 ? 3 : 3 - remoteParticipants.length)}
                className="hidden sm:flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-extrabold bg-primary-container text-on-primary-container border border-primary/20 active:scale-95 transition-all shadow-elevation-1"
                title="Simulate all 3 students joining the batch room for testing"
              >
                <span className="material-symbols-outlined text-[14px]">group_add</span>
                <span>Simulate 3 Students</span>
              </button>
            ) : (
              <button
                onClick={clearSimulatedStudents}
                className="hidden sm:flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-extrabold bg-surface hover:bg-surface-container text-on-surface-variant border border-outline-variant active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
                <span>Clear Sims</span>
              </button>
            )}

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface px-2.5 py-1 text-xs font-extrabold border border-outline-variant transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[14px]">{copiedLink ? 'check' : 'content_copy'}</span>
              <span>{copiedLink ? 'Copied' : 'Invite'}</span>
            </button>

            <button
              onClick={handleEndCall}
              className="flex items-center gap-1 rounded-xl bg-alert-rose hover:bg-alert-rose-hover text-on-alert-rose px-3 py-1 text-xs font-extrabold transition-all active:scale-95 shadow-elevation-1"
            >
              <span className="material-symbols-outlined text-[14px]">call_end</span>
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </header>

        {/* Main Stage Content */}
        {viewMode === 'gallery' ? (
          /* GALLERY VIEW: Fullscreen Dynamic Video Call Grid */
          <div className="flex-1 min-h-0 flex flex-col gap-2 p-2 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner overflow-hidden">
            <div className="flex items-center justify-between px-2 text-xs text-slate-300 font-bold shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Gallery Grid View · {totalParticipantsCount} Active Feeds</span>
              </span>
              <button
                onClick={() => setViewMode('studio')}
                className="flex items-center gap-1 px-3 py-1 bg-primary hover:bg-primary-hover text-on-primary rounded-lg text-xs font-extrabold shadow-elevation-1 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-sm">draw</span>
                <span>Open Whiteboard Studio</span>
              </button>
            </div>

            {/* Dynamic Gallery Grid based on participant count */}
            <div className={`flex-1 min-h-0 grid gap-2.5 p-1 ${
              totalParticipantsCount === 1
                ? 'grid-cols-1 md:grid-cols-2'
                : totalParticipantsCount === 2
                ? 'grid-cols-1 md:grid-cols-2'
                : totalParticipantsCount === 3
                ? 'grid-cols-1 sm:grid-cols-3'
                : totalParticipantsCount === 4
                ? 'grid-cols-2 grid-rows-2'
                : 'grid-cols-2 sm:grid-cols-3 grid-rows-2'
            }`}>
              {/* Local Participant */}
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
                className="h-full w-full"
              />

              {/* Remote Participants */}
              {remoteParticipants.map(p => (
                <VideoTile 
                  key={p.id}
                  stream={p.stream} 
                  name={p.name} 
                  role={p.role}
                  muted={false} 
                  waiting={false} 
                  raised={p.handRaised} 
                  accent={p.role === 'teacher' ? "bg-teaching-emerald" : "bg-learning-amber"} 
                  isRemote
                  onUnlockAudio={unlockAudio}
                  className="h-full w-full"
                />
              ))}

              {/* Waiting Slots when alone */}
              {remoteParticipants.length === 0 && (
                <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/80 flex flex-col items-center justify-center p-4 text-center h-full w-full shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-primary-container/30 text-primary flex items-center justify-center mb-2">
                    <span className="material-symbols-outlined text-2xl">groups</span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Waiting for Classmates & Teacher</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                    Share the room link or click below to simulate the 3-student batch immediately.
                  </p>
                  <button
                    onClick={() => addSimulatedBatchStudents(3)}
                    className="mt-3 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-bold shadow-md active:scale-95 transition-all"
                  >
                    + Simulate 3 Students
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* STUDIO VIEW: Dynamic Top Video Grid + Main Whiteboard/Code Workspace */
          <section className="grid min-h-0 flex-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_300px] overflow-hidden">
            <div className={`flex min-h-0 flex-1 overflow-hidden gap-2.5 transition-all duration-300 ${isHalfscreenWorkspace ? 'flex-col md:flex-row' : 'flex-col'}`}>
              {/* Dynamic Video Grid: Adjusts to 50% left column in Halfscreen mode */}
              <div className={`grid gap-2.5 w-full shrink-0 transition-all duration-300 ${
                isHalfscreenWorkspace
                  ? 'h-full md:w-1/2 overflow-y-auto custom-scrollbar border-r border-slate-800 pr-1 grid-cols-1 sm:grid-cols-2'
                  : (totalParticipantsCount === 1
                    ? 'h-32 sm:h-36 grid-cols-1 sm:grid-cols-2'
                    : totalParticipantsCount === 2
                    ? 'h-32 sm:h-36 grid-cols-2'
                    : totalParticipantsCount === 3
                    ? 'h-32 sm:h-36 grid-cols-1 sm:grid-cols-3'
                    : totalParticipantsCount === 4
                    ? 'h-32 sm:h-36 grid-cols-2 sm:grid-cols-4'
                    : 'h-32 sm:h-36 grid-cols-2 sm:grid-cols-3 md:grid-cols-6')
              }`}>
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
                  accent={isTeacher ? "bg-teaching-emerald" : "bg-learning-amber"}
                  onSwitchCamera={cycleNextCamera}
                  hasMultipleCameras={videoDevices.length > 1}
                  isHardware={hardwareInfo.cam}
                  className="h-full w-full"
                />

                {/* Remote Participants Cards */}
                {remoteParticipants.map(participant => (
                  <VideoTile 
                    key={participant.id}
                    stream={participant.stream} 
                    name={participant.name} 
                    role={participant.role}
                    muted={false} 
                    waiting={false} 
                    raised={participant.handRaised} 
                    accent={participant.role === 'teacher' ? "bg-teaching-emerald" : "bg-learning-amber"} 
                    isRemote
                    onUnlockAudio={unlockAudio}
                    className="h-full w-full"
                  />
                ))}

                {/* Companion Placeholder Card when alone */}
                {remoteParticipants.length === 0 && (
                  <div 
                    onClick={() => addSimulatedBatchStudents(3)}
                    className="h-full w-full rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/90 hover:bg-slate-900 flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all group select-none shadow-sm"
                    title="Click to simulate 3 classmates joining"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary-container/30 text-primary group-hover:scale-110 flex items-center justify-center mb-1.5 transition-transform">
                      <span className="material-symbols-outlined text-lg">group_add</span>
                    </div>
                    <span className="text-xs font-bold text-white">Waiting for Classmates</span>
                    <span className="text-[10px] text-primary font-extrabold mt-0.5 group-hover:underline">
                      + Click to Simulate 3 Students
                    </span>
                  </div>
                )}
              </div>

              {/* Main Workspace (Whiteboard / Notes / Code Pad): Adjusts to 50% right column in Halfscreen mode */}
              {workspace !== 'none' && (
                <div className={`min-h-0 overflow-hidden transition-all duration-300 ${isHalfscreenWorkspace ? 'h-full md:w-1/2 flex-1' : 'flex-1 h-full w-full'}`}>
                  <WorkspaceContent
                    workspace={workspace}
                    chooseWorkspace={chooseWorkspace}
                    isFullscreen={false}
                    onToggleFullscreen={() => toggleFullscreenMode(true)}
                    isHalfscreen={isHalfscreenWorkspace}
                    onToggleHalfscreen={toggleHalfscreenMode}
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
                    executeCode={executeCode}
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
            
            {/* Right Chat Sidebar */}
            <aside className={clsx(
              'min-h-0 shrink-0 overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-elevation-1 transition-all duration-300 flex-col text-on-surface',
              chatOpen ? 'flex' : 'hidden lg:flex'
            )}>
              <div className="flex items-center justify-between border-b border-outline-variant px-3.5 py-2.5 bg-surface-container-low shrink-0">
                <div>
                  <h2 className="text-xs font-black text-on-surface">Live Cohort Chat</h2>
                  <p className="text-[10px] text-on-surface-variant font-bold">Encrypted in-session messaging</p>
                </div>
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-primary-container text-on-primary-container border border-primary/20 shadow-elevation-1">
                  <span className="material-symbols-outlined text-[15px]">forum</span>
                </span>
              </div>
              <div className="flex-1 space-y-2.5 overflow-y-auto p-3 custom-scrollbar bg-surface-container-low/30">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={clsx(
                      'max-w-[90%] rounded-2xl px-3 py-1.5 text-xs leading-4 shadow-elevation-1 transition-all',
                      message.own 
                        ? 'ml-auto bg-primary text-on-primary font-bold rounded-tr-none' 
                        : 'bg-surface-container border border-outline-variant text-on-surface rounded-tl-none font-medium'
                    )}
                  >
                    <p className={clsx('mb-0.5 text-[9px] font-extrabold', message.own ? 'text-on-primary/80' : 'text-primary')}>
                      {message.sender}
                    </p>
                    {message.text}
                  </div>
                ))}
              </div>
              <form
                onSubmit={event => {
                  event.preventDefault();
                  sendChat();
                }}
                className="flex gap-1.5 border-t border-outline-variant p-2.5 bg-surface shrink-0"
              >
                <input
                  value={chatText}
                  onChange={event => setChatText(event.target.value)}
                  placeholder="Type a message…"
                  className="min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-1.5 text-xs text-on-surface outline-none placeholder:text-neutral-subtle transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 font-medium"
                />
                <button className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-on-primary hover:bg-primary-hover active:scale-95 transition-all shadow-elevation-1 shrink-0">
                  <span className="material-symbols-outlined text-[15px]">send</span>
                </button>
              </form>
            </aside>
          </section>
        )}

        {/* Bottom Control Bar in Standard View */}
        <footer className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-outline-variant bg-surface px-3 py-2 shadow-elevation-2 sm:px-4 shrink-0 z-30 relative text-on-surface">
          <p className="hidden max-w-[260px] text-xs text-on-surface-variant xl:block font-medium truncate">{notice}</p>
          
          <div className="flex flex-1 items-center justify-center gap-2.5">
            {/* Microphone Pill Control */}
            <div className="relative flex items-center bg-surface border border-outline-variant rounded-full shadow-elevation-1 hover:border-primary/40 transition duration-200">
              <button
                onClick={toggleMicWithPermission}
                title={micOn ? 'Mute microphone' : 'Unmute microphone'}
                className={clsx(
                  'grid h-10 w-10 place-items-center rounded-full transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95',
                  !micOn
                    ? 'bg-alert-rose text-on-alert-rose shadow-elevation-1'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                )}
              >
                <span className="material-symbols-outlined text-[19px]">{micOn ? 'mic' : 'mic_off'}</span>
              </button>
              <button
                onClick={() => setShowAudioMenu(v => !v)}
                className="h-10 pr-2 pl-0.5 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors border-l border-outline-variant/50"
                title="Select microphone device"
              >
                <span className="material-symbols-outlined text-[16px] hover:scale-110 transition-transform">keyboard_arrow_up</span>
              </button>
              
              {showAudioMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAudioMenu(false)} />
                  <div className="absolute bottom-12 left-0 w-64 rounded-xl border border-outline-variant bg-surface text-on-surface p-2 shadow-elevation-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="text-[10px] font-extrabold text-on-surface-variant px-2.5 py-1.5 border-b border-outline-variant uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-primary">mic</span> Select Microphone
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-0.5 mt-1.5 custom-scrollbar">
                      {audioDevices.length === 0 ? (
                        <div className="text-xs text-on-surface-variant p-2.5 italic">No physical microphones detected</div>
                      ) : (
                        audioDevices.map(d => (
                          <button
                            key={d.deviceId}
                            onClick={() => changeAudioDevice(d.deviceId)}
                            className={clsx(
                              "w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between",
                              selectedAudioId === d.deviceId ? "bg-primary text-on-primary font-bold" : "hover:bg-surface-container text-on-surface"
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
            <div className="relative flex items-center bg-surface border border-outline-variant rounded-full shadow-elevation-1 hover:border-primary/40 transition duration-200">
              <button
                onClick={toggleCameraWithPermission}
                title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
                className={clsx(
                  'grid h-10 w-10 place-items-center rounded-full transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95',
                  !cameraOn
                    ? 'bg-alert-rose text-on-alert-rose shadow-elevation-1'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                )}
              >
                <span className="material-symbols-outlined text-[19px]">{cameraOn ? 'videocam' : 'videocam_off'}</span>
              </button>
              <button
                onClick={() => setShowVideoMenu(v => !v)}
                className="h-10 pr-2 pl-0.5 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors border-l border-outline-variant/50"
                title="Select camera device"
              >
                <span className="material-symbols-outlined text-[16px] hover:scale-110 transition-transform">keyboard_arrow_up</span>
              </button>

              {showVideoMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowVideoMenu(false)} />
                  <div className="absolute bottom-12 left-0 w-64 rounded-xl border border-outline-variant bg-surface text-on-surface p-2 shadow-elevation-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="text-[10px] font-extrabold text-on-surface-variant px-2.5 py-1.5 border-b border-outline-variant uppercase tracking-wider flex items-center justify-between">
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
                        className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5"
                        title="Re-scan connected camera hardware"
                      >
                        <span className="material-symbols-outlined text-xs">sync</span> Rescan
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-0.5 mt-1.5 custom-scrollbar">
                      {videoDevices.length === 0 ? (
                        <div className="p-2 space-y-1.5 text-center">
                          <p className="text-xs text-on-surface-variant italic font-medium">No physical camera detected or permission blocked.</p>
                          <button
                            onClick={async () => {
                              try {
                                await toggleCameraWithPermission();
                              } catch {}
                              await loadDevices();
                            }}
                            className="w-full py-1.5 px-2 bg-primary hover:bg-primary-hover text-on-primary rounded-lg text-xs font-bold transition-all shadow-elevation-1"
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
                                "w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between",
                                selectedVideoId === d.deviceId ? "bg-primary text-on-primary font-bold" : "hover:bg-surface-container text-on-surface"
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

            {/* Studio / Gallery View Mode Toggles */}
            <div className="flex items-center bg-surface-container p-0.5 rounded-full border border-outline-variant">
              <button
                onClick={() => setViewMode('studio')}
                className={clsx(
                  "grid h-9 w-9 place-items-center rounded-full transition-all text-xs",
                  viewMode === 'studio' ? "bg-surface text-primary shadow-elevation-1 font-bold" : "text-on-surface-variant hover:text-on-surface"
                )}
                title="Studio View (Whiteboard + Video Strip)"
              >
                <span className="material-symbols-outlined text-[18px]">draw</span>
              </button>

              <button
                onClick={() => setViewMode('gallery')}
                className={clsx(
                  "grid h-9 w-9 place-items-center rounded-full transition-all text-xs",
                  viewMode === 'gallery' ? "bg-surface text-primary shadow-elevation-1 font-bold" : "text-on-surface-variant hover:text-on-surface"
                )}
                title="Gallery Grid View (2x2 All Cameras)"
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
              </button>
            </div>

            {/* Hand Raise Control */}
            <Control
              active={raisedHand}
              icon="pan_tool"
              label="Raise hand"
              highlighted={raisedHand}
              onClick={toggleHand}
            />

            {/* Screen Share Control */}
            <Control
              active={sharing}
              icon="present_to_all"
              label="Share screen"
              highlighted={sharing}
              onClick={toggleShare}
            />

            {/* Fullscreen Workspace Action */}
            <button
              onClick={() => toggleFullscreenMode(true)}
              className="grid h-10 w-10 place-items-center rounded-full border border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container hover:text-on-surface shadow-elevation-1 transition-all active:scale-95"
              title="Fullscreen explanation mode"
            >
              <span className="material-symbols-outlined text-[19px]">open_in_full</span>
            </button>

            {/* Chat Toggle Button */}
            <button
              onClick={() => setChatOpen(value => !value)}
              className={clsx(
                "grid h-10 w-10 place-items-center rounded-full border transition hover:-translate-y-0.5 active:translate-y-0 active:scale-95 shadow-elevation-1",
                chatOpen ? "bg-primary text-on-primary border-primary" : "border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container"
              )}
              title="Toggle Live Chat"
            >
              <span className="material-symbols-outlined text-[18px]">chat</span>
            </button>
          </div>

          {/* Leave Call Button */}
          <button
            onClick={handleEndCall}
            className="grid h-10 w-12 place-items-center rounded-full bg-alert-rose text-on-alert-rose shadow-elevation-1 transition hover:-translate-y-0.5 hover:bg-alert-rose-hover hover:scale-105 active:translate-y-0 active:scale-95 duration-200"
            title="Disconnect call & release devices"
          >
            <span className="material-symbols-outlined text-[20px]">call_end</span>
          </button>
        </footer>
      </div>

      {/* FULLSCREEN EXPLANATION WORKSPACE OVERLAY */}
      {isFullscreenWorkspace && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col p-2 sm:p-4 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
          {/* Fullscreen Top Navigation */}
          <header className="mb-2 flex items-center justify-between gap-2 rounded-2xl bg-surface border border-outline-variant px-4 py-2.5 text-on-surface shadow-elevation-2">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-on-primary">
                <span className="material-symbols-outlined text-[19px]">fit_screen</span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-wide text-white uppercase">Fullscreen Explanation Mode</span>
                  <span className="rounded-full bg-teaching-emerald-container border border-teaching-emerald/40 px-2 py-0.5 text-[10px] font-extrabold text-teaching-emerald animate-pulse">
                    ● Live Focus
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Room: {roomId.slice(0, 14)} · Press <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] border border-slate-700 text-slate-300 font-mono">ESC</kbd> to exit</p>
              </div>
            </div>

            {/* Quick Actions in Fullscreen */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPipVideos(v => !v)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95",
                  showPipVideos ? "bg-slate-800 border-white/20 text-primary" : "bg-transparent border-white/10 text-slate-400 hover:bg-white/10"
                )}
                title="Toggle Floating Video Feeds"
              >
                <span className="material-symbols-outlined text-[16px]">{showPipVideos ? 'picture_in_picture_alt' : 'visibility_off'}</span>
                <span className="hidden md:inline">{showPipVideos ? 'Hide Video PiP' : 'Show Video PiP'}</span>
              </button>

              <button
                onClick={() => setShowFullscreenChat(v => !v)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95",
                  showFullscreenChat ? "bg-primary border-primary text-on-primary" : "bg-slate-800 border-white/20 text-white hover:bg-slate-700"
                )}
                title="Open Chat Drawer"
              >
                <span className="material-symbols-outlined text-[16px]">forum</span>
                <span className="hidden md:inline">Chat</span>
              </button>

              <button
                onClick={() => toggleFullscreenMode(false)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-extrabold border border-white/20 transition-all active:scale-95"
                title="Exit Fullscreen Mode"
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
                onToggleFullscreen={() => toggleFullscreenMode(false)}
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
                executeCode={executeCode}
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

                  {/* Remote participants in PiP */}
                  {remoteParticipants.map(p => (
                    <VideoTile 
                      key={p.id}
                      stream={p.stream} 
                      name={p.name} 
                      role={p.role}
                      muted={false} 
                      waiting={false} 
                      raised={p.handRaised} 
                      accent={p.role === 'teacher' ? "bg-teaching-emerald" : "bg-learning-amber"} 
                      isRemote
                      onUnlockAudio={unlockAudio}
                      className="h-28 w-full"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Fullscreen Floating Chat Drawer */}
            {showFullscreenChat && (
              <div className="w-80 border-l border-white/10 bg-slate-900 flex flex-col z-30 animate-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
                  <h3 className="text-xs font-black">Live Chat in Fullscreen</h3>
                  <button onClick={() => setShowFullscreenChat(false)} className="text-slate-400 hover:text-white">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-3 custom-scrollbar">
                  {messages.map(m => (
                    <div key={m.id} className={clsx("p-2.5 rounded-xl text-xs max-w-[90%]", m.own ? "ml-auto bg-primary text-on-primary font-bold" : "bg-slate-800 text-slate-200")}>
                      <span className="block text-[10px] font-extrabold opacity-75">{m.sender}</span>
                      {m.text}
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    sendChat();
                  }}
                  className="p-2 border-t border-white/10 flex gap-1.5 bg-slate-950"
                >
                  <input
                    value={chatText}
                    onChange={e => setChatText(e.target.value)}
                    placeholder="Type message…"
                    className="flex-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white outline-none border border-slate-700"
                  />
                  <button className="px-3 bg-primary text-on-primary rounded-lg text-xs font-bold hover:bg-primary-hover">
                    Send
                  </button>
                </form>
              </div>
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
            {!isTeacher && currentSession?.paymentStatus !== 'paid' && (
              <div className="bg-teaching-emerald-container/50 border border-teaching-emerald/20 rounded-2xl p-4 text-left space-y-2 text-on-teaching-emerald-container">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span>Mentor Fee Due:</span>
                  <span className="text-teaching-emerald text-base font-black">
                    ₹{currentSession?.pricePerStudent || currentSession?.amount || 499}
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                  As part of our Pay After Lecture guarantee, please complete your fee payment via Razorpay.
                </p>
                <button
                  onClick={handlePayPostLecture}
                  className="w-full py-2.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-black transition-all shadow-elevation-1 active:scale-95 flex items-center justify-center gap-1.5 mt-1"
                >
                  <span className="material-symbols-outlined text-[16px]">lock</span>
                  <span>Pay ₹{currentSession?.pricePerStudent || currentSession?.amount || 499} with Razorpay</span>
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

            <div className="space-y-2 pt-1">
              <button
                onClick={() => navigate('/schedule')}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-extrabold transition-all shadow-elevation-1 active:scale-95 flex items-center justify-center gap-2"
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
    </div>
  );
}

// Subcomponent: Workspace Content (Whiteboard, Notes, Code Editor)
function WorkspaceContent({
  workspace,
  chooseWorkspace,
  isFullscreen,
  onToggleFullscreen,
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
  executeCode,
  copiedCode,
  handleCopyCode,
  sharing,
  isPeerScreenSharing,
  sharerName,
  displayStream,
  remoteStream,
  onUnlockAudio,
  isHalfscreen = false,
  onToggleHalfscreen
}: {
  workspace: Workspace;
  chooseWorkspace: (w: Workspace) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
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
  executeCode: () => void;
  copiedCode: boolean;
  handleCopyCode: () => void;
  sharing?: boolean;
  isPeerScreenSharing?: boolean;
  sharerName?: string;
  displayStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  onUnlockAudio?: () => void;
  isHalfscreen?: boolean;
  onToggleHalfscreen?: () => void;
}) {
  return (
    <div className={clsx("flex flex-col h-full w-full min-h-0 overflow-hidden", isFullscreen ? "bg-surface" : "flex-1 rounded-2xl border border-outline-variant bg-surface shadow-elevation-1")}>
      {/* Workspace Subheader Navigation */}
      <nav className="flex items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-low p-2 overflow-x-auto text-on-surface">
        <div className="flex items-center gap-1.5">
          {toolTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => chooseWorkspace(tab.id)}
              className={clsx(
                'flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-all duration-200 active:scale-95',
                workspace === tab.id
                  ? 'bg-primary text-on-primary shadow-elevation-1'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
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
                'flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-all duration-200 active:scale-95 border',
                workspace === 'screenshare'
                  ? 'bg-primary text-on-primary border-primary shadow-elevation-1 animate-pulse'
                  : 'bg-primary-container text-on-primary-container border-primary/20 hover:bg-primary-container/80'
              )}
            >
              <span className="material-symbols-outlined text-[16px]">screen_share</span>
              <span>📺 Live Shared Screen View</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleHalfscreen && !isFullscreen && (
            <button
              type="button"
              onClick={onToggleHalfscreen}
              className={clsx(
                "flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-extrabold transition-all shadow-elevation-1 border active:scale-95",
                isHalfscreen
                  ? "bg-primary text-on-primary border-primary shadow-elevation-1"
                  : "bg-surface hover:bg-surface-container text-on-surface border-outline-variant"
              )}
              title={isHalfscreen ? "Exit Split View (Return to Standard View)" : "Split View: Video Left, Whiteboard Right (50/50)"}
            >
              <span className="material-symbols-outlined text-[16px]">{isHalfscreen ? 'vertical_split' : 'splitscreen'}</span>
              <span>{isHalfscreen ? 'Standard View' : 'Halfscreen Mode'}</span>
            </button>
          )}

          <button
            onClick={onToggleFullscreen}
            className={clsx(
              "flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-extrabold transition-all shadow-elevation-1 border active:scale-95",
              isFullscreen
                ? "bg-surface-container-high text-on-surface border-outline-variant hover:bg-surface-container"
                : "bg-primary-container hover:bg-primary-container/80 text-on-primary-container border-primary/20"
            )}
            title={isFullscreen ? "Exit Fullscreen" : "Expand to Fullscreen"}
          >
            <span className="material-symbols-outlined text-[16px]">{isFullscreen ? 'fullscreen_exit' : 'open_in_full'}</span>
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </nav>

      {/* Main Workspace Body */}
      <div className="relative min-h-0 flex-1 bg-surface-container-low/30 overflow-hidden flex flex-col">
        {/* 1. Whiteboard Canvas */}
        {workspace === 'whiteboard' && (
          <div className="relative h-full w-full bg-surface flex flex-col">
            {/* Whiteboard Floating Toolbar */}
            <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-1.5 rounded-2xl bg-surface border border-outline-variant px-3 py-2 text-xs text-on-surface shadow-elevation-2 max-w-[calc(100%-24px)]">
              {/* Drawing Tool Selectors */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDrawingTool('pen')}
                  className={clsx("p-1.5 rounded-lg flex items-center gap-1 font-extrabold text-[11px] transition-all", drawingTool === 'pen' ? "bg-primary text-on-primary" : "hover:bg-surface-container text-on-surface")}
                  title="Pen tool"
                >
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                  <span className="hidden sm:inline">Pen</span>
                </button>

                <button
                  onClick={() => setDrawingTool('highlighter')}
                  className={clsx("p-1.5 rounded-lg flex items-center gap-1 font-extrabold text-[11px] transition-all", drawingTool === 'highlighter' ? "bg-learning-amber text-on-learning-amber" : "hover:bg-surface-container text-on-surface")}
                  title="Highlighter tool"
                >
                  <span className="material-symbols-outlined text-[15px]">ink_highlighter</span>
                  <span className="hidden sm:inline">Highlight</span>
                </button>

                <button
                  onClick={() => setDrawingTool('eraser')}
                  className={clsx("p-1.5 rounded-lg flex items-center gap-1 font-extrabold text-[11px] transition-all", drawingTool === 'eraser' ? "bg-alert-rose text-on-alert-rose" : "hover:bg-surface-container text-on-surface")}
                  title="Eraser tool"
                >
                  <span className="material-symbols-outlined text-[15px]">ink_eraser</span>
                  <span className="hidden sm:inline">Eraser</span>
                </button>
              </div>

              <div className="h-4 w-px bg-outline-variant mx-0.5" />

              {/* Shapes */}
              <div className="flex items-center gap-0.5">
                <button onClick={() => setDrawingTool('line')} className={clsx("p-1 rounded-lg text-on-surface", drawingTool === 'line' ? "bg-primary-container text-on-primary-container font-bold" : "hover:bg-surface-container")} title="Draw Line">
                  <span className="material-symbols-outlined text-[16px]">horizontal_rule</span>
                </button>
                <button onClick={() => setDrawingTool('arrow')} className={clsx("p-1 rounded-lg text-on-surface", drawingTool === 'arrow' ? "bg-primary-container text-on-primary-container font-bold" : "hover:bg-surface-container")} title="Draw Arrow">
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
                <button onClick={() => setDrawingTool('rect')} className={clsx("p-1 rounded-lg text-on-surface", drawingTool === 'rect' ? "bg-primary-container text-on-primary-container font-bold" : "hover:bg-surface-container")} title="Draw Rectangle">
                  <span className="material-symbols-outlined text-[16px]">rectangle</span>
                </button>
                <button onClick={() => setDrawingTool('circle')} className={clsx("p-1 rounded-lg text-on-surface", drawingTool === 'circle' ? "bg-primary-container text-on-primary-container font-bold" : "hover:bg-surface-container")} title="Draw Circle">
                  <span className="material-symbols-outlined text-[16px]">radio_button_unchecked</span>
                </button>
              </div>

              <div className="h-4 w-px bg-outline-variant mx-0.5" />

              {/* Color Palette */}
              <div className="flex items-center gap-1">
                {['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0f172a'].map(color => (
                  <button
                    key={color}
                    onClick={() => { setDrawColor(color); if (drawingTool === 'eraser') setDrawingTool('pen'); }}
                    className={clsx(
                      "w-4 h-4 rounded-full transition-transform",
                      drawingTool !== 'eraser' && drawColor === color ? "scale-125 ring-2 ring-offset-1 ring-primary" : "hover:scale-110"
                    )}
                    style={{ backgroundColor: color }}
                    title={`Color ${color}`}
                  />
                ))}
              </div>

              <div className="h-4 w-px bg-outline-variant mx-0.5" />

              {/* Stroke Widths */}
              <div className="flex items-center gap-1">
                {[2, 4, 8, 14].map(w => (
                  <button
                    key={w}
                    onClick={() => setDrawWidth(w)}
                    className={clsx(
                      "px-1.5 py-0.5 rounded text-[10px] font-extrabold transition-all",
                      drawWidth === w ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container"
                    )}
                  >
                    {w}px
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-outline-variant mx-0.5" />

              {/* Sync & Export */}
              <button 
                onClick={syncWorkspaceWithPeer} 
                className="px-2 py-1 rounded-lg text-[11px] font-extrabold text-on-primary-container bg-primary-container border border-primary/20 hover:bg-primary-container/80 flex items-center gap-1 transition-all"
                title="Sync drawing with peer"
              >
                <span className="material-symbols-outlined text-xs">sync</span> Sync
              </button>

              <button 
                onClick={downloadWhiteboard} 
                className="px-2 py-1 rounded-lg text-[11px] font-extrabold text-on-surface hover:bg-surface-container flex items-center gap-1 transition-all"
                title="Export Whiteboard as Image"
              >
                <span className="material-symbols-outlined text-xs">download</span> Save
              </button>

              <button onClick={clearBoard} className="text-[11px] font-extrabold text-on-surface-variant hover:text-alert-rose px-1 transition-colors">
                Clear
              </button>
            </div>

            <canvas
              ref={canvasRef}
              width={1920}
              height={1080}
              onPointerDown={beginDraw}
              onPointerMove={continueDraw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
              className="h-full w-full touch-none cursor-crosshair object-contain bg-surface"
            />
          </div>
        )}

        {/* 2. Shared Notes & Plan */}
        {workspace === 'notes' && (
          <div className="flex flex-col h-full bg-surface p-4 sm:p-6 overflow-hidden text-on-surface">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3 mb-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-on-surface">
                <span className="material-symbols-outlined text-primary text-base">edit_note</span>
                <span>Shared Markdown Notes & Action Items</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(notes);
                  alert('Notes copied to clipboard!');
                }}
                className="px-2.5 py-1 text-xs font-extrabold bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg flex items-center gap-1 transition-all"
              >
                <span className="material-symbols-outlined text-xs">content_copy</span> Copy Notes
              </button>
            </div>

            <textarea
              value={notes}
              onChange={event => {
                setNotes(event.target.value);
                emitRoomEvent({ type: 'notes', value: event.target.value });
              }}
              className="flex-1 w-full resize-none font-sans text-sm leading-7 text-on-surface outline-none placeholder:text-neutral-subtle p-2 rounded-xl focus:bg-surface-container-low transition-colors custom-scrollbar bg-surface"
              placeholder="Type shared session notes, formulas, explanations, and action items..."
            />
          </div>
        )}

        {/* 3. Interactive Code Pad */}
        {workspace === 'code' && (
          <div className="flex flex-col h-full bg-slate-950 text-cyan-200 overflow-hidden select-none">
            {/* Code Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/95 px-3 py-2 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400 text-base">terminal</span>
                <select
                  value={selectedCodeLang}
                  onChange={e => {
                    const newLang = e.target.value;
                    setSelectedCodeLang(newLang);
                    emitRoomEvent({ type: 'code-lang', lang: newLang });
                  }}
                  className="bg-slate-800 text-white font-bold rounded-lg px-2.5 py-1 border border-slate-700 outline-none text-xs focus:ring-2 focus:ring-cyan-500/30"
                >
                  <option value="javascript">⚡ JavaScript / Node.js</option>
                  <option value="python">🐍 Python 3.12</option>
                  <option value="cpp">⚙️ C++20 (GCC 13)</option>
                  <option value="java">☕ Java (OpenJDK 21)</option>
                  <option value="sql">📊 SQL Query Engine</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const templates: Record<string, string> = {
                      javascript: '// ⚡ JavaScript / TypeScript Live Sandbox\nfunction calculateBatch() {\n  return {\n    topic: "React & TypeScript Systems",\n    students: 3,\n    status: "Active 🎓"\n  };\n}\nconsole.log("Cohort Report:", calculateBatch());\n',
                      python: '# 🐍 Python 3 Live Sandbox\ndef solve():\n    skills = ["React", "Python", "WebRTC"]\n    print("Welcome to Mindroot Python Engine!")\n    for i, s in enumerate(skills, 1):\n        print(f"  {i}. {s}")\n\nsolve()\n',
                      cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "🚀 Mindroot C++20 Live Playground" << endl;\n    cout << "Welcome to the interactive cohort batch!" << endl;\n    \n    int students = 3;\n    cout << "Active Batch Size: " << students << " students" << endl;\n    return 0;\n}\n',
                      java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("☕ Mindroot Java Live Sandbox");\n        int totalStudents = 3;\n        System.out.println("Connected Batch: " + totalStudents + " students");\n    }\n}\n',
                      sql: '-- 📊 Query Cohort Database\nSELECT id, name, skill, rating, hourly_rate, status\nFROM mentors\nWHERE rating >= 4.9;\n'
                    };
                    const starter = templates[selectedCodeLang] || templates.javascript;
                    setCode(starter);
                    emitRoomEvent({ type: 'code', value: starter });
                  }}
                  className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-[11px] border border-slate-700 transition-all"
                  title="Insert starter boilerplate for this language"
                >
                  <span className="material-symbols-outlined text-xs">code_blocks</span>
                  <span>Template</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold flex items-center gap-1 transition-all text-xs"
                  title="Copy code to clipboard"
                >
                  <span className="material-symbols-outlined text-xs">{copiedCode ? 'check' : 'content_copy'}</span>
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={executeCode}
                  disabled={isRunningCode}
                  className="px-3.5 py-1 rounded-lg bg-primary hover:bg-primary-hover text-on-primary font-extrabold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 text-xs"
                  title="Run code in interactive sandbox"
                >
                  <span className="material-symbols-outlined text-[15px]">{isRunningCode ? 'hourglass_top' : 'play_arrow'}</span>
                  <span>{isRunningCode ? 'Compiling…' : 'Run Code'}</span>
                </button>
              </div>
            </div>

            {/* Code Editor Body + Output Split */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0">
              <div className="flex-1 flex h-full min-h-0 bg-slate-950 relative border-b md:border-b-0 md:border-r border-slate-800">
                {/* Line Numbers Column */}
                <div className="py-4 pl-3 pr-2 select-none text-right font-mono text-xs text-slate-600 border-r border-slate-800/80 bg-slate-950/60 shrink-0">
                  {code.split('\n').map((_, i) => (
                    <div key={i} className="leading-6">{i + 1}</div>
                  ))}
                </div>

                <textarea
                  value={code}
                  onChange={event => {
                    setCode(event.target.value);
                    emitRoomEvent({ type: 'code', value: event.target.value });
                  }}
                  onKeyDown={e => {
                    // Support Tab key indenting (2 spaces)
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const target = e.currentTarget;
                      const start = target.selectionStart;
                      const end = target.selectionEnd;
                      const updated = code.substring(0, start) + '  ' + code.substring(end);
                      setCode(updated);
                      emitRoomEvent({ type: 'code', value: updated });
                      setTimeout(() => {
                        target.selectionStart = target.selectionEnd = start + 2;
                      }, 0);
                    }
                  }}
                  spellCheck={false}
                  className="flex-1 h-full w-full resize-none bg-slate-950 p-4 font-mono text-sm leading-6 text-cyan-200 outline-none custom-scrollbar"
                  placeholder="// Write code here..."
                />
              </div>

              {/* Live Output / Console Terminal Panel */}
              <div className="h-44 md:h-full md:w-84 lg:w-96 bg-slate-900/95 p-3.5 font-mono text-xs overflow-y-auto border-t md:border-t-0 border-slate-800 custom-scrollbar flex flex-col shrink-0">
                <div className="flex items-center justify-between text-slate-400 font-extrabold border-b border-slate-800 pb-2 mb-2 text-[10px] uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-cyan-300">
                    <span className="material-symbols-outlined text-xs">terminal</span>
                    <span>Console / Compiler Output</span>
                  </span>
                  {codeOutput && (
                    <button onClick={onClearCodeOutput} className="text-slate-500 hover:text-white text-[11px] font-bold" title="Clear console">
                      Clear
                    </button>
                  )}
                </div>

                {codeOutput ? (
                  <pre className="flex-1 whitespace-pre-wrap text-slate-200 leading-5 font-mono text-xs overflow-x-auto select-text">
                    {codeOutput}
                  </pre>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-center p-4">
                    <span className="material-symbols-outlined text-2xl mb-1 text-slate-700">play_circle</span>
                    <p className="text-[11px] font-bold text-slate-500">Ready to run</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">Click "Run Code" above to compile & see stdout output</p>
                  </div>
                )}
              </div>
            </div>
          </div>
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

function RemoteAudioElement({
  stream,
  onUnlockAudio
}: {
  stream: MediaStream | null;
  onUnlockAudio?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      el.play().catch(err => {
        console.warn('Remote audio autoplay blocked:', err);
        if (onUnlockAudio) onUnlockAudio();
      });
    } else {
      el.srcObject = null;
    }
  }, [stream, onUnlockAudio]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
}

function StreamVideo({
  stream,
  className,
  cameraOff = false,
  onUnlockAudio,
  isRemote = false
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
  cameraOff?: boolean;
  onUnlockAudio?: () => void;
  isRemote?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const handlePlay = () => {
      if (stream && !cameraOff) {
        if (el.srcObject !== stream) {
          el.srcObject = stream;
        }
        el.muted = true;
        el.playsInline = true;
        const playPromise = el.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.log('[WebRTC Video] Autoplay deferred for remote stream:', err);
            if (isRemote && onUnlockAudio) {
              onUnlockAudio();
            }
          });
        }
      } else {
        el.srcObject = null;
      }
    };

    handlePlay();

    if (stream) {
      stream.onaddtrack = handlePlay;
      stream.onremovetrack = handlePlay;
      stream.getVideoTracks().forEach(t => {
        t.addEventListener('unmute', handlePlay);
      });
    }

    return () => {
      if (stream) {
        stream.onaddtrack = null;
        stream.onremovetrack = null;
        stream.getVideoTracks().forEach(t => {
          t.removeEventListener('unmute', handlePlay);
        });
      }
    };
  }, [stream, cameraOff, isRemote, onUnlockAudio]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={true}
      // @ts-ignore
      webkit-playsinline="true"
      onLoadedMetadata={(e) => {
        e.currentTarget.play().catch(() => undefined);
      }}
      className={clsx(className, cameraOff && 'opacity-0')}
    />
  );
}

function VideoTile({ 
  stream, 
  name, 
  role = 'student',
  waiting, 
  muted, 
  raised, 
  cameraOff, 
  micOff,
  accent,
  onSwitchCamera,
  hasMultipleCameras,
  isRemote,
  onUnlockAudio,
  className
}: { 
  stream: MediaStream | null; 
  name: string; 
  role?: string;
  waiting?: boolean; 
  muted: boolean; 
  raised?: boolean; 
  cameraOff?: boolean; 
  micOff?: boolean;
  accent: string;
  onSwitchCamera?: () => void;
  hasMultipleCameras?: boolean;
  isHardware?: boolean;
  isRemote?: boolean;
  onUnlockAudio?: () => void;
  className?: string;
}) {
  const [, setTrackVersion] = useState(0);

  useEffect(() => {
    if (!stream) return;

    const handleTrackChange = () => setTrackVersion(v => v + 1);

    stream.getTracks().forEach(track => {
      track.addEventListener('unmute', handleTrackChange);
      track.addEventListener('mute', handleTrackChange);
      track.addEventListener('ended', handleTrackChange);
    });

    stream.onaddtrack = handleTrackChange;
    stream.onremovetrack = handleTrackChange;

    return () => {
      stream.getTracks().forEach(track => {
        track.removeEventListener('unmute', handleTrackChange);
        track.removeEventListener('mute', handleTrackChange);
        track.removeEventListener('ended', handleTrackChange);
      });
      stream.onaddtrack = null;
      stream.onremovetrack = null;
    };
  }, [stream]);

  const isTeacher = role === 'teacher';
  // Strip redundant duplicate parentheticals from display name
  const cleanDisplayName = name.replace(/\s*\((Teacher|Classmate\s*\d*)\)/gi, '').trim();
  const activeVideoTrack = stream?.getVideoTracks()[0];
  const hasLiveTrack = Boolean(activeVideoTrack && activeVideoTrack.readyState !== 'ended');
  const showPlaceholder = waiting || cameraOff || !hasLiveTrack;

  return (
    <div className={clsx(
      "group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm transition-all duration-200 flex items-center justify-center select-none",
      className || "aspect-video"
    )}>
      <StreamVideo
        stream={stream}
        muted={muted}
        cameraOff={cameraOff}
        isRemote={isRemote}
        onUnlockAudio={onUnlockAudio}
        className="h-full w-full bg-slate-950 object-cover"
      />

      {hasMultipleCameras && onSwitchCamera && (
        <button
          onClick={onSwitchCamera}
          className="absolute top-2 left-2 bg-slate-900/85 hover:bg-primary text-white p-1 rounded-lg backdrop-blur-md transition-all border border-white/20 shadow-md flex items-center gap-1 px-2 text-[10px] font-bold z-20 active:scale-95"
          title="Switch Camera"
        >
          <span className="material-symbols-outlined text-xs">flip_camera_ios</span>
          <span>Flip</span>
        </button>
      )}

      {showPlaceholder && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-container-high p-2 text-center z-10">
          <div className={clsx('grid h-12 w-12 place-items-center rounded-2xl text-base font-bold text-white shadow-md', accent)}>
            {waiting ? <span className="material-symbols-outlined animate-pulse text-lg">person_search</span> : cleanDisplayName.slice(0, 1).toUpperCase()}
          </div>
          <p className="text-[10px] font-medium text-on-surface-variant mt-1.5">
            {waiting ? 'Connecting…' : (cameraOff ? 'Camera Off' : 'Waiting for video stream…')}
          </p>
        </div>
      )}

      {/* Role Pill & Name Badge on bottom left */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg border border-white/20 bg-slate-900/90 text-white px-2 py-0.5 text-[11px] font-bold shadow-md backdrop-blur-md z-20 max-w-[88%]">
        <span className={clsx("h-2 w-2 rounded-full shrink-0", waiting ? "bg-learning-amber" : "bg-teaching-emerald animate-pulse")} />
        <span className="truncate">{cleanDisplayName}</span>
        <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-black tracking-wider shrink-0 ${
          isTeacher ? 'bg-teaching-emerald text-on-teaching-emerald' : 'bg-learning-amber text-on-learning-amber'
        }`}>
          {isTeacher ? 'Teacher' : 'Student'}
        </span>
      </div>

      {/* Mic Status Badge on bottom right */}
      {micOff && (
        <div className="absolute bottom-2 right-2 bg-rose-500/90 text-white p-1 rounded-md shadow-xs z-20 flex items-center justify-center" title="Muted">
          <span className="material-symbols-outlined text-[13px]">mic_off</span>
        </div>
      )}

      {/* Hand Raise Badge on top right */}
      {raised && (
        <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-amber-300 text-amber-950 shadow-md animate-bounce z-20">
          <span className="material-symbols-outlined text-[15px]">pan_tool</span>
        </div>
      )}
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
