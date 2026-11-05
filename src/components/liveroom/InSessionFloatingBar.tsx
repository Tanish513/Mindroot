import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLiveRoom } from '../../context/LiveRoomContext';
import { clsx } from 'clsx';

export function InSessionFloatingBar() {
  const { activeSession, isCallActive, updateSessionMedia, leaveActiveSession, returnToActiveSession } = useLiveRoom();
  const location = useLocation();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isInLiveRoom = location.pathname.startsWith('/live-room');

  useEffect(() => {
    if (!activeSession?.startTime) {
      setElapsedSeconds(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - activeSession.startTime) / 1000);
      setElapsedSeconds(elapsed > 0 ? elapsed : 0);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [activeSession?.startTime]);

  if (!isCallActive || !activeSession || isInLiveRoom) {
    return null;
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const displayName = activeSession.peerName || activeSession.sessionTitle || 'Live Class';

  return (
    <aside
      data-testid="in-session-floating-bar"
      aria-label="In-session controls"
      className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-2xl bg-slate-950/95 border border-slate-700/80 shadow-2xl backdrop-blur-md text-white animate-in fade-in slide-in-from-bottom-3 duration-300 max-w-[calc(100vw-1.5rem)]"
    >
      {/* Live Indicator & Peer Name */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        <div className="flex flex-col min-w-0 max-w-[120px] sm:max-w-[200px]">
          <span className="text-xs font-bold truncate leading-tight">
            In session · {displayName}
          </span>
          <span className="text-[10px] text-slate-400 font-mono leading-none mt-0.5">
            {formatTime(elapsedSeconds)}
          </span>
        </div>
      </div>

      <div className="h-6 w-px bg-slate-800 shrink-0" />

      {/* Quick Media Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Mic Toggle */}
        <button
          onClick={() => updateSessionMedia({ micOn: !activeSession.micOn })}
          title={activeSession.micOn ? "Mute microphone" : "Unmute microphone"}
          aria-label={activeSession.micOn ? "Mute microphone" : "Unmute microphone"}
          className={clsx(
            "h-8 w-8 rounded-xl flex items-center justify-center transition-all cursor-pointer border text-xs",
            activeSession.micOn
              ? "bg-slate-900 border-emerald-500/30 text-emerald-400 hover:bg-slate-800"
              : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
          )}
        >
          <span className="material-symbols-outlined text-[17px]">
            {activeSession.micOn ? 'mic' : 'mic_off'}
          </span>
        </button>

        {/* Camera Toggle */}
        <button
          onClick={() => updateSessionMedia({ cameraOn: !activeSession.cameraOn })}
          title={activeSession.cameraOn ? "Turn camera off" : "Turn camera on"}
          aria-label={activeSession.cameraOn ? "Turn camera off" : "Turn camera on"}
          className={clsx(
            "h-8 w-8 rounded-xl flex items-center justify-center transition-all cursor-pointer border text-xs",
            activeSession.cameraOn
              ? "bg-slate-900 border-emerald-500/30 text-emerald-400 hover:bg-slate-800"
              : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
          )}
        >
          <span className="material-symbols-outlined text-[17px]">
            {activeSession.cameraOn ? 'videocam' : 'videocam_off'}
          </span>
        </button>
      </div>

      <div className="h-6 w-px bg-slate-800 shrink-0" />

      {/* Return to Room CTA Button */}
      <button
        data-testid="return-to-live-room"
        onClick={returnToActiveSession}
        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer"
        title="Return to active classroom"
      >
        <span className="material-symbols-outlined text-sm">open_in_new</span>
        <span>Return</span>
      </button>

      {/* Leave Call Button */}
      <button
        data-testid="floating-bar-leave"
        onClick={() => leaveActiveSession()}
        className="flex items-center justify-center h-8 px-2.5 rounded-xl bg-danger/10 hover:bg-danger text-danger hover:text-white text-xs font-bold transition-all border border-danger/30 hover:border-danger shrink-0 cursor-pointer"
        title="Leave active session"
        aria-label="Leave active session"
      >
        <span className="material-symbols-outlined text-sm">call_end</span>
      </button>
    </aside>
  );
}
