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
      
      // Get priority countries first, then others
      const priorityList = countries.filter(c => priorityCountries.includes(c.slug));
      const otherList = countries.filter(c => !priorityCountries.includes(c.slug));
      const orderedCountries = [...priorityList, ...otherList];
      
      const countryList = orderedCountries.map(c => ({ slug: c.slug, name: c.name }));
      
      const response = await scrapeYields(countryList);
      
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
