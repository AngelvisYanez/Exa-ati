import { spawnSync } from "child_process";

process.env.ADMIN_EMAIL = "smoke.billing.1790710713898@test.local";
process.env.ADMIN_PASSWORD = "SmokeBilling123!";

const r = spawnSync(
  process.execPath,
  ["scripts/dev/smoke-admin-billing-crud.mjs", "http://localhost:3010"],
  { stdio: "inherit", env: process.env, cwd: process.cwd() }
);
process.exit(r.status ?? 1);
