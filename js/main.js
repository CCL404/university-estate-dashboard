/* ═════════════════════════════════════════════════════════════
   University Estate Dashboard — Data & Table Logic
   ═════════════════════════════════════════════════════════════ */

let DATA = null;
let COMP_DATA = null;
let SORT_COL = null;
let SORT_DIR = 'asc';
let COMP_SORT_COL = null;
let COMP_SORT_DIR = 'asc';

// ── Load data ────────────────────────────────────────────────
async function loadData(path) {
  const res = await fetch(path);
  const json = await res.json();
  DATA = json;
  return json;
}

async function loadComponents(path) {
  try {
    const res = await fetch(path);
    const json = await res.json();
    COMP_DATA = json;
    return json;
  } catch (e) {
    console.warn('Components data not loaded:', e.message);
    return null;
  }
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

// ── Building Table ─────────────────────────────────────────
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

// ── Component Table ─────────────────────────────────────────
function renderCompTable(components) {
  const tbody = document.getElementById('comp-table-body');
  if (!tbody) return;
  const display = sortCompData([...components]);
  tbody.innerHTML = display.slice(0, 100).map(c => `
    <tr>
      <td><strong style="color:var(--text-primary);font-weight:500;">${esc(c.building_name)}</strong></td>
      <td>${esc(c.component_type)}</td>
      <td>${condBadge(c.condition)}</td>
      <td>${c.fci}</td>
      <td>${c.age_years}</td>
      <td>${c.estimated_replacement_year}</td>
      <td>${fmtCurrency(c.estimated_renewal_cost)}</td>
      <td style="color:${riskColor(c.risk_band)};font-weight:${c.risk_band==='High'?600:400}">${c.risk_band}</td>
      <td><span style="color:${actionColor(c.recommended_action)};font-size:0.72rem;">${esc(c.recommended_action)}</span></td>
    </tr>
  `).join('');
  document.getElementById('comp-row-count').textContent = `${display.length} components`;
}

function sortCompData(arr) {
  if (!COMP_SORT_COL) return arr;
  return arr.sort((a, b) => {
    let va = a[COMP_SORT_COL], vb = b[COMP_SORT_COL];
    if (typeof va === 'string') {
      va = va.toLowerCase(); vb = (vb || '').toLowerCase();
    }
    if (va == null) va = '';
    if (vb == null) vb = '';
    if (va < vb) return COMP_SORT_DIR === 'asc' ? -1 : 1;
    if (va > vb) return COMP_SORT_DIR === 'asc' ? 1 : -1;
    return 0;
  });
}

function sortCompTable(col) {
  if (COMP_SORT_COL === col) {
    COMP_SORT_DIR = COMP_SORT_DIR === 'asc' ? 'desc' : 'asc';
  } else {
    COMP_SORT_COL = col;
    COMP_SORT_DIR = 'asc';
  }
  renderCompTable(COMP_DATA.components);
}

function filterCompTable() {
  if (!COMP_DATA) return;
  const type = document.getElementById('filter-comp-type').value;
  const cond = document.getElementById('filter-comp-condition').value;
  const search = document.getElementById('filter-comp-search').value.toLowerCase();
  let filtered = COMP_DATA.components;
  if (type) filtered = filtered.filter(c => c.component_type === type);
  if (cond) filtered = filtered.filter(c => c.condition === cond);
  if (search) filtered = filtered.filter(c => c.building_name.toLowerCase().includes(search));
  renderCompTable(filtered);
}

function resetCompFilters() {
  document.getElementById('filter-comp-type').value = '';
  document.getElementById('filter-comp-condition').value = '';
  document.getElementById('filter-comp-search').value = '';
  renderCompTable(COMP_DATA.components);
}

// ── Component KPI ──────────────────────────────────────────
function renderCompKPI(summary) {
  if (!document.getElementById('comp-total')) return;
  document.getElementById('comp-total').textContent = fmtNum(summary.total_components);
  document.getElementById('comp-critical').textContent = summary.critical_count;
  document.getElementById('comp-total-cost').textContent = fmtCurrency(summary.total_renewal_cost);
  // approximate avg age
  document.getElementById('comp-avg-life').textContent = '—';
}

// ── Utils ────────────────────────────────────────────────────
const esc = (s) => {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
};

const condBadge = (c) => {
  const cls = c === 'Good' ? 'cond-good' : c === 'Fair' ? 'cond-fair' : c === 'Poor' ? 'cond-poor' : 'cond-critical';
  return `<span class="cond-badge ${cls}">${c}</span>`;
};

const riskColor = (r) => {
  if (r === 'High') return '#c62828';
  if (r === 'Medium') return '#f57f17';
  return '#2e7d32';
};

const actionColor = (a) => {
  if (!a) return 'var(--text-muted)';
  if (a.includes('urgent') || a.startsWith('Renew within 1')) return '#c62828';
  if (a === 'Monitor' || a.startsWith('Renew within 3')) return '#f57f17';
  return '#2e7d32';
};

// ── Init ─────────────────────────────────────────────────────
async function init() {
  try {
    const json = await loadData('data/facilities.json');
    renderKPI(json.summary);
    renderTable(json.buildings);

    // Populate building filter dropdowns
    const groups = [...new Set(json.buildings.map(b => b.campus_group).filter(Boolean))];
    const sel = document.getElementById('filter-group');
    groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g; opt.textContent = g;
      sel.appendChild(opt);
    });

    // Render building charts
    if (typeof renderCharts === 'function') {
      renderCharts(json);
    }

    // ── Load Component Data ────────────────────────────────
    const compJson = await loadComponents('data/components.json');
    if (compJson) {
      renderCompKPI(compJson.summary);
      renderCompTable(compJson.components);

      // Populate component type filter
      const compTypes = [...new Set(compJson.components.map(c => c.component_type))].sort();
      const typeSel = document.getElementById('filter-comp-type');
      if (typeSel) {
        compTypes.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t; opt.textContent = t;
          typeSel.appendChild(opt);
        });
      }

      // Render component charts
      if (typeof renderComponentCharts === 'function') {
        renderComponentCharts(compJson);
      }
    }

  } catch (e) {
    console.error('Failed to load data:', e);
    document.body.innerHTML = `
      <div style="max-width:600px;margin:4rem auto;padding:2rem;text-align:center;font-family:sans-serif;">
        <h2 style="margin-bottom:1rem;">Data load error</h2>
        <p style="color:#666;">Could not load data files. Make sure <code>data/facilities.json</code> and <code>data/components.json</code> exist.</p>
        <p style="color:#666;font-size:0.85rem;">${e.message}</p>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', init);

// ── Scroll Reveal ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
});
