import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, extname } from "path";

const root = "src/app/(app)";
const replacements = [
  // Unify page shells to full-bleed ui-page (no max-width caps)
  [
    /<main className="p-3 flex-1 flex flex-col gap-[456] w-full">/g,
    '<main className="ui-page flex-1">',
  ],
  [
    /<main className="p-5 flex-1 flex flex-col gap-5 w-full">/g,
    '<main className="ui-page flex-1">',
  ],
  [
    /<main className="p-6 w-full">/g,
    '<main className="ui-page flex-1">',
  ],
  [
    /<main className="p-3 flex-1 flex flex-col gap-5 w-full">/g,
    '<main className="ui-page flex-1">',
  ],
  [
    /max-w-4xl xl:max-w-5xl/g,
    "max-w-6xl 2xl:max-w-[1600px]",
  ],
  [/max-w-7xl mx-auto/g, "w-full"],
  [/max-w-7xl w-full mx-auto/g, "w-full"],
  [/max-w-\[1440px\] mx-auto/g, "w-full"],
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (extname(name) === ".tsx") out.push(p);
  }
  return out;
}

let n = 0;
for (const file of walk(root)) {
  const src = readFileSync(file, "utf8");
  let next = src;
  for (const [re, to] of replacements) next = next.replace(re, to);
  if (next !== src) {
    writeFileSync(file, next);
    n++;
    console.log(file);
  }
}
console.log("updated", n);
