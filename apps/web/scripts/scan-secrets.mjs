/**
 * node scripts/scan-secrets.mjs — scans tracked and new files in the
 * repository for credential-shaped text. Prints locations and pattern names
 * only; exits 1 on any finding or on any committed .env file.
 */
import { fileURLToPath } from "node:url";
import { envFiles, repoFiles, scan } from "./lib/secretScan.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const files = repoFiles(root);
const env = envFiles(files);
const findings = await scan(root, files);
for (const f of env) console.log(`ENV FILE IN REPOSITORY: ${f}`);
for (const f of findings) console.log(`${f.file}:${f.line}  ${f.pattern}`);
console.log(
  `Scanned ${files.length} files: ${findings.length} finding(s), ${env.length} env file(s).`,
);
if (findings.length || env.length) process.exitCode = 1;
