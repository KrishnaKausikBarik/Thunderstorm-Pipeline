import { useEffect, useState } from 'react';
import { Play, Download, AlertTriangle } from 'lucide-react';
import { fetchDerivedCatalog, getDownloadUrl } from '../utils/api';
import HelpTooltip from './HelpTooltip';
import PreviewTable from './PreviewTable';
import type { FormulaCatalogItem } from '../types';

interface DerivedStepProps {
  sessionId: string;
  cleanedFilename: string;
  onDerivedSuccess: (derivedFilename: string) => void;
}

export default function DerivedStep({ sessionId, cleanedFilename, onDerivedSuccess }: DerivedStepProps) {
  const [catalog, setCatalog] = useState<FormulaCatalogItem[]>([]);
  const [selectedParams, setSelectedParams] = useState<string[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [computing, setComputing] = useState(false);
  const [results, setResults] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Refresh counter to reload preview
  const [previewRefresh, setPreviewRefresh] = useState(0);

  // Auto-fetch catalog on load
  useEffect(() => {
    if (!cleanedFilename) return;
    
    async function loadCatalog() {
      setLoadingCatalog(true);
      setError(null);
      try {
        const res = await fetchDerivedCatalog({
          file_path: cleanedFilename,
          session_id: sessionId,
          selected_params: [] // empty list query returns only catalog status
        });
        
        setCatalog(res.catalog || []);
        
        // Pre-select all available ones by default
        const availableKeys = (res.catalog as FormulaCatalogItem[])
          .filter(item => item.available)
          .map(item => item.key);
        setSelectedParams(availableKeys);
        
      } catch (err: any) {
        setError(err.message || 'Failed to fetch derived catalog');
      } finally {
        setLoadingCatalog(false);
      }
    }

    loadCatalog();
  }, [cleanedFilename, sessionId]);

  const handleCheckboxToggle = (key: string) => {
    setSelectedParams(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSelectAllAvailable = () => {
    const availableKeys = catalog.filter(item => item.available).map(item => item.key);
    setSelectedParams(availableKeys);
  };

  const handleComputeParameters = async () => {
    if (selectedParams.length === 0 || computing) return;
    setComputing(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetchDerivedCatalog({
        file_path: cleanedFilename,
        session_id: sessionId,
        selected_params: selectedParams
      });

      if (res.status === 'success') {
        setResults(res);
        onDerivedSuccess(res.derived_file);
        setPreviewRefresh(p => p + 1);
      } else {
        throw new Error(res.message || 'Calculation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to compute parameters');
    } finally {
      setComputing(false);
    }
  };

  return (
    <div>
      <HelpTooltip 
        title="What are Derived Parameters & Convective Indices?"
        description="The derived parameters engine calculates physically essential atmospheric and thermodynamic indexes. It maps case-insensitive column headers to standard levels. For example, K-Index evaluates thermodynamic instability using temperature and dewpoint values at 850hPa, 700hPa, and 500hPa. If inputs are missing, formulas are disabled with tooltips indicating the missing dependencies."
      />

      {loadingCatalog ? (
        <div className="glass-panel rounded-3xl p-6 sm:p-12 flex flex-col items-center justify-center text-center min-h-[260px] sm:min-h-[300px]">
          <div className="w-10 h-10 border-4 border-accentPrimary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-gray-400">Inspecting cleaned CSV and loading physical formula database...</p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* CATALOG TABLE BOX */}
          <div className="glass-panel rounded-3xl overflow-hidden shadow-glass">
            <div className="px-4 sm:px-6 py-4 border-b border-borderGlow flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-black/20">
              <div>
                <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">Derived Parameters Catalog</h3>
                <p className="text-3xs text-gray-400 mt-0.5">Vectorized calculations mapped dynamically to active dataset column profiles.</p>
              </div>
              
              <button
                onClick={handleSelectAllAvailable}
                disabled={catalog.filter(i => i.available).length === 0}
                className="w-full sm:w-auto px-4 py-2 border border-borderGlow hover:bg-black/20 text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40"
              >
                Select All Available
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-borderBg text-left text-xs">
                <thead className="bg-black/25">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Parameter Name</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Physical Formulation</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Required Inputs</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center w-28">Add to Dataset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderBg">
                  {catalog.map((item) => {
                    const active = selectedParams.includes(item.key);
                    return (
                      <tr key={item.key} className="hover:bg-gray-800/20 transition-colors">
                        {/* Name */}
                        <td className="px-6 py-4 font-bold text-white whitespace-nowrap text-sm">{item.name}</td>
                        {/* Formula */}
                        <td className="px-6 py-4 font-mono text-gray-400 text-2xs max-w-xs truncate" title={item.formula}>{item.formula}</td>
                        {/* Inputs */}
                        <td className="px-6 py-4 text-gray-400">
                          <div className="flex flex-wrap gap-1">
                            {item.inputs_required.map(inp => {
                              const isMissing = item.missing_inputs.includes(inp);
                              return (
                                <span 
                                  key={inp} 
                                  className={`px-1 rounded text-3xs font-mono font-semibold border ${
                                    isMissing 
                                      ? 'border-red-900/40 text-red-500 bg-red-950/20' 
                                      : 'border-borderGlow text-gray-300 bg-darkBg/60'
                                  }`}
                                >
                                  {inp}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        {/* Status ✅ / ❌ */}
                        <td className="px-6 py-4 text-center">
                          {item.available ? (
                            <span className="text-successGreen font-extrabold text-sm">✅</span>
                          ) : (
                            <span 
                              className="text-accentPrimary font-extrabold text-sm cursor-pointer select-none inline-flex items-center gap-1 group relative"
                              title={`Missing: ${item.missing_inputs.join(', ')}`}
                            >
                              <span>❌</span>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 rounded bg-black border border-borderGlow text-3xs text-gray-400 font-normal leading-normal shadow-glass opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all z-20">
                                <span className="font-bold text-accentPrimary">Missing columns:</span>
                                <div className="mt-1 font-mono text-[10px] text-gray-300">{item.missing_inputs.join(', ')}</div>
                              </div>
                            </span>
                          )}
                        </td>
                        {/* Add checkbox */}
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="checkbox"
                            checked={active}
                            disabled={!item.available}
                            onChange={() => handleCheckboxToggle(item.key)}
                            className="w-4 h-4 accent-successGreen disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trigger calculations */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-4 text-accentPrimary text-xs flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-accentPrimary shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-center mt-6">
            <button
              onClick={handleComputeParameters}
              disabled={selectedParams.length === 0 || computing}
              className={`w-full sm:w-auto justify-center px-5 sm:px-8 py-4 rounded-3xl font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-3 transition-all duration-300 ${
                selectedParams.length === 0 || computing
                  ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                  : 'bg-accentPrimary hover:bg-accentPrimaryHover text-white shadow-glass shadow-accentPrimary/30 hover:scale-105'
              }`}
            >
              {computing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Computing Formulas...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Compute Selected Derived Parameters</span>
                </>
              )}
            </button>
          </div>

          {/* SUCCESS BOX & DOWNLOAD ON COMPLETE */}
          {results && (
            <div>
              <div className="glass-panel p-6 rounded-3xl shadow-glass flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="text-successGreen">✓</span> CALCULATIONS COMPLETE
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">{results.message}</p>
                  <p className="text-2xs text-gray-500 mt-1 font-semibold">New Dataset shape: <span className="text-white font-mono">{results.stats.shape[0]} rows x {results.stats.shape[1]} columns</span>.</p>
                </div>
                
                <a 
                  href={getDownloadUrl(results.derived_file, sessionId)}
                  className="w-full md:w-auto justify-center px-5 sm:px-6 py-3 bg-successGreen hover:bg-successGreenHover text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-successGreen/25 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Dataset with Derived Parameters (CSV)</span>
                </a>
              </div>

              <PreviewTable filename={results.derived_file} sessionId={sessionId} refreshTrigger={previewRefresh} />
            </div>
          )}

        </div>
      )}
    </div>
  );
}
