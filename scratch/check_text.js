import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching matching document...");
  const { data, error } = await supabase.from('docs_meta')
    .select('id, package, metadata')
    .ilike('metadata->>title', '%System wide Program completions%')
    .limit(1);
    
  if (data && data.length > 0) {
    console.log("Document found!");
    console.log(JSON.stringify(data[0].metadata, null, 2));
  } else {
    console.log("Could not find document:", error);
  }
}
run();

