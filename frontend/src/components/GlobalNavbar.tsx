import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ArrowRight, LogOut } from "lucide-react";
import { auth } from "../config/firebase";

export default function GlobalNavbar() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const handleAction = () => {
    if (currentUser) {
      navigate('/'); auth.signOut();
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 pointer-events-none">
      <div className="rounded-[22px] p-[1px] pointer-events-auto bg-gradient-to-b from-white/10 to-white/5 shadow-2xl">
        <nav className="flex w-full max-w-6xl items-center justify-between rounded-[21px] px-4 py-3 sm:px-6 gap-4 sm:gap-8 bg-black/50 backdrop-blur-[3px] border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">

          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img 
              src="/Logo2.svg" 
              alt="Thunderstorm Logo" 
              className="h-10 w-10 rounded-xl object-cover" 
            />
            <span
              className="text-nav font-black tracking-[0.22em] hidden sm:block"
              style={{ color: 'var(--text-primary)' }}
            >
              Thunderstorm Pipeline
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">




            {/* Auth CTA */}
            <button
              onClick={handleAction}
              className="text-button glass-nav-btn group inline-flex items-center gap-2 rounded-xl px-4 py-2 font-semibold text-white cursor-pointer"
            >
              {currentUser ? (
                <>
                  <span className="hidden sm:inline">Sign Out</span>
                  <LogOut className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
