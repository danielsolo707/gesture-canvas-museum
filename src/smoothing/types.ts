export interface FilterConfig {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

export interface SmoothingState {
  filters: Map<string, OneEuroFilterState>;
}

export interface OneEuroFilterState {
  prevValue: number;
  prevDerivative: number;
  prevTimestamp: number;
  initialized: boolean;
}
