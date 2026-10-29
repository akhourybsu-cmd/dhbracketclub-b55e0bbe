// The checked-in catalog is shared by isolated QA and the SQL seed. Runtime UI
// consumes the deployed catalog returned by the RPC, so stale clients stay safe.
import { readFile, writeFile } from "node:fs/promises";
const file = "supabase/migrations/20261029040000_dh_feats.sql";
const catalog = JSON.parse(
  await readFile("src/lib/feats/catalog.json", "utf8"),
);
const ids = new Set();
for (const f of catalog) {
  if (
    ids.has(f.key) ||
    f.thresholds.length !== f.points.length ||
    f.thresholds.some((n, i) => n <= 0 || (i > 0 && n <= f.thresholds[i - 1]))
  )
    throw new Error("Invalid feat " + f.key);
  ids.add(f.key);
}
const seed = `insert into public.dh_feat_catalog select * from jsonb_populate_recordset(null::public.dh_feat_catalog, $catalog$${JSON.stringify(catalog)}$catalog$::jsonb)
on conflict(key) do update set category=excluded.category,title=excluded.title,description=excluded.description,thresholds=excluded.thresholds,points=excluded.points,kind=excluded.kind,unit=excluded.unit,sort_order=excluded.sort_order;`;
const sql = await readFile(file, "utf8");
await writeFile(
  file,
  sql.replace(
    /-- BEGIN GENERATED CATALOG[\s\S]*?-- END GENERATED CATALOG/,
    "-- BEGIN GENERATED CATALOG\n" + seed + "\n-- END GENERATED CATALOG",
  ),
);
console.log(
  `${catalog.length} families, ${catalog.reduce((n, f) => n + f.thresholds.length, 0)} tier unlocks`,
);
