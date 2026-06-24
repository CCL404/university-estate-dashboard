/* ═════════════════════════════════════════════════════════════
   University Estate Dashboard — Charts
   ═════════════════════════════════════════════════════════════ */

const CHART_COLORS = {
  good: '#6a9f7a',
  fair: '#c49a5a',
  poor: '#c45a5a',
  accent: '#2c5f6e',
  accentLight: 'rgba(44,95,110,0.12)',
  gold: '#c4a35a',
  grey: '#9ca3a8',
  text: '#646a70',

  groups: [
    '#2c5f6e', '#5b8a9c', '#8db4c4',
    '#b8a06e', '#8a7a5a',
  ],
};

function renderCharts(json) {
  const { summary, buildings } = json;

  // ── 1. Condition Distribution ─────────────────────────────
  new Chart(document.getElementById('chart-condition'), {
    type: 'bar',
    data: {
      labels: ['Good', 'Fair', 'Poor'],
      datasets: [{
        data: [summary.good_count, summary.fair_count, summary.poor_count],
        backgroundColor: [CHART_COLORS.good, CHART_COLORS.fair, CHART_COLORS.poor],
        borderRadius: 0,
        barThickness: 60,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} buildings (${(ctx.parsed.y / 703 * 100).toFixed(1)}%)` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: CHART_COLORS.text } },
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 }, color: CHART_COLORS.text } },
      },
    },
  });

  // ── 2. Priority Scatter (FCI vs Backlog/sqm) ──────────────
  const groupNames = [...new Set(buildings.map(b => b.campus_group))];
  const groupData = groupNames.map((g, i) => ({
    label: g,
    data: buildings.filter(b => b.campus_group === g).map(b => ({
      x: b.fci,
      y: b.backlog_per_sqm,
      r: Math.max(3, Math.min(10, b.crv / 1e7)),
      name: b.building_name,
      risk: b.risk_band,
    })),
    backgroundColor: CHART_COLORS.groups[i % CHART_COLORS.groups.length],
    pointRadius: 4,
    pointHoverRadius: 7,
  }));

  new Chart(document.getElementById('chart-scatter'), {
    type: 'scatter',
    data: { datasets: groupData },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { family: 'Inter', size: 10 }, color: CHART_COLORS.text, boxWidth: 12, padding: 12 },
        },
        tooltip: {
          callbacks: {
            title: items => items[0].raw.name,
            label: ctx => [
              `FCI: ${ctx.parsed.x.toFixed(0)}%`,
              `Backlog: $${ctx.parsed.y.toFixed(0)}/sqm`,
              `Risk: ${ctx.raw.risk}`,
            ],
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'FCI (%)', font: { family: 'Inter', size: 11 }, color: CHART_COLORS.text },
          grid: { color: 'rgba(0,0,0,0.04)' },
          min: 0,
        },
        y: {
          title: { display: true, text: 'Backlog per sqm ($)', font: { family: 'Inter', size: 11 }, color: CHART_COLORS.text },
          grid: { color: 'rgba(0,0,0,0.04)' },
          type: 'logarithmic',
          ticks: { callback: v => '$' + v.toLocaleString() },
        },
      },
    },
  });

  // ── 3. Top Priority Buildings (horizontal bar) ─────────────
  const top10 = [...buildings].sort((a, b) => a.investment_priority_rank - b.investment_priority_rank).slice(0, 10).reverse();

  new Chart(document.getElementById('chart-top'), {
    type: 'bar',
    data: {
      labels: top10.map(b => b.building_name.length > 28 ? b.building_name.slice(0, 26) + '…' : b.building_name),
      datasets: [{
        data: top10.map(b => b.priority_score),
        backgroundColor: top10.map(b =>
          b.risk_band === 'High' ? CHART_COLORS.poor :
          b.risk_band === 'Medium' ? CHART_COLORS.fair : CHART_COLORS.good
        ),
        borderRadius: 0,
        barThickness: 14,
      }],
    },
    indexAxis: 'y',
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const b = top10[top10.length - 1 - ctx.dataIndex];
              return `Score: ${b.priority_score} | Risk: ${b.risk_band} | FCI: ${b.fci}%`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true, max: 100,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { font: { size: 10 }, color: CHART_COLORS.text },
        },
        y: {
          grid: { display: false },
          ticks: { font: { family: 'Inter', size: 9 }, color: CHART_COLORS.text },
        },
      },
    },
  });

  // ── 4. Renewal Forecast Timeline ───────────────────────────
  const yearCounts = {};
  buildings.forEach(b => {
    const y = b.estimated_renewal_year;
    yearCounts[y] = (yearCounts[y] || 0) + 1;
  });
  const years = Object.keys(yearCounts).sort();
  const yearData = years.map(y => ({
    year: y,
    count: yearCounts[y],
    need: buildings.filter(b => b.estimated_renewal_year == y).reduce((s, b) => s + b.total_renewal_need, 0),
  }));

  new Chart(document.getElementById('chart-timeline'), {
    type: 'bar',
    data: {
      labels: yearData.map(d => d.year),
      datasets: [
        {
          label: 'Buildings',
          data: yearData.map(d => d.count),
          backgroundColor: CHART_COLORS.accent,
          borderRadius: 0,
          barPercentage: 0.7,
          order: 2,
        },
        {
          label: 'Renewal Need ($M)',
          data: yearData.map(d => Math.round(d.need / 1e6)),
          type: 'line',
          borderColor: CHART_COLORS.gold,
          backgroundColor: 'rgba(196,163,90,0.1)',
          borderWidth: 2,
          pointBackgroundColor: CHART_COLORS.gold,
          pointRadius: 3,
          tension: 0.3,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { family: 'Inter', size: 10 }, color: CHART_COLORS.text, boxWidth: 12, padding: 12 },
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.datasetIndex === 0) return `${ctx.parsed.y} buildings`;
              return `$${ctx.parsed.y}M renewal need`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, color: CHART_COLORS.text },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { font: { size: 10 }, color: CHART_COLORS.text },
        },
      },
    },
  });
}
