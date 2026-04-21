import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: existingDocs, error } = await supabase
        .from('docs_meta')
        .select('packageid, metadata->metadata_modified')
        .limit(2);
    console.log(existingDocs);
    console.log(error);
}
run();
