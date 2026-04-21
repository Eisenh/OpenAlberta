import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: sources } = await supabase.from('data_sources').select('*');
  console.log('Sources:', sources);
  const { count } = await supabase.from('docs_meta').select('*', { count: 'exact', head: true });
  console.log('Docs Count:', count);
  const { data: mapped } = await supabase.from('docs_meta').select('data_source_id').limit(1);
  console.log('Mapped:', mapped);
}
run();
