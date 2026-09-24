import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, extname } from "path";

const roots = ["src/app", "src/components"];
const exts = new Set([".tsx", ".ts", ".jsx", ".css"]);

const replacements = [
  [/bg-emerald-500/g, "bg-success"],
  [/bg-emerald-600/g, "bg-success"],
  [/bg-emerald-50\/90/g, "bg-success-pale/90"],
  [/bg-emerald-50/g, "bg-success-pale"],
  [/bg-emerald-100/g, "bg-success-pale"],
  [/border-emerald-200/g, "border-success-light/40"],
  [/text-emerald-800/g, "text-success"],
  [/text-emerald-700/g, "text-success"],
  [/text-emerald-600/g, "text-success"],
  [/hover:bg-emerald-100/g, "hover:bg-success-pale"],
  [/bg-blue-500/g, "bg-brand-sky"],
  [/bg-blue-600/g, "bg-brand-sky"],
  [/bg-blue-50\/90/g, "bg-sky-50/90"],
  [/bg-blue-50/g, "bg-sky-50"],
  [/border-blue-200/g, "border-sky-200"],
  [/text-blue-800/g, "text-brand-sky"],
  [/text-blue-700/g, "text-brand-sky"],
  [/text-blue-600/g, "text-brand-sky"],
  [/bg-red-50(?![\w-])/g, "bg-brand-red-subtle"],
  [/border-red-200/g, "border-brand-red-pale"],
  [/text-red-700/g, "text-brand-red"],
  [/text-red-600/g, "text-brand-red"],
  [/\/exa-ati\.png/g, "/exa-ati-light.png"],
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

let filesChanged = 0;
let totalRepl = 0;

for (const root of roots) {
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    let next = src;
    let local = 0;
    for (const [re, to] of replacements) {
      next = next.replace(re, (...args) => {
        local += 1;
        return to;
      });
    }
    if (next !== src) {
      writeFileSync(file, next);
      filesChanged += 1;
      totalRepl += local;
      console.log(`${file}: ${local}`);
    }
  }
}

console.log(JSON.stringify({ filesChanged, totalRepl }));
