import { clsx } from 'clsx';

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  role?: string;
  own?: boolean;
  timestamp?: string;
}

export interface RoomChatProps {
  messages: ChatMessage[];
  chatText: string;
  setChatText: (text: string) => void;
  sendChat: () => void;
  chatOpen?: boolean;
  onClose?: () => void;
  isDrawer?: boolean;
}

export function RoomChat({
  messages,
  chatText,
  setChatText,
  sendChat,
  chatOpen = true,
  onClose,
  isDrawer = false
}: RoomChatProps) {
  if (isDrawer) {
    return (
      <div className="w-80 border-l border-white/10 bg-slate-900 flex flex-col z-30 animate-in slide-in-from-right duration-200 h-full">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-primary">forum</span>
            <h3 className="text-xs font-black">Live Chat in Fullscreen</h3>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3 custom-scrollbar">
          {messages.map(m => (
            <div
              key={m.id}
              className={clsx(
                "p-2.5 rounded-xl text-xs max-w-[90%]",
                m.own ? "ml-auto bg-primary text-on-primary font-bold" : "bg-slate-800 text-slate-200"
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-[10px] font-extrabold opacity-75">{m.sender}</span>
                {m.role && (
                  <span className="text-[8px] uppercase tracking-wider px-1 py-0.2 rounded bg-black/20">
                    {m.role}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
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
            className="flex-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white outline-none border border-slate-700 font-medium"
          />
          <button
            type="submit"
            className="px-3 bg-primary text-on-primary rounded-lg text-xs font-bold hover:bg-primary-hover active:scale-95 transition-all"
          >
            Send
          </button>
        </form>
      </div>
    );
  }

  return (
    <aside className={clsx(
      'min-h-0 shrink-0 overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-elevation-1 transition-all duration-300 flex-col text-on-surface',
      chatOpen ? 'flex' : 'hidden lg:flex'
    )}>
      <div className="flex items-center justify-between border-b border-outline-variant px-3.5 py-2.5 bg-surface-container-low shrink-0">
        <div>
          <h2 className="text-xs font-black text-on-surface">Live Cohort Chat</h2>
          <p className="text-[10px] text-on-surface-variant font-bold">Encrypted in-session messaging</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-primary-container text-on-primary-container border border-primary/20 shadow-elevation-1">
            <span className="material-symbols-outlined text-[15px]">forum</span>
          </span>
          {onClose && (
            <button onClick={onClose} className="lg:hidden text-on-surface-variant hover:text-on-surface p-1">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
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
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <p className={clsx('text-[9px] font-extrabold truncate', message.own ? 'text-on-primary/80' : 'text-primary')}>
                {message.sender}
              </p>
              {message.role && (
                <span className={clsx("text-[8px] uppercase tracking-wider px-1 rounded", message.own ? "bg-black/20" : "bg-primary/10 text-primary")}>
                  {message.role}
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
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
        <button
          type="submit"
          className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-on-primary hover:bg-primary-hover active:scale-95 transition-all shadow-elevation-1 shrink-0"
        >
          <span className="material-symbols-outlined text-[15px]">send</span>
        </button>
      </form>
    </aside>
  );
}
