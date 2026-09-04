import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../lib/api';
import { motion, AnimatePresence } from 'framer-motion';

const PAGE_PROMPTS: Record<string, string> = {
  '/dashboard': "Hello! I'm your Mindroot AI. How can I help with your skill exchanges today?",
  '/marketplace': "Hi! Looking for a specific skill or peer? I can help you find the best match.",
  '/schedule': "Need help managing your schedule? I can assist with booking or rescheduling sessions.",
  '/teacher': "Hello, teacher! I can help you manage your curriculum, hourly fee, and session requests.",
  '/wallet': "Hi! I can help you with your Razorpay payment receipts, tutoring earnings, and transactions.",
  '/feedback': "I can help you write great feedback or understand your trust score.",
  '/messages': "Need help composing a message or starting a new conversation?",
  '/admin': "Admin panel AI assistant ready. How can I help with platform management?",
  '/match-finder': "Let me help you find the perfect skill exchange partner!",
};

const QUICK_CHIPS = [
  "💳 How does Razorpay payment work?",
  "⚡ Find a peer match",
  "📅 How to book & pay a session?",
  "🎥 Virtual Room features",
  "🎓 How to set tutoring rates?"
];

function FormattedContent({ text }: { text: string }) {
  const navigate = useNavigate();
  if (!text) return null;

  // Render markdown links [Label](/route), bold **text**, and bullet points
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, lIdx) => {
        if (!line.trim()) return <div key={lIdx} className="h-1" />;

        // Match markdown links [Title](/path)
        const parts = [];
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let lastIndex = 0;
        let match;

        while ((match = linkRegex.exec(line)) !== null) {
          if (match.index > lastIndex) {
            parts.push(line.substring(lastIndex, match.index));
          }
          const title = match[1];
          const path = match[2];
          parts.push(
            <button
              key={match.index}
              onClick={() => navigate(path)}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded bg-primary-container text-on-primary-container font-bold hover:bg-primary-container/80 transition-colors underline decoration-primary/40"
            >
              {title}
              <span className="material-symbols-outlined text-[10px]">open_in_new</span>
            </button>
          );
          lastIndex = linkRegex.lastIndex;
        }

        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex));
        }

        return (
          <div key={lIdx} className="whitespace-pre-wrap">
            {parts.map((p, pIdx) => {
              if (typeof p !== 'string') return p;
              // Bold formatting **text**
              const boldParts = p.split(/\*\*([^*]+)\*\*/g);
              return (
                <span key={pIdx}>
                  {boldParts.map((b, bIdx) =>
                    bIdx % 2 === 1 ? <strong key={bIdx} className="font-bold">{b}</strong> : b
                  )}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ text: string; from: 'ai' | 'user' }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { currentUser } = useAppStore();

  const pageKey = Object.keys(PAGE_PROMPTS).find(k => location.pathname.startsWith(k)) || '/dashboard';
  const welcomeMessage = PAGE_PROMPTS[pageKey];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendQuery = (queryText: string) => {
    if (!queryText.trim() || loading) return;
    const userMsg = { text: queryText, from: 'user' as const };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput('');
    setLoading(true);

    api.postAIChat({
      message: queryText,
      history: updatedHistory,
      context: location.pathname,
      userName: currentUser?.name || 'Student'
    })
      .then(res => {
        setMessages(prev => [...prev, { text: res.text || 'I am ready to assist you!', from: 'ai' as const }]);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setMessages(prev => [...prev, { text: "Sorry, I am having trouble connecting right now. Try again later!", from: 'ai' as const }]);
        setLoading(false);
      });
  };

  const handleSend = () => {
    sendQuery(input);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {/* Chat Window */}
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="w-80 md:w-96 bg-surface rounded-2xl shadow-elevation-3 border border-outline-variant overflow-hidden flex flex-col max-h-[540px]"
          >
            {/* Header */}
            <div className="bg-primary text-on-primary p-4 flex items-center justify-between shadow-elevation-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-on-primary/15 p-1 flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-primary text-sm">smart_toy</span>
                </div>
                <div>
                  <h4 className="font-extrabold text-sm leading-tight text-on-primary">Mindroot AI Assistant</h4>
                  <p className="text-[9px] text-on-primary/80 uppercase tracking-widest font-extrabold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-teaching-emerald animate-pulse" /> Interactive Assistant
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close AI Assistant" className="hover:bg-on-primary/15 rounded-full p-1.5 transition-colors duration-200">
                <span className="material-symbols-outlined text-sm text-on-primary">close</span>
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-surface-container-low/50 space-y-3 min-h-[280px] custom-scrollbar">
              {/* Welcome message */}
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-primary-container flex items-center justify-center shrink-0 border border-primary/20">
                  <span className="material-symbols-outlined text-primary text-xs">smart_toy</span>
                </div>
                <div className="bg-surface border border-outline-variant p-3 rounded-2xl rounded-tl-none text-xs text-on-surface max-w-[85%] shadow-elevation-1 leading-5 font-medium">
                  {welcomeMessage}
                </div>
              </div>

              {/* Dynamic messages */}
              {messages.map((msg, i) => (
                <div key={i} className={`flex items-start gap-2 ${msg.from === 'user' ? 'flex-row-reverse' : ''}`}>
                  {msg.from === 'ai' && (
                    <div className="w-7 h-7 rounded-full bg-primary-container flex items-center justify-center shrink-0 border border-primary/20">
                      <span className="material-symbols-outlined text-primary text-xs">smart_toy</span>
                    </div>
                  )}
                  <div className={`p-3 rounded-2xl text-xs max-w-[85%] shadow-elevation-1 leading-5 ${
                    msg.from === 'user'
                      ? 'bg-primary text-on-primary rounded-tr-none font-bold'
                      : 'bg-surface border border-outline-variant text-on-surface rounded-tl-none font-medium'
                  }`}>
                    {msg.from === 'user' ? msg.text : <FormattedContent text={msg.text} />}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-start gap-2 animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-xs animate-spin">smart_toy</span>
                  </div>
                  <div className="bg-surface border border-outline-variant p-3 rounded-2xl rounded-tl-none text-xs text-on-surface-variant italic font-medium flex items-center gap-1.5">
                    <span>Thinking</span>
                    <span className="flex gap-0.5">
                      <span className="h-1 w-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-1 w-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-1 w-1 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Action Suggestion Chips */}
            <div className="px-3 py-2 bg-surface-container border-t border-outline-variant flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
              {QUICK_CHIPS.map((chip, cIdx) => (
                <button
                  key={cIdx}
                  onClick={() => sendQuery(chip)}
                  disabled={loading}
                  className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-surface border border-outline-variant text-[11px] font-semibold text-on-surface hover:bg-primary-container hover:text-primary hover:border-primary/30 transition-all shrink-0 shadow-elevation-1"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-outline-variant bg-surface">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Ask Mindroot AI..."
                  className="w-full pl-4 pr-10 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-medium text-on-surface placeholder:text-neutral-subtle focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-surface transition-all duration-200"
                  disabled={loading}
                />
                <button
                  onClick={handleSend}
                  aria-label="Send message"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:bg-primary-container p-1.5 rounded-lg transition-colors disabled:opacity-40"
                  disabled={loading || !input.trim()}
                >
                  <span className="material-symbols-outlined text-sm font-bold">send</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB Button */}
      <motion.button
        whileHover={{ scale: 1.08, y: -2 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 bg-primary hover:bg-primary-hover text-on-primary rounded-full shadow-elevation-3 flex items-center justify-center relative"
        aria-label="Open AI Assistant"
      >
        {!open && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teaching-emerald opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-teaching-emerald border-2 border-surface"></span>
          </span>
        )}
        <span className="material-symbols-outlined text-on-primary">{open ? 'close' : 'smart_toy'}</span>
      </motion.button>
    </div>
  );
}
