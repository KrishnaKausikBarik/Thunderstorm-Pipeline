# Meteorological Ingestion, Preprocessing, & Parameter Synthesis Pipeline (V1.0)

A premium, end-to-end meteorological data engineering and feature synthesis suite designed to co-register heterogeneous weather databases (ERA5, IMD, Custom websites), extract temporal profiles, compute derived physical thermodynamic/kinematic variables, and optimize feature space dimensionality via multicollinearity diagnostics (VIF + Spearman correlation) for severe weather and thunderstorm forecasting models.

---

## 🚀 Key Features

*   **Step 1: Autonomous Ingestion & Co-Registration**
    *   **Autonomous AI Agent Layer**: Uses Anthropic Claude 3.5 Sonnet to scrape custom atmospheric databases, parsing layout HTML structure to devise dynamic fetch scripts, with built-in self-healing on failure.
    *   **Sampling Rate Auditing**: Detects statistical gap frequencies, quantifies expected vs. actual observations, and locates spatial-temporal duplicate keys.
    *   **Spatial-Temporal Smart Merge**: Groups inputs by localized coordinates (`latitude`, `longitude`) and resamples to target intervals (`1-hourly`, `3-hourly`, `6-hourly`, etc.) using customizable mathematical aggregation rules (`mean`, `max`, `min`, `sum`, `first`). Merges aligned sources via spatial-temporal outer-joins.

*   **Step 2: Automated EDA & Preprocessing Wizard**
    *   **Seasonal & Diurnal Feature Expansion**: Extracts `year`, `month`, `day`, `hour`, `day_of_year`, and `season` indices automatically from timestamps.
    *   **Quality Filtering & Outlier Diagnostics**: Caps or removes outliers using the Interquartile Range (IQR) method and drops near-constant features (variance < 0.001).
    *   **Multi-Tier Imputation Strategy**: Uses linear interpolation for short gaps (<5% missing), K-Nearest Neighbors (KNN Imputation, K=5) for intermediate gaps (5-30% missing), and customizable user directives (drop, median, keep) for major gaps (>30%).
    *   **Premium Interactive HTML Report**: Compiles preprocessed metrics, correlation heatmaps, and sampling delta distributions into a fully offline-ready interactive report powered by Plotly.js.

*   **Step 3: Advanced Thermodynamic & Kinematic Parameter Synthesis**
    *   Calculates **17 physical atmospheric formulas** on the fly to generate robust forecasting predictors:
        *   *Instability Indices*: K-Index, Total Totals Index, Lifted Index, Showalter Index, CAPE Proxy.
        *   *Thermodynamic & Moisture*: Dewpoint Depression, Equivalent Potential Temperature ($\theta_e$), Precipitable Water (vertical integral of specific humidity over pressure levels), Wet-bulb potential temperature ($\theta_w$ via Stull's empirical formula), Specific to Relative Humidity, Moisture Flux.
        *   *Kinematic & Shear*: 0-6km Bulk Wind Shear, 850-300hPa Wind Shear, Relative Vorticity 500hPa (vector finite-difference calculations over grid fields), Wind Speed, Wind Direction.

*   **Step 4: Dimensionality Optimization & VIF Auditing**
    *   **Spearman Rank Correlation**: Computes non-linear monotonic inter-feature correlations, flagging highly redundant pairs ($|r| > 0.85$).
    *   **Variance Inflation Factor (VIF)**: Calculates regression-based collinearity coefficients to isolate severe multicollinearity threats ($\text{VIF} > 10$) that destabilize model training.
    *   **Iterative Reduction & ML Export**: Integrates an interactive interface to systematically drop collinear parameters and export the optimized training-ready dataset.

---

## 📁 Repository Layout

```
Thunderstorm_pipeline_v1/
├── docker-compose.yml              # Multi-container orchestration (Backend: 8000, Frontend: 3000)
├── vercel.json                     # Serverless deployment configurations
├── .env.example                    # Template for environment variables (e.g. Anthropic API Keys)
├── backend/                        # FastAPI application core
│   ├── main.py                     # API router, SSE logs, and pipeline steps coordination
│   ├── formulas.py                 # Pure NumPy/Pandas math engine resolving 17 physical atmospheric formulas
│   ├── mock_data.py                # Synthesized gridded weather data engine with physical seasonal/diurnal models
│   ├── utils.py                    # Session directory structures and HTML report compilers
│   ├── requirements.txt            # Python dependencies (fastapi, uvicorn, pandas, numpy, scikit-learn, statsmodels)
│   └── ingestion/                  # Data Ingestion Layer
│       ├── llm_agent.py            # AI Agent scraping engine using Anthropic Claude 3.5 Sonnet
│       ├── sampling_analyzer.py    # Audits temporal delta statistics, missing rates, and coordinates duplicates
│       └── smart_merge.py          # Performs group-by spatial co-registration & resamples to target intervals
└── frontend/                       # Interactive React client
    ├── package.json                # Frontend packages (vite, react, lucide-react, tailwindcss)
    └── src/
        ├── App.tsx                 # Core pipeline coordinator, stepper state, and session settings
        ├── types.ts                # Strict TypeScript interfaces mirroring backend configurations
        └── components/             # Reusable UI steps and terminal logs
            ├── Stepper.tsx         # Responsive progress indicator representing steps 1-4
            ├── IngestionStep.tsx   # Configures sources, streams SSE logs, triggers smart merges, and displays audits
            ├── EDAStep.tsx         # Initiates quality scans, controls preprocessing configurations, and displays HTML summaries
            ├── DerivedStep.tsx     # Calculates derived parameters and displays thermodynamic availability checks
            ├── DimReductionStep.tsx# Runs VIF / Spearman correlation diagnostics and executes feature retention lists
            ├── PreviewTable.tsx    # Scrollable preview pane displaying synthesized CSV contents on the fly
            └── TerminalLog.tsx     # Emulated command terminal displaying active ingestion log feeds in real-time
```

---

## 🛠️ Installation & Execution Guide

### Option A: Rapid Launch via Docker Compose (Recommended)

1.  **Enter Directory**:
    ```bash
    cd Thunderstorm_pipeline_v1
    ```
2.  **Configure Environment Variables**:
    Create a `.env` file in the root:
    ```env
    # Required for autonomous AI Agent portal scraping:
    ANTHROPIC_API_KEY=your_anthropic_api_key_here
    ```
3.  **Spin Up Services**:
    ```bash
    docker-compose up --build
    ```
4.  **Access Services**:
    *   **Frontend Client**: [http://localhost:3000](http://localhost:3000)
    *   **Backend Interactive API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option B: Local Bare-Metal Setup

#### Step 1: Initialize Backend Core
1.  Navigate to backend and create virtual environment:
    ```bash
    cd backend
    python -m venv venv
    ```
2.  Activate virtual environment:
    *   **Windows**: `.\venv\Scripts\activate`
    *   **Unix/macOS**: `source venv/bin/activate`
3.  Install libraries and start Uvicorn:
    ```bash
    pip install -r requirements.txt
    python main.py
    ```
    *The API will start at `http://localhost:8000`.*

#### Step 2: Initialize React Client
1.  Open a new terminal window:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
    *The client will start at `http://localhost:3000`.*

---

## 🔬 Mathematical Formulas Catalog

| Parameter | Type | Primary Formula | Inputs |
| :--- | :--- | :--- | :--- |
| **K-Index** | Instability | $KI = (T_{850} - T_{500}) + Td_{850} - (T_{700} - Td_{700})$ | Temp & Dewpoint at 850hPa, 700hPa, 500hPa |
| **Total Totals Index (TT)** | Instability | $TT = (T_{850} + Td_{850}) - 2 \cdot T_{500}$ | Temp & Dewpoint at 850hPa, Temp at 500hPa |
| **Lifted Index (LI)** | Instability | $LI = T_{\text{env}, 500} - T_{\text{parcel}, 500}$ | Temp at 500hPa, Temp & Dewpoint at 850hPa |
| **Showalter Index (SI)** | Instability | Same as Lifted Index but starting from 850hPa env level. | Temp at 500hPa, Temp & Dewpoint at 850hPa |
| **Dewpoint Depression** | Moisture | $T_{\text{dep}} = T_{2\text{m}} - Td_{2\text{m}}$ | 2m Temp, 2m Dewpoint Temp |
| **Equivalent Potential Temperature ($\theta_e$)** | Thermodynamic | $\theta_e = T_k \cdot \left(\frac{1000}{P}\right)^{0.286} \cdot \exp\left(\frac{L_v \cdot r}{C_p \cdot T_k}\right)$ | Temp, Specific Humidity, Surface Pressure |
| **Precipitable Water (PW)** | Moisture | $PW = \sum_{n} \frac{q_n \cdot \Delta P_n}{g}$ | Specific Humidity at 925, 850, 700, 500, 300 hPa |
| **0-6km Bulk Wind Shear** | Kinematic | $WS_{0\text{-}6} = \sqrt{(u_{\text{sfc}} - u_{500})^2 + (v_{\text{sfc}} - v_{500})^2}$ | Surface $U, V$ winds, 500hPa $U, V$ winds |
| **850-300hPa Wind Shear** | Kinematic | $WS_{850\text{-}300} = \sqrt{(u_{850} - u_{300})^2 + (v_{850} - v_{300})^2}$ | 850hPa $U, V$ winds, 300hPa $U, V$ winds |
| **Lapse Rate 850-500 hPa** | Instability | $\Gamma_{850\text{-}500} = \frac{T_{850} - T_{500}}{(Z_{500} - Z_{850})/1000}$ | Temp & Geopotential heights at 850 and 500hPa |
| **Relative Vorticity 500hPa** | Kinematic | $\zeta = \frac{\partial v}{\partial x} - \frac{\partial u}{\partial y}$ (finite difference) | 500hPa $U, V$ winds, Latitude, Longitude |
| **CAPE Proxy** | Instability | $CAPE_{\text{proxy}} = 0.5 \cdot g \cdot \frac{\Delta T_{\text{LCL}} \cdot \Delta Z_{\text{LCL}}}{T_{\text{env}}}$ | Temp & Dewpoint at 850hPa, Temp at 500hPa |
| **Theta-W ($\theta_w$)** | Thermodynamic | Stull's formula for wet-bulb temp $T_w$ + Potential Temp reduction | 2m Temp, 2m Dewpoint Temp, Surface Pressure |
| **Wind Speed** | Kinematic | $WS = \sqrt{u^2 + v^2}$ | Surface $U$ and $V$ winds |
| **Wind Direction** | Kinematic | $\text{Dir} = (180 + \text{atan2}(u, v) \cdot 180 / \pi) \pmod{360}$ | Surface $U$ and $V$ winds |
| **Specific to Relative Humidity** | Moisture | $RH = \frac{e}{e_s} \cdot 100$ | Specific Humidity, Temperature, Pressure |
| **Moisture Flux** | Moisture | $\text{Flux}_m = q \cdot WS$ | Specific Humidity, Surface $U$ and $V$ winds |

---
⛈️ **Thunderstorm Data Ingestion & Preprocessing Platform &copy; 2026**
