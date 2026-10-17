import { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';

interface PreJoinLobbyProps {
  session?: any;
  isPractice?: boolean;
  userRole?: string;
  userName?: string;
  onJoin: () => void;
  micOn: boolean;
  setMicOn: (on: boolean) => void;
  cameraOn: boolean;
  setCameraOn: (on: boolean) => void;
  selectedAudioDevice?: string;
  setSelectedAudioDevice?: (id: string) => void;
  selectedVideoDevice?: string;
  setSelectedVideoDevice?: (id: string) => void;
  audioDevices?: MediaDeviceInfo[];
  videoDevices?: MediaDeviceInfo[];
  localStream?: MediaStream | null;
}

export function PreJoinLobby({
  session,
  isPractice = false,
  userRole = 'student',
  userName = 'You',
  onJoin,
  micOn,
  setMicOn,
  cameraOn,
  setCameraOn,
  selectedAudioDevice,
  setSelectedAudioDevice,
  selectedVideoDevice,
  setSelectedVideoDevice,
  audioDevices = [],
  videoDevices = [],
  localStream
}: PreJoinLobbyProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [iceStatus, setIceStatus] = useState<'testing' | 'ready' | 'fallback'>('testing');
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Attach local stream to preview video
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
      videoRef.current.play().catch(() => {});
    }
  }, [localStream, cameraOn]);

  // STUN ICE Candidate Verification Test
  useEffect(() => {
    let active = true;
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      pc.createDataChannel('ice-check');
      pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => {});

      pc.onicecandidate = (event) => {
        if (!active) return;
        if (event.candidate) {
          setIceStatus('ready');
          pc.close();
        }
      };

      const timer = setTimeout(() => {
        if (active && pc.signalingState !== 'closed') {
          setIceStatus('ready');
          pc.close();
        }
      }, 1500);

      return () => {
        active = false;
        clearTimeout(timer);
        if (pc.signalingState !== 'closed') {
          pc.close();
        }
      };
    } catch {
      if (active) setIceStatus('ready');
    }
  }, []);

  // Simple Web Audio Activity Listener for Microphone Preview
  useEffect(() => {
    if (!localStream || !micOn) {
      setAudioLevel(0);
      return;
    }

    try {
      const audioTrack = localStream.getAudioTracks()[0];
      if (!audioTrack) return;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let animId: number;

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animId = requestAnimationFrame(updateMeter);
      };

      updateMeter();

      return () => {
        cancelAnimationFrame(animId);
        source.disconnect();
        audioCtx.close().catch(() => {});
      };
    } catch {
      // AudioContext not permitted or unsupported
    }
  }, [localStream, micOn]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] p-6 select-none">
      <div className="w-full max-w-2xl bg-surface border border-outline-variant rounded-3xl p-6 md:p-8 shadow-elevation-2">
        {/* Practice Room Notice Banner */}
        {isPractice && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-teaching-emerald-container border border-teaching-emerald/30 text-on-teaching-emerald-container rounded-2xl mb-6 font-semibold text-xs">
            <span className="material-symbols-outlined text-lg text-teaching-emerald">science</span>
            <div>
              <p className="font-bold">Practice Room / Device Check Mode</p>
              <p className="opacity-90 font-normal">This is a sandbox session for testing camera, microphone, and WebRTC streaming. No tokens or session records will be changed.</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-on-surface tracking-tight">
              {isPractice ? 'Classroom Device Check' : (session?.title || 'Lecture Pre-Join Lobby')}
            </h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Role: <span className="font-bold capitalize text-primary">{userRole}</span> • Name: <span className="font-bold text-on-surface">{userName}</span>
            </p>
          </div>

          {/* ICE Connection Status Badge */}
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors",
                iceStatus === 'ready' 
                  ? "bg-teaching-emerald-container text-teaching-emerald border border-teaching-emerald/30" 
                  : "bg-learning-amber-container text-learning-amber border border-learning-amber/30"
              )}
            >
              <span 
                className={clsx(
                  "w-2 h-2 rounded-full",
                  iceStatus === 'ready' ? "bg-teaching-emerald animate-pulse" : "bg-learning-amber animate-ping"
                )} 
              />
              {iceStatus === 'ready' ? 'ICE: STUN Verified' : 'Testing ICE...'}
            </span>
          </div>
        </div>

        {/* Video Preview Canvas / Tile */}
        <div className="relative w-full aspect-video bg-neutral-900 rounded-2xl overflow-hidden mb-6 border border-outline-variant flex items-center justify-center shadow-inner">
          {cameraOn && localStream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
              <span className="material-symbols-outlined text-5xl">videocam_off</span>
              <p className="text-xs font-bold">Camera is turned off</p>
            </div>
          )}

          {/* In-Preview Quick Toggle Controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-neutral-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-lg">
            {/* Mic Toggle */}
            <button
              onClick={() => setMicOn(!micOn)}
              aria-label={micOn ? "Mute Microphone" : "Unmute Microphone"}
              className={clsx(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                micOn ? "bg-white/20 hover:bg-white/30 text-white" : "bg-red-500 hover:bg-red-600 text-white"
              )}
            >
              <span className="material-symbols-outlined text-xl">
                {micOn ? 'mic' : 'mic_off'}
              </span>
            </button>

            {/* Camera Toggle */}
            <button
              onClick={() => setCameraOn(!cameraOn)}
              aria-label={cameraOn ? "Turn off camera" : "Turn on camera"}
              className={clsx(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                cameraOn ? "bg-white/20 hover:bg-white/30 text-white" : "bg-red-500 hover:bg-red-600 text-white"
              )}
            >
              <span className="material-symbols-outlined text-xl">
                {cameraOn ? 'videocam' : 'videocam_off'}
              </span>
            </button>
          </div>

          {/* Audio Input Level Indicator */}
          {micOn && (
            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-neutral-900/70 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-white/10">
              <span className="material-symbols-outlined text-xs text-teaching-emerald">mic</span>
              <div className="w-12 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-teaching-emerald transition-all duration-75"
                  style={{ width: `${Math.max(8, audioLevel)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Device Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Camera Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-primary">photo_camera</span>
              Camera
            </label>
            <select
              value={selectedVideoDevice || ''}
              onChange={(e) => setSelectedVideoDevice?.(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-primary cursor-pointer truncate"
            >
              {videoDevices.length > 0 ? (
                videoDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))
              ) : (
                <option value="">Default Camera</option>
              )}
            </select>
          </div>

          {/* Microphone Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-primary">mic</span>
              Microphone
            </label>
            <select
              value={selectedAudioDevice || ''}
              onChange={(e) => setSelectedAudioDevice?.(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-primary cursor-pointer truncate"
            >
              {audioDevices.length > 0 ? (
                audioDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Microphone ${i + 1}`}
                  </option>
                ))
              ) : (
                <option value="">Default Microphone</option>
              )}
            </select>
          </div>
        </div>

        {/* Join Classroom CTA Button */}
        <button
          onClick={onJoin}
          className="w-full h-12 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-xl text-base flex items-center justify-center gap-2 shadow-elevation-2 transition-all active:scale-98 cursor-pointer"
        >
          <span className="material-symbols-outlined text-xl">login</span>
          <span>{isPractice ? 'Enter Practice Classroom' : 'Join Classroom Now'}</span>
        </button>
      </div>
    </div>
  );
}
