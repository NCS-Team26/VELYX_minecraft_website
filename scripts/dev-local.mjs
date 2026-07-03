import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];

function start(name, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    shell: process.platform === "win32" && command === npmCommand,
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.push(child);

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    process.stderr.write(`[${name}] exited with ${signal || code}\n`);
    shutdown(code || 1);
  });

  return child;
}

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(code), 250);
}

start("auth", process.execPath, ["server/auth/local-server.mjs"]);
start("site", npmCommand, ["run", "dev"], {
  VITE_AUTH_API_BASE: process.env.VITE_AUTH_API_BASE || "http://127.0.0.1:4174",
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
