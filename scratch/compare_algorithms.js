import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@huggingface/transformers';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Loading model...");
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'fp32' });
  
  const queries = ["ai", "artificial intelligence"];
  
  for (const q of queries) {
    console.log(`\n\n=== RESULTS FOR: "${q}" ===`);
    
    // 1. Vector Search
    console.log("\n--- Vector Search ---");
    const output = await extractor(q, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(output.data);
    const { data: vData } = await supabase.rpc('match_vectors_meta', {
      query_embedding: queryVector,
      match_threshold: 0.1, // super low to get anything
      match_count: 5,
    });
    if (vData) {
      vData.forEach((row, i) => {
        console.log(`[${i+1}] (Sim: ${row.similarity.toFixed(4)}) - ${row.metadata.title}`);
      });
    }

    // 2. Exact Lexical Fallback (the old way Svelte did it)
    console.log("\n--- Lexical Fallback (ilike %query%) ---");
    const { data: tData } = await supabase.from('docs_meta')
      .select('metadata')
      .or(`metadata->>title.ilike.%${q}%,metadata->>description.ilike.%${q}%,metadata->>notes.ilike.%${q}%`)
      .limit(5);
    if (tData) {
      tData.forEach((row, i) => {
        console.log(`[${i+1}] ${row.metadata.title}`);
      });
    } else {
        console.log("No results or timed out.");
    }

    // 3. PostgreSQL Full Text Search (Proper lexical)
    if (q.length > 3) {
      console.log("\n--- Proper PostgreSQL Full Text Search ---");
      const tsQuery = q.split(' ').join(' & ');
      const { data: ftsData } = await supabase.from('docs_meta')
        .select('metadata')
        .textSearch('metadata->>title', `'${tsQuery}'`)
        .limit(5);
      if (ftsData) {
        ftsData.forEach((row, i) => {
          console.log(`[${i+1}] ${row.metadata.title}`);
        });
      }
    }
  }
}
run();
