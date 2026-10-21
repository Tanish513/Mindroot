import { useEffect, useState } from 'react';
import { api, onTransactionsUpdated, onSessionsUpdated } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { UpiPaymentModal, type UpiPaymentSession } from '../components/payment/UpiPaymentModal';


export function Wallet() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [peers, setPeers] = useState<any[]>([]);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isPayoutSettingsOpen, setIsPayoutSettingsOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedPeerId, setSelectedPeerId] = useState('');
  const [payAmount, setPayAmount] = useState(499);
  const [payNote, setPayNote] = useState('Tutoring & Mentorship Payment');
  const [isProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<any | null>(null);

  // Direct Peer UPI Modal State
  const [upiModalSession, setUpiModalSession] = useState<UpiPaymentSession | null>(null);
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  
  // Payout & Withdrawal State
  const [payoutAccount, setPayoutAccount] = useState<any>({
    accountHolderName: 'Teacher / Mentor',
    accountNumber: '••••••••4892',
    ifscCode: 'HDFC0001234',
    bankName: 'HDFC Bank',
    upiId: '',
    payoutMethod: 'upi',
    isVerified: false
  });
  const [withdrawAmount, setWithdrawAmount] = useState<number>(1000);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState<any | null>(null);

  const { searchQuery, currentUser, role, loginRole } = useAppStore();

  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'EARNED' | 'SPENT'>('ALL');

  const loadData = () => {
    api.getTransactions().then(setTransactions).catch(console.error);
    api.getSessions().then(sessList => {
      setSessions(sessList);
      // Auto-select mentor from any pending student session
      const pending = sessList.filter((s: any) => {
        const studentEntry = Array.isArray(s.students) ? s.students.find((st: any) => st.id === currentUser?.id) : null;
        if (studentEntry) return studentEntry.paymentStatus !== 'paid';
        return s.studentId === currentUser?.id && s.paymentStatus !== 'paid';
      });
      if (pending.length > 0) {
        const firstSess = pending[0];
        const tId = firstSess.teacherId || firstSess.teacher?.id;
        if (tId) {
          setSelectedPeerId(tId);
          setSelectedSessionId(firstSess.id);
        }
      }
    }).catch(console.error);
    api.getPayoutAccount().then(acc => {
      if (acc) setPayoutAccount(acc);
    }).catch(console.error);
    api.getPeers().then(data => {
      setPeers(data);
      if (data.length > 0 && !selectedPeerId) {
        setSelectedPeerId(data[0].id);
      }
    }).catch(console.error);
  };

  useEffect(() => {
    loadData();
    // Live multi-device synchronization for transactions & sessions
    const unsubscribeTx = onTransactionsUpdated((txs) => {
      if (Array.isArray(txs)) {
        setTransactions(txs);
      }
    });
    const unsubscribeSess = onSessionsUpdated((sess) => {
      if (Array.isArray(sess)) {
        setSessions(sess);
      }
    });
    return () => {
      unsubscribeTx();
      unsubscribeSess();
    };
  }, []);

  const handlePaySessionDirect = (session: any) => {
    const amount = session.pricePerStudent || session.amount || session.teacher?.hourlyRate || 499;
    const teacherId = session.teacherId || session.teacher?.id || selectedPeerId;
    const targetPeer = peers.find(p => p.id === teacherId) || session.teacher || { id: teacherId, name: 'Mentor' };

    setUpiModalSession({
      id: session.id,
      title: session.title || 'Mentoring Session',
      amount,
      teacherId,
      teacherName: targetPeer.name,
      teacherAvatar: targetPeer.avatar,
      teacherUpiId: targetPeer.upiId
    });
    setIsUpiModalOpen(true);
  };

  const handleDirectPayMentor = () => {
    const selectedPeer = peers.find(p => p.id === selectedPeerId);
    if (!selectedPeer) return;

    let effectiveSessionId = selectedSessionId;
    if (!effectiveSessionId) {
      const matchSess = pendingStudentSessions.find((s: any) => (s.teacherId === selectedPeer.id || s.teacher?.id === selectedPeer.id));
      if (matchSess) effectiveSessionId = matchSess.id;
    }

    setIsPayModalOpen(false);
    setUpiModalSession({
      id: effectiveSessionId || undefined,
      title: payNote || `Direct Mentoring Payment to ${selectedPeer.name}`,
      amount: payAmount,
      teacherId: selectedPeer.id,
      teacherName: selectedPeer.name,
      teacherAvatar: selectedPeer.avatar,
      teacherUpiId: selectedPeer.upiId
    });
    setIsUpiModalOpen(true);
  };

  const handleWithdrawFunds = async () => {
    if (withdrawAmount <= 0) return;
    setIsWithdrawing(true);
    try {
      const res = await api.withdrawEarnings({
        userId: currentUser?.id || 'user-maya',
        amount: withdrawAmount,
        payoutNote: `Teacher earnings withdrawal to ${payoutAccount.payoutMethod === 'upi' ? payoutAccount.upiId : payoutAccount.accountNumber}`
      });

      setWithdrawSuccess({
        amount: withdrawAmount,
        account: payoutAccount,
        payoutId: res.payout?.paymentId || `pout_${Date.now()}`,
        date: new Date().toISOString()
      });
      loadData();
    } catch (err) {
      console.error('Failed to withdraw funds:', err);
      alert('Withdrawal request failed. Please try again.');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleWalletQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("QR Code image exceeds 5MB. Please choose a smaller photo.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setPayoutAccount((prev: any) => ({ ...prev, upiQrImage: reader.result }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePayoutSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payoutAccount.payoutMethod === 'upi') {
      const cleanUpi = (payoutAccount.upiId || '').trim();
      const vpaRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
      if (!cleanUpi || !vpaRegex.test(cleanUpi)) {
        alert('Invalid UPI ID / VPA format. Must be formatted like name@bank (e.g. username@okhdfcbank or mobile@paytm).');
        return;
      }
    }
    try {
      await api.savePayoutAccount({
        userId: currentUser?.id || 'user-maya',
        ...payoutAccount,
        upiId: (payoutAccount.upiId || '').trim()
      });
      setIsPayoutSettingsOpen(false);
      alert('Bank Account & Payout settings updated successfully!');
    } catch (err) {
      console.error('Failed to save payout settings:', err);
    }
  };

  const isTeacherRole = role === 'teacher';
  const isStudentRole = role === 'student' && loginRole !== 'teacher';
  const isBothRole = loginRole === 'both';

  // Role-filtered transactions (strictly for current logged-in user)
  const earnedList = transactions.filter(t => 
    t.type === 'EARNED' && t.userId === currentUser?.id
  );
  const spentList = transactions.filter(t => 
    t.type === 'SPENT' && t.userId === currentUser?.id
  );

  // Student pending session payments (How much payment is left to pay)
  const pendingStudentSessions = sessions.filter(s => {
    const studentEntry = Array.isArray(s.students) ? s.students.find((st: any) => st.id === currentUser?.id) : null;
    if (studentEntry) {
      return studentEntry.paymentStatus !== 'paid';
    }
    const isDirectStudent = s.studentId === currentUser?.id;
    return isDirectStudent && s.paymentStatus !== 'paid';
  });

  const pendingDue = pendingStudentSessions.reduce((sum, s) => {
    const studentEntry = Array.isArray(s.students) ? s.students.find((st: any) => st.id === currentUser?.id) : null;
    if (studentEntry && typeof studentEntry.amountDue === 'number' && studentEntry.amountDue >= 0) {
      return sum + studentEntry.amountDue;
    }
    return sum + (Number(s.pricePerStudent) || Number(s.amount) || 499);
  }, 0);

  const userTransactions = transactions.filter(tx => 
    currentUser?.role === 'admin' || tx.userId === currentUser?.id
  );

  const filteredTransactions = userTransactions.filter(tx => {
    if (activeTab === 'EARNED' && tx.type !== 'EARNED') return false;
    if (activeTab === 'SPENT' && tx.type !== 'SPENT') return false;
    if (searchQuery.trim() === '') return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = tx.title?.toLowerCase().includes(query) || tx.description?.toLowerCase().includes(query);
    const peerMatch = tx.peerName?.toLowerCase().includes(query);
    const typeMatch = tx.type?.toLowerCase().includes(query);
    const payMatch = tx.paymentId?.toLowerCase().includes(query);
    return titleMatch || peerMatch || typeMatch || payMatch;
  });

  const totalEarned = earnedList.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const totalSpent = spentList.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const availableBalance = Math.max(0, totalEarned - totalSpent);

  const selectedPeerObj = peers.find(p => p.id === selectedPeerId);

  return (
    <div className="max-w-container_max mx-auto space-y-6 select-none">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-text tracking-tight">
            {isTeacherRole 
              ? 'Mentoring Revenue & Earnings Wallet' 
              : (isStudentRole ? 'Payments & Tuition Wallet' : 'Payments & Earnings Wallet')}
          </h2>
          <p className="text-xs sm:text-sm text-muted font-medium mt-1">
            {isTeacherRole
              ? 'Track your mentoring revenue, manage your linked bank account / UPI, and withdraw earnings directly.'
              : (isStudentRole 
                  ? 'Track your mentoring lesson payments and pay mentors directly via UPI.' 
                  : 'Track mentoring revenue, lesson payments, manage your linked bank account / UPI, and withdraw earnings directly.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {(isTeacherRole || isBothRole) && (
            <>
              <button
                onClick={() => setIsPayoutSettingsOpen(true)}
                className="px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-surface-2 text-text font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all"
                title="Configure Bank Account & UPI for payouts"
              >
                <span className="material-symbols-outlined text-base text-muted">account_balance</span>
                Bank / UPI Settings
              </button>

              <Button
                variant="secondary"
                onClick={() => {
                  setWithdrawSuccess(null);
                  setWithdrawAmount(availableBalance > 0 ? Math.min(availableBalance, 2000) : 500);
                  setIsWithdrawModalOpen(true);
                }}
                className="bg-primary-tint text-primary-text border border-primary/20 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base text-primary">account_balance_wallet</span>
                Withdraw to Bank
              </Button>
            </>
          )}

          <Button 
            variant="primary"
            onClick={() => {
              setPaymentSuccess(null);
              setIsPayModalOpen(true);
            }}
            className="font-extrabold text-xs px-4 py-2 rounded-xl shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">send_money</span>
            Pay Mentor Directly
          </Button>
        </div>
      </header>

      {/* Bento Grid: Role-Aware Layout */}
      {isStudentRole ? (
        /* STUDENT BENTO GRID */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Spent Card */}
          <div 
            onClick={() => setActiveTab('SPENT')}
            className={`bg-surface border rounded-xl p-5 shadow-sm flex flex-col justify-between h-44 cursor-pointer transition-all ${activeTab === 'SPENT' ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-bold text-muted">Total Mentoring Fees Paid</p>
                <h3 className="text-2xl sm:text-3xl font-bold text-primary mt-1">₹{totalSpent.toLocaleString('en-IN')}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-tint border border-primary/20 text-primary-text flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">shopping_cart</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-primary">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">receipt_long</span>
                {spentList.length} session payment{spentList.length !== 1 ? 's' : ''} recorded
              </span>
              <span className="text-[10px] bg-primary-tint text-primary-text px-2 py-0.5 rounded-full font-extrabold">
                Payment history
              </span>
            </div>
          </div>

          {/* Payment Left / Pending Due Card */}
          <div 
            className="bg-surface border border-border hover:border-accent/40 rounded-xl p-5 shadow-sm flex flex-col justify-between h-44 transition-all"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-muted">Payment Left / Due</p>
                  {pendingDue > 0 && <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />}
                </div>
                <h3 className={`text-2xl sm:text-3xl font-bold mt-1 ${pendingDue > 0 ? 'text-accent-text' : 'text-text'}`}>
                  ₹{pendingDue.toLocaleString('en-IN')}
                </h3>
                <p className="text-[11px] text-muted font-medium mt-0.5">
                  {pendingStudentSessions.length > 0 ? `${pendingStudentSessions.length} session(s) pending post-lecture payment` : 'All sessions fully paid & settled'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-accent-tint border border-accent/20 text-accent-text flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">pending_actions</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-accent-text border-t border-border pt-2">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">schedule</span>
                {pendingDue > 0 ? 'Pay After Class' : 'No Pending Due'}
              </span>
              {pendingDue > 0 && (
                <button onClick={() => setIsPayModalOpen(true)} className="text-[11px] text-primary font-bold hover:underline">
                  Pay Now →
                </button>
              )}
            </div>
          </div>

          {/* Pay Directly via UPI Card */}
          <div className="bg-surface-2 border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between text-left h-44">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-wider">
                  <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
                  Pay Directly via UPI
                </div>
                <span className="px-2 py-0.5 bg-primary text-on-primary rounded text-[10px] font-bold">UPI</span>
              </div>
              <p className="text-xs text-muted font-medium">
                Pay your mentor after each session using any UPI app. No upfront fees.
              </p>
            </div>
            <div className="text-[11px] font-mono text-muted flex items-center justify-between pt-2 border-t border-border">
              <span>How it works</span>
              <span className="font-bold text-text">Pay mentor directly</span>
            </div>
          </div>
        </div>
      ) : (
        /* TEACHER & BOTH BENTO GRID */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Earned Card */}
          <div 
            onClick={() => setActiveTab('EARNED')}
            className={`bg-surface border rounded-xl p-5 shadow-sm flex flex-col justify-between h-44 cursor-pointer transition-all ${activeTab === 'EARNED' ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-bold text-muted">Total Mentoring Revenue</p>
                <h3 className="text-2xl sm:text-3xl font-bold text-primary mt-1">₹{totalEarned.toLocaleString('en-IN')}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-tint border border-primary/20 text-primary-text flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">payments</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-primary">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                {earnedList.length} student payouts
              </span>
              <span className="text-[10px] bg-primary-tint text-primary-text px-2 py-0.5 rounded-full font-extrabold border border-primary/20">
                Ready for Payout
              </span>
            </div>
          </div>

          {/* Linked Bank / UPI Account Status or Spent in Both */}
          {isBothRole ? (
            <div 
              onClick={() => setActiveTab('SPENT')}
              className={`bg-surface border rounded-xl p-5 shadow-sm flex flex-col justify-between h-44 cursor-pointer transition-all ${activeTab === 'SPENT' ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-bold text-muted">Total Spent on Learning</p>
                  <h3 className="text-2xl sm:text-3xl font-bold text-primary mt-1">₹{totalSpent.toLocaleString('en-IN')}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary-tint border border-primary/20 text-primary-text flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">shopping_cart</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-primary">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">receipt_long</span>
                  {spentList.length} sessions paid
                </span>
                <span className="text-[10px] bg-primary-tint text-primary-text px-2 py-0.5 rounded-full font-extrabold border border-primary/20">
                  Net: ₹{availableBalance.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setIsPayoutSettingsOpen(true)}
              className="bg-surface border border-border hover:border-primary/40 rounded-xl p-5 shadow-sm flex flex-col justify-between h-44 cursor-pointer transition-all"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] uppercase tracking-wider font-bold text-muted">Teacher Payout Account</p>
                    <span className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  <h3 className="text-base font-bold text-text mt-1 truncate max-w-[200px]">
                    {payoutAccount.payoutMethod === 'upi' ? payoutAccount.upiId : `${payoutAccount.bankName} (${payoutAccount.accountNumber})`}
                  </h3>
                  <p className="text-[11px] text-muted font-medium mt-0.5">{payoutAccount.accountHolderName}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary-tint border border-primary/20 text-primary-text flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">account_balance</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-primary border-t border-border pt-2">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">verified_user</span>
                  UPI / Bank Linked
                </span>
                <span className="text-[11px] text-primary font-bold hover:underline">Edit details →</span>
              </div>
            </div>
          )}

          {/* Direct Mentor Payouts Card */}
          <div className="bg-surface-2 border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between text-left h-44">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-wider">
                  <span className="material-symbols-outlined text-sm">payments</span>
                  Direct Mentor Payouts
                </div>
                <span className="px-2 py-0.5 bg-primary text-on-primary rounded text-[10px] font-bold">Direct UPI</span>
              </div>
              <p className="text-xs text-muted font-medium">Receive direct UPI and bank settlements from students upon lesson completion.</p>
            </div>
            <div className="text-[11px] font-mono text-muted flex items-center justify-between pt-2 border-t border-border">
              <span>Settlement:</span>
              <span className="font-bold text-text">Direct P2P Transfer</span>
            </div>
          </div>
        </div>
      )}

      {/* Direct Payment Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-surface rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-lg border border-border space-y-5 text-text">
            {!paymentSuccess ? (
              <>
                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary-tint text-primary-text flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-xl">payments</span>
                    </div>
                    <div>
                      <h3 className="text-base font-black text-text">Pay Mentor Directly</h3>
                      <p className="text-[11px] text-muted">Fast, direct transfer via UPI</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsPayModalOpen(false)}
                    className="text-muted hover:text-text p-1 rounded-lg"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                {/* Pending Session Linker (if applicable) */}
                {pendingStudentSessions.length > 0 && (
                  <div className="space-y-1.5 bg-accent-tint p-3 rounded-2xl border border-accent/20">
                    <label className="block text-xs font-bold text-accent-text">Settle Unpaid Lecture (Optional)</label>
                    <select
                      value={selectedSessionId || ''}
                      onChange={(e) => {
                        const sId = e.target.value;
                        setSelectedSessionId(sId || null);
                        if (sId) {
                          const sess = pendingStudentSessions.find((s: any) => s.id === sId);
                          if (sess) {
                            const tId = sess.teacherId || sess.teacher?.id;
                            if (tId) setSelectedPeerId(tId);
                            setPayAmount(sess.pricePerStudent || sess.amount || 499);
                            setPayNote(`Mentoring Fee: ${sess.title}`);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-xs font-bold text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Custom Direct Transfer (Not tied to a booked lecture)</option>
                      {pendingStudentSessions.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          Settle: {s.title} ({s.teacher?.name || 'Mentor'} — ₹{s.pricePerStudent || s.amount || 499})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Mentor Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-text">Select Mentor / Teacher</label>
                  <select
                    value={selectedPeerId}
                    onChange={(e) => {
                      setSelectedPeerId(e.target.value);
                      const p = peers.find(peer => peer.id === e.target.value);
                      if (p?.hourlyRate && !selectedSessionId) setPayAmount(p.hourlyRate);
                    }}
                    className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {peers.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ₹{p.hourlyRate || 499}/hr ({p.skillsTaught?.join(', ') || 'Mentor'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick Amount Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-text">Amount (₹ INR)</label>
                  <div className="flex gap-2 mb-2">
                    {[299, 499, 799, 999].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setPayAmount(amt)}
                        className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg border transition-all ${payAmount === amt ? 'bg-primary text-on-primary border-primary shadow-sm' : 'bg-surface-2 border-border text-muted hover:bg-surface'}`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={50}
                    max={50000}
                    step={50}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs font-bold text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Enter custom amount in ₹"
                  />
                </div>

                {/* Purpose Note */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-text">Payment Note / Purpose</label>
                  <input
                    type="text"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="e.g. Tutoring session fee, bonus tip..."
                    className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Summary Box */}
                <div className="p-4 bg-surface-2 border border-border rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between font-medium text-muted">
                    <span>Recipient Mentor:</span>
                    <span className="font-bold text-text">{selectedPeerObj?.name || 'Selected Mentor'}</span>
                  </div>
                  <div className="flex justify-between font-medium text-muted">
                    <span>Payment Gateway:</span>
                    <span className="font-bold text-primary">Direct UPI Transfer</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-black text-sm text-text">
                    <span>Total Amount:</span>
                    <span className="text-primary text-base">₹{payAmount}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="secondary" 
                    className="flex-1 py-2.5 text-xs font-bold"
                    onClick={() => setIsPayModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="primary" 
                    disabled={isProcessing || payAmount < 50}
                    className="flex-1 py-2.5 font-extrabold text-xs shadow-sm flex items-center justify-center gap-2"
                    onClick={handleDirectPayMentor}
                  >
                    {isProcessing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin"></span>
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">lock</span>
                        Pay ₹{payAmount} via UPI
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              /* Success Confirmation */
              <div className="text-center py-4 space-y-4">
                <div className="w-14 h-14 rounded-full bg-primary-tint text-primary-text flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-3xl">verified</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-text">Payment Successful!</h3>
                  <p className="text-xs text-muted mt-1">
                    Successfully sent <strong className="text-primary font-bold">₹{paymentSuccess.amount}</strong> to <strong className="text-text">{paymentSuccess.mentorName}</strong>.
                  </p>
                </div>
                <div className="p-3.5 bg-surface-2 border border-border rounded-xl text-left font-mono text-[11px] text-muted space-y-1">
                  <p><strong>Ref ID:</strong> {paymentSuccess.paymentId}</p>
                  <p><strong>Status:</strong> <span className="text-primary font-bold">PAID & SETTLED</span></p>
                  <p><strong>Note:</strong> {paymentSuccess.note}</p>
                </div>
                <Button 
                  variant="primary" 
                  className="w-full py-2.5 text-xs font-bold"
                  onClick={() => setIsPayModalOpen(false)}
                >
                  Done & View Wallet
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Withdraw to Bank Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface rounded-3xl max-w-md w-full p-6 shadow-lg border border-border space-y-5 text-text animate-in zoom-in-95 duration-150">
            {!withdrawSuccess ? (
              <>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary-tint text-primary-text border border-primary/20 flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                    </div>
                    <div>
                      <h3 className="text-base font-black text-text">Withdraw Earnings [Simulated Demo Payout]</h3>
                      <p className="text-[11px] text-muted">Instant IMPS / UPI payout (Demo Simulation)</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsWithdrawModalOpen(false)}
                    className="text-muted hover:text-text p-1 rounded-lg"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                {/* Destination Account Card */}
                <div className="p-3.5 bg-surface-2 border border-border rounded-2xl space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-muted font-medium">
                    <span>Payout Destination:</span>
                    <button 
                      onClick={() => {
                        setIsWithdrawModalOpen(false);
                        setIsPayoutSettingsOpen(true);
                      }} 
                      className="text-primary-text font-bold hover:underline"
                    >
                      Change
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-text font-bold text-sm">
                    <span className="material-symbols-outlined text-primary-text text-base">
                      {payoutAccount.payoutMethod === 'upi' ? 'qr_code_2' : 'account_balance'}
                    </span>
                    <span>
                      {payoutAccount.payoutMethod === 'upi' 
                        ? payoutAccount.upiId 
                        : `${payoutAccount.bankName} (${payoutAccount.accountNumber})`}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">Beneficiary: {payoutAccount.accountHolderName}</p>
                </div>

                {/* Amount input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-text">Withdrawal Amount (₹ INR)</label>
                    <span className="text-[11px] text-muted">Available: <strong className="text-primary-text font-bold">₹{totalEarned}</strong></span>
                  </div>
                  <div className="flex gap-2 mb-2">
                    {[500, 1000, 2500, 5000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setWithdrawAmount(amt)}
                        className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg border transition-all ${withdrawAmount === amt ? 'bg-primary text-on-primary border-primary shadow-sm' : 'bg-surface-2 border-border text-muted hover:bg-surface'}`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={100}
                    max={50000}
                    step={100}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs font-bold text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Enter amount to withdraw"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="secondary" 
                    className="flex-1 py-2.5 text-xs font-bold"
                    onClick={() => setIsWithdrawModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="primary" 
                    disabled={isWithdrawing || withdrawAmount < 100}
                    className="flex-1 py-2.5 font-extrabold text-xs shadow-sm flex items-center justify-center gap-2"
                    onClick={handleWithdrawFunds}
                  >
                    {isWithdrawing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin"></span>
                        Transferring to Bank...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">send</span>
                        Transfer ₹{withdrawAmount} Now
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              /* Success Confirmation */
              <div className="text-center py-4 space-y-4">
                <div className="w-14 h-14 rounded-full bg-primary-tint text-primary-text border border-primary/20 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-text">Payout Transferred! [Simulated Demo]</h3>
                  <p className="text-xs text-muted mt-1">
                    Successfully simulated transfer of <strong className="text-primary-text font-bold">₹{withdrawSuccess.amount}</strong> to your bank/UPI account.
                  </p>
                </div>
                <div className="p-3.5 bg-surface-2 border border-border rounded-xl text-left font-mono text-[11px] text-muted space-y-1">
                  <p><strong>Payout Ref:</strong> {withdrawSuccess.payoutId}</p>
                  <p><strong>Destination:</strong> {withdrawSuccess.account.payoutMethod === 'upi' ? withdrawSuccess.account.upiId : withdrawSuccess.account.accountNumber}</p>
                  <p><strong>Status:</strong> <span className="text-primary-text font-bold">CREDITED & SETTLED (IMPS)</span></p>
                </div>
                <Button 
                  variant="primary" 
                  className="w-full py-2.5 text-xs font-bold"
                  onClick={() => setIsWithdrawModalOpen(false)}
                >
                  Done & Close
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bank & UPI Settings Modal */}
      {isPayoutSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface rounded-3xl max-w-md w-full p-6 shadow-lg border border-border space-y-5 text-text animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-tint text-primary-text border border-primary/20 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">account_balance</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-text">Teacher Bank / UPI Details</h3>
                  <p className="text-[11px] text-muted">Configure where you receive student payments</p>
                </div>
              </div>
              <button 
                onClick={() => setIsPayoutSettingsOpen(false)}
                className="text-muted hover:text-text p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSavePayoutSettings} className="space-y-4">
              {/* Method Toggle */}
              <div className="flex rounded-xl bg-surface-2 p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setPayoutAccount({ ...payoutAccount, payoutMethod: 'upi' })}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${payoutAccount.payoutMethod === 'upi' ? 'bg-surface text-text shadow-sm font-extrabold' : 'text-muted'}`}
                >
                  UPI ID (VPA)
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutAccount({ ...payoutAccount, payoutMethod: 'bank' })}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${payoutAccount.payoutMethod === 'bank' ? 'bg-surface text-text shadow-sm font-extrabold' : 'text-muted'}`}
                >
                  Bank Account (IFSC)
                </button>
              </div>

              {/* Beneficiary Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-text">Account Holder / Beneficiary Name</label>
                <input
                  type="text"
                  required
                  value={payoutAccount.accountHolderName}
                  onChange={e => setPayoutAccount({ ...payoutAccount, accountHolderName: e.target.value })}
                  placeholder="e.g. Maya Sharma"
                  className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs font-bold text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {payoutAccount.payoutMethod === 'upi' ? (
                /* UPI ID & QR Code */
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-text">UPI ID / VPA</label>
                    <input
                      type="text"
                      required
                      value={payoutAccount.upiId}
                      onChange={e => setPayoutAccount({ ...payoutAccount, upiId: e.target.value })}
                      placeholder="e.g. yourname@okhdfcbank or 9876543210@paytm"
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs font-bold text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="text-[10px] text-muted">Supports Google Pay, PhonePe, Paytm, BHIM, and all bank UPI apps.</p>
                  </div>

                  {/* Upload Custom UPI QR */}
                  <div className="space-y-1.5 p-3 bg-surface-2 border border-dashed border-border rounded-xl">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-text">Official UPI QR Code</label>
                      {payoutAccount.upiQrImage && (
                        <span className="text-[10px] font-bold text-primary-text flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-xs">check_circle</span> Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {payoutAccount.upiQrImage ? (
                        <div className="relative group shrink-0">
                          <img
                            src={payoutAccount.upiQrImage}
                            alt="Teacher UPI QR"
                            className="w-16 h-16 object-contain rounded-lg border border-border bg-white p-1 shadow-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setPayoutAccount((prev: any) => ({ ...prev, upiQrImage: null }))}
                            className="absolute -top-1.5 -right-1.5 bg-danger text-white rounded-full p-0.5 shadow hover:scale-110 transition-all"
                            title="Remove QR"
                          >
                            <span className="material-symbols-outlined text-[10px]">close</span>
                          </button>
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-surface-2 flex items-center justify-center text-muted shrink-0">
                          <span className="material-symbols-outlined text-xl text-primary-text">qr_code_2</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          id="wallet-qr-upload"
                          accept="image/*"
                          onChange={handleWalletQrUpload}
                          className="hidden"
                        />
                        <label
                          htmlFor="wallet-qr-upload"
                          className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 bg-primary-tint hover:bg-primary-tint/80 text-primary-text border border-primary/20 rounded-lg text-xs font-bold transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">upload</span>
                          <span>{payoutAccount.upiQrImage ? 'Change QR Image' : 'Upload QR Screenshot'}</span>
                        </label>
                        <p className="text-[10px] text-muted mt-0.5">
                          Students scan this exact QR to pay for direct sessions.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ID Verification Status Pill */}
                  <div className="p-2.5 bg-surface-2 rounded-xl flex items-center justify-between text-xs border border-border">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary-text text-base">
                        {payoutAccount.officialIdStatus === 'verified' || currentUser?.officialIdStatus === 'verified' ? 'verified_user' : 'badge'}
                      </span>
                      <div>
                        <p className="font-bold text-text text-[11px]">
                          {payoutAccount.officialIdStatus === 'verified' || currentUser?.officialIdStatus === 'verified'
                            ? 'Official Teacher ID Verified'
                            : 'Official ID Pending / Unverified'}
                        </p>
                        <p className="text-[10px] text-muted">
                          {payoutAccount.officialIdStatus === 'verified' || currentUser?.officialIdStatus === 'verified'
                            ? 'Your credentials display a verified trust badge'
                            : 'Upload student/faculty card in Profile for trust badge'}
                        </p>
                      </div>
                    </div>
                    {(payoutAccount.officialIdStatus === 'verified' || currentUser?.officialIdStatus === 'verified') && (
                      <span className="px-1.5 py-0.5 rounded bg-primary-tint text-primary-text border border-primary/20 text-[9px] font-black uppercase">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* Bank Account Details */
                <>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-text">Bank Name</label>
                    <input
                      type="text"
                      required
                      value={payoutAccount.bankName}
                      onChange={e => setPayoutAccount({ ...payoutAccount, bankName: e.target.value })}
                      placeholder="e.g. HDFC Bank, SBI, ICICI"
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs font-bold text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-text">Account Number</label>
                    <input
                      type="text"
                      required
                      value={payoutAccount.accountNumber}
                      onChange={e => setPayoutAccount({ ...payoutAccount, accountNumber: e.target.value })}
                      placeholder="e.g. 501002348921"
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs font-bold text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-text">IFSC Code</label>
                    <input
                      type="text"
                      required
                      value={payoutAccount.ifscCode}
                      onChange={e => setPayoutAccount({ ...payoutAccount, ifscCode: e.target.value.toUpperCase() })}
                      placeholder="e.g. HDFC0001234"
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs font-bold text-text uppercase focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="secondary" 
                  className="flex-1 py-2.5 text-xs font-bold"
                  onClick={() => setIsPayoutSettingsOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  className="flex-1 py-2.5 font-extrabold text-xs shadow-sm flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  Save Details
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface rounded-3xl max-w-md w-full p-6 shadow-lg border border-border space-y-5 text-text animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary" />
                <h3 className="text-sm font-bold text-text">Payment Receipt</h3>
              </div>
              <button 
                onClick={() => setSelectedReceipt(null)}
                className="text-muted hover:text-text p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="text-center py-2 space-y-1">
              <p className="text-xs text-muted font-medium">{selectedReceipt.title}</p>
              <h2 className="text-3xl font-extrabold text-text">₹{selectedReceipt.amount}</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary-tint border border-primary/20 text-primary-text rounded-full text-[11px] font-bold">
                <span className="material-symbols-outlined text-xs">verified</span>
                Payment Verified & Settled
              </span>
            </div>

            <div className="bg-surface-2 border border-border rounded-2xl p-4 font-mono text-xs space-y-2 text-muted">
              <div className="flex justify-between">
                <span className="text-muted">Payment ID:</span>
                <span className="font-bold text-text">{selectedReceipt.paymentId || 'pay_sim_001'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Transaction Type:</span>
                <span className="font-bold text-primary-text">{selectedReceipt.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Peer:</span>
                <span className="font-bold text-text">{selectedReceipt.peerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Date & Time:</span>
                <span>{new Date(selectedReceipt.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Gateway:</span>
                <span className="font-bold text-primary-text">Direct UPI / Bank Transfer</span>
              </div>
            </div>

            <Button 
              variant="primary" 
              className="w-full py-2.5 text-xs font-bold"
              onClick={() => setSelectedReceipt(null)}
            >
              Close Receipt
            </Button>
          </div>
        </div>
      )}

      {/* Unpaid Sessions / Pending Post-Lecture Dues Section for Students */}
      {isStudentRole && pendingStudentSessions.length > 0 && (
        <section className="bg-accent-tint border border-accent/20 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              <h3 className="font-extrabold text-sm text-accent-text">Pending Post-Lecture Sessions ({pendingStudentSessions.length})</h3>
            </div>
            <span className="text-xs font-bold text-accent-text">Total Due: ₹{pendingDue}</span>
          </div>
          <p className="text-xs text-accent-text/80 font-medium">
            These mentoring sessions are pending payment settlement. Click below to pay the mentor directly via UPI.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {pendingStudentSessions.map((sess: any) => {
              const teacherName = sess.teacher?.name || 'Mentor';
              const amt = sess.pricePerStudent || sess.amount || 499;
              return (
                <div key={sess.id} className="bg-surface rounded-xl p-4 border border-border shadow-sm flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex justify-between items-start">
                      <p className="font-extrabold text-xs text-text truncate max-w-[200px]">{sess.title}</p>
                      <span className="font-black text-sm text-primary-text">₹{amt}</span>
                    </div>
                    <p className="text-[11px] text-muted font-semibold mt-0.5">Teacher: {teacherName}</p>
                  </div>
                  <button
                    onClick={() => handlePaySessionDirect(sess)}
                    disabled={isProcessing}
                    className="w-full py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-lg text-xs font-extrabold shadow-sm transition-all active:scale-98 flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px]">payments</span>
                    <span>Pay ₹{amt} to {teacherName} via UPI</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Transaction History */}
      <section className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-2">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-text">Payment & Transaction Receipts</h3>
            <span className="text-xs text-muted font-semibold bg-surface px-2 py-0.5 rounded-full border border-border">{filteredTransactions.length} records</span>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl text-xs font-bold border border-border">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1 rounded-lg transition-all ${activeTab === 'ALL' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
            >
              All ({transactions.length})
            </button>
            <button
              onClick={() => setActiveTab('EARNED')}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${activeTab === 'EARNED' ? 'bg-surface text-primary-text shadow-sm font-extrabold' : 'text-muted hover:text-text'}`}
            >
              <span className="material-symbols-outlined text-xs text-primary-text">payments</span>
              Received ({earnedList.length})
            </button>
            <button
              onClick={() => setActiveTab('SPENT')}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${activeTab === 'SPENT' ? 'bg-surface text-primary-text shadow-sm font-extrabold' : 'text-muted hover:text-text'}`}
            >
              <span className="material-symbols-outlined text-xs text-primary-text">shopping_cart</span>
              Paid ({spentList.length})
            </button>
          </div>
        </div>
        <div className="divide-y divide-border">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted font-semibold">No payment transactions recorded in this view.</div>
          ) : (
            filteredTransactions.map((tx, i) => (
            <div 
              key={i} 
              onClick={() => setSelectedReceipt(tx)}
              className="px-5 py-3.5 flex items-center justify-between hover:bg-surface-2 transition-colors cursor-pointer group"
              title="Click to view full payment receipt"
            >
              <div className="flex items-center gap-3.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${tx.type === 'EARNED' ? 'bg-primary-tint text-primary-text border border-primary/20' : 'bg-surface-2 text-muted border border-border'}`}> 
                  <span className="material-symbols-outlined text-lg font-bold">
                    {tx.type === 'EARNED' ? 'arrow_downward' : 'arrow_upward'}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-xs text-text group-hover:text-primary-text transition-colors">
                    {tx.title || (tx.type === 'EARNED' ? `Mentoring Payout` : `Session Payment`)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted font-medium mt-0.5">
                    <span>{tx.type === 'EARNED' ? `From: ${tx.peerName}` : `To: ${tx.peerName}`}</span>
                    <span>•</span>
                    <span>{new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    {tx.paymentId && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-[10px] bg-surface-2 text-muted px-1.5 py-0.5 rounded border border-border">
                          {tx.paymentId}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-black text-xs ${tx.type === 'EARNED' ? 'text-primary-text' : 'text-text'}`}> 
                  {tx.type === 'EARNED' ? `+₹${tx.amount}` : `-₹${tx.amount}` }
                </p>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 ${tx.type === 'EARNED' ? 'bg-primary-tint text-primary-text border border-primary/20' : 'bg-surface-2 text-muted border border-border'}`}>
                  {tx.type === 'EARNED' ? 'Revenue Received' : 'Paid via UPI'}
                </span>
              </div>
            </div>
            ))
          )}
        </div>
      </section>

      {/* Direct Peer-to-Peer UPI Payment Modal */}
      <UpiPaymentModal
        isOpen={isUpiModalOpen}
        onClose={() => {
          setIsUpiModalOpen(false);
          setUpiModalSession(null);
        }}
        session={upiModalSession}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
}
