import { useState, useCallback } from "react";
import { CountryYieldData } from "@/types/yield";
import { countries } from "@/lib/countries";
import { scrapeYields } from "@/lib/api/yields";

// Priority countries to scrape first (major economies)
const priorityCountries = [
  "united-states", "germany", "japan", "united-kingdom", "france",
  "italy", "spain", "canada", "australia", "switzerland",
  "china", "india", "brazil", "south-korea", "netherlands"
];

// Default maturities to show if none found
const DEFAULT_MATURITIES = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];

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
      console.log("Starting to fetch real yield data...");
      
      // Get priority countries first, then others
      const priorityList = countries.filter(c => priorityCountries.includes(c.slug));
      const otherList = countries.filter(c => !priorityCountries.includes(c.slug));
      const orderedCountries = [...priorityList, ...otherList];
      
      const countryList = orderedCountries.map(c => ({ slug: c.slug, name: c.name }));
      
      const response = await scrapeYields(countryList);
      
      if (response.success && response.data) {
        console.log(`Fetched ${response.data.length} countries`);
        setData(response.data);
        
        // Use maturities from response if available
        if (response.maturities && response.maturities.length > 0) {
          console.log(`Using ${response.maturities.length} maturities from response:`, response.maturities);
          setMaturities(response.maturities);
        } else {
          // Calculate from data
          const allMats = new Set<string>();
          response.data.forEach(country => {
            Object.keys(country.rates).forEach(m => allMats.add(m));
          });
          if (allMats.size > 0) {
            const sorted = sortMaturities(Array.from(allMats));
            setMaturities(sorted);
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

// Sort maturities in proper order (1M, 2M, 3M... 1Y, 2Y... 10Y, 20Y, 30Y)
function sortMaturities(maturities: string[]): string[] {
  return maturities.sort((a, b) => {
    const parseMaturity = (m: string) => {
      const match = m.match(/^(\d+)(M|Y)$/);
      if (!match) return Infinity;
      const num = parseInt(match[1]);
      const unit = match[2];
      // Convert to months for comparison
      return unit === 'M' ? num : num * 12;
    };
    return parseMaturity(a) - parseMaturity(b);
  });
}
