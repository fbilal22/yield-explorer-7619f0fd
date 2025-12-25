import { useState, useCallback } from "react";
import { FuturesData } from "@/types/futures";
import { scrapeFutures } from "@/lib/api/futures";

export function useFuturesData() {
  const [data, setData] = useState<FuturesData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState<string>('SQZ25');

  const fetchData = useCallback(async (newSymbol?: string) => {
    const targetSymbol = newSymbol || symbol;
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching futures data for symbol: ${targetSymbol}`);
      
      const response = await scrapeFutures(targetSymbol);
      
      if (response.success && response.data) {
        console.log(`Fetched ${response.data.length} futures contracts`);
        setData(response.data);
        setLastFetched(new Date().toLocaleTimeString());
        if (newSymbol) setSymbol(newSymbol);
      } else {
        console.error("Failed to fetch futures:", response.error);
        setError(response.error || "Failed to fetch futures data");
      }
    } catch (err) {
      console.error("Error fetching futures data:", err);
      setError("Failed to fetch futures data");
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  return {
    data,
    isLoading,
    lastFetched,
    error,
    fetchData,
    symbol,
    setSymbol,
  };
}
