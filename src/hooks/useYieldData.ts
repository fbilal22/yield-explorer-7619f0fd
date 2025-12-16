import { useState, useCallback } from "react";
import { CountryYieldData } from "@/types/yield";
import { countries } from "@/lib/countries";
import { scrapeAllYields } from "@/lib/api/yields";

export function useYieldData() {
  const [data, setData] = useState<CountryYieldData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("Starting to fetch real yield data...");
      const response = await scrapeAllYields();
      
      if (response.success && response.data) {
        console.log(`Fetched ${response.data.length} countries`);
        setData(response.data);
        setLastFetched(new Date().toLocaleTimeString());
      } else {
        console.error("Failed to fetch yields:", response.error);
        setError(response.error || "Failed to fetch yield data");
      }
    } catch (err) {
      console.error("Error fetching yield data:", err);
      setError("Failed to fetch yield data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    data,
    isLoading,
    lastFetched,
    error,
    fetchData,
    totalCountries: countries.length,
    loadedCountries: data.length,
  };
}
