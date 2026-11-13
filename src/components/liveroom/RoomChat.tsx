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
      <div className="w-80 border-l border-white/[0.07] bg-[#171830] flex flex-col z-30 animate-in slide-in-from-right duration-200 h-full text-[#ECEBFA]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3 text-[#ECEBFA]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-[#10B981]">forum</span>
            <h3 className="text-xs font-semibold">Live Chat in Fullscreen</h3>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-[#A5A3C7] hover:text-[#ECEBFA] p-1 rounded-lg transition-colors" title="Close chat" aria-label="Close chat">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3 custom-scrollbar bg-[#0F1020]/40">
          {messages.map(m => (
            <div
              key={m.id}
              className={clsx(
                "p-2.5 rounded-xl text-xs max-w-[90%] transition-all duration-200",
                m.own ? "ml-auto bg-[#10B981] text-white font-medium" : "bg-[#202244] border border-white/[0.07] text-[#ECEBFA]"
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-[10px] font-semibold opacity-90">{m.sender}</span>
                {m.role && (
                  <span className="text-[8px] uppercase tracking-wider px-1 py-0.2 rounded bg-black/20 font-medium">
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
          className="p-2 border-t border-white/[0.07] flex gap-1.5 bg-[#171830]"
        >
          <input
            value={chatText}
            onChange={e => setChatText(e.target.value)}
            placeholder="Type message…"
            className="flex-1 rounded-lg bg-[#202244] px-3 py-1.5 text-xs text-[#ECEBFA] outline-none border border-white/[0.07] placeholder:text-[#A5A3C7] font-medium focus:border-[#10B981] transition-colors"
          />
          <button
            type="submit"
            className="px-3 bg-[#10B981] hover:bg-[#10B981]/90 text-white rounded-lg text-xs font-medium active:scale-95 transition-all cursor-pointer"
            title="Send chat message"
            aria-label="Send message"
          >
            Send
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={clsx(
      'min-h-0 flex-1 h-full overflow-hidden transition-all duration-200 flex flex-col bg-[#171830] text-[#ECEBFA]',
      chatOpen ? 'flex' : 'hidden lg:flex'
    )}>
      <div className="flex-1 space-y-2.5 overflow-y-auto p-3 custom-scrollbar bg-[#0F1020]/30">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-[#A5A3C7] space-y-1 select-none">
            <span className="material-symbols-outlined text-2xl text-[#A5A3C7]/60">chat_bubble_outline</span>
            <p className="text-xs font-medium text-[#ECEBFA]">No messages yet</p>
            <p className="text-[11px] text-[#A5A3C7]">Send a message to your cohort</p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={clsx(
                'max-w-[90%] rounded-xl px-3 py-1.5 text-xs leading-4 shadow-xs transition-all duration-200',
                message.own 
                  ? 'ml-auto bg-[#10B981] text-white font-medium rounded-tr-none' 
                  : 'bg-[#202244] border border-white/[0.07] text-[#ECEBFA] rounded-tl-none font-medium'
              )}
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <p className={clsx('text-[10px] font-semibold truncate', message.own ? 'text-white/90' : 'text-[#10B981]')}>
                  {message.sender}
                </p>
                {message.role && (
                  <span className={clsx("text-[9px] uppercase tracking-wider px-1 rounded font-medium", message.own ? "bg-black/20 text-white" : "bg-[#10B981]/15 text-[#10B981]")}>
                    {message.role}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words">{message.text}</p>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={event => {
          event.preventDefault();
          sendChat();
        }}
        className="flex gap-1.5 border-t border-white/[0.07] p-2.5 bg-[#171830] shrink-0"
      >
        <input
          value={chatText}
          onChange={event => setChatText(event.target.value)}
          placeholder="Type a message…"
          className="min-w-0 flex-1 rounded-xl border border-white/[0.07] bg-[#202244] px-3 py-2 text-xs text-[#ECEBFA] outline-none placeholder:text-[#A5A3C7] transition-all duration-200 focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]/30 font-medium"
        />
        <button
          type="submit"
          disabled={!chatText.trim()}
          title="Send message"
          aria-label="Send message"
          className="grid h-8 w-8 place-items-center rounded-xl bg-[#10B981] text-white hover:bg-[#10B981]/90 active:scale-95 transition-all duration-200 shadow-xs shrink-0 cursor-pointer disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[15px]">send</span>
        </button>
      </form>
    </div>
  );
}
