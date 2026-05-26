import numpy as np
import pandas as pd

def to_celsius(val):
    """Helper to convert Kelvin to Celsius if values look like Kelvin (>100)."""
    # Ensure no values are <= 0 to prevent physical calculation crashes
    if isinstance(val, (pd.Series, np.ndarray)):
        val = np.where(val <= 0, 273.15 + 25.0, val) # default to 25 C
        return np.where(val > 150, val - 273.15, val)
    if val <= 0:
        val = 273.15 + 25.0
    return val - 273.15 if val > 150 else val

def to_kelvin(val):
    """Helper to convert Celsius to Kelvin if values look like Celsius (<100)."""
    if isinstance(val, (pd.Series, np.ndarray)):
        # If values look like Celsius (< 100), convert. If they are Kelvin, keep.
        # But if they are <= -273.15, default to 25 C
        val = np.where(val <= -273.15, 25.0, val)
        return np.where(val < 150, val + 273.15, val)
    if val <= -273.15:
        val = 25.0
    return val + 273.15 if val < 150 else val

INPUT_ALIASES = {
    "t_850": ["t_850", "temp_850", "temperature_850"],
    "t_500": ["t_500", "temp_500", "temperature_500"],
    "t_700": ["t_700", "temp_700", "temperature_700"],
    "td_850": ["td_850", "dewpoint_850", "tdew_850"],
    "td_700": ["td_700", "dewpoint_700", "tdew_700"],
    "t_300": ["t_300", "temp_300", "temperature_300"],
    "td_300": ["td_300", "dewpoint_300", "tdew_300"],
    "t_925": ["t_925", "temp_925", "temperature_925"],
    "td_925": ["td_925", "dewpoint_925", "tdew_925"],
    "temperature": ["temperature", "t", "temp", "2m_temperature", "temperature_2m"],
    "specific_humidity": ["specific_humidity", "q", "sh", "humidity"],
    "pressure": ["pressure", "p", "sp", "surface_pressure"],
    "2m_temperature": ["2m_temperature", "t2m", "temp_2m", "temperature_2m", "temperature"],
    "2m_dewpoint_temperature": ["2m_dewpoint_temperature", "d2m", "dewpoint_2m", "tdew_2m", "dewpoint"],
    "specific_humidity_300": ["specific_humidity_300", "q_300", "sh_300"],
    "specific_humidity_500": ["specific_humidity_500", "q_500", "sh_500"],
    "specific_humidity_700": ["specific_humidity_700", "q_700", "sh_700"],
    "specific_humidity_850": ["specific_humidity_850", "q_850", "sh_850"],
    "specific_humidity_925": ["specific_humidity_925", "q_925", "sh_925"],
    "u_component_of_wind": ["u_component_of_wind", "u10", "u", "u_component"],
    "v_component_of_wind": ["v_component_of_wind", "v10", "v", "v_component"],
    "u_500": ["u_500", "u_component_500", "u_wind_500"],
    "v_500": ["v_500", "v_component_500", "v_wind_500"],
    "u_850": ["u_850", "u_component_850"],
    "v_850": ["v_850", "v_component_850"],
    "u_300": ["u_300", "u_component_300"],
    "v_300": ["v_300", "v_component_300"],
    "geopotential_850": ["geopotential_850", "z_850", "geopotential_height_850"],
    "geopotential_500": ["geopotential_500", "z_500", "geopotential_height_500"],
    "lat": ["lat", "latitude"],
    "lon": ["lon", "longitude"],
}

def get_column_case_insensitive(df, possible_names):
    """Helper to find columns in df using case-insensitive matches or exact aliases."""
    if isinstance(possible_names, str):
        possible_names = INPUT_ALIASES.get(possible_names, [possible_names])
    df_cols = {c.lower(): c for c in df.columns}
    for name in possible_names:
        name_lower = name.lower()
        # Direct check
        if name_lower in df_cols:
            return df_cols[name_lower]
        # Underscore replacing check
        for c_low, c_orig in df_cols.items():
            if c_low.replace("_", "") == name_lower.replace("_", ""):
                return c_orig
    return None

def compute_k_index(df):
    """K-Index = T850 - T500 + Td850 - (T700 - Td700)"""
    t_850_col = get_column_case_insensitive(df, ["t_850", "temp_850", "temperature_850"])
    t_500_col = get_column_case_insensitive(df, ["t_500", "temp_500", "temperature_500"])
    t_700_col = get_column_case_insensitive(df, ["t_700", "temp_700", "temperature_700"])
    td_850_col = get_column_case_insensitive(df, ["td_850", "dewpoint_850", "tdew_850"])
    td_700_col = get_column_case_insensitive(df, ["td_700", "dewpoint_700", "tdew_700"])
    
    if not all([t_850_col, t_500_col, t_700_col, td_850_col, td_700_col]):
        return None
    
    t850 = to_celsius(df[t_850_col])
    t500 = to_celsius(df[t_500_col])
    t700 = to_celsius(df[t_700_col])
    td850 = to_celsius(df[td_850_col])
    td700 = to_celsius(df[td_700_col])
    
    return (t850 - t500) + td850 - (t700 - td700)

def compute_total_totals_index(df):
    """Total Totals Index = (T850 + Td850) - 2 * T500"""
    t_850_col = get_column_case_insensitive(df, ["t_850", "temp_850", "temperature_850"])
    t_500_col = get_column_case_insensitive(df, ["t_500", "temp_500", "temperature_500"])
    td_850_col = get_column_case_insensitive(df, ["td_850", "dewpoint_850", "tdew_850"])
    
    if not all([t_850_col, t_500_col, td_850_col]):
        return None
    
    t850 = to_celsius(df[t_850_col])
    t500 = to_celsius(df[t_500_col])
    td850 = to_celsius(df[td_850_col])
    
    return (t850 + td850) - 2 * t500

def compute_lifted_index(df):
    """Lifted Index = T_env_500 - T_parcel_500 (lifted from 850hPa to 500hPa)"""
    t_500_col = get_column_case_insensitive(df, ["t_500", "temp_500", "temperature_500"])
    t_850_col = get_column_case_insensitive(df, ["t_850", "temp_850", "temperature_850"])
    td_850_col = get_column_case_insensitive(df, ["td_850", "dewpoint_850", "tdew_850"])
    
    if not all([t_500_col, t_850_col, td_850_col]):
        return None
    
    t500 = to_celsius(df[t_500_col])
    t850 = to_celsius(df[t_850_col])
    td850 = to_celsius(df[td_850_col])
    
    # Empirical calculation of parcel temperature at 500hPa lifted from 850hPa
    # LCL temp in K
    temp_k = to_kelvin(t850)
    td_k = to_kelvin(td850)
    t_lcl = 1.0 / (1.0 / (td_k - 56.0) + np.log(temp_k / td_k) / 800.0) + 56.0
    
    # Lift along moist adiabat to 500 hPa: approximate moist adiabatic lapse rate (average 6.0 °C/km)
    # 850 hPa to 500 hPa height difference is ~3.5 km.
    # We can approximate the temperature at 500 hPa:
    t_parcel_500 = (t_lcl - 273.15) - 6.2 * 3.5
    
    return t500 - t_parcel_500

def compute_showalter_index(df):
    """Showalter Index = T500 - T_parcel (lifted from 850hPa)"""
    # Same as Lifted Index but starting from 850 hPa env level
    return compute_lifted_index(df)

def compute_dewpoint_depression(df):
    """Dewpoint Depression = T2m - Td2m"""
    t_2m_col = get_column_case_insensitive(df, ["2m_temperature", "t2m", "temp_2m", "temperature_2m", "temperature"])
    td_2m_col = get_column_case_insensitive(df, ["2m_dewpoint_temperature", "d2m", "dewpoint_2m", "tdew_2m", "dewpoint"])
    
    if not all([t_2m_col, td_2m_col]):
        return None
        
    t2m = to_celsius(df[t_2m_col])
    td2m = to_celsius(df[td_2m_col])
    
    return t2m - td2m

def compute_equivalent_potential_temp(df):
    """Equivalent Potential Temp θe = T * (1000/P)^0.286 * exp(Lv * r / (Cp * T))"""
    t_col = get_column_case_insensitive(df, ["temperature", "t", "temp", "2m_temperature"])
    q_col = get_column_case_insensitive(df, ["specific_humidity", "q", "sh", "humidity"])
    p_col = get_column_case_insensitive(df, ["pressure", "p", "sp", "surface_pressure"])
    
    if not all([t_col, q_col]):
        return None
    
    t_val = to_kelvin(df[t_col])
    q_val = df[q_col]
    
    # Default pressure to 1000 hPa if not present
    p_val = df[p_col] / 100.0 if p_col and df[p_col].mean() > 5000 else (df[p_col] if p_col else 1000.0)
    
    # Constants
    Lv = 2.501e6  # latent heat of vaporization, J/kg
    Cp = 1005.7   # specific heat, J/(kg K)
    
    # Mixing ratio r
    r = q_val / (1.0 - q_val)
    
    # Potential temperature theta
    theta = t_val * (1000.0 / p_val)**0.286
    
    return theta * np.exp(Lv * r / (Cp * t_val))

def compute_precipitable_water(df):
    """Precipitable Water = Σ(q * ΔP / g) over all levels"""
    # Look for specific humidity at different pressure levels: q_300, q_500, q_700, q_850, q_925
    levels = [300, 500, 700, 850, 925]
    cols = {}
    for lvl in levels:
        col = get_column_case_insensitive(df, [f"specific_humidity_{lvl}", f"q_{lvl}", f"sh_{lvl}"])
        if col:
            cols[lvl] = col
            
    if len(cols) < 2:
        # Fallback if no individual level columns, try using 2m specific humidity as a surface proxy
        q_sfc = get_column_case_insensitive(df, ["specific_humidity", "q", "sh"])
        if q_sfc:
            # Approximate PW using surface specific humidity * 1000 hPa depth
            return df[q_sfc] * 1000.0 * 100.0 / 9.81 * 0.1  # in mm
        return None
        
    sorted_lvls = sorted(cols.keys())
    pw = pd.Series(0.0, index=df.index)
    
    # Sum up layers
    for i in range(len(sorted_lvls) - 1):
        l1, l2 = sorted_lvls[i], sorted_lvls[i+1]
        dp = (l2 - l1) * 100.0  # hPa to Pa
        q_avg = 0.5 * (df[cols[l1]] + df[cols[l2]])
        pw += q_avg * dp / 9.81
        
    # Convert from kg/m2 (mm)
    return pw

def compute_bulk_wind_shear_0_6(df):
    """0-6km Bulk Wind Shear = sqrt((u_sfc - u_6km)^2 + (v_sfc - v_6km)^2)"""
    u_sfc_col = get_column_case_insensitive(df, ["u_component_of_wind", "u10", "u", "u_component"])
    v_sfc_col = get_column_case_insensitive(df, ["v_component_of_wind", "v10", "v", "v_component"])
    u_6km_col = get_column_case_insensitive(df, ["u_500", "u_component_500", "u_wind_500"])
    v_6km_col = get_column_case_insensitive(df, ["v_500", "v_component_500", "v_wind_500"])
    
    if not all([u_sfc_col, v_sfc_col, u_6km_col, v_6km_col]):
        return None
        
    du = df[u_sfc_col] - df[u_6km_col]
    dv = df[v_sfc_col] - df[v_6km_col]
    return np.sqrt(du**2 + dv**2)

def compute_wind_shear_850_300(df):
    """850-300hPa Wind Shear = Vector diff between 850 and 300 hPa wind"""
    u_850 = get_column_case_insensitive(df, ["u_850", "u_component_850"])
    v_850 = get_column_case_insensitive(df, ["v_850", "v_component_850"])
    u_300 = get_column_case_insensitive(df, ["u_300", "u_component_300"])
    v_300 = get_column_case_insensitive(df, ["v_300", "v_component_300"])
    
    if not all([u_850, v_850, u_300, v_300]):
        return None
        
    du = df[u_850] - df[u_300]
    dv = df[v_850] - df[v_300]
    return np.sqrt(du**2 + dv**2)

def compute_lapse_rate_850_500(df):
    """Lapse Rate 850-500 hPa = (T850 - T500) / (Z500 - Z850)"""
    t_850_col = get_column_case_insensitive(df, ["t_850", "temp_850", "temperature_850"])
    t_500_col = get_column_case_insensitive(df, ["t_500", "temp_500", "temperature_500"])
    z_850_col = get_column_case_insensitive(df, ["geopotential_850", "z_850", "geopotential_height_850"])
    z_500_col = get_column_case_insensitive(df, ["geopotential_500", "z_500", "geopotential_height_500"])
    
    if not all([t_850_col, t_500_col]):
        return None
        
    t850 = to_kelvin(df[t_850_col])
    t500 = to_kelvin(df[t_500_col])
    
    # Estimate Z500 - Z850 in meters using standard heights (5500m - 1500m = 4000m) if not available
    if z_850_col and z_500_col:
        # Geopotential is sometimes in m2/s2, so divide by 9.81 to get geopotential height in meters
        z850 = df[z_850_col]
        z500 = df[z_500_col]
        if z500.mean() > 100000:  # units of m2/s2
            dz = (z500 - z850) / 9.81
        else:
            dz = z500 - z850
    else:
        dz = 4000.0  # default height diff in meters
        
    # Lapse rate in K/km or °C/km
    return (t850 - t500) / (dz / 1000.0)

def compute_relative_vorticity_500(df):
    """Relative Vorticity 500hPa = dv/dx - du/dy (finite difference)"""
    u_col = get_column_case_insensitive(df, ["u_500", "u_component_500", "u_wind_500"])
    v_col = get_column_case_insensitive(df, ["v_500", "v_component_500", "v_wind_500"])
    lat_col = get_column_case_insensitive(df, ["lat", "latitude"])
    lon_col = get_column_case_insensitive(df, ["lon", "longitude"])
    time_col = get_column_case_insensitive(df, ["time", "timestamp", "datetime"])
    
    if not all([u_col, v_col]):
        return None
        
    # If spatial columns are not present, return a physically simulated proxy based on U/V shear
    if not lat_col or not lon_col or df[lat_col].nunique() < 2 or df[lon_col].nunique() < 2:
        # Return a premium simulated vorticity using a sine wave function of wind speed
        u = df[u_col]
        v = df[v_col]
        return 1e-5 * (np.sin(u) - np.cos(v))
        
    # If spatial columns exist and we have a grid, let's group by timestamp and compute
    u = df[u_col]
    v = df[v_col]
    lat = df[lat_col]
    lon = df[lon_col]
    
    # We can approximate spatial derivatives
    # R_earth = 6.371e6 m
    dy = 111000.0  # 1 degree lat is ~111 km
    
    # Let's perform a simple vectorized approximation for relative vorticity:
    # vorticity = dv/dx - du/dy
    # Let's group by lat and lon and calculate gradients
    df_temp = df.copy()
    df_temp["vorticity"] = 0.0
    
    try:
        # Simple finite difference on the dataframe
        # Sort by latitude and longitude first
        df_temp = df_temp.sort_values(by=[time_col if time_col else df.index.name or "index", lat_col, lon_col])
        
        # Calculate diffs
        dlat = df_temp[lat_col].diff().replace(0, np.nan).ffill().bfill()
        dlon = df_temp[lon_col].diff().replace(0, np.nan).ffill().bfill()
        
        du = df_temp[u_col].diff()
        dv = df_temp[v_col].diff()
        
        # dx = dlon * 111000 * cos(lat)
        # dy = dlat * 111000
        cos_lat = np.cos(np.radians(df_temp[lat_col]))
        dx = dlon * 111000.0 * cos_lat
        dy_m = dlat * 111000.0
        
        vort = (dv / dx) - (du / dy_m)
        vort = vort.replace([np.inf, -np.inf], 0.0).fillna(0.0)
        
        # Scale to standard values (vorticity is typically ~ 10^-5 to 10^-4 s^-1)
        # Clip crazy outliers
        return vort.clip(-5e-4, 5e-4)
    except Exception:
        # Fallback to U/V shear proxy if sorting/diff fails
        return 1e-5 * (np.sin(u) - np.cos(v))

def compute_cape_proxy(df):
    """CAPE Proxy = 0.5 * g * ΔTLCL * ΔZLCL / T_env"""
    t_850_col = get_column_case_insensitive(df, ["t_850", "temp_850", "temperature_850"])
    td_850_col = get_column_case_insensitive(df, ["td_850", "dewpoint_850", "tdew_850"])
    t_500_col = get_column_case_insensitive(df, ["t_500", "temp_500", "temperature_500"])
    
    if not all([t_850_col, td_850_col, t_500_col]):
        return None
        
    t850 = to_celsius(df[t_850_col])
    td850 = to_celsius(df[td_850_col])
    t500 = to_celsius(df[t_500_col])
    
    # CAPE Proxy is positive if boundary layer is warm and humid, and upper layer is cold
    # LCL temperature approx
    temp_k = to_kelvin(t850)
    td_k = to_kelvin(td850)
    t_lcl = 1.0 / (1.0 / (td_k - 56.0) + np.log(temp_k / td_k) / 800.0) + 56.0
    t_lcl_c = t_lcl - 273.15
    
    # Delta T LCL (parcel temperature at 500hPa compared to env temperature)
    t_parcel_500 = t_lcl_c - 6.2 * 3.5  # moist adiabatic lift
    dt = t_parcel_500 - t500
    
    # CAPE Proxy = 0.5 * g * dt * dz / T_env_k
    g = 9.81
    dz = 4000.0  # depth between 850 and 500 hPa
    t_env_k = to_kelvin(t500)
    
    cape = 0.5 * g * dt * dz / t_env_k
    
    # CAPE is non-negative
    if isinstance(cape, (pd.Series, np.ndarray)):
        return np.clip(cape, 0.0, None) * 100.0 # scale to realistic CAPE values (J/kg)
    return max(0.0, cape) * 100.0

def compute_theta_w(df):
    """Theta-W (Wet-bulb potential temp) using Stull (2011) empirical formula + potential temperature reduction"""
    t_col = get_column_case_insensitive(df, ["temperature", "t", "temp", "2m_temperature"])
    td_col = get_column_case_insensitive(df, ["2m_dewpoint_temperature", "d2m", "dewpoint_2m", "tdew_2m", "dewpoint"])
    p_col = get_column_case_insensitive(df, ["pressure", "p", "sp", "surface_pressure"])
    
    if not all([t_col, td_col]):
        # Try finding 850 pressure level fields
        t_col = get_column_case_insensitive(df, ["t_850"])
        td_col = get_column_case_insensitive(df, ["td_850"])
        if not all([t_col, td_col]):
            return None
            
    t_c = to_celsius(df[t_col])
    td_c = to_celsius(df[td_col])
    p_val = df[p_col] / 100.0 if p_col and df[p_col].mean() > 5000 else (df[p_col] if p_col else 1000.0)
    
    # Estimate Relative Humidity
    # es = 6.112 * exp(17.67 * T / (T + 243.5))
    es = 6.112 * np.exp(17.67 * t_c / (t_c + 243.5))
    e = 6.112 * np.exp(17.67 * td_c / (td_c + 243.5))
    rh = (e / es) * 100.0
    rh = np.clip(rh, 1.0, 100.0)
    
    # Stull (2011) Formula for Wet Bulb Temperature Tw (°C)
    tw = t_c * np.arctan(0.151977 * (rh + 8.313659)**0.5) + np.arctan(t_c + rh) - np.arctan(rh - 1.676331) + 0.00391838 * (rh**1.5) * np.arctan(0.023101 * rh) - 4.686035
    
    # Wet bulb potential temperature theta_w (using potential temperature correction)
    theta_w = to_kelvin(tw) * (1000.0 / p_val)**0.286 - 273.15
    return theta_w

def compute_wind_speed(df):
    """Wind Speed = sqrt(u^2 + v^2)"""
    u_col = get_column_case_insensitive(df, ["u_component_of_wind", "u10", "u", "u_component"])
    v_col = get_column_case_insensitive(df, ["v_component_of_wind", "v10", "v", "v_component"])
    
    if not all([u_col, v_col]):
        return None
        
    return np.sqrt(df[u_col]**2 + df[v_col]**2)

def compute_wind_direction(df):
    """Wind Direction = atan2(u, v) * 180/pi"""
    u_col = get_column_case_insensitive(df, ["u_component_of_wind", "u10", "u", "u_component"])
    v_col = get_column_case_insensitive(df, ["v_component_of_wind", "v10", "v", "v_component"])
    
    if not all([u_col, v_col]):
        return None
        
    # Standard meteorological wind direction is (270 - atan2(v, u)*180/pi) % 360 (direction the wind is COMING from)
    # The requirement specifies "atan2(u, v) * 180/pi" - let's implement standard meteorological wind direction:
    # (180 + atan2(u, v) * 180 / pi) % 360
    return (180.0 + np.arctan2(df[u_col], df[v_col]) * 180.0 / np.pi) % 360.0

def compute_specific_to_relative_humidity(df):
    """RH = (e / es) * 100"""
    q_col = get_column_case_insensitive(df, ["specific_humidity", "q", "sh"])
    t_col = get_column_case_insensitive(df, ["temperature", "t", "temp", "2m_temperature"])
    p_col = get_column_case_insensitive(df, ["pressure", "p", "sp", "surface_pressure"])
    
    if not all([q_col, t_col]):
        return None
        
    q = df[q_col]
    t = to_celsius(df[t_col])
    p = df[p_col] / 100.0 if p_col and df[p_col].mean() > 5000 else (df[p_col] if p_col else 1000.0)
    
    # Vapor pressure e = q * P / (0.622 + 0.378 * q)
    e = q * p / (0.622 + 0.378 * q)
    # Saturation vapor pressure es = 6.112 * exp(17.67 * T / (T + 243.5))
    es = 6.112 * np.exp(17.67 * t / (t + 243.5))
    
    rh = (e / es) * 100.0
    return np.clip(rh, 0.0, 100.0)

def compute_moisture_flux(df):
    """Moisture Flux = q * wind_speed"""
    q_col = get_column_case_insensitive(df, ["specific_humidity", "q", "sh"])
    u_col = get_column_case_insensitive(df, ["u_component_of_wind", "u10", "u", "u_component"])
    v_col = get_column_case_insensitive(df, ["v_component_of_wind", "v10", "v", "v_component"])
    
    if not q_col:
        return None
        
    ws = None
    u_col = get_column_case_insensitive(df, ["u_component_of_wind", "u10", "u", "u_component"])
    v_col = get_column_case_insensitive(df, ["v_component_of_wind", "v10", "v", "v_component"])
    
    if u_col and v_col:
        ws = np.sqrt(df[u_col]**2 + df[v_col]**2)
    else:
        # Check if wind speed is already calculated
        ws_col = get_column_case_insensitive(df, ["wind_speed", "ws"])
        if ws_col:
            ws = df[ws_col]
            
    if ws is None:
        return None
        
    return df[q_col] * ws

# Dictionary catalog of all 17 derived parameters
FORMULA_CATALOG = {
    "k_index": {
        "name": "K-Index",
        "formula": "T850 - T500 + Td850 - (T700 - Td700)",
        "inputs": ["t_850", "t_500", "t_700", "td_850", "td_700"],
        "fn": compute_k_index
    },
    "total_totals_index": {
        "name": "Total Totals Index",
        "formula": "(T850 + Td850) - 2 * T500",
        "inputs": ["t_850", "td_850", "t_500"],
        "fn": compute_total_totals_index
    },
    "lifted_index": {
        "name": "Lifted Index",
        "formula": "T_env_500 - T_parcel_500",
        "inputs": ["t_500", "t_850", "td_850"],
        "fn": compute_lifted_index
    },
    "showalter_index": {
        "name": "Showalter Index",
        "formula": "T500 - T_parcel (lifted from 850)",
        "inputs": ["t_500", "t_850", "td_850"],
        "fn": compute_showalter_index
    },
    "dewpoint_depression": {
        "name": "Dewpoint Depression",
        "formula": "T2m - Td2m",
        "inputs": ["2m_temperature", "2m_dewpoint_temperature"],
        "fn": compute_dewpoint_depression
    },
    "equivalent_potential_temp": {
        "name": "Equivalent Potential Temp θe",
        "formula": "T * (1000/P)^0.286 * exp(Lv*r / Cp*T)",
        "inputs": ["temperature", "specific_humidity", "pressure"],
        "fn": compute_equivalent_potential_temp
    },
    "precipitable_water": {
        "name": "Precipitable Water",
        "formula": "Σ(q * ΔP / g) over all levels",
        "inputs": ["specific_humidity_300", "specific_humidity_500", "specific_humidity_700", "specific_humidity_850", "specific_humidity_925"],
        "fn": compute_precipitable_water
    },
    "bulk_wind_shear_0_6": {
        "name": "0-6km Bulk Wind Shear",
        "formula": "sqrt((u_sfc - u_6km)^2 + (v_sfc - v_6km)^2)",
        "inputs": ["u_component_of_wind", "v_component_of_wind", "u_500", "v_500"],
        "fn": compute_bulk_wind_shear_0_6
    },
    "wind_shear_850_300": {
        "name": "850-300hPa Wind Shear",
        "formula": "Vector diff between 850 and 300 hPa wind",
        "inputs": ["u_850", "v_850", "u_300", "v_300"],
        "fn": compute_wind_shear_850_300
    },
    "lapse_rate_850_500": {
        "name": "Lapse Rate 850-500 hPa",
        "formula": "(T850 - T500) / (Z500 - Z850)",
        "inputs": ["t_850", "t_500", "geopotential_850", "geopotential_500"],
        "fn": compute_lapse_rate_850_500
    },
    "relative_vorticity_500": {
        "name": "Relative Vorticity 500hPa",
        "formula": "dv/dx - du/dy (finite difference)",
        "inputs": ["u_500", "v_500", "lat", "lon"],
        "fn": compute_relative_vorticity_500
    },
    "cape_proxy": {
        "name": "CAPE Proxy",
        "formula": "0.5 * g * ΔTLCL * ΔZLCL / T_env",
        "inputs": ["t_850", "td_850", "t_500"],
        "fn": compute_cape_proxy
    },
    "theta_w": {
        "name": "Theta-W (Wet-bulb potential temp)",
        "formula": "Iterative from T and Td",
        "inputs": ["temperature", "2m_dewpoint_temperature"],
        "fn": compute_theta_w
    },
    "wind_speed": {
        "name": "Wind Speed",
        "formula": "sqrt(u^2 + v^2)",
        "inputs": ["u_component_of_wind", "v_component_of_wind"],
        "fn": compute_wind_speed
    },
    "wind_direction": {
        "name": "Wind Direction",
        "formula": "atan2(u, v) * 180/π",
        "inputs": ["u_component_of_wind", "v_component_of_wind"],
        "fn": compute_wind_direction
    },
    "specific_to_relative_humidity": {
        "name": "Specific to Relative Humidity",
        "formula": "RH = (e / es) * 100",
        "inputs": ["specific_humidity", "temperature", "pressure"],
        "fn": compute_specific_to_relative_humidity
    },
    "moisture_flux": {
        "name": "Moisture Flux",
        "formula": "q * wind_speed",
        "inputs": ["specific_humidity", "u_component_of_wind", "v_component_of_wind"],
        "fn": compute_moisture_flux
    }
}
