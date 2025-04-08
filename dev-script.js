import { exec, spawn } from "child_process";
import "dotenv/config"; // This will load environment variables from .env file

// Function to kill process on port 5173
function killPort() {
  return new Promise((resolve) => {
    console.log("Attempting to kill any process on port 5173...");

    exec("npx kill-port 5173", (error, stdout, stderr) => {
      if (error) {
        console.log(
          "No process running on port 5173 or failed to kill process"
        );
      } else {
        console.log("Successfully killed process on port 5173");
      }
      // Resolve in either case
      resolve();
    });
    exec("npx kill-port 5174", (error, stdout, stderr) => {
      if (error) {
        console.log(
          "No process running on port 5174 or failed to kill process"
        );
      } else {
        console.log("Successfully killed process on port 5174");
      }
      // Resolve in either case
      resolve();
    });
  });
}

// Main function
async function startDev() {
  try {
    // First try to kill any process on port 5173
    await killPort();

    // Wait a bit to ensure port is released
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Start Vite
    console.log("Starting Vite dev server...");
    
    // Log environment variables to confirm they're loaded (will show in terminal)
    console.log("Loaded environment variables:");
    console.log("VITE_SUPABASE_URL:", process.env.VITE_SUPABASE_URL ? "✓ Defined" : "✗ Undefined");
    console.log("VITE_SUPABASE_ANON_KEY:", process.env.VITE_SUPABASE_ANON_KEY ? "✓ Defined" : "✗ Undefined");
    
    // Pass environment variables to the Vite process
    const vite = spawn("npx", ["vite"], {
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env, // Include all existing environment variables
      }
    });

    // Handle process exit
    vite.on("close", (code) => {
      console.log(`Vite process exited with code ${code}`);
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the main function
startDev();
