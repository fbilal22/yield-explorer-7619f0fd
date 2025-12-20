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
// Handles various formats: "1 month", "1 months", "1m", "1M", etc.
function normalizeMaturity(maturity: string): string | null {
  if (!maturity) return null;
  
  const normalized = maturity.toLowerCase().trim();
  
  // Remove any leading/trailing punctuation or whitespace
  const cleaned = normalized.replace(/^[^\d]+|[^\d\s]+$/g, '').trim();
  
  // Pattern 1: "1 month", "3 months", "1 year", "10 years" (with space)
  let match = cleaned.match(/^(\d+)\s*(month|year)s?$/);
  if (match) {
    const num = parseInt(match[1]);
    const unit = match[2];
    return unit === 'month' ? `${num}M` : `${num}Y`;
  }
  
  // Pattern 2: "1m", "3m", "1y", "10y" (without space, lowercase)
  match = cleaned.match(/^(\d+)\s*([my])$/);
  if (match) {
    const num = parseInt(match[1]);
    const unit = match[2];
    return unit === 'm' ? `${num}M` : `${num}Y`;
  }
  
  // Pattern 3: Already in format "1M", "3M", "1Y", "10Y"
  match = cleaned.match(/^(\d+)\s*([my])$/i);
  if (match) {
    const num = parseInt(match[1]);
    const unit = match[2].toUpperCase();
    return `${num}${unit}`;
  }
  
  // Pattern 4: Extract from text like "1-month", "3-months", etc.
  match = normalized.match(/(\d+)[\s\-]*(month|year|m|y)s?/i);
  if (match) {
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 'month' || unit === 'm') {
      return `${num}M`;
    } else if (unit === 'year' || unit === 'y') {
      return `${num}Y`;
    }
  }
  
  return null;
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
    
    // Try all patterns on each line (IMPROVED - better negative value handling)
    const patterns = [
      // Linked: | [1 month](url) | 3.620% | or | [1 month](url) | -0.290% |
      /\|\s*\[(\d+\s*(?:month|year|m|y)s?)\]\([^)]+\)\s*\|\s*(-?\d+\.?\d*)\s*%/gi,
      // Plain: | 1 month | 3.620% | or | 1 month | -0.290% |
      /\|\s*(\d+\s*(?:month|year|m|y)s?)\s*\|\s*(-?\d+\.?\d*)\s*%/gi,
      // Without spaces: |1 month|3.620%| or |1 month|-0.290%|
      /\|(\d+\s*(?:month|year|m|y)s?)\|(-?\d+\.?\d*)\s*%/gi,
      // More flexible: maturity and rate anywhere in the line (handles negative better)
      /(\d+\s*(?:month|year|m|y)s?)[^\d]*?(-?\d+\.?\d*)\s*%/gi,
      // Pattern for negative values with space: "1 month -0.290%"
      /(\d+)\s*(month|year|m|y)s?\s+(-?\d+\.?\d*)\s*%/gi,
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
  
  // METHOD 3: Parse HTML table if available (IMPROVED - handles table with headers)
  if (html && html.includes('<table')) {
    console.log('Parsing HTML table...');
    
    // First, try to find table headers to understand column structure
    const headerPattern = /<thead[^>]*>([\s\S]*?)<\/thead>/gi;
    const headerMatch = headerPattern.exec(html);
    const headerMaturities: { index: number; maturity: string }[] = [];
    
    if (headerMatch) {
      const headerRow = headerMatch[1];
      const headerCellPattern = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let headerIndex = 0;
      let headerCellMatch;
      while ((headerCellMatch = headerCellPattern.exec(headerRow)) !== null) {
        const headerText = headerCellMatch[1].replace(/<[^>]+>/g, '').trim();
        const maturity = normalizeMaturity(headerText);
        if (maturity) {
          headerMaturities.push({ index: headerIndex, maturity });
        }
        headerIndex++;
      }
      console.log(`Found ${headerMaturities.length} maturities in table header`);
    }
    
    // Extract all table rows (including tbody)
    const tableRowPattern = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
    let rowMatch;
    let rowIndex = 0;
    while ((rowMatch = tableRowPattern.exec(html)) !== null) {
      const row = rowMatch[0];
      rowIndex++;
      
      // Skip header rows
      if (row.includes('<th') || row.match(/residual|maturity/i)) {
        continue;
      }
      
      // Extract all cells from the row
      const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      const cells: string[] = [];
      let cellMatch;
      while ((cellMatch = cellPattern.exec(row)) !== null) {
        const cellContent = cellMatch[1].replace(/<[^>]+>/g, '').trim();
        cells.push(cellContent);
      }
      
      // METHOD 3a: If we found maturities in header, match cells by index
      if (headerMaturities.length > 0) {
        for (const headerMaturity of headerMaturities) {
          const cellIndex = headerMaturity.index;
          if (cellIndex < cells.length) {
            const cellValue = cells[cellIndex];
            // Try to extract rate from cell
            const rateMatch = cellValue.match(/(-?\d+\.?\d*)\s*%/);
            if (rateMatch) {
              const rateValue = parseFloat(rateMatch[1]);
              addYield(headerMaturity.maturity, rateValue);
            }
          }
        }
      }
      
      // METHOD 3b: Try to find maturity and rate in adjacent cells
      for (let i = 0; i < cells.length - 1; i++) {
        const cell1 = cells[i];
        const cell2 = cells[i + 1];
        
        // Check if cell1 is a maturity and cell2 is a rate
        const maturity = normalizeMaturity(cell1);
        const rateMatch = cell2.match(/(-?\d+\.?\d*)\s*%/);
        
        if (maturity && rateMatch) {
          const rateValue = parseFloat(rateMatch[1]);
          addYield(maturity, rateValue);
        }
      }
      
      // METHOD 3c: Try to find maturity and rate anywhere in the row
      const maturityMatch = row.match(/(\d+)[\s\-]*(month|year|m|y)s?/i);
      if (maturityMatch) {
        const maturityText = `${maturityMatch[1]} ${maturityMatch[2]}`;
        const maturity = normalizeMaturity(maturityText);
        
        if (maturity) {
          // Find all percentages in the row
          const rateMatches = row.matchAll(/(-?\d+\.?\d*)\s*%/g);
          for (const rateMatch of rateMatches) {
            const rateValue = parseFloat(rateMatch[1]);
            if (addYield(maturity, rateValue)) {
              break; // Use first valid rate for this maturity
            }
          }
        }
      }
    }
    
    console.log(`Parsed ${yields.length} yields from HTML table (after METHOD 3)`);
  }
  
  // METHOD 4: Parse HTML text content (always try, not just if empty)
  if (html) {
    // Look for any text content that matches maturity + rate pattern
    const htmlText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    
    // Multiple patterns to catch different formats
    const htmlPatterns = [
      // Standard: "1 month -0.290%"
      /(\d+)\s+(month|year|m|y)s?[^\d]*?(-?\d+\.?\d*)\s*%/gi,
      // With colon: "1 month: -0.290%"
      /(\d+)\s+(month|year|m|y)s?[:\-]\s*(-?\d+\.?\d*)\s*%/gi,
      // Very flexible: any number + unit + any text + percentage
      /(\d+)\s*(month|year|m|y)s?[^%]*?(-?\d+\.?\d*)\s*%/gi,
    ];
    
    for (const pattern of htmlPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(htmlText)) !== null) {
        const num = match[1];
        const unit = match[2];
        const maturityText = `${num} ${unit}`;
        const rateValue = parseFloat(match[3]);
        const maturity = normalizeMaturity(maturityText);
        if (maturity && !isNaN(rateValue)) {
          addYield(maturity, rateValue);
        }
      }
    }
    
    console.log(`Parsed ${yields.length} yields total (after METHOD 4)`);
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
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html'],
        onlyMainContent: false, // Get full content to ensure we capture the table
        waitFor: 3000, // Wait longer for dynamic content to load (especially for tables)
        timeout: 30000,
        // Try to get the table specifically
        includeTags: ['table', 'tbody', 'tr', 'td', 'th'],
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
    // Try to get markdown first, fallback to HTML if markdown is not available
    let markdown = data.data?.markdown || data.markdown || '';
    const html = data.data?.html || data.html || '';
    
    // If markdown is empty or too short, try to extract from HTML
    if (markdown.length < 500 && html.length > 0) {
      console.log(`Markdown too short (${markdown.length}), trying to extract from HTML...`);
      // Improved HTML to markdown conversion for tables
      let htmlMarkdown = html;
      
      // Extract table content more carefully
      const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi);
      if (tableMatch) {
        htmlMarkdown = tableMatch.map(table => {
          return table
            .replace(/<thead[^>]*>/gi, '\n')
            .replace(/<tbody[^>]*>/gi, '\n')
            .replace(/<tr[^>]*>/gi, '\n|')
            .replace(/<\/tr>/gi, '|')
            .replace(/<th[^>]*>/gi, '')
            .replace(/<\/th>/gi, '|')
            .replace(/<td[^>]*>/gi, '')
            .replace(/<\/td>/gi, '|')
            .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
            .replace(/\s*\|\s*/g, '|') // Normalize pipe spacing
            .replace(/\s+/g, ' '); // Normalize whitespace
        }).join('\n');
      } else {
        // Fallback: simple conversion
        htmlMarkdown = html
          .replace(/<table[^>]*>/gi, '\n|')
          .replace(/<\/table>/gi, '\n')
          .replace(/<tr[^>]*>/gi, '\n|')
          .replace(/<\/tr>/gi, '|')
          .replace(/<th[^>]*>/gi, '')
          .replace(/<\/th>/gi, '|')
          .replace(/<td[^>]*>/gi, '')
          .replace(/<\/td>/gi, '|')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ');
      }
      
      markdown = htmlMarkdown;
      console.log(`Converted HTML to markdown: ${markdown.length} chars`);
    }
    
    console.log(`Received ${markdown.length} chars markdown, ${html.length} chars HTML for ${countryName}`);
    
    // Log a sample of the markdown for debugging (first 3000 chars)
    if (markdown.length > 0) {
      console.log(`Markdown sample (first 3000 chars): ${markdown.substring(0, 3000)}`);
    }
    
    // Log HTML sample if available
    if (html.length > 0) {
      // Find table in HTML
      const tableMatch = html.match(/<table[^>]*>[\s\S]{0,2000}?<\/table>/i);
      if (tableMatch) {
        console.log(`HTML table sample (first table, 2000 chars): ${tableMatch[0].substring(0, 2000)}`);
      }
    }
    
    // Parse yield data from markdown and HTML (pass both for maximum coverage)
    const yields = parseYieldData(markdown.length > 0 ? markdown : '', html.length > 0 ? html : undefined);
    
    console.log(`Parsed ${yields.length} yields for ${countryName}:`, JSON.stringify(yields));
    
    // Always log detailed debug info
    const hasTable = markdown.includes('|') || html.includes('<table');
    const hasMonths = markdown.match(/\d+\s*month/i) || html.match(/\d+\s*month/i);
    const hasYears = markdown.match(/\d+\s*year/i) || html.match(/\d+\s*year/i);
    const hasPercentages = [...(markdown.match(/-?\d+\.?\d*\s*%/g) || []), ...(html.match(/-?\d+\.?\d*\s*%/g) || [])];
    const negativeRates = hasPercentages.filter(p => p.startsWith('-'));
    
    console.log(`Debug info for ${countryName}:`);
    console.log(`  - Has table: ${hasTable}`);
    console.log(`  - Has months: ${!!hasMonths}`);
    console.log(`  - Has years: ${!!hasYears}`);
    console.log(`  - Total percentages found: ${hasPercentages.length}`);
    console.log(`  - Negative rates found: ${negativeRates.length}`);
    console.log(`  - Markdown length: ${markdown.length}`);
    console.log(`  - HTML length: ${html.length}`);
    
    if (yields.length < 10) {
      console.warn(`Warning: Only ${yields.length} yields parsed for ${countryName}. Expected more based on percentages found.`);
    }
    
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
