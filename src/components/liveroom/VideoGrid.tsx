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

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(subtitle || 'Video Connected', 320, 248);
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
  accent: _accent,
  onSwitchCamera,
  hasMultipleCameras,
  isRemote,
  onUnlockAudio,
  onKick,
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
  onKick?: () => void;
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
      "group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#171830] shadow-xs transition-all duration-200 flex items-center justify-center select-none",
      className || "aspect-video"
    )}>
      <StreamVideo
        stream={stream}
        muted={muted}
        cameraOff={cameraOff}
        isRemote={isRemote}
        onUnlockAudio={onUnlockAudio}
        className="h-full w-full bg-[#171830] object-cover"
      />

      {hasMultipleCameras && onSwitchCamera && (
        <button
          onClick={onSwitchCamera}
          className="absolute top-2 left-2 bg-[#202244]/85 hover:bg-[#10B981] text-[#ECEBFA] hover:text-white p-1 rounded-lg backdrop-blur-md transition-all duration-200 border border-white/[0.07] shadow-xs flex items-center gap-1 px-2 text-xs font-medium z-20 active:scale-95 focus-visible:ring-2 focus-visible:ring-[#10B981] focus-visible:outline-none"
          title="Switch Camera"
          aria-label="Switch Camera"
        >
          <span className="material-symbols-outlined text-xs">flip_camera_ios</span>
          <span>Flip</span>
        </button>
      )}

      {showPlaceholder && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#171830] border border-white/[0.07] p-2 text-center z-10">
          <div className={clsx('grid h-11 w-11 place-items-center rounded-2xl text-base font-semibold text-white shadow-xs', isTeacher ? 'bg-[#10B981]' : 'bg-[#202244]')}>
            {waiting ? <span className="material-symbols-outlined animate-pulse text-lg">person_search</span> : cleanDisplayName.slice(0, 1).toUpperCase()}
          </div>
          <p className="text-xs font-medium text-[#A5A3C7] mt-1.5">
            {waiting ? 'Connecting…' : (cameraOff ? 'Camera Off' : 'Waiting for video…')}
          </p>
        </div>
      )}

      {/* Role Pill & Name Badge on bottom left */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-[#0F1020]/90 text-[#ECEBFA] px-2 py-0.5 text-xs font-medium shadow-xs backdrop-blur-md z-20 max-w-[88%]">
        <span className={clsx("h-2 w-2 rounded-full shrink-0", waiting ? "bg-amber-400" : "bg-[#10B981] animate-pulse")} />
        <span className="truncate">{cleanDisplayName}</span>
        <span className={clsx(
          "text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold tracking-wider shrink-0",
          isTeacher ? 'bg-[#10B981] text-white' : 'bg-[#202244] text-[#A5A3C7]'
        )}>
          {isTeacher ? 'Teacher' : 'Student'}
        </span>
      </div>

      {/* Mic Status Badge on bottom right (soft red state when muted) */}
      {micOff && (
        <div className="absolute bottom-2 right-2 bg-red-500/15 border border-red-500/30 text-red-400 p-1 rounded-md shadow-xs z-20 flex items-center justify-center" title="Microphone muted" aria-label="Microphone muted">
          <span className="material-symbols-outlined text-sm">mic_off</span>
        </div>
      )}

      {/* Hand Raise Badge on top right */}
      {raised && (
        <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-[#10B981] text-white shadow-xs animate-bounce z-20" aria-label="Hand raised">
          <span className="material-symbols-outlined text-sm">pan_tool</span>
        </div>
      )}

      {/* Teacher remove participant button on top right */}
      {onKick && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onKick();
          }}
          className="absolute top-2 right-2 bg-red-500/15 hover:bg-red-500/30 text-red-400 px-2 py-1 rounded-lg backdrop-blur-md transition-all duration-200 border border-red-500/30 shadow-xs flex items-center gap-1 text-[11px] font-medium z-20 cursor-pointer active:scale-95"
          title={`Remove ${cleanDisplayName} from class`}
          aria-label={`Remove ${cleanDisplayName} from class`}
          data-testid="remove-student-btn"
        >
          <span className="material-symbols-outlined text-xs">person_remove</span>
          <span className="hidden sm:inline">Remove</span>
        </button>
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
  isDevOrDemo?: boolean;
  onKickParticipant?: (participant: RemoteParticipant) => void;
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
  onOpenWhiteboardStudio: _onOpenWhiteboardStudio,
  onSimulateStudents,
  isTeacher,
  isDevOrDemo,
  onKickParticipant
}: VideoGridProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 p-2 bg-[#0F1020] rounded-2xl border border-white/[0.07] shadow-inner overflow-hidden text-[#ECEBFA]">
      <div className="flex items-center justify-between px-2 text-xs text-[#A5A3C7] font-medium shrink-0">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
          <span className="font-semibold text-[#ECEBFA]">Gallery View</span>
          <span>·</span>
          <span>{totalParticipantsCount} {totalParticipantsCount === 1 ? 'Participant' : 'Participants'}</span>
          {remoteParticipants.some(p => p.isSimulated) && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#202244] text-[#ECEBFA] border border-white/[0.07]">
              Demo: simulated participants
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {isDevOrDemo && onSimulateStudents && !remoteParticipants.some(p => p.isSimulated) && (
            <button
              type="button"
              onClick={() => onSimulateStudents(3)}
              className="px-2.5 py-1 rounded-lg bg-[#202244] hover:bg-[#202244]/80 text-[#10B981] border border-white/[0.07] text-xs font-medium cursor-pointer transition-colors"
              title="Simulate 3 students joining for testing"
              aria-label="Simulate 3 students joining"
            >
              + Simulate 3 Students
            </button>
          )}
        </div>
      </div>

      {/* Audio-only Overflow Explainer Banner */}
      {overflowAudioParticipants.length > 0 && (
        <div className="mx-2 px-3 py-1.5 rounded-xl bg-[#171830] border border-white/[0.07] text-[#A5A3C7] text-xs flex items-center justify-between gap-2 shrink-0 animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 font-normal truncate">
            <span className="material-symbols-outlined text-sm text-[#10B981] shrink-0">info</span>
            <span className="truncate">
              <strong className="text-[#ECEBFA] font-semibold">Bandwidth Mesh Cap Active:</strong> Max 4 concurrent video feeds. {overflowAudioParticipants.map(p => p.name).join(', ')} connected via real-time audio.
            </span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-wider bg-[#202244] text-[#A5A3C7] px-2 py-0.5 rounded border border-white/[0.07] shrink-0">
            Audio Overflow ({overflowAudioParticipants.length})
          </span>
        </div>
      )}

      {/* Adaptive Gallery Grid based on participant count */}
      <div className={`flex-1 min-h-0 grid gap-2.5 p-1 ${
        totalParticipantsCount === 1
          ? 'grid-cols-1 md:grid-cols-2'
          : totalParticipantsCount === 2
          ? 'grid-cols-1 md:grid-cols-2'
          : totalParticipantsCount === 3 || totalParticipantsCount === 4
          ? 'grid-cols-2 grid-rows-2'
          : 'grid-cols-2 sm:grid-cols-3 auto-rows-fr'
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
          accent={isTeacher ? "bg-[#10B981]" : "bg-[#202244]"}
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
            accent={p.role === 'teacher' ? "bg-[#10B981]" : "bg-[#202244]"} 
            isRemote
            onUnlockAudio={unlockAudio}
            onKick={isTeacher && p.role !== 'teacher' && onKickParticipant ? () => onKickParticipant(p) : undefined}
            className="h-full w-full"
          />
        ))}

        {/* Overflow Mesh Participants as Audio-only Avatar Tiles */}
        {overflowAudioParticipants.map(p => (
          <div 
            key={p.id}
            className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#171830] p-4 flex flex-col items-center justify-center text-center shadow-xs h-full w-full group"
            title="Audio-only mode: peer mesh capped at 4 video tiles to preserve bandwidth for cohort"
          >
            {isTeacher && p.role !== 'teacher' && onKickParticipant && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onKickParticipant(p);
                }}
                className="absolute top-2 right-2 bg-red-500/15 hover:bg-red-500/30 text-red-400 px-2 py-1 rounded-lg backdrop-blur-md transition-all border border-red-500/30 shadow-xs flex items-center gap-1 text-[11px] font-medium z-20 cursor-pointer active:scale-95 opacity-0 group-hover:opacity-100"
                title={`Remove ${p.name} from class`}
                aria-label={`Remove ${p.name} from class`}
                data-testid="remove-student-btn"
              >
                <span className="material-symbols-outlined text-xs">person_remove</span>
                <span className="hidden sm:inline">Remove</span>
              </button>
            )}
            <div className="h-12 w-12 rounded-full bg-[#202244] border border-white/[0.07] flex items-center justify-center text-[#ECEBFA] font-semibold text-sm mb-2 shadow-inner">
              {p.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="text-xs font-semibold text-[#ECEBFA] truncate max-w-[140px]">{p.name}</div>
            <span className="text-[10px] text-[#A5A3C7] font-medium mt-1.5 flex items-center gap-1 bg-[#202244] px-2 py-0.5 rounded-full border border-white/[0.07]">
              <span className="material-symbols-outlined text-[13px]">volume_up</span> Audio-Only (Mesh Cap)
            </span>
          </div>
        ))}

        {/* With 1 participant: show one large tile plus an "Invite classmates" card with a copy-link button */}
        {remoteParticipants.length === 0 && (
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#171830] flex flex-col items-center justify-center p-6 text-center h-full w-full shadow-xs">
            <div className="w-12 h-12 rounded-full bg-[#202244] border border-white/[0.07] text-[#10B981] flex items-center justify-center mb-2.5">
              <span className="material-symbols-outlined text-2xl">group_add</span>
            </div>
            <h4 className="text-sm font-semibold text-[#ECEBFA]">Invite classmates</h4>
            <p className="text-xs text-[#A5A3C7] mt-1 max-w-[260px]">
              Share the session link to invite peers. Students will appear here once connected.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#202244] hover:bg-[#202244]/80 text-[#ECEBFA] border border-white/[0.07] text-xs font-medium transition-all duration-200 active:scale-95 cursor-pointer"
                title="Copy Room Invitation Link"
                aria-label="Copy Room Invitation Link"
              >
                <span className="material-symbols-outlined text-sm">{copiedLink ? 'check' : 'content_copy'}</span>
                <span>{copiedLink ? 'Link Copied' : 'Copy Invite Link'}</span>
              </button>
              {isDevOrDemo && onSimulateStudents && (
                <button
                  type="button"
                  onClick={() => onSimulateStudents(3)}
                  className="px-3 py-1.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-medium shadow-xs active:scale-95 transition-all duration-200 cursor-pointer"
                  title="Simulate 3 students joining for testing"
                  aria-label="Simulate 3 students joining"
                >
                  + Simulate 3 Students
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
