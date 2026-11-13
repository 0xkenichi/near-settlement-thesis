// Dashboard: fetch the raw sources live, run the same metrics and charts as rebuild.mjs, fill the page.
// If a source can't be reached, fall back to the snapshot saved by the last rebuild (metrics.json).
import { SOURCES, compute } from "./metrics.mjs";
import { CHARTS, fmtUsd, fmtNum } from "./charts.mjs";

const $ = (id) => document.getElementById(id);
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

  $("tiles").innerHTML = [
    [fmtUsd(h.intentsVolume.last), `Intents volume in ${m.lastFullMonth} (${h.intentsVolume.multiple}x ${m.baseMonth})`],
    [`${h.txnsPerDay.changePct}%`, `Transactions per day, ${m.baseMonth} to ${m.lastFullMonth}`],
    [`${gasX.toFixed(1)}x`, `NEAR's Intents revenue vs all gas fees, ${h.gasFeesVsIntentsFees.month}`],
    [`${bb.coveragePct}%`, `Share of net new NEAR bought back since ${bb.since}`],
  ].map(([b, s]) => `<div class="tile"><b>${b}</b><span>${s}</span></div>`).join("");

  $("for").innerHTML = [
    `Monthly Intents volume went from ${fmtUsd(h.intentsVolume.base)} in ${m.baseMonth} to ${fmtUsd(h.intentsVolume.last)} in ${m.lastFullMonth} (${h.intentsVolume.multiple}x).`,
    `In ${h.gasFeesVsIntentsFees.month}, Intents charged ${fmtUsd(h.gasFeesVsIntentsFees.intentsFeesUsd)} in gross fees and NEAR kept ${fmtUsd(h.gasFeesVsIntentsFees.intentsRevenueUsd)}: ${gasX.toFixed(1)}x the ${fmtUsd(h.gasFeesVsIntentsFees.gasFeesUsd)} of gas fees on the whole chain.`,
    `Since ${bb.since}, that revenue has bought back about ${fmtNum(bb.nearBought)} NEAR (${fmtUsd(bb.usd)}) on the open market.`,
    `Net supply grew ${m.supplyGrowthPct365d}% over the last 365 days.`,
  ].map(li).join("");

  $("against").innerHTML = [
    `Price did not track Intents volume: correlation ${c.intentsVolume.levels} on monthly levels and ${c.intentsVolume.changes} on monthly changes (${c.months} months).`,
    `No weekly lead: no lag from -6 to +6 weeks clears the ±${m.leadLag.significanceAbsR} noise band (${m.leadLag.weeks} weeks).`,
    `Buybacks absorbed only ${bb.coveragePct}% of the ${fmtNum(bb.netNewSupplyNear)} NEAR of net new supply since ${bb.since}. Holders are still diluted.`,
    `Daily transactions fell ${Math.abs(h.txnsPerDay.changePct)}% and active accounts ${Math.abs(h.activePerDay.changePct)}% since ${m.baseMonth}. Fewer people use NEAR directly.`,
    `NEAR keeps ${md.capturedShareOfFeesPct}% of Intents fees; solvers and front-ends keep the rest, and the split is a policy choice that can change.`,
  ].map(li).join("");

  $("charts").innerHTML = CHARTS.map((ch) => `<figure>${ch.svg(m)}<figcaption>${ch.sentence(m)}</figcaption>
    <details><summary>The query behind it</summary><p>${ch.method}</p>${ch.sources.map((k) => `<p><code>${SOURCES[k].url}</code><br>${SOURCES[k].what}</p>`).join("")}</details></figure>`).join("");

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

  $("sources").innerHTML = Object.values(SOURCES).map((s) => `<a href="${s.url}">${new URL(s.url).host}</a>`).filter((v, i, a) => a.indexOf(v) === i).join(", ");
}

load().then(render).catch((e) => {
  $("freshness").textContent = `Couldn't load data: ${e.message}`;
});
