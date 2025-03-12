import { exec, spawn } from "child_process";

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
    const vite = spawn("npx", ["vite"], {
      stdio: "inherit",
      shell: true,
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
