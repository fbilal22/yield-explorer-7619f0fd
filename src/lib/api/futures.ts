import { supabase } from '@/integrations/supabase/client';
import { FuturesResponse } from '@/types/futures';

export async function scrapeFutures(symbol: string = 'SQZ25'): Promise<FuturesResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('scrape-futures', {
      body: { symbol },
    });

    if (error) {
      console.error('Error calling scrape-futures:', error);
      return { success: false, error: error.message };
    }

    return data as FuturesResponse;
  } catch (err) {
    console.error('Error in scrapeFutures:', err);
    return { success: false, error: 'Failed to fetch futures data' };
  }
}
