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
  
  // Map common patterns
  if (normalized.includes('1 month') || normalized === '1m') return '1M';
  if (normalized.includes('3 month') || normalized === '3m') return '3M';
  if (normalized.includes('6 month') || normalized === '6m') return '6M';
  if (normalized.includes('1 year') || normalized === '1y') return '1Y';
  if (normalized.includes('2 year') || normalized === '2y') return '2Y';
  if (normalized.includes('3 year') || normalized === '3y') return '3Y';
  if (normalized.includes('5 year') || normalized === '5y') return '5Y';
  if (normalized.includes('7 year') || normalized === '7y') return '7Y';
  if (normalized.includes('10 year') || normalized === '10y') return '10Y';
  if (normalized.includes('15 year') || normalized === '15y') return '15Y';
  if (normalized.includes('20 year') || normalized === '20y') return '20Y';
  if (normalized.includes('30 year') || normalized === '30y') return '30Y';
  
  return null;
}

// Parse the scraped markdown/html content to extract yield data
function parseYieldData(markdown: string): YieldData[] {
  const yields: YieldData[] = [];
  
  // Look for table rows with maturity and rate data
  // The table has columns: Residual Maturity | Last | Chg 1M | ...
  const lines = markdown.split('\n');
  
  for (const line of lines) {
    // Look for patterns like "3 months | 2.391%" or table row formats
    const maturityPatterns = [
      /(\d+\s*(?:month|year)s?)\s*[|\t,]\s*([\d.]+)\s*%/gi,
      /(\d+\s*(?:month|year)s?)\s*\*?\*?\s*[|\t]\s*([\d.]+)/gi,
    ];
    
    for (const pattern of maturityPatterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const maturity = normalizeMaturity(match[1]);
        const rate = parseFloat(match[2]);
        
        if (maturity && !isNaN(rate)) {
          // Check if we already have this maturity
          const existing = yields.find(y => y.maturity === maturity);
          if (!existing) {
            yields.push({ maturity, rate });
          }
        }
      }
    }
  }
  
  return yields;
}

// Alternative parsing for HTML table structure
function parseTableFromMarkdown(markdown: string): YieldData[] {
  const yields: YieldData[] = [];
  
  // Look for markdown table rows
  const tableRowPattern = /\|\s*(?:🟥|🟩|⬜)?\s*(\d+\s*(?:months?|years?))\s*\|\s*([\d.]+%?)\s*\|/gi;
  
  let match;
  while ((match = tableRowPattern.exec(markdown)) !== null) {
    const maturity = normalizeMaturity(match[1]);
    const rateStr = match[2].replace('%', '');
    const rate = parseFloat(rateStr);
    
    if (maturity && !isNaN(rate)) {
      const existing = yields.find(y => y.maturity === maturity);
      if (!existing) {
        yields.push({ maturity, rate });
      }
    }
  }
  
  // Also try simpler patterns
  const simplePattern = /(\d+)\s*(months?|years?)\s*[^\d]*([\d.]+)\s*%/gi;
  while ((match = simplePattern.exec(markdown)) !== null) {
    const num = match[1];
    const unit = match[2].toLowerCase();
    const maturityStr = `${num} ${unit}`;
    const maturity = normalizeMaturity(maturityStr);
    const rate = parseFloat(match[3]);
    
    if (maturity && !isNaN(rate)) {
      const existing = yields.find(y => y.maturity === maturity);
      if (!existing) {
        yields.push({ maturity, rate });
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
        waitFor: 2000,
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
    
    // Try both parsing methods
    let yields = parseYieldData(markdown);
    if (yields.length === 0) {
      yields = parseTableFromMarkdown(markdown);
    }
    
    console.log(`Parsed ${yields.length} yields for ${countryName}:`, yields);
    
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

    // Scrape countries in batches to avoid rate limiting
    const batchSize = 3;
    const results: CountryYieldResult[] = [];
    
    for (let i = 0; i < countries.length; i += batchSize) {
      const batch = countries.slice(i, i + batchSize);
      const batchPromises = batch.map((c: { slug: string; name: string }) => 
        scrapeCountry(c.slug, c.name, apiKey)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      console.log(`Completed batch ${Math.floor(i / batchSize) + 1}, total: ${results.length}/${countries.length}`);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < countries.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Scraping complete. ${results.length} countries processed.`);

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
