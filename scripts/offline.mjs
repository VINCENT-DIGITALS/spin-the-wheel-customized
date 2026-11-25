import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = (await readdir("dist", { recursive: true, withFileTypes: true }))
  .filter((f) => f.isFile() && f.name !== "sw.js")
  .map((f) => `${f.parentPath}/${f.name}`);
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(file));
hash.update(await readFile("scripts/offline.mjs"));
const version = hash.digest("hex").slice(0, 16);
const paths = files.map((p) => "./" + p.replace(/^dist\//, ""));
await writeFile(
  "dist/sw.js",
  `const CACHE='heavenly-fate-${version}';const FILES=${JSON.stringify(paths)};self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('heavenly-fate-')&&key!==CACHE).map(key=>caches.delete(key))))));self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.open(CACHE).then(async cache=>{if(event.request.mode==='navigate')return (await cache.match('./index.html',{ignoreVary:true}))||fetch(event.request);return (await cache.match(event.request,{ignoreVary:true}))||fetch(event.request);}));});`,
);
console.log(
  `Offline cache generated for ${files.length} build assets (${version}).`,
);
