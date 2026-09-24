import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, extname } from "path";

const roots = ["src/app", "src/components"];
const exts = new Set([".tsx", ".ts", ".jsx", ".css"]);

const replacements = [
  [/bg-success-pale0/g, "bg-success"],
  [/bg-success-pale5/g, "bg-success"],
  [/text-red-800/g, "text-brand-red"],
  [/bg-red-500/g, "bg-brand-red"],
  [/bg-purple-50\/80/g, "bg-brand-gray-100/80"],
  [/text-purple-800/g, "text-brand-gray-700"],
  [/border-purple-200/g, "border-brand-gray-200"],
  [/bg-purple-500/g, "bg-brand-gray-500"],
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
for (const root of roots) {
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    let next = src;
    for (const [re, to] of replacements) next = next.replace(re, to);
    if (next !== src) {
      writeFileSync(file, next);
      filesChanged += 1;
      console.log(file);
    }
  }
}
console.log("fixed", filesChanged);
