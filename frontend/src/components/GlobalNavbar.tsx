import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Zap, ArrowRight, LogOut } from "lucide-react";
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
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 animate-fade-up pointer-events-none">
      <div className="glass-nav-wrapper rounded-[22px] p-[1px] transition-all duration-500 hover:glass-nav-wrapper-hover pointer-events-auto">
        <nav className="glass-nav backdrop-blur flex w-full max-w-6xl items-center justify-between rounded-[21px] px-4 py-3 sm:px-6 gap-4 sm:gap-8">

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
