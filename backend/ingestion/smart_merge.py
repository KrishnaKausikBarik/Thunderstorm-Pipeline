import os
import json
import pandas as pd
import numpy as np
from typing import Dict, Any, List

def smart_merge_dataframes(
    dataframes: Dict[str, pd.DataFrame],
    target_interval: str,
    agg_rules: Dict[str, str],
    output_path: str
) -> Dict[str, Any]:
    """
    1. Resamples each source dataframe to target_interval grouping by spatial coordinates.
    2. Applies per-variable custom aggregation rules.
    3. Spatial-temporally outer-joins resampled sources.
    4. Computes post-merge stats and saves the result to output_path.
    """
    # Map friendly interval names to pandas offset aliases
    interval_map = {
        "1-hourly": "1h",
        "3-hourly": "3h",
        "6-hourly": "6h",
        "12-hourly": "12h",
        "daily": "1D",
        "weekly": "7D"
    }
    offset_alias = interval_map.get(target_interval.lower(), "6h")

    resampled_dfs = []
    source_columns_map = {}

    for src_name, df in dataframes.items():
        if df.empty:
            continue
            
        src_upper = src_name.upper()
        
        # Parse timestamp column
        t_col = next((c for c in df.columns if c.lower() in ["timestamp", "time"]), None)
        if not t_col:
            continue
            
        df_work = df.copy()
        df_work[t_col] = pd.to_datetime(df_work[t_col])
        
        # Coordinates
        lat_col = next((c for c in df_work.columns if c.lower() in ["latitude", "lat"]), None)
        lon_col = next((c for c in df_work.columns if c.lower() in ["longitude", "lon"]), None)
        
        # Variables to aggregate (exclude coordinate and time columns)
        exclude = ["timestamp", "time", "latitude", "longitude", "lat", "lon", "solar_constant_offset"]
        vars_to_agg = [c for c in df_work.columns if c not in exclude]
        
        # Track which columns are contributed by this source
        for col in vars_to_agg:
            source_columns_map[col] = src_upper
            
        # Build aggregation dictionary for pandas resample
        # Default is mean, unless overridden in agg_rules
        agg_dict = {}
        for var in vars_to_agg:
            rule = agg_rules.get(var, "mean").lower()
            if rule == "first":
                agg_dict[var] = "first"
            elif rule in ["mean", "max", "min", "sum"]:
                agg_dict[var] = rule
            else:
                agg_dict[var] = "mean"

        # Check if we should resample by spatial coordinate groups
        if lat_col and lon_col:
            grouped_resampled = []
            
            # Group by spatial coords to avoid collapsing the spatial grid into a single time series
            for (lat, lon), group in df_work.groupby([lat_col, lon_col]):
                group_clean = group.set_index(t_col).sort_index()
                
                # Apply resampling and aggregation
                res = group_clean[vars_to_agg].resample(offset_alias).agg(agg_dict)
                res = res.reset_index()
                
                # Restore coordinate columns
                res["latitude"] = lat
                res["longitude"] = lon
                
                # Handle near-constant columns like solar_constant_offset if they exist in source
                if "solar_constant_offset" in group.columns:
                    res["solar_constant_offset"] = group["solar_constant_offset"].iloc[0]
                    
                grouped_resampled.append(res)
                
            resampled_source = pd.concat(grouped_resampled, ignore_index=True)
        else:
            # Simple temporal resampling
            df_clean = df_work.set_index(t_col).sort_index()
            resampled_source = df_clean[vars_to_agg].resample(offset_alias).agg(agg_dict)
            resampled_source = resampled_source.reset_index()
            
        resampled_dfs.append(resampled_source)

    # 2. Perform Outer Joins on Spatial-Temporal Keys
    merged_df = None
    for rdf in resampled_dfs:
        # standard join keys
        join_keys = ["timestamp"]
        if "latitude" in rdf.columns and "longitude" in rdf.columns:
            join_keys.extend(["latitude", "longitude"])
            
        if merged_df is None:
            merged_df = rdf
        else:
            merged_df = pd.merge(merged_df, rdf, on=join_keys, how="outer")

    if merged_df is None or merged_df.empty:
        raise ValueError("Smart Merge produced an empty or invalid dataset.")

    # Sort merged results by keys
    sort_keys = ["timestamp"]
    if "latitude" in merged_df.columns and "longitude" in merged_df.columns:
        sort_keys.extend(["latitude", "longitude"])
    merged_df = merged_df.sort_values(by=sort_keys).reset_index(drop=True)

    # 3. Structural Analysis and Stats Calculations
    total_rows = len(merged_df)
    total_cols = len(merged_df.columns)
    
    # Calculate % cells missing
    total_cells = merged_df.shape[0] * merged_df.shape[1]
    missing_cells = merged_df.isnull().sum().sum()
    missing_pct = float((missing_cells / total_cells) * 100) if total_cells > 0 else 0.0

    # Map column source metadata
    column_sources = {}
    for col in merged_df.columns:
        if col in ["timestamp", "latitude", "longitude", "solar_constant_offset"]:
            column_sources[col] = "METADATA"
        else:
            column_sources[col] = source_columns_map.get(col, "UNKNOWN")

    # Save finalized merged CSV
    merged_df.to_csv(output_path, index=False)

    stats = {
        "total_rows": total_rows,
        "total_columns": total_cols,
        "missing_cells_pct": missing_pct,
        "column_sources": column_sources,
        "target_interval": target_interval,
        "agg_rules": agg_rules
    }

    return stats
