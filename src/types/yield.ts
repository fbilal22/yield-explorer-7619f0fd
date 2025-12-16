export interface YieldRate {
  maturity: string;
  rate: number | null;
  change?: number | null;
}

export interface CountryYieldData {
  country: string;
  slug: string;
  rates: Record<string, number | null>;
  lastUpdated?: string;
  error?: string;
}

export interface YieldTableData {
  countries: CountryYieldData[];
  maturities: string[];
  lastFetched: string;
}
