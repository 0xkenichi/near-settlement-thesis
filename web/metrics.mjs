// Every number in THESIS.md and on the dashboard comes from this file.
// Node (rebuild.mjs) and the browser (the dashboard) run the same code on the same raw API responses.

const LLAMA = "https://api.llama.fi/summary";
export const SOURCES = {
  chain: { url: "https://api.nearblocks.io/v1/charts", what: "NearBlocks daily chain stats: price, transactions, active accounts, gas fees, total supply" },
  intentsVolume: { url: `${LLAMA}/dexs/near-intents?excludeTotalDataChartBreakdown=true`, what: "DefiLlama: daily swap volume through NEAR Intents (USD)" },
  intentsFees: { url: `${LLAMA}/fees/near-intents?dataType=dailyFees&excludeTotalDataChartBreakdown=true`, what: "DefiLlama: gross fees on NEAR Intents swaps (USD)" },
  intentsRevenue: { url: `${LLAMA}/fees/near-intents?dataType=dailyRevenue&excludeTotalDataChartBreakdown=true`, what: "DefiLlama: NEAR's captured Intents revenue (USD)" },
  intentsBuyback: { url: `${LLAMA}/fees/near-intents?dataType=dailyHoldersRevenue&excludeTotalDataChartBreakdown=true`, what: "DefiLlama: captured Intents revenue used to buy back NEAR (USD, since 2026-02-23)" },
};

// The base month for every index (= 100): the first full month of NEAR Intents volume.
export const BASE_MONTH = "2025-01";
export const BUYBACK_START = "2026-02-23";

const YOCTO = 1e24;
const num = (v) => (v == null || v === "" ? null : Number(v));
const dayOf = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);

export function parse(raw) {
  const chain = new Map();
  for (const r of raw.chain.charts) {
    chain.set(r.date.slice(0, 10), {
      price: num(r.near_price),
      txns: num(r.txns),
      active: num(r.active_accounts),
      feeUsd: num(r.txn_fee_usd),
      feeNear: num(r.txn_fee) / YOCTO,
      supply: num(r.total_supply) / YOCTO,
    });
  }
  const llama = (j) => new Map((j.totalDataChart || []).map(([ts, v]) => [dayOf(ts), Number(v)]));
  return {
    chain,
    volume: llama(raw.intentsVolume),
    fees: llama(raw.intentsFees),
    revenue: llama(raw.intentsRevenue),
    buyback: llama(raw.intentsBuyback),
  };
}

const monthsBetween = (a, b) => {
  const out = [];
  let [y, m] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  while (y < by || (y === by && m <= bm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m === 13) { m = 1; y++; }
  }
  return out;
};
const daysIn = (month) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const daysOf = (month) => Array.from({ length: daysIn(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
const lastKey = (map) => [...map.keys()].sort().at(-1);

// The last month that every source covers in full.
function lastFullMonth(d) {
  const lastCommon = [d.chain, d.volume, d.fees].map(lastKey).sort()[0];
  const month = lastCommon.slice(0, 7);
  if (lastCommon === daysOf(month).at(-1)) return month;
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}
const diffLog = (xs) => xs.slice(1).map((x, i) => Math.log(x / xs[i]));
const round = (x, p = 2) => Math.round(x * 10 ** p) / 10 ** p;

export function compute(raw) {
  const d = parse(raw);
  const last = lastFullMonth(d);
  const months = monthsBetween(BASE_MONTH, last);

  const monthly = months.map((month) => {
    const days = daysOf(month);
    const c = days.map((k) => d.chain.get(k)).filter(Boolean);
    const avg = (key) => c.reduce((a, r) => a + r[key], 0) / c.length;
    const sum = (map) => days.reduce((a, k) => a + (map.get(k) || 0), 0);
    return {
      month,
      daysWithChainData: c.length,
      price: avg("price"),
      txnsPerDay: avg("txns"),
      activePerDay: avg("active"),
      gasFeesUsd: c.reduce((a, r) => a + r.feeUsd, 0),
      intentsVolume: sum(d.volume),
      intentsFees: sum(d.fees),
      intentsRevenue: sum(d.revenue),
      buybackUsd: sum(d.buyback),
    };
  });

  const base = monthly[0];
  const lastM = monthly.at(-1);
  const index = (key) => monthly.map((m) => ({ x: m.month, y: (100 * m[key]) / base[key] }));

  // Levels: log-log correlation of monthly averages. Changes: month-on-month log changes.
  const col = (key) => monthly.map((m) => m[key]);
  const lp = col("price").map(Math.log);
  const corr = {};
  for (const [name, key] of [["intentsVolume", "intentsVolume"], ["txns", "txnsPerDay"], ["activeAccounts", "activePerDay"]]) {
    corr[name] = {
      levels: round(pearson(lp, col(key).map(Math.log))),
      changes: round(pearson(diffLog(col("price")), diffLog(col(key)))),
    };
  }

  // Weekly lead/lag: does a change in Intents volume (or transactions) come before a change in price?
  // Weeks run Monday to Sunday, from the first Monday of the base month to the last full week.
  const allDays = [...d.chain.keys()].filter((k) => k >= `${BASE_MONTH}-01` && d.volume.has(k)).sort();
  const weeks = [];
  let cur = null;
  for (const k of allDays) {
    const dow = new Date(`${k}T00:00:00Z`).getUTCDay();
    if (dow === 1) { cur = { start: k, n: 0, price: 0, volume: 0, txns: 0 }; weeks.push(cur); }
    if (!cur) continue;
    const c = d.chain.get(k);
    cur.n++; cur.price += c.price; cur.txns += c.txns; cur.volume += d.volume.get(k);
  }
  const full = weeks.filter((w) => w.n === 7);
  const wPrice = diffLog(full.map((w) => w.price / 7));
  const wVol = diffLog(full.map((w) => w.volume));
  const wTx = diffLog(full.map((w) => w.txns));
  const lagged = (lead, follow, k) => {
    const xs = [], ys = [];
    for (let t = 0; t < lead.length; t++) {
      if (t + k >= 0 && t + k < follow.length) { xs.push(lead[t]); ys.push(follow[t + k]); }
    }
    return round(pearson(xs, ys));
  };
  const lags = [];
  for (let k = -6; k <= 6; k++) lags.push({ lag: k, volume: lagged(wVol, wPrice, k), txns: lagged(wTx, wPrice, k) });
  const significance = round(1.96 / Math.sqrt(wPrice.length));

  // Value capture since the buyback began: NEAR bought (USD / that day's price) vs net new NEAR supply.
  const bbDays = [...d.buyback.keys()].filter((k) => k >= BUYBACK_START && d.chain.has(k)).sort();
  let usd = 0, nearBought = 0;
  const cumulative = [];
  const supplyAt = (k) => d.chain.get(k).supply;
  const startSupply = (() => {
    const prev = new Date(Date.parse(`${BUYBACK_START}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    return supplyAt(d.chain.has(prev) ? prev : bbDays[0]);
  })();
  for (const k of bbDays) {
    const v = d.buyback.get(k);
    usd += v;
    nearBought += v / d.chain.get(k).price;
    cumulative.push({ x: k, bought: nearBought, newSupply: supplyAt(k) - startSupply });
  }
  const bbLast = bbDays.at(-1);
  const newSupply = supplyAt(bbLast) - startSupply;

  // Net supply growth over the last 365 days (issuance minus burnt gas fees, as NearBlocks reports total supply).
  const chainLast = lastKey(d.chain);
  const daysBefore = (k, n) => new Date(Date.parse(`${k}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
  const yearAgo = daysBefore(chainLast, 365);
  const supplyGrowth = d.chain.has(yearAgo) ? round((100 * (supplyAt(chainLast) - supplyAt(yearAgo))) / supplyAt(yearAgo)) : null;

  // Break-even model: the monthly Intents volume at which buybacks would absorb all net new supply.
  // Inputs are the last 3 full months, so anyone can re-run it with newer data.
  const last3 = monthly.slice(-3);
  const vol3 = last3.reduce((a, m) => a + m.intentsVolume, 0);
  const rev3 = last3.reduce((a, m) => a + m.intentsRevenue, 0);
  const fee3 = last3.reduce((a, m) => a + m.intentsFees, 0);
  const takeRate = rev3 / vol3;
  const newSupplyPerMonth = ((supplyAt(chainLast) - supplyAt(daysBefore(chainLast, 90))) / 90) * 30.44;
  const priceNow = d.chain.get(chainLast).price;
  const model = {
    window: `${last3[0].month}..${last3.at(-1).month}`,
    avgMonthlyVolume: Math.round(vol3 / 3),
    grossFeeRatePct: round((100 * fee3) / vol3, 3),
    capturedRatePct: round(100 * takeRate, 3),
    capturedShareOfFeesPct: round((100 * rev3) / fee3, 1),
    newSupplyPerMonth: Math.round(newSupplyPerMonth),
    priceNow: round(priceNow),
    breakevenMonthlyVolume: Math.round((newSupplyPerMonth * priceNow) / takeRate),
  };
  model.breakevenMultiple = round(model.breakevenMonthlyVolume / model.avgMonthlyVolume, 1);
  model.runRateCoveragePct = round((100 * (model.avgMonthlyVolume * takeRate) / priceNow) / newSupplyPerMonth, 1);

  // Correlation inside the buyback era only (few months, so read it as a description, not a test).
  const bbMonths = monthly.filter((m) => m.month >= BUYBACK_START.slice(0, 7) && m.month > "2026-02");
  const buybackEra = bbMonths.length >= 4
    ? { months: bbMonths.length, from: bbMonths[0].month, to: bbMonths.at(-1).month, levels: round(pearson(bbMonths.map((m) => Math.log(m.price)), bbMonths.map((m) => Math.log(m.intentsVolume)))) }
    : null;

  return {
    generatedFrom: Object.fromEntries(Object.entries(SOURCES).map(([k, s]) => [k, s.url])),
    dataThrough: { chain: chainLast, intentsVolume: lastKey(d.volume), intentsBuyback: lastKey(d.buyback) },
    baseMonth: BASE_MONTH,
    // DefiLlama reports captured revenue from this day; earlier values are zero or a few dollars, i.e. not tracked.
    revenueTrackedFrom: [...d.revenue.entries()].sort().find(([, v]) => v > 1000)?.[0] ?? null,
    feesTrackedFrom: [...d.fees.entries()].sort().find(([, v]) => v > 1000)?.[0] ?? null,
    lastFullMonth: last,
    headline: {
      txnsPerDay: { base: Math.round(base.txnsPerDay), last: Math.round(lastM.txnsPerDay), changePct: round(100 * (lastM.txnsPerDay / base.txnsPerDay - 1), 1) },
      activePerDay: { base: Math.round(base.activePerDay), last: Math.round(lastM.activePerDay), changePct: round(100 * (lastM.activePerDay / base.activePerDay - 1), 1) },
      intentsVolume: { base: Math.round(base.intentsVolume), last: Math.round(lastM.intentsVolume), multiple: round(lastM.intentsVolume / base.intentsVolume, 0) },
      price: { base: round(base.price), last: round(lastM.price), changePct: round(100 * (lastM.price / base.price - 1), 1) },
      gasFeesVsIntentsFees: { month: last, gasFeesUsd: Math.round(lastM.gasFeesUsd), intentsFeesUsd: Math.round(lastM.intentsFees), intentsRevenueUsd: Math.round(lastM.intentsRevenue) },
    },
    correlation: { months: monthly.length, ...corr, buybackEra },
    model,
    leadLag: { weeks: wPrice.length, significanceAbsR: significance, lags },
    buyback: { since: BUYBACK_START, through: bbLast, usd: Math.round(usd), nearBought: Math.round(nearBought), netNewSupplyNear: Math.round(newSupply), coveragePct: round((100 * nearBought) / newSupply, 1) },
    supplyGrowthPct365d: supplyGrowth,
    series: {
      indexed: { price: index("price"), intentsVolume: index("intentsVolume"), txns: index("txnsPerDay"), active: index("activePerDay") },
      monthlyVolume: monthly.map((m) => ({ x: m.month, y: m.intentsVolume })),
      monthlyFees: monthly.map((m) => ({ x: m.month, gas: m.gasFeesUsd, intents: m.intentsFees, revenue: m.intentsRevenue })),
      buyback: cumulative,
    },
    monthly,
  };
}
