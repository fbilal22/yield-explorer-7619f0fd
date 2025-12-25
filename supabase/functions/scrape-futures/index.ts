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
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect start of futures table data by looking for contract pattern
    const contractMatch = line.match(/\[([A-Z]{2,3}\w+)\s*\(([^)]+)\)\]/);
    
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
      // Collect data values
      if (line.match(/^\d/) || line === 'unch' || line.startsWith('+') || line.startsWith('-') || line === '0' || line === '0.0000') {
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
  }
  
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
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000,
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
    console.log('Received markdown length:', markdown.length);
    
    const futures = parseFuturesFromMarkdown(markdown);
    console.log('Parsed futures count:', futures.length);

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
