export interface FuturesData {
  contract: string;
  contractUrl: string;
  latest: number | null;
  change: number | null;
  changePercent: string;
  open: number | null;
  high: number | null;
  low: number | null;
  previous: number | null;
  volume: number | null;
  openInt: number | null;
  time: string;
}

export interface FuturesResponse {
  success: boolean;
  data?: FuturesData[];
  symbol?: string;
  scrapedAt?: string;
  error?: string;
}
