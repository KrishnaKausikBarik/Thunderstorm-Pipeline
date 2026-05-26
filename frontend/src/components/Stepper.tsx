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
  return (
    <div className="bg-cardBg border border-borderBg rounded-2xl p-6 mb-8 shadow-xl">
      <div className="relative flex justify-between items-center max-w-5xl mx-auto">
        {/* Connection line background */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-borderBg -translate-y-1/2 z-0" />
        
        {/* Connection line progress */}
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-accentRed to-successGreen -translate-y-1/2 z-0 transition-all duration-500" 
          style={{ 
            width: `${((Math.max(...unlockedSteps) - 1) / (STEPS.length - 1)) * 100}%` 
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
              className={`relative z-10 flex flex-col items-center group focus:outline-none transition-all duration-300 ${
                isUnlocked ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'
              }`}
            >
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 step-transition ${
                  isActive 
                    ? 'bg-darkBg border-accentRed text-white shadow-[0_0_15px_rgba(229,62,62,0.6)] scale-110' 
                    : isCompleted
                      ? 'bg-successGreen/25 border-successGreen text-successGreen shadow-[0_0_10px_rgba(56,161,105,0.3)]'
                      : isUnlocked
                        ? 'bg-cardBg border-gray-400 text-white'
                        : 'bg-darkBg border-borderBg text-gray-500'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-bold">{step.id}</span>
                )}
              </div>
              
              <div className="mt-3 text-center">
                <span className={`block text-xs uppercase tracking-wider font-bold ${
                  isActive ? 'text-accentRed' : isCompleted ? 'text-successGreen' : 'text-gray-400'
                }`}>
                  {step.desc}
                </span>
                <span className={`block text-sm font-semibold transition-colors mt-0.5 ${
                  isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'
                }`}>
                  {step.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
