import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, useGoogleOneTapLogin } from '@react-oauth/google';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export function Login() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  // Sign In states
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);

  // Sign Up states
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [signUpTeaches, setSignUpTeaches] = useState('');
  const [signUpLearns, setSignUpLearns] = useState('');
  const [signUpError, setSignUpError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpRole, setSignUpRole] = useState<'student' | 'teacher' | 'both'>('student');
  const [signUpHourlyRate, setSignUpHourlyRate] = useState(499);
  const [signUpBatchPricing, setSignUpBatchPricing] = useState<Record<number, number>>({
    1: 499,
    2: 399,
    3: 349,
    4: 299,
    5: 249
  });

  // Google OAuth Onboarding states
  const [googleError, setGoogleError] = useState('');
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [onboardRole, setOnboardRole] = useState<'student' | 'teacher' | 'both'>('student');
  const [onboardHourlyRate, setOnboardHourlyRate] = useState(499);
  const [onboardBatchPricing, setOnboardBatchPricing] = useState<Record<number, number>>({
    1: 499,
    2: 399,
    3: 349,
    4: 299,
    5: 249
  });
  const [onboardTeaches, setOnboardTeaches] = useState('Web Development');
  const [onboardLearns, setOnboardLearns] = useState('Python');

  const handleBaseRateChange = (rate: number, isOnboard = false) => {
    const safeRate = Math.max(50, rate || 50);
    const updated = {
      1: safeRate,
      2: Math.round(safeRate * 0.8),
      3: Math.round(safeRate * 0.7),
      4: Math.round(safeRate * 0.6),
      5: Math.round(safeRate * 0.5)
    };
    if (isOnboard) {
      setOnboardHourlyRate(safeRate);
      setOnboardBatchPricing(updated);
    } else {
      setSignUpHourlyRate(safeRate);
      setSignUpBatchPricing(updated);
    }
  };

  const loginAction = useAppStore(state => state.login);
  const setCurrentUser = useAppStore(state => state.setCurrentUser);
  const navigate = useNavigate();

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '832106431414-q2afhkunmhn52p29merodho4u9ij5uvh.apps.googleusercontent.com';
  const enableGoogleAuth = true;

  // Shared Google OAuth Success/Error handlers
  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (credentialResponse?.credential) {
      try {
        setGoogleError('');
        const res = await api.loginWithGoogleToken(credentialResponse.credential);
        if (res && res.user) {
          const resolvedRole = res.user.role || 'student';
          loginAction(res.user, resolvedRole);
          setCurrentUser(res.user);

          if (res.isNewUser) {
            setPendingUser(res.user);
            setShowNewUserModal(true);
          } else {
            if (res.user.role === 'admin') {
              navigate('/admin');
            } else if (res.user.role === 'teacher') {
              navigate('/teacher');
            } else {
              navigate('/dashboard');
            }
          }
        }
      } catch (err: any) {
        setGoogleError(err.message || 'Google Sign-In failed.');
      }
    }
  };

  const handleGoogleError = () => {
    setGoogleError('Google Sign-In was unsuccessful or cancelled.');
  };

  // Google One-Tap prompt for returning users
  useGoogleOneTapLogin({
    onSuccess: handleGoogleSuccess,
    onError: handleGoogleError,
    disabled: !googleClientId,
  });

  // Reusable Google OAuth button renderer
  const renderGoogleOAuthButton = (dividerText: string, isRegister: boolean = false) => {
    if (!enableGoogleAuth) return null;
    return (
      <div className="space-y-3 mb-2">
        {googleClientId ? (
          <div className="flex justify-center w-full">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="outline"
              shape="pill"
              size="large"
              text={isRegister ? "signup_with" : "continue_with"}
            />
          </div>
        ) : null}

        {googleError && (
          <div className="bg-alert-rose-container border border-alert-rose/20 text-on-alert-rose-container rounded-2xl p-3 text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{googleError}</span>
          </div>
        )}

        <div className="flex items-center my-3">
          <div className="flex-1 border-t border-outline-variant"></div>
          <span className="px-3 text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest">{dividerText}</span>
          <div className="flex-1 border-t border-outline-variant"></div>
        </div>
      </div>
    );
  };


  // Sign In submit handler
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail.trim()) {
      setSignInError('Please enter your email or User ID.');
      return;
    }
    if (!signInPassword.trim()) {
      setSignInError('Please enter your password.');
      return;
    }

    setSignInLoading(true);
    setSignInError('');

    try {
      const user = await api.loginAuth({
        email: signInEmail.trim(),
        password: signInPassword.trim()
      });

      const userRole: 'student' | 'teacher' | 'both' | 'admin' = (user.role === 'student' || user.role === 'teacher' || user.role === 'both' || user.role === 'admin')
        ? user.role
        : 'student';

      loginAction(user, userRole);
      setCurrentUser(user);

      if (userRole === 'admin') {
        navigate('/admin');
      } else if (userRole === 'teacher') {
        navigate('/teacher');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setSignInError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setSignInLoading(false);
    }
  };

  // Sign Up / Registration submit handler
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpName.trim()) {
      setSignUpError('Full Name is required.');
      return;
    }
    if (!signUpEmail.trim()) {
      setSignUpError('Email address is required.');
      return;
    }
    if (!signUpPassword.trim() || signUpPassword.length < 4) {
      setSignUpError('Password must be at least 4 characters.');
      return;
    }

    const teachesArray = (signUpRole === 'teacher' || signUpRole === 'both')
      ? signUpTeaches.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const learnsArray = (signUpRole === 'student' || signUpRole === 'both')
      ? signUpLearns.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    if (signUpRole === 'teacher' && teachesArray.length === 0) {
      setSignUpError('Please enter at least one skill you can teach.');
      return;
    }

    if (signUpRole === 'student' && learnsArray.length === 0) {
      setSignUpError('Please enter at least one skill you want to learn.');
      return;
    }

    if (signUpRole === 'both' && teachesArray.length === 0 && learnsArray.length === 0) {
      setSignUpError('Please enter at least one skill to teach or learn.');
      return;
    }

    setSignUpLoading(true);
    setSignUpError('');

    try {
      const newUser = await api.registerAuthUser({
        name: signUpName.trim(),
        email: signUpEmail.trim(),
        password: signUpPassword.trim(),
        role: signUpRole,
        teaches: teachesArray,
        learns: learnsArray,
        hourlyRate: signUpHourlyRate,
        batchPricing: signUpBatchPricing
      });

      setSignUpSuccess(true);
      loginAction(newUser, signUpRole);
      setCurrentUser(newUser);

      // Auto redirect to appropriate dashboard
      setTimeout(() => {
        if (signUpRole === 'teacher') {
          navigate('/teacher');
        } else {
          navigate('/dashboard');
        }
      }, 1000);
    } catch (err: any) {
      setSignUpError(err.message || 'Registration failed. Please check details and try again.');
    } finally {
      setSignUpLoading(false);
    }
  };

  // Handle Google Onboarding submission for new accounts
  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;

    const teachesArray = onboardTeaches.split(',').map(s => s.trim()).filter(Boolean);
    const learnsArray = onboardLearns.split(',').map(s => s.trim()).filter(Boolean);

    const updatedUser = {
      ...pendingUser,
      role: onboardRole,
      hourlyRate: onboardHourlyRate,
      batchPricing: onboardBatchPricing,
      skillsTaught: teachesArray,
      skillsLearned: learnsArray,
      userSkills: [
        ...teachesArray.map(t => ({ type: 'teaches', skill: { id: 's-' + t, name: t, category: 'Software & AI' } })),
        ...learnsArray.map(l => ({ type: 'wants_to_learn', skill: { id: 's-' + l, name: l, category: 'Software & AI' } }))
      ]
    };

    loginAction(updatedUser, onboardRole);
    setCurrentUser(updatedUser);
    api.syncNetworkUser(updatedUser);
    setShowNewUserModal(false);

    if (onboardRole === 'teacher') {
      navigate('/teacher');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-on-background flex flex-col items-center justify-center p-4 sm:p-8 font-sans relative overflow-hidden select-none">
      <div className="w-full max-w-[500px] space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-surface-container border border-outline-variant text-primary shadow-elevation-1 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">psychology</span>
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold text-on-surface tracking-tight">Mindroot</h1>
            <div className="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-surface-container border border-outline-variant text-on-surface-variant rounded-full text-[11px] font-medium">
                <span className="material-symbols-outlined text-[13px] text-primary">school</span>
                Peer Skill Exchange
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-surface-container border border-outline-variant text-on-surface-variant rounded-full text-[11px] font-medium">
                <span className="material-symbols-outlined text-[13px] text-primary">verified</span>
                Live Mentoring
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant font-medium max-w-sm mx-auto leading-relaxed">
            Peer-to-peer student skill exchange & collaborative campus learning
          </p>
        </div>

        {/* Main Card with Layered Shadow & Crisp Border */}
        <div className="bg-surface rounded-3xl p-7 sm:p-9 border border-outline-variant shadow-elevation-2 space-y-6 relative overflow-hidden text-on-surface">
          
          {/* Top Brand Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />

          {/* Card Toggle Tabs: Sign In vs Register */}
          <div className="bg-surface-container p-1.5 rounded-2xl flex gap-1.5 border border-outline-variant">
            <button
              onClick={() => {
                setActiveTab('signin');
                setSignInError('');
                setSignUpError('');
              }}
              className={`flex-1 py-2.5 text-center text-sm font-bold rounded-xl transition-all ${
                activeTab === 'signin' 
                  ? 'bg-surface text-primary shadow-elevation-1 border border-outline-variant' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setActiveTab('signup');
                setSignInError('');
                setSignUpError('');
              }}
              className={`flex-1 py-2.5 text-center text-sm font-bold rounded-xl transition-all ${
                activeTab === 'signup' 
                  ? 'bg-surface text-primary shadow-elevation-1 border border-outline-variant' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Create Account
            </button>
          </div>

          {activeTab === 'signin' ? (
            /* Sign In Form */
            <form onSubmit={handleSignInSubmit} className="space-y-4.5">
              {renderGoogleOAuthButton('or sign in with email', false)}

              {/* Error Message Alert */}
              {signInError && (
                <div className="bg-alert-rose-container border border-alert-rose/20 text-on-alert-rose-container rounded-xl p-3.5 text-xs font-semibold flex items-center gap-2 shadow-elevation-1">
                  <span className="material-symbols-outlined text-base shrink-0">error</span>
                  <span>{signInError}</span>
                </div>
              )}

              {/* Email / User ID Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-on-surface">Email or User ID</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-3 text-on-surface-variant text-lg">mail</span>
                  <input
                    type="text"
                    placeholder="Enter your email (e.g. alex@gmail.com)"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-surface rounded-xl border border-outline-variant text-sm font-medium text-on-surface placeholder:text-neutral-subtle outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-elevation-1 transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-on-surface">Password</label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-xs font-bold text-primary hover:underline transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-3 text-on-surface-variant text-lg">lock</span>
                  <input
                    type={showSignInPassword ? "text" : "password"}
                    placeholder="Enter your password..."
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-2.5 bg-surface rounded-xl border border-outline-variant text-sm font-medium text-on-surface placeholder:text-neutral-subtle outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-elevation-1 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignInPassword(!showSignInPassword)}
                    className="absolute right-3.5 top-2.5 text-on-surface-variant hover:text-on-surface transition-colors"
                    title={showSignInPassword ? "Hide password" : "Show password"}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showSignInPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full py-3 font-bold text-sm rounded-xl text-on-primary shadow-elevation-1 bg-primary hover:bg-primary-hover transition-all"
                  disabled={signInLoading}
                >
                  {signInLoading ? 'Authenticating...' : 'Sign In to Mindroot'}
                </Button>
              </div>
            </form>
          ) : (
            /* Sign Up / Registration Form */
            <form onSubmit={handleSignUpSubmit} className="space-y-4">
              {renderGoogleOAuthButton('or register with email', true)}

              {signUpSuccess ? (
                <div className="bg-teaching-emerald-container border border-teaching-emerald/20 text-on-teaching-emerald-container rounded-xl p-4 font-semibold text-sm flex items-center gap-2 shadow-elevation-1">
                  <span className="material-symbols-outlined text-teaching-emerald text-lg">check_circle</span>
                  Account created successfully! Redirecting to your dashboard...
                </div>
              ) : (
                <>
                  {signUpError && (
                    <div className="bg-alert-rose-container border border-alert-rose/20 text-on-alert-rose-container rounded-xl p-3.5 text-xs font-semibold flex items-center gap-2 shadow-elevation-1">
                      <span className="material-symbols-outlined text-base shrink-0">error</span>
                      <span>{signUpError}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-on-surface">Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Alex Rivera"
                      className="w-full rounded-xl border border-outline-variant bg-surface text-sm font-medium text-on-surface placeholder:text-neutral-subtle px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-elevation-1 transition-all"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-on-surface">Email Address</label>
                      <input 
                        type="email" 
                        placeholder="e.g. alex@gmail.com"
                        className="w-full rounded-xl border border-outline-variant bg-surface text-sm font-medium text-on-surface placeholder:text-neutral-subtle px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-elevation-1 transition-all"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-on-surface">Password</label>
                      <div className="relative">
                        <input 
                          type={showSignUpPassword ? "text" : "password"} 
                          placeholder="Min 4 characters..."
                          className="w-full rounded-xl border border-outline-variant bg-surface text-sm font-medium text-on-surface placeholder:text-neutral-subtle pl-4 pr-10 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-elevation-1 transition-all"
                          value={signUpPassword}
                          onChange={(e) => setSignUpPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                          className="absolute right-3 top-2.5 text-on-surface-variant hover:text-on-surface transition-colors"
                          title={showSignUpPassword ? "Hide password" : "Show password"}
                        >
                          <span className="material-symbols-outlined text-base">
                            {showSignUpPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-on-surface">I want to</label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { key: 'student', label: 'Learn', icon: 'school' },
                        { key: 'teacher', label: 'Teach', icon: 'workspace_premium' },
                        { key: 'both', label: 'Both', icon: 'swap_horiz' }
                      ].map(r => (
                        <button
                          key={r.key}
                          onClick={() => setSignUpRole(r.key as any)}
                          type="button"
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                            signUpRole === r.key 
                              ? 'border-primary bg-primary-container text-on-primary-container font-bold shadow-elevation-1' 
                              : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                          }`}
                        >
                          <span className="material-symbols-outlined text-lg mb-0.5">{r.icon}</span>
                          <span className="text-xs font-semibold">{r.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {(signUpRole === 'teacher' || signUpRole === 'both') && (
                    <>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-on-surface">Skills you can Teach (comma-separated)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Java, Web Development, UI/UX"
                          className="w-full rounded-xl border border-outline-variant bg-surface text-sm font-medium text-on-surface placeholder:text-neutral-subtle px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-elevation-1 transition-all"
                          value={signUpTeaches}
                          onChange={(e) => setSignUpTeaches(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="block text-xs font-bold text-on-surface">Base Rate (1-on-1 Private Session)</label>
                          <span className="text-[10px] text-primary font-bold bg-primary-container px-2 py-0.5 rounded">₹ / Hour</span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 font-bold text-on-surface-variant text-sm">₹</span>
                          <input 
                            type="number" 
                            min={50}
                            max={10000}
                            step={50}
                            placeholder="e.g. 499"
                            className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm font-bold text-on-surface placeholder:text-neutral-subtle outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-elevation-1 transition-all"
                            value={signUpHourlyRate}
                            onChange={(e) => handleBaseRateChange(Number(e.target.value))}
                          />
                        </div>
                        <div className="flex gap-2 pt-0.5">
                          {[299, 499, 799, 999].map(rate => (
                            <button
                              key={rate}
                              type="button"
                              onClick={() => handleBaseRateChange(rate)}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${signUpHourlyRate === rate ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}
                            >
                              ₹{rate}/hr
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Batch Pricing for All 5 Cohort Formats */}
                      <div className="space-y-2 pt-2 border-t border-outline-variant/60">
                        <div className="flex justify-between items-center">
                          <label className="block text-xs font-bold text-on-surface flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-teaching-emerald">groups</span>
                            <span>Batch Pricing (Price per Student / Hour)</span>
                          </label>
                          <span className="text-[10px] text-teaching-emerald font-bold bg-teaching-emerald-container px-2 py-0.5 rounded">Customizable</span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant">Specify how much each student pays per seat. Your total earnings per hour are shown for each batch size:</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { cap: 1, label: '1-on-1 Lecture', icon: 'person', desc: '1 Student' },
                            { cap: 2, label: 'Duo Study', icon: 'group', desc: '2 Students' },
                            { cap: 3, label: 'Trio Batch', icon: 'groups', desc: '3 Students' },
                            { cap: 4, label: 'Small Cohort', icon: 'diversity_3', desc: '4 Students' },
                            { cap: 5, label: 'Masterclass Batch', icon: 'school', desc: '5 Students (Max)' },
                          ].map(tier => {
                            const seatPrice = signUpBatchPricing[tier.cap] ?? (tier.cap === 1 ? signUpHourlyRate : Math.round(signUpHourlyRate * (1 - tier.cap * 0.1)));
                            const totalEarnings = seatPrice * tier.cap;
                            return (
                              <div key={tier.cap} className={`p-2.5 rounded-xl border bg-surface-container-low border-outline-variant ${tier.cap === 5 ? 'sm:col-span-2' : ''}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-on-surface flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm text-primary">{tier.icon}</span>
                                    {tier.label}
                                  </span>
                                  <span className="text-[10px] font-extrabold text-teaching-emerald">
                                    Earns ₹{totalEarnings}/hr
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="relative flex-1">
                                    <span className="absolute left-2.5 top-1.5 font-bold text-on-surface-variant text-xs">₹</span>
                                    <input 
                                      type="number"
                                      min={25}
                                      max={10000}
                                      step={25}
                                      value={seatPrice}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setSignUpBatchPricing(prev => ({ ...prev, [tier.cap]: val }));
                                        if (tier.cap === 1) setSignUpHourlyRate(val);
                                      }}
                                      className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs font-bold text-on-surface outline-none focus:border-primary"
                                    />
                                  </div>
                                  <span className="text-[10px] font-semibold text-on-surface-variant whitespace-nowrap">/ student</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {(signUpRole === 'student' || signUpRole === 'both') && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-on-surface">Skills you want to Learn (comma-separated)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Python, SQL Database, React"
                        className="w-full rounded-xl border border-outline-variant bg-surface text-sm font-medium text-on-surface placeholder:text-neutral-subtle px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-elevation-1 transition-all"
                        value={signUpLearns}
                        onChange={(e) => setSignUpLearns(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="pt-2">
                    <Button 
                      type="submit"
                      className="w-full py-3 font-bold text-sm rounded-xl text-on-primary bg-primary hover:bg-primary-hover shadow-elevation-1 transition-all" 
                      variant="primary"
                      disabled={signUpLoading}
                    >
                      {signUpLoading ? 'Creating Account...' : 'Create Account & Start Learning'}
                    </Button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>

        {/* Trust Badges Footer */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-on-surface-variant font-medium">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-teaching-emerald">lock</span>
            Secure Campus Auth
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-primary">group</span>
            100% Student-to-Student
          </span>
        </div>
      </div>

      {/* New Google User Onboarding Modal */}
      {showNewUserModal && pendingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface border border-outline-variant text-on-surface rounded-2xl p-6 max-w-md w-full shadow-elevation-3 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <img
                src={pendingUser.avatar || 'https://lh3.googleusercontent.com/a/default-user=s120-c'}
                alt={pendingUser.name}
                className="w-10 h-10 rounded-full border border-outline-variant object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-on-surface truncate">Welcome, {pendingUser.name}!</h3>
                <p className="text-xs text-on-surface-variant">Configure your peer learning profile</p>
              </div>
            </div>

            <form onSubmit={handleOnboardingSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-on-surface">Your Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'student', label: 'Student' },
                    { key: 'teacher', label: 'Teacher' },
                    { key: 'both', label: 'Both' }
                  ].map(r => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setOnboardRole(r.key as any)}
                      className={`py-2 px-3 rounded-xl border text-center text-xs font-semibold transition-all ${
                        onboardRole === r.key
                          ? 'border-primary bg-primary-container text-on-primary-container font-bold'
                          : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {(onboardRole === 'teacher' || onboardRole === 'both') && (
                <>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-on-surface">Skills you can Teach</label>
                    <input
                      type="text"
                      value={onboardTeaches}
                      onChange={(e) => setOnboardTeaches(e.target.value)}
                      className="w-full rounded-xl border border-outline-variant bg-surface text-xs font-medium text-on-surface p-2.5 outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-on-surface">Base Mentoring Rate (1-on-1 ₹/Hour)</label>
                    <input
                      type="number"
                      min={50}
                      max={10000}
                      step={50}
                      value={onboardHourlyRate}
                      onChange={(e) => handleBaseRateChange(Number(e.target.value), true)}
                      className="w-full rounded-xl border border-outline-variant bg-surface text-xs font-bold text-on-surface p-2.5 outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="block text-[11px] font-bold text-on-surface flex items-center justify-between">
                      <span>Batch Pricing (Per Student):</span>
                      <span className="text-[10px] text-teaching-emerald font-extrabold">All 5 Batches</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { cap: 1, label: '1-on-1', icon: 'person' },
                        { cap: 2, label: 'Duo (2)', icon: 'group' },
                        { cap: 3, label: 'Trio (3)', icon: 'groups' },
                        { cap: 4, label: 'Cohort (4)', icon: 'diversity_3' },
                        { cap: 5, label: 'Masterclass (5)', icon: 'school' }
                      ].map(tier => {
                        const seatPrice = onboardBatchPricing[tier.cap] ?? (tier.cap === 1 ? onboardHourlyRate : Math.round(onboardHourlyRate * (1 - tier.cap * 0.1)));
                        return (
                          <div key={tier.cap} className={`p-1.5 rounded-lg border border-outline-variant bg-surface-container-low ${tier.cap === 5 ? 'col-span-2' : ''}`}>
                            <div className="flex justify-between items-center text-[10px] font-bold mb-0.5">
                              <span className="flex items-center gap-0.5 text-on-surface">
                                <span className="material-symbols-outlined text-xs text-primary">{tier.icon}</span>
                                {tier.label}
                              </span>
                              <span className="text-teaching-emerald font-black">₹{seatPrice * tier.cap}/hr total</span>
                            </div>
                            <div className="relative">
                              <span className="absolute left-2 top-1 text-xs font-bold text-on-surface-variant">₹</span>
                              <input 
                                type="number"
                                min={25}
                                max={10000}
                                step={25}
                                value={seatPrice}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setOnboardBatchPricing(prev => ({ ...prev, [tier.cap]: val }));
                                  if (tier.cap === 1) setOnboardHourlyRate(val);
                                }}
                                className="w-full pl-5 pr-1 py-1 text-xs font-bold rounded border border-outline-variant bg-surface outline-none"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {(onboardRole === 'student' || onboardRole === 'both') && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-on-surface">Skills you want to Learn</label>
                  <input
                    type="text"
                    value={onboardLearns}
                    onChange={(e) => setOnboardLearns(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-surface text-xs font-medium text-on-surface p-2.5 outline-none focus:border-primary"
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full py-2.5 font-semibold text-xs rounded-xl shadow-elevation-1"
                variant="primary"
              >
                Complete Setup
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
