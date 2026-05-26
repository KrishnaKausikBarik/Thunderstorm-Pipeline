import { useEffect, useState } from 'react';
import Stepper from './components/Stepper';
import IngestionStep from './components/IngestionStep';
import EDAStep from './components/EDAStep';
import DerivedStep from './components/DerivedStep';
import DimReductionStep from './components/DimReductionStep';
import { CloudLightning, Satellite, Database } from 'lucide-react';

export default function App() {
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
    let sessId = localStorage.getItem('met_session_id');
    if (!sessId) {
      sessId = 'session_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('met_session_id', sessId);
    }
    setSessionId(sessId);

    // Load pipeline states if present
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

  // Sync state changes with localStorage
  const updateCurrentStep = (step: number) => {
    setCurrentStep(step);
    localStorage.setItem('met_current_step', step.toString());
  };

  const handleIngestSuccess = (filename: string) => {
    setRawFilename(filename);
    localStorage.setItem('met_raw_filename', filename);
    
    // Unlock step 2
    const nextUnlocked = Array.from(new Set([...unlockedSteps, 2]));
    setUnlockedSteps(nextUnlocked);
    localStorage.setItem('met_unlocked_steps', JSON.stringify(nextUnlocked));
    
    triggerToast("✓ Data Ingestion Pipeline completed! Step 2 EDA unlocked.", "success");
    // Move to step 2 automatically
    setTimeout(() => updateCurrentStep(2), 1200);
  };

  const handleEDASuccess = (filename: string) => {
    setCleanedFilename(filename);
    localStorage.setItem('met_cleaned_filename', filename);
    
    // Unlock step 3
    const nextUnlocked = Array.from(new Set([...unlockedSteps, 3]));
    setUnlockedSteps(nextUnlocked);
    localStorage.setItem('met_unlocked_steps', JSON.stringify(nextUnlocked));

    triggerToast("✓ Preprocessing applied successfully! Step 3 Derived Parameters unlocked.", "success");
    // Move to step 3 automatically
    setTimeout(() => updateCurrentStep(3), 1200);
  };

  const handleDerivedSuccess = (filename: string) => {
    setDerivedFilename(filename);
    localStorage.setItem('met_derived_filename', filename);
    
    // Unlock step 4
    const nextUnlocked = Array.from(new Set([...unlockedSteps, 4]));
    setUnlockedSteps(nextUnlocked);
    localStorage.setItem('met_unlocked_steps', JSON.stringify(nextUnlocked));

    triggerToast("✓ Derived parameters calculated! Step 4 Dimensionality Reduction unlocked.", "success");
    // Move to step 4 automatically
    setTimeout(() => updateCurrentStep(4), 1200);
  };

  const handleFinalSuccess = () => {
    triggerToast("✓ Multicollinearity optimization applied successfully! Final dataset generated.", "success");
  };

  const triggerToast = (message: string, type: 'success' | 'info' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleResetSession = () => {
    if (confirm("Are you sure you want to reset the current pipeline session? All local workspace steps will be cleared.")) {
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
      
      triggerToast("Pipeline session reset.", "info");
    }
  };

  return (
    <div className="min-h-screen bg-darkBg text-gray-100 flex flex-col font-sans selection:bg-accentRed selection:text-white">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-2xl transition-all animate-bounce ${
          toast.type === 'success' 
            ? 'bg-successGreen border border-green-400 text-white' 
            : toast.type === 'error'
              ? 'bg-accentRed border border-red-400 text-white'
              : 'bg-blue-600 border border-blue-400 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-borderBg bg-cardBg/90 backdrop-blur sticky top-0 z-40 px-8 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <CloudLightning className="w-6 h-6 text-accentRed animate-pulse" />
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-widest uppercase flex items-center gap-2">
              <span>Meteorological Ingestion & Pipeline</span>
              <span className="bg-accentRed/10 border border-accentRed/30 px-1.5 py-0.5 rounded text-4xs font-bold text-accentRed tracking-normal">V1.0</span>
            </h1>
            <p className="text-4xs text-gray-500 font-bold uppercase tracking-wider">Atmospheric Data Co-Registration & Dimensionality Optimization</p>
          </div>
        </div>

        {/* Global Connection state badge */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-3xs font-bold uppercase tracking-wider text-gray-400">
            <div className="flex items-center gap-1.5">
              <Satellite className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden md:inline">SATELLITE LINK: ACTIVE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-successGreen" />
              <span className="hidden md:inline">SESSION ID: <span className="font-mono text-gray-300">{sessionId.slice(-6)}</span></span>
            </div>
          </div>
          
          <button 
            onClick={handleResetSession}
            className="px-3 py-1.5 border border-borderBg hover:bg-black/20 text-gray-400 hover:text-white rounded font-bold text-3xs uppercase tracking-wider transition-all"
          >
            Reset Session
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto w-full p-8 flex-1 flex flex-col justify-start">
        
        {/* Horizontal stepper (always visible) */}
        <Stepper 
          currentStep={currentStep} 
          unlockedSteps={unlockedSteps} 
          onStepClick={updateCurrentStep} 
        />

        {/* Step contents render */}
        <div className="bg-cardBg/35 border border-borderBg/50 rounded-3xl p-8 shadow-xl flex-1 backdrop-blur-md">
          {currentStep === 1 && (
            <IngestionStep 
              sessionId={sessionId} 
              onIngestSuccess={handleIngestSuccess} 
            />
          )}

          {currentStep === 2 && (
            <EDAStep 
              sessionId={sessionId} 
              rawFilename={rawFilename} 
              onEDASuccess={handleEDASuccess} 
            />
          )}

          {currentStep === 3 && (
            <DerivedStep 
              sessionId={sessionId} 
              cleanedFilename={cleanedFilename} 
              onDerivedSuccess={handleDerivedSuccess} 
            />
          )}

          {currentStep === 4 && (
            <DimReductionStep 
              sessionId={sessionId} 
              derivedFilename={derivedFilename} 
              onFinalSuccess={handleFinalSuccess} 
            />
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-borderBg bg-cardBg/20 py-4 text-center text-4xs font-bold text-gray-500 uppercase tracking-widest mt-12">
        <span>⛈️ Thunderstorm Data Processing & Preprocessing Platform &copy; 2026</span>
      </footer>

    </div>
  );
}
