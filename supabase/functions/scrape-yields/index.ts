const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface YieldData {
  maturity: string;
  rate: number | null;
}

interface CountryYieldResult {
  country: string;
  slug: string;
  rates: Record<string, number | null>;
  lastUpdated?: string;
  error?: string;
}

// Map maturity strings from the website to our standard format
function normalizeMaturity(maturity: string): string | null {
  const normalized = maturity.toLowerCase().trim();
  
  // Handle "1 month", "3 months", "1 year", "10 years" etc.
  const match = normalized.match(/^(\d+)\s*(month|year)s?$/);
  if (!match) return null;
  
  const num = parseInt(match[1]);
  const unit = match[2];
  
  if (unit === 'month') {
    if (num === 1) return '1M';
    if (num === 2) return '2M';
    if (num === 3) return '3M';
    if (num === 4) return '4M';
    if (num === 6) return '6M';
    if (num === 9) return '9M';
    return `${num}M`;
  } else {
    if (num === 1) return '1Y';
    if (num === 2) return '2Y';
    if (num === 3) return '3Y';
    if (num === 5) return '5Y';
    if (num === 7) return '7Y';
    if (num === 10) return '10Y';
    if (num === 15) return '15Y';
    if (num === 20) return '20Y';
    if (num === 30) return '30Y';
    return `${num}Y`;
  }
}

// Parse the scraped markdown content to extract yield data
// Format: | [1 month](url) | 3.620% | -31.7 bp | ...
function parseYieldData(markdown: string): YieldData[] {
  const yields: YieldData[] = [];
  
  // Match table rows like: | [1 month](url) | 3.620% | ... or | 1 month | 3.620% | ...
  // The pattern captures: maturity text and the rate percentage
  const tableRowPattern = /\|\s*(?:\[)?(\d+\s+(?:month|year)s?)(?:\][^\|]*)?\s*\|\s*([\d.]+)%/gi;
  
  let match;
  while ((match = tableRowPattern.exec(markdown)) !== null) {
    const maturityText = match[1].trim();
    const rateValue = parseFloat(match[2]);
    
    const maturity = normalizeMaturity(maturityText);
    
    if (maturity && !isNaN(rateValue)) {
      // Check if we already have this maturity (take first occurrence)
      const existing = yields.find(y => y.maturity === maturity);
      if (!existing) {
        yields.push({ maturity, rate: rateValue });
      }
    }
  }
  
  return yields;
}

async function scrapeCountry(slug: string, countryName: string, apiKey: string): Promise<CountryYieldResult> {
  const url = `https://www.worldgovernmentbonds.com/country/${slug}/`;
  
  console.log(`Scraping ${countryName} from ${url}`);
  
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Firecrawl API error for ${countryName}:`, errorData);
      return {
        country: countryName,
        slug,
        rates: {},
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    
    console.log(`Received ${markdown.length} chars for ${countryName}`);
    
    // Parse yield data from markdown
    const yields = parseYieldData(markdown);
    
    console.log(`Parsed ${yields.length} yields for ${countryName}:`, JSON.stringify(yields.slice(0, 5)));
    
    // Convert to rates object
    const rates: Record<string, number | null> = {};
    for (const y of yields) {
      rates[y.maturity] = y.rate;
    }
    
    return {
      country: countryName,
      slug,
      rates,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error scraping ${countryName}:`, error);
    return {
      country: countryName,
      slug,
      rates: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { countries } = await req.json();
    
    if (!countries || !Array.isArray(countries)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Countries array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting to scrape ${countries.length} countries`);

    // Scrape countries in parallel batches
    const batchSize = 5;
    const results: CountryYieldResult[] = [];
    const startTime = Date.now();
    const maxExecutionTime = 50000; // 50 seconds max
    
    for (let i = 0; i < countries.length; i += batchSize) {
      // Check if we're running out of time
      if (Date.now() - startTime > maxExecutionTime) {
        console.log(`Timeout approaching, returning ${results.length} results`);
        break;
      }
      
      const batch = countries.slice(i, i + batchSize);
      const batchPromises = batch.map((c: { slug: string; name: string }) => 
        scrapeCountry(c.slug, c.name, apiKey)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      console.log(`Completed batch ${Math.floor(i / batchSize) + 1}, total: ${results.length}/${countries.length}, time: ${Date.now() - startTime}ms`);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < countries.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Scraping complete. ${results.length} countries processed in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({ success: true, data: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scrape-yields function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape yields';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
