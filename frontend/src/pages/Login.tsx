import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signInWithCustomToken } from 'firebase/auth';
import { auth } from '../config/firebase';
import { Mail, ArrowRight, Loader2 } from 'lucide-react';
import { showToast } from '../components/ToastContainer';

const API_BASE = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:8000' : '');

export default function Login() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const navigate = useNavigate();

  // Handle Google Redirect Result on Mount
  useEffect(() => {
    getRedirectResult(auth).then((result) => {
      if (result) {
        showToast('Signed in with Google successfully!');
        navigate('/app');
      }
    }).catch((err) => {
      setError(`Google Sign-In Error: ${err.message}`);
    });
  }, [navigate]);

  // ── OTP handlers ──────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // digits only
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1); // single digit
    setOtpDigits(newDigits);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);
    // Focus the last filled input or the next empty one
    const focusIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIdx]?.focus();
  };

  const handleSendOtp = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email) { setError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to send OTP');
      setOtpSent(true);
      setOtpDigits(['', '', '', '', '', '']);
      setSuccess('OTP sent! Check your email inbox.');
      // Auto-focus first OTP input
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otp = otpDigits.join('');
    if (otp.length !== 6) { setError('Please enter all 6 digits.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Invalid OTP');
      // Sign in with the custom token from backend
      await signInWithCustomToken(auth, data.token);
      showToast('Signed in successfully!');
      navigate('/app');
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
      setOtpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    if (otpSent && otpDigits.every(d => d !== '')) {
      handleVerifyOtp();
    }
  }, [otpDigits, otpSent]);

  // ── Google Sign-In ────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      setError(`${err.code}: ${err.message}`);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-md selection:bg-accentPrimary selection:text-white animate-fade-in"
        onClick={() => navigate('/')}
      />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-3 pointer-events-none">
        <div
          className="glass-panel pointer-events-auto relative z-10 w-full max-w-[21.5rem] sm:max-w-sm rounded-[1.5rem] border p-4 sm:p-5 shadow-2xl animate-slide-up"
          style={{ borderColor: 'var(--border-glow)' }}
          onClick={(e) => e.stopPropagation()}
        >
        {/* Close Button */}
        <button 
          onClick={() => navigate('/')}
          className="absolute right-3 top-3 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        
        {/* Header */}
        <div className="mb-4 text-center sm:mb-5">
          <img src="/Logo2.svg" alt="Thunderstorm Logo" className="mx-auto mb-2.5 h-12 w-12 sm:mb-3" />
          <h2 className="text-lg font-extrabold tracking-wide uppercase sm:text-xl" style={{ color: 'var(--text-primary)' }}>
            Welcome Back
          </h2>
          <p className="mt-1.5 text-xs leading-5 sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
            {otpSent 
              ? 'Enter the 6-digit code sent to your email' 
              : "We'll send a verification code to your email"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={otpSent ? (e) => e.preventDefault() : handleSendOtp} className="space-y-3.5">
          {error && (
            <div className="p-3 bg-accentRed/10 border border-accentRed/30 rounded-lg text-accentRed text-xs font-bold text-center">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-successGreen/10 border border-successGreen/30 rounded-lg text-successGreen text-xs font-bold text-center">
              {success}
            </div>
          )}

          {/* Email field (shown when OTP not yet sent) */}
          {!otpSent && (
            <div className="space-y-1">
              <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-borderGlow bg-darkBg/50 py-2 pl-10 pr-3 text-sm text-white outline-none transition-all placeholder:text-gray-600 focus:border-accentPrimary focus:shadow-neon-primary"
                  placeholder="scientist@example.com"
                />
              </div>
            </div>
          )}

          {/* OTP 6-digit input */}
          {otpSent && (
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Verification Code</label>
              <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpInputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="h-12 w-10 rounded-lg border text-center text-lg font-bold text-white outline-none transition-all bg-darkBg/50 border-borderGlow focus:border-accentPrimary focus:shadow-neon-primary"
                  />
                ))}
              </div>
              <p className="text-center text-[10px] text-gray-500 mt-1">
                Sent to <span className="text-gray-300 font-semibold">{email}</span>
                {' · '}
                <button type="button" onClick={() => { setOtpSent(false); setOtpDigits(['','','','','','']); setError(''); setSuccess(''); }} className="text-accentPrimary hover:underline">
                  Change email
                </button>
              </p>
            </div>
          )}

          {/* Submit button (hidden when OTP digits are being entered — auto-submits) */}
          {!otpSent && (
            <button 
              disabled={loading}
              type="submit"
              className="btn-gradient flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-neon-primary hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 sm:text-sm"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  Send Code
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}

          {/* Loading state for OTP verification */}
          {otpSent && loading && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="w-5 h-5 animate-spin text-accentPrimary" />
              <span className="text-xs font-semibold text-gray-400">Verifying...</span>
            </div>
          )}

          {/* Resend OTP */}
          {otpSent && !loading && (
            <button
              type="button"
              onClick={handleSendOtp}
              className="w-full text-center text-xs font-semibold text-gray-400 transition-colors hover:text-accentPrimary"
            >
              Didn't receive the code? <span className="text-accentPrimary hover:underline">Resend</span>
            </button>
          )}
        </form>

        {/* Divider */}
        <div className="my-4 flex items-center gap-3 sm:my-5 sm:gap-4">
          <div className="h-px flex-1 bg-[color:var(--border-glow)]/50"></div>
          <span className="shrink-0 text-[10px] font-bold tracking-widest text-gray-500 sm:text-xs">Or continue with</span>
          <div className="h-px flex-1 bg-[color:var(--border-glow)]/50"></div>
        </div>

        {/* Google Button */}
        <button 
          onClick={handleGoogleSignIn}
          type="button"
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white py-2.5 text-xs font-extrabold tracking-wider text-black transition-all hover:-translate-y-0.5 hover:bg-gray-100 sm:text-sm"
        >
          <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign In with Google
        </button>
        </div>
      </div>
    </>
  );
}
