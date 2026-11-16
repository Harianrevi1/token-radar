# Token Radar — which DeFi protocols are the most valuable launches still to come?

This entry watches a frozen DefiLlama snapshot and asks one question: among the protocols
that have **never issued a token**, which ones would be worth the most if they launched one
tomorrow? It answers with a ranked board of 198 protocols, a dashboard that lays the working
bare, and a farm plan for every single row.

Built for the make.fun bounty **"Build the best token launch radar"** (token-radar-01).

## The snapshot it reads

- **758 protocols**, each holding at least $5M of TVL, captured 2026-11-14 from the
  DefiLlama protocol index.
- **A 40-protocol watchlist** — every protocol over $50M TVL with no token on record. The
  watchlist is a floor, not a ceiling: the board also ranks every other pre-token protocol
  below that floor that clears the same rankability test, which is how the board reaches
  **198 rows**.
- **24 live-token protocols kept apart.** They already trade, so their market caps are
  observed facts rather than modelled guesses — and they are the raw material the multiples
  are priced from.

## How a protocol is priced (model radar-2)

`implied = round( tvl_usd x category_multiple x growth_mult x maturity_mult )`

- **Category multiple.** Take every live-token protocol in the same category, read each
  one's market-cap-to-TVL ratio, cap each ratio at 3x so a single thin-TVL outlier cannot
  set the price, then take the median. Shrink that median toward the market-wide median
  (0.214) with k=3 and clamp the result to [0.05, 2.0]. A category with no live
  comparables simply takes the market median. The multiple comes from the market, not from
  a number picked by hand.
- **Growth multiplier.** `1 + clamp(change_7d, -60, 120) / 100 x 0.5`. A protocol growing
  quickly is worth more than a flat one at the same TVL; the clamp stops one hot week from
  running away with the ranking.
- **Maturity multiplier.** `0.6 + min(age_days, 1095) / 1095 x 0.4`. Age counts from the
  day the protocol first appeared in the listing — the best available record of how long it
  has operated without a token. A protocol with no listing date is treated as 365 days old.
- **Who gets ranked.** A protocol must record no token at all, and must not be a
  wrapped, staked or bridged product of a token that already trades. That excludes the
  Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC and CEX
  categories, versioned names, names carrying the whole word wrapped, staked or staking,
  and names that start with an exchange name. It is the rule that keeps WBTC, Binance
  staked ETH and Coinbase Bridge off the board: they are not launches waiting to happen.

The five largest implied values: Steakhouse Financial $1.97B, Sentora Curator $1.89B,
Gauntlet $1.17B, Polymarket International $289.9M, Nonce Capital $272.4M. One multiple is
thinly supported — Risk Curators at 0.904x rests on a single live comparable (Api3 at
2.975x) — and the dashboard's methodology panel prints the comp count for every category,
so that thinness is on display rather than hidden.

## Farm plans

Every row ships with six steps, built from that protocol's own category, chains, TVL and
age — no name is ever hardcoded. Each step names what it costs and how long it takes: a
fresh wallet; the deposit (capital $50–$250 scaled by TVL, gas priced by chain: Ethereum
$8, Solana/Sui/Aptos $0.05, Binance $0.30, Avalanche $0.50, Polygon $0.10, Tron $1,
Bitcoin/Bittensor $2, anything else $1); one qualifying action a week; a hold (60 days
when the protocol is under 180 days old, 45 under a year, 30 otherwise); claiming only
from the protocol's own published link; and a farm log. The dashboard re-derives each
row's plan from the same rules, so the page and board.json can never drift apart.

## Running it

Node 22, standard library only. No network, nothing to install.

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

That produces `out/board.json`, `out/data.js`, `out/dashboard/` (3 files), `out/screenshots/`
(3 images) and `out/dossier.json`. Serve `out/` over local HTTP and open
`dashboard/index.html` — the page reads `data.js` and renders with no network at all.

```sh
cd out && python3 -m http.server 8000
# open http://127.0.0.1:8000/dashboard/index.html
```

## What the dashboard shows

A dark radar console: headline figures, a top-five spotlight, search plus category and
chain filters, a sortable pre-token board, a live-token tab, a methodology panel carrying
the full category-multiples table, and a detail drawer for every protocol with its model
breakdown, its live comparables and its farm plan. The view lives in the URL hash
(`#q=`, `#category=`, `#chain=`, `#p=<slug>`), so any row or filtered view is a link you
can share.

## Layout

- `main.ts` — entrypoint: reads the snapshot, builds the board, writes the outputs.
- `lib/model.ts` — the radar-2 model: multiples, implied value, comparables, rankability,
  farm plans, board and dossier builders.
- `dashboard/` — `index.html`, `app.css`, `app.js` (no external requests).
- `vendor/makefun-board.ts` — the house board/dossier writer, unmodified.
- `screenshots/` — board, detail and filtered views, captured from the running dashboard.
- `.makefun/owner.json` — the entry owner's wallet.

## What this radar does not do

It does not predict whether or when a protocol issues a token. Implied value is this
entry's own claim built from the snapshot's figures — never a price, and never make.fun's.
A protocol that records no token in the snapshot may still hold one the record does not
carry.

## License

MIT — see `LICENSE`.
