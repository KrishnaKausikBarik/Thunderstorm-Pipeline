import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth } from '../config/firebase';
import { CloudLightning, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();

  // Check if user is returning from an email link
  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let savedEmail = window.localStorage.getItem('emailForSignIn');
      if (!savedEmail) {
        // Fallback if user opened the link on a different device
        savedEmail = window.prompt('Please provide your email for confirmation');
      }
      if (savedEmail) {
        setLoading(true);
        signInWithEmailLink(auth, savedEmail, window.location.href)
          .then(() => {
            window.localStorage.removeItem('emailForSignIn');
            navigate('/app');
          })
          .catch((err) => {
            setError(err.message || 'Error signing in with email link');
          })
          .finally(() => setLoading(false));
      }
    }
  }, [navigate]);

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters long.';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter.';
    if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter.';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number.';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(pwd)) return 'Password must contain at least one special character.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isOtpMode) {
        const actionCodeSettings = {
          url: window.location.origin + '/login',
          handleCodeInApp: true,
        };
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        window.localStorage.setItem('emailForSignIn', email);
        setOtpSent(true);
        return;
      }

      if (isSignUp) {
        const pwdError = validatePassword(password);
        if (pwdError) {
          setError(pwdError);
          setLoading(false);
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/app');
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };
  const handleGoogleSignIn = async () => {
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/app');
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate with Google');
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
          <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-black/20 sm:mb-3"
            style={{
              boxShadow: "0 0 40px -10px rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <img src="/Logo2.svg" alt="Thunderstorm Logo" className="h-full w-full object-cover" />
          </div>
          <h2 className="text-lg font-extrabold tracking-wide uppercase sm:text-xl" style={{ color: 'var(--text-primary)' }}>
            {isOtpMode ? 'Email OTP' : isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="mt-1.5 text-xs leading-5 sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
            {isOtpMode ? 'Sign in securely without a password' : isSignUp ? 'Sign up to access the pipeline' : 'Enter your credentials to continue'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && (
            <div className="p-3 bg-accentRed/10 border border-accentRed/30 rounded-lg text-accentRed text-xs font-bold text-center">
              {error}
            </div>
          )}

          {otpSent && isOtpMode && (
            <div className="p-3 bg-successGreen/10 border border-successGreen/30 rounded-lg text-successGreen text-xs font-bold text-center">
              Login link sent! Please check your email inbox (and spam folder) to sign in.
            </div>
          )}

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

          {!isOtpMode && (
            <div className="space-y-1">
              <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-borderGlow bg-darkBg/50 py-2 pl-10 pr-10 text-sm text-white outline-none transition-all placeholder:text-gray-600 focus:border-accentPrimary focus:shadow-neon-primary"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-accentPrimary"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {isSignUp && (
                <p className="mt-1 px-1 text-3xs leading-4 text-gray-500">
                  Must be at least 8 chars, contain 1 uppercase, 1 lowercase, 1 number, and 1 special character.
                </p>
              )}
            </div>
          )}

          <button 
            disabled={loading || (otpSent && isOtpMode)}
            type="submit"
            className="btn-gradient flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-neon-primary hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 sm:text-sm"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                {isOtpMode ? 'Send Login Link' : isSignUp ? 'Sign Up' : 'Sign In'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
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
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign In with Google
        </button>
        
        {/* Email OTP Mode Toggle */}
        <button 
          onClick={() => { setIsOtpMode(!isOtpMode); setError(''); setOtpSent(false); }}
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-xl border border-borderGlow bg-transparent py-2.5 text-xs font-bold tracking-wider text-gray-300 transition-all hover:border-accentPrimary hover:text-white sm:mt-4 sm:text-sm"
        >
          <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
          {isOtpMode ? 'Use Password Instead' : 'Sign in with Email'}
        </button>

        {!isOtpMode && (
          <div className="mt-4 border-t border-borderGlow/50 pt-4 text-center sm:mt-5 sm:pt-5">
            <p className="text-xs text-gray-400 sm:text-sm">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button 
                onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
                className="text-accentPrimary font-bold hover:underline"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        )}

        </div>
      </div>
    </>
  );
}
