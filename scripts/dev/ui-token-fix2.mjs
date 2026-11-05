import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, extname } from "path";

const roots = ["src/app", "src/components"];
const exts = new Set([".tsx", ".ts"]);

const replacements = [
  [/hover:bg-blue-700/g, "hover:bg-brand-sky"],
  [/hover:bg-blue-100/g, "hover:bg-sky-100"],
  [/hover:bg-emerald-700/g, "hover:bg-success"],
  [/text-blue-900/g, "text-brand-sky"],
  [/text-blue-400/g, "text-brand-sky"],
  [/bg-blue-100/g, "bg-sky-100"],
  [/bg-blue-400/g, "bg-brand-sky"],
  [/border-emerald-300/g, "border-success-light/50"],
  [/border-emerald-400/g, "border-success-light"],
  [/bg-emerald-400/g, "bg-success-light"],
  [/text-emerald-500/g, "text-success"],
  [/text-emerald-400/g, "text-success-light"],
  // keep terminal green in admin pruebas as intentional console look — skip text-emerald-400 in dark panels by not overdoing
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (exts.has(extname(name))) out.push(p);
  }
  return out;
}

let n = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    // leave console-style emerald in admin pruebas terminal
    if (file.includes("admin\\pruebas") || file.includes("admin/pruebas")) continue;
    const src = readFileSync(file, "utf8");
    let next = src;
    for (const [re, to] of replacements) next = next.replace(re, to);
    if (next !== src) {
      writeFileSync(file, next);
      n++;
      console.log(file);
    }
  }
}
console.log("updated", n);
