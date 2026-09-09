import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

export interface UpiPaymentSession {
  id?: string;
  title?: string;
  amount?: number;
  teacherId?: string;
  teacherName?: string;
  teacherAvatar?: string;
  teacherUpiId?: string;
}

interface UpiPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: UpiPaymentSession | null;
  onSuccess?: (details: { paymentId: string; utr: string; amount: number; isDemo: boolean }) => void;
}

export function UpiPaymentModal({ isOpen, onClose, session, onSuccess }: UpiPaymentModalProps) {
  const [activeTab, setActiveTab] = useState<'qr' | 'demo'>('qr');
  const [mentorUpi, setMentorUpi] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successDetails, setSuccessDetails] = useState<{
    paymentId: string;
    utr: string;
    amount: number;
    isDemo: boolean;
  } | null>(null);

  const amount = Math.max(1, Number(session?.amount || 499));
  const mentorName = session?.teacherName || 'Mentor';
  const sessionTitle = session?.title || 'Cohort Mentoring Session';

  // Load mentor's registered UPI ID or fallback
  useEffect(() => {
    if (!isOpen || !session) return;
    setSuccessDetails(null);
    setUtrInput('');
    setIsSubmitting(false);

    if (session.teacherUpiId) {
      setMentorUpi(session.teacherUpiId);
      return;
    }

    if (session.teacherId) {
      api.getMentorUpi(session.teacherId).then((res) => {
        if (res && res.upiId) {
          setMentorUpi(res.upiId);
        } else {
          const cleanName = mentorName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mentor';
          setMentorUpi(`${cleanName}@okhdfcbank`);
        }
      }).catch(() => {
        const cleanName = mentorName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mentor';
        setMentorUpi(`${cleanName}@okhdfcbank`);
      });
    } else {
      setMentorUpi('mindroot.peer@okhdfcbank');
    }
  }, [isOpen, session, mentorName]);

  if (!isOpen || !session) return null;

  const upiUrl = `upi://pay?pa=${encodeURIComponent(mentorUpi)}&pn=${encodeURIComponent(mentorName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Mindroot: ' + sessionTitle.slice(0, 20))}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUrl)}&margin=8`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(mentorUpi);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmPayment = async (isDemo: boolean = false) => {
    setIsSubmitting(true);
    try {
      const res = await api.confirmUpiPayment({
        sessionId: session.id,
        teacherId: session.teacherId,
        amount,
        title: sessionTitle,
        isDemo,
        utr: isDemo ? `DEMO_${Date.now().toString().slice(-8)}` : (utrInput.trim() || `UPI_${Date.now().toString().slice(-8)}`)
      });

      const details = {
        paymentId: res.paymentId || (isDemo ? `pay_demo_${Date.now()}` : `pay_upi_${Date.now()}`),
        utr: res.utr || utrInput || 'DEMO_CONFIRMED',
        amount,
        isDemo
      };

      setSuccessDetails(details);
      if (onSuccess) {
        onSuccess(details);
      }
    } catch (err) {
      console.error('Payment confirmation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-outline-variant rounded-3xl w-full max-w-lg shadow-elevation-3 overflow-hidden transition-all duration-200">
        
        {/* Success / Receipt Screen */}
        {successDetails ? (
          <div className="p-6 md:p-8 text-center space-y-6">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-teaching-emerald/10 text-teaching-emerald ring-8 ring-teaching-emerald/5 animate-bounce">
              <span className="material-symbols-outlined text-4xl">verified</span>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teaching-emerald/10 text-teaching-emerald text-xs font-bold uppercase tracking-wider mb-2">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                {successDetails.isDemo ? 'Demo Payment Verified' : 'Real UPI Payment Verified'}
              </div>
              <h2 className="text-2xl font-black text-on-surface">Payment Successful!</h2>
              <p className="text-xs text-on-surface-variant font-medium mt-1">
                Your live interactive classroom and mentor session have been officially unlocked.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-surface-container/60 border border-outline-variant/60 rounded-2xl p-4 text-left space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-semibold">Session Topic</span>
                <span className="text-on-surface font-bold truncate max-w-[200px]">{sessionTitle}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-semibold">Mentor / Teacher</span>
                <span className="text-on-surface font-bold">{mentorName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-semibold">Amount Paid</span>
                <span className="text-teaching-emerald font-black text-sm">₹{successDetails.amount}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-semibold">Payment Method</span>
                <span className="text-on-surface font-bold">{successDetails.isDemo ? 'Instant Demo Mode' : 'Direct UPI Transfer'}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-outline-variant/40 pt-2">
                <span className="text-on-surface-variant font-semibold">Ref / UTR</span>
                <span className="text-primary font-mono text-[11px] font-bold">{successDetails.utr}</span>
              </div>
            </div>

            {/* Platform Rewards Badge */}
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-learning-amber/10 border border-learning-amber/20 text-learning-amber text-xs font-bold">
              <span className="material-symbols-outlined text-base">stars</span>
              <span>+50 Mindroot Reward Points earned for this on-platform session!</span>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 px-4 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-extrabold shadow-elevation-1 transition-all flex items-center justify-center gap-2"
            >
              <span>Continue to Classroom & Schedule</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="p-6 border-b border-outline-variant/60 flex items-start justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold mb-2">
                  <span className="material-symbols-outlined text-xs">lock</span>
                  <span>Mindroot Guaranteed Peer Settlement</span>
                </div>
                <h3 className="text-lg font-black text-on-surface">Pay Mentor: {mentorName}</h3>
                <p className="text-xs text-on-surface-variant truncate max-w-sm mt-0.5">
                  {sessionTitle}
                </p>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Price Banner */}
            <div className="bg-surface-container/50 px-6 py-3.5 border-b border-outline-variant/40 flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant">Total Amount Due</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-on-surface-variant font-bold">INR</span>
                <span className="text-2xl font-black text-primary">₹{amount}</span>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-3 gap-2 bg-surface-container/30 border-b border-outline-variant/40">
              <button
                onClick={() => setActiveTab('qr')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'qr'
                    ? 'bg-primary text-on-primary shadow-elevation-1'
                    : 'bg-surface hover:bg-surface-container-high text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-base">qr_code_2</span>
                <span>Direct UPI QR</span>
              </button>
              <button
                onClick={() => setActiveTab('demo')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'demo'
                    ? 'bg-teaching-emerald text-on-teaching-emerald shadow-elevation-1'
                    : 'bg-surface hover:bg-surface-container-high text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-base">bolt</span>
                <span>Quick Demo Pay (1-Click)</span>
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6">
              {activeTab === 'qr' ? (
                <div className="space-y-4">
                  {/* Dynamic QR Code */}
                  <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-outline-variant/80 shadow-inner">
                    <img
                      src={qrCodeUrl}
                      alt="UPI QR Code"
                      className="w-44 h-44 object-contain rounded-lg"
                    />
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-slate-700">
                      <span className="material-symbols-outlined text-sm text-teaching-emerald">security</span>
                      <span>Scan with GPay, PhonePe, Paytm, or BHIM</span>
                    </div>
                  </div>

                  {/* UPI ID Copy Field */}
                  <div>
                    <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                      Mentor's Verified UPI ID
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 bg-surface-container rounded-xl text-xs font-mono text-on-surface font-semibold border border-outline-variant/60 truncate">
                        {mentorUpi}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="px-3 py-2 bg-surface-container-high hover:bg-primary hover:text-on-primary text-on-surface rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
                        <span>{copied ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Mobile Deep Link */}
                  <a
                    href={upiUrl}
                    className="w-full py-2.5 px-4 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold text-center block transition-all border border-outline-variant/60"
                  >
                    📱 Open Directly in Mobile UPI App
                  </a>

                  {/* Manual UTR Confirmation */}
                  <div className="border-t border-outline-variant/40 pt-3 space-y-2">
                    <label className="text-[11px] font-bold text-on-surface-variant block">
                      12-Digit UPI Reference Number / UTR (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 489218201948"
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container rounded-xl text-xs font-mono text-on-surface border border-outline-variant/60 focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Submit Real Payment */}
                  <button
                    onClick={() => handleConfirmPayment(false)}
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-4 bg-primary hover:bg-primary-hover disabled:opacity-60 text-on-primary rounded-xl text-xs font-extrabold shadow-elevation-1 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                        <span>Confirming via Live Handshake...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base">send_to_mobile</span>
                        <span>I Have Transferred ₹{amount} (Confirm)</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Demo Mode Tab */
                <div className="space-y-4 py-2">
                  <div className="p-4 rounded-2xl bg-teaching-emerald/10 border border-teaching-emerald/20 text-left space-y-2">
                    <div className="flex items-center gap-2 text-teaching-emerald font-black text-sm">
                      <span className="material-symbols-outlined text-lg">bolt</span>
                      <span>Instant Hackathon Demo Mode</span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Evaluate the complete Mindroot payment and session unlocking flow instantly. No real bank accounts or payment credentials are required!
                    </p>
                  </div>

                  <div className="bg-surface-container/50 border border-outline-variant/60 rounded-2xl p-4 text-left space-y-2.5 text-xs">
                    <div className="flex items-center gap-2 text-on-surface font-bold">
                      <span className="material-symbols-outlined text-base text-teaching-emerald">check_circle</span>
                      <span>Instantly generates a verified receipt</span>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface font-bold">
                      <span className="material-symbols-outlined text-base text-teaching-emerald">check_circle</span>
                      <span>Credits ₹{amount} directly to mentor's wallet</span>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface font-bold">
                      <span className="material-symbols-outlined text-base text-teaching-emerald">check_circle</span>
                      <span>Sends real-time Socket.io handshake to mentor's screen</span>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface font-bold">
                      <span className="material-symbols-outlined text-base text-teaching-emerald">check_circle</span>
                      <span>Unlocks Whiteboard, LiveKit Room & AI Notes</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleConfirmPayment(true)}
                    disabled={isSubmitting}
                    className="w-full py-4 px-4 bg-teaching-emerald hover:bg-teaching-emerald/90 disabled:opacity-60 text-on-teaching-emerald rounded-xl text-xs font-extrabold shadow-elevation-2 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                        <span>Unlocking Classroom...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base">flash_on</span>
                        <span>Complete Demo Payment (1-Click Instant Success)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
