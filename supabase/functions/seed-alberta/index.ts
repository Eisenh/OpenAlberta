import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Insert seed data
    const { data: source, error: insertError } = await supabaseClient
      .from('data_sources')
      .upsert({
        ckan_url: 'https://open.alberta.ca',
        display_name: 'Alberta Open Data',
        authority: 'Government of Alberta',
        country: 'CA',
        region: 'Alberta',
        is_approved: true,
        latitude: 53.9333,
        longitude: -116.5765
      }, { onConflict: 'ckan_url' })
      .select()
      .single()

    if (insertError) {
      console.error(insertError)
      return new Response(JSON.stringify({ error: insertError }), { status: 500 })
    }

    // 2. Update legacy records
    const { error: updateError } = await supabaseClient
      .from('docs_meta')
      .update({ data_source_id: source.id })
      .is('data_source_id', null)

    if (updateError) {
      console.error(updateError)
      return new Response(JSON.stringify({ error: updateError }), { status: 500 })
    }

    return new Response(
      JSON.stringify({ message: 'Success', sourceId: source.id }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})
