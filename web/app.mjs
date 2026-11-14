// Dashboard: fetch the raw sources live, run the same metrics and charts as rebuild.mjs, fill the page.
// If a source can't be reached, fall back to the snapshot saved by the last rebuild (metrics.json).
import { SOURCES, compute } from "./metrics.mjs";
import { CHARTS, fmtUsd, fmtNum } from "./charts.mjs";

const $ = (id) => document.getElementById(id);
const CODE = "https://github.com/0xkenichi/near-settlement-thesis/blob/main/web/metrics.mjs";
const li = (html) => `<li>${html}</li>`;

async function load() {
  try {
    const entries = await Promise.all(
      Object.entries(SOURCES).map(async ([key, { url }]) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
        return [key, await res.json()];
      })
    );
    return { m: compute(Object.fromEntries(entries)), live: true };
  } catch (e) {
    console.warn("Live fetch failed, using the saved snapshot", e);
    const res = await fetch("./metrics.json");
    return { m: await res.json(), live: false };
  }
}

function render({ m, live }) {
  const h = m.headline, bb = m.buyback, md = m.model, c = m.correlation;
  const gasX = h.gasFeesVsIntentsFees.intentsRevenueUsd / h.gasFeesVsIntentsFees.gasFeesUsd;

  $("freshness").textContent = live
    ? `Live: fetched just now. Chain data through ${m.dataThrough.chain}, Intents data through ${m.dataThrough.intentsVolume}. Monthly figures use full months ${m.baseMonth} to ${m.lastFullMonth}.`
    : `Live sources unreachable, so this shows the snapshot from the last rebuild (data through ${m.dataThrough.chain}).`;

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  $("dateline").textContent = `${today} · data through ${m.dataThrough.chain}`;

  const t = m.tests;
  $("verdict").textContent = t.mechanism && !t.coverage
    ? `The mechanism works; the payoff hasn't arrived. Intents earns NEAR ${gasX.toFixed(0)}x its own gas fees and buys NEAR every day, but buybacks absorb ${bb.coveragePct}% of new supply, the float still grows ${m.float.afterBuybacksPct}% a year, and the price shows no link to volume yet.`
    : t.coverage
    ? `Buybacks now absorb all new supply (${bb.coveragePct}%). The thesis has reached its payoff condition.`
    : `The mechanism is not holding: check the tests below.`;
  $("tests").innerHTML = [
    [t.mechanism, "Mechanism", `Captured Intents revenue beat chain gas fees and funded buybacks in each of the last 3 months.`],
    [t.coverage, "Coverage", `Buybacks absorb ${bb.coveragePct}% of net new NEAR. Passes at 100%; break-even is about ${fmtUsd(md.breakevenMonthlyVolume)} of volume a month.`],
    [t.priceLink, "Price link", `Monthly price and volume changes correlate at ${c.intentsVolume.changes}; passing needs more than ±${(1.96 / Math.sqrt(c.months - 1)).toFixed(2)}.`],
  ].map(([ok, name, text]) => `<li><b class="${ok ? "pass" : "fail"}">${name}</b>${text}</li>`).join("");

  $("tiles").innerHTML = [
    [`${gasX.toFixed(1)}x`, `NEAR's Intents revenue vs all gas fees on the chain, ${h.gasFeesVsIntentsFees.month}`],
    [`${m.take.last.shareOfFeesPct}%`, `Share of each Intents fee NEAR keeps (${m.take.last.window}), up from ${m.take.first.shareOfFeesPct}%`],
    [`${m.float.afterBuybacksPct}%`, `Yearly float growth after burns and buybacks (${m.float.grossPct}% before buybacks)`],
    [`${c.intentsVolume.changes}`, `Correlation of monthly price and Intents volume changes: no link yet`],
  ].map(([b, s], i) => `<li><span class="n">0${i + 1}</span><div><b>${b}</b><span class="t">${s}</span></div></li>`).join("");

  $("for").innerHTML = [
    `Monthly Intents volume went from ${fmtUsd(h.intentsVolume.base)} in ${m.baseMonth} to ${fmtUsd(h.intentsVolume.last)} in ${m.lastFullMonth} (${h.intentsVolume.multiple}x).`,
    `In ${h.gasFeesVsIntentsFees.month}, Intents charged ${fmtUsd(h.gasFeesVsIntentsFees.intentsFeesUsd)} in gross fees and NEAR kept ${fmtUsd(h.gasFeesVsIntentsFees.intentsRevenueUsd)}: ${gasX.toFixed(1)}x the ${fmtUsd(h.gasFeesVsIntentsFees.gasFeesUsd)} of gas fees on the whole chain.`,
    `Since ${bb.since}, that revenue has bought back about ${fmtNum(bb.nearBought)} NEAR (${fmtUsd(bb.usd)}) on the open market.`,
    `Net supply grew ${m.supplyGrowthPct365d}% over the last 365 days.`,
    `NEAR's cut of each fee rose from ${m.take.first.shareOfFeesPct}% to ${m.take.last.shareOfFeesPct}% (${m.take.first.window} to ${m.take.last.window}), so the same volume now buys more NEAR.`,
  ].map(li).join("");

  $("against").innerHTML = [
    `Price did not track Intents volume: correlation ${c.intentsVolume.levels} on monthly levels and ${c.intentsVolume.changes} on monthly changes (${c.months} months).`,
    `No weekly lead: no lag from -6 to +6 weeks clears the ±${m.leadLag.significanceAbsR} noise band (${m.leadLag.weeks} weeks).`,
    `Buybacks absorbed only ${bb.coveragePct}% of the ${fmtNum(bb.netNewSupplyNear)} NEAR of net new supply since ${bb.since}. Holders are still diluted.`,
    `Daily transactions fell ${Math.abs(h.txnsPerDay.changePct)}% and active accounts ${Math.abs(h.activePerDay.changePct)}% since ${m.baseMonth}. Fewer people use NEAR directly.`,
    `Fees per dollar swapped fell from ${m.take.first.grossPct}% to ${m.take.last.grossPct}%. NEAR's rising cut, not the fee pool, drove the gain, and that split is an operator choice no protocol rule enforces.`,
    `After buybacks the float still grows ${m.float.afterBuybacksPct}% a year (${m.float.grossPct}% before).`,
  ].map(li).join("");

  $("charts-list").innerHTML = CHARTS.map((ch, i) => `<figure><span class="kicker red">Chart 0${i + 1}</span><p class="cap">${ch.sentence(m)}</p>${ch.svg(m)}
    <details><summary>The query behind it</summary><p>${ch.method}</p>${ch.sources.map((k) => `<p><a href="${SOURCES[k].url}" target="_blank" rel="noopener"><code>${SOURCES[k].url}</code></a><br>${SOURCES[k].what}</p>`).join("")}<p><a href="${CODE}" target="_blank" rel="noopener">The calculation, in web/metrics.mjs</a></p></details></figure>`).join("");

  $("m-vol").value = md.avgMonthlyVolume;
  $("m-rate").value = md.capturedRatePct;
  $("m-price").value = md.priceNow;
  $("m-supply").value = md.newSupplyPerMonth;
  const runModel = () => {
    const vol = +$("m-vol").value, rate = +$("m-rate").value / 100, price = +$("m-price").value, supply = +$("m-supply").value;
    const bought = (vol * rate) / price;
    const breakeven = (supply * price) / rate;
    $("m-out").textContent = `Buybacks would absorb ${((100 * bought) / supply).toFixed(1)}% of new supply (${fmtNum(bought)} of ${fmtNum(supply)} NEAR a month). Break-even: ${fmtUsd(breakeven)} of Intents volume a month, ${(breakeven / vol).toFixed(1)}x the volume above.`;
  };
  for (const id of ["m-vol", "m-rate", "m-price", "m-supply"]) $(id).addEventListener("input", runModel);
  runModel();

  const last3 = m.monthly.slice(-3);
  const minRevVsGas = Math.min(...last3.map((x) => x.intentsRevenue / x.gasFeesUsd));
  const minVol = Math.min(...last3.map((x) => x.intentsVolume));
  $("falsifiers").innerHTML = [
    `Captured Intents revenue falls below chain gas fees for 3 months in a row. <i>Now: at least ${minRevVsGas.toFixed(1)}x in each of the last 3 months.</i>`,
    `Monthly Intents volume stays under $1B for 3 months in a row. <i>Now: the lowest of the last 3 months is ${fmtUsd(minVol)}.</i>`,
    `The buyback stops: no buyback revenue for 30 days. <i>Now: last buyback data on ${bb.through}.</i>`,
    `Buyback coverage rises above 50% of new supply and the price still shows no relationship to Intents volume. That would mean the flow doesn't matter to the token. <i>Now: ${bb.coveragePct}% coverage.</i>`,
  ].map(li).join("");

  const head = ["Month", "Price", "Txns/day", "Active/day", "Intents volume", "Intents fees", "NEAR captured", "Gas fees"];
  $("table").innerHTML = `<thead><tr>${head.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${m.monthly.map((r) => `<tr><td>${r.month}</td><td>$${r.price.toFixed(2)}</td><td>${fmtNum(r.txnsPerDay)}</td><td>${fmtNum(r.activePerDay)}</td><td>${fmtUsd(r.intentsVolume)}</td><td>${r.month >= m.feesTrackedFrom.slice(0, 7) ? fmtUsd(r.intentsFees) : "not tracked"}</td><td>${r.month >= m.revenueTrackedFrom.slice(0, 7) ? fmtUsd(r.intentsRevenue) : "not tracked"}</td><td>${fmtUsd(r.gasFeesUsd)}</td></tr>`).join("")}</tbody>`;

  $("rerun-list").innerHTML = [
    `In this page: every number above was computed in your browser a moment ago from the raw responses below. Reload to recompute.`,
    `On your machine: <code>git clone https://github.com/0xkenichi/near-settlement-thesis && cd near-settlement-thesis && node rebuild.mjs</code>. Node 18+, nothing to install. It saves the raw data, recomputes <code>data/metrics.json</code> and redraws every chart.`,
    ...Object.values(SOURCES).map((src) => `<a href="${src.url}" target="_blank" rel="noopener">${src.url}</a><i>${src.what}. Public, no key, opens in a browser.</i>`),
  ].map(li).join("");

  $("sources").innerHTML = Object.values(SOURCES).map((s) => `<a href="${s.url}">${new URL(s.url).host}</a>`).filter((v, i, a) => a.indexOf(v) === i).join(", ");
}

load().then(render).catch((e) => {
  $("freshness").textContent = `Couldn't load data: ${e.message}`;
});
