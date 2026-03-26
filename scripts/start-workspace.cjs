const { spawn } = require("child_process");
const path = require("path");

const workspaceRoot = __dirname ? path.resolve(__dirname, "..") : process.cwd();

function spawnPnpm(args, label) {
  const isWindows = process.platform === "win32";
  const command = isWindows ? process.env.ComSpec || "cmd.exe" : "pnpm";
  const finalArgs = isWindows ? ["/d", "/s", "/c", "pnpm", ...args] : args;

  const child = spawn(command, finalArgs, {
    cwd: workspaceRoot,
    env: process.env,
    shell: false,
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`Failed to start ${label}:`, error.message);
  });

  return child;
}

function main() {
  const appArgs = process.argv.slice(2);
  if (appArgs[0] === "--") {
    appArgs.shift();
  }

  const apiChild = spawnPnpm(
    ["--filter", "@workspace/api-server", "run", "dev"],
    "API server",
  );

  const appChild = spawnPnpm(
    ["--filter", "@workspace/agri-advisor", "run", "start", "--", ...appArgs],
    "Expo app",
  );

  let shuttingDown = false;

  function shutdown(exitCode) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    for (const child of [apiChild, appChild]) {
      if (child && !child.killed) {
        child.kill("SIGTERM");
      }
    }

    process.exit(exitCode);
  }

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => shutdown(0));
  }

  apiChild.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal || code) {
      console.error("API server stopped unexpectedly.");
    }

    shutdown(code ?? 0);
  });

  appChild.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal || code) {
      console.error("Expo app stopped unexpectedly.");
    }

    shutdown(code ?? 0);
  });
}

main();
