import { useEffect, useState } from 'react';
import { Download, Lock, CheckCircle, ArrowRight, ArrowLeft, AlertTriangle, CloudLightning } from 'lucide-react';
import { analyzeDimensionality, finalizeDimensionality, getDownloadUrl } from '../utils/api';
import Plotly from 'plotly.js-dist-min';
import _createPlotlyComponent from 'react-plotly.js/factory';

let Plot: any = () => null;
try {
  let factory = _createPlotlyComponent;
  // Multi-level unwrapping loop to handle any ESM/CJS default wrapping variations
  for (let i = 0; i < 3; i++) {
    if (factory && typeof factory !== 'function' && (factory as any).default) {
      factory = (factory as any).default;
    }
  }
  if (typeof factory === 'function') {
    Plot = factory(Plotly);
  } else {
    console.error("Plotly factory could not be resolved to a function. Resolved to:", factory);
  }
} catch (e) {
  console.error("Failed to initialize Plotly component factory dynamically:", e);
}

import HelpTooltip from './HelpTooltip';
import PreviewTable from './PreviewTable';
import type { AIWeatherSummary, DimAnalyzeResults, DimFinalizeResponse, VifResultItem, SpearmanPairItem } from '../types';

interface DimReductionStepProps {
  sessionId: string;
  derivedFilename: string;
  onFinalSuccess: () => void;
}

function getRiskTheme(riskLevel: AIWeatherSummary['risk_level']) {
  switch (riskLevel) {
    case 'Severe':
      return {
        badge: 'bg-red-500/15 border-red-500/40 text-red-300',
        bar: 'bg-red-500',
        value: 'text-red-300',
      };
    case 'High':
      return {
        badge: 'bg-orange-500/15 border-orange-500/40 text-orange-300',
        bar: 'bg-orange-500',
        value: 'text-orange-300',
      };
    case 'Moderate':
      return {
        badge: 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300',
        bar: 'bg-yellow-500',
        value: 'text-yellow-300',
      };
    case 'Low':
      return {
        badge: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
        bar: 'bg-emerald-500',
        value: 'text-emerald-300',
      };
    default:
      return {
        badge: 'bg-sky-500/15 border-sky-500/40 text-sky-300',
        bar: 'bg-sky-500',
        value: 'text-sky-300',
      };
  }
}

export default function DimReductionStep({ sessionId, derivedFilename, onFinalSuccess }: DimReductionStepProps) {
  const [subStep, setSubStep] = useState<'spearman' | 'vif' | 'finalize'>('spearman');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DimAnalyzeResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Selections
  const [spearmanDrops, setSpearmanDrops] = useState<string[]>([]);
  const [vifDrops, setVifDrops] = useState<string[]>([]);
  
  // Retained & Dropped final columns
  const [retainedFeatures, setRetainedFeatures] = useState<string[]>([]);
  const [droppedFeatures, setDroppedFeatures] = useState<string[]>([]);

  // Lock Dialog state
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [pendingLockFeature, setPendingLockFeature] = useState<string | null>(null);
  const [pendingLockAction, setPendingLockAction] = useState<'drop' | 'retain' | null>(null);

  // Final success payload
  const [finalizeResponse, setFinalizeResponse] = useState<DimFinalizeResponse | null>(null);
  const [aiSummary, setAiSummary] = useState<AIWeatherSummary | null>(null);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);

  // Load Initial Spearman Correlation
  useEffect(() => {
    if (!derivedFilename) return;
    
    async function loadInitialAnalysis() {
      setLoading(true);
      setError(null);
      try {
        const res = await analyzeDimensionality({
          file_path: derivedFilename,
          session_id: sessionId,
          active_columns: [] // empty list triggers full numeric analysis
        });
        
        if (res.error) {
          throw new Error(res.error);
        }
        
        // Auto-select f2 from pairs as suggested drops
        const autoDrops = (res.corr_pairs as SpearmanPairItem[] || []).map(pair => pair.feat_b);
        // Deduplicate
        setSpearmanDrops(Array.from(new Set(autoDrops)));
        
        setResults(res);
      } catch (err: any) {
        setError(err.message || 'Failed to analyze Spearman correlation');
      } finally {
        setLoading(false);
      }
    }

    loadInitialAnalysis();
  }, [derivedFilename, sessionId]);

  // Handle Spearman Checkbox change
  const handleSpearmanCheckbox = (feat: string) => {
    setSpearmanDrops(prev => 
      prev.includes(feat) ? prev.filter(f => f !== feat) : [...prev, feat]
    );
  };

  // Move from Spearman to VIF
  const handleProceedToVif = async () => {
    if (!results) return;
    setLoading(true);
    setError(null);
    
    // Remaining columns = all active cols - spearman drops
    const remainingCols = (results.active_columns || []).filter(col => !spearmanDrops.includes(col));
    
    try {
      const res = await analyzeDimensionality({
        file_path: derivedFilename,
        session_id: sessionId,
        active_columns: remainingCols
      });
      
      if (res.error) {
        throw new Error(res.error);
      }
      
      // Auto-select features with VIF > 10 as drops (excluding locked features from auto-drops to be safe)
      const autoVifDrops = (res.vif_results as VifResultItem[] || [])
        .filter(item => item.vif > 10 && !(res.important_features || []).includes(item.feature))
        .map(item => item.feature);
      setVifDrops(autoVifDrops);
      
      setResults(res);
      setSubStep('vif');
    } catch (err: any) {
      setError(err.message || 'VIF calculation failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle VIF checkbox toggle with locking logic
  const handleVifCheckbox = (feat: string, isCurrentlyChecked: boolean) => {
    if (!results) return;
    
    const isLocked = (results.important_features || []).includes(feat);
    
    if (isLocked && !isCurrentlyChecked) {
      // User is trying to CHECK (which means they want to DROP a physically locked feature!)
      // Show confirmation dialog!
      setPendingLockFeature(feat);
      setPendingLockAction('drop');
      setShowLockConfirm(true);
      return;
    }
    
    // Standard toggling
    setVifDrops(prev => 
      isCurrentlyChecked ? prev.filter(f => f !== feat) : [...prev, feat]
    );
  };

  const confirmLockAction = () => {
    if (!pendingLockFeature) return;
    
    if (pendingLockAction === 'drop') {
      setVifDrops(prev => [...prev, pendingLockFeature]);
    } else {
      setVifDrops(prev => prev.filter(f => f !== pendingLockFeature));
    }
    
    setShowLockConfirm(false);
    setPendingLockFeature(null);
    setPendingLockAction(null);
  };

  // Move from VIF to Retained/Dropped Feature selection
  const handleProceedToFinalSelection = () => {
    if (!results) return;
    
    // Remaining columns = previous active columns - vif drops
    const finalRetained = (results.active_columns || []).filter(col => !vifDrops.includes(col));
    const finalDropped = [
      ...spearmanDrops,
      ...(results.active_columns || []).filter(col => vifDrops.includes(col))
    ];
    
    setRetainedFeatures(finalRetained);
    setDroppedFeatures(Array.from(new Set(finalDropped)));
    setSubStep('finalize');
  };

  // Drag-and-drop / Arrow selection movements
  const moveFeatureToDropped = (feat: string) => {
    setRetainedFeatures(prev => prev.filter(f => f !== feat));
    setDroppedFeatures(prev => [...prev, feat]);
  };

  const moveFeatureToRetained = (feat: string) => {
    setDroppedFeatures(prev => prev.filter(f => f !== feat));
    setRetainedFeatures(prev => [...prev, feat]);
  };

  // final save
  const handleFinalizeDataset = async () => {
    if (retainedFeatures.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    setFinalizeResponse(null);
    setAiSummary(null);
    setAiSummaryError(null);

    try {
      const res = await finalizeDimensionality({
        file_path: derivedFilename,
        session_id: sessionId,
        retained_features: retainedFeatures,
        dropped_features: droppedFeatures
      });

      if (res.status === 'success') {
        setFinalizeResponse(res);
        setAiSummary(res.ai_summary ?? null);
        setAiSummaryError(res.ai_summary_error ?? null);
        onFinalSuccess();
      } else {
        throw new Error(res.message || 'Finalization failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to finalize features selection');
    } finally {
      setLoading(false);
    }
  };

  const plotLayoutDefaults = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#a0aec0', family: 'Inter, sans-serif' },
    xaxis: { gridcolor: '#2d3748', zerolinecolor: '#2d3748', linecolor: '#2d3748' },
    yaxis: { gridcolor: '#2d3748', zerolinecolor: '#2d3748', linecolor: '#2d3748' },
    margin: { t: 40, r: 20, b: 60, l: 80 },
    autosize: true
  };

  if (loading && !results) {
    return (
      <div className="bg-cardBg border border-borderBg rounded-2xl p-12 flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-10 h-10 border-4 border-accentRed border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-400">Performing Spearman Rank Correlation analysis on active features...</p>
      </div>
    );
  }

  return (
    <div>
      <HelpTooltip 
        title="What is Dimensionality Reduction & Multicollinearity optimization?"
        description="This final phase clears redundant features to optimize meteorological analysis. In Step 4a, Spearman correlation identifies pairs exceeding |r| > 0.85, suggesting drops of secondary columns. In Step 4b, Variance Inflation Factors (VIF) evaluate wider multicollinearity. Features with VIF > 10 are flagged for removal. Locked atmospheric indices (CAPE, Shear, Vorticity) trigger confirm prompts if dropped. In Step 4c, you configure the final schema."
      />

      {/* LOCK CONFIRMATION MODAL */}
      {showLockConfirm && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cardBg border-2 border-accentRed p-6 rounded-2xl max-w-sm w-full shadow-2xl relative">
            <h3 className="font-extrabold text-white text-base flex items-center gap-2 mb-3">
              <Lock className="w-5 h-5 text-accentRed" />
              <span>Confirm Feature Dropping</span>
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              The feature <span className="font-mono text-white font-bold">{pendingLockFeature}</span> is flagged as a <span className="text-accentRed font-bold">physically essential meteorological variable</span>.
            </p>
            <p className="text-2xs text-gray-500 mt-2">
              Dropping critical index features (like CAPE, CIN, K-Index, or Wind Shear) might impair downstream thermodynamic and prediction analyses. Are you sure you wish to drop it?
            </p>
            
            <div className="flex gap-4 mt-6">
              <button 
                onClick={() => setShowLockConfirm(false)}
                className="flex-1 py-2 bg-darkBg hover:bg-black border border-borderBg text-white rounded font-bold text-xs"
              >
                Cancel (Keep Feature)
              </button>
              <button 
                onClick={confirmLockAction}
                className="flex-1 py-2 bg-accentRed hover:bg-accentRedHover text-white rounded font-bold text-xs uppercase"
              >
                Confirm Drop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIMS SUB-STEP CONNECTOR */}
      {!finalizeResponse && (
        <div className="flex border border-borderBg bg-cardBg rounded-xl p-2 mb-8 gap-4 font-bold text-xs shadow-md">
          {[
            { id: 'spearman', label: '4a: Spearman Rank' },
            { id: 'vif', label: '4b: VIF Scores' },
            { id: 'finalize', label: '4c: Final Schema' }
          ].map(sb => {
            const active = subStep === sb.id;
            return (
              <div
                key={sb.id}
                className={`flex-1 py-2.5 rounded-lg text-center ${
                  active 
                    ? 'bg-accentRed text-white shadow-inner font-extrabold' 
                    : 'text-gray-500 bg-transparent'
                }`}
              >
                {sb.label}
              </div>
            );
          })}
        </div>
      )}

      {/* ERROR BOARD */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-accentRed shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {results && !finalizeResponse && (
        <div className="space-y-8">
          
          {/* SUB-STEP 4A: SPEARMAN */}
          {subStep === 'spearman' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Heatmap plot left */}
              <div className="lg:col-span-3 bg-cardBg border border-borderBg p-5 rounded-2xl h-[450px]">
                <h3 className="font-extrabold text-sm text-white mb-2">Spearman Correlation Matrix</h3>
                <div className="h-[380px]">
                  <Plot 
                    data={[{
                      z: results.correlation?.matrix || [],
                      x: results.correlation?.columns || [],
                      y: results.correlation?.columns || [],
                      type: 'heatmap',
                      colorscale: 'RdBu',
                      zmin: -1,
                      zmax: 1,
                      reversescale: true
                    }]}
                    layout={{
                      ...plotLayoutDefaults,
                      height: 380,
                    }}
                    config={{ responsive: true }}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              </div>

              {/* Correlation pairs right */}
              <div className="lg:col-span-2 flex flex-col justify-between h-[450px]">
                <div className="bg-cardBg border border-borderBg p-5 rounded-2xl flex-1 overflow-hidden flex flex-col">
                  <h3 className="font-extrabold text-sm text-white mb-1">Highly Correlated Pairs (|r| &gt; 0.85)</h3>
                  <p className="text-3xs text-gray-500 mb-3 leading-normal">Strong intercorrelation causes model overfitting. We suggest dropping Feature B.</p>
                  
                  <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar text-xs">
                    {(results.corr_pairs || []).length === 0 ? (
                      <div className="text-gray-500 italic py-6 text-center">No highly correlated pairs detected! All |r| &lt; 0.85.</div>
                    ) : (
                      (results.corr_pairs || []).map((pair, index) => {
                        const isDropped = spearmanDrops.includes(pair.feat_b);
                        return (
                          <div key={index} className="border-b border-borderBg pb-2.5 last:border-0 last:pb-0 flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-white truncate max-w-[100px]" title={pair.feat_a}>{pair.feat_a}</span>
                                <span className="text-gray-500">↔</span>
                                <span className="font-mono text-gray-300 truncate max-w-[100px]" title={pair.feat_b}>{pair.feat_b}</span>
                              </div>
                              <div className="text-[10px] text-gray-500 mt-1 italic leading-normal">{pair.action}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span className="font-bold text-accentRed font-mono bg-accentRed/10 px-1.5 py-0.5 rounded text-2xs">{(Number(pair.r) || 0).toFixed(3)}</span>
                              <label className="flex items-center gap-1 cursor-pointer select-none">
                                <input 
                                  type="checkbox" checked={isDropped}
                                  onChange={() => handleSpearmanCheckbox(pair.feat_b)}
                                  className="w-3.5 h-3.5 accent-accentRed"
                                />
                                <span className="text-3xs text-gray-400 font-bold uppercase">DROP B</span>
                              </label>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Removal tracker */}
                <div className="bg-black/25 border border-borderBg p-4 rounded-xl mt-4 text-xs font-semibold">
                  <span className="text-gray-400 uppercase text-3xs tracking-wider block font-bold mb-1">Columns marked for removal ({spearmanDrops.length}):</span>
                  <div className="text-gray-300 font-mono text-[10px] truncate">
                    {spearmanDrops.join(', ') || 'None'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-STEP 4B: VIF MULTICOLLINEARITY */}
          {subStep === 'vif' && (
            <div className="space-y-6">
              {/* Warning banner */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-yellow-500 font-bold text-xs uppercase tracking-wider">Variance Inflation Factor (VIF) Warnings</h4>
                  <p className="text-2xs text-gray-400 mt-1">VIF scores &gt; 10 represent extreme collinearity threat (high multi-dependency). Variables with score &gt; 10 are pre-selected for dropping. Important atmospheric indicators carry a 🔒 lock icon and require validation before exclusion.</p>
                </div>
              </div>

              {/* VIF Table */}
              <div className="bg-cardBg border border-borderBg rounded-2xl overflow-hidden shadow-xl">
                <div className="px-6 py-4 border-b border-borderBg bg-black/20">
                  <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">VIF Multicollinearity Auditing</h3>
                </div>
                
                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-borderBg text-left text-xs">
                    <thead className="bg-black/25 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Feature</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">VIF Score</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center w-28">Drop Column</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderBg bg-cardBg/30">
                      {(results.vif_results || []).map((item) => {
                        const score = item.vif;
                        const isDropped = vifDrops.includes(item.feature);
                        const isLocked = (results.important_features || []).includes(item.feature);
                        
                        let statusText = '🟢 Low (<5)';
                        if (score > 10) {
                           statusText = '🔴 High (>10)';
                        } else if (score >= 5) {
                          statusText = '🟡 Medium (5-10)';
                        }

                        return (
                          <tr key={item.feature} className="hover:bg-gray-800/20 transition-colors">
                            <td className="px-6 py-4 font-mono font-bold text-white text-sm flex items-center gap-1.5">
                              {isLocked && <span title="Meteorology Locked Variable"><Lock className="w-3.5 h-3.5 text-yellow-500 shrink-0" /></span>}
                              <span>{item.feature}</span>
                            </td>
                            <td className="px-6 py-4 font-bold text-gray-300 text-sm font-mono">{(Number(score) || 0).toFixed(3)}</td>
                            <td className="px-6 py-4 font-bold">{statusText}</td>
                            <td className="px-6 py-4 text-center">
                              <input 
                                type="checkbox" checked={isDropped}
                                onChange={() => handleVifCheckbox(item.feature, isDropped)}
                                className="w-4 h-4 accent-accentRed cursor-pointer"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUB-STEP 4C: FINAL FEATURE SELECTION */}
          {subStep === 'finalize' && (
            <div className="space-y-6">
              {/* Dual list Retained vs Dropped */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* RETAINED (left) */}
                <div className="bg-cardBg border border-borderBg rounded-2xl p-5 shadow-xl flex flex-col h-[400px]">
                  <h3 className="font-extrabold text-sm text-successGreen uppercase tracking-wider mb-2 border-b border-borderBg pb-1">Retained Features ({retainedFeatures.length})</h3>
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {retainedFeatures.map(feat => (
                      <div key={feat} className="flex justify-between items-center bg-darkBg border border-borderBg p-2 rounded text-xs hover:border-successGreen transition-colors group">
                        <span className="font-mono text-gray-300 font-bold">{feat}</span>
                        <button 
                          onClick={() => moveFeatureToDropped(feat)}
                          className="p-1 hover:bg-black/40 text-gray-400 hover:text-accentRed rounded transition-colors flex items-center gap-1 text-3xs font-bold uppercase"
                        >
                          <span>Drop</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DROPPED (right) */}
                <div className="bg-cardBg border border-borderBg rounded-2xl p-5 shadow-xl flex flex-col h-[400px]">
                  <h3 className="font-extrabold text-sm text-accentRed uppercase tracking-wider mb-2 border-b border-borderBg pb-1">Dropped Features ({droppedFeatures.length})</h3>
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {droppedFeatures.length === 0 ? (
                      <div className="text-gray-500 italic py-6 text-center text-xs">No dropped columns. All features are retained.</div>
                    ) : (
                      droppedFeatures.map(feat => (
                        <div key={feat} className="flex justify-between items-center bg-darkBg border border-borderBg p-2 rounded text-xs hover:border-accentRed transition-colors group">
                          <span className="font-mono text-gray-500 line-through truncate max-w-[200px]">{feat}</span>
                          <button 
                            onClick={() => moveFeatureToRetained(feat)}
                            className="p-1 hover:bg-black/40 text-gray-400 hover:text-successGreen rounded transition-colors flex items-center gap-1 text-3xs font-bold uppercase"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Retain</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Dimensions specs */}
              <div className="bg-black/25 border border-borderBg p-4 rounded-xl text-center text-xs font-semibold">
                <span>Final Dataset Shape: <span className="text-white font-mono">{retainedFeatures.length} numeric columns (+ timestamps & coords envelope)</span>.</span>
              </div>
            </div>
          )}

          {/* BACK/FORWARD ACTIONS BUTTONS */}
          <div className="flex justify-between items-center pt-4 border-t border-borderBg/50">
            {subStep !== 'spearman' ? (
              <button
                onClick={() => {
                  if (subStep === 'vif') setSubStep('spearman');
                  else if (subStep === 'finalize') setSubStep('vif');
                }}
                className="px-5 py-2.5 border border-borderBg hover:bg-cardBg text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-all"
              >
                Back
              </button>
            ) : <div />}

            {subStep !== 'finalize' ? (
              <button
                onClick={subStep === 'spearman' ? handleProceedToVif : handleProceedToFinalSelection}
                className="px-6 py-2.5 bg-accentRed hover:bg-accentRedHover text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md"
              >
                <span>Proceed</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinalizeDataset}
                disabled={retainedFeatures.length === 0 || loading}
                className="px-8 py-3.5 bg-successGreen hover:bg-successGreenHover text-white rounded-xl font-extrabold text-sm uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-successGreen/25"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Finalizing & Generating Summary...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Apply & Finalize Dataset</span>
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      )}

      {/* FINAL SUCCESS SCREEN */}
      {finalizeResponse && (
        <div className="space-y-8 mt-4">
          <div className="bg-cardBg border border-borderBg p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="font-extrabold text-sm text-successGreen uppercase tracking-wider flex items-center gap-2">
                <span className="text-successGreen">✓</span> DATASET OPTIMIZED & FINALIZED
              </h3>
              <p className="text-xs text-gray-400 mt-1">{finalizeResponse.message}</p>
              <p className="text-2xs text-gray-500 mt-1 font-semibold">Final schema shape: <span className="text-white font-mono">{finalizeResponse.stats.shape[0]} rows x {finalizeResponse.stats.shape[1]} columns</span>.</p>
            </div>
            
            <div className="flex flex-wrap gap-4 shrink-0">
              <a 
                href={getDownloadUrl(finalizeResponse.final_file, sessionId)}
                className="px-6 py-3 bg-successGreen hover:bg-successGreenHover text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Download Final Dataset (CSV)</span>
              </a>
              <a 
                href={getDownloadUrl(finalizeResponse.html_report_file, sessionId)}
                className="px-6 py-3 bg-cardBg hover:bg-black/40 text-gray-300 hover:text-white rounded-lg border border-borderBg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all"
              >
                <Download className="w-4 h-4 text-accentRed" />
                <span>Download Dim Report (HTML)</span>
              </a>
            </div>
          </div>

          {aiSummary ? (
            <div className="bg-cardBg border border-indigo-400/20 rounded-2xl p-6 shadow-xl overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-cyan-500/5 pointer-events-none" />
              <div className="relative">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-400/20">
                    <CloudLightning className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-3xs font-bold uppercase tracking-[0.18em] text-indigo-300">{aiSummary.provider ?? 'AI'} Scientific Analysis</p>
                    <h3 className="font-extrabold text-base text-white mt-1">Thunderstorm Probability</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 mt-6">
                  <div className="bg-black/25 border border-borderBg rounded-xl p-5">
                    <div className={`text-5xl font-black font-mono tracking-tight ${getRiskTheme(aiSummary.risk_level).value}`}>
                      {aiSummary.thunderstorm_probability}%
                    </div>
                    <div className="h-2.5 bg-black/40 border border-borderBg rounded-full overflow-hidden mt-4">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${getRiskTheme(aiSummary.risk_level).bar}`}
                        style={{ width: `${aiSummary.thunderstorm_probability}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-4">
                      <span className={`px-3 py-1.5 rounded-full border text-xs font-extrabold uppercase tracking-wider ${getRiskTheme(aiSummary.risk_level).badge}`}>
                        {aiSummary.risk_level} Risk
                      </span>
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-white font-mono">{aiSummary.confidence}%</div>
                        <div className="text-3xs text-gray-500 uppercase font-bold tracking-wider">Evidence</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/15 border border-borderBg rounded-xl p-5">
                    <h4 className="text-3xs text-gray-500 font-bold uppercase tracking-wider">AI Explanation</h4>
                    <p className="text-sm text-gray-300 leading-relaxed mt-3">{aiSummary.summary}</p>
                  </div>
                </div>

                {aiSummary.impacts.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-borderBg">
                    <h4 className="text-3xs text-gray-500 font-bold uppercase tracking-wider mb-3">Potential Impacts</h4>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {aiSummary.impacts.map((impact, index) => (
                        <li key={`${impact}-${index}`} className="flex items-start gap-2 text-xs text-gray-300 bg-black/20 border border-borderBg rounded-lg p-3">
                          <AlertTriangle className="w-3.5 h-3.5 text-indigo-300 shrink-0 mt-0.5" />
                          <span>{impact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : aiSummaryError ? (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
              <div>
                <h3 className="font-bold text-yellow-400">AI Weather Summary Unavailable</h3>
                <p className="text-gray-400 mt-1">{aiSummaryError}</p>
              </div>
            </div>
          ) : null}

          <PreviewTable filename={finalizeResponse.final_file} sessionId={sessionId} />
        </div>
      )}
    </div>
  );
}
