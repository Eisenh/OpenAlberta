

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { url } = await req.json();

        if (!url) {
            return new Response(JSON.stringify({ error: "No URL provided" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        console.log(`Proxying request to ${url}`);
        
        // Fetch from target site (bypassing browser CORS)
        const proxyResponse = await fetch(url, {
           method: "GET",
           headers: {
               "User-Agent": "OpenDataABOnline Proxy/1.0"
           }
        });

        if (!proxyResponse.ok) {
           throw new Error(`Proxy target returned ${proxyResponse.status}`);
        }

        const data = await proxyResponse.json();

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
