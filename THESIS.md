# NEAR: from transactions to settlement

*An evidence-first thesis. Every number below comes from `data/metrics.json`, produced by `node rebuild.mjs` from public APIs on 13 Nov 2026, with data through 12 Nov 2026. The [live dashboard](https://near-settlement-thesis.testnet.page) recomputes them on every visit. Not investment advice.*

## The claim

NEAR's long-term value now rests on one flow: **what NEAR Intents earns, and how much of that buys NEAR back, against how fast new NEAR is issued.** Transaction counts and active accounts no longer describe the network's economy. Intents volume does. The price has not tracked Intents volume yet, and buybacks cover a small share of new supply. So the investment case is not "usage is growing". It is a specific, checkable bet: **buyback coverage of new supply has to rise from about 15% towards 100%.**

## Where I started, and what the data said

The working hypothesis was the one in the track brief: cross-chain volume through NEAR Intents is a better guide to NEAR than raw activity, and it leads the price. The data supports the first half and rejects the second.

## How it was tested

| Source (no API keys) | What it gives |
|---|---|
| `api.nearblocks.io/v1/charts` | Daily NEAR price, transactions, active accounts, gas fees (NEAR and USD), total supply |
| `api.llama.fi/summary/dexs/near-intents` | Daily swap volume through NEAR Intents (USD) |
| `api.llama.fi/summary/fees/near-intents` (`dailyFees`, `dailyRevenue`, `dailyHoldersRevenue`) | Gross Intents fees; what NEAR captures; the part used to buy back NEAR since 2026-02-23 |

- **Window:** full months from Jan 2025 (the first full month of Intents volume) to Oct 2026, so 22 months. Weekly tests use 95 full Monday-to-Sunday weeks.
- **Code:** every calculation is in `web/metrics.mjs`. The same file runs in Node (`rebuild.mjs`) and in the dashboard, so the page and this document cannot disagree.

## Evidence for

1. **Usage moved to Intents.** Monthly Intents volume went from **$6.4M** (Jan 2025) to **$3.99B** (Oct 2026), **622x**. Over the same months, daily transactions fell **89.8%** (7.17M to 0.73M) and daily active accounts fell **91.8%** (883K to 72K). *(Chart 1)*
2. **Intents is now NEAR's main source of revenue.** In Oct 2026, Intents charged **$6.39M** in gross fees, and NEAR kept **$2.19M**. Gas fees on the entire chain were **$196K** that month. So NEAR's Intents revenue was **11.2x** its gas economy, and it has exceeded gas fees in every month since DefiLlama began tracking it (Nov 2025). *(Chart 4)*
3. **The revenue now reaches holders.** Since 2026-02-23, captured Intents revenue has gone to open-market NEAR buybacks: **$8.15M** through 12 Nov 2026. At each day's price, that is about **3.32M NEAR**. *(Chart 5)*
4. **Issuance is modest.** Net total supply grew **2.48%** over the last 365 days, which includes issuance minus burnt gas.
5. **During the buyback era, price and volume moved together.** From Mar to Oct 2026, the monthly price and Intents volume have a log correlation of **0.86**. That is only 8 points, so read it as a description, not a test.

## Evidence against

1. **The price did not follow Intents volume.** Over the full 22 months, the correlation between log monthly price and log Intents volume is **-0.51**, and for monthly changes it is **-0.08**. Volume rose about 622x while the monthly average price ended **4.6%** below Jan 2025. *(Chart 2)*
2. **Intents volume does not lead the price.** No lag from -6 to +6 weeks shows a correlation between weekly volume changes and later price changes outside the ±0.20 noise band. Transactions don't lead the price either. *(Chart 3)*
3. **Holders are still being diluted.** Buybacks absorbed **14.4%** of the **23.05M** NEAR of net new supply since 2026-02-23. At the last three months' run-rate, they absorb about **16%**. *(Chart 5, model)*
4. **Fewer people use NEAR directly.** A 90% fall in transactions and active accounts is a real loss of direct usage, whatever the cause. One step accounts for much of it: transactions per day fell **73%** between Mar and Apr 2026 (3.48M to 0.95M). These sources can't say which application stopped (see Limits).
5. **NEAR doesn't control its take.** Over Aug–Oct 2026, Intents gross fees were **0.152%** of volume. NEAR captured **0.041%**, which is **27.1%** of fees; solvers and front-ends kept the rest. Both the split and the buyback are policy choices that can change.

## The model: when would buybacks cover new supply?

`breakeven monthly volume = (net new NEAR per month × NEAR price) ÷ captured rate`

The inputs, from Aug–Oct 2026 and the latest day:
- **Net new NEAR:** 2.69M per month.
- **Price:** $3.59.
- **Captured rate:** 0.041% of volume.

**The result:** break-even is about **$23.5B of Intents volume a month**, which is **6.1x** the recent average of $3.86B.

**What lowers the bar:**
- a higher captured rate;
- lower issuance;
- a lower price (each dollar of buyback then buys more NEAR, which helps coverage but not holders).

The dashboard has this calculator with editable inputs.

## What would change my mind

**Bearish:**
- Captured Intents revenue falls below chain gas fees for 3 months in a row.
- Monthly Intents volume stays under $1B for 3 months in a row.
- The buyback stops (no `dailyHoldersRevenue` for 30 days).

**Thesis-breaking even if bullish:**
- Buyback coverage passes 50% of new supply, and the price still shows no relationship to Intents volume. That would mean the flow doesn't matter to the token.

## Limits: what these sources can't tell us

- **Why transactions fell in Apr 2026:** this needs per-contract counts, for example `near.actions` on Dune or `bigquery-public-data.crypto_near_mainnet_us`, grouped by receiver. Not run here.
- **Intents volume by chain, asset or solver:** this needs the NEAR Intents Explorer API, which requires a partner JWT. Without it, volume concentration is unknown.
- **Tracking start dates:** DefiLlama tracks Intents fees from 2025-06-11 and captured revenue from 2025-11-07. Earlier months show "not tracked", not zero.
- **Buyback size:** NEAR bought back is estimated as USD ÷ that day's average price, not from actual fills.
- **Third-party data:** all volume and revenue figures are DefiLlama's methodology, not an independent on-chain reconciliation.

## Reproduce

```bash
node rebuild.mjs            # download raw data, recompute data/metrics.json, redraw charts/*.svg
node rebuild.mjs --offline  # same, from the saved raw files in data/raw/
```
