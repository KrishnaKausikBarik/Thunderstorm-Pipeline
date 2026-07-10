import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000' : '');

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your AI meteorological assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to state
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get response');
      }

      const data = await response.json();
      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `Sorry, I encountered an error: ${err.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end pointer-events-none">
      
      {/* Chat Window */}
      <div 
        className={`pointer-events-auto transition-all duration-300 transform origin-bottom-right mb-4 ${
          isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-10 pointer-events-none absolute bottom-16 right-0'
        }`}
      >
        <div className="glass-card-premium relative overflow-hidden w-[350px] sm:w-[400px] h-[500px] max-h-[80vh] flex flex-col shadow-2xl rounded-2xl border border-white/10">
          <div className="bg-noise" />
          
          {/* Header */}
          <div className="relative z-10 flex items-center justify-between p-4 border-b border-white/10 bg-black/20 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accentPrimary to-accentSecondary flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.5)]">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">AI Assistant</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-medium">Online (Gemini)</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-white/10' : 'bg-gradient-to-tr from-accentPrimary/20 to-accentSecondary/20 border border-accentPrimary/30'
                }`}>
                  {msg.role === 'user' ? <User className="w-3.5 h-3.5 text-gray-300" /> : <Bot className="w-3.5 h-3.5 text-accentPrimary" />}
                </div>
                
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-accentPrimary text-white rounded-tr-sm' 
                    : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm whitespace-pre-wrap'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-accentPrimary/20 to-accentSecondary/20 border border-accentPrimary/30 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-accentPrimary" />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="relative z-10 p-4 border-t border-white/10 bg-black/20 backdrop-blur-md">
            <form onSubmit={handleSend} className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the data pipeline..."
                className="w-full bg-[#12121a]/80 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accentPrimary/50 focus:ring-1 focus:ring-accentPrimary/50 transition-all"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-1.5 rounded-lg text-accentPrimary hover:bg-accentPrimary/10 disabled:opacity-50 disabled:hover:bg-transparent transition-colors cursor-pointer"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
          
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto relative group flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-accentPrimary to-accentSecondary shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_40px_rgba(139,92,246,0.5)] hover:scale-105 transition-all duration-300 cursor-pointer"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-inherit blur-md opacity-60 group-hover:opacity-100 transition-opacity" />
        
        {isOpen ? (
          <X className="w-6 h-6 text-white relative z-10 transition-transform duration-300 rotate-90 group-hover:rotate-0" />
        ) : (
          <MessageSquare className="w-6 h-6 text-white relative z-10 transition-transform duration-300 group-hover:scale-110" />
        )}
      </button>

    </div>
  );
}
