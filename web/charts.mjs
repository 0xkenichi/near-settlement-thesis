// SVG charts as plain strings, so Node (charts/*.svg) and the browser (the dashboard) draw the same thing.
// One y-axis per chart. Series of different units are indexed to a common base instead of a second axis.
// Each point carries a <title>, so hovering a point on the dashboard shows its value.

const W = 720, H = 360, PAD = { l: 64, r: 132, t: 64, b: 44 };
const SLOTS = 3; // categorical slots: 1 blue, 2 orange, 3 aqua (validated for colour-blind separation)

const STYLE = `<style>
svg{--surface:#fbf9f4;--ink:#141414;--ink2:#5d5a53;--muted:#8a867d;--grid:#e4dfd3;--axis:#c9c3b5;--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a}
text{font-family:"Inter Tight","Helvetica Neue",Arial,sans-serif;fill:var(--ink2);font-size:12px}
.title{fill:var(--ink);font-family:Newsreader,Georgia,serif;font-size:18px;font-weight:500}.sub{font-size:12px}.tick{fill:var(--muted);font-size:11px;font-family:"DM Mono",ui-monospace,Menlo,monospace}
.grid{stroke:var(--grid);stroke-width:1}.axis{stroke:var(--axis);stroke-width:1}.line{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
circle.hit{fill:transparent;stroke:none}circle.hit:hover{fill:currentColor;fill-opacity:.35}.label{font-size:12px;fill:var(--ink)}
${Array.from({ length: SLOTS }, (_, i) => `.s${i + 1}{stroke:var(--s${i + 1});color:var(--s${i + 1})}.f${i + 1}{fill:var(--s${i + 1})}`).join("")}
</style>`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
export const fmtUsd = (v) => {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(a >= 1e10 ? 0 : 1)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};
export const fmtNum = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${Math.round(v)}`;
};
const monthLabel = (m) => {
  const [y, mo] = m.split("-");
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(mo) - 1]} ${y.slice(2)}`;
};

function frame(title, sub, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${STYLE}
<rect width="${W}" height="${H}" fill="var(--surface)"/>
<text class="title" x="${PAD.l - 48}" y="26">${esc(title)}</text>
<text class="sub" x="${PAD.l - 48}" y="45">${esc(sub)}</text>
${body}</svg>`;
}

function niceLinear(min, max, n = 5) {
  const span = max - min || 1;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= step0);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e9) / 1e9);
  return { lo, hi, ticks };
}

// series: [{ name, slot, values: number[] }], labels: x labels (same length as values)
export function lineChart({ title, sub, labels, series, log = false, yFmt = fmtNum, refLines = [], xEvery = 3 }) {
  const all = series.flatMap((s) => s.values).filter((v) => v != null && (!log || v > 0));
  let lo, hi, ticks;
  if (log) {
    lo = 10 ** Math.floor(Math.log10(Math.min(...all)));
    hi = 10 ** Math.ceil(Math.log10(Math.max(...all)));
    ticks = [];
    for (let v = lo; v <= hi * 1.0001; v *= 10) ticks.push(v);
  } else ({ lo, hi, ticks } = niceLinear(Math.min(0, ...all), Math.max(...all)));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const x = (i) => PAD.l + (labels.length === 1 ? iw / 2 : (i * iw) / (labels.length - 1));
  const y = (v) => {
    const t = log ? (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) : (v - lo) / (hi - lo);
    return PAD.t + ih * (1 - t);
  };
  let body = "";
  for (const t of ticks) body += `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${PAD.l - 8}" y="${y(t) + 4}" text-anchor="end">${yFmt(t)}</text>`;
  body += `<line class="axis" x1="${PAD.l}" x2="${W - PAD.r}" y1="${PAD.t + ih}" y2="${PAD.t + ih}"/>`;
  labels.forEach((l, i) => {
    if (i % xEvery === 0 || (i === labels.length - 1 && i % xEvery >= xEvery / 2)) body += `<text class="tick" x="${x(i)}" y="${H - PAD.b + 18}" text-anchor="middle">${esc(l.length === 7 ? monthLabel(l) : l)}</text>`;
  });
  for (const r of refLines) body += `<line class="axis" stroke-dasharray="4 4" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(r.y)}" y2="${y(r.y)}"/><text class="tick" x="${W - PAD.r - 4}" y="${y(r.y) - 5}" text-anchor="end">${esc(r.label)}</text>`;
  // Direct labels at the line ends, nudged apart so they never overlap.
  const ends = series.map((s) => ({ s, yy: y(s.values.at(-1)) })).sort((a, b) => a.yy - b.yy);
  for (let i = 1; i < ends.length; i++) if (ends[i].yy - ends[i - 1].yy < 16) ends[i].yy = ends[i - 1].yy + 16;
  for (const s of series) {
    const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    body += `<path class="line s${s.slot}" d="${pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("")}"/>`;
    s.values.forEach((v, i) => {
      if (v != null) body += `<circle class="hit s${s.slot}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="6"><title>${esc(`${s.name}, ${labels[i].length === 7 ? monthLabel(labels[i]) : labels[i]}: ${yFmt(v)}`)}</title></circle>`;
    });
    const e = ends.find((k) => k.s === s);
    body += `<circle class="f${s.slot}" cx="${W - PAD.r + 10}" cy="${e.yy - 4}" r="4"/><text class="label" x="${W - PAD.r + 18}" y="${e.yy}">${esc(s.name)}</text>`;
  }
  return frame(title, sub, body);
}

// Grouped bars around zero, one group per x label.
export function barChart({ title, sub, labels, series, band }) {
  const all = series.flatMap((s) => s.values).concat(band ? [band + 0.1, -band - 0.1] : []);
  const { lo, hi, ticks } = niceLinear(Math.min(...all), Math.max(...all), 4);
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const gw = iw / labels.length, bw = Math.min(14, (gw - 6) / series.length - 2);
  const y = (v) => PAD.t + ih * (1 - (v - lo) / (hi - lo));
  let body = "";
  for (const t of ticks) body += `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${PAD.l - 8}" y="${y(t) + 4}" text-anchor="end">${t.toFixed(1)}</text>`;
  if (band) for (const b of [band, -band]) body += `<line class="axis" stroke-dasharray="4 4" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(b)}" y2="${y(b)}"/>`;
  if (band) body += `<text class="tick" x="${PAD.l + 4}" y="${y(band) - 5}">±${band}: inside this band = noise (95%)</text>`;
  body += `<line class="axis" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(0)}" y2="${y(0)}"/>`;
  labels.forEach((l, i) => {
    const gx = PAD.l + i * gw + gw / 2;
    body += `<text class="tick" x="${gx}" y="${H - PAD.b + 18}" text-anchor="middle">${esc(l)}</text>`;
    series.forEach((s, j) => {
      const v = s.values[i];
      const bx = gx - (series.length * (bw + 2)) / 2 + j * (bw + 2);
      const top = Math.min(y(v), y(0)), h = Math.max(1, Math.abs(y(v) - y(0)));
      body += `<rect class="f${s.slot}" x="${bx.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${esc(`${s.name}, lag ${l}: r = ${v}`)}</title></rect>`;
    });
  });
  series.forEach((s, j) => {
    body += `<rect class="f${s.slot}" x="${W - PAD.r + 6}" y="${PAD.t + j * 20}" width="10" height="10" rx="2"/><text class="label" x="${W - PAD.r + 22}" y="${PAD.t + j * 20 + 9}">${esc(s.name)}</text>`;
  });
  return frame(title, sub, body);
}

const pct = (v) => fmtNum(v);
const dayLabel = (d) => `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;

// Each chart: id (file name), the sentence that says what it shows, and how to draw it from metrics.json.
export const CHARTS = [
  {
    id: "1-usage-moved",
    sources: ["chain", "intentsVolume"],
    method: "Monthly average of daily transactions and active accounts (NearBlocks); monthly sum of daily Intents volume (DefiLlama); each divided by its base-month value.",
    sentence: (m) => `Since ${m.baseMonth}, daily transactions fell ${Math.abs(m.headline.txnsPerDay.changePct)}% and daily active accounts ${Math.abs(m.headline.activePerDay.changePct)}%, while monthly NEAR Intents volume grew ${m.headline.intentsVolume.multiple}x.`,
    svg: (m) => {
      const s = m.series.indexed;
      return lineChart({
        title: "Usage moved from transactions to NEAR Intents",
        sub: `Monthly, indexed: ${m.baseMonth} = 100 (log scale). Sources: NearBlocks, DefiLlama.`,
        labels: s.intentsVolume.map((p) => p.x),
        series: [
          { name: "Intents volume", slot: 1, values: s.intentsVolume.map((p) => p.y) },
          { name: "Transactions/day", slot: 2, values: s.txns.map((p) => p.y) },
          { name: "Active accounts/day", slot: 3, values: s.active.map((p) => p.y) },
        ],
        log: true,
        yFmt: pct,
        refLines: [{ y: 100, label: `${m.baseMonth} = 100` }],
      });
    },
  },
  {
    id: "2-price-did-not-follow",
    sources: ["chain", "intentsVolume"],
    method: "Monthly average NEAR price (NearBlocks) and monthly Intents volume, indexed. Pearson correlation of log levels and of month-on-month log changes.",
    sentence: (m) => `NEAR's price did not track Intents volume: the correlation of monthly levels is ${m.correlation.intentsVolume.levels} and of monthly changes ${m.correlation.intentsVolume.changes} over ${m.correlation.months} months.`,
    svg: (m) => {
      const s = m.series.indexed;
      return lineChart({
        title: "NEAR's price did not follow Intents volume",
        sub: `Monthly, indexed: ${m.baseMonth} = 100 (log scale). Price is the monthly average.`,
        labels: s.price.map((p) => p.x),
        series: [
          { name: "Intents volume", slot: 1, values: s.intentsVolume.map((p) => p.y) },
          { name: "NEAR price", slot: 2, values: s.price.map((p) => p.y) },
        ],
        log: true,
        yFmt: pct,
        refLines: [{ y: 100, label: `${m.baseMonth} = 100` }],
      });
    },
  },
  {
    id: "3-no-lead",
    sources: ["chain", "intentsVolume"],
    method: "Monday-to-Sunday weeks. Log change in weekly Intents volume (and transactions) at week t vs log change in average price at week t+k. Noise band = 1.96 / sqrt(weeks).",
    sentence: (m) => `No lag from -6 to +6 weeks shows a correlation outside the ±${m.leadLag.significanceAbsR} noise band, so Intents volume did not lead the price in ${m.leadLag.weeks} weeks of data.`,
    svg: (m) => barChart({
      title: "Neither metric leads the price week to week",
      sub: `Correlation of weekly changes with the NEAR price change k weeks later (${m.leadLag.weeks} weeks).`,
      labels: m.leadLag.lags.map((l) => `${l.lag > 0 ? "+" : ""}${l.lag}`),
      series: [
        { name: "Intents volume", slot: 1, values: m.leadLag.lags.map((l) => l.volume) },
        { name: "Transactions", slot: 2, values: m.leadLag.lags.map((l) => l.txns) },
      ],
      band: m.leadLag.significanceAbsR,
    }),
  },
  {
    id: "4-revenue-vs-gas",
    sources: ["chain", "intentsRevenue"],
    method: "Monthly sum of NEAR-captured Intents revenue (DefiLlama dailyRevenue) vs monthly sum of gas fees in USD (NearBlocks txn_fee_usd).",
    sentence: (m) => `In ${m.headline.gasFeesVsIntentsFees.month}, NEAR captured ${fmtUsd(m.headline.gasFeesVsIntentsFees.intentsRevenueUsd)} from Intents against ${fmtUsd(m.headline.gasFeesVsIntentsFees.gasFeesUsd)} of gas fees on the whole chain.`,
    svg: (m) => lineChart({
      title: "Intents now earns NEAR more than its own gas fees",
      sub: `Monthly USD (log scale). Captured = what NEAR keeps; DefiLlama tracks it from ${m.revenueTrackedFrom}.`,
      labels: m.series.monthlyFees.map((p) => p.x),
      series: [
        { name: "Intents, captured", slot: 1, values: m.series.monthlyFees.map((p) => (p.x >= m.revenueTrackedFrom.slice(0, 7) ? p.revenue : null)) },
        { name: "Chain gas fees", slot: 2, values: m.series.monthlyFees.map((p) => p.gas) },
      ],
      log: true,
      yFmt: fmtUsd,
    }),
  },
  {
    id: "5-buyback-vs-supply",
    sources: ["chain", "intentsBuyback"],
    method: "Each day since the buyback began: buyback USD (DefiLlama dailyHoldersRevenue) / that day's NEAR price, summed; vs the change in total supply (NearBlocks) over the same days.",
    sentence: (m) => `Since ${m.buyback.since}, Intents buybacks bought about ${fmtNum(m.buyback.nearBought)} NEAR, ${m.buyback.coveragePct}% of the ${fmtNum(m.buyback.netNewSupplyNear)} NEAR of net new supply.`,
    svg: (m) => {
      const pts = m.series.buyback.filter((_, i, a) => i % 7 === 0 || i === a.length - 1);
      return lineChart({
        title: "Buybacks absorb a fraction of new supply",
        sub: `Cumulative NEAR since the buyback began (${m.buyback.since}). Weekly points.`,
        labels: pts.map((p) => dayLabel(p.x)),
        series: [
          { name: "Net new supply", slot: 2, values: pts.map((p) => p.newSupply) },
          { name: "Bought back", slot: 1, values: pts.map((p) => p.bought) },
        ],
        yFmt: fmtNum,
        xEvery: 6,
      });
    },
  },
  {
    id: "6-take-rate",
    sources: ["intentsVolume", "intentsFees", "intentsRevenue"],
    method: "Each full month since revenue tracking began: NEAR-captured revenue ÷ Intents volume, and gross fees ÷ Intents volume, both in percent.",
    sentence: (m) => `NEAR now keeps ${m.take.last.shareOfFeesPct}% of every Intents fee dollar (${m.take.last.window}), up from ${m.take.first.shareOfFeesPct}% (${m.take.first.window}), even as fees per dollar swapped fell from ${m.take.first.grossPct}% to ${m.take.last.grossPct}%.`,
    svg: (m) => lineChart({
      title: "NEAR keeps more of each fee",
      sub: "Monthly, % of Intents volume. Gross = all fees; captured = what NEAR keeps for buybacks.",
      labels: m.series.take.map((p) => p.x),
      series: [
        { name: "Gross fees", slot: 2, values: m.series.take.map((p) => p.gross) },
        { name: "NEAR captured", slot: 1, values: m.series.take.map((p) => p.captured) },
      ],
      yFmt: (v) => `${v.toFixed(2)}%`,
      xEvery: 2,
    }),
  },
];
