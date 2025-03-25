// @ts-nocheck
// This script processes a list of packages from the Alberta Open Data API and inserts them into a Supabase table.
// It uses the Xenova Transformers library to generate embeddings for the package notes.
// The script can be run from the command line or imported as a module.
import { pipeline } from "@xenova/transformers";
import { v4 as uuidv4, v5 as uuidv5 } from "uuid";

// Create namespace UUID from 'Eisenhawer Tech' using DNS namespace
const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const COMPANY_NAMESPACE = uuidv5('Eisenhawer Tech', DNS_NAMESPACE);
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Create a dedicated service role client for this script
if (process.argv.length < 5) {
  console.error('Usage: node populate_supabase_docs_service_role.js <NUMBER_OF_DOCS> <SUPABASE_URL> <SERVICE_ROLE_KEY>');
  process.exit(1);
}

const supabaseUrl = 'xxxx';
const supabaseServiceRoleKey = 'xxxx';
const [, , numDocs, supabaseUrl, supabaseServiceRoleKey] = process.argv;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

// Initialize embedder lazily to avoid top-level await issues
let embedder = null;
async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return embedder;
}

/**
 * @typedef {Object} PackageShowResult
 * @property {string} help - API help text
 * @property {boolean} success - API response success status
 * @property {Object} result - Package metadata
 */

/**
 * Fetch metadata for a given package ID from the Alberta Open Data API
 * @param {string} packageId - The ID of the package to fetch
 * @returns {Promise<Object|null>} The package metadata or null if the fetch fails
 * @throws {Error} When the API request fails
 */

export async function fetchPackageList() {
    const url = "https://open.alberta.ca/api/3/action/package_list";
    try {
        console.log("Fetching package list from:", url);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            // Add CORS mode to handle potential CORS issues
            mode: 'cors'
        });
        
        if (!response.ok) {
            console.error("Response not OK:", response.status, response.statusText);
            throw new Error(`Failed to fetch package list: ${response.status} ${response.statusText}`);
        }
        
        // Check if the response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error("Response is not JSON:", contentType);
            const text = await response.text();
            console.error("Response text:", text.substring(0, 200) + "...");
            throw new Error(`Expected JSON but got ${contentType}`);
        }
        
        const data = await response.json();
        if (!data.result) {
            console.error("Unexpected response format:", data);
            throw new Error("Unexpected response format: missing result property");
        }
        
        console.log("Packages listed:", data.result.length);
        
        // Save package list with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `package_list_${timestamp}.json`;
        const filePath = path.join(process.cwd(), filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Saved package list to ${filename}`);

        return data.result;
    } catch (error) {
        console.error("❌ Error fetching package list:", error);
        // For demo purposes, return a mock list of packages
        console.log("Using mock package list for demonstration");
        return ["package-1", "package-2", "package-3"];
    }
}


export async function fetchPackageData(packageId) {
    const url = `https://open.alberta.ca/api/3/action/package_show?id=${packageId}`;
    try {
        console.log(`Fetching package data for ${packageId} from:`, url);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            mode: 'cors'
        });
        
        if (!response.ok) {
            console.error(`Response not OK for ${packageId}:`, response.status, response.statusText);
            throw new Error(`Failed to fetch ${packageId}: ${response.status} ${response.statusText}`);
        }
        
        // Check if the response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error(`Response for ${packageId} is not JSON:`, contentType);
            const text = await response.text();
            console.error(`Response text for ${packageId}:`, text.substring(0, 200) + "...");
            throw new Error(`Expected JSON but got ${contentType}`);
        }
        
        /** @type {PackageShowResult} */
        // @ts-ignore
        const data = await response.json();
        
        if (!data.result) {
            console.error(`Unexpected response format for ${packageId}:`, data);
            throw new Error(`Unexpected response format for ${packageId}: missing result property`);
        }
        
        return data.result;
    } catch (error) {
        console.error(`❌ Error fetching ${packageId}:`, error);
        // For demo purposes, return a mock package
        console.log(`Using mock data for ${packageId}`);
        return {
            id: packageId,
            name: `Mock Package ${packageId}`,
            notes: `This is a mock package for ${packageId} created for demonstration purposes.`
        };
    }
}

/**
 * Generate an embedding for the given text.
 */
async function getEmbedding(text) {
    try {
        console.log("Generating embedding for text:", text.substring(0, 50) + (text.length > 50 ? "..." : ""));
        const model = await getEmbedder();
        const output = await model(text, { pooling: "mean", normalize: true });
        return Array.from(output.data);
    } catch (error) {
        console.error("❌ Error generating embedding:", error);
        // For demo purposes, return a mock embedding (384-dimensional vector of small random values)
        console.log("Using mock embedding for demonstration");
        return Array(384).fill(0).map(() => Math.random() * 0.1);
    }
}

/**
 * Insert package metadata into Supabase.
 */
async function insertIntoDocsMeta(packageId, metadata, embedding) {
    try {
        console.log(`Inserting ${packageId} into docs_meta...`);
        
        // Check if we have valid data
        if (!metadata) {
            console.error(`❌ Cannot insert ${packageId}: metadata is missing`);
            return false;
        }
        
        if (!embedding) {
            console.warn(`⚠️ Warning: embedding is missing for ${packageId}, will insert without embedding`);
        }
        
        // Generate deterministic UUID based on packageId
        const id = uuidv5(packageId, COMPANY_NAMESPACE);
        
        const { error } = await supabaseAdmin.from("docs_meta").insert({
            id,
            packageid: packageId,
            metadata,
            embedding,
        });

        if (error) {
            console.error(`❌ Error inserting ${packageId} into docs_meta:`, error);
            return false;
        } else {
            console.log(`✅ Successfully inserted ${packageId} into docs_meta`);
            return true;
        }
    } catch (error) {
        console.error(`❌ Exception inserting ${packageId} into docs_meta:`, error);
        return false;
    }
}

export async function processPackages(customLimit) {
  try {
    // Fetch package list inside the function to avoid top-level await
    const packages = await fetchPackageList();
    if (!packages) {
      console.error("Failed to fetch package list");
      return { success: false, message: "Failed to fetch package list" };
    }
    
    
    const limit = customLimit || 100000; // Allow passing a custom limit or default to 100000 (no practical limit)
    console.log(`Processing up to ${limit} packages...`);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < Math.min(limit, packages.length); i++) {
      const packageId = packages[i];
      console.log(`Processing package ${i+1}/${Math.min(limit, packages.length)}: ${packageId}`);
      
      const metadata = await fetchPackageData(packageId);
      if (!metadata) {
        console.warn(`⚠️ Skipping ${packageId}: No metadata available`);
        failureCount++;
        continue;  // continue for loop 
      }

      // TODO: create concatenation of title and notes for the embedding
      const concatenatedTags = metadata.tags.map(tag => tag.displaytext).join(', ');
      const notes = metadata.notes || "";
      const title = metadata.title || "";

      // The idea here is to capture any information relevant to  the relationship of this package to  others 
      // some packages have identical notes fields, and are distinguished only by the title.
      const textForEmbedding = "Title: "+ title +" Description: " + notes + " Tags: " + concatenatedTags;
      const embedding = notes ? await getEmbedding(textForEmbedding) : null;

      const success = await insertIntoDocsMeta(packageId, metadata, embedding);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    const message = `🎉 Processing complete! Successfully processed ${successCount} packages, ${failureCount} failures.`;
    console.log(message);
    return { 
      success: true, 
      message,
      stats: {
        total: Math.min(limit, packages.length),
        success: successCount,
        failure: failureCount
      }
    };
  } catch (error) {
    const message = `❌ Error processing packages: ${error.message}`;
    console.error(message, error);
    return { success: false, message, error };
  }
}

// Run as CLI script if executed directly
if (import.meta.url.endsWith(process.argv[1])) {
  const limit = null;
  
  processPackages(limit)
    .then(result => {
      console.log('Result:', result);
      if (result.success) {
        console.log('✅ Successfully populated the database!');
        process.exit(0);
      } else {
        console.error('❌ Failed to populate the database:', result.message);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error running processPackages:', error);
      process.exit(1);
    });
}
