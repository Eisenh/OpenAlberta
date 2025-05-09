// run_populate.js
import { processPackages } from './populate_supabase_docs.js';

// Set a limit for how many packages to process (optional)
const LIMIT = 3; // Start with a small number for testing

// Run the function and log the result
processPackages(LIMIT)
  .then(result => {
    console.log('Result:', result);
    if (result.success) {
      console.log('✅ Successfully populated the database!');
    } else {
      console.error('❌ Failed to populate the database:', result.message);
    }
  })
  .catch(error => {
    console.error('❌ Error running processPackages:', error);
  });
