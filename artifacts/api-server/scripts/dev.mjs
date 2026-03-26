import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runNode(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: projectRoot,
      env,
      stdio: "inherit",
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Process terminated with signal ${signal}`));
        return;
      }

      resolve(code ?? 1);
    });

    child.on("error", reject);
  });
}

async function main() {
  const env = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT || "3000",
  };

  const buildCode = await runNode(["./build.mjs"], env);
  if (buildCode !== 0) {
    process.exit(buildCode);
  }

  const startCode = await runNode(["./scripts/start.mjs"], env);
  process.exit(startCode);
}

main().catch((error) => {
  console.error("API dev failed:", error.message);
  process.exit(1);
});
