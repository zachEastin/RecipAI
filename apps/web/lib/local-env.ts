import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

function applyEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }

  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator < 1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();

    if (process.env[key]) {
      continue;
    }

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

export function loadLocalEnv(): void {
  if (loaded) {
    return;
  }

  const appRoot = process.cwd();
  const repoRoot = resolve(appRoot, "../..");
  process.env.RECIPAI_WORKSPACE_ROOT ??= repoRoot;

  for (const file of [".env.local", ".env"]) {
    applyEnvFile(resolve(repoRoot, file));
    applyEnvFile(resolve(appRoot, file));
  }

  loaded = true;
}
