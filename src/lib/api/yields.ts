import { supabase } from '@/integrations/supabase/client';
import { CountryYieldData } from '@/types/yield';
import { countries } from '@/lib/countries';

interface ScrapeResponse {
  success: boolean;
  error?: string;
  data?: CountryYieldData[];
}

export async function scrapeYields(
  countryList: { slug: string; name: string }[]
): Promise<ScrapeResponse> {
  const { data, error } = await supabase.functions.invoke('scrape-yields', {
    body: { countries: countryList },
  });

  if (error) {
    console.error('Error calling scrape-yields:', error);
    return { success: false, error: error.message };
  }

  return data;
}

export async function scrapeAllYields(): Promise<ScrapeResponse> {
  const countryList = countries.map(c => ({ slug: c.slug, name: c.name }));
  return scrapeYields(countryList);
}
