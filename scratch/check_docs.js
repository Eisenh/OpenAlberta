import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { count: docsCount, error: err1 } = await supabase.from('docs').select('*', { count: 'exact', head: true });
    console.log('Docs Count:', docsCount, err1 ? err1.message : '');

    const { count: docsMetaCount, error: err2 } = await supabase.from('docs_meta').select('*', { count: 'exact', head: true });
    console.log('Docs Meta Count:', docsMetaCount, err2 ? err2.message : '');
    
    // check an embedding from both to see length and content
    const { data } = await supabase.from('docs_meta').select('id, metadata').limit(1);
      console.log('Sample docs content:', JSON.stringify(data[0], null, 2));
  } catch (e) {}
}
run();
