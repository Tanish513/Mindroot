import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

// Helper to find an RTCRtpSender across transceivers and senders
export function findSenderForKind(peer: RTCPeerConnection, kind: 'audio' | 'video'): RTCRtpSender | undefined {
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

// Synthetic animated video stream for testing / camera-off state
export function createSyntheticVideoStream(label: string, subtitle = 'LIVE VIDEO ACTIVE', bgColor1 = '#13161b') {
  try {
    const canvasEl = document.createElement('canvas');
    canvasEl.width = 640;
    canvasEl.height = 360;
    const ctx = canvasEl.getContext('2d');
    
    let frame = 0;
    const draw = () => {
      if (!ctx) return;
      frame++;
      ctx.fillStyle = bgColor1;
      ctx.fillRect(0, 0, 640, 360);

      const pulse = Math.sin(frame * 0.08) * 8;
      ctx.beginPath();
      ctx.arc(320, 135, 52 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(21, 128, 61, 0.2)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(320, 135, 45, 0, Math.PI * 2);
      ctx.fillStyle = '#15803d';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((label || 'P').slice(0, 1).toUpperCase(), 320, 135);

      ctx.textBaseline = 'alphabetic';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(label || 'Peer User', 320, 220);

      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`● ${subtitle}`, 320, 248);

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

// Synthetic silent/ambient audio track
export function createSyntheticAudioTrack(): MediaStreamTrack | null {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const dst = ctx.createMediaStreamDestination();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(dst);
    osc.start();
    return dst.stream.getAudioTracks()[0] || null;
  } catch {
    return null;
  }
}

export function RemoteAudioElement({
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

export function StreamVideo({
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

export function VideoTile({ 
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
  isSimulated,
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
  isSimulated?: boolean;
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
  const cleanDisplayName = name.replace(/\s*\((Teacher|Classmate\s*\d*)\)/gi, '').trim();
  const activeVideoTrack = stream?.getVideoTracks()[0];
  const hasLiveTrack = Boolean(activeVideoTrack && activeVideoTrack.readyState !== 'ended');
  const showPlaceholder = waiting || cameraOff || !hasLiveTrack;

  return (
    <div className={clsx(
      "group relative overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-xs transition-all duration-200 flex items-center justify-center select-none",
      className || "aspect-video"
    )}>
      <StreamVideo
        stream={stream}
        muted={muted}
        cameraOff={cameraOff}
        isRemote={isRemote}
        onUnlockAudio={onUnlockAudio}
        className="h-full w-full bg-surface-2 object-cover"
      />

      {isSimulated && (
        <div className="absolute top-2 right-2 bg-accent text-on-primary font-black px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider shadow-xs backdrop-blur-md z-30 flex items-center gap-1 border border-accent-text/20">
          <span className="material-symbols-outlined text-xs">smart_display</span>
          <span>Simulated</span>
        </div>
      )}

      {hasMultipleCameras && onSwitchCamera && (
        <button
          onClick={onSwitchCamera}
          className="absolute top-2 left-2 bg-surface/85 hover:bg-primary text-text hover:text-on-primary p-1 rounded-lg backdrop-blur-md transition-all border border-border shadow-xs flex items-center gap-1 px-2 text-xs font-bold z-20 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          title="Switch Camera"
          aria-label="Switch Camera"
        >
          <span className="material-symbols-outlined text-xs">flip_camera_ios</span>
          <span>Flip</span>
        </button>
      )}

      {showPlaceholder && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-2 p-2 text-center z-10">
          <div className={clsx('grid h-11 w-11 place-items-center rounded-2xl text-base font-bold text-white shadow-xs', accent || 'bg-primary')}>
            {waiting ? <span className="material-symbols-outlined animate-pulse text-lg">person_search</span> : cleanDisplayName.slice(0, 1).toUpperCase()}
          </div>
          <p className="text-xs font-semibold text-muted mt-1.5">
            {waiting ? 'Connecting…' : (cameraOff ? 'Camera Off' : 'Waiting for video…')}
          </p>
        </div>
      )}

      {/* Role Pill & Name Badge on bottom left */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg border border-border bg-surface/90 text-text px-2 py-0.5 text-xs font-bold shadow-xs backdrop-blur-md z-20 max-w-[88%]">
        <span className={clsx("h-2 w-2 rounded-full shrink-0", waiting ? "bg-accent" : "bg-primary animate-pulse")} />
        <span className="truncate">{cleanDisplayName}</span>
        <span className={clsx(
          "text-[10px] uppercase px-1.5 py-0.5 rounded font-black tracking-wider shrink-0",
          isTeacher ? 'bg-primary text-on-primary' : 'bg-accent text-on-primary'
        )}>
          {isTeacher ? 'Teacher' : 'Student'}
        </span>
      </div>

      {/* Mic Status Badge on bottom right */}
      {micOff && (
        <div className="absolute bottom-2 right-2 bg-danger text-white p-1 rounded-md shadow-xs z-20 flex items-center justify-center" title="Muted" aria-label="Microphone muted">
          <span className="material-symbols-outlined text-sm">mic_off</span>
        </div>
      )}

      {/* Hand Raise Badge on top right */}
      {raised && (
        <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-accent text-on-primary shadow-xs animate-bounce z-20" aria-label="Hand raised">
          <span className="material-symbols-outlined text-sm">pan_tool</span>
        </div>
      )}
    </div>
  );
}

export interface RemoteParticipant {
  id: string;
  name: string;
  role: string;
  stream: MediaStream | null;
  handRaised?: boolean;
  isSimulated?: boolean;
}

interface VideoGridProps {
  viewMode?: 'studio' | 'gallery';
  localStream: MediaStream | null;
  userName: string;
  userRole: string;
  raisedHand: boolean;
  cameraOn: boolean;
  micOn: boolean;
  cycleNextCamera: () => void;
  videoDevices: MediaDeviceInfo[];
  hardwareCam: boolean;
  remoteParticipants: RemoteParticipant[];
  videoRemoteParticipants: RemoteParticipant[];
  overflowAudioParticipants: RemoteParticipant[];
  totalParticipantsCount: number;
  unlockAudio: () => void;
  onOpenWhiteboardStudio: () => void;
  onSimulateStudents?: (count: number) => void;
  isTeacher: boolean;
}

export function VideoGrid({
  localStream,
  userName,
  userRole,
  raisedHand,
  cameraOn,
  micOn,
  cycleNextCamera,
  videoDevices,
  hardwareCam,
  remoteParticipants,
  videoRemoteParticipants,
  overflowAudioParticipants,
  totalParticipantsCount,
  unlockAudio,
  onOpenWhiteboardStudio,
  onSimulateStudents,
  isTeacher
}: VideoGridProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 p-2 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner overflow-hidden">
      <div className="flex items-center justify-between px-2 text-xs text-slate-300 font-bold shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Gallery Grid View · {totalParticipantsCount} Active Feeds (Mesh Video Cap: 4 Feeds Max)</span>
        </span>
        <button
          onClick={onOpenWhiteboardStudio}
          className="flex items-center gap-1 px-3 py-1 bg-primary hover:bg-primary-hover text-on-primary rounded-lg text-xs font-extrabold shadow-elevation-1 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-sm">draw</span>
          <span>Open Whiteboard Studio</span>
        </button>
      </div>

      {/* Audio-only Overflow Explainer Banner */}
      {overflowAudioParticipants.length > 0 && (
        <div className="mx-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2 shrink-0 animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 font-medium truncate">
            <span className="material-symbols-outlined text-sm text-amber-400 shrink-0">info</span>
            <span className="truncate">
              <strong>Bandwidth Mesh Cap Active:</strong> Max 4 concurrent video feeds. {overflowAudioParticipants.map(p => p.name).join(', ')} connected via real-time audio to maintain low latency for cohort batch.
            </span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/30 shrink-0">
            Audio Overflow ({overflowAudioParticipants.length})
          </span>
        </div>
      )}

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
          isHardware={hardwareCam}
          className="h-full w-full"
        />

        {/* Remote Participants (up to 3 video streams in mesh = 4 total video tiles) */}
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
            className="h-full w-full"
          />
        ))}

        {/* Overflow Mesh Participants as Audio-only Avatar Tiles */}
        {overflowAudioParticipants.map(p => (
          <div 
            key={p.id}
            className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col items-center justify-center text-center shadow-sm h-full w-full"
            title="Audio-only mode: peer mesh capped at 4 video tiles to preserve bandwidth for up to 5 cohort members"
          >
            <div className="h-12 w-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-bold text-sm mb-2 shadow-inner">
              {p.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="text-xs font-bold text-white truncate max-w-[140px]">{p.name}</div>
            <span className="text-[10px] text-amber-400 font-bold mt-1.5 flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
              <span className="material-symbols-outlined text-[13px]">volume_up</span> Audio-Only (Mesh Cap)
            </span>
          </div>
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
            {onSimulateStudents && (
              <button
                onClick={() => onSimulateStudents(3)}
                className="mt-3 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-bold shadow-md active:scale-95 transition-all"
              >
                + Simulate 3 Students
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
