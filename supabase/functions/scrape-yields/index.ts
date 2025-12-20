const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface YieldData {
  maturity: string;
  rate: number;
}

interface CountryYieldResult {
  country: string;
  slug: string;
  rates: Record<string, number | null>;
  lastUpdated?: string;
  error?: string;
}

// All possible maturities we might encounter, in order
const ALL_MATURITIES = [
  '1M', '2M', '3M', '4M', '6M', '9M',
  '1Y', '2Y', '3Y', '4Y', '5Y', '6Y', '7Y', '8Y', '9Y',
  '10Y', '12Y', '15Y', '20Y', '25Y', '30Y', '40Y', '50Y'
];

// Map maturity strings from the website to our standard format
function normalizeMaturity(maturity: string): string | null {
  const normalized = maturity.toLowerCase().trim();
  
  // Handle "1 month", "3 months", "1 year", "10 years" etc.
  const match = normalized.match(/^(\d+)\s*(month|year)s?$/);
  if (!match) return null;
  
  const num = parseInt(match[1]);
  const unit = match[2];
  
  if (unit === 'month') {
    return `${num}M`;
  } else {
    return `${num}Y`;
  }
}

// Parse the scraped markdown content to extract yield data
// Format: | [1 month](url) | 3.620% | -31.7 bp | ...
function parseYieldData(markdown: string): YieldData[] {
  const yields: YieldData[] = [];
  const seenMaturities = new Set<string>();
  
  // Split by lines for better parsing
  const lines = markdown.split('\n');
  
  for (const line of lines) {
    // Skip header lines
    if (line.includes('Residual') || line.includes('Maturity') || line.includes('---')) {
      continue;
    }
    
    // Pattern 1: | [1 month](url) | 3.620% | ... (linked maturity)
    // Pattern 2: | 1 month | 3.620% | ... (plain text maturity)
    // We need to capture the maturity and the FIRST percentage after it
    
    // Match: | [X month/year](link) | RATE% | or | X month/year | RATE% |
    const patterns = [
      // Linked: | [1 month](url) | 3.620% |
      /\|\s*\[(\d+\s+(?:month|year)s?)\]\([^)]+\)\s*\|\s*([\d.]+)%/gi,
      // Plain: | 1 month | 3.620% |
      /\|\s*(\d+\s+(?:month|year)s?)\s*\|\s*([\d.]+)%/gi,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const maturityText = match[1].trim();
        const rateValue = parseFloat(match[2]);
        const maturity = normalizeMaturity(maturityText);
        
        if (maturity && !isNaN(rateValue) && !seenMaturities.has(maturity)) {
          seenMaturities.add(maturity);
          yields.push({ maturity, rate: rateValue });
        }
      }
    }
  }
  
  // Also try a more general pattern for the whole content
  if (yields.length === 0) {
    // Fallback: find any "X month/year" followed by a percentage
    const generalPattern = /(\d+)\s+(month|year)s?[^\d]*?([\d.]+)\s*%/gi;
    let match;
    while ((match = generalPattern.exec(markdown)) !== null) {
      const num = match[1];
      const unit = match[2];
      const maturityText = `${num} ${unit}`;
      const rateValue = parseFloat(match[3]);
      const maturity = normalizeMaturity(maturityText);
      
      if (maturity && !isNaN(rateValue) && rateValue < 100 && !seenMaturities.has(maturity)) {
        seenMaturities.add(maturity);
        yields.push({ maturity, rate: rateValue });
      }
    }
  }
  
  // Sort by maturity order
  yields.sort((a, b) => {
    const indexA = ALL_MATURITIES.indexOf(a.maturity);
    const indexB = ALL_MATURITIES.indexOf(b.maturity);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  
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
    
    console.log(`Parsed ${yields.length} yields for ${countryName}:`, JSON.stringify(yields));
    
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

    // Collect all unique maturities found across all countries
    const allMaturitiesSet = new Set<string>();
    for (const result of results) {
      Object.keys(result.rates).forEach(m => allMaturitiesSet.add(m));
    }
    
    // Sort maturities in proper order
    const foundMaturities = Array.from(allMaturitiesSet).sort((a, b) => {
      const indexA = ALL_MATURITIES.indexOf(a);
      const indexB = ALL_MATURITIES.indexOf(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    console.log(`Scraping complete. ${results.length} countries processed in ${Date.now() - startTime}ms`);
    console.log(`Found maturities: ${foundMaturities.join(', ')}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: results,
        maturities: foundMaturities 
      }),
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
