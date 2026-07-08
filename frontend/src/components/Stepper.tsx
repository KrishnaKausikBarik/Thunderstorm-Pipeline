import { CheckCircle2 } from 'lucide-react';

interface StepperProps {
  currentStep: number; // 1 to 4
  unlockedSteps: number[]; // e.g. [1, 2]
  onStepClick: (step: number) => void;
}

const STEPS = [
  { id: 1, label: 'Data Ingestion', desc: 'Step 1' },
  { id: 2, label: 'EDA & Preprocessing', desc: 'Step 2' },
  { id: 3, label: 'Derived Parameters', desc: 'Step 3' },
  { id: 4, label: 'Dimensionality Reduction', desc: 'Step 4' },
];

export default function Stepper({ currentStep, unlockedSteps, onStepClick }: StepperProps) {
  const progressPercent = ((Math.max(...unlockedSteps) - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="glass-panel rounded-3xl p-4 sm:p-5 lg:p-6 mb-6 sm:mb-8 shadow-glass overflow-hidden w-full relative">
      <div className="absolute inset-0 bg-gradient-to-r from-accentPrimary/5 to-accentSecondary/5 pointer-events-none" />
      
      <div className="relative flex justify-between items-start w-full mx-auto sm:px-4">
        {/* Connection line background */}
        <div className="absolute top-5 left-[10%] right-[10%] sm:left-12 sm:right-12 h-0.5 bg-borderBg z-0 rounded-full" />
        
        {/* Connection line progress */}
        <div 
          className="absolute top-5 left-[10%] sm:left-12 h-0.5 bg-gradient-to-r from-accentPrimary to-successGreen z-0 transition-all duration-700 ease-out rounded-full shadow-[0_0_10px_rgba(139,92,246,0.5)]" 
          style={{ 
            width: progressPercent === 0 ? 0 : `calc(${progressPercent * 0.8}% + ${progressPercent > 0 ? '1rem' : '0'})` 
          }}
        />

        {STEPS.map((step) => {
          const isActive = currentStep === step.id;
          const isUnlocked = unlockedSteps.includes(step.id);
          const isCompleted = isUnlocked && Math.max(...unlockedSteps) > step.id;
          
          return (
            <button
              key={step.id}
              onClick={() => isUnlocked && onStepClick(step.id)}
              disabled={!isUnlocked}
              className={`relative z-10 flex flex-1 flex-col items-center group focus:outline-none transition-all duration-300 ${
                isUnlocked ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
              }`}
            >
              <div 
                className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center border-2 transition-all duration-500 step-transition relative ${
                  isActive 
                    ? 'bg-darkBg border-accentPrimary text-white shadow-neon-primary scale-110' 
                    : isCompleted
                      ? 'bg-successGreen/20 border-successGreen text-successGreen shadow-neon-success'
                      : isUnlocked
                        ? 'glass-panel border-gray-500 text-white hover:border-gray-300'
                        : 'bg-darkBg border-borderGlow text-gray-500'
                }`}
              >
                {/* Pulse ring for active step */}
                {isActive && (
                  <div className="absolute inset-0 rounded-full border-2 border-accentPrimary animate-ping opacity-20" />
                )}
                
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-bold font-mono">{step.id}</span>
                )}
              </div>
              
              <div className="mt-3 text-center px-1 hidden sm:block">
                <span className={`block text-[10px] uppercase tracking-widest font-bold transition-colors ${
                  isActive ? 'text-accentPrimary' : isCompleted ? 'text-successGreen' : 'text-gray-400'
                }`}>
                  {step.desc}
                </span>
                <span className={`block text-xs sm:text-sm font-semibold transition-colors mt-1 leading-tight ${
                  isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'
                }`}>
                  {step.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Mobile Current Step Label */}
      <div className="mt-4 text-center sm:hidden">
        <span className="block text-[10px] uppercase tracking-widest font-bold text-accentPrimary">
          {STEPS.find(s => s.id === currentStep)?.desc}
        </span>
        <span className="block text-sm font-semibold text-white mt-0.5">
          {STEPS.find(s => s.id === currentStep)?.label}
        </span>
      </div>
    </div>
  );
}
