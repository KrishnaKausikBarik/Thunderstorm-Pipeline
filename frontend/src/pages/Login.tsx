import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  GoogleAuthProvider, 
  signInWithRedirect, 
  getRedirectResult, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { showToast } from '../components/ToastContainer';

const API_BASE = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:8000' : '');

type AuthMode = 'login' | 'signup' | 'forgot_password' | 'verify_email';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<AuthMode>(location.state?.mode || 'login');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  useEffect(() => {
    if (auth.currentUser && !auth.currentUser.emailVerified && mode !== 'verify_email') {
      setMode('verify_email');
      setEmail(auth.currentUser.email || '');
    }
  }, [mode]);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setOtpDigits(['', '', '', '', '', '']);
  };

  const getFirebaseErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/user-not-found': return 'No user found with this email.';
      case 'auth/wrong-password': return 'Incorrect password.';
      case 'auth/email-already-in-use': return 'Email is already in use.';
      case 'auth/weak-password': return 'Password should be at least 6 characters.';
      case 'auth/invalid-credential': return 'Invalid email or password.';
      default: return 'Authentication failed. Please try again.';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      
      if (!userCred.user.emailVerified) {
        setMode('verify_email');
        setError('Please verify your email to continue.');
      } else {
        showToast('Signed in successfully!');
        navigate('/app');
      }
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    
    setLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCred.user, { displayName: name });
      await sendVerificationOtp(email);
      setMode('verify_email');
      setSuccess('Account created! Please check your email for the verification code.');
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email) {
      setError('Please enter your email first.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const sendVerificationOtp = async (targetEmail: string) => {
    const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to send verification email');
  };

  const handleResendOtp = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await sendVerificationOtp(email);
      setSuccess('Verification email resent! Check your inbox.');
      setOtpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend email');
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
      
      if (auth.currentUser) {
        await auth.currentUser.reload();
      }
      
      showToast('Email verified successfully!');
      navigate('/app');
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
      setOtpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'verify_email' && otpDigits.every(d => d !== '')) {
      handleVerifyOtp();
    }
  }, [otpDigits, mode]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);
    if (value && index < 5) otpInputRefs.current[index + 1]?.focus();
  };
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) otpInputRefs.current[index - 1]?.focus();
  };
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) newDigits[i] = pasted[i] || '';
    setOtpDigits(newDigits);
    const focusIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIdx]?.focus();
  };

  const renderHeader = () => {
    if (mode === 'login') return { title: 'Welcome back', subtitle: 'Please enter your details to sign in.' };
    if (mode === 'signup') return { title: 'Create account', subtitle: 'Join the platform today.' };
    if (mode === 'forgot_password') return { title: 'Reset Password', subtitle: "We'll send you a reset link." };
    return { title: 'Verify Email', subtitle: 'Enter the 6-digit code sent to your email.' };
  };

  const header = renderHeader();

  return (
    <div 
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm selection:bg-accentPrimary selection:text-white animate-fade-in"
      onClick={() => navigate('/')}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="glass-card-premium w-full max-w-[420px] p-6 sm:p-7 animate-slide-up relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Static Noise Overlay */}
          <div className="bg-noise"></div>
          
          <div className="relative z-10">
            {/* Close Button */}
            <button 
              onClick={() => navigate('/')}
              className="absolute -right-2 -top-2 rounded-full p-2 text-gray-500 transition-colors hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Header */}
            <div className="mb-5 text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-accentPrimary/20 to-white/5 border border-white/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                <img src="/Logo2.svg" alt="Logo" className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold tracking-wide text-white mb-0.5">
                {header.title}
              </h2>
              <p className="text-[12px] text-gray-400">
                {header.subtitle}
              </p>
            </div>

            <form 
              onSubmit={
                mode === 'login' ? handleLogin : 
                mode === 'signup' ? handleSignUp : 
                mode === 'forgot_password' ? handleForgotPassword : 
                (e) => e.preventDefault()
              } 
              className="space-y-4"
            >
              {error && (
                <div className="p-3 bg-accentRed/10 border border-accentRed/20 rounded-xl text-accentRed text-xs font-medium text-center">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-successGreen/10 border border-successGreen/20 rounded-xl text-successGreen text-xs font-medium text-center">
                  {success}
                </div>
              )}

              {/* Normal Form Fields */}
              {mode !== 'verify_email' && (
                <div className="space-y-2">
                  {mode === 'signup' && (
                    <div className="relative bg-[#13141c] rounded-xl p-2 px-3 border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.4)] focus-within:border-accentPrimary/50 focus-within:bg-[#1a1b26] transition-colors">
                      <label className="text-[9px] text-gray-500 font-medium block mb-0.5">Full Name</label>
                      <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="bg-transparent text-[13px] text-white outline-none w-full placeholder-gray-600"
                        placeholder="John Doe"
                      />
                    </div>
                  )}

                  <div className="relative bg-[#13141c] rounded-xl p-2 px-3 border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.4)] focus-within:border-accentPrimary/50 focus-within:bg-[#1a1b26] transition-colors">
                    <label className="text-[9px] text-gray-500 font-medium block mb-0.5">Email</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-transparent text-[13px] text-white outline-none w-full placeholder-gray-600"
                      placeholder="name@example.com"
                    />
                  </div>

                  {(mode === 'login' || mode === 'signup') && (
                    <div className="relative bg-[#13141c] rounded-xl p-2 px-3 border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.4)] focus-within:border-accentPrimary/50 focus-within:bg-[#1a1b26] transition-colors">
                      <label className="text-[9px] text-gray-500 font-medium block mb-0.5">Password</label>
                      <div className="flex items-center">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className={`bg-transparent text-[13px] text-white outline-none w-full placeholder-gray-600 ${!showPassword && password ? 'tracking-widest' : ''}`}
                          placeholder="••••••••"
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="ml-2 p-1 text-gray-500 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === 'signup' && (
                    <div className="relative bg-[#13141c] rounded-xl p-2 px-3 border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.4)] focus-within:border-accentPrimary/50 focus-within:bg-[#1a1b26] transition-colors">
                      <label className="text-[9px] text-gray-500 font-medium block mb-0.5">Confirm Password</label>
                      <div className="flex items-center">
                        <input 
                          type={showConfirmPassword ? "text" : "password"} 
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className={`bg-transparent text-[13px] text-white outline-none w-full placeholder-gray-600 ${!showConfirmPassword && confirmPassword ? 'tracking-widest' : ''}`}
                          placeholder="••••••••"
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="ml-2 p-1 text-gray-500 hover:text-white transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Login Options (Remember Me & Forgot Password) */}
              {mode === 'login' && (
                <div className="flex items-center justify-between px-1 pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="peer appearance-none w-4 h-4 rounded-[4px] border border-gray-600 bg-transparent checked:bg-accentPrimary checked:border-accentPrimary transition-all cursor-pointer"
                      />
                      <svg className="absolute w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 14 10" fill="none">
                        <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">Remember me</span>
                  </label>
                  <button 
                    type="button" 
                    onClick={() => switchMode('forgot_password')}
                    className="text-xs font-medium text-gray-400 hover:text-white transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* OTP Input Fields */}
              {mode === 'verify_email' && (
                <div className="space-y-4 pt-2">
                  <div className="flex justify-between gap-2" onPaste={handleOtpPaste}>
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
                        className="h-14 w-full rounded-xl border border-white/10 bg-[#13141c] shadow-[inset_0_2px_10px_rgba(0,0,0,0.4)] text-center text-xl font-semibold text-white outline-none transition-colors focus:border-accentPrimary focus:bg-[#1a1b26]"
                      />
                    ))}
                  </div>
                  <p className="text-center text-[12px] text-gray-400">
                    Sent to <span className="text-white font-medium">{email}</span>
                  </p>
                </div>
              )}

              {/* Submit Button */}
              {mode !== 'verify_email' && (
                <button 
                  disabled={loading}
                  type="submit"
                  className="w-full btn-gradient-shift text-white font-medium py-2.5 rounded-xl shadow-[0_0_20px_-5px_var(--accent-primary)] flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
                    </>
                  )}
                </button>
              )}

              {/* Verification Actions */}
              {mode === 'verify_email' && (
                <div className="flex flex-col gap-3 mt-6">
                  {loading && (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Loader2 className="w-5 h-5 animate-spin text-accentPrimary" />
                      <span className="text-sm font-medium text-gray-400">Verifying...</span>
                    </div>
                  )}
                  {!loading && (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="w-full text-center text-sm font-medium text-gray-400 transition-colors hover:text-white"
                    >
                      Didn't receive it? <span className="text-accentPrimary hover:underline">Resend</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      auth.signOut();
                      switchMode('login');
                    }}
                    className="w-full text-center text-xs font-medium text-gray-500 hover:text-gray-400 transition-colors pt-2"
                  >
                    Use a different account
                  </button>
                </div>
              )}
            </form>

            {/* Social Divider */}
            {mode === 'login' && (
              <>
                <div className="my-4 flex items-center gap-4">
                  <div className="h-px flex-1 bg-white/5"></div>
                  <span className="text-[9px] uppercase tracking-widest text-gray-500 font-medium">OR</span>
                  <div className="h-px flex-1 bg-white/5"></div>
                </div>

                {/* Social Buttons Container */}
                <div className="space-y-2">
                  {/* Google Button */}
                  <button 
                    onClick={() => signInWithRedirect(auth, new GoogleAuthProvider())}
                    type="button"
                    className="group flex w-full items-center justify-between rounded-xl bg-[#13141c] p-2.5 px-4 border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] transition-all hover:bg-[#1a1b26] hover:border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <span className="text-[13px] font-medium text-gray-300 group-hover:text-white transition-colors">
                        Continue with Google
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                  </button>

                  {/* GitHub Placeholder Button (As shown in mockup) */}
                  <button 
                    type="button"
                    onClick={() => showToast('GitHub Login coming soon!')}
                    className="group flex w-full items-center justify-between rounded-xl bg-[#13141c] p-2.5 px-4 border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] transition-all hover:bg-[#1a1b26] hover:border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .33.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                      <span className="text-[13px] font-medium text-gray-300 group-hover:text-white transition-colors">
                        Continue with GitHub
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                  </button>
                </div>
              </>
            )}

            {/* Mode Switcher */}
            {mode !== 'verify_email' && (
              <div className="mt-5 text-center">
                {mode === 'login' ? (
                  <p className="text-[12px] text-gray-500">
                    Don't have an account?{' '}
                    <button type="button" onClick={() => switchMode('signup')} className="font-semibold text-accentPrimary hover:text-white transition-colors underline decoration-accentPrimary/30 underline-offset-4">
                      Create Account
                    </button>
                  </p>
                ) : (
                  <p className="text-[12px] text-gray-500">
                    Already have an account?{' '}
                    <button type="button" onClick={() => switchMode('login')} className="font-semibold text-accentPrimary hover:text-white transition-colors underline decoration-accentPrimary/30 underline-offset-4">
                      Sign In
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
