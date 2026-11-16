// Token Radar dashboard. It takes window.RADAR (written beside dashboard/ by main.ts) and draws
// the ranked board, a filterable table, and a per-protocol detail drawer carrying the model's own
// inputs, its live comparables and the protocol's farm plan. No network: every byte it shows lives
// in data.js, so the page works from disk or any static host.
(function () {
  'use strict';

  var RADAR = window.RADAR;
  if (!RADAR) return;
  var board = document.getElementById('board');
  var view = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function money(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return moneyFmt.format(n);
  }
  function pct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function ageText(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  // The model in one place: the page re-derives a row from the snapshot figures and checks the
  // number board.json carries, so the page's arithmetic and the board's data are visibly the same
  // calculation. The multiple is the row's own category multiple, priced from that category's live
  // comparables, never a number typed in by hand.
  function recompute(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * growthMult * maturity));
  }

  function tag(name, attrs) {
    var elem = document.createElement(name);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') elem.className = attrs[k];
        else if (k === 'text') elem.textContent = attrs[k];
        else if (k === 'html') elem.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') elem.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) elem.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid === null || kid === undefined) continue;
      if (Array.isArray(kid)) kid.forEach(function (c) { if (c) elem.appendChild(c); });
      else if (typeof kid === 'string') elem.appendChild(document.createTextNode(kid));
      else elem.appendChild(kid);
    }
    return elem;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and age
  // decide the action, the capital, the hold and every cost and time. No name is special-cased, so a
  // new protocol gets a plan the moment it lands on the board.
  function firstChain(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function stakeFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function gasCost(chain) {
    var c = String(chain).toLowerCase();
    if (c === 'ethereum') return 8;
    if (c === 'solana' || c === 'sui' || c === 'aptos') return 0.05;
    if (c === 'binance') return 0.3;
    if (c === 'avalanche') return 0.5;
    if (c === 'polygon') return 0.1;
    if (c === 'tron') return 1;
    if (c === 'bitcoin' || c === 'bittensor') return 2;
    return 1;
  }
  function gasLabel(chain) {
    var g = gasCost(chain);
    return g < 1 ? '$' + g.toFixed(2) : '$' + Math.round(g);
  }
  function actionText(p, stake, chain) {
    var cat = (p.category || '').toLowerCase();
    var proto = p.name;
    if (cat.indexOf('lend') >= 0 || cat.indexOf('cdp') >= 0 || cat.indexOf('collateral') >= 0) return 'Supply $' + stake + ' of USDC to ' + proto + ' on ' + chain + ' and keep the position open.';
    if (cat.indexOf('dex') >= 0 || cat.indexOf('yield') >= 0 || cat.indexOf('leveraged farm') >= 0) return 'Provide $' + stake + ' of liquidity to ' + proto + "'s main pool on " + chain + ' and keep the position open.';
    if (cat.indexOf('basis') >= 0) return 'Deposit $' + stake + " into " + proto + "'s basis strategy on " + chain + ' and keep the position open.';
    if (cat.indexOf('bridge') >= 0) return 'Bridge $' + stake + ' of USDC to ' + chain + ' through ' + proto + ' and use the bridged funds in its app.';
    if (cat.indexOf('staking') >= 0 || cat.indexOf('restak') >= 0) return "Stake $" + stake + " of the chain's staking asset through " + proto + ' and keep the receipt.';
    if (cat.indexOf('perpetual') >= 0 || cat.indexOf('derivative') >= 0) return 'Deposit $' + stake + ' of USDC as margin on ' + proto + ' and open one small hedge.';
    if (cat.indexOf('prediction') >= 0) return 'Fund $' + stake + ' and place one market position on ' + proto + '.';
    if (cat.indexOf('curator') >= 0 || cat.indexOf('allocator') >= 0 || cat.indexOf('risk') >= 0) return 'Deposit $' + stake + ' into a ' + proto + ' vault on ' + chain + ' and keep the shares.';
    if (cat.indexOf('stable') >= 0) return 'Mint or deposit $' + stake + ' of the stable asset through ' + proto + ' on ' + chain + '.';
    if (cat.indexOf('rwa') >= 0) return "Mint $" + stake + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (cat.indexOf('insurance') >= 0) return 'Buy $' + stake + ' of cover from ' + proto + ' on ' + chain + ' and keep the policy.';
    if (cat.indexOf('governance') >= 0) return 'Deposit $' + stake + ' on ' + proto + ' and take part in one governance vote.';
    if (cat.indexOf('chain') >= 0) return 'Bridge $' + stake + ' of USDC onto ' + proto + ' and use one of its apps, keeping the funds there.';
    if (cat.indexOf('launchpad') >= 0) return 'Commit $' + stake + ' to one sale on ' + proto + ' on ' + chain + ' and hold the allocation.';
    if (cat.indexOf('index') >= 0) return 'Buy $' + stake + ' of the ' + proto + ' index on ' + chain + ' and hold the shares.';
    return 'Deposit $' + stake + ' of USDC into ' + proto + ' on ' + chain + ' and keep the position open.';
  }
  function stepLine(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function planSteps(p) {
    var chain = firstChain(p);
    var stake = stakeFor(p);
    var hold = holdFor(p.age_days);
    var gas = gasLabel(chain);
    var others = p.chains && p.chains.length > 1 ? ' It also runs on ' + p.chains.slice(1, 3).join(', ') + '.' : '';
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionText(p, stake, chain) + others, cost: '$' + stake + ' of capital and about ' + gas + ' of gas on ' + chain, time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about ' + gas + ' of gas a week on ' + chain, time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + stake + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepLine);
  }

  function loadHash() {
    var frag = window.location.hash.replace(/^#/, '');
    var query = new URLSearchParams(frag);
    // The hash carries the whole view: a hash without p means no detail is open, so a filtered link
    // never inherits a dialog from the page it was navigated from.
    view.q = query.get('q') || '';
    view.selected = query.get('p');
    view.category = query.get('category') || 'all';
    view.chain = query.get('chain') || 'all';
  }
  function saveHash() {
    var query = new URLSearchParams();
    if (view.q) query.set('q', view.q);
    if (view.category !== 'all') query.set('category', view.category);
    if (view.chain !== 'all') query.set('chain', view.chain);
    if (view.selected) query.set('p', view.selected);
    var next = query.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function visibleRows() {
    var term = view.q.trim().toLowerCase();
    return RADAR.rows.filter(function (r) {
      if (view.category !== 'all' && r.category !== view.category) return false;
      if (view.chain !== 'all' && !(r.chains || []).some(function (c) { return c === view.chain; })) return false;
      if (!term) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(term) >= 0;
    });
  }
  function orderedRows(items) {
    var sortKey = view.sort;
    return items.slice().sort(function (a, b) {
      var aVal, bVal;
      if (sortKey === 'name') { aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); }
      else if (sortKey === 'tvl') { aVal = a.tvl_usd; bVal = b.tvl_usd; }
      else if (sortKey === 'growth') { aVal = a.change_7d === null ? -Infinity : a.change_7d; bVal = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (sortKey === 'age') { aVal = a.age_days === null ? Infinity : a.age_days; bVal = b.age_days === null ? Infinity : b.age_days; }
      else { aVal = a.implied_value_usd; bVal = b.implied_value_usd; }
      if (aVal < bVal) return -view.dir;
      if (aVal > bVal) return view.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function masthead() {
    return tag('header', { class: 'top' },
      tag('div', { class: 'brand' }, tag('span', { class: 'mark' }), tag('span', { class: 'brand-name', text: 'Token Radar' })),
      tag('div', { class: 'top-meta' },
        tag('span', { text: 'Snapshot ' + RADAR.as_of }),
        tag('span', { text: 'DefiLlama protocol index' }),
        tag('span', { text: RADAR.model_version + ' model' })
      )
    );
  }

  function intro() {
    var preTvl = RADAR.rows.reduce(function (n, r) { return n + r.tvl_usd; }, 0);
    return tag('section', { class: 'lede' },
      tag('div', null,
        tag('h1', { text: RADAR.board_size + ' pre-token protocols, ranked by implied value' }),
        tag('p', null,
          'The watchlist is the floor: every protocol with at least ',
          tag('b', { text: '$' + Math.round(RADAR.floor_usd / 1e6) + 'M' }),
          ' of TVL and no token on record. The radar adds ',
          tag('b', { text: String(RADAR.early_size) }),
          ' more pre-token protocols below that floor, priced against the live market in their own category. Implied value is a model, not a promise.'
        )
      ),
      tag('div', { class: 'facts' },
        tag('div', { class: 'fact' }, tag('span', { text: 'Watchlist covered' }), tag('b', { text: RADAR.watchlist_size + ' / ' + RADAR.watchlist_size })),
        tag('div', { class: 'fact' }, tag('span', { text: 'Pre-token rows scored' }), tag('b', { text: String(RADAR.board_size) })),
        tag('div', { class: 'fact' }, tag('span', { text: 'Pre-token TVL on the board' }), tag('b', { text: money(preTvl) })),
        tag('div', { class: 'fact' }, tag('span', { text: 'Live-token protocols set aside' }), tag('b', { text: String(RADAR.live_size) }))
      )
    );
  }

  function topFive() {
    var top = RADAR.rows.slice(0, 5);
    var cards = top.map(function (r) {
      return tag('button', { type: 'button', class: 'spot-card', onclick: function () { showDetail(r.slug); } },
        tag('span', { class: 'rank', text: 'RANK ' + r.rank }),
        tag('span', { class: 'name', text: r.name }),
        tag('span', { class: 'cat', text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains[0] : '—') }),
        tag('span', { class: 'val', text: money(r.implied_value_usd) }),
        tag('span', { class: 'tvl', text: 'TVL ' + money(r.tvl_usd) })
      );
    });
    return tag('section', { class: 'spot', 'aria-label': 'Top five by implied value' },
      tag('div', { class: 'spot-title', text: 'Top five by implied value' }),
      cards
    );
  }

  function filters() {
    var categories = Array.from(new Set(RADAR.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chainCounts = {};
    RADAR.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { chainCounts[c] = (chainCounts[c] || 0) + 1; }); });
    var chains = Object.keys(chainCounts).sort(function (a, b) { return chainCounts[b] - chainCounts[a]; });
    var search = tag('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: view.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { view.q = search.value; saveHash(); draw(); });
    var select = tag('select', { id: 'category', 'aria-label': 'Filter by category' },
      tag('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return tag('option', { value: c, text: c, selected: c === view.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { view.category = select.value; saveHash(); draw(); });
    var chainSel = tag('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      tag('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return tag('option', { value: c, text: c + ' (' + chainCounts[c] + ')', selected: c === view.chain ? 'selected' : null }); })
    );
    chainSel.addEventListener('change', function () { view.chain = chainSel.value; saveHash(); draw(); });
    var pre = tag('button', { type: 'button', 'aria-pressed': view.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { view.tab = 'pre-token'; draw(); } });
    var live = tag('button', { type: 'button', 'aria-pressed': view.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { view.tab = 'live'; draw(); } });
    return tag('div', { class: 'controls' },
      tag('div', { class: 'field' }, tag('label', { for: 'q', text: 'Search' }), search),
      tag('div', { class: 'field' }, tag('label', { for: 'category', text: 'Category' }), select),
      tag('div', { class: 'field' }, tag('label', { for: 'chain', text: 'Chain' }), chainSel),
      tag('div', { class: 'field' }, tag('span', { class: 'sub', text: 'Token status' }), tag('div', { class: 'tabs' }, pre, live)),
      tag('span', { class: 'count', text: view.tab === 'pre-token' ? visibleRows().length + ' rows shown' : RADAR.live.length + ' live-token protocols' })
    );
  }

  function sortHead(key, label) {
    return tag('th', { scope: 'col' },
      tag('button', { type: 'button', onclick: function () { if (view.sort === key) view.dir = -view.dir; else { view.sort = key; view.dir = -1; } draw(); } },
        label,
        view.sort === key ? tag('span', { 'aria-hidden': 'true', text: view.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function preTokenTable() {
    var items = orderedRows(visibleRows());
    if (items.length === 0) {
      return tag('div', { class: 'panel' }, tag('div', { class: 'empty' },
        tag('h2', { text: 'No protocol matches that filter' }),
        tag('p', { text: 'Clear the search or pick another category to see the board again.' }),
        tag('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { view.q = ''; view.category = 'all'; view.chain = 'all'; saveHash(); draw(); } })
      ));
    }
    var max = items[0].implied_value_usd || 1;
    var tbody = tag('tbody');
    items.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : pct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = tag('tr', {
        'data-selected': view.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { showDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(r.slug); } }
      },
        tag('td', { class: 'num', text: String(r.rank) }),
        tag('td', null, tag('div', { class: 'name' },
          tag('b', { text: r.name }),
          tag('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        tag('td', { class: 'num', text: money(r.tvl_usd) }),
        tag('td', { class: 'num ' + growthClass, text: growth }),
        tag('td', { class: 'num', text: ageText(r.age_days) }),
        tag('td', null, tag('div', { class: 'implied' },
          tag('div', { class: 'bar', 'aria-hidden': 'true' }, tag('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          tag('span', { class: 'num', text: money(r.implied_value_usd) })
        )),
        tag('td', null, tag('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return tag('div', { class: 'panel' },
      tag('div', { class: 'table-wrap' },
        tag('table', null,
          tag('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model, comparables and farm plan.' }),
          tag('thead', null, tag('tr', null,
            sortHead('implied', 'Rank'),
            sortHead('name', 'Protocol'),
            sortHead('tvl', 'TVL'),
            sortHead('growth', '7d'),
            sortHead('age', 'Age'),
            sortHead('implied', 'Implied value'),
            tag('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTokenTable() {
    var tbody = tag('tbody');
    RADAR.live.forEach(function (r) {
      tbody.appendChild(tag('tr', null,
        tag('td', { class: 'num', text: 'live' }),
        tag('td', null, tag('div', { class: 'name' }, tag('b', { text: r.name }), tag('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        tag('td', { class: 'num', text: money(r.tvl_usd) }),
        tag('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: pct(r.change_7d) }),
        tag('td', { class: 'num', text: money(r.mcap_usd) }),
        tag('td', null, tag('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return tag('div', { class: 'panel' },
      tag('div', { class: 'table-wrap' },
        tag('table', null,
          tag('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking — and they are the comparables the multiples are priced from.' }),
          tag('thead', null, tag('tr', null, tag('th', { scope: 'col', text: 'Status' }), tag('th', { scope: 'col', text: 'Protocol' }), tag('th', { scope: 'col', text: 'TVL' }), tag('th', { scope: 'col', text: '7d' }), tag('th', { scope: 'col', text: 'Market cap' }), tag('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function methodPanel() {
    var m = RADAR.model;
    var multRows = (RADAR.multiples || []).map(function (x) {
      return tag('tr', null,
        tag('td', { text: x.category }),
        tag('td', { class: 'num', text: String(x.comps) }),
        tag('td', { class: 'num', text: x.median === null ? 'market' : x.median.toFixed(3) + 'x' }),
        tag('td', { class: 'num', text: x.multiple.toFixed(3) + 'x' })
      );
    });
    return tag('section', { class: 'panel model' },
      tag('h2', { text: 'How implied value is computed' }),
      tag('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      tag('div', { class: 'formula' },
        'implied = round( tvl_usd x ',
        tag('b', { text: 'category multiple' }),
        ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') )'
      ),
      tag('p', { class: 'sub', text: 'The category multiple is the market itself: the median market-cap-to-TVL ratio of the live-token protocols in that category, each ratio capped at ' + m.winsor_cap + 'x before the median so one thin-TVL outlier cannot set it, then shrunk toward the market-wide median by k=' + m.shrink_k + ' and clamped to [' + m.multiple_floor + ', ' + m.multiple_cap + ']. A category with no live comparables takes the market median. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. Wrapped, staked and bridged products of tokens that already trade are never ranked, however large their TVL.' }),
      tag('div', { class: 'mult-wrap' },
        tag('table', null,
          tag('thead', null, tag('tr', null,
            tag('th', { scope: 'col', text: 'Category' }),
            tag('th', { scope: 'col', text: 'Live comps' }),
            tag('th', { scope: 'col', text: 'Median mcap/TVL' }),
            tag('th', { scope: 'col', text: 'Multiple used' })
          )),
          tag('tbody', null, multRows)
        )
      )
    );
  }

  var drawer = tag('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  var holdClose = false;
  drawer.addEventListener('close', function () {
    if (holdClose) return;
    view.selected = null; saveHash();
  });

  function showDetail(slug) {
    var row = RADAR.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    view.selected = slug;
    saveHash();
    drawer.textContent = '';
    var steps = planSteps(row);
    var compList = (row.comps || []).map(function (c) {
      return tag('div', { class: 'comp' },
        tag('span', { text: c.name + ' (' + c.slug + ')' }),
        tag('b', { class: 'num', text: c.ratio.toFixed(3) + 'x mcap/TVL' })
      );
    });
    drawer.appendChild(tag('div', { class: 'detail-head' },
      tag('div', null,
        tag('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + RADAR.board_size }),
        tag('h2', { id: 'detail-title', text: row.name }),
        tag('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      tag('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { drawer.close(); } })
    ));
    drawer.appendChild(tag('section', { class: 'detail-section' },
      tag('h3', { text: 'Implied value' }),
      tag('div', { class: 'equation' },
        tag('div', null, tag('span', { text: 'TVL' }), tag('b', { class: 'num', text: money(row.tvl_usd) })),
        tag('div', null, tag('span', { text: 'Seven-day growth' }), tag('b', { class: 'num', text: pct(row.change_7d) })),
        tag('div', null, tag('span', { text: 'Age with no token' }), tag('b', { class: 'num', text: ageText(row.age_days) })),
        tag('div', null, tag('span', { text: 'Category multiple' }), tag('b', { class: 'num', text: row.category_multiple.toFixed(3) + 'x' })),
        tag('div', null, tag('span', { text: 'Growth multiplier' }), tag('b', { class: 'num', text: String(row.growth_multiplier) })),
        tag('div', null, tag('span', { text: 'Maturity multiplier' }), tag('b', { class: 'num', text: String(row.maturity_multiplier) })),
        tag('div', null, tag('span', { text: 'Implied value' }), tag('b', { class: 'num', text: money(row.implied_value_usd) }))
      ),
      tag('p', { class: 'sub', text: 'Model ' + RADAR.model_version + ': the same function scores every protocol. The page recomputes this row as ' + money(recompute(row, RADAR.model)) + (recompute(row, RADAR.model) === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    drawer.appendChild(tag('section', { class: 'detail-section' },
      tag('h3', { text: 'Priced against' }),
      tag('p', { class: 'sub', text: 'Live-token protocols in the same category, nearest this multiple first. Their market caps are facts, not a model.' }),
      tag('div', { class: 'comps' }, compList.length > 0 ? compList : tag('p', { class: 'sub', text: 'No live-token protocol in this category: the market-wide median prices it.' }))
    ));
    drawer.appendChild(tag('section', { class: 'detail-section' },
      tag('h3', { text: 'Farm plan' }),
      tag('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return tag('li', null, tag('b', { text: action }), tag('span', { class: 'cost', text: tail }));
      }))
    ));
    drawer.appendChild(tag('section', { class: 'detail-section' },
      tag('p', { class: 'sub', text: 'This protocol records no token in the snapshot. That is the record, not proof it has none: a token may exist that the record does not carry.' })
    ));
    if (typeof drawer.showModal === 'function') {
      if (!drawer.open) drawer.showModal();
    } else {
      drawer.setAttribute('open', '');
    }
  }

  function pageFoot() {
    return tag('footer', { class: 'foot' },
      tag('p', null,
        tag('b', { text: 'What this radar does not do. ' }),
        'It does not predict whether or when a protocol issues a token. Implied value is the entry\u2019s own claim from the snapshot\u2019s figures, never a price and never make.fun\u2019s.'
      ),
      tag('p', { text: 'Source: DefiLlama protocol index, snapshot ' + RADAR.as_of + '. Model ' + RADAR.model_version + '. Board of ' + RADAR.board_size + ' pre-token protocols; ' + RADAR.live_size + ' live-token protocols set aside with their market caps.' })
    );
  }

  function draw() {
    // A modal dialog removed from the DOM stays open when re-inserted, so close it here first and
    // only re-open it when the hash still names a protocol. The close listener is held back so it
    // does not clear the selection the hash just gave us.
    if (drawer.open) { holdClose = true; drawer.close(); holdClose = false; }
    board.textContent = '';
    var shell = tag('div', { class: 'shell' });
    shell.appendChild(masthead());
    shell.appendChild(intro());
    if (view.tab === 'pre-token') shell.appendChild(topFive());
    shell.appendChild(filters());
    shell.appendChild(view.tab === 'pre-token' ? preTokenTable() : liveTokenTable());
    if (view.tab === 'pre-token') shell.appendChild(methodPanel());
    shell.appendChild(pageFoot());
    board.appendChild(shell);
    board.setAttribute('aria-busy', 'false');
    if (!drawer.isConnected) board.appendChild(drawer);
    if (view.selected) showDetail(view.selected);
  }

  loadHash();
  draw();
  window.addEventListener('hashchange', function () { loadHash(); draw(); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.open) drawer.close();
  });
})();
