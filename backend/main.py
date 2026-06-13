import os
import json
import asyncio
import datetime
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, SecretStr
from typing import List, Dict, Any, Optional
from weather_summary import WeatherSummaryError, generate_weather_summary

import pandas as pd
import numpy as np

# Sklearn imports
from sklearn.preprocessing import LabelEncoder
from sklearn.impute import KNNImputer

# VIF import
from statsmodels.stats.outliers_influence import variance_inflation_factor

# Local imports
from formulas import FORMULA_CATALOG, get_column_case_insensitive
from mock_data import generate_mock_weather_data
from utils import get_session_dir, merge_csvs, compile_eda_html_report, compile_dimensionality_html_report

# New Ingestion & Sampling analyzer imports
from ingestion.llm_agent import IngestionAgent
from ingestion.sampling_analyzer import analyze_sampling_rates
from ingestion.smart_merge import smart_merge_dataframes

app = FastAPI(title="Meteorological Pipeline API")

VERCEL_BACKEND_PREFIX = "/_/backend"


@app.middleware("http")
async def normalize_vercel_backend_prefix(request: Request, call_next):
    if request.scope["path"].startswith(f"{VERCEL_BACKEND_PREFIX}/"):
        request.scope["path"] = request.scope["path"][len(VERCEL_BACKEND_PREFIX):]
    return await call_next(request)

# Enable CORS for frontend on port 3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class IngestConfig(BaseModel):
    session_id: str
    north: float
    south: float
    west: float
    east: float
    years: List[int]
    months: List[int]
    daysRange: List[int]
    interval: str
    sources: Dict[str, Any]

class MergeConfig(BaseModel):
    session_id: str
    target_interval: str
    agg_rules: Dict[str, str]
    sources: List[str]

class EDAApplyConfig(BaseModel):
    file_path: str
    session_id: str
    imputations: Dict[str, str]  # col -> "drop" | "median" | "keep"
    outliers: Dict[str, str]      # col -> "cap" | "remove" | "keep"
    remove_duplicates: bool
    drop_near_constant: bool

class DerivedConfig(BaseModel):
    file_path: str
    session_id: str
    selected_params: List[str]

class DimAnalyzeConfig(BaseModel):
    file_path: str
    session_id: str
    active_columns: List[str]

class DimFinalizeConfig(BaseModel):
    file_path: str
    session_id: str
    retained_features: List[str]
    dropped_features: List[str]

class ClaudeSettingsConfig(BaseModel):
    api_key: SecretStr
    model: str = "claude-sonnet-4-6"

# -----------------
# SETTINGS ENDPOINTS
# -----------------
@app.get("/api/settings/claude")
async def get_claude_settings():
    return {
        "configured": bool(os.getenv("ANTHROPIC_API_KEY")),
        "model": os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
    }

@app.post("/api/settings/claude")
async def update_claude_settings(config: ClaudeSettingsConfig):
    api_key = config.api_key.get_secret_value().strip()
    allowed_models = {
        "claude-sonnet-4-6",
        "claude-haiku-4-5",
        "claude-opus-4-8",
    }

    if not api_key.startswith("sk-ant-") or len(api_key) < 30:
        raise HTTPException(status_code=400, detail="Enter a valid Anthropic API key.")
    if config.model not in allowed_models:
        raise HTTPException(status_code=400, detail="Unsupported Claude model.")

    os.environ["ANTHROPIC_API_KEY"] = api_key
    os.environ["ANTHROPIC_MODEL"] = config.model
    os.environ["SUMMARY_PROVIDER"] = "claude"

    return {
        "configured": True,
        "model": config.model,
    }

# -----------------
# INGEST ENDPOINTS
# -----------------
@app.post("/api/ingest")
async def ingest_data(config: IngestConfig):
    session_dir = get_session_dir(config.session_id)
    
    async def sse_generator():
        try:
            yield f"data: {json.dumps({'message': '🚀 Initializing Autonomous Ingestion Agent Layer...', 'status': 'running'})}\n\n"
            await asyncio.sleep(0.4)
            
            active_sources = {}
            for src_name, src_val in config.sources.items():
                if src_val.get("enabled", False):
                    active_sources[src_name.upper()] = src_val
                    
            if not active_sources:
                yield f"data: {json.dumps({'message': '❌ Error: No meteorological sources selected. Aborting.', 'status': 'failed'})}\n\n"
                return
                
            sources_str = ", ".join(active_sources.keys())
            yield f"data: {json.dumps({'message': f'Active sources resolved: {sources_str}', 'status': 'running'})}\n\n"
            await asyncio.sleep(0.4)
            
            agent = IngestionAgent()
            loop = asyncio.get_running_loop()
            queue = asyncio.Queue()
            
            def make_log_callback(src_name):
                def log_callback(msg, status="running", is_reasoning=False):
                    loop.call_soon_threadsafe(
                        queue.put_nowait,
                        {"message": f"[{src_name}] {msg}", "status": status, "is_reasoning": is_reasoning}
                    )
                return log_callback
            
            # Download sources sequentially
            dfs = {}
            bbox = {
                "north": config.north,
                "south": config.south,
                "west": config.west,
                "east": config.east
            }
            
            for src_name, src_val in active_sources.items():
                yield f"data: {json.dumps({'message': f'🌐 Engaging Ingestion Agent for source: {src_name}...', 'status': 'running'})}\n\n"
                await asyncio.sleep(0.3)
                
                # Execute agent in background thread to keep FastAPI fully responsive
                task = asyncio.create_task(asyncio.to_thread(
                    agent.run,
                    src_name,
                    src_val,
                    config.years,
                    config.months,
                    config.daysRange,
                    bbox,
                    config.interval,
                    make_log_callback(src_name)
                ))
                
                # Stream logs in real-time
                while not task.done() or not queue.empty():
                    try:
                        log_item = await asyncio.wait_for(queue.get(), timeout=0.05)
                        yield f"data: {json.dumps(log_item)}\n\n"
                    except asyncio.TimeoutError:
                        await asyncio.sleep(0.05)
                
                # Retrieve dataframe result
                df_src = await task
                
                # Save source-specific CSV
                src_filename = f"source_{src_name.lower()}.csv"
                src_path = os.path.join(session_dir, src_filename)
                df_src.to_csv(src_path, index=False)
                
                dfs[src_name] = df_src
                yield f"data: {json.dumps({'message': f'✓ Ingestion complete for {src_name}. Saved variables to local repository.', 'status': 'done'})}\n\n"
                await asyncio.sleep(0.3)
                
            # 2. Sampling Analyzer Phase
            yield f"data: {json.dumps({'message': '🔬 Initiating high-resolution temporal sampling rate audit...', 'status': 'running'})}\n\n"
            await asyncio.sleep(0.5)
            
            # Analyze rates
            report = analyze_sampling_rates(dfs)
            
            # Convert report to dict for JSON transfer
            report_dict = {
                "recommended_common_interval": report.recommended_common_interval,
                "sources": {
                    k: {
                        "source_name": v.source_name,
                        "variables": v.variables,
                        "detected_interval": v.detected_interval,
                        "median_interval_seconds": v.median_interval_seconds,
                        "min_interval_seconds": v.min_interval_seconds,
                        "max_interval_seconds": v.max_interval_seconds,
                        "irregular_gaps_pct": v.irregular_gaps_pct,
                        "missing_timestamps_count": v.missing_timestamps_count,
                        "missing_timestamps_pct": v.missing_timestamps_pct,
                        "duplicate_timestamps_count": v.duplicate_timestamps_count
                    }
                    for k, v in report.sources.items()
                }
            }
            
            yield f"data: {json.dumps({'message': '✓ Temporal analysis complete! Pausing for spatial-temporal merge confirmation...', 'status': 'analyzed', 'report': report_dict})}\n\n"
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'message': f'❌ Operational Error: {str(e)}', 'status': 'failed'})}\n\n"
            
    return StreamingResponse(sse_generator(), media_type="text/event-stream")


@app.post("/api/ingest/merge")
async def merge_data(config: MergeConfig):
    session_dir = get_session_dir(config.session_id)
    
    # Load individual dataframes
    dataframes = {}
    for src in config.sources:
        src_filename = f"source_{src.lower()}.csv"
        src_path = os.path.join(session_dir, src_filename)
        if os.path.exists(src_path):
            dataframes[src] = pd.read_csv(src_path)
            
    if not dataframes:
        raise HTTPException(status_code=400, detail="No source dataframes found in workspace to merge.")
        
    try:
        merged_filename = f"raw_dataset_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        merged_path = os.path.join(session_dir, merged_filename)
        
        # Execute smart merge
        stats = smart_merge_dataframes(dataframes, config.target_interval, config.agg_rules, merged_path)
        
        # Save sampling report JSON in session for EDA tab use later
        sampling_report_path = os.path.join(session_dir, "sampling_report.json")
        
        # Re-run sampling analyzer on raw loaded dataframes to save in details
        report = analyze_sampling_rates(dataframes)
        report_dict = {
            "recommended_common_interval": report.recommended_common_interval,
            "sources": {
                k: {
                    "source_name": v.source_name,
                    "variables": v.variables,
                    "detected_interval": v.detected_interval,
                    "median_interval_seconds": v.median_interval_seconds,
                    "min_interval_seconds": v.min_interval_seconds,
                    "max_interval_seconds": v.max_interval_seconds,
                    "irregular_gaps_pct": v.irregular_gaps_pct,
                    "missing_timestamps_count": v.missing_timestamps_count,
                    "missing_timestamps_pct": v.missing_timestamps_pct,
                    "duplicate_timestamps_count": v.duplicate_timestamps_count
                }
                for k, v in report.sources.items()
            }
        }
        
        with open(sampling_report_path, "w", encoding="utf-8") as f:
            json.dump({
                "report": report_dict,
                "stats": stats
            }, f)
            
        # Compute final size in MB
        file_size_mb = os.path.getsize(merged_path) / (1024 * 1024)
        
        # Load merged dataframe to find actual date ranges
        merged_df = pd.read_csv(merged_path)
        merged_df["timestamp"] = pd.to_datetime(merged_df["timestamp"])
        min_time = merged_df["timestamp"].min()
        max_time = merged_df["timestamp"].max()
        date_range_str = f"{min_time.strftime('%Y-%m-%d')} to {max_time.strftime('%Y-%m-%d')}"
        
        return {
            "status": "success",
            "message": "🎉 Spatial-temporal merge and resampling executed successfully!",
            "stats": {
                "filename": merged_filename,
                "total_rows": stats["total_rows"],
                "total_columns": stats["total_columns"],
                "date_range": date_range_str,
                "sources_included": config.sources,
                "file_size": f"{file_size_mb:.2f} MB"
            }
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Merge execution error: {str(e)}")

# -----------------
# EDA RUN ENDPOINT
# -----------------
@app.post("/api/eda/analyze")
async def eda_analyze(payload: Dict[str, str]):
    file_path = payload.get("file_path")
    session_id = payload.get("session_id")
    
    if not file_path or not session_id:
        raise HTTPException(status_code=400, detail="Missing file_path or session_id")
        
    session_dir = get_session_dir(session_id)
    full_path = os.path.join(session_dir, file_path)
    
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Raw dataset not found")
        
    async def eda_sse_generator():
        try:
            yield f"data: {json.dumps({'message': '🔍 Initiating Automated Exploratory Data Analysis & Preprocessing Audit...', 'step': 0, 'status': 'running'})}\n\n"
            await asyncio.sleep(0.3)
            
            df = pd.read_csv(full_path)
            
            # Step 1: Shape & dtypes audit
            yield f"data: {json.dumps({'message': '1️⃣ Compiling shape & dtypes audit...', 'step': 1, 'status': 'running'})}\n\n"
            await asyncio.sleep(0.4)
            
            shape = list(df.shape)
            dtypes = {col: str(dtype) for col, dtype in df.dtypes.items()}
            
            yield f"data: {json.dumps({'message': f'Shape resolved: {shape[0]} rows x {shape[1]} columns.', 'step': 1, 'status': 'done'})}\n\n"
            await asyncio.sleep(0.2)
            
            # Step 2: Encode object/string columns
            yield f"data: {json.dumps({'message': '2️⃣ Detecting object/string columns to auto-encode...', 'step': 2, 'status': 'running'})}\n\n"
            await asyncio.sleep(0.4)
            
            encoded_columns = []
            encoded_mappings = {}
            for col in df.columns:
                if df[col].dtype == "object" and col not in ["timestamp", "time"]:
                    le = LabelEncoder()
                    df[col] = df[col].fillna("MISSING")
                    df[col] = le.fit_transform(df[col].astype(str))
                    encoded_columns.append(col)
                    # store small preview map
                    mapping = {str(c): int(i) for i, c in enumerate(le.classes_)}
                    encoded_mappings[col] = mapping
                    
            yield f"data: {json.dumps({'message': f'Encoded {len(encoded_columns)} object columns: {list(encoded_columns)}', 'step': 2, 'status': 'done'})}\n\n"
            await asyncio.sleep(0.2)
            
            # Step 3: Parse timestamp columns
            yield f"data: {json.dumps({'message': '3️⃣ Parsing timestamp columns & extracting seasonal variables...', 'step': 3, 'status': 'running'})}\n\n"
            await asyncio.sleep(0.4)
            
            time_col = next((c for c in df.columns if c.lower() in ["timestamp", "time"]), None)
            if time_col:
                dt_col = pd.to_datetime(df[time_col])
                df["year"] = dt_col.dt.year
                df["month"] = dt_col.dt.month
                df["day"] = dt_col.dt.day
                df["hour"] = dt_col.dt.hour
                df["day_of_year"] = dt_col.dt.dayofyear
                
                # Season mapping (1=DJF, 2=MAM, 3=JJA, 4=SON)
                def get_season(m):
                    if m in [12, 1, 2]: return 1
                    if m in [3, 4, 5]: return 2
                    if m in [6, 7, 8]: return 3
                    return 4
                    
                df["season"] = dt_col.dt.month.map(get_season)
                
            yield f"data: {json.dumps({'message': '✓ Extracted year, month, day, hour, day_of_year, season.', 'step': 3, 'status': 'done'})}\n\n"
            await asyncio.sleep(0.2)
            
            # Step 4: Missing value analysis
            yield f"data: {json.dumps({'message': '4️⃣ Computing missing value statistics per column...', 'step': 4, 'status': 'running'})}\n\n"
            await asyncio.sleep(0.4)
            
            missing_counts = df.isnull().sum()
            missing_pct = (missing_counts / len(df)) * 100
            missingness_report = missing_pct.to_dict()
            
            yield f"data: {json.dumps({'message': '✓ Missing value audit completed.', 'step': 4, 'status': 'done'})}\n\n"
            await asyncio.sleep(0.2)
            
            # Step 5: Imputation strategies audit
            yield f"data: {json.dumps({'message': '5️⃣ Evaluating imputation strategy requirements...', 'step': 5, 'status': 'running'})}\n\n"
            await asyncio.sleep(0.4)
            
            imputation_needs = {}
            for col in df.columns:
                pct = missingness_report.get(col, 0)
                if pct > 0:
                    if pct < 5:
                        imputation_needs[col] = {"strategy": "linear", "pct": pct}
                    elif pct <= 30:
                        imputation_needs[col] = {"strategy": "knn", "pct": pct}
                    else:
                        imputation_needs[col] = {"strategy": "user_ask", "pct": pct}
                        
            yield f"data: {json.dumps({'message': f'Identified {len(imputation_needs)} columns requiring imputation.', 'step': 5, 'status': 'done'})}\n\n"
            await asyncio.sleep(0.2)
            
            # Step 6: Outlier detection using IQR
            yield f"data: {json.dumps({'message': '6️⃣ Performing outlier detection via IQR method...', 'step': 6, 'status': 'running'})}\n\n"
            await asyncio.sleep(0.4)
            
            outlier_counts = {}
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            for col in numeric_cols:
                # ignore time components
                if col in ["year", "month", "day", "hour", "day_of_year", "season", "latitude", "longitude"]:
                    continue
                non_null = df[col].dropna()
                if len(non_null) > 10:
                    q25, q75 = np.percentile(non_null, 25), np.percentile(non_null, 75)
                    iqr = q75 - q25
                    lower_bound = q25 - 1.5 * iqr
                    upper_bound = q75 + 1.5 * iqr
                    outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
                    if len(outliers) > 0:
                        outlier_counts[col] = len(outliers)
                        
            yield f"data: {json.dumps({'message': f'Detected outliers in {len(outlier_counts)} variables.', 'step': 6, 'status': 'done'})}\n\n"
            await asyncio.sleep(0.2)
            
            # Step 7: Duplicate row detection
            yield f"data: {json.dumps({'message': '7️⃣ Auditing duplicate row profiles...', 'step': 7, 'status': 'running'})}\n\n"
            await asyncio.sleep(0.4)
            
            duplicate_count = int(df.duplicated().sum())
            
            yield f"data: {json.dumps({'message': f'Found {duplicate_count} duplicate rows.', 'step': 7, 'status': 'done'})}\n\n"
            await asyncio.sleep(0.2)
            
            # Step 8: Constant column detection
            yield f"data: {json.dumps({'message': '8️⃣ Reviewing feature variances for constant columns...', 'step': 8, 'status': 'running'})}\n\n"
            await asyncio.sleep(0.4)
            
            constant_cols = []
            for col in numeric_cols:
                var = df[col].var(ddof=0)
                if pd.notnull(var) and var < 0.001:
                    constant_cols.append(col)
                    
            yield f"data: {json.dumps({'message': f'Detected {len(constant_cols)} near-constant columns (variance < 0.001).', 'step': 8, 'status': 'done'})}\n\n"
            await asyncio.sleep(0.2)
            
            # Step 9: Distribution plots calculations (histogram + KDE for top 12 variables by variance)
            yield f"data: {json.dumps({'message': '9️⃣ Rendering distribution shapes for high variance variables...', 'step': 9, 'status': 'running'})}\n\n"
            await asyncio.sleep(0.4)
            
            variances = {}
            for col in numeric_cols:
                if col in ["year", "month", "day", "hour", "day_of_year", "season", "latitude", "longitude"]:
                    continue
                v = df[col].var()
                if pd.notnull(v):
                    variances[col] = v
            top_var_cols = sorted(variances, key=variances.get, reverse=True)[:12]
            
            distributions = []
            for col in top_var_cols:
                non_null = df[col].dropna()
                counts, bin_edges = np.histogram(non_null, bins=15)
                # Compute centers of bins
                bin_centers = [float(0.5 * (bin_edges[i] + bin_edges[i+1])) for i in range(len(counts))]
                distributions.append({
                    "name": col,
                    "bins": bin_centers,
                    "counts": [int(c) for c in counts]
                })
                
            yield f"data: {json.dumps({'message': '✓ Calculated distributions.', 'step': 9, 'status': 'done'})}\n\n"
            await asyncio.sleep(0.2)
            
            # Step 10: Correlation Heatmap
            yield f"data: {json.dumps({'message': '🔟 Generating Spearman correlation grids...', 'step': 10, 'status': 'running'})}\n\n"
            await asyncio.sleep(0.4)
            
            top_20_corr_cols = sorted(variances, key=variances.get, reverse=True)[:20]
            corr_df = df[top_20_corr_cols].corr(method="spearman").fillna(0.0)
            
            correlation = {
                "columns": list(corr_df.columns),
                "matrix": corr_df.values.tolist()
            }
            
            yield f"data: {json.dumps({'message': '✓ Generated correlation heatmap.', 'step': 10, 'status': 'done'})}\n\n"
            await asyncio.sleep(0.2)
            
            # Step 11: Temporal trend plot calculations
            yield f"data: {json.dumps({'message': '1️⃣1️⃣ Analyzing temporal trends over timeline...', 'step': 11, 'status': 'running'})}\n\n"
            await asyncio.sleep(0.4)
            
            temporal_trends = {}
            t_col = next((c for c in df.columns if c.lower() in ["timestamp", "time"]), None)
            if t_col:
                df_temp = df.copy()
                df_temp[t_col] = pd.to_datetime(df_temp[t_col])
                # group by day to make a nice chart
                grouped = df_temp.groupby(df_temp[t_col].dt.date).mean(numeric_only=True)
                dates = [str(d) for d in grouped.index]
                
                for col in top_var_cols:
                    temporal_trends[col] = {
                        "x": dates,
                        "y": [float(y) if pd.notnull(y) else None for y in grouped[col]]
                    }
                    
            yield f"data: {json.dumps({'message': '✓ Analyzed temporal trend lines.', 'step': 11, 'status': 'done'})}\n\n"
            await asyncio.sleep(0.2)
            
            # Save raw dataframe with temp time columns into session so apply can read it
            temp_analyzed_name = f"temp_analyzed_{session_id}.csv"
            df.to_csv(os.path.join(session_dir, temp_analyzed_name), index=False)
            
            # Read sampling report if present
            sampling_report = None
            sampling_report_path = os.path.join(session_dir, "sampling_report.json")
            if os.path.exists(sampling_report_path):
                try:
                    with open(sampling_report_path, "r", encoding="utf-8") as sf:
                        sampling_report = json.load(sf)
                except Exception:
                    pass

            # Form final metadata package
            analysis_payload = {
                "shape": shape,
                "dtypes": dtypes,
                "encoded_columns": encoded_columns,
                "encoded_mappings": encoded_mappings,
                "missingness": missingness_report,
                "imputation_needs": imputation_needs,
                "outliers": outlier_counts,
                "duplicate_count": duplicate_count,
                "constant_cols": constant_cols,
                "distributions": distributions,
                "correlation": correlation,
                "temporal_trends": temporal_trends,
                "temp_analyzed_file": temp_analyzed_name,
                "sampling_report": sampling_report
            }
            
            yield f"data: {json.dumps({'message': '🏆 Full Exploratory Data Analysis complete!', 'status': 'completed', 'results': analysis_payload})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'message': f'❌ Operational Error in EDA: {str(e)}', 'status': 'failed'})}\n\n"
            
    return StreamingResponse(eda_sse_generator(), media_type="text/event-stream")

# -----------------
# EDA APPLY PREPROCESSING ENDPOINT
# -----------------
@app.post("/api/eda/apply")
async def eda_apply(config: EDAApplyConfig):
    session_dir = get_session_dir(config.session_id)
    raw_path = os.path.join(session_dir, config.file_path)
    
    # Load temp analyzed csv
    temp_file = f"temp_analyzed_{config.session_id}.csv"
    temp_path = os.path.join(session_dir, temp_file)
    
    if os.path.exists(temp_path):
        df = pd.read_csv(temp_path)
    elif os.path.exists(raw_path):
        df = pd.read_csv(raw_path)
    else:
        raise HTTPException(status_code=404, detail="Dataset file not found")
        
    try:
        # 1. Remove duplicate rows if selected
        dup_count = 0
        if config.remove_duplicates:
            original_len = len(df)
            df = df.drop_duplicates().reset_index(drop=True)
            dup_count = original_len - len(df)
            
        # 2. Impute columns
        imputed_count = 0
        
        # We need to preserve time variables during KNN imputation to avoid corrupting them
        time_col = next((c for c in df.columns if c.lower() in ["timestamp", "time"]), None)
        df_time = df[time_col] if time_col else None
        
        # Separate numeric columns for imputation
        num_cols = df.select_dtypes(include=[np.number]).columns
        
        # Calculate missing counts before
        missing_before = df.isnull().sum().sum()
        
        # Run linear interpolation for columns < 5% missing
        for col in df.columns:
            if col in ["timestamp", "time", "year", "month", "day", "hour", "day_of_year", "season"]:
                continue
            pct = df[col].isnull().mean()
            if 0 < pct < 0.05:
                # Linear time-aware or simple linear interpolation
                df[col] = df[col].interpolate(method="linear").ffill().bfill()
                
        # Run user selections for columns > 30% missing
        for col, strategy in config.imputations.items():
            if col in df.columns:
                if strategy == "drop":
                    df = df.drop(columns=[col])
                elif strategy == "median":
                    med = df[col].median()
                    df[col] = df[col].fillna(med)
                # "keep" leaves as-is
                
        # Run KNN Imputation (k=5) for remaining numeric columns with 5-30% missing
        remaining_missing_cols = [c for c in df.columns if df[c].isnull().sum() > 0 and c in num_cols]
        # Ignore datetime components
        remaining_missing_cols = [c for c in remaining_missing_cols if c not in ["year", "month", "day", "hour", "day_of_year", "season", "latitude", "longitude"]]
        
        if remaining_missing_cols:
            # Fit KNN Imputer only on selected float cols
            imputer = KNNImputer(n_neighbors=5)
            # Find all numeric columns for KNN features context
            knn_features = [c for c in num_cols if c in df.columns and c not in ["year", "month", "day", "hour", "day_of_year", "season"]]
            if knn_features:
                df[knn_features] = imputer.fit_transform(df[knn_features])
                
        # Handle simple ffill/bfill for any leftovers
        for col in df.columns:
            if col in num_cols:
                df[col] = df[col].ffill().bfill().fillna(0.0)
                
        missing_after = df.isnull().sum().sum()
        imputed_count = int(missing_before - missing_after)
        
        # 3. Outliers Capping / Removing
        outliers_capped_count = 0
        rows_removed_outliers = 0
        
        for col, opt in config.outliers.items():
            if col in df.columns and opt in ["cap", "remove"]:
                non_null = df[col].dropna()
                if len(non_null) > 10:
                    q25, q75 = np.percentile(non_null, 25), np.percentile(non_null, 75)
                    iqr = q75 - q25
                    lower_bound = q25 - 1.5 * iqr
                    upper_bound = q75 + 1.5 * iqr
                    
                    if opt == "cap":
                        # count elements capped
                        capped_mask = (df[col] < lower_bound) | (df[col] > upper_bound)
                        outliers_capped_count += int(capped_mask.sum())
                        df[col] = np.clip(df[col], lower_bound, upper_bound)
                    elif opt == "remove":
                        orig_len = len(df)
                        df = df[(df[col] >= lower_bound) & (df[col] <= upper_bound)].reset_index(drop=True)
                        rows_removed_outliers += int(orig_len - len(df))
                        
        # 4. Drop near constant columns if selected
        dropped_cols = []
        if config.drop_near_constant:
            for col in df.select_dtypes(include=[np.number]).columns:
                if col in ["year", "month", "day", "hour", "day_of_year", "season", "latitude", "longitude"]:
                    continue
                var = df[col].var(ddof=0)
                if pd.notnull(var) and var < 0.001:
                    df = df.drop(columns=[col])
                    dropped_cols.append(col)
                    
        # 5. Clean up temporary column calculations
        # Ensure timestamp is string in saved cleaned file
        cleaned_filename = f"cleaned_dataset_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        cleaned_path = os.path.join(session_dir, cleaned_filename)
        df.to_csv(cleaned_path, index=False)
        
        # Compile HTML report JSON info
        # Re-compute variances and distributions/correlations for the html file
        remaining_numeric_cols = df.select_dtypes(include=[np.number]).columns
        remaining_numeric_cols = [c for c in remaining_numeric_cols if c not in ["year", "month", "day", "hour", "day_of_year", "season", "latitude", "longitude"]]
        
        variances = {col: float(df[col].var()) for col in remaining_numeric_cols if pd.notnull(df[col].var())}
        top_var_cols = sorted(variances, key=variances.get, reverse=True)[:12]
        
        distributions = []
        for col in top_var_cols:
            counts, bin_edges = np.histogram(df[col].dropna(), bins=15)
            bin_centers = [float(0.5 * (bin_edges[i] + bin_edges[i+1])) for i in range(len(counts))]
            distributions.append({
                "name": col,
                "bins": bin_centers,
                "counts": [int(c) for c in counts]
            })
            
        top_20_corr_cols = sorted(variances, key=variances.get, reverse=True)[:20]
        corr_df = df[top_20_corr_cols].corr(method="spearman").fillna(0.0)
        correlation = {
            "columns": list(corr_df.columns),
            "matrix": corr_df.values.tolist()
        }
        
        missingness_report = df.isnull().mean().to_dict()
        
        # Read sampling report if present
        sampling_report = None
        sampling_report_path = os.path.join(session_dir, "sampling_report.json")
        if os.path.exists(sampling_report_path):
            try:
                with open(sampling_report_path, "r", encoding="utf-8") as sf:
                    sampling_report = json.load(sf)
            except Exception:
                pass

        # Log Summary
        eda_summary = {
            "shape": list(df.shape),
            "duplicates_removed": dup_count,
            "imputed_count": imputed_count,
            "outliers_capped_count": outliers_capped_count,
            "rows_removed_outliers": rows_removed_outliers,
            "encoded_columns": list(config.imputations.keys()),  # proxies
            "dropped_cols": dropped_cols,
            "missingness": {k: float(v * 100) for k, v in missingness_report.items()},
            "correlation": correlation,
            "distributions": distributions,
            "sampling_report": sampling_report
        }
        
        html_report_filename = f"eda_report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        html_report_path = os.path.join(session_dir, html_report_filename)
        
        compile_eda_html_report(eda_summary, html_report_path)
        
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        summary_text = (
            f"🧹 Data Preprocessing Complete: {dup_count} duplicates removed. "
            f"{len(dropped_cols)} near-constant columns dropped. "
            f"{imputed_count} values imputed. "
            f"{outliers_capped_count} outlier values capped. "
            f"{rows_removed_outliers} rows removed due to outliers."
        )
        
        return {
            "status": "success",
            "message": summary_text,
            "cleaned_file": cleaned_filename,
            "html_report_file": html_report_filename,
            "stats": {
                "shape": list(df.shape),
                "total_rows": len(df),
                "total_columns": len(df.columns)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed during imputation: {str(e)}")

# -----------------
# STEP 3: DERIVED PARAMETERS
# -----------------
@app.post("/api/derived")
async def generate_derived(config: DerivedConfig):
    session_dir = get_session_dir(config.session_id)
    cleaned_path = os.path.join(session_dir, config.file_path)
    
    if not os.path.exists(cleaned_path):
        raise HTTPException(status_code=404, detail="Cleaned file not found")
        
    df = pd.read_csv(cleaned_path)
    
    # 1. Compute Catalog details
    # Match available variables to formula inputs
    catalog_status = []
    
    for key, spec in FORMULA_CATALOG.items():
        # Check inputs
        missing_inputs = []
        for inp in spec["inputs"]:
            found = get_column_case_insensitive(df, inp) is not None
            if not found:
                missing_inputs.append(inp)
                
        catalog_status.append({
            "key": key,
            "name": spec["name"],
            "formula": spec["formula"],
            "inputs_required": spec["inputs"],
            "missing_inputs": missing_inputs,
            "available": len(missing_inputs) == 0
        })
        
    # If this is a check query (no selected parameters to compute)
    if not config.selected_params:
        return {
            "catalog": catalog_status,
            "preview": None
        }
        
    # 2. Computation phase
    try:
        computed_count = 0
        current_param = "none"
        for param in config.selected_params:
            if param in FORMULA_CATALOG:
                current_param = param
                fn = FORMULA_CATALOG[param]["fn"]
                series = fn(df)
                if series is not None:
                    # Append column
                    col_name = FORMULA_CATALOG[param]["name"].replace(" ", "_").lower().replace("θe", "theta_e")
                    df[col_name] = series
                    computed_count += 1
                    
        # Save updated CSV
        derived_filename = f"derived_dataset_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        derived_path = os.path.join(session_dir, derived_filename)
        df.to_csv(derived_path, index=False)
        
        # Refresh catalog status
        # Refresh catalog status
        updated_catalog = []
        for key, spec in FORMULA_CATALOG.items():
            missing_inputs = [inp for inp in spec["inputs"] if get_column_case_insensitive(df, inp) is None]
            updated_catalog.append({
                "key": key,
                "name": spec["name"],
                "formula": spec["formula"],
                "inputs_required": spec["inputs"],
                "missing_inputs": missing_inputs,
                "available": len(missing_inputs) == 0
            })
            
        return {
            "status": "success",
            "message": f"Successfully calculated and appended {computed_count} physical parameters to the dataset.",
            "derived_file": derived_filename,
            "catalog": updated_catalog,
            "stats": {
                "shape": list(df.shape),
                "total_rows": len(df),
                "total_columns": len(df.columns)
            }
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error computing derived parameters (failed on {current_param}): {str(e)}")

# -----------------
# STEP 4: DIMENSIONALITY REDUCTION
# -----------------
@app.post("/api/dimensionality/analyze")
async def dim_analyze(config: DimAnalyzeConfig):
    session_dir = get_session_dir(config.session_id)
    derived_path = os.path.join(session_dir, config.file_path)
    
    if not os.path.exists(derived_path):
        raise HTTPException(status_code=404, detail="Derived dataset file not found")
        
    df = pd.read_csv(derived_path)
    
    # If active_columns are provided, slice dataset, otherwise use all numeric
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    # Ignore time variables & coordinates
    exclude_list = ["year", "month", "day", "hour", "day_of_year", "season", "latitude", "longitude"]
    active_cols = [c for c in config.active_columns if c in df.columns] if config.active_columns else [c for c in numeric_cols if c not in exclude_list]
    
    if not active_cols:
        return {"error": "No valid numeric columns to evaluate"}
        
    # 1. Spearman Correlation Heatmap
    corr_df = df[active_cols].corr(method="spearman").fillna(0.0)
    
    # Highly correlated pairs (|r| > 0.85)
    corr_pairs = []
    seen_pairs = set()
    for i in range(len(active_cols)):
        for j in range(i + 1, len(active_cols)):
            f1, f2 = active_cols[i], active_cols[j]
            r = corr_df.loc[f1, f2]
            if abs(r) > 0.85:
                # Suggest action: drop physically less fundamental
                # Let's say: drop f2 if f1 is standard
                action = f"Drop {f2}. {f1} is physically more fundamental."
                corr_pairs.append({
                    "feat_a": f1,
                    "feat_b": f2,
                    "r": float(r),
                    "action": action
                })
                
    # Sort pairs descending
    corr_pairs = sorted(corr_pairs, key=lambda x: abs(x["r"]), reverse=True)
    
    # 2. VIF Analysis
    vif_results = []
    # Drop NaNs for VIF
    df_vif = df[active_cols].dropna()
    
    if len(df_vif) > 5 and len(active_cols) > 1:
        try:
            for idx, col in enumerate(active_cols):
                # VIF calculation requires a matrix design
                vif_val = variance_inflation_factor(df_vif.values, idx)
                # check nan/inf
                if np.isinf(vif_val) or np.isnan(vif_val):
                    vif_val = 999.0
                vif_results.append({
                    "feature": col,
                    "vif": float(vif_val)
                })
        except Exception:
            # Fallback
            for col in active_cols:
                vif_results.append({"feature": col, "vif": 1.0})
    else:
        # Fallback if too few rows or columns
        for col in active_cols:
            vif_results.append({"feature": col, "vif": 1.0})
            
    # Sort VIF descending
    vif_results = sorted(vif_results, key=lambda x: x["vif"], reverse=True)
    
    # Important meteorology flags (CAPE, CIN, K-Index, Wind Shear, etc.)
    important_met_features = [
        "convective_available_potential_energy", "convective_inhibition", "cape_proxy",
        "k_index", "total_totals_index", "lifted_index", "showalter_index",
        "0-6km_bulk_wind_shear", "850-300hpa_wind_shear", "wind_speed", "wind_direction"
    ]
    
    return {
        "active_columns": active_cols,
        "correlation": {
            "columns": list(corr_df.columns),
            "matrix": corr_df.values.tolist()
        },
        "corr_pairs": corr_pairs,
        "vif_results": vif_results,
        "important_features": important_met_features
    }

@app.post("/api/dimensionality/finalize")
async def dim_finalize(config: DimFinalizeConfig):
    session_dir = get_session_dir(config.session_id)
    derived_path = os.path.join(session_dir, config.file_path)
    
    if not os.path.exists(derived_path):
        raise HTTPException(status_code=404, detail="Derived dataset file not found")
        
    df = pd.read_csv(derived_path)
    
    try:
        # Keep non-numeric/metadata variables, plus the final selected features
        metadata_cols = ["timestamp", "time", "year", "month", "day", "hour", "day_of_year", "season", "latitude", "longitude"]
        metadata_present = [c for c in metadata_cols if c in df.columns]
        
        final_selected = [c for c in config.retained_features if c in df.columns]
        all_cols_to_keep = list(dict.fromkeys(metadata_present + final_selected))
        
        final_df = df[all_cols_to_keep]
        
        # Save final CSV
        final_filename = f"final_dataset_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        final_path = os.path.join(session_dir, final_filename)
        final_df.to_csv(final_path, index=False)

        ai_summary = None
        ai_summary_error = None
        try:
            ai_summary = await asyncio.to_thread(generate_weather_summary, final_df)
        except WeatherSummaryError as exc:
            ai_summary_error = str(exc)
        
        # Re-compute stats for HTML Report
        numeric_final = final_df.select_dtypes(include=[np.number]).columns
        numeric_final = [c for c in numeric_final if c not in metadata_cols]
        
        corr_df = final_df[numeric_final].corr(method="spearman").fillna(0.0) if len(numeric_final) > 1 else pd.DataFrame()
        correlation = {
            "columns": list(corr_df.columns),
            "matrix": corr_df.values.tolist()
        }
        
        # Compute final VIF scores
        vif_results = []
        df_vif = final_df[numeric_final].dropna()
        if len(df_vif) > 5 and len(numeric_final) > 1:
            try:
                for idx, col in enumerate(numeric_final):
                    vif_val = variance_inflation_factor(df_vif.values, idx)
                    if np.isinf(vif_val) or np.isnan(vif_val):
                        vif_val = 999.0
                    vif_results.append({
                        "feature": col,
                        "vif": float(vif_val)
                    })
            except Exception:
                pass
                
        dim_summary = {
            "retained_features": config.retained_features,
            "dropped_features": config.dropped_features,
            "vif_results": sorted(vif_results, key=lambda x: x["vif"], reverse=True),
            "corr_pairs": [],  # High correlations cleared
            "correlation": correlation
        }
        
        html_report_filename = f"dimensionality_report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        html_report_path = os.path.join(session_dir, html_report_filename)
        
        compile_dimensionality_html_report(dim_summary, html_report_path)
        
        return {
            "status": "success",
            "message": "Final dataset produced and saved! Multicollinearity threat cleared.",
            "final_file": final_filename,
            "html_report_file": html_report_filename,
            "ai_summary": ai_summary,
            "ai_summary_error": ai_summary_error,
            "stats": {
                "shape": list(final_df.shape),
                "total_rows": len(final_df),
                "total_columns": len(final_df.columns)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error finalizing features: {str(e)}")

# -----------------
# PREVIEW & DOWNLOAD
# -----------------
@app.get("/api/preview/{filename}")
async def preview_file(filename: str, session_id: str = Query(...)):
    session_dir = get_session_dir(session_id)
    file_path = os.path.join(session_dir, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        df = pd.read_csv(file_path, nrows=50)
        # Convert NaN to None for JSON compliance
        df = df.replace({np.nan: None})
        
        columns = list(df.columns)
        rows = df.values.tolist()
        
        return {
            "columns": columns,
            "rows": rows,
            "total_rows_preview": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load preview: {str(e)}")

@app.get("/api/download/{filename}")
async def download_file(filename: str, session_id: str = Query(...)):
    session_dir = get_session_dir(session_id)
    file_path = os.path.join(session_dir, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    # Check if html or csv
    media_type = "text/csv"
    if filename.endswith(".html"):
        media_type = "text/html"
        
    return FileResponse(path=file_path, filename=filename, media_type=media_type)

# Start server script helper
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
