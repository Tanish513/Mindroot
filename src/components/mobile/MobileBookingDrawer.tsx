import { useState } from 'react';

interface MobileBookingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mentor: any;
  onConfirm: (mentor: any, paymentMode: 'token' | 'upi') => void;
}

export function MobileBookingDrawer({
  isOpen,
  onClose,
  mentor,
  onConfirm,
}: MobileBookingDrawerProps) {
  const [paymentMode, setPaymentMode] = useState<'token' | 'upi'>('token');
  const selectedSlot = 'Today, 7:30 PM (45 min)';

  if (!isOpen || !mentor) return null;

  const isFreeOrToken = !mentor.hourlyRate || mentor.hourlyRate === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />

      {/* Drawer Card */}
      <div className="relative w-full max-w-lg bg-surface border-t border-border rounded-t-3xl p-5 shadow-2xl z-10 flex flex-col gap-4 animate-in slide-in-from-bottom-6 duration-200 pb-safe">
        {/* Handle pill */}
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-text tracking-tight">
              Book Mentorship Session
            </h3>
            <p className="text-xs text-muted">Reserve 1-on-1 class with verified peer</p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            aria-label="Close booking drawer"
            className="w-8 h-8 rounded-full hover:bg-surface-2 flex items-center justify-center text-muted hover:text-text cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Mentor Preview Card */}
        <div className="bg-surface-2 border border-border rounded-2xl p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Selected Mentor</span>
            <div className="flex items-center gap-1.5">
              <img 
                src={mentor.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&q=80'} 
                alt={mentor.name} 
                className="w-5 h-5 rounded-full object-cover border border-border"
              />
              <span className="text-xs font-bold text-text truncate max-w-[150px]">
                {mentor.name}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Rate Model</span>
            <span className="text-xs font-bold text-primary">
              {isFreeOrToken ? '1 Skill Token (Free Barter)' : `₹${mentor.hourlyRate}/hr or 1 Token`}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Earliest Slot</span>
            <span className="text-xs font-semibold text-text">
              {selectedSlot}
            </span>
          </div>
        </div>

        {/* Payment / Barter Mode Selector */}
        {!isFreeOrToken && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text">Payment Method</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('token')}
                className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                  paymentMode === 'token'
                    ? 'border-primary bg-primary-tint/30 text-primary'
                    : 'border-border bg-surface hover:bg-surface-2 text-muted'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">toll</span>
                  <span>1 Skill Token</span>
                </div>
                <span className="text-[10px] text-muted font-normal block mt-0.5">Free peer barter</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('upi')}
                className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                  paymentMode === 'upi'
                    ? 'border-primary bg-primary-tint/30 text-primary'
                    : 'border-border bg-surface hover:bg-surface-2 text-muted'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">payments</span>
                  <span>Direct UPI</span>
                </div>
                <span className="text-[10px] text-muted font-normal block mt-0.5">₹{mentor.hourlyRate} instant pay</span>
              </button>
            </div>
          </div>
        )}

        {/* Peer Honor Code Guarantee */}
        <p className="text-[11px] text-muted leading-relaxed">
          🛡️ Covered by the <strong className="text-text">Mindroot Peer Honor Code</strong>. Tokens/funds remain held safely until class completion.
        </p>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-border bg-surface-2 text-text text-xs font-bold hover:bg-surface transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(mentor, paymentMode);
              onClose();
            }}
            className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary-hover active:scale-98 text-on-primary text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>Confirm Request</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
