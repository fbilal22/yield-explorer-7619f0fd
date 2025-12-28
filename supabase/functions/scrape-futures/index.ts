const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FuturesData {
  contract: string;
  contractUrl: string;
  latest: number | null;
  change: number | null;
  changePercent: string;
  open: number | null;
  high: number | null;
  low: number | null;
  previous: number | null;
  volume: number | null;
  openInt: number | null;
  time: string;
}

function parseNumber(value: string): number | null {
  if (!value || value === 'N/A' || value === '-' || value === 'unch') return null;
  // Remove 's' suffix (for settlement price indicator) and commas
  const cleaned = value.replace(/s$/, '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseChange(value: string): { change: number | null; isUnch: boolean } {
  if (!value || value === 'unch') return { change: null, isUnch: value === 'unch' };
  const cleaned = value.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return { change: isNaN(num) ? null : num, isUnch: false };
}

function parseFuturesFromMarkdown(markdown: string): FuturesData[] {
  const results: FuturesData[] = [];
  const lines = markdown.split('\n');
  
  let inTable = false;
  let currentContract: Partial<FuturesData> | null = null;
  let dataBuffer: string[] = [];
  
  // Improved contract pattern - more flexible to handle various formats
  // Pattern 1: [SYMBOL (Date)] or [SYMBOL(Date)]
  // Pattern 2: SYMBOL (Date) without brackets
  const contractPatterns = [
    /\[([A-Z0-9]{2,6}\w*)\s*\(([^)]+)\)\]/,  // [SQZ25 (Dec 2025)]
    /([A-Z0-9]{2,6}\w*)\s*\(([^)]+)\)/,      // SQZ25 (Dec 2025)
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Try to match contract patterns
    let contractMatch = null;
    for (const pattern of contractPatterns) {
      contractMatch = line.match(pattern);
      if (contractMatch) break;
    }
    
    if (contractMatch) {
      // Save previous contract if exists
      if (currentContract && dataBuffer.length >= 8) {
        const [latest, change, open, high, low, previous, volume, openInt, time] = dataBuffer;
        const changeResult = parseChange(change);
        
        results.push({
          contract: currentContract.contract!,
          contractUrl: currentContract.contractUrl || '',
          latest: parseNumber(latest),
          change: changeResult.change,
          changePercent: changeResult.isUnch ? 'unch' : (changeResult.change !== null ? (changeResult.change >= 0 ? '+' : '') + changeResult.change.toFixed(4) : ''),
          open: parseNumber(open),
          high: parseNumber(high),
          low: parseNumber(low),
          previous: parseNumber(previous),
          volume: parseNumber(volume),
          openInt: parseNumber(openInt),
          time: time || '',
        });
      } else if (currentContract && dataBuffer.length > 0) {
        // Log incomplete contracts for debugging
        console.warn(`Incomplete contract data for ${currentContract.contract}: only ${dataBuffer.length} values found (expected 8+)`);
      }
      
      // Start new contract
      const urlMatch = line.match(/\(https:\/\/[^)]+\)/);
      currentContract = {
        contract: `${contractMatch[1]} (${contractMatch[2]})`,
        contractUrl: urlMatch ? urlMatch[0].slice(1, -1) : '',
      };
      dataBuffer = [];
      inTable = true;
    } else if (inTable && currentContract && line && !line.startsWith('[') && !line.startsWith('#') && !line.includes('Latest futures')) {
      // Collect data values - more flexible pattern matching
      if (line.match(/^\d/) || line === 'unch' || line.startsWith('+') || line.startsWith('-') || line === '0' || line === '0.0000' || line.match(/^-?\d+\.\d+/)) {
        dataBuffer.push(line);
      }
    }
  }
  
  // Don't forget the last contract
  if (currentContract && dataBuffer.length >= 8) {
    const [latest, change, open, high, low, previous, volume, openInt, time] = dataBuffer;
    const changeResult = parseChange(change);
    
    results.push({
      contract: currentContract.contract!,
      contractUrl: currentContract.contractUrl || '',
      latest: parseNumber(latest),
      change: changeResult.change,
      changePercent: changeResult.isUnch ? 'unch' : (changeResult.change !== null ? (changeResult.change >= 0 ? '+' : '') + changeResult.change.toFixed(4) : ''),
      open: parseNumber(open),
      high: parseNumber(high),
      low: parseNumber(low),
      previous: parseNumber(previous),
      volume: parseNumber(volume),
      openInt: parseNumber(openInt),
      time: time || '',
    });
  } else if (currentContract && dataBuffer.length > 0) {
    console.warn(`Last contract incomplete: ${currentContract.contract} with only ${dataBuffer.length} values`);
  }
  
  console.log(`Parsed ${results.length} futures contracts from markdown`);
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    const futuresSymbol = symbol || 'SQZ25';
    const url = `https://www.barchart.com/futures/quotes/${futuresSymbol}/futures-prices?viewName=main`;

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping futures URL:', url);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html', 'extract'],
        onlyMainContent: false,
        waitFor: 10000, // Increased from 3000ms to allow dynamic content to load
        timeout: 60000, // 60 seconds timeout
        // Use LLM extraction to get structured futures data
        extract: {
          schema: {
            type: 'object',
            properties: {
              futures: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    contract: { type: 'string', description: 'Contract name like "SQZ25 (Dec 2025)"' },
                    latest: { type: 'number', description: 'Latest price' },
                    change: { type: 'number', description: 'Price change (can be negative)' },
                    open: { type: 'number', description: 'Opening price' },
                    high: { type: 'number', description: 'High price' },
                    low: { type: 'number', description: 'Low price' },
                    previous: { type: 'number', description: 'Previous close price' },
                    volume: { type: 'number', description: 'Trading volume' },
                    openInt: { type: 'number', description: 'Open interest' },
                    time: { type: 'string', description: 'Time of last trade' }
                  }
                },
                description: 'List of futures contracts with their prices and trading data'
              }
            }
          },
          prompt: 'Extract all futures contracts data from the futures prices table. Include contract names, latest prices, changes, open/high/low/previous prices, volume, open interest, and time of last trade.'
        }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = data.data?.markdown || data.markdown || '';
    const html = data.data?.html || data.html || '';
    console.log('Received markdown length:', markdown.length);
    console.log('Received HTML length:', html.length);
    
    // First, try to use extracted data if available (LLM extraction)
    const extractedData = data.data?.extract || data.extract;
    let futures: FuturesData[] = [];
    
    if (extractedData?.futures && Array.isArray(extractedData.futures)) {
      console.log(`Using LLM extracted data: ${extractedData.futures.length} futures contracts`);
      for (const item of extractedData.futures) {
        if (item.contract) {
          futures.push({
            contract: item.contract,
            contractUrl: '',
            latest: item.latest ?? null,
            change: item.change ?? null,
            changePercent: item.change !== null && item.change !== undefined 
              ? (item.change >= 0 ? '+' : '') + item.change.toFixed(4) 
              : 'unch',
            open: item.open ?? null,
            high: item.high ?? null,
            low: item.low ?? null,
            previous: item.previous ?? null,
            volume: item.volume ?? null,
            openInt: item.openInt ?? null,
            time: item.time || '',
          });
        }
      }
    }
    
    // If LLM extraction didn't work or returned no data, fall back to parsing markdown
    if (futures.length === 0) {
      console.log('LLM extraction failed or returned no data, falling back to markdown parsing...');
      futures = parseFuturesFromMarkdown(markdown);
      console.log('Parsed futures count from markdown:', futures.length);
      
      // Log sample of markdown for debugging if no futures found
      if (futures.length === 0 && markdown.length > 0) {
        console.log('Sample markdown (first 1000 chars):', markdown.substring(0, 1000));
        console.warn('WARNING: No futures contracts parsed from markdown. This may indicate a parsing issue or format change.');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: futures,
        symbol: futuresSymbol,
        scrapedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping futures:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape futures';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
