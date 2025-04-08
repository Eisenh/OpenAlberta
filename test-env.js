// Use dotenv with an explicit path and debug mode
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Log the current directory and check if .env exists
const envPath = resolve(__dirname, '.env');
console.log('Current directory:', __dirname);
console.log('.env file exists:', fs.existsSync(envPath));

// Try to load with explicit path
const result = config({ 
  path: envPath,
  debug: true // Enable debug mode to see what's happening
});

console.log('Dotenv config result:', result);
console.log('\nEnvironment variables test:');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL || 'Not defined');
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'Defined (value hidden)' : 'Not defined');
console.log('All environment variables:', Object.keys(process.env).filter(key => key.startsWith('VITE_')));

// Let's also try to read the .env file directly to see its content
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('\n.env file content (first line):', envContent.split('\n')[0]);
} catch (error) {
  console.error('Error reading .env file:', error);
}
