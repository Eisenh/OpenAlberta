import { supabase } from '../supabaseClient';

export async function validateCKANUrl(url: string): Promise<boolean> {
  // Ensure URL is well-formed and responds to CKAN's "site_read"
  try {
    const safeUrl = url.replace(/\/+$/, ''); // Remove trailing slash
    
    // Pass the request through our Edge Function proxy to avoid browser CORS blocks
    const proxyUrl = `${safeUrl}/api/3/action/site_read`;
    const { data: json, error } = await supabase.functions.invoke('ckan-proxy', {
        body: { url: proxyUrl }
    });

    if (error) return false;
    return json.success === true && json.result['site_title'] !== undefined;
  } catch (e) {
    return false;
  }
}