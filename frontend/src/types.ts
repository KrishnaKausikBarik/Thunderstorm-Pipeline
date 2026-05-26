export interface IngestStats {
  filename: string;
  total_rows: number;
  total_columns: number;
  date_range: string;
  sources_included: string[];
  file_size: string;
}

export interface ImputationNeed {
  strategy: 'linear' | 'knn' | 'user_ask';
  pct: number;
}

export interface DistributionItem {
  name: string;
  bins: number[];
  counts: number[];
}

export interface CorrelationData {
  columns: string[];
  matrix: number[][];
}

export interface TemporalTrendItem {
  x: string[];
  y: (number | null)[];
}

export interface EDAResults {
  shape: [number, number];
  dtypes: Record<string, string>;
  encoded_columns: string[];
  encoded_mappings: Record<string, Record<string, number>>;
  missingness: Record<string, number>;
  imputation_needs: Record<string, ImputationNeed>;
  outliers: Record<string, number>;
  duplicate_count: number;
  constant_cols: string[];
  distributions: DistributionItem[];
  correlation: CorrelationData;
  temporal_trends: Record<string, TemporalTrendItem>;
  temp_analyzed_file: string;
}

export interface FormulaCatalogItem {
  key: string;
  name: string;
  formula: string;
  inputs_required: string[];
  missing_inputs: string[];
  available: boolean;
}

export interface VifResultItem {
  feature: string;
  vif: number;
}

export interface SpearmanPairItem {
  feat_a: string;
  feat_b: string;
  r: number;
  action: string;
}

export interface DimAnalyzeResults {
  active_columns: string[];
  correlation: CorrelationData;
  corr_pairs: SpearmanPairItem[];
  vif_results: VifResultItem[];
  important_features: string[];
}
