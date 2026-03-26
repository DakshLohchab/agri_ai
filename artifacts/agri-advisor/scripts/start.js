const path = require("path");
const { spawn } = require("child_process");

function withOptionalEnv(env, key, value) {
  if (value) {
    env[key] = value;
  }
}

function buildExpoEnv() {
  const env = { ...process.env };

  withOptionalEnv(
    env,
    "EXPO_PACKAGER_PROXY_URL",
    process.env.EXPO_PACKAGER_PROXY_URL ||
      (process.env.REPLIT_EXPO_DEV_DOMAIN
        ? `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`
        : undefined),
  );

  withOptionalEnv(
    env,
    "EXPO_PUBLIC_DOMAIN",
    process.env.EXPO_PUBLIC_DOMAIN || process.env.REPLIT_DEV_DOMAIN,
  );

  withOptionalEnv(
    env,
    "EXPO_PUBLIC_REPL_ID",
    process.env.EXPO_PUBLIC_REPL_ID || process.env.REPL_ID,
  );

  withOptionalEnv(
    env,
    "REACT_NATIVE_PACKAGER_HOSTNAME",
    process.env.REACT_NATIVE_PACKAGER_HOSTNAME || process.env.REPLIT_DEV_DOMAIN,
  );

  return env;
}

function buildExpoArgs() {
  const forwardedArgs = process.argv.slice(2);
  if (forwardedArgs[0] === "--") {
    forwardedArgs.shift();
  }
  const args = ["exec", "expo", "start", "--localhost"];

  if (process.env.PORT) {
    args.push("--port", process.env.PORT);
  }

  return args.concat(forwardedArgs);
}

function main() {
  const expoArgs = buildExpoArgs();
  const isWindows = process.platform === "win32";
  const command = isWindows ? process.env.ComSpec || "cmd.exe" : "pnpm";
  const args = isWindows ? ["/d", "/s", "/c", "pnpm", ...expoArgs] : expoArgs;
  const child = spawn(command, args, {
    cwd: path.resolve(__dirname, ".."),
    env: buildExpoEnv(),
    shell: false,
    stdio: "inherit",
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      if (!child.killed) {
        child.kill(signal);
      }
    });
  }

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    console.error("Failed to start Expo:", error.message);
    process.exit(1);
  });
}

main();
