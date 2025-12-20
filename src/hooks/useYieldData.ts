import { useState, useCallback } from "react";
import { CountryYieldData } from "@/types/yield";
import { countries } from "@/lib/countries";
import { scrapeYields } from "@/lib/api/yields";

// Default maturities to display if API doesn't return any
// This will be overridden by the maturities returned from the API
const DEFAULT_MATURITIES = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];

// Helper function to filter maturities to max 30Y
function filterMaturitiesTo30Y(maturities: string[]): string[] {
  return maturities.filter(m => {
    const match = m.match(/^(\d+)(M|Y)$/);
    if (!match) return false;
    
    const num = parseInt(match[1]);
    const unit = match[2];
    
    // Keep all months (M) and years (Y) up to 30Y
    if (unit === 'M') return true; // Keep all months
    if (unit === 'Y') return num <= 30; // Keep years up to 30Y
    
    return false;
  });
}

// Helper function to convert maturity to months for comparison
function maturityToMonths(maturity: string): number {
  const match = maturity.match(/^(\d+)(M|Y)$/);
  if (!match) return Infinity;
  const num = parseInt(match[1]);
  const unit = match[2];
  return unit === 'M' ? num : num * 12;
}

// Helper function to sort maturities properly (always by chronological order)
function sortMaturities(maturities: string[]): string[] {
  // Create a copy to avoid mutating the original array
  const sorted = [...maturities];
  return sorted.sort((a, b) => {
    // Always sort by converting to months for accurate chronological order
    const monthsA = maturityToMonths(a);
    const monthsB = maturityToMonths(b);
    return monthsA - monthsB;
  });
}

export function useYieldData() {
  const [data, setData] = useState<CountryYieldData[]>([]);
  const [maturities, setMaturities] = useState<string[]>(DEFAULT_MATURITIES);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Starting to fetch yield data for all ${countries.length} countries...`);
      
      // Scrape all countries without prioritization
      const countryList = countries.map(c => ({ slug: c.slug, name: c.name }));
      
      const response = await scrapeYields(countryList);
      
      if (response.success && response.data) {
        console.log(`Fetched ${response.data.length} countries`);
        setData(response.data);
        
        // Use maturities returned from API, or fallback to default
        if (response.maturities && response.maturities.length > 0) {
          // Filter to max 30Y and sort
          const filtered = filterMaturitiesTo30Y([...response.maturities]);
          const sortedMaturities = sortMaturities(filtered);
          setMaturities(sortedMaturities);
          console.log(`Using ${sortedMaturities.length} maturities from API (filtered to 30Y max):`, sortedMaturities);
        } else {
          // Fallback: collect all unique maturities from the data
          const allMaturitiesSet = new Set<string>();
          response.data.forEach(country => {
            Object.keys(country.rates).forEach(m => allMaturitiesSet.add(m));
          });
          if (allMaturitiesSet.size > 0) {
            // Filter to max 30Y and sort
            const filtered = filterMaturitiesTo30Y(Array.from(allMaturitiesSet));
            const sortedMaturities = sortMaturities(filtered);
            setMaturities(sortedMaturities);
            console.log(`Using ${sortedMaturities.length} maturities from data (filtered to 30Y max):`, sortedMaturities);
          } else {
            setMaturities(DEFAULT_MATURITIES);
          }
        }
        
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
    maturities,
    isLoading,
    lastFetched,
    error,
    fetchData,
    totalCountries: countries.length,
    loadedCountries: data.length,
  };
}

