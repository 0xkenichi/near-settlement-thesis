// One command rebuilds everything from raw data:  node rebuild.mjs
//   1. downloads every source in web/metrics.mjs into data/raw/ (no API keys needed)
//   2. computes every number into data/metrics.json
//   3. redraws every chart into charts/*.svg
// `node rebuild.mjs --offline` skips step 1 and reuses the saved raw files.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { SOURCES, compute } from "./web/metrics.mjs";
import { CHARTS } from "./web/charts.mjs";

const offline = process.argv.includes("--offline");
await mkdir("data/raw", { recursive: true });
await mkdir("charts", { recursive: true });

const raw = {};
const manifest = {};
for (const [key, { url }] of Object.entries(SOURCES)) {
  const file = `data/raw/${key}.json`;
  if (offline) {
    raw[key] = JSON.parse(await readFile(file, "utf8"));
    continue;
  }
  const res = await fetch(url, { headers: { "User-Agent": "near-thesis-rebuild/1.0" } });
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status} from ${url}`);
  const text = await res.text();
  raw[key] = JSON.parse(text);
  await writeFile(file, text);
  manifest[key] = { url, fetchedAt: new Date().toISOString(), bytes: text.length };
  console.log(`fetched ${key} (${(text.length / 1024).toFixed(0)} KB)`);
}
if (!offline) await writeFile("data/raw/manifest.json", JSON.stringify(manifest, null, 2));

const m = compute(raw);
await writeFile("data/metrics.json", JSON.stringify(m, null, 2));
// The dashboard's fallback when the live sources can't be reached.
await writeFile("web/metrics.json", JSON.stringify(m));

for (const chart of CHARTS) {
  await writeFile(`charts/${chart.id}.svg`, chart.svg(m));
}

const h = m.headline;
console.log(`
data through ${m.dataThrough.chain} (chain), ${m.dataThrough.intentsVolume} (Intents); months ${m.baseMonth}..${m.lastFullMonth}
transactions/day   ${h.txnsPerDay.base} -> ${h.txnsPerDay.last} (${h.txnsPerDay.changePct}%)
active accounts/day ${h.activePerDay.base} -> ${h.activePerDay.last} (${h.activePerDay.changePct}%)
Intents volume/month $${(h.intentsVolume.base / 1e6).toFixed(1)}M -> $${(h.intentsVolume.last / 1e9).toFixed(2)}B (x${h.intentsVolume.multiple})
price (monthly avg) $${h.price.base} -> $${h.price.last} (${h.price.changePct}%)
correlation with price (levels / changes), ${m.correlation.months} months:
  Intents volume  ${m.correlation.intentsVolume.levels} / ${m.correlation.intentsVolume.changes}
  transactions    ${m.correlation.txns.levels} / ${m.correlation.txns.changes}
  active accounts ${m.correlation.activeAccounts.levels} / ${m.correlation.activeAccounts.changes}
weekly lead/lag (${m.leadLag.weeks} weeks, |r| > ${m.leadLag.significanceAbsR} is significant at ~95%):
${m.leadLag.lags.map((l) => `  lag ${String(l.lag).padStart(2)}w  volume ${l.volume}  txns ${l.txns}`).join("\n")}
buyback ${m.buyback.since}..${m.buyback.through}: $${m.buyback.usd} = ${m.buyback.nearBought} NEAR vs ${m.buyback.netNewSupplyNear} net new NEAR (${m.buyback.coveragePct}%)
net supply growth, last 365 days: ${m.supplyGrowthPct365d}%
fees in ${h.gasFeesVsIntentsFees.month}: gas $${h.gasFeesVsIntentsFees.gasFeesUsd}, Intents gross $${h.gasFeesVsIntentsFees.intentsFeesUsd}, NEAR-captured $${h.gasFeesVsIntentsFees.intentsRevenueUsd}
charts: ${CHARTS.map((c) => `charts/${c.id}.svg`).join(", ")}`);
