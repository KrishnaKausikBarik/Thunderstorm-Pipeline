import { HelpCircle } from 'lucide-react';

interface InlineTooltipProps {
  text: string;
}

export default function InlineTooltip({ text }: InlineTooltipProps) {
  return (
    <div className="relative group inline-flex items-center ml-1">
      <HelpCircle className="w-3.5 h-3.5 text-accentPrimary cursor-help opacity-70 hover:opacity-100 transition-opacity" />
      
      {/* Tooltip Popup */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-darkBg border border-borderGlow rounded-lg shadow-glass text-[10px] text-gray-300 font-normal leading-relaxed text-center opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
        {text}
        {/* Triangle pointer */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-darkBg border-b border-r border-borderGlow transform rotate-45 -mt-[5px]" />
      </div>
    </div>
  );
}
