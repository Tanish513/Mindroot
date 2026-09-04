import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendUrl } from '../lib/env';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`${getBackendUrl()}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request password reset.');
      }

      setMessage(data.message || 'If an account exists with that email address, a password reset link has been sent.');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-container text-on-primary-container mb-4 shadow-elevation-1">
          <span className="material-symbols-outlined text-2xl">lock_reset</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight text-on-surface">Reset your password</h2>
        <p className="mt-2 text-xs font-semibold text-on-surface-variant max-w-xs mx-auto">
          Enter your registered email address and we'll send you a link to reset your password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface border border-outline-variant rounded-3xl p-6 sm:p-8 shadow-elevation-2">
          {message ? (
            <div className="space-y-4 text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-teaching-emerald-container text-on-teaching-emerald-container">
                <span className="material-symbols-outlined text-xl">mark_email_read</span>
              </div>
              <div className="bg-teaching-emerald-container/40 border border-teaching-emerald/20 text-on-teaching-emerald-container rounded-2xl p-4 text-xs font-bold leading-relaxed">
                {message}
              </div>
              <p className="text-[11px] text-on-surface-variant font-medium">
                Check your inbox (and spam folder). The link will expire in 60 minutes.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full mt-2 py-2.5 px-4 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-bold transition-all shadow-elevation-1"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-alert-rose-container border border-alert-rose/20 text-on-alert-rose-container rounded-xl p-3.5 text-xs font-semibold flex items-center gap-2 shadow-elevation-1">
                  <span className="material-symbols-outlined text-base shrink-0">error</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-on-surface">Email Address</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-3 text-on-surface-variant text-lg">mail</span>
                  <input
                    type="email"
                    required
                    placeholder="alex@gmail.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-surface rounded-xl border border-outline-variant text-sm font-medium text-on-surface placeholder:text-neutral-subtle outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-elevation-1 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-extrabold shadow-elevation-1 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">send</span>
                    <span>Send Reset Link</span>
                  </>
                )}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
