import { useEffect, useState } from 'react';
import { api, onTransactionsUpdated, onSessionsUpdated } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';

declare global {
  interface Window {
    Razorpay: any;
  }
}

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<any | null>(null);
  
  // Payout & Withdrawal State
  const [payoutAccount, setPayoutAccount] = useState<any>({
    accountHolderName: 'Teacher / Mentor',
    accountNumber: '••••••••4892',
    ifscCode: 'HDFC0001234',
    bankName: 'HDFC Bank',
    upiId: 'mentor@okhdfcbank',
    payoutMethod: 'upi',
    isVerified: true
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

  const loadRazorpaySDK = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePaySessionDirect = async (session: any) => {
    const amount = session.pricePerStudent || session.amount || session.teacher?.hourlyRate || 499;
    const teacherId = session.teacherId || session.teacher?.id || selectedPeerId;
    const targetPeer = peers.find(p => p.id === teacherId) || session.teacher || { id: teacherId, name: 'Mentor' };

    setSelectedSessionId(session.id);
    setSelectedPeerId(teacherId);
    setPayAmount(amount);
    setPayNote(`Fee for: ${session.title || 'Mentoring Session'}`);

    setIsProcessing(true);
    try {
      const sdkLoaded = await loadRazorpaySDK();
      if (!sdkLoaded) {
        alert('Could not load Razorpay checkout SDK. Please check your internet connection.');
        setIsProcessing(false);
        return;
      }

      const orderData = await api.createSessionPaymentOrder({
        sessionId: session.id,
        teacherId,
        mentorId: teacherId,
        studentId: currentUser?.id || 'student-id',
        amount,
        title: session.title
      });

      const options = {
        key: orderData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TUrtuundUxD7Jh',
        amount: orderData.amountInPaise || (amount * 100),
        currency: orderData.currency || 'INR',
        name: 'Mindroot Skill Exchange',
        description: `Mentoring Fee: ${session.title || 'Mentoring Session'}`,
        image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            await api.verifySessionPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount,
              sessionData: {
                sessionId: session.id,
                title: session.title,
                teacherId,
                teacherName: targetPeer.name,
                studentId: currentUser?.id || 'student-id',
                studentName: currentUser?.name || 'Student'
              }
            });

            await api.patchSession(session.id, { paymentStatus: 'paid', paymentId: response.razorpay_payment_id });

            setPaymentSuccess({
              paymentId: response.razorpay_payment_id,
              mentorName: targetPeer.name,
              amount,
              note: session.title
            });
            loadData();
          } catch (err: any) {
            console.error('Payment verification failed:', err);
            loadData();
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: currentUser?.name || 'Student',
          email: currentUser?.email || 'student@mindroot.edu',
          contact: '9999999999'
        },
        theme: {
          color: '#2563eb'
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
          }
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      console.error('Payment initialization error:', err);
      alert('Failed to launch Razorpay checkout. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleDirectPayMentor = async () => {
    const selectedPeer = peers.find(p => p.id === selectedPeerId);
    if (!selectedPeer) return;

    // Check if there is a matching pending session for selected peer
    let effectiveSessionId = selectedSessionId;
    if (!effectiveSessionId) {
      const matchSess = pendingStudentSessions.find((s: any) => (s.teacherId === selectedPeer.id || s.teacher?.id === selectedPeer.id));
      if (matchSess) effectiveSessionId = matchSess.id;
    }

    setIsProcessing(true);
    try {
      const sdkLoaded = await loadRazorpaySDK();
      if (!sdkLoaded) {
        alert('Could not load Razorpay checkout SDK. Please check your internet connection.');
        setIsProcessing(false);
        return;
      }

      // Step 1: Create order on backend
      const orderData = await api.createSessionPaymentOrder({
        sessionId: effectiveSessionId || `direct-pay-${Date.now()}`,
        teacherId: selectedPeer.id,
        mentorId: selectedPeer.id,
        studentId: currentUser?.id || 'student-id',
        amount: payAmount,
        title: payNote
      });

      // Step 2: Configure Razorpay modal
      const options = {
        key: orderData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TUrtuundUxD7Jh',
        amount: orderData.amountInPaise || (payAmount * 100),
        currency: orderData.currency || 'INR',
        name: 'Mindroot Skill Exchange',
        description: `Direct Payment to ${selectedPeer.name} - ${payNote}`,
        image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            await api.verifySessionPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: payAmount,
              sessionData: {
                sessionId: effectiveSessionId || null,
                title: payNote,
                teacherId: selectedPeer.id,
                teacherName: selectedPeer.name,
                studentId: currentUser?.id || 'student-id',
                studentName: currentUser?.name || 'Student'
              }
            });

            if (effectiveSessionId) {
              await api.patchSession(effectiveSessionId, { paymentStatus: 'paid', paymentId: response.razorpay_payment_id });
            }

            setPaymentSuccess({
              paymentId: response.razorpay_payment_id,
              mentorName: selectedPeer.name,
              amount: payAmount,
              note: payNote
            });
            loadData();
          } catch (err: any) {
            console.error('Payment verification failed:', err);
            loadData();
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: currentUser?.name || 'Student',
          email: currentUser?.email || 'student@mindroot.edu',
          contact: '9999999999'
        },
        theme: {
          color: '#2563eb'
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
          }
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err: any) {
      console.error('Payment initialization failed:', err);
      alert('Failed to initialize payment. Please try again.');
      setIsProcessing(false);
    }
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
        payoutId: res.payout?.paymentId || `pout_${Date.now()}_rzpx`,
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

  const handleSavePayoutSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.savePayoutAccount({
        userId: currentUser?.id || 'user-maya',
        ...payoutAccount
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
          <h2 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
            {isTeacherRole 
              ? 'Mentoring Revenue & Earnings Wallet' 
              : (isStudentRole ? 'Payments & Tuition Wallet' : 'Payments & Earnings Wallet')}
          </h2>
          <p className="text-xs sm:text-sm text-on-surface-variant font-medium mt-1">
            {isTeacherRole
              ? 'Track your mentoring revenue, manage your linked bank account / UPI, and withdraw earnings directly via RazorpayX.'
              : (isStudentRole 
                  ? 'Track your mentoring lesson payments, view verified Razorpay receipts, and pay mentors securely.' 
                  : 'Track mentoring revenue, lesson payments, manage your linked bank account / UPI, and withdraw earnings directly via RazorpayX.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {(isTeacherRole || isBothRole) && (
            <>
              <button
                onClick={() => setIsPayoutSettingsOpen(true)}
                className="px-3.5 py-2 rounded-xl border border-outline-variant bg-surface hover:bg-surface-container text-on-surface font-bold text-xs shadow-elevation-1 flex items-center gap-1.5 transition-all"
                title="Configure Bank Account & UPI for payouts"
              >
                <span className="material-symbols-outlined text-base text-on-surface-variant">account_balance</span>
                Bank / UPI Settings
              </button>

              <Button
                variant="secondary"
                onClick={() => {
                  setWithdrawSuccess(null);
                  setWithdrawAmount(availableBalance > 0 ? Math.min(availableBalance, 2000) : 500);
                  setIsWithdrawModalOpen(true);
                }}
                className="bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-elevation-1 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base text-teaching-emerald">account_balance_wallet</span>
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
            className="font-extrabold text-xs px-4 py-2 rounded-xl shadow-elevation-1 flex items-center gap-1.5"
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
            className={`bg-surface border rounded-xl p-5 shadow-elevation-1 flex flex-col justify-between h-44 cursor-pointer transition-all ${activeTab === 'SPENT' ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant hover:border-primary/40'}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant">Total Mentoring Fees Paid</p>
                <h3 className="text-2xl sm:text-3xl font-bold text-primary mt-1">₹{totalSpent.toLocaleString('en-IN')}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-container border border-primary/20 text-on-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">shopping_cart</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-primary">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">receipt_long</span>
                {spentList.length} session payment{spentList.length !== 1 ? 's' : ''} recorded
              </span>
              <span className="text-[10px] bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full font-extrabold">
                Verified Receipts
              </span>
            </div>
          </div>

          {/* Payment Left / Pending Due Card */}
          <div 
            className="bg-surface border border-outline-variant hover:border-learning-amber/40 rounded-xl p-5 shadow-elevation-1 flex flex-col justify-between h-44 transition-all"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant">Payment Left / Due</p>
                  {pendingDue > 0 && <span className="w-2 h-2 rounded-full bg-learning-amber animate-pulse" />}
                </div>
                <h3 className={`text-2xl sm:text-3xl font-bold mt-1 ${pendingDue > 0 ? 'text-learning-amber' : 'text-on-surface'}`}>
                  ₹{pendingDue.toLocaleString('en-IN')}
                </h3>
                <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                  {pendingStudentSessions.length > 0 ? `${pendingStudentSessions.length} session(s) pending post-lecture payment` : 'All sessions fully paid & settled'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-learning-amber-container border border-learning-amber/20 text-on-learning-amber-container flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">pending_actions</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-learning-amber border-t border-outline-variant pt-2">
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

          {/* Razorpay Gateway Status Card */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 shadow-elevation-1 flex flex-col justify-between text-left h-44">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-wider">
                  <span className="material-symbols-outlined text-sm">shield_lock</span>
                  Razorpay Secure Checkout
                </div>
                <span className="px-2 py-0.5 bg-primary text-on-primary rounded text-[10px] font-bold">24x7 UPI / Cards</span>
              </div>
              <p className="text-xs text-on-surface-variant font-medium">
                Post-lecture payment protection. Zero upfront fees — pay via UPI, Google Pay, Cards, or NetBanking after class.
              </p>
            </div>
            <div className="text-[11px] font-mono text-on-surface-variant flex items-center justify-between pt-2 border-t border-outline-variant">
              <span>Security Guarantee:</span>
              <span className="font-bold text-on-surface">100% Encrypted & Settled</span>
            </div>
          </div>
        </div>
      ) : (
        /* TEACHER & BOTH BENTO GRID */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Earned Card */}
          <div 
            onClick={() => setActiveTab('EARNED')}
            className={`bg-surface border rounded-xl p-5 shadow-elevation-1 flex flex-col justify-between h-44 cursor-pointer transition-all ${activeTab === 'EARNED' ? 'border-teaching-emerald ring-2 ring-teaching-emerald/20' : 'border-outline-variant hover:border-teaching-emerald/40'}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant">Total Mentoring Revenue</p>
                <h3 className="text-2xl sm:text-3xl font-bold text-teaching-emerald mt-1">₹{totalEarned.toLocaleString('en-IN')}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teaching-emerald-container border border-teaching-emerald/20 text-on-teaching-emerald-container flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">payments</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-teaching-emerald">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                {earnedList.length} student payouts
              </span>
              <span className="text-[10px] bg-teaching-emerald-container text-on-teaching-emerald-container px-2 py-0.5 rounded-full font-extrabold">
                Ready for Payout
              </span>
            </div>
          </div>

          {/* Linked Bank / UPI Account Status or Spent in Both */}
          {isBothRole ? (
            <div 
              onClick={() => setActiveTab('SPENT')}
              className={`bg-surface border rounded-xl p-5 shadow-elevation-1 flex flex-col justify-between h-44 cursor-pointer transition-all ${activeTab === 'SPENT' ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant hover:border-primary/40'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant">Total Spent on Learning</p>
                  <h3 className="text-2xl sm:text-3xl font-bold text-primary mt-1">₹{totalSpent.toLocaleString('en-IN')}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary-container border border-primary/20 text-on-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">shopping_cart</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-primary">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">receipt_long</span>
                  {spentList.length} sessions paid
                </span>
                <span className="text-[10px] bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full font-extrabold">
                  Net: ₹{availableBalance.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setIsPayoutSettingsOpen(true)}
              className="bg-surface border border-outline-variant hover:border-primary/40 rounded-xl p-5 shadow-elevation-1 flex flex-col justify-between h-44 cursor-pointer transition-all"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant">Teacher Payout Account</p>
                    <span className="w-2 h-2 rounded-full bg-teaching-emerald" />
                  </div>
                  <h3 className="text-base font-bold text-on-surface mt-1 truncate max-w-[200px]">
                    {payoutAccount.payoutMethod === 'upi' ? payoutAccount.upiId : `${payoutAccount.bankName} (${payoutAccount.accountNumber})`}
                  </h3>
                  <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">{payoutAccount.accountHolderName}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary-container border border-primary/20 text-on-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">account_balance</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-primary border-t border-outline-variant pt-2">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">verified_user</span>
                  RazorpayX Linked
                </span>
                <span className="text-[11px] text-primary font-bold hover:underline">Edit details →</span>
              </div>
            </div>
          )}

          {/* Razorpay Gateway Status Card */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 shadow-elevation-1 flex flex-col justify-between text-left h-44">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-wider">
                  <span className="material-symbols-outlined text-sm">shield_lock</span>
                  Razorpay Route & Payouts
                </div>
                <span className="px-2 py-0.5 bg-primary text-on-primary rounded text-[10px] font-bold">24x7 IMPS / UPI</span>
              </div>
              <p className="text-xs text-on-surface-variant font-medium">Automatic direct bank settlements to teacher bank accounts upon lesson completion.</p>
            </div>
            <div className="text-[11px] font-mono text-on-surface-variant flex items-center justify-between pt-2 border-t border-outline-variant">
              <span>Settlement SLA:</span>
              <span className="font-bold text-on-surface">Instant / T+1 Daily</span>
            </div>
          </div>
        </div>
      )}

      {/* Direct Payment Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-surface rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-elevation-3 border border-outline-variant space-y-5 text-on-surface">
            {!paymentSuccess ? (
              <>
                <div className="flex justify-between items-center pb-3 border-b border-outline-variant">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-teaching-emerald-container text-on-teaching-emerald-container flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-xl">payments</span>
                    </div>
                    <div>
                      <h3 className="text-base font-black text-on-surface">Pay Mentor Directly</h3>
                      <p className="text-[11px] text-on-surface-variant">Fast, secure INR transfer via Razorpay</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsPayModalOpen(false)}
                    className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                {/* Pending Session Linker (if applicable) */}
                {pendingStudentSessions.length > 0 && (
                  <div className="space-y-1.5 bg-learning-amber-container/50 p-3 rounded-2xl border border-learning-amber/20">
                    <label className="block text-xs font-bold text-on-learning-amber-container">Settle Unpaid Lecture (Optional)</label>
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
                      className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  <label className="block text-xs font-bold text-on-surface">Select Mentor / Teacher</label>
                  <select
                    value={selectedPeerId}
                    onChange={(e) => {
                      setSelectedPeerId(e.target.value);
                      const p = peers.find(peer => peer.id === e.target.value);
                      if (p?.hourlyRate && !selectedSessionId) setPayAmount(p.hourlyRate);
                    }}
                    className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  <label className="block text-xs font-bold text-on-surface">Amount (₹ INR)</label>
                  <div className="flex gap-2 mb-2">
                    {[299, 499, 799, 999].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setPayAmount(amt)}
                        className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg border transition-all ${payAmount === amt ? 'bg-primary text-on-primary border-primary shadow-elevation-1' : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}
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
                    className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Enter custom amount in ₹"
                  />
                </div>

                {/* Purpose Note */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-on-surface">Payment Note / Purpose</label>
                  <input
                    type="text"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="e.g. Tutoring session fee, bonus tip..."
                    className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Summary Box */}
                <div className="p-4 bg-surface-container-low border border-outline-variant rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between font-medium text-on-surface-variant">
                    <span>Recipient Mentor:</span>
                    <span className="font-bold text-on-surface">{selectedPeerObj?.name || 'Selected Mentor'}</span>
                  </div>
                  <div className="flex justify-between font-medium text-on-surface-variant">
                    <span>Payment Gateway:</span>
                    <span className="font-bold text-primary">Razorpay (UPI / Cards)</span>
                  </div>
                  <div className="border-t border-outline-variant pt-2 flex justify-between font-black text-sm text-on-surface">
                    <span>Total Amount:</span>
                    <span className="text-teaching-emerald text-base">₹{payAmount}</span>
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
                    className="flex-1 py-2.5 font-extrabold text-xs shadow-elevation-1 flex items-center justify-center gap-2"
                    onClick={handleDirectPayMentor}
                  >
                    {isProcessing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin"></span>
                        Launching Razorpay...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">lock</span>
                        Pay ₹{payAmount} via Razorpay
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              /* Success Confirmation */
              <div className="text-center py-4 space-y-4">
                <div className="w-14 h-14 rounded-full bg-teaching-emerald-container text-on-teaching-emerald-container flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-3xl">verified</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-on-surface">Payment Successful!</h3>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Successfully sent <strong className="text-teaching-emerald font-bold">₹{paymentSuccess.amount}</strong> to <strong className="text-on-surface">{paymentSuccess.mentorName}</strong>.
                  </p>
                </div>
                <div className="p-3.5 bg-surface-container-low border border-outline-variant rounded-xl text-left font-mono text-[11px] text-on-surface-variant space-y-1">
                  <p><strong>Ref ID:</strong> {paymentSuccess.paymentId}</p>
                  <p><strong>Status:</strong> <span className="text-teaching-emerald font-bold">PAID & SETTLED</span></p>
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
          <div className="bg-surface rounded-3xl max-w-md w-full p-6 shadow-elevation-3 border border-outline-variant space-y-5 text-on-surface animate-in zoom-in-95 duration-150">
            {!withdrawSuccess ? (
              <>
                <div className="flex items-center justify-between border-b border-outline-variant pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-teaching-emerald-container text-on-teaching-emerald-container flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                    </div>
                    <div>
                      <h3 className="text-base font-black text-on-surface">Withdraw Earnings to Bank</h3>
                      <p className="text-[11px] text-on-surface-variant">Instant 24x7 IMPS / UPI payout via RazorpayX</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsWithdrawModalOpen(false)}
                    className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                {/* Destination Account Card */}
                <div className="p-3.5 bg-surface-container-low border border-outline-variant rounded-2xl space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-on-surface-variant font-medium">
                    <span>Payout Destination:</span>
                    <button 
                      onClick={() => {
                        setIsWithdrawModalOpen(false);
                        setIsPayoutSettingsOpen(true);
                      }} 
                      className="text-primary font-bold hover:underline"
                    >
                      Change
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface font-bold text-sm">
                    <span className="material-symbols-outlined text-teaching-emerald text-base">
                      {payoutAccount.payoutMethod === 'upi' ? 'qr_code_2' : 'account_balance'}
                    </span>
                    <span>
                      {payoutAccount.payoutMethod === 'upi' 
                        ? payoutAccount.upiId 
                        : `${payoutAccount.bankName} (${payoutAccount.accountNumber})`}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">Beneficiary: {payoutAccount.accountHolderName}</p>
                </div>

                {/* Amount input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-on-surface">Withdrawal Amount (₹ INR)</label>
                    <span className="text-[11px] text-on-surface-variant">Available: <strong className="text-teaching-emerald font-bold">₹{totalEarned}</strong></span>
                  </div>
                  <div className="flex gap-2 mb-2">
                    {[500, 1000, 2500, 5000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setWithdrawAmount(amt)}
                        className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg border transition-all ${withdrawAmount === amt ? 'bg-teaching-emerald text-on-teaching-emerald border-teaching-emerald shadow-elevation-1' : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}
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
                    className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-teaching-emerald/20"
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
                    className="flex-1 py-2.5 font-extrabold text-xs shadow-elevation-1 flex items-center justify-center gap-2"
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
                <div className="w-14 h-14 rounded-full bg-teaching-emerald-container text-on-teaching-emerald-container flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-on-surface">Payout Transferred!</h3>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Successfully sent <strong className="text-teaching-emerald font-bold">₹{withdrawSuccess.amount}</strong> to your bank/UPI account via RazorpayX.
                  </p>
                </div>
                <div className="p-3.5 bg-surface-container-low border border-outline-variant rounded-xl text-left font-mono text-[11px] text-on-surface-variant space-y-1">
                  <p><strong>Payout Ref:</strong> {withdrawSuccess.payoutId}</p>
                  <p><strong>Destination:</strong> {withdrawSuccess.account.payoutMethod === 'upi' ? withdrawSuccess.account.upiId : withdrawSuccess.account.accountNumber}</p>
                  <p><strong>Status:</strong> <span className="text-teaching-emerald font-bold">CREDITED & SETTLED (IMPS)</span></p>
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
          <div className="bg-surface rounded-3xl max-w-md w-full p-6 shadow-elevation-3 border border-outline-variant space-y-5 text-on-surface animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">account_balance</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-on-surface">Teacher Bank / UPI Details</h3>
                  <p className="text-[11px] text-on-surface-variant">Configure where you receive student payments</p>
                </div>
              </div>
              <button 
                onClick={() => setIsPayoutSettingsOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSavePayoutSettings} className="space-y-4">
              {/* Method Toggle */}
              <div className="flex rounded-xl bg-surface-container p-1 border border-outline-variant">
                <button
                  type="button"
                  onClick={() => setPayoutAccount({ ...payoutAccount, payoutMethod: 'upi' })}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${payoutAccount.payoutMethod === 'upi' ? 'bg-surface text-on-surface shadow-elevation-1 font-extrabold' : 'text-on-surface-variant'}`}
                >
                  UPI ID (VPA)
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutAccount({ ...payoutAccount, payoutMethod: 'bank' })}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${payoutAccount.payoutMethod === 'bank' ? 'bg-surface text-on-surface shadow-elevation-1 font-extrabold' : 'text-on-surface-variant'}`}
                >
                  Bank Account (IFSC)
                </button>
              </div>

              {/* Beneficiary Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-on-surface">Account Holder / Beneficiary Name</label>
                <input
                  type="text"
                  required
                  value={payoutAccount.accountHolderName}
                  onChange={e => setPayoutAccount({ ...payoutAccount, accountHolderName: e.target.value })}
                  placeholder="e.g. Maya Sharma"
                  className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {payoutAccount.payoutMethod === 'upi' ? (
                /* UPI ID */
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-on-surface">UPI ID / VPA</label>
                  <input
                    type="text"
                    required
                    value={payoutAccount.upiId}
                    onChange={e => setPayoutAccount({ ...payoutAccount, upiId: e.target.value })}
                    placeholder="e.g. yourname@okhdfcbank or 9876543210@paytm"
                    className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <p className="text-[10px] text-on-surface-variant">Supports Google Pay, PhonePe, Paytm, BHIM, and all bank UPI apps.</p>
                </div>
              ) : (
                /* Bank Account Details */
                <>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-on-surface">Bank Name</label>
                    <input
                      type="text"
                      required
                      value={payoutAccount.bankName}
                      onChange={e => setPayoutAccount({ ...payoutAccount, bankName: e.target.value })}
                      placeholder="e.g. HDFC Bank, SBI, ICICI"
                      className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-on-surface">Account Number</label>
                    <input
                      type="text"
                      required
                      value={payoutAccount.accountNumber}
                      onChange={e => setPayoutAccount({ ...payoutAccount, accountNumber: e.target.value })}
                      placeholder="e.g. 501002348921"
                      className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-on-surface">IFSC Code</label>
                    <input
                      type="text"
                      required
                      value={payoutAccount.ifscCode}
                      onChange={e => setPayoutAccount({ ...payoutAccount, ifscCode: e.target.value.toUpperCase() })}
                      placeholder="e.g. HDFC0001234"
                      className="w-full px-3.5 py-2.5 bg-surface border border-outline-variant rounded-xl text-xs font-bold text-on-surface uppercase focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  className="flex-1 py-2.5 font-extrabold text-xs shadow-elevation-1 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  Save Details
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Razorpay Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface rounded-3xl max-w-md w-full p-6 shadow-elevation-3 border border-outline-variant space-y-5 text-on-surface animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-teaching-emerald" />
                <h3 className="text-sm font-bold text-on-surface">Official Razorpay Receipt</h3>
              </div>
              <button 
                onClick={() => setSelectedReceipt(null)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="text-center py-2 space-y-1">
              <p className="text-xs text-on-surface-variant font-medium">{selectedReceipt.title}</p>
              <h2 className="text-3xl font-extrabold text-on-surface">₹{selectedReceipt.amount}</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-teaching-emerald-container border border-teaching-emerald/20 text-on-teaching-emerald-container rounded-full text-[11px] font-bold">
                <span className="material-symbols-outlined text-xs">verified</span>
                Payment Verified & Settled
              </span>
            </div>

            <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 font-mono text-xs space-y-2 text-on-surface-variant">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Payment ID:</span>
                <span className="font-bold text-on-surface">{selectedReceipt.paymentId || 'pay_sim_001'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Transaction Type:</span>
                <span className="font-bold text-teaching-emerald">{selectedReceipt.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Peer:</span>
                <span className="font-bold text-on-surface">{selectedReceipt.peerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Date & Time:</span>
                <span>{new Date(selectedReceipt.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Gateway:</span>
                <span className="font-bold text-primary">Razorpay INR</span>
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
        <section className="bg-learning-amber-container/50 border border-learning-amber/20 rounded-2xl p-5 shadow-elevation-1 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-learning-amber animate-pulse" />
              <h3 className="font-extrabold text-sm text-on-learning-amber-container">Pending Post-Lecture Sessions ({pendingStudentSessions.length})</h3>
            </div>
            <span className="text-xs font-bold text-on-learning-amber-container">Total Due: ₹{pendingDue}</span>
          </div>
          <p className="text-xs text-on-learning-amber-container/80 font-medium">
            These mentoring sessions are pending payment settlement. Click below to pay the mentor securely via Razorpay.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {pendingStudentSessions.map((sess: any) => {
              const teacherName = sess.teacher?.name || 'Mentor';
              const amt = sess.pricePerStudent || sess.amount || 499;
              return (
                <div key={sess.id} className="bg-surface rounded-xl p-4 border border-outline-variant shadow-elevation-1 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex justify-between items-start">
                      <p className="font-extrabold text-xs text-on-surface truncate max-w-[200px]">{sess.title}</p>
                      <span className="font-black text-sm text-teaching-emerald">₹{amt}</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant font-semibold mt-0.5">Teacher: {teacherName}</p>
                  </div>
                  <button
                    onClick={() => handlePaySessionDirect(sess)}
                    disabled={isProcessing}
                    className="w-full py-2 bg-teaching-emerald hover:bg-teaching-emerald-hover text-on-teaching-emerald rounded-lg text-xs font-extrabold shadow-elevation-1 transition-all active:scale-98 flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px]">payments</span>
                    <span>Pay ₹{amt} to {teacherName} with Razorpay</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Transaction History */}
      <section className="bg-surface rounded-2xl shadow-elevation-1 border border-outline-variant overflow-hidden">
        <div className="px-5 py-3.5 border-b border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-on-surface">Payment & Transaction Receipts</h3>
            <span className="text-xs text-on-surface-variant font-semibold bg-surface-container px-2 py-0.5 rounded-full">{filteredTransactions.length} records</span>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-surface-container p-1 rounded-xl text-xs font-bold border border-outline-variant">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1 rounded-lg transition-all ${activeTab === 'ALL' ? 'bg-surface text-on-surface shadow-elevation-1' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              All ({transactions.length})
            </button>
            <button
              onClick={() => setActiveTab('EARNED')}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${activeTab === 'EARNED' ? 'bg-surface text-teaching-emerald shadow-elevation-1 font-extrabold' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-xs text-teaching-emerald">payments</span>
              Received ({earnedList.length})
            </button>
            <button
              onClick={() => setActiveTab('SPENT')}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${activeTab === 'SPENT' ? 'bg-surface text-primary shadow-elevation-1 font-extrabold' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-xs text-primary">shopping_cart</span>
              Paid ({spentList.length})
            </button>
          </div>
        </div>
        <div className="divide-y divide-outline-variant">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-on-surface-variant font-semibold">No payment transactions recorded in this view.</div>
          ) : (
            filteredTransactions.map((tx, i) => (
            <div 
              key={i} 
              onClick={() => setSelectedReceipt(tx)}
              className="px-5 py-3.5 flex items-center justify-between hover:bg-surface-container transition-colors cursor-pointer group"
              title="Click to view full Razorpay receipt"
            >
              <div className="flex items-center gap-3.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-elevation-1 ${tx.type === 'EARNED' ? 'bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20' : 'bg-primary-container text-on-primary-container border border-primary/20'}`}> 
                  <span className="material-symbols-outlined text-lg font-bold">
                    {tx.type === 'EARNED' ? 'arrow_downward' : 'arrow_upward'}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">
                    {tx.title || (tx.type === 'EARNED' ? `Mentoring Payout` : `Session Payment`)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant font-medium mt-0.5">
                    <span>{tx.type === 'EARNED' ? `From: ${tx.peerName}` : `To: ${tx.peerName}`}</span>
                    <span>•</span>
                    <span>{new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    {tx.paymentId && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-[10px] bg-surface-container text-on-surface-variant px-1.5 py-0.5 rounded">
                          {tx.paymentId}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-black text-xs ${tx.type === 'EARNED' ? 'text-teaching-emerald' : 'text-on-surface'}`}> 
                  {tx.type === 'EARNED' ? `+₹${tx.amount}` : `-₹${tx.amount}` }
                </p>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 ${tx.type === 'EARNED' ? 'bg-teaching-emerald-container text-on-teaching-emerald-container border border-teaching-emerald/20' : 'bg-surface-container text-on-surface-variant'}`}>
                  {tx.type === 'EARNED' ? 'Revenue Received' : 'Paid via Razorpay'}
                </span>
              </div>
            </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
