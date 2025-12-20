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

// All possible maturities we might encounter, in order (max 30Y)
const ALL_MATURITIES = [
  '1M', '2M', '3M', '4M', '6M', '9M',
  '1Y', '2Y', '3Y', '4Y', '5Y', '6Y', '7Y', '8Y', '9Y',
  '10Y', '12Y', '15Y', '20Y', '25Y', '30Y'
];

// Helper function to filter maturities to max 30Y
function filterMaturitiesTo30Y(maturities: string[]): string[] {
  return maturities.filter(m => {
    // Parse maturity string (e.g., "1M", "30Y", "40Y")
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
function sortMaturitiesByOrder(maturities: string[]): string[] {
  // Create a copy to avoid mutating the original array
  const sorted = [...maturities];
  return sorted.sort((a, b) => {
    // Always sort by converting to months for accurate chronological order
    const monthsA = maturityToMonths(a);
    const monthsB = maturityToMonths(b);
    return monthsA - monthsB;
  });
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
    return `${num}M`;
  } else {
    return `${num}Y`;
  }
}

// Parse the scraped markdown content to extract yield data
// Format: | [1 month](url) | 3.620% | -31.7 bp | ...
// Also handles negative values: | 1 month | -0.290% |
function parseYieldData(markdown: string, html?: string): YieldData[] {
  const yields: YieldData[] = [];
  const seenMaturities = new Set<string>();
  
  // Helper function to add yield if valid
  const addYield = (maturity: string, rate: number) => {
    if (maturity && !isNaN(rate) && Math.abs(rate) < 100 && !seenMaturities.has(maturity)) {
      seenMaturities.add(maturity);
      yields.push({ maturity, rate });
      return true;
    }
    return false;
  };
  
  // METHOD 1: Parse markdown table format (most common)
  const lines = markdown.split('\n');
  for (const line of lines) {
    // Skip only obvious header/separator lines, but keep lines that might have data
    if (line.trim() === '' || line.match(/^[\s\|\-:]+$/)) {
      continue;
    }
    
    // Try all patterns on each line
    const patterns = [
      // Linked: | [1 month](url) | 3.620% | or | [1 month](url) | -0.290% |
      /\|\s*\[(\d+\s+(?:month|year)s?)\]\([^)]+\)\s*\|\s*(-?\d+\.?\d*)%/gi,
      // Plain: | 1 month | 3.620% | or | 1 month | -0.290% |
      /\|\s*(\d+\s+(?:month|year)s?)\s*\|\s*(-?\d+\.?\d*)%/gi,
      // Without spaces: |1 month|3.620%| or |1 month|-0.290%|
      /\|(\d+\s+(?:month|year)s?)\|(-?\d+\.?\d*)%/gi,
      // More flexible: maturity and rate anywhere in the line
      /(\d+\s+(?:month|year)s?)[^\d]*?(-?\d+\.?\d*)\s*%/gi,
    ];
    
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const maturityText = match[1].trim();
        const rateValue = parseFloat(match[2]);
        const maturity = normalizeMaturity(maturityText);
        if (maturity) {
          addYield(maturity, rateValue);
        }
      }
    }
  }
  
  // METHOD 2: Parse entire markdown with general patterns (catches data not in table format)
  const generalPatterns = [
    // Pattern: "1 month" or "1 months" followed by percentage anywhere
    /(\d+)\s+(month|year)s?\s*[^\d]*?(-?\d+\.?\d*)\s*%/gi,
    // Pattern with colon or pipe separator
    /(\d+)\s+(month|year)s?[:\|]\s*(-?\d+\.?\d*)\s*%/gi,
    // Pattern: number + unit + percentage (very flexible)
    /(\d+)\s+(month|year)s?[^%]*?(-?\d+\.?\d*)\s*%/gi,
  ];
  
  for (const pattern of generalPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(markdown)) !== null) {
      const num = match[1];
      const unit = match[2];
      const maturityText = `${num} ${unit}`;
      const rateValue = parseFloat(match[3]);
      const maturity = normalizeMaturity(maturityText);
      if (maturity) {
        addYield(maturity, rateValue);
      }
    }
  }
  
  // METHOD 3: Parse HTML table if available
  if (html && html.includes('<table')) {
    // Extract all table rows
    const tableRowPattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = tableRowPattern.exec(html)) !== null) {
      const row = rowMatch[0];
      
      // Extract all cells from the row
      const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      const cells: string[] = [];
      let cellMatch;
      while ((cellMatch = cellPattern.exec(row)) !== null) {
        const cellContent = cellMatch[1].replace(/<[^>]+>/g, '').trim();
        if (cellContent) cells.push(cellContent);
      }
      
      // Try to find maturity and rate in cells
      for (let i = 0; i < cells.length - 1; i++) {
        const cell1 = cells[i];
        const cell2 = cells[i + 1];
        
        // Check if cell1 is a maturity and cell2 is a rate
        const maturityMatch = cell1.match(/(\d+)\s+(month|year)s?/i);
        const rateMatch = cell2.match(/(-?\d+\.?\d*)\s*%/);
        
        if (maturityMatch && rateMatch) {
          const num = maturityMatch[1];
          const unit = maturityMatch[2].toLowerCase();
          const maturityText = `${num} ${unit}`;
          const rateValue = parseFloat(rateMatch[1]);
          const maturity = normalizeMaturity(maturityText);
          if (maturity) {
            addYield(maturity, rateValue);
          }
        }
      }
      
      // Also try to find maturity and rate anywhere in the row
      const maturityMatch = row.match(/(\d+)\s+(month|year)s?/i);
      const rateMatches = row.matchAll(/(-?\d+\.?\d*)\s*%/g);
      
      if (maturityMatch) {
        const num = maturityMatch[1];
        const unit = maturityMatch[2].toLowerCase();
        const maturityText = `${num} ${unit}`;
        const maturity = normalizeMaturity(maturityText);
        
        if (maturity) {
          // Try each percentage found in the row
          for (const rateMatch of rateMatches) {
            const rateValue = parseFloat(rateMatch[1]);
            if (addYield(maturity, rateValue)) {
              break; // Use first valid rate for this maturity
            }
          }
        }
      }
    }
  }
  
  // METHOD 4: Parse HTML directly if markdown was empty
  if (html && yields.length === 0) {
    // Look for any text content that matches maturity + rate pattern
    const htmlText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const htmlPattern = /(\d+)\s+(month|year)s?[^\d]*?(-?\d+\.?\d*)\s*%/gi;
    let match;
    while ((match = htmlPattern.exec(htmlText)) !== null) {
      const num = match[1];
      const unit = match[2];
      const maturityText = `${num} ${unit}`;
      const rateValue = parseFloat(match[3]);
      const maturity = normalizeMaturity(maturityText);
      if (maturity) {
        addYield(maturity, rateValue);
      }
    }
  }
  
  // Sort by maturity order (chronological order)
  const sortedYields = yields.sort((a, b) => {
    const monthsA = maturityToMonths(a.maturity);
    const monthsB = maturityToMonths(b.maturity);
    return monthsA - monthsB;
  });
  
  console.log(`Total yields parsed: ${sortedYields.length} (unique maturities: ${seenMaturities.size})`);
  return sortedYields;
}

async function scrapeCountry(slug: string, countryName: string, apiKey: string): Promise<CountryYieldResult> {
  const url = `https://www.worldgovernmentbonds.com/country/${slug}/`;
  
  console.log(`Scraping ${countryName} from ${url}`);
  
  try {
    // First, try to use Firecrawl's extract feature with LLM for structured data
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html', 'extract'],
        waitFor: 15000, // Wait 15 seconds for dynamic JavaScript content to fully load
        timeout: 60000, // 60 seconds timeout
        onlyMainContent: false,
        // Use LLM extraction to get structured yield data
        extract: {
          schema: {
            type: 'object',
            properties: {
              yields: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    maturity: { type: 'string', description: 'Bond maturity like "1 month", "3 months", "1 year", "10 years"' },
                    rate: { type: 'number', description: 'Yield rate as a number (can be negative)' }
                  }
                },
                description: 'List of government bond yields with their maturities and rates'
              }
            }
          },
          prompt: 'Extract all government bond yield data from the yield curve table. Include all maturities (1 month, 2 months, 3 months, 6 months, 1 year, 2 years, etc.) and their corresponding yield rates. Rates can be negative.'
        }
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
    console.log(`Firecrawl response for ${countryName}:`, JSON.stringify(data).substring(0, 500));
    
    // First, try to use extracted data if available
    const extractedData = data.data?.extract || data.extract;
    let yields: YieldData[] = [];
    
    if (extractedData?.yields && Array.isArray(extractedData.yields)) {
      console.log(`Using LLM extracted data for ${countryName}: ${extractedData.yields.length} yields`);
      for (const item of extractedData.yields) {
        if (item.maturity && item.rate !== undefined && item.rate !== null) {
          const maturity = normalizeMaturity(item.maturity);
          if (maturity && !isNaN(item.rate) && Math.abs(item.rate) < 100) {
            yields.push({ maturity, rate: item.rate });
          }
        }
      }
    }
    
    // If LLM extraction didn't work, fall back to parsing markdown/HTML
    if (yields.length === 0) {
      console.log(`LLM extraction failed for ${countryName}, falling back to parsing...`);
      
      let markdown = data.data?.markdown || data.markdown || '';
      const html = data.data?.html || data.html || '';
      
      // If markdown is empty or too short, try to extract from HTML
      if (markdown.length < 500 && html.length > 0) {
        console.log(`Markdown too short (${markdown.length}), trying to extract from HTML...`);
        markdown = html.replace(/<table[^>]*>/gi, '\n|').replace(/<\/table>/gi, '\n')
          .replace(/<tr[^>]*>/gi, '\n|').replace(/<\/tr>/gi, '|')
          .replace(/<th[^>]*>/gi, '').replace(/<\/th>/gi, '|')
          .replace(/<td[^>]*>/gi, '').replace(/<\/td>/gi, '|')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ');
      }
      
      console.log(`Received ${markdown.length} chars markdown, ${html.length} chars HTML for ${countryName}`);
      
      // Check if the page is still loading
      const isStillLoading = markdown.includes('Loading data') || markdown.includes('Please wait') || 
                             html.includes('Loading data') || html.includes('Please wait');
      if (isStillLoading) {
        console.warn(`WARNING: Page for ${countryName} appears to still be loading - dynamic content may not be captured`);
      }
      
      // Log percentage values found
      if (markdown.length > 0) {
        const percentMatches = markdown.match(/-?\d+\.?\d*%/g);
        console.log(`Found ${percentMatches ? percentMatches.length : 0} percentage values in markdown`);
      }
      
      // Parse yield data from markdown and HTML
      yields = parseYieldData(markdown.length > 0 ? markdown : '', html.length > 0 ? html : undefined);
    }
    
    console.log(`Final result for ${countryName}: ${yields.length} yields parsed`);
    
    // Sort yields by maturity
    yields.sort((a, b) => maturityToMonths(a.maturity) - maturityToMonths(b.maturity));
    
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

    // Scrape countries in smaller batches to allow more time per country
    const batchSize = 3;
    const results: CountryYieldResult[] = [];
    const startTime = Date.now();
    const maxExecutionTime = 120000; // 120 seconds max (increased for better data capture)
    
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
      
      // Longer delay between batches to allow rate limiting and better data loading
      if (i + batchSize < countries.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Collect all unique maturities found across all countries
    const allMaturitiesSet = new Set<string>();
    for (const result of results) {
      Object.keys(result.rates).forEach(m => allMaturitiesSet.add(m));
    }
    
    // Filter to max 30Y and sort maturities in proper order
    const filteredMaturities = filterMaturitiesTo30Y(Array.from(allMaturitiesSet));
    const foundMaturities = sortMaturitiesByOrder(filteredMaturities);
    
    // Also filter rates in each country result to max 30Y
    const filteredResults = results.map(result => {
      const filteredRates: Record<string, number | null> = {};
      Object.keys(result.rates).forEach(m => {
        const match = m.match(/^(\d+)(M|Y)$/);
        if (match) {
          const num = parseInt(match[1]);
          const unit = match[2];
          // Keep all months and years up to 30Y
          if (unit === 'M' || (unit === 'Y' && num <= 30)) {
            filteredRates[m] = result.rates[m];
          }
        }
      });
      return {
        ...result,
        rates: filteredRates
      };
    });

    console.log(`Scraping complete. ${results.length} countries processed in ${Date.now() - startTime}ms`);
    console.log(`Found maturities: ${foundMaturities.join(', ')}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: filteredResults,
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
