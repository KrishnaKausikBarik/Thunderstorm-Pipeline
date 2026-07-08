import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface HelpTooltipProps {
  title: string;
  description: string;
}

export default function HelpTooltip({ title, description }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="glass-panel rounded-3xl p-4 mb-6 transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-white hover:text-accentPrimary font-semibold text-sm transition-colors focus:outline-none"
      >
        <span className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-accentPrimary" />
          <span>{title}</span>
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      
      {isOpen && (
        <div className="mt-3 text-xs text-gray-400 leading-relaxed border-t border-borderGlow/50 pt-3 transition-opacity duration-300">
          {description}
        </div>
      )}
    </div>
  );
}
