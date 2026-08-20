import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextCommand = process.argv[2] ?? "dev";
const title = nextCommand === "start"
  ? "Signal Board - production"
  : "Signal Board - dev server";
const nextBin = require.resolve("next/dist/bin/next");

function keepConsoleTitle() {
  process.title = title;
}

keepConsoleTitle();
const titleTimer = setInterval(keepConsoleTitle, 250);
const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

function forwardSignal(signal) {
  if (!child.killed) child.kill(signal);
}

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));
child.on("exit", (code, signal) => {
  clearInterval(titleTimer);
  process.exitCode = code ?? (signal ? 1 : 0);
});
