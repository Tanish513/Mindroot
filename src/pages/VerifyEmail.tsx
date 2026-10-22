import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { getBackendUrl } from '../lib/env';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { currentUser, setCurrentUser } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`${getBackendUrl()}/api/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to verify email.');
        }

        setSuccess(true);
        if (currentUser) {
          setCurrentUser({ ...currentUser, emailVerified: true });
        }
      } catch (err: any) {
        setError(err.message || 'Invalid or expired verification token.');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="bg-surface border border-outline-variant rounded-3xl p-8 shadow-elevation-2">
          {loading ? (
            <div className="space-y-4 py-6">
              <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
              <h2 className="text-lg font-black text-on-surface">Verifying Email Address...</h2>
              <p className="text-xs text-on-surface-variant font-medium">Please wait while we confirm your email token.</p>
            </div>
          ) : success ? (
            <div className="space-y-4 py-4">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-teaching-emerald-container text-on-teaching-emerald-container mb-2">
                <span className="material-symbols-outlined text-3xl">verified</span>
              </div>
              <h2 className="text-xl font-black text-on-surface">Email Verified!</h2>
              <p className="text-xs font-semibold text-on-surface-variant leading-relaxed">
                Your email address has been successfully confirmed. You now have full access to session bookings, mentor withdrawals, and peer matching!
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full mt-4 py-3 px-4 bg-primary text-on-primary rounded-xl text-xs font-extrabold shadow-elevation-1 transition-all hover:bg-primary-hover cursor-pointer"
              >
                Continue to Dashboard
              </button>
            </div>
          ) : !token ? (
            <div className="space-y-4 py-4" data-testid="verify-email-no-token">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary-container text-on-primary-container mb-2">
                <span className="material-symbols-outlined text-3xl">mark_email_unread</span>
              </div>
              <h2 className="text-xl font-black text-on-surface">Email Verification Link Required</h2>
              <p className="text-xs font-semibold text-on-surface-variant leading-relaxed">
                It looks like you arrived here without a verification token. To verify your email address, please click the link sent to your registered email inbox.
              </p>
              <p className="text-[11px] text-on-surface-variant/80 font-medium leading-relaxed">
                If you haven't received an email yet, please check your spam folder or sign in to your dashboard to request a new link.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  data-testid="return-home-btn"
                  onClick={() => navigate('/')}
                  className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-extrabold shadow-elevation-1 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">home</span>
                  <span>Return Home</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4" data-testid="verify-email-failed">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-alert-rose-container text-on-alert-rose-container mb-2">
                <span className="material-symbols-outlined text-3xl">gpp_maybe</span>
              </div>
              <h2 className="text-xl font-black text-on-surface">Verification Failed</h2>
              <div className="bg-alert-rose-container/50 border border-alert-rose/20 text-on-alert-rose-container rounded-2xl p-3.5 text-xs font-bold">
                {error || 'Invalid or expired verification token.'}
              </div>
              <p className="text-xs text-on-surface-variant font-medium">
                The link may have expired (24h limit) or already been used. You can request a new verification email from your dashboard.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => navigate('/login')}
                  className="flex-1 py-2.5 px-3 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 py-2.5 px-3 bg-primary text-on-primary rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
