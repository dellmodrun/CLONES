const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const CONTRACT_ADDRESS = 'NRWU4Ritj1x6jcNbpuyfoX76D7BQ8c6RfjjLoBkpump';
const PUMP_URL = `https://pump.fun/coin/${CONTRACT_ADDRESS}`;
const X_URL = 'https://x.com/clonesonchain';
const EXPLORER_URL = 'https://solscan.io';
const API_BASE = String(globalThis.CLONES_RUNTIME_URL || '').replace(/\/$/, '');
const STATIC_HOST = !API_BASE && !['localhost', '127.0.0.1'].includes(location.hostname);
const STATIC_AGENT = {
  id: 1,
  pumpName: 'clone_0001',
  style: 'Genesis',
  status: 'active',
  trading: 'active',
  avatarUrl: './clones.png',
  address: '7eFwJZ8uSvFxcqxoXMQXzqcVpFF4L286A1bMqsPrgmLo',
  bankStartUsd: 5,
  bankUsd: 5,
  pnlUsd: 0,
  clonesUsd: 5,
  trades: 1,
  wins: 0,
  openPositions: 0,
  note: 'Active on Solana mainnet. Permanent CLONES allocation confirmed; the trading bank is ready.',
};
const STATIC_TRADE = {
  id: '4nc2s2pKEFbxu5bW5vGe3AQsYRz3uEn26rLBEL2FPGGVXJEnpNYFMqHqRfKwbKoif9T4BJ5es2NXJ3288oDrTLSJ',
  agentId: 1, side: 'buy', symbol: 'CLONES', usd: 5, status: 'submitted',
  tx: '4nc2s2pKEFbxu5bW5vGe3AQsYRz3uEn26rLBEL2FPGGVXJEnpNYFMqHqRfKwbKoif9T4BJ5es2NXJ3288oDrTLSJ',
  reason: 'Permanent initial CLONES allocation for the first funded Clone',
  at: Date.parse('2026-11-03T13:55:30Z'),
};
const STATIC_POSITION = {
  symbol: 'CLONES', amount: 1321991.881279, inUsd: 5, currentUsd: 5, pnlUsd: 0,
  reason: 'Permanent protocol allocation. This position is never sold.',
};
const STATIC_STATE = {
  mode: 'launched',
  network: 'Solana',
  ticker: 'CLONES',
  ca: CONTRACT_ADDRESS,
  xUrl: X_URL,
  pumpUrl: PUMP_URL,
  teamPct: 10,
  agentUsd: 10,
  clonesBuyUsd: 5,
  bankUsd: 5,
  sweepUsd: 10,
  updatedAt: '2026-11-03T13:55:30Z',
  token: { marketCap: 3732.52 },
  agents: {
    total: 1,
    active: 1,
    stopped: 0,
    bankUsd: 5,
    investedUsd: 5,
    profitToClonesUsd: 0,
    trades: 1,
    wins: 0,
    calloutsPosted: 0,
    calloutsQueued: 0,
    heldPct: null,
  },
  next: { number: 2, agent: null, haveUsd: 2.24, needUsd: 10, ready: 0.224 },
  fees: {
    claimedUsd: 13.6, unclaimedUsd: 0, spentUsd: 10, teamUsd: 1.36,
    claims: [{
      amountUsd: 13.6, source: 'pump-creator-fee-mainnet',
      signature: '5w3ubZqzsKD8c7vNV6gtndHCNzTcmCpYaQJEmqCnZjDGasCK5YrQ9hUEAMoVB8u26dd8vbVmvZfHtD28BesEaocp',
      observedAt: '2026-11-03T13:54:38Z',
    }],
  },
  treasury: '758St9w818ghEdU6iQL9ztbJast1L2Bh673zd3aDbAu1',
  chain: { treasuryLamports: 521288281 },
};

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));
const usd = (value, digits) => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const amount = Number(value);
  const places = digits ?? (Math.abs(amount) < 100 ? 2 : 0);
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places })}`;
};
const integer = (value) => Number(value || 0).toLocaleString('en-US');
const compact = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (number >= 1e9) return `${(number / 1e9).toFixed(2)}B`;
  if (number >= 1e6) return `${(number / 1e6).toFixed(2)}M`;
  if (number >= 1e3) return `${(number / 1e3).toFixed(1)}K`;
  return number.toFixed(number < 10 ? 2 : 0);
};
const signed = (value) => (value == null ? '—' : `${Number(value) > 0 ? '+' : ''}${usd(value)}`);
const tone = (value) => (Number(value) > 0 ? 'up' : Number(value) < 0 ? 'down' : '');
const short = (value) => (value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—');
const ago = (time) => {
  const seconds = Math.max(1, Math.round((Date.now() - Number(time)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
};
const agentTag = (id) => `CLONE #${String(id).padStart(4, '0')}`;
const agentName = (agent) => agent?.pumpName || `clone_${agent?.id ?? agent?.agentId ?? 'pending'}`;
const avatar = (agent) => agent?.avatarUrl || './clones.png';
const chainUrl = (type, id) => `${EXPLORER_URL}/${type === 'tx' ? 'tx' : 'account'}/${id}`;
const api = async (path) => {
  if (STATIC_HOST) {
    const route = path.split('?')[0];
    if (route === '/api/state') return STATIC_STATE;
    if (route === '/api/leaderboard') return { agents: [STATIC_AGENT] };
    if (route === '/api/agents') return { agents: [STATIC_AGENT], total: 1 };
    if (route === '/api/trades') return { trades: [STATIC_TRADE] };
    if (route === '/api/callouts') return { callouts: [] };
    if (route === '/api/holders') return {
      rows: [{ address: STATIC_AGENT.address, amount: 1321991.881279, share: 0.1321991881279, isAgent: true }],
      total: 1, count: 23, agentsHolding: 1,
    };
    if (route === '/api/agent/1') return { agent: STATIC_AGENT, cashUsd: 5, positions: [STATIC_POSITION], trades: [STATIC_TRADE], callouts: [] };
    return null;
  }
  try {
    const response = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
};

let state = null;
let boardSort = 'pnl';
let oldestAgent = null;
let openAgent = null;
const agents = new Map();

function renderState(nextState) {
  const firstRender = !state;
  state = nextState;
  const live = state.mode === 'live';
  const launched = Boolean(state.ca && state.ca !== 'TBA');
  const stats = state.agents;

  $$('.js-agent-usd').forEach((element) => { element.textContent = usd(state.agentUsd, 0); });
  $$('.js-buy-usd').forEach((element) => { element.textContent = usd(state.clonesBuyUsd, 0); });
  $$('.js-bank-usd').forEach((element) => { element.textContent = usd(state.bankUsd, 0); });
  $$('.js-sweep-usd').forEach((element) => { element.textContent = usd(state.sweepUsd, 0); });
  $$('.js-team').forEach((element) => { element.textContent = `${state.teamPct}%`; });
  $$('.js-buy').forEach((element) => {
    element.href = state.pumpUrl || PUMP_URL;
    if (element.classList.contains('primary')) element.textContent = launched ? 'Buy on Pump.fun' : 'Launch pending';
  });

  $('#h-mcap').textContent = state.token?.marketCap ? usd(state.token.marketCap) : 'TBA';
  $('#h-agents').textContent = integer(stats.total);
  $('#h-into').textContent = usd(stats.investedUsd);
  $('#live-dot').classList.toggle('on', live);
  $('#h-mode-text').textContent = live ? 'Live' : launched ? 'Token live' : 'Launching soon';
  $('#ca-text').textContent = state.ca || 'TBA';
  $('#ca').disabled = !launched;
  $('#ca').title = launched ? 'Copy contract address' : 'Contract address to be announced';
  $('#x-link').href = state.xUrl || X_URL;
  $('#b-x').href = state.xUrl || X_URL;

  $('#b-dot').classList.toggle('on', live && Boolean(state.updatedAt));
  $('#b-engine').textContent = live ? 'Engine online' : launched ? 'Token live · engine pending' : 'Awaiting launch';
  $('#b-dex').hidden = true;

  const next = state.next;
  $('#spawn-no').textContent = agentTag(next.number);
  $('#spawn-face').src = avatar(next.agent);
  $('#spawn-name').textContent = next.agent ? agentName(next.agent) : 'Clone pending';
  $('#spawn-where').textContent = next.agent?.callout || 'Built on Solana';
  $('#xp-have').textContent = usd(next.haveUsd);
  $('#xp-need').textContent = usd(next.needUsd, 0);
  const progress = next.needUsd ? Math.max(0, Math.min(100, (next.haveUsd / next.needUsd) * 100)) : 0;
  $('#xp-fill').style.width = `${progress}%`;
  $('#xp').setAttribute('aria-valuenow', String(Math.round(progress)));
  $('#spawn-note').textContent = live
    ? `The next Clone activates when fees reach ${usd(next.needUsd, 0)}.`
    : 'Clones begin after the CLONES launch on Pump.fun.';

  $('#s-in').textContent = integer(stats.total);
  $('#s-trading').textContent = `${integer(stats.active)} / ${integer(stats.stopped)}`;
  $('#s-bank').textContent = usd(stats.bankUsd);
  $('#s-swept').textContent = usd(stats.profitToClonesUsd);
  $('#s-trades').textContent = integer(stats.trades);
  $('#s-win').textContent = stats.trades ? `${Math.round((stats.wins / stats.trades) * 100)}%` : '—';
  $('#s-bought').textContent = usd(stats.investedUsd);
  $('#s-held').textContent = stats.heldPct == null ? '—' : `${stats.heldPct.toFixed(2)}%`;

  $('#t-callouts').textContent = integer(stats.calloutsPosted);
  $('#c-posted').textContent = integer(stats.calloutsPosted);
  $('#c-queued').textContent = integer(stats.calloutsQueued);
  $('#c-pace').textContent = live ? 'live' : 'off';

  $('#f-claimed').textContent = usd(state.fees.claimedUsd);
  $('#f-unclaimed').textContent = usd(state.fees.unclaimedUsd);
  $('#f-spent').textContent = usd(state.fees.spentUsd);
  $('#f-team').textContent = usd(state.fees.teamUsd);
  const treasuryAddress = typeof state.treasury === 'string' ? state.treasury : state.treasury?.address;
  $('#treasury').hidden = !treasuryAddress;
  if (treasuryAddress) {
    $('#treasury-link').textContent = short(treasuryAddress);
    $('#treasury-link').href = chainUrl('address', treasuryAddress);
    const treasurySol = state.chain?.treasuryLamports == null ? null : state.chain.treasuryLamports / 1_000_000_000;
    $('#treasury-sol').textContent = treasurySol == null ? '' : `${treasurySol.toFixed(4)} SOL`;
  }
  $('#claims').innerHTML = state.fees.claims.map((claim) => {
    const at = claim.at || claim.observedAt;
    const amount = claim.usd ?? claim.amountUsd;
    const tx = claim.tx || claim.signature;
    return `<li><span>Fees claimed${at ? ` <span class="muted">· ${ago(Date.parse(at))}</span>` : ''}</span><span><b>${usd(amount)}</b>${tx ? ` · <a href="${chainUrl('tx', tx)}" target="_blank" rel="noopener">tx</a>` : ''}</span></li>`;
  }).join('');
  $('#claims-empty').hidden = state.fees.claims.length > 0;

  if (firstRender) {
    loadBoard();
    loadAgents().then(loadTrades);
  }
}

async function loadBoard() {
  const result = await api(`/api/leaderboard?sort=${boardSort}&limit=200`);
  if (!result) return;
  const rows = result.agents || [];
  $('#board').innerHTML = rows.map((agent, index) => `<tr data-id="${agent.id}">
    <td class="muted">${index + 1}</td>
    <td><div class="who-cell"><img src="${avatar(agent)}" alt="" loading="lazy"><div><b>${esc(agentName(agent))}</b><div class="muted small">${esc(agent.style || 'Clone')} · ${esc(agent.status || 'waiting')}</div></div></div></td>
    <td class="r">${usd(agent.bankUsd)}</td>
    <td class="r ${tone(agent.pnlUsd)}"><b>${signed(agent.pnlUsd)}</b></td>
    <td class="r hide-sm">${usd(agent.clonesUsd)}</td>
    <td class="r hide-sm">${integer(agent.trades)}</td>
    <td class="r hide-sm">${agent.trades ? `${Math.round((agent.wins / agent.trades) * 100)}%` : '—'}</td>
    <td class="hide-md thought-cell">${esc(agent.note || '')}</td>
  </tr>`).join('');
  $('#board-empty').hidden = rows.length > 0;
  $$('#board tr[data-id]').forEach((row) => row.addEventListener('click', () => showAgent(Number(row.dataset.id))));
}

function agentTile(agent, isNew = false) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `tile${isNew ? ' new' : ''}`;
  element.dataset.id = agent.id;
  element.innerHTML = `<img src="${avatar(agent)}" alt="" loading="lazy"><span class="no">${agentTag(agent.id)}</span><span class="role">${esc(agentName(agent))}</span>`;
  element.addEventListener('click', () => showAgent(agent.id));
  return element;
}

function renderAgents() {
  const list = [...agents.values()].sort((a, b) => b.id - a.id);
  $('#town').replaceChildren(...list.map((agent) => agentTile(agent)));
  $('#town-empty').hidden = list.length > 0;
}

function upsertAgent(agent, isLive) {
  const known = agents.has(agent.id);
  agents.set(agent.id, agent);
  const old = $(`#town [data-id="${agent.id}"]`);
  const element = agentTile(agent, isLive && !known);
  if (old) old.replaceWith(element); else $('#town').prepend(element);
  $('#town-empty').hidden = true;
}

async function loadAgents(more = false) {
  const query = new URLSearchParams({ limit: '60' });
  if (more && oldestAgent) query.set('before', oldestAgent);
  const result = await api(`/api/agents?${query}`);
  if (!result) return;
  const list = result.agents || [];
  for (const agent of list) agents.set(agent.id, agent);
  if (list.length) oldestAgent = Math.min(...list.map((agent) => agent.id));
  $('#town-more').hidden = list.length < 60;
  renderAgents();
}

function tradeLine(trade) {
  const agent = agents.get(trade.agentId);
  const action = trade.side === 'buy' ? 'bought' : trade.side === 'sell' ? 'sold' : 'put profit into';
  const asset = trade.side === 'sweep' ? '<b>$CLONES</b>' : `<a href="${PUMP_URL}" target="_blank" rel="noopener"><b>${esc(trade.symbol || 'token')}</b></a>`;
  const tx = trade.tx || trade.signature;
  const timestamp = trade.at || (trade.createdAt ? Date.parse(trade.createdAt) : Date.now());
  return `<li class="item ${trade.side}">
    <img src="${avatar(agent)}" alt="" loading="lazy">
    <div class="item-body">
      <div class="item-head"><a href="#" data-agent="${trade.agentId}"><b>${esc(agentName(agent || trade))}</b></a> <span class="act ${trade.side}">${action}</span> ${asset} <span class="muted">${usd(trade.usd)}</span></div>
      <div class="said">${esc(trade.reason || '')}</div>
    </div>
    <span class="when muted">${tx ? `<a href="${chainUrl('tx', tx)}" target="_blank" rel="noopener">${ago(timestamp)}</a>` : ago(timestamp)}</span>
  </li>`;
}

function wireAgentLinks(root) {
  $$(`${root} [data-agent]`).forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    showAgent(Number(link.dataset.agent));
  }));
}

async function loadTrades() {
  const result = await api('/api/trades?limit=100');
  if (!result) return;
  const trades = result.trades || [];
  $('#trades').innerHTML = trades.map(tradeLine).join('');
  $('#trades-empty').hidden = trades.length > 0;
  wireAgentLinks('#trades');
}

async function loadCallouts() {
  const result = await api('/api/callouts?limit=150');
  if (!result) return;
  const callouts = result.callouts || [];
  $('#callouts').innerHTML = callouts.map((callout) => {
    const isCandidate = callout.type === 'market_candidate';
    const title = isCandidate ? `${esc(callout.symbol)} · score ${esc(callout.score)}` : esc(agentName(agents.get(callout.agentId) || callout));
    const detail = isCandidate
      ? `Organic ${esc(callout.organicScore)} · liquidity ${usd(callout.liquidityUsd, 0)} · ${integer(callout.holderCount)} holders · top wallets ${esc(callout.topHoldersPct)}%`
      : esc(callout.text || '');
    return `<li class="item">
    <img src="${isCandidate ? esc(callout.icon || './clones.png') : avatar(agents.get(callout.agentId))}" alt="" loading="lazy">
    <div class="item-body">
      <div class="item-head">${isCandidate ? `<b>${title}</b>` : `<a href="#" data-agent="${callout.agentId}"><b>${title}</b></a>`}</div>
      <div class="said">${detail}</div>
    </div>
    <span class="when muted">${callout.observedAt ? ago(Date.parse(callout.observedAt)) : callout.at ? ago(callout.at) : 'observed'}</span>
  </li>`;
  }).join('');
  $('#callouts-empty').hidden = callouts.length > 0;
  wireAgentLinks('#callouts');
}

async function loadHolders(more = false) {
  const offset = more ? $('#holders-body').children.length : 0;
  const result = await api(`/api/holders?offset=${offset}&limit=50`);
  if (!result) return;
  const rows = result.rows || [];
  const html = rows.map((holder, index) => `<tr>
    <td class="muted">${offset + index + 1}</td>
    <td><a href="${chainUrl('address', holder.address)}" target="_blank" rel="noopener">${short(holder.address)}</a>${holder.isAgent ? '<span class="tag agent">clone</span>' : ''}</td>
    <td class="r">${compact(holder.amount)}</td>
    <td class="r">${holder.share == null ? '—' : `${holder.share.toFixed(3)}%`}</td>
  </tr>`).join('');
  if (more) $('#holders-body').insertAdjacentHTML('beforeend', html); else $('#holders-body').innerHTML = html;
  const total = offset + rows.length;
  $('#holders-empty').hidden = total > 0;
  $('#holders-more').hidden = total >= (result.total || 0);
  $('#holders-sub').textContent = result.count
    ? `${integer(result.count)} holders · ${integer(result.agentsHolding)} Clone wallets marked.`
    : 'Top wallets will appear after launch.';
}

async function showAgent(id) {
  const detail = await api(`/api/agent/${id}`);
  if (!detail?.agent) return;
  const agent = detail.agent;
  openAgent = id;
  $('#sh-face').src = avatar(agent);
  $('#sh-name').textContent = `${agentTag(agent.id)} · ${agentName(agent)}`;
  $('#sh-sub').innerHTML = agent.address ? `Solana · <a href="${chainUrl('address', agent.address)}" target="_blank" rel="noopener">${short(agent.address)}</a>` : 'Solana';
  $('#sh-stats').innerHTML = [
    ['Bank now', usd(agent.bankUsd), `started ${usd(agent.bankStartUsd)}`],
    ['Profit', signed(agent.pnlUsd), `${integer(agent.trades)} trades`],
    ['In $CLONES', usd(agent.clonesUsd), 'never sold'],
    ['Cash', usd(detail.cashUsd), 'trading bank on Pump.fun'],
  ].map(([key, value, sub]) => `<div><span class="k">${key}</span><b>${value}</b><span class="muted small">${sub}</span></div>`).join('');
  $('#sh-note').textContent = agent.note || '';
  $('#sh-pos').innerHTML = (detail.positions || []).map((position) => `<tr>
    <td><b>${esc(position.symbol)}</b><div class="muted small">${compact(position.amount)} tokens</div></td>
    <td class="r">${usd(position.inUsd)}</td>
    <td class="r">${usd(position.currentUsd)}</td>
    <td class="r ${tone(position.pnlUsd)}">${signed(position.pnlUsd)}</td>
    <td class="hide-sm">${esc(position.reason || '')}</td>
  </tr>`).join('') || '<tr><td colspan="5" class="muted">No positions yet.</td></tr>';
  $('#sh-trades').innerHTML = (detail.trades || []).map(tradeLine).join('') || '<li class="muted">No trades yet.</li>';
  $('#sh-callouts').innerHTML = '<li class="muted">No callouts yet.</li>';
  $('#sheet').hidden = false;
  document.body.classList.add('locked');
}

function closeAgent() {
  $('#sheet').hidden = true;
  openAgent = null;
  document.body.classList.remove('locked');
}

$$('#sheet [data-close]').forEach((element) => element.addEventListener('click', closeAgent));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && openAgent) closeAgent();
});

function openTab(name) {
  $$('.tabs [role="tab"]').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.tab === name)));
  $$('.pane').forEach((pane) => { pane.hidden = pane.id !== `pane-${name}`; });
  if (name === 'board') loadBoard();
  if (name === 'trades') loadTrades();
  if (name === 'callouts') loadCallouts();
  if (name === 'holders') loadHolders();
  history.replaceState(null, '', name === 'board' ? location.pathname : `#${name}`);
}

$$('.tabs [role="tab"]').forEach((button) => button.addEventListener('click', () => openTab(button.dataset.tab)));
$$('#board-sort button').forEach((button) => button.addEventListener('click', () => {
  boardSort = button.dataset.sort;
  $$('#board-sort button').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  loadBoard();
}));
$('#town-more').addEventListener('click', () => loadAgents(true));
$('#holders-more').addEventListener('click', () => loadHolders(true));
$('#ca').addEventListener('click', async () => {
  if (!state?.ca) return;
  await navigator.clipboard.writeText(state.ca);
  const label = $('#ca-text');
  label.textContent = 'COPIED';
  setTimeout(() => { label.textContent = state.ca; }, 1200);
});

if (location.hash && $(`#pane-${location.hash.slice(1)}`)) openTab(location.hash.slice(1));

function connect() {
  if (STATIC_HOST) return;
  const events = new EventSource(`${API_BASE}/api/stream`);
  events.addEventListener('state', (event) => renderState(JSON.parse(event.data)));
  events.addEventListener('agent', (event) => upsertAgent(JSON.parse(event.data), true));
  events.addEventListener('trade', () => {
    loadTrades();
    loadBoard();
  });
  events.addEventListener('reset', () => {
    agents.clear();
    oldestAgent = null;
    state = null;
  });
}

async function refreshMarket() {
  try {
    const response = await fetch(`https://api.jup.ag/tokens/v2/search?query=${CONTRACT_ADDRESS}`, { cache: 'no-store' });
    if (!response.ok) return;
    const [token] = await response.json();
    if (!token || !state) return;
    state.token = { ...(state.token || {}), marketCap: Number(token.mcap || token.fdv) || null };
    $('#h-mcap').textContent = state.token.marketCap ? usd(state.token.marketCap) : '—';
  } catch { /* Keep the last verified snapshot. */ }
}

api('/api/state').then((result) => {
  if (!result) return;
  renderState(result);
  refreshMarket();
});
setInterval(refreshMarket, 300_000);
connect();
