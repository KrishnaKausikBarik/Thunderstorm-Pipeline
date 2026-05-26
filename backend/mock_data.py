import numpy as np
import pandas as pd
import datetime
from datetime import timedelta

def generate_mock_weather_data(config):
    """
    Generates highly realistic meteorological datasets with diurnal,
    seasonal, and spatial patterns, as well as pressure-level configurations.
    """
    # Extract bounding box
    north = float(config.get("north", 23.00))
    south = float(config.get("south", 17.00))
    west = float(config.get("west", 81.00))
    east = float(config.get("east", 88.00))
    
    # Extract time parameters
    years = config.get("years", [2024])
    months = config.get("months", [5, 6, 7])  # May, June, July (Thunderstorm/Monsoon seasons)
    days_range = config.get("daysRange", [1, 15])
    interval = config.get("interval", "6-hourly")
    
    sources = config.get("sources", {})
    era5_config = sources.get("era5", {})
    imd_config = sources.get("imd", {})
    nasa_config = sources.get("nasa", {})
    
    # Resolve step hours
    step_hours = 6
    if "1-hourly" in interval:
        step_hours = 1
    elif "3-hourly" in interval:
        step_hours = 3
    elif "6-hourly" in interval:
        step_hours = 6
    elif "12-hourly" in interval:
        step_hours = 12
    elif "Daily" in interval:
        step_hours = 24
        
    # Generate timestamp series
    timestamps = []
    for yr in years:
        for m in months:
            # simple day bounds
            start_day = max(1, int(days_range[0]))
            end_day = min(31, int(days_range[1]))
            # Handle month-end differences
            try:
                dt_test = datetime.date(yr, m, end_day)
            except ValueError:
                try:
                    dt_test = datetime.date(yr, m, 28)
                    end_day = 28
                except ValueError:
                    continue
                    
            for d in range(start_day, end_day + 1):
                h = 0
                while h < 24:
                    timestamps.append(datetime.datetime(yr, m, d, h, 0, 0))
                    h += step_hours
                    
    # Generate spatial grid points
    # Limit coordinates count to avoid memory explosion. We will generate 2x2 grid points.
    lat_points = np.linspace(south, north, 2)
    lon_points = np.linspace(west, east, 2)
    
    # Create master combination list
    rows = []
    for ts in timestamps:
        for lat in lat_points:
            for lon in lon_points:
                rows.append({
                    "timestamp": ts,
                    "latitude": lat,
                    "longitude": lon
                })
                
    # If the list is empty, put a default series
    if not rows:
        base_dt = datetime.datetime(2024, 6, 1, 0, 0)
        for hour in range(0, 120, 6):
            rows.append({
                "timestamp": base_dt + timedelta(hours=hour),
                "latitude": 20.0,
                "longitude": 84.0
            })
            
    df = pd.DataFrame(rows)
    
    # Capping length at 2000 rows for high responsiveness
    if len(df) > 2000:
        df = df.sample(2000, random_state=42).sort_values(by=["timestamp", "latitude", "longitude"]).reset_index(drop=True)
        
    # Standard surface temperature and dewpoint temperature baselines
    # Diurnal cycle: peaks at 14:00 (14 hr), coolest at 05:00
    # Seasonal: peak in summer (May = 5), cooling in monsoon (July = 7)
    hours = df["timestamp"].dt.hour
    months_series = df["timestamp"].dt.month
    
    diurnal_T = 6.0 * np.sin((hours - 8) / 24.0 * 2.0 * np.pi)
    seasonal_T = 32.0 - 4.0 * np.abs(months_series - 5)  # May (5) has peak temp 32C
    
    # 2m Temp in Celsius (base + seasonal + diurnal + random)
    base_t2m = seasonal_T + diurnal_T + np.random.normal(0, 1.5, size=len(df))
    # Keep some values realistic
    df["2m_temperature"] = base_t2m + 273.15  # store in Kelvin as is standard for ERA5
    
    # Dewpoint (must be lower or equal to temperature)
    # Monsoon has higher humidity/dewpoint (~24C), winter has drier air (~15C)
    base_td2m = (20.0 + 3.0 * np.sin((months_series - 5) / 12 * 2 * np.pi) 
                 + 1.5 * np.sin((hours - 10) / 24 * 2 * np.pi)
                 + np.random.normal(0, 1.0, size=len(df)))
    # Dewpoint depression cannot be negative
    base_td2m = np.minimum(base_t2m - 0.5, base_td2m)
    df["2m_dewpoint_temperature"] = base_td2m + 273.15  # store in Kelvin
    
    # Surface pressure ~ 1008 hPa (in Pa)
    df["pressure"] = (1008.0 - 5.0 * np.sin((months_series - 7) / 12 * 2 * np.pi) 
                      + np.random.normal(0, 2.0, size=len(df))) * 100.0
    
    # Wind components
    df["u_component_of_wind"] = 4.0 * np.sin((months_series - 6) / 12 * 2 * np.pi) + np.random.normal(0, 3.0, size=len(df))
    df["v_component_of_wind"] = 2.0 * np.sin((months_series - 5) / 12 * 2 * np.pi) + np.random.normal(0, 3.0, size=len(df))
    
    # Specific humidity (approximate from dewpoint and pressure)
    # e = 6.112 * exp(17.67 * Td_c / (Td_c + 243.5))
    e_val = 6.112 * np.exp(17.67 * base_td2m / (base_td2m + 243.5))
    p_hpa = df["pressure"] / 100.0
    df["specific_humidity"] = 0.622 * e_val / (p_hpa - 0.378 * e_val)
    
    # Add pressure-level parameters if selected
    # Pressure Levels: 300, 500, 700, 850, 925
    levels = [300, 500, 700, 850, 925]
    for lvl in levels:
        # Standard lapse rate T decrease with height
        # Heights are roughly: 925hPa (~750m), 850hPa (~1500m), 700hPa (~3000m), 500hPa (~5500m), 300hPa (~9000m)
        heights = {925: 750, 850: 1500, 700: 3000, 500: 5500, 300: 9000}
        h = heights[lvl]
        
        # Temp decreases by 6.5C per km
        temp_lvl = base_t2m - 6.5 * (h / 1000.0) + np.random.normal(0, 1.0, size=len(df))
        df[f"t_{lvl}"] = temp_lvl + 273.15  # store in Kelvin
        
        # Dewpoint decreases with height
        td_lvl = base_td2m - 8.0 * (h / 1000.0) + np.random.normal(0, 1.5, size=len(df))
        df[f"td_{lvl}"] = np.minimum(temp_lvl - 1.0, td_lvl) + 273.15
        
        # Specific humidity decreases exponentially with height
        df[f"specific_humidity_{lvl}"] = df["specific_humidity"] * np.exp(-h / 3000.0)
        df[f"q_{lvl}"] = df[f"specific_humidity_{lvl}"]  # alias
        
        # Geopotential (Z = z * g, roughly)
        df[f"geopotential_{lvl}"] = h * 9.81 + np.random.normal(0, 50.0, size=len(df))
        
        # Winds change with upper-level shear (jet stream at 300 hPa)
        shear_factor = (h / 9000.0) * 15.0
        df[f"u_{lvl}"] = df["u_component_of_wind"] + shear_factor + np.random.normal(0, 4.0, size=len(df))
        df[f"v_{lvl}"] = df["v_component_of_wind"] + (shear_factor / 2.0) + np.random.normal(0, 4.0, size=len(df))
        
    # CAPE and CIN (convective indices)
    # Peak CAPE in afternoon and monsoon months
    afternoon_idx = (hours >= 11) & (hours <= 17)
    monsoon_idx = (months_series >= 6) & (months_series <= 9)
    
    cape = np.zeros(len(df))
    cape[monsoon_idx] = 1200.0 + np.random.uniform(0, 1500, size=np.sum(monsoon_idx))
    cape[afternoon_idx & monsoon_idx] += 800.0
    cape[~monsoon_idx] = np.random.uniform(0, 300, size=np.sum(~monsoon_idx))
    df["convective_available_potential_energy"] = cape.clip(0, 4000)
    
    cin = np.zeros(len(df))
    cin[afternoon_idx] = np.random.uniform(5, 40, size=np.sum(afternoon_idx))
    cin[~afternoon_idx] = np.random.uniform(50, 350, size=np.sum(~afternoon_idx))
    df["convective_inhibition"] = cin.clip(0, 500)
    
    # Total precipitation (rain peaks during monsoon afternoons)
    precip = np.zeros(len(df))
    rainy_events = (np.random.uniform(0, 1, size=len(df)) > 0.7) & monsoon_idx
    precip[rainy_events] = np.random.uniform(0.5, 25.0, size=np.sum(rainy_events))
    df["total_precipitation"] = precip
    
    # Column water vapour
    df["total_column_water_vapour"] = 15.0 + 35.0 * (months_series >= 6).astype(float) + np.random.normal(0, 5.0, size=len(df))
    df["total_column_water_vapour"] = df["total_column_water_vapour"].clip(5, 75)

    # Add source-specific prefixes if requested
    # Let's see: IMD variables
    if imd_config.get("enabled", False):
        df["rainfall"] = df["total_precipitation"] * np.random.uniform(0.9, 1.1, len(df))
        df["max_temp"] = df["2m_temperature"] - 273.15 + np.random.uniform(2.0, 4.0, len(df))
        df["min_temp"] = df["2m_temperature"] - 273.15 - np.random.uniform(2.0, 4.0, len(df))
        
    # NASA variables
    if nasa_config.get("enabled", False):
        df["trmm_precipitation"] = df["total_precipitation"] * np.random.uniform(0.85, 1.15, len(df))
        df["gpm_precipitation"] = df["total_precipitation"] * np.random.uniform(0.9, 1.1, len(df))
        df["lightning_flash_density"] = (df["convective_available_potential_energy"] / 1000.0) * np.random.uniform(0.0, 5.0, len(df))
        
    # Inject Artificial Missing values (NaN) to let the preprocessing UI shine!
    # Let's say:
    # 2m_temperature: 3% missing (linear interpolation target)
    # convective_available_potential_energy: 15% missing (KNN imputation target)
    # total_precipitation: 8% missing (KNN imputation target)
    # total_column_water_vapour: 35% missing (high missing column target, triggers ask-user UI!)
    
    nan_mask_low = np.random.rand(len(df)) < 0.03
    df.loc[nan_mask_low, "2m_temperature"] = np.nan
    
    nan_mask_med1 = np.random.rand(len(df)) < 0.12
    df.loc[nan_mask_med1, "convective_available_potential_energy"] = np.nan
    
    nan_mask_med2 = np.random.rand(len(df)) < 0.08
    df.loc[nan_mask_med2, "total_precipitation"] = np.nan
    
    nan_mask_high = np.random.rand(len(df)) < 0.35
    df.loc[nan_mask_high, "total_column_water_vapour"] = np.nan

    # Inject some constant/near-constant columns to trigger Step 2 near-constant warning
    df["solar_constant_offset"] = 1361.0 + np.random.normal(0, 0.0001, len(df))
    
    # Inject some duplicate rows to test duplication removal
    if len(df) > 100:
        dupes = df.iloc[:5].copy()
        df = pd.concat([df, dupes], ignore_index=True)
        
    return df
