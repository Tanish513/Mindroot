import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getBackendUrl } from '../lib/env';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Missing or invalid password reset token.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${getBackendUrl()}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Token may be expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-container text-on-primary-container mb-4 shadow-elevation-1">
          <span className="material-symbols-outlined text-2xl">key</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight text-on-surface">Set new password</h2>
        <p className="mt-2 text-xs font-semibold text-on-surface-variant max-w-xs mx-auto">
          Please enter your new password below. Must be at least 6 characters.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface border border-outline-variant rounded-3xl p-6 sm:p-8 shadow-elevation-2">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-teaching-emerald-container text-on-teaching-emerald-container">
                <span className="material-symbols-outlined text-2xl">check_circle</span>
              </div>
              <h3 className="text-base font-extrabold text-on-surface">Password Reset Successful!</h3>
              <p className="text-xs text-on-surface-variant font-medium">
                Your password has been updated. Redirecting you to sign in...
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full mt-2 py-2.5 px-4 bg-primary text-on-primary rounded-xl text-xs font-bold transition-all shadow-elevation-1"
              >
                Sign In Now
              </button>
            </div>
          ) : !token ? (
            <div className="space-y-4 text-center">
              <div className="bg-alert-rose-container text-on-alert-rose-container border border-alert-rose/20 rounded-2xl p-4 text-xs font-bold">
                Invalid or missing reset token. Please request a new password reset link.
              </div>
              <button
                onClick={() => navigate('/forgot-password')}
                className="w-full py-2.5 px-4 bg-primary text-on-primary rounded-xl text-xs font-bold transition-all shadow-elevation-1"
              >
                Request Password Reset
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
                <label className="block text-xs font-bold text-on-surface">New Password</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-3 text-on-surface-variant text-lg">lock</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Enter new password (min 6 chars)..."
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-2.5 bg-surface rounded-xl border border-outline-variant text-sm font-medium text-on-surface placeholder:text-neutral-subtle outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-elevation-1 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-2.5 text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-on-surface">Confirm New Password</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-3 text-on-surface-variant text-lg">lock_reset</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Re-enter new password..."
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-2.5 bg-surface rounded-xl border border-outline-variant text-sm font-medium text-on-surface placeholder:text-neutral-subtle outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-elevation-1 transition-all"
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
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">check</span>
                    <span>Reset Password</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
