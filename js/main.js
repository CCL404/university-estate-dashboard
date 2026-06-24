/* ═════════════════════════════════════════════════════════════
   University Estate Dashboard — Data & Table Logic
   ═════════════════════════════════════════════════════════════ */

let DATA = null;
let SORT_COL = null;
let SORT_DIR = 'asc';

// ── Load data ────────────────────────────────────────────────
async function loadData(path) {
  const res = await fetch(path);
  const json = await res.json();
  DATA = json;
  return json;
}

// ── Format helpers ───────────────────────────────────────────
const fmtCurrency = (v) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v).toLocaleString()}`;
};

const fmtCompact = (v) => {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return Math.round(v).toLocaleString();
};

const fmtNum = (v) => {
  if (typeof v === 'number') return v.toLocaleString();
  return v;
};

// ── KPI cards ────────────────────────────────────────────────
function renderKPI(summary) {
  document.getElementById('kpi-avg-fci').textContent = summary.avg_fci + '%';
  document.getElementById('kpi-total-need').textContent = fmtCurrency(summary.total_renewal_need);
  document.getElementById('kpi-high-risk').textContent = summary.high_risk_count;
  document.getElementById('kpi-poor-pct').textContent = summary.poor_pct + '%';
  document.getElementById('kpi-3yr-need').textContent = fmtCurrency(summary.three_year_priority_need);
}

// ── Table ────────────────────────────────────────────────────
function renderTable(buildings) {
  const tbody = document.getElementById('asset-table-body');
  const display = sortData([...buildings]);

  tbody.innerHTML = display.slice(0, 100).map(b => `
    <tr>
      <td><strong style="color:var(--text-primary);font-weight:500;">${esc(b.building_name)}</strong></td>
      <td>${esc(b.campus_group || '—')}</td>
      <td>${condBadge(b.condition)}</td>
      <td>${b.fci}</td>
      <td>${fmtCurrency(b.total_renewal_need)}</td>
      <td style="color:${riskColor(b.risk_band)};font-weight:${b.risk_band==='High'?600:400}">${b.risk_band}</td>
      <td>${b.estimated_renewal_year}</td>
      <td><span style="color:${actionColor(b.recommended_action)};font-size:0.72rem;">${esc(b.recommended_action || '—')}</span></td>
      <td style="text-align:right;color:var(--text-muted);">#${b.investment_priority_rank}</td>
    </tr>
  `).join('');

  document.getElementById('table-row-count').textContent = `${display.length} buildings`;
}

function sortData(arr) {
  if (!SORT_COL) return arr;
  return arr.sort((a, b) => {
    let va = a[SORT_COL], vb = b[SORT_COL];
    if (typeof va === 'string') {
      va = va.toLowerCase(); vb = (vb || '').toLowerCase();
    }
    if (va == null) va = '';
    if (vb == null) vb = '';
    if (va < vb) return SORT_DIR === 'asc' ? -1 : 1;
    if (va > vb) return SORT_DIR === 'asc' ? 1 : -1;
    return 0;
  });
}

function sortTable(col) {
  if (SORT_COL === col) {
    SORT_DIR = SORT_DIR === 'asc' ? 'desc' : 'asc';
  } else {
    SORT_COL = col;
    SORT_DIR = 'asc';
  }
  renderTable(DATA.buildings);
}

function filterTable() {
  const grp = document.getElementById('filter-group').value;
  const risk = document.getElementById('filter-risk').value;
  const search = document.getElementById('filter-search').value.toLowerCase();
  let filtered = DATA.buildings;
  if (grp) filtered = filtered.filter(b => b.campus_group === grp);
  if (risk) filtered = filtered.filter(b => b.risk_band === risk);
  if (search) filtered = filtered.filter(b => b.building_name.toLowerCase().includes(search));
  renderTable(filtered);
}

function resetFilters() {
  document.getElementById('filter-group').value = '';
  document.getElementById('filter-risk').value = '';
  document.getElementById('filter-search').value = '';
  renderTable(DATA.buildings);
}

// ── Utils ────────────────────────────────────────────────────
const esc = (s) => {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
};

const condBadge = (c) => {
  const cls = c === 'Good' ? 'cond-good' : c === 'Fair' ? 'cond-fair' : 'cond-poor';
  return `<span class="cond-badge ${cls}">${c}</span>`;
};

const riskColor = (r) => {
  if (r === 'High') return '#c62828';
  if (r === 'Medium') return '#f57f17';
  return '#2e7d32';
};

const actionColor = (a) => {
  if (!a) return 'var(--text-muted)';
  if (a.startsWith('Renew')) return '#c62828';
  if (a === 'Monitor') return '#f57f17';
  return '#2e7d32';
};

// ── Init ─────────────────────────────────────────────────────
async function init() {
  try {
    const json = await loadData('data/facilities.json');
    renderKPI(json.summary);
    renderTable(json.buildings);

    // Populate filter dropdowns
    const groups = [...new Set(json.buildings.map(b => b.campus_group).filter(Boolean))];
    const sel = document.getElementById('filter-group');
    groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g; opt.textContent = g;
      sel.appendChild(opt);
    });

    // Render charts (from charts.js)
    if (typeof renderCharts === 'function') {
      renderCharts(json);
    }
  } catch (e) {
    console.error('Failed to load data:', e);
    document.body.innerHTML = `
      <div style="max-width:600px;margin:4rem auto;padding:2rem;text-align:center;font-family:sans-serif;">
        <h2 style="margin-bottom:1rem;">Data load error</h2>
        <p style="color:#666;">Could not load <code>data/facilities.json</code>. Make sure the file exists and is valid JSON.</p>
        <p style="color:#666;font-size:0.85rem;">${e.message}</p>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
