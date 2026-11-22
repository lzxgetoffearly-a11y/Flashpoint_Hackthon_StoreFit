// Loads KEY=value lines into process.env from the first file that exists:
//   agent/.env, then ~/flashpoint-hack/.env (where the hackathon starter keeps the wallet key).
// Values already set in the environment win. Nothing here is ever logged.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export function loadEnv() {
  const files = [path.join(here, ".env"), path.join(os.homedir(), "flashpoint-hack", ".env")];
  const used = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    used.push(f);
    for (const line of fs.readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return used;
}
