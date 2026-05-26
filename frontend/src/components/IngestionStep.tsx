import { useState } from 'react';
import { Play, Download, Eye, EyeOff, Plus, Minus, ShieldAlert } from 'lucide-react';
import { API_BASE, getDownloadUrl } from '../utils/api';
import TerminalLog from './TerminalLog';
import PreviewTable from './PreviewTable';
import HelpTooltip from './HelpTooltip';
import type { IngestStats } from '../types';

interface IngestionStepProps {
  sessionId: string;
  onIngestSuccess: (rawFilename: string) => void;
}

const YEARS = Array.from({ length: 27 }, (_, i) => 2000 + i);
const MONTHS = [
  { val: 1, name: 'January' }, { val: 2, name: 'February' }, { val: 3, name: 'March' },
  { val: 4, name: 'April' }, { val: 5, name: 'May' }, { val: 6, name: 'June' },
  { val: 7, name: 'July' }, { val: 8, name: 'August' }, { val: 9, name: 'September' },
  { val: 10, name: 'October' }, { val: 11, name: 'November' }, { val: 12, name: 'December' }
];

const ERA5_VARS = [
  '2m_temperature', '2m_dewpoint_temperature', 'convective_available_potential_energy',
  'convective_inhibition', 'total_precipitation', 'u_component_of_wind',
  'v_component_of_wind', 'specific_humidity', 'relative_humidity',
  'vertical_velocity', 'temperature', 'geopotential', 'total_column_water_vapour'
];

const PRESSURE_LEVELS_LIST = [300, 500, 700, 850, 925];

export default function IngestionStep({ sessionId, onIngestSuccess }: IngestionStepProps) {
  // Bounding coords state
  const [north, setNorth] = useState(23.00);
  const [south, setSouth] = useState(17.00);
  const [west, setWest] = useState(81.00);
  const [east, setEast] = useState(88.00);

  // Time Parameters state
  const [selectedYears, setSelectedYears] = useState<number[]>([2025]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([5, 6, 7]); // May, Jun, Jul
  const [startDay, setStartDay] = useState(1);
  const [endDay, setEndDay] = useState(15);
  const [interval, setIntervalVal] = useState('6-hourly');

  // Sources toggle
  const [era5Enabled, setEra5Enabled] = useState(true);
  const [imdEnabled, setImdEnabled] = useState(false);
  const [nasaEnabled, setNasaEnabled] = useState(false);

  // Source configurations
  const [era5Key, setEra5Key] = useState('');
  const [showEra5Key, setShowEra5Key] = useState(false);
  const [era5Url, setEra5Url] = useState('https://cds.climate.copernicus.eu/api/v2');
  const [era5SelectedVars, setEra5SelectedVars] = useState<string[]>([
    '2m_temperature', '2m_dewpoint_temperature', 'convective_available_potential_energy', 'total_precipitation'
  ]);
  const [era5SelectedPressures, setEra5SelectedPressures] = useState<number[]>([500, 850]);
  const [era5DatasetType, setEra5DatasetType] = useState('Both');

  const [imdKey, setImdKey] = useState('');
  const [showImdKey, setShowImdKey] = useState(false);
  const [imdDataTypes, setImdDataTypes] = useState<string[]>(['Gridded Rainfall']);
  const [imdResolution, setImdResolution] = useState('0.25°');

  const [nasaUser, setNasaUser] = useState('');
  const [nasaPass, setNasaPass] = useState('');
  const [showNasaPass, setShowNasaPass] = useState(false);
  const [nasaDatasets, setNasaDatasets] = useState<string[]>(['GPM IMERG']);

  // Custom Data Source state
  const [customEnabled, setCustomEnabled] = useState(false);
  const [customUrl, setCustomUrl] = useState('');

  // SSE & Pipeline run state
  const [logs, setLogs] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [ingestStats, setIngestStats] = useState<IngestStats | null>(null);
  const [samplingReport, setSamplingReport] = useState<any | null>(null);

  // Smart Merge User Override state
  const [targetMergeInterval, setTargetMergeInterval] = useState<string>('Daily');
  const [variableAggRules, setVariableAggRules] = useState<Record<string, string>>({});
  const [isMerging, setIsMerging] = useState(false);

  // Check if pressure levels are needed
  const isPressureLevelNeeded = () => {
    const plVars = ['temperature', 'specific_humidity', 'relative_humidity', 'geopotential', 'vertical_velocity', 'u_component_of_wind', 'v_component_of_wind'];
    const hasPlVar = era5SelectedVars.some(v => plVars.includes(v));
    return hasPlVar || era5DatasetType === 'Pressure Level' || era5DatasetType === 'Both';
  };

  const handleTriggerPipeline = () => {
    if (isRunning) return;
    setLogs([]);
    setIngestStats(null);
    setSamplingReport(null);
    setIsRunning(true);

    const payload = {
      session_id: sessionId,
      north,
      south,
      west,
      east,
      years: selectedYears,
      months: selectedMonths,
      daysRange: [startDay, endDay],
      interval,
      sources: {
        era5: {
          enabled: era5Enabled,
          apiKey: era5Key || null,
          url: era5Url,
          variables: era5SelectedVars,
          pressureLevels: isPressureLevelNeeded() ? era5SelectedPressures : [],
          datasetType: era5DatasetType
        },
        imd: {
          enabled: imdEnabled,
          apiKey: imdKey || null,
          dataTypes: imdDataTypes,
          resolution: imdResolution
        },
        nasa: {
          enabled: nasaEnabled,
          username: nasaUser || null,
          password: nasaPass || null,
          datasets: nasaDatasets
        },
        custom: {
          enabled: customEnabled,
          url: customUrl
        }
      }
    };

    runStreamingFetch(payload);
  };

  const runStreamingFetch = async (payload: any) => {
    try {
      const response = await fetch(`${API_BASE}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok || !response.body) {
        throw new Error("Failed to start ingestion stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (dataStr) {
              const event = JSON.parse(dataStr);
              
              setLogs((prev) => [
                ...prev,
                {
                  message: event.message,
                  status: event.status,
                  timestamp: new Date().toLocaleTimeString(),
                  isReasoning: event.is_reasoning
                }
              ]);

              if (event.status === 'analyzed' && event.report) {
                setSamplingReport(event.report);
                setTargetMergeInterval(event.report.recommended_common_interval);
                setIsRunning(false);

                // Auto-populate default aggregation rules
                const initialRules: Record<string, string> = {};
                Object.keys(event.report.sources).forEach(srcKey => {
                  event.report.sources[srcKey].variables.forEach((v: string) => {
                    const vLower = v.toLowerCase();
                    if (vLower === 'total_precipitation') {
                      initialRules[v] = 'sum';
                    } else if (vLower.includes('temp') || vLower.includes('humidity') || vLower.includes('dewpoint') || vLower.includes('pressure')) {
                      initialRules[v] = 'mean';
                    } else if (vLower.includes('cape') || vLower.includes('precip') || vLower.includes('rain') || vLower.includes('cin')) {
                      initialRules[v] = 'max';
                    } else {
                      initialRules[v] = 'mean';
                    }
                  });
                });
                setVariableAggRules(initialRules);
              } else if (event.status === 'completed' && event.stats) {
                setIngestStats(event.stats);
                onIngestSuccess(event.stats.filename);
                setIsRunning(false);
              } else if (event.status === 'failed') {
                setIsRunning(false);
              }
            }
          }
        }
      }
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          message: `❌ Network Error: ${err.message}`,
          status: 'failed',
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      setIsRunning(false);
    }
  };

  const handleConfirmMerge = async () => {
    if (!samplingReport || isMerging) return;
    setIsMerging(true);
    
    setLogs((prev) => [
      ...prev,
      {
        message: "🔄 Initiating spatial-temporal Smart Merge on latitude/longitude grid coordinate pairs...",
        status: "running",
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
    
    try {
      const activeSourcesList = Object.keys(samplingReport.sources);
      const response = await fetch(`${API_BASE}/ingest/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          target_interval: targetMergeInterval,
          agg_rules: variableAggRules,
          sources: activeSourcesList
        })
      });
      
      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.detail || "Failed to execute smart merge.");
      }
      
      setLogs((prev) => [
        ...prev,
        {
          message: "✓ Spatial-temporal merge and resampling executed successfully!",
          status: "done",
          timestamp: new Date().toLocaleTimeString()
        },
        {
          message: "🎉 Meteorological Ingestion & Co-registration pipeline complete!",
          status: "completed",
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      
      setIngestStats(res.stats);
      onIngestSuccess(res.stats.filename);
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          message: `❌ Smart Merge Error: ${err.message}`,
          status: "failed",
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div>
      <HelpTooltip 
        title="What is Data Ingestion & Spatial Co-registration?"
        description="This step downloads raw spatial meteorological datasets (NetCDF format) based on your coordinates and timeframe, and automatically maps/co-registers them. If no API keys are provided, the system falls back to a high-fidelity synthetic simulation. Individual source datasets are converted to standard CSVs and outer-joined on spatial coordinates and hourly timestamps, filling missing values with NaNs."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT PANEL: Bounding Coordinates */}
        <div className="bg-cardBg border border-borderBg p-6 rounded-2xl flex flex-col justify-between shadow-lg">
          <div>
            <h2 className="text-lg font-bold text-white mb-4 border-b border-borderBg pb-2">Bounding Coordinates</h2>
            <p className="text-xs text-gray-400 mb-6">Specify the spatial envelope for gridded meteorological mapping.</p>
            
            <div className="space-y-4 max-w-[240px] mx-auto">
              {/* North */}
              <div className="flex flex-col items-center">
                <label className="text-xs text-gray-400 font-bold uppercase mb-1">North Limit (°N)</label>
                <div className="flex items-center bg-darkBg border border-borderBg rounded-lg p-1">
                  <button onClick={() => setNorth(n => +(n - 0.25).toFixed(2))} className="p-1 hover:text-accentRed"><Minus className="w-4 h-4" /></button>
                  <input type="number" step="0.25" value={north} onChange={e => setNorth(+e.target.value)} className="w-16 bg-transparent text-center text-sm font-bold focus:outline-none" />
                  <button onClick={() => setNorth(n => +(n + 0.25).toFixed(2))} className="p-1 hover:text-accentRed"><Plus className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="flex justify-between gap-4">
                {/* West */}
                <div className="flex flex-col items-center">
                  <label className="text-xs text-gray-400 font-bold uppercase mb-1">West Limit (°E)</label>
                  <div className="flex items-center bg-darkBg border border-borderBg rounded-lg p-1">
                    <button onClick={() => setWest(w => +(w - 0.25).toFixed(2))} className="p-1 hover:text-accentRed"><Minus className="w-4 h-4" /></button>
                    <input type="number" step="0.25" value={west} onChange={e => setWest(+e.target.value)} className="w-16 bg-transparent text-center text-sm font-bold focus:outline-none" />
                    <button onClick={() => setWest(w => +(w + 0.25).toFixed(2))} className="p-1 hover:text-accentRed"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* East */}
                <div className="flex flex-col items-center">
                  <label className="text-xs text-gray-400 font-bold uppercase mb-1">East Limit (°E)</label>
                  <div className="flex items-center bg-darkBg border border-borderBg rounded-lg p-1">
                    <button onClick={() => setEast(e => +(e - 0.25).toFixed(2))} className="p-1 hover:text-accentRed"><Minus className="w-4 h-4" /></button>
                    <input type="number" step="0.25" value={east} onChange={e => setEast(+e.target.value)} className="w-16 bg-transparent text-center text-sm font-bold focus:outline-none" />
                    <button onClick={() => setEast(e => +(e + 0.25).toFixed(2))} className="p-1 hover:text-accentRed"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>

              {/* South */}
              <div className="flex flex-col items-center">
                <label className="text-xs text-gray-400 font-bold uppercase mb-1">South Limit (°N)</label>
                <div className="flex items-center bg-darkBg border border-borderBg rounded-lg p-1">
                  <button onClick={() => setSouth(s => +(s - 0.25).toFixed(2))} className="p-1 hover:text-accentRed"><Minus className="w-4 h-4" /></button>
                  <input type="number" step="0.25" value={south} onChange={e => setSouth(+e.target.value)} className="w-16 bg-transparent text-center text-sm font-bold focus:outline-none" />
                  <button onClick={() => setSouth(s => +(s + 0.25).toFixed(2))} className="p-1 hover:text-accentRed"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-borderBg pt-4 text-center">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Target Coordinates Envelope</span>
            <span className="text-xs text-gray-300 font-mono mt-1 block">
              [{south.toFixed(2)}°N to {north.toFixed(2)}°N] × [{west.toFixed(2)}°E to {east.toFixed(2)}°E]
            </span>
          </div>
        </div>

        {/* RIGHT PANEL: Time Range & Parameters */}
        <div className="bg-cardBg border border-borderBg p-6 rounded-2xl shadow-lg lg:col-span-2">
          <h2 className="text-lg font-bold text-white mb-4 border-b border-borderBg pb-2">Temporal Window & Resolution</h2>
          <p className="text-xs text-gray-400 mb-6">Select historical segments and temporal frequencies to ingest.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Year Multi-Select tags */}
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase block mb-2">Select Years to Ingest</label>
              <div className="flex flex-wrap gap-1.5 p-3 bg-darkBg border border-borderBg rounded-xl max-h-[140px] overflow-y-auto">
                {YEARS.map(yr => {
                  const active = selectedYears.includes(yr);
                  return (
                    <button
                      key={yr}
                      onClick={() => setSelectedYears(prev => active ? prev.filter(y => y !== yr) : [...prev, yr])}
                      className={`px-2 py-1 rounded text-xs font-semibold border transition-all ${
                        active 
                          ? 'bg-accentRed border-accentRed text-white font-bold' 
                          : 'bg-cardBg border-borderBg text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Month Multi-Select tags */}
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase block mb-2">Select Months</label>
              <div className="flex flex-wrap gap-1.5 p-3 bg-darkBg border border-borderBg rounded-xl max-h-[140px] overflow-y-auto">
                {MONTHS.map(m => {
                  const active = selectedMonths.includes(m.val);
                  return (
                    <button
                      key={m.val}
                      onClick={() => setSelectedMonths(prev => active ? prev.filter(v => v !== m.val) : [...prev, m.val])}
                      className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                        active 
                          ? 'bg-accentRed border-accentRed text-white font-bold' 
                          : 'bg-cardBg border-borderBg text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {m.name.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-4 border-t border-borderBg/50">
            {/* Day range controller */}
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase block mb-2">Target Days Range of Month</label>
              <div className="flex items-center gap-4 bg-darkBg border border-borderBg rounded-xl p-3">
                <div className="flex-1">
                  <div className="text-[10px] text-gray-500 font-bold mb-1">MIN DAY: {startDay}</div>
                  <input 
                    type="range" min="1" max="31" value={startDay} 
                    onChange={e => setStartDay(Math.min(endDay, +e.target.value))}
                    className="w-full accent-accentRed"
                  />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-gray-500 font-bold mb-1">MAX DAY: {endDay}</div>
                  <input 
                    type="range" min="1" max="31" value={endDay} 
                    onChange={e => setEndDay(Math.max(startDay, +e.target.value))}
                    className="w-full accent-accentRed"
                  />
                </div>
              </div>
            </div>

            {/* Hour Interval Dropdown */}
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase block mb-2">Temporal Hour Interval</label>
              <select
                value={interval}
                onChange={e => setIntervalVal(e.target.value)}
                className="w-full bg-darkBg border border-borderBg text-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-accentRed font-semibold"
              >
                <option value="1-hourly">1-hourly (High Resolution)</option>
                <option value="3-hourly">3-hourly</option>
                <option value="6-hourly">6-hourly</option>
                <option value="12-hourly">12-hourly</option>
                <option value="Daily">Daily</option>
              </select>
            </div>
          </div>
        </div>

      </div>

      {/* SELECT DATA SOURCES */}
      <div className="bg-cardBg border border-borderBg p-6 rounded-2xl mt-8 shadow-lg">
        <h2 className="text-lg font-bold text-white mb-6 border-b border-borderBg pb-2">Select Data Sources</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* ERA5 CARD */}
          <div className={`border rounded-xl p-5 transition-all duration-300 ${
            era5Enabled ? 'bg-black/10 border-accentRed shadow-md' : 'bg-darkBg border-borderBg/50 opacity-60'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-white">ERA5 (ECMWF CDS)</h3>
                <span className="text-[10px] text-gray-400">Reanalysis Gridded Climate Model</span>
              </div>
              <input 
                type="checkbox" checked={era5Enabled} onChange={e => setEra5Enabled(e.target.checked)}
                className="w-5 h-5 accent-accentRed cursor-pointer"
              />
            </div>

            {era5Enabled && (
              <div className="mt-4 space-y-4 pt-4 border-t border-borderBg/40">
                {/* API key */}
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1">API KEY</label>
                  <div className="relative">
                    <input 
                      type={showEra5Key ? 'text' : 'password'} value={era5Key} onChange={e => setEra5Key(e.target.value)}
                      placeholder="• • • • • • • • • • • •"
                      className="w-full bg-darkBg border border-borderBg rounded p-1.5 text-xs focus:outline-none focus:border-accentRed pr-8"
                    />
                    <button 
                      onClick={() => setShowEra5Key(!showEra5Key)} 
                      className="absolute right-2 top-2 text-gray-500 hover:text-white"
                    >
                      {showEra5Key ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* CDS URL */}
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1">CDS URL</label>
                  <input 
                    type="text" value={era5Url} onChange={e => setEra5Url(e.target.value)}
                    className="w-full bg-darkBg border border-borderBg rounded p-1.5 text-xs focus:outline-none font-mono"
                  />
                </div>

                {/* Variables Selection */}
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-2">VARIABLES</label>
                  <div className="flex flex-wrap gap-1 p-2 bg-darkBg border border-borderBg rounded max-h-[100px] overflow-y-auto">
                    {ERA5_VARS.map(v => {
                      const active = era5SelectedVars.includes(v);
                      return (
                        <button
                          key={v}
                          onClick={() => setEra5SelectedVars(prev => active ? prev.filter(item => item !== v) : [...prev, v])}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                            active ? 'bg-accentRed/30 border-accentRed text-white' : 'bg-cardBg border-borderBg text-gray-400'
                          }`}
                        >
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pressure levels selection */}
                {isPressureLevelNeeded() && (
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold block mb-2">PRESSURE LEVELS (hPa)</label>
                    <div className="flex gap-2">
                      {PRESSURE_LEVELS_LIST.map(pl => {
                        const active = era5SelectedPressures.includes(pl);
                        return (
                          <button
                            key={pl}
                            onClick={() => setEra5SelectedPressures(prev => active ? prev.filter(v => v !== pl) : [...prev, pl])}
                            className={`flex-1 py-1 rounded text-2xs font-bold border transition-colors ${
                              active ? 'bg-accentRed border-accentRed text-white' : 'bg-darkBg border-borderBg text-gray-400 hover:border-gray-500'
                            }`}
                          >
                            {pl}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Radio selections */}
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-2">DATASET LEVEL TYPE</label>
                  <div className="flex gap-4 text-xs font-semibold">
                    {['Single Level', 'Pressure Level', 'Both'].map(type => (
                      <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="radio" name="era5_type" value={type} checked={era5DatasetType === type}
                          onChange={() => setEra5DatasetType(type)}
                          className="accent-accentRed"
                        />
                        <span>{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* IMD CARD */}
          <div className={`border rounded-xl p-5 transition-all duration-300 ${
            imdEnabled ? 'bg-black/10 border-accentRed shadow-md' : 'bg-darkBg border-borderBg/50 opacity-60'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-white">IMD (India Meteorological Dept)</h3>
                <span className="text-[10px] text-gray-400">High-Res India Gridded Rainfall/Temp</span>
              </div>
              <input 
                type="checkbox" checked={imdEnabled} onChange={e => setImdEnabled(e.target.checked)}
                className="w-5 h-5 accent-accentRed cursor-pointer"
              />
            </div>

            {imdEnabled && (
              <div className="mt-4 space-y-4 pt-4 border-t border-borderBg/40">
                {/* API Key */}
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1">API KEY</label>
                  <div className="relative">
                    <input 
                      type={showImdKey ? 'text' : 'password'} value={imdKey} onChange={e => setImdKey(e.target.value)}
                      placeholder="• • • • • • • • • • • •"
                      className="w-full bg-darkBg border border-borderBg rounded p-1.5 text-xs focus:outline-none focus:border-accentRed pr-8"
                    />
                    <button onClick={() => setShowImdKey(!showImdKey)} className="absolute right-2 top-2 text-gray-500 hover:text-white">
                      {showImdKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Data Types */}
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-2">DATA TYPES</label>
                  <div className="flex flex-col gap-1.5 text-xs font-semibold">
                    {['Gridded Rainfall', 'Gridded Max Temperature', 'Gridded Min Temperature', 'Station Observations'].map(dt => {
                      const active = imdDataTypes.includes(dt);
                      return (
                        <label key={dt} className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" checked={active}
                            onChange={() => setImdDataTypes(prev => active ? prev.filter(i => i !== dt) : [...prev, dt])}
                            className="accent-accentRed"
                          />
                          <span>{dt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Resolution dropdown */}
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1">SPATIAL RESOLUTION</label>
                  <select 
                    value={imdResolution} onChange={e => setImdResolution(e.target.value)}
                    className="w-full bg-darkBg border border-borderBg rounded p-1.5 text-xs focus:outline-none"
                  >
                    <option value="0.25°">0.25°</option>
                    <option value="0.50°">0.50°</option>
                    <option value="1.00°">1.00°</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* NASA EARTHDATA CARD */}
          <div className={`border rounded-xl p-5 transition-all duration-300 ${
            nasaEnabled ? 'bg-black/10 border-accentRed shadow-md' : 'bg-darkBg border-borderBg/50 opacity-60'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-white">NASA EARTHDATA</h3>
                <span className="text-[10px] text-gray-400">TRMM 3B42 / GPM Precipitation</span>
              </div>
              <input 
                type="checkbox" checked={nasaEnabled} onChange={e => setNasaEnabled(e.target.checked)}
                className="w-5 h-5 accent-accentRed cursor-pointer"
              />
            </div>

            {nasaEnabled && (
              <div className="mt-4 space-y-4 pt-4 border-t border-borderBg/40">
                {/* Username */}
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1">EARTHDATA USERNAME</label>
                  <input 
                    type="text" value={nasaUser} onChange={e => setNasaUser(e.target.value)}
                    placeholder="Username"
                    className="w-full bg-darkBg border border-borderBg rounded p-1.5 text-xs focus:outline-none focus:border-accentRed"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1">PASSWORD</label>
                  <div className="relative">
                    <input 
                      type={showNasaPass ? 'text' : 'password'} value={nasaPass} onChange={e => setNasaPass(e.target.value)}
                      placeholder="Password"
                      className="w-full bg-darkBg border border-borderBg rounded p-1.5 text-xs focus:outline-none focus:border-accentRed pr-8"
                    />
                    <button onClick={() => setShowNasaPass(!showNasaPass)} className="absolute right-2 top-2 text-gray-500 hover:text-white">
                      {showNasaPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Datasets select */}
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-2">DATASET SELECT</label>
                  <div className="flex flex-col gap-1.5 text-xs font-semibold">
                    {['TRMM 3B42', 'GPM IMERG', 'LIS Lightning'].map(ds => {
                      const active = nasaDatasets.includes(ds);
                      return (
                        <label key={ds} className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" checked={active}
                            onChange={() => setNasaDatasets(prev => active ? prev.filter(i => i !== ds) : [...prev, ds])}
                            className="accent-accentRed"
                          />
                          <span>{ds}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CUSTOM DATA SOURCE CARD */}
          <div className={`border rounded-xl p-5 transition-all duration-300 ${
            customEnabled ? 'bg-black/10 border-accentRed shadow-md' : 'bg-darkBg border-borderBg/50 opacity-60'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-white">Custom Portal URL</h3>
                <span className="text-[10px] text-gray-400">Autonomous LLM Agent Ingestion</span>
              </div>
              <input 
                type="checkbox" checked={customEnabled} onChange={e => setCustomEnabled(e.target.checked)}
                className="w-5 h-5 accent-accentRed cursor-pointer"
              />
            </div>

            {customEnabled && (
              <div className="mt-4 space-y-4 pt-4 border-t border-borderBg/40 animate-fade-in">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1">DATA PORTAL URL</label>
                  <input 
                    type="text" value={customUrl} onChange={e => setCustomUrl(e.target.value)}
                    placeholder="https://weather-bulletin.gov/records"
                    className="w-full bg-darkBg border border-borderBg rounded p-1.5 text-xs focus:outline-none focus:border-accentRed font-mono"
                  />
                  <span className="text-[9px] text-gray-500 mt-1 block">Paste weather data portal URL. The LLM Agent will autonomously extract coordinates & variables.</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* API Key warning */}
      {!era5Key && !imdKey && !nasaUser && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mt-6 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-yellow-500 font-bold text-xs">Credentials Absent (Simulation Fallback Engaged)</h4>
            <p className="text-2xs text-gray-400 mt-1">No API keys or logins are specified. The pipeline will automatically generate highly realistic multi-station meteorological time series matching your bounding coordinates, seasonal monsoon peaks, and pressure levels for demo execution.</p>
          </div>
        </div>
      )}

      {/* TRIGGER BUTTON */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={handleTriggerPipeline}
          disabled={isRunning}
          className={`px-8 py-4 rounded-xl font-extrabold text-sm uppercase tracking-wider flex items-center gap-3 transition-all duration-300 ${
            isRunning 
              ? 'bg-gray-600 cursor-not-allowed text-gray-400' 
              : 'bg-accentRed hover:bg-accentRedHover text-white shadow-lg shadow-accentRed/30 hover:scale-105'
          }`}
        >
          {isRunning ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Pipeline running...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Trigger Ingestion & Process Pipeline</span>
            </>
          )}
        </button>
      </div>

      {/* LOGS PANEL */}
      {(isRunning || logs.length > 0) && (
        <div className="mt-8">
          <TerminalLog logs={logs} />
        </div>
      )}

      {/* SAMPLING REPORT & SMART MERGE PANEL */}
      {samplingReport && !ingestStats && (
        <div className="bg-cardBg/95 border-2 border-borderBg p-6 rounded-3xl mt-8 shadow-2xl animate-fade-in">
          <h2 className="text-lg font-bold text-white mb-4 border-b border-borderBg pb-2 flex items-center gap-2">
            <span>🔬 Gridded Temporal Sampling Report</span>
            <span className="bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded text-3xs font-bold text-blue-400">Analysis Complete</span>
          </h2>
          <p className="text-xs text-gray-400 mb-6">Review the detected sampling intervals and coordinate density across ingested raw archives prior to spatial-temporal co-registration.</p>
          
          <div className="overflow-x-auto mb-6 rounded-xl border border-borderBg bg-darkBg/50">
            <table className="min-w-full divide-y divide-borderBg text-left text-xs">
              <thead className="bg-black/40 text-gray-400 font-bold uppercase tracking-wider text-2xs">
                <tr>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Variables</th>
                  <th className="px-5 py-3">Detected Interval</th>
                  <th className="px-5 py-3">Irregular Gaps</th>
                  <th className="px-5 py-3">Missing Expected (Pct)</th>
                  <th className="px-5 py-3">Duplicates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderBg text-gray-300">
                {Object.keys(samplingReport.sources).map(srcKey => {
                  const sdata = samplingReport.sources[srcKey];
                  const hasIrregular = sdata.irregular_gaps_pct > 10;
                  const hasMissing = sdata.missing_timestamps_count > 0;
                  return (
                    <tr key={srcKey} className="hover:bg-black/10 transition-colors">
                      <td className="px-5 py-4 font-bold text-white font-mono">{srcKey}</td>
                      <td className="px-5 py-4 truncate max-w-[200px]" title={sdata.variables.join(', ')}>{sdata.variables.join(', ')}</td>
                      <td className="px-5 py-4 font-semibold text-white">{sdata.detected_interval}</td>
                      <td className={`px-5 py-4 font-semibold ${hasIrregular ? 'text-red-400' : 'text-green-400'}`}>
                        {sdata.irregular_gaps_pct.toFixed(1)}%
                      </td>
                      <td className={`px-5 py-4 font-semibold ${hasMissing ? 'text-red-400' : 'text-green-400'}`}>
                        {sdata.missing_timestamps_count} ({sdata.missing_timestamps_pct.toFixed(1)}%)
                      </td>
                      <td className="px-5 py-4 text-white font-mono">{sdata.duplicate_timestamps_count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Merge Recommendation Alert */}
          <div className="bg-accentRed/5 border border-accentRed/20 rounded-xl p-4 mb-8">
            <h4 className="text-accentRed font-extrabold text-xs uppercase tracking-wider mb-1">Coarsest Alignment Recommendation</h4>
            <p className="text-2xs text-gray-400 leading-relaxed">
              Recommended merge interval: <span className="text-white font-bold">{samplingReport.recommended_common_interval}</span>. 
              Sources will be resampled using: <span className="text-white font-mono">mean</span> for temperature/humidity/pressure/wind variables, 
              <span className="text-white font-mono">max</span> for CAPE/CIN/precipitation, and <span className="text-white font-mono">sum</span> for total_precipitation.
            </p>
          </div>

          {/* User Overrides Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-borderBg/40 pt-6">
            {/* Target Interval Selection */}
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase block mb-2">Target Resampling Interval</label>
              <select
                value={targetMergeInterval}
                onChange={e => setTargetMergeInterval(e.target.value)}
                className="w-full bg-darkBg border border-borderBg text-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-accentRed font-semibold"
              >
                {['1-hourly', '3-hourly', '6-hourly', '12-hourly', 'Daily', 'Weekly'].filter(intervalOption => {
                  const ranks: Record<string, number> = {
                    '1-hourly': 2, '3-hourly': 3, '6-hourly': 4, '12-hourly': 5, 'daily': 6, 'weekly': 7
                  };
                  const optRank = ranks[intervalOption.toLowerCase()] || 8;
                  
                  let finestActiveRank = 9;
                  Object.keys(samplingReport.sources).forEach(sk => {
                    const dInt = samplingReport.sources[sk].detected_interval.toLowerCase();
                    const r = ranks[dInt] || 2;
                    if (r < finestActiveRank) finestActiveRank = r;
                  });
                  
                  return optRank >= finestActiveRank;
                }).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <span className="text-[10px] text-gray-500 mt-1.5 block">Resampling downscales finer data to match coarser rates, clearing gaps.</span>
            </div>

            {/* Aggregation Rules Selection */}
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase block mb-2">Per-Variable Aggregation Methods</label>
              <div className="bg-darkBg border border-borderBg rounded-xl p-4 max-h-[220px] overflow-y-auto space-y-3 custom-scrollbar">
                {Object.keys(variableAggRules).map(v => (
                  <div key={v} className="flex justify-between items-center text-xs">
                    <span className="font-mono text-gray-300 truncate max-w-[180px]">{v}</span>
                    <select
                      value={variableAggRules[v]}
                      onChange={e => setVariableAggRules(prev => ({ ...prev, [v]: e.target.value }))}
                      className="bg-cardBg border border-borderBg text-2xs text-gray-300 rounded p-1 focus:outline-none"
                    >
                      <option value="mean">mean</option>
                      <option value="max">max</option>
                      <option value="min">min</option>
                      <option value="sum">sum</option>
                      <option value="first">first</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Confirm & Merge Trigger */}
          <div className="mt-8 pt-4 border-t border-borderBg/30 flex justify-center">
            <button
              onClick={handleConfirmMerge}
              disabled={isMerging}
              className={`px-8 py-3.5 rounded-xl font-extrabold text-sm uppercase tracking-wider flex items-center gap-3 transition-all ${
                isMerging 
                  ? 'bg-gray-600 cursor-not-allowed text-gray-400' 
                  : 'bg-successGreen hover:bg-successGreenHover text-white shadow-lg shadow-successGreen/25 hover:scale-105'
              }`}
            >
              {isMerging ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Merging & Resampling Data...</span>
                </>
              ) : (
                <span>Confirm & Smart Merge</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* INGEST STATS & PREVIEW TABLE */}
      {ingestStats && (
        <div className="mt-8 border-t border-borderBg pt-8">
          <h2 className="text-lg font-bold text-white mb-4">Ingestion Results</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* stats card */}
            <div className="bg-cardBg border border-borderBg p-5 rounded-xl md:col-span-2">
              <h3 className="font-bold text-sm text-white mb-3">Dataset Statistics</h3>
              <div className="space-y-2 text-xs font-semibold">
                <div className="flex justify-between border-b border-borderBg pb-1.5"><span className="text-gray-400">Total Rows:</span><span className="text-white">{ingestStats.total_rows.toLocaleString()}</span></div>
                <div className="flex justify-between border-b border-borderBg pb-1.5"><span className="text-gray-400">Total Columns:</span><span className="text-white">{ingestStats.total_columns}</span></div>
                <div className="flex justify-between border-b border-borderBg pb-1.5"><span className="text-gray-400">File Size:</span><span className="text-white">{ingestStats.file_size}</span></div>
                <div className="flex justify-between border-b border-borderBg pb-1.5"><span className="text-gray-400">Date Range:</span><span className="text-white text-right">{ingestStats.date_range}</span></div>
                <div className="flex justify-between pt-1"><span className="text-gray-400">Sources Merged:</span><span className="text-successGreen font-bold">{ingestStats.sources_included.join(', ')}</span></div>
              </div>
            </div>
            
            {/* download card */}
            <div className="bg-cardBg border border-borderBg p-5 rounded-xl md:col-span-3 flex flex-col justify-center items-center text-center">
              <div className="w-12 h-12 bg-successGreen/25 rounded-full flex items-center justify-center mb-3">
                <Download className="w-6 h-6 text-successGreen" />
              </div>
              <h3 className="font-extrabold text-sm text-white">Ingested Dataset Produced Successfully</h3>
              <p className="text-2xs text-gray-400 max-w-sm mt-1 mb-4">You can download the raw joined CSV dataset. Tap "Run EDA & Preprocessing" in Step 2 to begin the automated cleansing audits.</p>
              
              <a 
                href={getDownloadUrl(ingestStats.filename, sessionId)}
                className="px-6 py-2.5 bg-successGreen hover:bg-successGreenHover text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download Raw Dataset (CSV)</span>
              </a>
            </div>
          </div>
          
          <PreviewTable filename={ingestStats.filename} sessionId={sessionId} />
        </div>
      )}
    </div>
  );
}
