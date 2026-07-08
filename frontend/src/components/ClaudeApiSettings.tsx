import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, X } from 'lucide-react';
import { fetchClaudeConfig, updateClaudeConfig } from '../utils/api';

interface ClaudeApiSettingsProps {
  open: boolean;
  onClose: () => void;
}

export default function ClaudeApiSettings({ open, onClose }: ClaudeApiSettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [configured, setConfigured] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;

    fetchClaudeConfig()
      .then((config) => {
        setConfigured(config.configured);
        setModel(config.model);
        setError(null);
        setSaved(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setSaved(false);
      });
  }, [open]);

  const handleClose = () => {
    setApiKey('');
    setShowKey(false);
    setError(null);
    setSaved(false);
    onClose();
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('Enter an Anthropic API key.');
      return;
    }

    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateClaudeConfig({
        api_key: apiKey.trim(),
        model,
      });
      setConfigured(result.configured);
      setApiKey('');
      setShowKey(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure Claude.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg glass-panel rounded-3xl shadow-glass">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-borderGlow">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-400/20 rounded-3xl">
              <KeyRound className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Claude API Configuration</h2>
              <p className="text-xs text-gray-500 mt-1">
                Used to generate the final AI Weather Summary.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-black/30 rounded-lg transition-colors"
            aria-label="Close Claude API settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold ${
            configured
              ? 'bg-green-500/10 border-green-500/25 text-green-300'
              : 'bg-yellow-500/10 border-yellow-500/25 text-yellow-300'
          }`}>
            {configured && <CheckCircle2 className="w-4 h-4" />}
            <span>{configured ? 'Claude API key is configured' : 'Claude API key is not configured'}</span>
          </div>

          <label className="block">
            <span className="block text-3xs font-bold uppercase tracking-wider text-gray-400 mb-2">
              Anthropic API Key
            </span>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={configured ? 'Enter a new key to replace the current key' : 'sk-ant-api03-...'}
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-darkBg border border-borderGlow rounded-lg px-3 py-3 pr-11 text-sm text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={() => setShowKey((visible) => !visible)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="block text-3xs font-bold uppercase tracking-wider text-gray-400 mb-2">
              Claude Model
            </span>
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="w-full bg-darkBg border border-borderGlow rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-indigo-400"
            >
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
              <option value="claude-opus-4-8">Claude Opus 4.8</option>
            </select>
          </label>

          <p className="text-3xs text-gray-500 leading-relaxed">
            The key is sent to this backend and kept in server memory only. It is not returned to
            the browser or stored in browser storage. Restarting the backend restores the value
            configured in the server environment.
          </p>

          {error && (
            <div className="rounded-lg border p-3 text-xs bg-red-500/10 border-red-500/25 text-red-300">
              {error}
            </div>
          )}
          {saved && (
            <div className="rounded-lg border p-3 text-xs bg-green-500/10 border-green-500/25 text-green-300">
              Claude API configuration updated successfully.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={handleClose}
              className="px-4 py-2.5 border border-borderGlow rounded-lg text-xs font-bold text-gray-400 hover:text-white hover:bg-black/20"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !apiKey.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-extrabold text-white flex items-center gap-2"
              style={{ color: '#ffffff' }}
            >
              {loading && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{configured ? 'Update Key' : 'Save Key'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
