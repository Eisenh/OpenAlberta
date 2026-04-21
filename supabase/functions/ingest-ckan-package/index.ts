// Edge Function to securely ingest CKAN metadata from authorized maintainers.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Auth Header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace('Bearer ', '');
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const basePayload = await req.json();
    let dataSourceId = basePayload.dataSourceId;
    let packagesToIngest: any[] = [];
    
    if (Array.isArray(basePayload.packages)) {
        packagesToIngest = basePayload.packages;
    } else {
        packagesToIngest = [basePayload];
        dataSourceId = basePayload.dataSourceId;
    }

    if (!dataSourceId || packagesToIngest.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required payload fields or empty batch." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Verify Maintainer Status
    const { data: isMaintainer } = await adminSupabase
      .from('data_source_maintainers')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('data_source_id', dataSourceId)
      .single();

    // Check if admin as fallback
    const { data: isAdmin } = await adminSupabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single();

    if (!isMaintainer && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Not an authorized maintainer or admin for this data source." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Rate Limiting Check (Max 10,000 per hour limit for users doing bulk)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await adminSupabase
      .from('ckan_package_manifest')
      .select('*', { count: 'exact', head: true })
      .eq('data_source_id', dataSourceId)
      .eq('status', 'ingested')
      .gte('ingested_at', oneHourAgo);

    if (!countErr && count !== null && (count + packagesToIngest.length) >= 20000) {
      if (!isAdmin) {
         return new Response(JSON.stringify({ error: "Rate limit reached. Data Source ingested maximum of 20,000 packages per hour." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 3. Prepare Bulk Insert Arrays
    const docsMetaInsert = packagesToIngest.map(pkg => ({
         id: pkg.metadata.id, 
         package_id: pkg.packageId || pkg.package_id, 
         data_source_id: dataSourceId,
         url: pkg.ckanPageUrl || pkg.url,
         metadata: pkg.metadata,
         embedding: pkg.embedding
    }));

    const manifestInsert = packagesToIngest.map(pkg => ({
         data_source_id: dataSourceId,
         package_id: pkg.packageId || pkg.package_id,
         status: 'ingested',
         ingested_at: new Date().toISOString()
    }));

    // 4. Upsert successful - Write to vectors table
    const { error: insertErr } = await adminSupabase
      .from('docs_meta')
      .upsert(docsMetaInsert);

    if (insertErr) {
       console.error("Insert Error", insertErr);
       return new Response(JSON.stringify({ error: "Database insert failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 5. Update manifest!
    await adminSupabase
      .from('ckan_package_manifest')
      .upsert(manifestInsert, { onConflict: 'data_source_id,package_id' });

    return new Response(JSON.stringify({ success: true, processed: packagesToIngest.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
