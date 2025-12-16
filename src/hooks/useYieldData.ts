import { useState, useCallback } from "react";
import { CountryYieldData } from "@/types/yield";
import { countries, maturities } from "@/lib/countries";

// Mock data generator for initial display
// In production, this would be replaced with actual API calls
function generateMockData(): CountryYieldData[] {
  return countries.map((country) => {
    const baseRate = Math.random() * 8 + 1; // 1-9%
    const rates: Record<string, number | null> = {};
    
    maturities.forEach((m, index) => {
      // Create a realistic yield curve shape
      const spread = (index - 5) * 0.15; // Steeper curve
      const noise = (Math.random() - 0.5) * 0.3;
      rates[m] = Math.max(0, baseRate + spread + noise);
    });

    return {
      country: country.name,
      slug: country.slug,
      rates,
      lastUpdated: new Date().toISOString(),
    };
  });
}

export function useYieldData() {
  const [data, setData] = useState<CountryYieldData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // For now, use mock data
      // TODO: Replace with actual Firecrawl API calls via Edge Function
      const mockData = generateMockData();
      setData(mockData);
      setLastFetched(new Date().toLocaleTimeString());
    } catch (err) {
      setError("Failed to fetch yield data");
      console.error(err);
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
