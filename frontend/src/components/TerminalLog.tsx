import { useEffect, useRef } from 'react';
import { Terminal, ShieldAlert } from 'lucide-react';

interface TerminalLogLine {
  message: string;
  status: 'running' | 'done' | 'completed' | 'failed' | 'idle' | 'analyzed';
  timestamp: string;
  isReasoning?: boolean;
}

interface TerminalLogProps {
  logs: TerminalLogLine[];
  title?: string;
}

export default function TerminalLog({ logs, title = "Data Pipeline Progress Terminal" }: TerminalLogProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Smooth auto-scroll
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className="border-2 rounded-lg p-4 shadow-glass font-mono text-xs overflow-hidden h-64 flex flex-col bg-black/85 border-borderGlow">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between border-b border-borderGlow pb-2 mb-3">
        <div className="flex items-center gap-2 text-gray-400">
          <Terminal className="w-4 h-4 text-accentPrimary" />
          <span className="font-semibold text-gray-300">{title}</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-600" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-600" />
        </div>
      </div>
      
      {/* Scrolling Text Container */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {logs.length === 0 ? (
          <div className="text-gray-500 italic py-2 flex items-center gap-2">
            <span>⟳ Standby: Pipeline trigger pending...</span>
          </div>
        ) : (
          logs.map((log, index) => {
            if (log.isReasoning) {
              return (
                <div key={index} className="my-2 select-none">
                  <details className="text-yellow-400 border border-yellow-500/25 bg-yellow-500/5 rounded-lg p-3 cursor-pointer">
                    <summary className="font-bold font-mono flex items-center gap-1.5 text-yellow-500 text-xs">
                      <span>🤖 Agent reasoning</span>
                    </summary>
                    <pre className="whitespace-pre-wrap text-[10px] mt-2 font-mono text-yellow-300/90 pl-3 border-l-2 border-yellow-500/30 overflow-x-auto">
                      {log.message}
                    </pre>
                  </details>
                </div>
              );
            }

            const isDone = log.status === 'done' || log.status === 'completed';
            const isFailed = log.status === 'failed';
            const isRunning = log.status === 'running';
            
            return (
              <div key={index} className="flex items-start gap-2 leading-relaxed">
                <span className="text-gray-600 select-none">[{log.timestamp}]</span>
                <span className={`flex-1 ${
                  isFailed 
                    ? 'text-red-500 font-bold' 
                    : isDone
                      ? 'text-green-400 font-medium'
                      : isRunning
                      ? 'text-blue-400 animate-pulse'
                        : 'text-gray-300'
                }`}>
                  {log.message}
                </span>
                
                {/* Visual state icons inside terminal */}
                {isDone && <span className="text-green-400 font-bold">✓ DONE</span>}
                {isFailed && <span className="text-red-500 font-bold flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> FAILED</span>}
                {isRunning && <span className="text-blue-400 font-bold animate-spin">⟳</span>}
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
