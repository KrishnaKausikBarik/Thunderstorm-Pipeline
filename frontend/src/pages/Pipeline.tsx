import { useEffect, useState } from 'react';
import Stepper from '../components/Stepper';
import IngestionStep from '../components/IngestionStep';
import EDAStep from '../components/EDAStep';
import DerivedStep from '../components/DerivedStep';
import DimReductionStep from '../components/DimReductionStep';

import { useAuth } from '../contexts/AuthContext';

import { auth } from '../config/firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Satellite, Database, RotateCcw,
  FlaskConical, Layers, Cpu, CheckCircle2,
  ChevronRight, Activity, LogOut
} from 'lucide-react';

const STEPS = [
  {
    id: 1,
    label: 'Data Ingestion',
    short: 'Ingestion',
    desc: 'Fetch ERA5 & IMD data from satellite sources',
    icon: Satellite,
  },
  {
    id: 2,
    label: 'EDA & Preprocessing',
    short: 'EDA',
    desc: 'Detect and fix missing values, outliers',
    icon: Activity,
  },
  {
    id: 3,
    label: 'Derived Parameters',
    short: 'Derived',
    desc: 'Compute thermodynamic indices',
    icon: FlaskConical,
  },
  {
    id: 4,
    label: 'Dim Reduction',
    short: 'Reduction',
    desc: 'Eliminate multicollinearity via VIF',
    icon: Layers,
  },
];

export default function Pipeline() {
  const { currentUser } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  // Session management
  const [sessionId, setSessionId] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [unlockedSteps, setUnlockedSteps] = useState<number[]>([1]);

  // Intermediate files
  const [rawFilename, setRawFilename] = useState<string>('');
  const [cleanedFilename, setCleanedFilename] = useState<string>('');
  const [derivedFilename, setDerivedFilename] = useState<string>('');

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);


  // Initialize session from localStorage
  useEffect(() => {
    if (location.state?.freshLogin) {
      localStorage.removeItem('met_session_id');
      localStorage.removeItem('met_current_step');
      localStorage.removeItem('met_unlocked_steps');
      localStorage.removeItem('met_raw_filename');
      localStorage.removeItem('met_cleaned_filename');
      localStorage.removeItem('met_derived_filename');
      // Clear the state so a page refresh doesn't trigger this again
      navigate(location.pathname, { replace: true, state: {} });
    }

    let sessId = localStorage.getItem('met_session_id');
    if (!sessId) {
      sessId = 'session_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('met_session_id', sessId);
    }
    setSessionId(sessId);

    const savedStep = localStorage.getItem('met_current_step');
    if (savedStep) setCurrentStep(parseInt(savedStep));

    const savedUnlocked = localStorage.getItem('met_unlocked_steps');
    if (savedUnlocked) setUnlockedSteps(JSON.parse(savedUnlocked));

    const savedRaw = localStorage.getItem('met_raw_filename');
    if (savedRaw) setRawFilename(savedRaw);

    const savedCleaned = localStorage.getItem('met_cleaned_filename');
    if (savedCleaned) setCleanedFilename(savedCleaned);

    const savedDerived = localStorage.getItem('met_derived_filename');
    if (savedDerived) setDerivedFilename(savedDerived);
  }, []);

  const updateCurrentStep = (step: number) => {
    setCurrentStep(step);
    localStorage.setItem('met_current_step', step.toString());
  };

  const handleIngestSuccess = (filename: string) => {
    setRawFilename(filename);
    localStorage.setItem('met_raw_filename', filename);
    const nextUnlocked = Array.from(new Set([...unlockedSteps, 2]));
    setUnlockedSteps(nextUnlocked);
    localStorage.setItem('met_unlocked_steps', JSON.stringify(nextUnlocked));
    triggerToast('✓ Data Ingestion complete. EDA unlocked.', 'success');
    setTimeout(() => updateCurrentStep(2), 1200);
  };

  const handleEDASuccess = (filename: string) => {
    setCleanedFilename(filename);
    localStorage.setItem('met_cleaned_filename', filename);
    const nextUnlocked = Array.from(new Set([...unlockedSteps, 3]));
    setUnlockedSteps(nextUnlocked);
    localStorage.setItem('met_unlocked_steps', JSON.stringify(nextUnlocked));
    triggerToast('✓ Preprocessing applied. Derived Parameters unlocked.', 'success');
    setTimeout(() => updateCurrentStep(3), 1200);
  };

  const handleDerivedSuccess = (filename: string) => {
    setDerivedFilename(filename);
    localStorage.setItem('met_derived_filename', filename);
    const nextUnlocked = Array.from(new Set([...unlockedSteps, 4]));
    setUnlockedSteps(nextUnlocked);
    localStorage.setItem('met_unlocked_steps', JSON.stringify(nextUnlocked));
    triggerToast('✓ Parameters calculated. Dim Reduction unlocked.', 'success');
    setTimeout(() => updateCurrentStep(4), 1200);
  };

  const handleFinalSuccess = () => {
    triggerToast('✓ Final dataset generated successfully!', 'success');
  };

  const triggerToast = (message: string, type: 'success' | 'info' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleResetSession = () => {
    if (confirm('Reset the current pipeline session? All workspace steps will be cleared.')) {
      localStorage.removeItem('met_current_step');
      localStorage.removeItem('met_unlocked_steps');
      localStorage.removeItem('met_raw_filename');
      localStorage.removeItem('met_cleaned_filename');
      localStorage.removeItem('met_derived_filename');
      setCurrentStep(1);
      setUnlockedSteps([1]);
      setRawFilename('');
      setCleanedFilename('');
      setDerivedFilename('');
      triggerToast('Session reset.', 'info');
    }
  };

  const handleSignOut = async () => {
    await auth.signOut();
    navigate('/');
  };

  const maxUnlocked = Math.max(...unlockedSteps);
  const activeStep = STEPS.find(s => s.id === currentStep)!;

  return (
    <div
      className="relative min-h-screen flex flex-col selection:bg-accentPrimary selection:text-white"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="absolute top-4 right-4 z-[90]">
        <button
          onClick={handleSignOut}
          className="text-button glass group inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <span className="hidden sm:inline">Sign Out</span>
          <LogOut className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-20 right-4 z-[100] max-w-sm px-5 py-3 rounded-lg font-semibold text-sm shadow-2xl animate-fade-up border backdrop-blur-md ${
          toast.type === 'success'
            ? 'bg-emerald-500/90 border-emerald-400/50 text-white'
            : toast.type === 'error'
              ? 'bg-rose-500/90 border-rose-400/50 text-white'
              : 'bg-violet-500/90 border-violet-400/50 text-white'
        }`}>
          {toast.message}
        </div>
      )}



      {/* ── Layout: sidebar + main ── */}
      <div className="flex flex-1">

        {/* ════ LEFT SIDEBAR ════ */}
        <aside
          className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 fixed left-0 top-0 bottom-0 z-20 px-4 py-6 border-r overflow-y-auto"
          style={{
            backgroundColor: '#12121a',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Brand mark */}
          <div className="flex items-center gap-3 px-2 mb-8">
            <img 
              src="/Logo2.svg" 
              alt="Thunderstorm Logo" 
              className="h-9 w-9 rounded-lg object-cover" 
            />
            <div>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
                Thunderstorm
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Pipeline
              </p>
            </div>
          </div>

          {/* Pipeline Steps Nav */}
          <div className="mb-2 px-2">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
              Pipeline Stages
            </p>
          </div>

          <nav className="flex flex-col gap-1">
            {STEPS.map((step) => {
              const isActive = currentStep === step.id;
              const isUnlocked = unlockedSteps.includes(step.id);
              const isCompleted = isUnlocked && maxUnlocked > step.id;
              const Icon = step.icon;

              return (
                <button
                  key={step.id}
                  onClick={() => isUnlocked && updateCurrentStep(step.id)}
                  disabled={!isUnlocked}
                  className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
                    isActive
                      ? 'text-white btn-gradient-shift'
                      : isUnlocked
                        ? 'hover:opacity-90'
                        : 'opacity-35 cursor-not-allowed'
                  }`}
                  style={{
                    backgroundColor: 'transparent',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                  }}
                  onMouseEnter={e => {
                    if (!isActive && isUnlocked) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--border)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {/* Step icon / check */}
                  <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-white/20'
                      : isCompleted
                        ? 'bg-emerald-500/15'
                        : 'bg-white/5'
                  }`}
                    style={{ color: isActive ? '#fff' : isCompleted ? '#10b981' : 'var(--text-muted)' }}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate leading-tight">{step.label}</p>
                    <p className="text-[10px] truncate mt-0.5 opacity-70">{step.desc}</p>
                  </div>

                  {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />}
                </button>
              );
            })}
          </nav>

          {/* Divider */}
          <div className="mt-auto pt-6">
            <div className="h-px mb-4" style={{ backgroundColor: 'var(--border)' }} />

            {/* Session Info */}
            <div className="px-2 space-y-3">
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Session</p>
                  <p className="text-xs font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                    #{sessionId.slice(-8).toUpperCase()}
                  </p>
                </div>
              </div>
              {currentUser && (
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 shrink-0" style={{ color: '#10b981' }} />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>User</p>
                    <p className="text-xs font-semibold truncate max-w-[140px]" style={{ color: 'var(--text-primary)' }}>
                      {currentUser.displayName || currentUser.email}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-4 space-y-2">
              <button
                onClick={handleResetSession}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border"
                style={{
                  color: 'var(--text-muted)',
                  borderColor: 'var(--border)',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--border)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Session
              </button>
            </div>
          </div>
        </aside>

        {/* ════ MAIN CONTENT ════ */}
        <main className="flex-1 lg:ml-64 xl:ml-72 min-w-0">

          {/* ── Mobile Step Tabs ── */}
          <div className="flex lg:hidden overflow-x-auto gap-1 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            {STEPS.map((step) => {
              const isActive = currentStep === step.id;
              const isUnlocked = unlockedSteps.includes(step.id);
              const isCompleted = isUnlocked && maxUnlocked > step.id;
              return (
                <button
                  key={step.id}
                  onClick={() => isUnlocked && updateCurrentStep(step.id)}
                  disabled={!isUnlocked}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                    isActive
                      ? 'text-white border-transparent'
                      : isUnlocked
                        ? 'border-transparent'
                        : 'opacity-30 cursor-not-allowed border-transparent'
                  }`}
                  style={{
                    backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--border)',
                    color: isActive ? '#fff' : isCompleted ? '#10b981' : 'var(--text-secondary)',
                  }}
                >
                  {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <span>{step.id}</span>}
                  {step.short}
                </button>
              );
            })}
          </div>

          {/* ── Step Content ── */}
          <div className="p-4 sm:p-6 lg:p-8 xl:p-10">

            {/* Ambient glows */}
            <div className="fixed top-1/3 right-0 w-72 h-72 rounded-full blur-[120px] pointer-events-none opacity-30"
              style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15), transparent 70%)' }} />
            <div className="fixed bottom-1/3 left-1/3 w-72 h-72 rounded-full blur-[120px] pointer-events-none opacity-20"
              style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.15), transparent 70%)' }} />

            {/* Step header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}
                >
                  {(() => { const Icon = activeStep.icon; return <Icon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />; })()}
                </div>
                <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {activeStep.label}
                </h1>
              </div>
              <p className="text-sm ml-10" style={{ color: 'var(--text-secondary)' }}>
                {activeStep.desc}
              </p>
            </div>

            {/* Stepper bar (thin progress only, full stepper hidden — sidebar replaces it) */}
            <div className="hidden">
              <Stepper currentStep={currentStep} unlockedSteps={unlockedSteps} onStepClick={updateCurrentStep} />
            </div>

            {/* Step Content Card */}
            <div
              className="rounded-lg border relative overflow-hidden"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--border)',
                backdropFilter: 'blur(16px)',
              }}
            >
              {/* Subtle top gradient accent */}
              <div
                className="absolute inset-x-0 top-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)' }}
              />

              <div className="p-4 sm:p-6 lg:p-8 relative z-10">
                {currentStep === 1 && (
                  <div className="animate-fade-up">
                    <IngestionStep sessionId={sessionId} onIngestSuccess={handleIngestSuccess} />
                  </div>
                )}
                {currentStep === 2 && (
                  <div className="animate-fade-up">
                    <EDAStep sessionId={sessionId} rawFilename={rawFilename} onEDASuccess={handleEDASuccess} />
                  </div>
                )}
                {currentStep === 3 && (
                  <div className="animate-fade-up">
                    <DerivedStep sessionId={sessionId} cleanedFilename={cleanedFilename} onDerivedSuccess={handleDerivedSuccess} />
                  </div>
                )}
                {currentStep === 4 && (
                  <div className="animate-fade-up">
                    <DimReductionStep sessionId={sessionId} derivedFilename={derivedFilename} onFinalSuccess={handleFinalSuccess} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
