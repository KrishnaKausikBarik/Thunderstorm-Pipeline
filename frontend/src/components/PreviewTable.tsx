import { useEffect, useState } from 'react';
import { fetchPreview } from '../utils/api';
import { Database, AlertCircle } from 'lucide-react';

interface PreviewTableProps {
  filename: string;
  sessionId: string;
  refreshTrigger?: number;
}

export default function PreviewTable({ filename, sessionId, refreshTrigger = 0 }: PreviewTableProps) {
  const [data, setData] = useState<{ columns: string[]; rows: any[][] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filename || !sessionId) return;
    
    async function loadPreview() {
      setLoading(true);
      setError(null);
      try {
        const preview = await fetchPreview(filename, sessionId);
        setData(preview);
      } catch (err: any) {
        setError(err.message || 'Failed to load dataset preview');
      } finally {
        setLoading(false);
      }
    }
    
    loadPreview();
  }, [filename, sessionId, refreshTrigger]);

  if (loading) {
    return (
      <div className="bg-cardBg border border-borderBg rounded-xl p-5 sm:p-8 flex flex-col items-center justify-center min-h-[220px] sm:min-h-[250px] text-center">
        <div className="w-10 h-10 border-4 border-accentRed border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-400">Loading dataset preview rows from workspace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-cardBg border border-accentRed/30 border-2 rounded-xl p-6 text-center text-red-400">
        <AlertCircle className="w-8 h-8 mx-auto mb-3 text-accentRed" />
        <h4 className="font-bold text-sm">Failed to Preview File</h4>
        <p className="text-xs text-gray-400 mt-1">{error}</p>
      </div>
    );
  }

  if (!data || data.columns.length === 0) {
    return null;
  }

  // Display only first 20 rows in the visual table as requested
  const visibleRows = data.rows.slice(0, 20);

  return (
    <div className="bg-cardBg border border-borderBg rounded-xl overflow-hidden shadow-xl mt-6 min-w-0">
      <div className="px-4 sm:px-6 py-4 border-b border-borderBg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-black/20">
        <div className="flex items-center gap-2 min-w-0">
          <Database className="w-4 h-4 text-accentRed" />
          <span className="font-semibold text-white text-sm leading-tight">Dataset Preview (First 20 of {data.rows.length} rows loaded)</span>
        </div>
        <div className="text-xs text-gray-400 font-mono break-all">
          Filename: <span className="text-gray-300">{filename}</span>
        </div>
      </div>
      
      <div className="overflow-x-auto overflow-y-auto max-h-[360px] sm:max-h-[400px] custom-scrollbar">
        <table className="min-w-full divide-y divide-borderBg text-left font-mono text-xs select-text">
          <thead className="bg-black/40 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 border-r border-borderBg text-gray-400 text-center font-bold w-12 bg-black/40">#</th>
              {data.columns.map((col) => {
                const isTime = col.toLowerCase().includes('time') || col.toLowerCase().includes('date');
                return (
                  <th 
                    key={col} 
                    className={`px-4 py-3 font-semibold tracking-wider text-gray-300 border-r border-borderBg ${
                      isTime ? 'text-accentRed' : ''
                    }`}
                  >
                    {col}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-borderBg bg-cardBg/50">
            {visibleRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-gray-800/40 transition-colors">
                <td className="px-4 py-2 text-center text-gray-500 border-r border-borderBg bg-black/10 font-bold select-none">{rIdx + 1}</td>
                {row.map((val, cIdx) => {
                  const isNull = val === null || val === undefined;
                  const isNum = typeof val === 'number';
                  return (
                    <td 
                      key={cIdx} 
                      className={`px-4 py-2 border-r border-borderBg font-mono text-xs whitespace-nowrap ${
                        isNull 
                          ? 'text-accentRed/60 italic font-bold bg-accentRed/5' 
                          : isNum 
                            ? 'text-gray-200' 
                            : 'text-gray-300'
                      }`}
                    >
                      {isNull ? 'NaN' : isNum ? (val as number).toFixed(4).replace(/\.?0+$/, '') : String(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-2 border-t border-borderBg text-right bg-black/10">
        <span className="text-[10px] text-gray-500 font-semibold italic">Horizontal scrolling enabled. Missing parameters filled with NaN.</span>
      </div>
    </div>
  );
}
