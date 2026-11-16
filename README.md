# Token Radar

A token launch radar: from a frozen DefiLlama protocol snapshot, find the protocols that
record **no token** (and are not a wrapped, staked or bridged product of a token that already
trades), rank them by their **implied launch value**, and present them in a dashboard that
shows the model, the comparables and a concrete farm plan for every row.

Built for the make.fun bounty **"Build the best token launch radar"** (token-radar-01).

## What it scores

- **Snapshot:** 758 protocols, TVL >= $5M, as of 2026-11-14 (DefiLlama protocol index).
- **Watchlist:** 40 protocols with TVL >= $50M and no token on record. The watchlist is the
  floor, not the ceiling: the board adds every other pre-token protocol below the floor that
  passes the same rankability test, for **198 rows** in total.
- **Live-token protocols set aside:** 24. They already trade, so their market cap is a fact,
  not a model — and they are the comparables the multiples are priced from.

## The model (radar-2)

`implied = round( tvl_usd x category_multiple x growth_mult x maturity_mult )`

- **Category multiple.** The median market-cap-to-TVL ratio of the live-token protocols in
  the same category, each ratio capped at 3x before the median so one thin-TVL outlier cannot
  set it, then shrunk toward the market-wide median (0.214) with k=3 and clamped to
  [0.05, 2.0]. A category with no live comparables takes the market median. The multiple is
  the market itself, not a number chosen by hand.
- **Growth multiplier.** `1 + clamp(change_7d, -60, 120) / 100 x 0.5` — a protocol growing
  fast is worth more than a flat one at the same TVL; the clamp keeps one hot week from
  dominating.
- **Maturity multiplier.** `0.6 + min(age_days, 1095) / 1095 x 0.4` — age is the time since
  the protocol was first listed, the best record of how long it has run with no token. An
  unlisted age uses 365 days.
- **Rankable (the full house rule).** A protocol is ranked only if it records no token AND
  is not a wrapped/staked/bridged product of a token that already trades: categories Bridge,
  Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC and CEX are excluded, as
  are versioned names, names containing the whole word wrapped/staked/staking, and names
  beginning with an exchange name. That is what keeps WBTC, Binance staked ETH and Coinbase
  Bridge off the board — they are not launches still to come.

Top five by implied value: Steakhouse Financial $1.97B, Sentora Curator $1.89B, Gauntlet
$1.17B, Polymarket International $289.9M, Nonce Capital $272.4M. The Risk Curators multiple
(0.904x) rests on a single live comparable (Api3, 2.975x) — the dashboard's methodology
panel shows the comp count for every category, so that thinness is visible, not hidden.

## Farm plans

Every row carries six steps, derived from the protocol's own category, chains, TVL and age —
never a hardcoded name. Each step states its cost and its time: a fresh wallet, the deposit
(capital $50–$250 by TVL, gas by chain: Ethereum $8, Solana/Sui/Aptos $0.05, Binance $0.30,
Avalanche $0.50, Polygon $0.10, Tron $1, Bitcoin/Bittensor $2, other chains $1), a weekly
qualifying action, a hold (60 days if the protocol is under 180 days old, 45 under a year,
30 otherwise), claiming only from the protocol's own published link, and a farm log. The
dashboard recomputes each row's plan from the same derivation, so the page and board.json
always agree.

## Run it

Node 22, stdlib only, no network, no install.

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

That writes `out/board.json`, `out/data.js`, `out/dashboard/` (3 files), `out/screenshots/`
(3 images) and `out/dossier.json`. Serve `out/` over local HTTP and open
`dashboard/index.html` — the page reads `data.js` and renders with no network.

```sh
cd out && python3 -m http.server 8000
# open http://127.0.0.1:8000/dashboard/index.html
```

## The dashboard

A dark radar console: headline stats, a top-five spotlight, search plus category and chain
filters, a sortable pre-token board, a live-token tab, a methodology panel with the full
category-multiples table, and a detail drawer for every protocol with its model breakdown,
its live comparables and its farm plan. State lives in the URL hash (`#q=`, `#category=`,
`#chain=`, `#p=<slug>`), so any row or filtered view is a link.

## Files

- `main.ts` — entrypoint: reads the snapshot, builds the board, writes the outputs.
- `lib/model.ts` — the radar-2 model: multiples, implied value, comparables, rankability,
  farm plans, board and dossier builders.
- `dashboard/` — `index.html`, `app.css`, `app.js` (no external requests).
- `vendor/makefun-board.ts` — the house board/dossier writer, unmodified.
- `screenshots/` — board, detail and filtered views, taken from the running dashboard.
- `.makefun/owner.json` — the entry owner's wallet.

## What this radar does not do

It does not predict whether or when a protocol issues a token. Implied value is this
entry's own claim from the snapshot's figures, never a price and never make.fun's. A
protocol that records no token in the snapshot may still have one the record does not carry.

## License

MIT — see `LICENSE`.
