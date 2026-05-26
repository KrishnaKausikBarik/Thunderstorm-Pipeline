import pandas as pd
import numpy as np
from dataclasses import dataclass, asdict
from typing import Dict, Any, List

@dataclass
class SourceSamplingStats:
    source_name: str
    variables: List[str]
    detected_interval: str
    median_interval_seconds: float
    min_interval_seconds: float
    max_interval_seconds: float
    irregular_gaps_pct: float
    missing_timestamps_count: int
    missing_timestamps_pct: float
    duplicate_timestamps_count: int

@dataclass
class SamplingReport:
    sources: Dict[str, SourceSamplingStats]
    recommended_common_interval: str

def classify_interval(median_secs: float) -> str:
    """Classifies temporal sampling interval with a small tolerance."""
    if median_secs <= 0:
        return "irregular"
    
    # Tolerances in seconds
    if median_secs < 3000:  # less than ~50 minutes
        return "sub-hourly"
    elif abs(median_secs - 3600) <= 600:  # 1 hour +- 10m
        return "1-hourly"
    elif abs(median_secs - 10800) <= 1200:  # 3 hours +- 20m
        return "3-hourly"
    elif abs(median_secs - 21600) <= 2400:  # 6 hours +- 40m
        return "6-hourly"
    elif abs(median_secs - 43200) <= 3600:  # 12 hours +- 1h
        return "12-hourly"
    elif abs(median_secs - 86400) <= 7200:  # 24 hours +- 2h
        return "daily"
    elif abs(median_secs - 604800) <= 86400:  # 7 days +- 1 day
        return "weekly"
    else:
        return "irregular"

def get_interval_rank(interval_name: str) -> int:
    """Ranks intervals from finest to coarsest to find the recommended coarsest common interval."""
    ranks = {
        "sub-hourly": 1,
        "1-hourly": 2,
        "3-hourly": 3,
        "6-hourly": 4,
        "12-hourly": 5,
        "daily": 6,
        "weekly": 7,
        "irregular": 8
    }
    return ranks.get(interval_name.lower(), 9)

def analyze_sampling_rates(dataframes: Dict[str, pd.DataFrame]) -> SamplingReport:
    """
    For each source dataframe in dataframes:
    - Sorts unique timestamps
    - Computes time deltas and audits statistical dispersion
    - Detects spatial-temporal duplicates
    - Determines recommended coarsest common interval
    """
    source_stats = {}
    
    for src_name, df in dataframes.items():
        if df.empty:
            continue
            
        # Parse timestamp column
        t_col = next((c for c in df.columns if c.lower() in ["timestamp", "time"]), None)
        if not t_col:
            continue
            
        df_sorted = df.copy()
        df_sorted[t_col] = pd.to_datetime(df_sorted[t_col])
        
        # Sort and get unique timestamps to evaluate clean temporal sequence
        unique_ts = pd.Series(df_sorted[t_col].unique()).sort_values().reset_index(drop=True)
        
        # Default stats if too few rows
        median_secs = 0.0
        min_secs = 0.0
        max_secs = 0.0
        irregular_pct = 0.0
        missing_count = 0
        missing_pct = 0.0
        detected_interval = "irregular"
        
        if len(unique_ts) > 1:
            # Time deltas in seconds
            deltas = unique_ts.diff().dropna().dt.total_seconds().tolist()
            
            median_secs = float(np.median(deltas))
            min_secs = float(np.min(deltas))
            max_secs = float(np.max(deltas))
            
            # Gaps deviating > 20% from median
            irregular_count = sum(1 for d in deltas if abs(d - median_secs) > 0.20 * median_secs)
            irregular_pct = float((irregular_count / len(deltas)) * 100)
            
            # Expected timestamps count
            min_t, max_t = unique_ts.min(), unique_ts.max()
            total_duration_secs = (max_t - min_t).total_seconds()
            
            if median_secs > 0:
                expected_count = int(round(total_duration_secs / median_secs)) + 1
                missing_count = max(0, expected_count - len(unique_ts))
                missing_pct = float((missing_count / expected_count) * 100)
            else:
                missing_count = 0
                missing_pct = 0.0
                
            detected_interval = classify_interval(median_secs)
        elif len(unique_ts) == 1:
            detected_interval = "irregular"
            
        # Detect duplicate spatial-temporal coordinate keys
        keys = ["timestamp", "latitude", "longitude"]
        present_keys = [c for c in df_sorted.columns if c.lower() in keys]
        duplicate_count = int(df_sorted.duplicated(subset=present_keys).sum())
        
        # Get variable columns (exclude keys and other coordinates)
        exclude = ["timestamp", "time", "latitude", "longitude", "lat", "lon", "solar_constant_offset"]
        variables = [c for c in df.columns if c.lower() not in exclude]
        
        source_stats[src_name.upper()] = SourceSamplingStats(
            source_name=src_name.upper(),
            variables=variables,
            detected_interval=detected_interval,
            median_interval_seconds=median_secs,
            min_interval_seconds=min_secs,
            max_interval_seconds=max_secs,
            irregular_gaps_pct=irregular_pct,
            missing_timestamps_count=missing_count,
            missing_timestamps_pct=missing_pct,
            duplicate_timestamps_count=duplicate_count
        )

    # Calculate recommended common interval (coarsest among all sources)
    # Filter out irregular or empty sources if possible
    recommended = "1-hourly" # fallback default
    if source_stats:
        active_intervals = [s.detected_interval for s in source_stats.values()]
        # Sort by interval rank (finest to coarsest)
        sorted_intervals = sorted(active_intervals, key=get_interval_rank)
        # The coarsest is the one with the highest rank
        # We filter out "irregular" unless all are irregular
        valid_intervals = [i for i in sorted_intervals if i != "irregular"]
        if valid_intervals:
            recommended = valid_intervals[-1]
        elif sorted_intervals:
            recommended = sorted_intervals[-1]

    # Map internal interval class back to user friendly names
    user_friendly_map = {
        "sub-hourly": "Sub-hourly",
        "1-hourly": "1-hourly",
        "3-hourly": "3-hourly",
        "6-hourly": "6-hourly",
        "12-hourly": "12-hourly",
        "daily": "Daily",
        "weekly": "Weekly",
        "irregular": "Irregular"
    }
    
    recommended_friendly = user_friendly_map.get(recommended.lower(), recommended)
    
    # Return Report
    return SamplingReport(
        sources=source_stats,
        recommended_common_interval=recommended_friendly
    )
