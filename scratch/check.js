import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { pipeline } from '@huggingface/transformers';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('get_table_info', {}); // Or query info_schema
  // Just fetch 1 embedding
  const { data: eData } = await supabase.from('docs_meta').select('embedding').limit(1);
  if (eData && eData.length > 0) {
    let emb = eData[0].embedding;
    if (typeof emb === 'string') {
      try { emb = JSON.parse(emb); } catch(e) { emb = emb.split(','); }
    }
    console.log("DB Embedding Length:", emb.length);
  }
run();
