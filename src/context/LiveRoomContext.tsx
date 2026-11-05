import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export interface PersistentRoomState {
  roomId: string;
  session: any | null;
  sessionTitle: string;
  peerName: string;
  userRole: 'teacher' | 'student' | 'observer';
  userName: string;
  startTime: number;
  localStream: MediaStream | null;
  micOn: boolean;
  cameraOn: boolean;
  raisedHand: boolean;
  sharing: boolean;
  socket: any | null;
  peers: Map<string, RTCPeerConnection>;
  remoteParticipants: any[];
  messages: any[];
  notes: string;
  code: string;
  workspace: string;
  viewMode: 'studio' | 'gallery';
  channel?: BroadcastChannel | null;
  isLobbyJoined: boolean;
  bannedUserIds?: Set<string>;
}

interface LiveRoomContextType {
  activeSession: PersistentRoomState | null;
  isCallActive: boolean;
  registerActiveSession: (state: Partial<PersistentRoomState> & { roomId: string }) => void;
  updateSessionMedia: (updates: { micOn?: boolean; cameraOn?: boolean; raisedHand?: boolean; sharing?: boolean; localStream?: MediaStream | null }) => void;
  updateSessionContent: (updates: Partial<PersistentRoomState>) => void;
  leaveActiveSession: (options?: { emitLeave?: boolean }) => void;
  returnToActiveSession: () => void;
}

const LiveRoomContext = createContext<LiveRoomContextType | undefined>(undefined);

export function LiveRoomProvider({ children }: { children: ReactNode }) {
  const [activeSession, setActiveSession] = useState<PersistentRoomState | null>(null);
  const activeSessionRef = useRef<PersistentRoomState | null>(null);
  activeSessionRef.current = activeSession;
  const navigate = useNavigate();

  const isCallActive = Boolean(activeSession && activeSession.roomId);

  const registerActiveSession = useCallback((state: Partial<PersistentRoomState> & { roomId: string }) => {
    setActiveSession(prev => {
      const merged: PersistentRoomState = {
        roomId: state.roomId,
        session: state.session ?? prev?.session ?? null,
        sessionTitle: state.sessionTitle ?? prev?.sessionTitle ?? state.session?.title ?? 'Live Mentoring Session',
        peerName: state.peerName ?? prev?.peerName ?? 'Classmate',
        userRole: state.userRole ?? prev?.userRole ?? 'student',
        userName: state.userName ?? prev?.userName ?? 'You',
        startTime: state.startTime ?? prev?.startTime ?? Date.now(),
        localStream: state.localStream !== undefined ? state.localStream : (prev?.localStream ?? null),
        micOn: state.micOn ?? prev?.micOn ?? true,
        cameraOn: state.cameraOn ?? prev?.cameraOn ?? true,
        raisedHand: state.raisedHand ?? prev?.raisedHand ?? false,
        sharing: state.sharing ?? prev?.sharing ?? false,
        socket: state.socket !== undefined ? state.socket : (prev?.socket ?? null),
        peers: state.peers ?? prev?.peers ?? new Map(),
        remoteParticipants: state.remoteParticipants ?? prev?.remoteParticipants ?? [],
        messages: state.messages ?? prev?.messages ?? [],
        notes: state.notes ?? prev?.notes ?? '',
        code: state.code ?? prev?.code ?? '',
        workspace: state.workspace ?? prev?.workspace ?? 'whiteboard',
        viewMode: state.viewMode ?? prev?.viewMode ?? 'studio',
        channel: state.channel !== undefined ? state.channel : (prev?.channel ?? null),
        isLobbyJoined: state.isLobbyJoined ?? prev?.isLobbyJoined ?? true,
        bannedUserIds: state.bannedUserIds ?? prev?.bannedUserIds ?? new Set()
      };
      return merged;
    });
  }, []);

  const updateSessionMedia = useCallback((updates: {
    micOn?: boolean;
    cameraOn?: boolean;
    raisedHand?: boolean;
    sharing?: boolean;
    localStream?: MediaStream | null;
  }) => {
    setActiveSession(prev => {
      if (!prev) return null;
      if (updates.micOn !== undefined && prev.localStream) {
        prev.localStream.getAudioTracks().forEach(t => { t.enabled = updates.micOn!; });
      }
      if (updates.cameraOn !== undefined && prev.localStream) {
        prev.localStream.getVideoTracks().forEach(t => { t.enabled = updates.cameraOn!; });
      }
      return {
        ...prev,
        ...updates
      };
    });
  }, []);

  const updateSessionContent = useCallback((updates: Partial<PersistentRoomState>) => {
    setActiveSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        ...updates
      };
    });
  }, []);

  const leaveActiveSession = useCallback((options?: { emitLeave?: boolean }) => {
    const current = activeSessionRef.current;
    if (current) {
      // 1. Stop all local media tracks
      if (current.localStream) {
        current.localStream.getTracks().forEach(track => {
          try { track.stop(); } catch {}
        });
      }

      // 2. Close peer connections
      if (current.peers) {
        current.peers.forEach(peer => {
          try { peer.close(); } catch {}
        });
        current.peers.clear();
      }

      // 3. Emit leave-room if requested and socket connected
      if (options?.emitLeave !== false && current.socket) {
        try {
          current.socket.emit('leave-room', { roomId: current.roomId });
          current.socket.disconnect();
        } catch {}
      }

      if (current.channel) {
        try { current.channel.close(); } catch {}
      }
    }

    setActiveSession(null);
  }, []);

  const returnToActiveSession = useCallback(() => {
    const current = activeSessionRef.current;
    if (current?.roomId) {
      navigate(`/live-room/${current.roomId}`);
    }
  }, [navigate]);

  // Clean up on window unload
  useEffect(() => {
    const handleUnload = () => {
      const current = activeSessionRef.current;
      if (current?.localStream) {
        current.localStream.getTracks().forEach(track => {
          try { track.stop(); } catch {}
        });
      }
      if (current?.socket) {
        try {
          current.socket.emit('leave-room', { roomId: current.roomId });
          current.socket.disconnect();
        } catch {}
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  return (
    <LiveRoomContext.Provider
      value={{
        activeSession,
        isCallActive,
        registerActiveSession,
        updateSessionMedia,
        updateSessionContent,
        leaveActiveSession,
        returnToActiveSession
      }}
    >
      {children}
    </LiveRoomContext.Provider>
  );
}

export function useLiveRoom() {
  const context = useContext(LiveRoomContext);
  if (!context) {
    throw new Error('useLiveRoom must be used within a LiveRoomProvider');
  }
  return context;
}
