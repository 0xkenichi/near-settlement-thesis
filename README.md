# NEAR Settlement Thesis

**An evidence-first investment thesis for NEAR, with a live dashboard and one command that rebuilds every number and chart from public data.**

Built at **NEAR HACKATHON** (track: `thesis`, Investment Thesis).

- **Live dashboard:** https://near-settlement-thesis.testnet.page. It's served by a NEAR testnet contract through web4 and recomputes every chart from the raw APIs in your browser.
- **The thesis:** [THESIS.md](THESIS.md). It covers the claim, the evidence for, the evidence against, a break-even model, and what would change my mind.

## The problem

Most NEAR theses quote one number that suits them: active accounts, TVL or price. The numbers rarely come with the query behind them, so nobody can check them or rerun them next month. This repository makes every claim traceable:
- **The source:** a public API URL.
- **The method:** one function in `web/metrics.mjs`.
- **The result:** `data/metrics.json`, a chart and a sentence.

The dashboard runs the same code live, so it can't drift from the document.

## What the data says (data through 12 Nov 2026)

| Finding | Number |
|---|---|
| Monthly NEAR Intents volume, Jan 2025 → Oct 2026 | $6.4M → $3.99B (622x) |
| Daily transactions, same months | 7.17M → 0.73M (−89.8%) |
| NEAR's captured Intents revenue vs all gas fees, Oct 2026 | $2.19M vs $196K (11.2x) |
| Correlation of NEAR price with Intents volume (22 months: levels / changes) | −0.51 / −0.08 |
| Does weekly Intents volume lead the price (lags −6 to +6 weeks)? | No lag clears the ±0.20 noise band |
| Buybacks since 2026-02-23 vs net new NEAR supply | 3.32M of 23.05M NEAR (14.4%) |
| Intents volume needed for buybacks to cover all new supply | ≈ $23.5B a month (6.1x today) |

The verdict, in one line: NEAR has become a settlement business, and the token case now depends on buyback coverage of new supply. Usage counts no longer matter, and the price hasn't followed Intents volume yet.

## Try it: do X, see Y

| Do | See |
|---|---|
| Open https://near-settlement-thesis.testnet.page | A "Live: fetched just now" line with today's data dates, 4 headline tiles, the evidence for and against, and 5 charts. Hover a point to read its value |
| Under any chart, open **The query behind it** | The exact API URL(s) and the transform that produced the chart |
| In **Break-even model**, change "Monthly Intents volume" to `23500000000` | Coverage reaches about 100% of new supply |
| `node rebuild.mjs` (Node 18+, no install needed) | Downloads the 5 raw sources to `data/raw/`, writes `data/metrics.json`, redraws `charts/*.svg`, and prints every headline number |
| `node rebuild.mjs --offline` | The same results from the saved raw files, with no network needed |
| Compare the printed numbers with THESIS.md and the dashboard | They match, because all three use `web/metrics.mjs` (newer data can move the latest month) |

## Charts

![Usage moved from transactions to NEAR Intents](charts/1-usage-moved.svg)
![NEAR's price did not follow Intents volume](charts/2-price-did-not-follow.svg)
![Neither metric leads the price week to week](charts/3-no-lead.svg)
![Intents now earns NEAR more than its own gas fees](charts/4-revenue-vs-gas.svg)
![Buybacks absorb a fraction of new supply](charts/5-buyback-vs-supply.svg)

## Data sources (all public, no API keys)

| Key | URL | What |
|---|---|---|
| `chain` | `https://api.nearblocks.io/v1/charts` | Daily NEAR price, transactions, active accounts, gas fees, total supply |
| `intentsVolume` | `https://api.llama.fi/summary/dexs/near-intents` | Daily NEAR Intents swap volume (USD) |
| `intentsFees` | `https://api.llama.fi/summary/fees/near-intents?dataType=dailyFees` | Gross Intents fees |
| `intentsRevenue` | `…?dataType=dailyRevenue` | What NEAR captures from those fees |
| `intentsBuyback` | `…?dataType=dailyHoldersRevenue` | Captured revenue used to buy back NEAR (from 2026-02-23) |

Limits are listed in [THESIS.md](THESIS.md#limits-what-these-sources-cant-tell-us). In short: no per-contract breakdown of the Apr 2026 transaction drop, and no per-chain split of Intents volume (that needs a partner JWT). Fees are tracked from 2025-06-11, and captured revenue from 2025-11-07.

## How it's built

| Path | What |
|---|---|
| `web/metrics.mjs` | Parses the raw responses and computes everything: monthly aggregates, correlations, weekly lead/lag, buyback coverage, supply growth, the break-even model |
| `web/charts.mjs` | Draws the SVG charts (one axis each; series of different units are indexed to Jan 2025 = 100) |
| `web/index.html`, `web/app.mjs` | The dashboard. It fetches the sources live and falls back to `web/metrics.json` if they're unreachable |
| `rebuild.mjs` | One command: fetch, compute, redraw |
| `hosting/` | A small near-sdk-js contract whose `web4_get` serves `web/` from `near-settlement-thesis.testnet`, plus the deploy script |

To host your own copy:
1. `npm install`
2. `node rebuild.mjs`
3. `npm run build:site`
4. `SITE_ACCOUNT=<name>.testnet npm run deploy:site`

The last step creates the account through the public testnet helper. Its keys go to `.near-credentials/`, which is git-ignored.

## Disclosures

- **My other NEAR HACKATHON project:** [Open Door](https://github.com/0xkenichi/open-door) (Social Money track). In Open Door, members earn a Sputnik DAO vote by attending community calls. The two projects are independent: different tracks, different repositories, and no shared code. Both serve their web pages through web4.
- **AI:** the analysis code, dashboard and documents were written with Claude Code (Anthropic) as a pair programmer, directed and reviewed by the author. Every number is computed by the code in this repository from the listed sources; none was typed in by hand.
- **Baseline:** this is a new repository, started on 13 Nov 2026, with no code from earlier projects.
- **Design:** the dashboard's front-page look takes its cue from "Newspaper Magazine", a free Framer template: serif headlines, a monospace dateline and labels, numbered findings, and a red accent. No template code or assets are used. Type is Newsreader, Inter Tight and DM Mono, from Google Fonts.
- **Not investment advice.**

## License

MIT. See `LICENSE`.
