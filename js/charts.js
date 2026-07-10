/* ═════════════════════════════════════════════════════════════
   University Estate Dashboard — Charts
   ═════════════════════════════════════════════════════════════ */

const CHART_COLORS = {
  good: '#6a9f7a',
  fair: '#c49a5a',
  poor: '#c45a5a',
  critical: '#8b2020',
  accent: '#2c5f6e',
  accentLight: 'rgba(44,95,110,0.12)',
  gold: '#c4a35a',
  grey: '#9ca3a8',
  text: '#646a70',

  groups: [
    '#2c5f6e', '#5b8a9c', '#8db4c4',
    '#b8a06e', '#8a7a5a',
  ],

  compColors: ['#2c5f6e', '#5b8a9c', '#c49a5a', '#c45a5a', '#8b2020'],
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

/* ═════════════════════════════════════════════════════════════
   Component Charts
   ═════════════════════════════════════════════════════════════ */

function renderComponentCharts(compJson) {
  const { components, summary } = compJson;

  // ── Component Condition by Type (stacked bar) ─────────────
  const types = [...new Set(components.map(c => c.component_type))].sort();
  const condOrder = ['Good', 'Fair', 'Poor', 'Critical'];
  const condColors = {'Good': CHART_COLORS.good, 'Fair': CHART_COLORS.fair, 'Poor': CHART_COLORS.poor, 'Critical': CHART_COLORS.critical};

  const datasets = condOrder.map(cond => ({
    label: cond,
    data: types.map(t => components.filter(c => c.component_type === t && c.condition === cond).length),
    backgroundColor: condColors[cond],
    borderRadius: 0,
    barPercentage: 0.85,
  }));

  new Chart(document.getElementById('chart-comp-condition'), {
    type: 'bar',
    data: { labels: types, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { family: 'Inter', size: 10 }, color: CHART_COLORS.text, boxWidth: 12, padding: 12 },
        },
        tooltip: {
          mode: 'index',
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { family: 'Inter', size: 9 }, color: CHART_COLORS.text, maxRotation: 45 },
        },
        y: {
          stacked: true, beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { font: { size: 10 }, color: CHART_COLORS.text },
        },
      },
    },
  });

  // ── Component Renewal Cost by Year ─────────────────────────
  const yearlyCost = {};
  components.forEach(c => {
    const y = c.estimated_replacement_year;
    yearlyCost[y] = (yearlyCost[y] || 0) + c.estimated_renewal_cost;
  });
  const compYears = Object.keys(yearlyCost).sort();
  const compYearData = compYears.map(y => ({
    year: y,
    cost: Math.round(yearlyCost[y] / 1e6),
  }));

  new Chart(document.getElementById('chart-comp-timeline'), {
    type: 'bar',
    data: {
      labels: compYearData.map(d => d.year),
      datasets: [{
        label: 'Renewal Cost ($M)',
        data: compYearData.map(d => d.cost),
        backgroundColor: '#2c5f6e',
        borderRadius: 0,
        barPercentage: 0.7,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `$${ctx.parsed.y}M component renewal`,
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

  // ── 3. Component Condition by Floor Level ──────────────
  const floorOrder = ['G', '1', '2', '3', '4', 'All'];
  const floorLabels = ['Level G', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Whole Bldg'];
  const floorCondOrder = ['Good', 'Fair', 'Poor', 'Critical'];

  const floorData = floorOrder.map(fl => {
    const items = components.filter(c => (c.floor_level || '') === fl);
    return floorCondOrder.map(cond => items.filter(c => c.condition === cond).length);
  });

  const floorChart = new Chart(document.getElementById('chart-comp-floor'), {
    type: 'bar',
    data: {
      labels: floorLabels,
      datasets: floorCondOrder.map((cond, i) => ({
        label: cond,
        data: floorData.map(d => d[i]),
        backgroundColor: condColors[cond],
        borderRadius: 0,
        barPercentage: 0.8,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { family: 'Inter', size: 10 }, color: CHART_COLORS.text, boxWidth: 12, padding: 12 },
        },
        tooltip: {
          mode: 'index',
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { family: 'Inter', size: 10 }, color: CHART_COLORS.text },
        },
        y: {
          stacked: true, beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { font: { size: 10 }, color: CHART_COLORS.text },
        },
      },
    },
  });
}

/* ═════════════════════════════════════════════════════════════
   Sustainability Charts
   ═════════════════════════════════════════════════════════════ */

function renderSustainabilityCharts(sustJson) {
  const { buildings, summary } = sustJson;
  const condOrder = ['Good', 'Fair', 'Poor', 'Critical'];
  const condAvg = condOrder.map(cond => {
    const bldgs = buildings.filter(b => b.condition === cond);
    return bldgs.length ? Math.round(bldgs.reduce((s, b) => s + b.energy_kwh_per_sqm, 0) / bldgs.length) : 0;
  });
  new Chart(document.getElementById('chart-sust-energy'), {
    type: 'bar',
    data: { labels: condOrder, datasets: [{ data: condAvg, backgroundColor: ['#6a9f7a','#c49a5a','#c45a5a','#8b2020'], borderRadius: 0, barThickness: 50 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.parsed.y + ' kWh/sqm' } } },
      scales: { x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: CHART_COLORS.text } }, y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 }, color: CHART_COLORS.text } } } },
  });
  const bands = [{ label: 'Poor (0-30)', min: 0, max: 30 }, { label: 'Below Avg (31-45)', min: 31, max: 45 }, { label: 'Average (46-60)', min: 46, max: 60 }, { label: 'Good (61-75)', min: 61, max: 75 }, { label: 'Excellent (76+)', min: 76, max: 100 }];
  new Chart(document.getElementById('chart-sust-score'), {
    type: 'bar',
    data: { labels: bands.map(b => b.label), datasets: [{ data: bands.map(b => buildings.filter(s => s.sustainability_score >= b.min && s.sustainability_score <= b.max).length), backgroundColor: ['#8b2020','#c45a5a','#c49a5a','#6a9f7a','#2c5f6e'], borderRadius: 0, barThickness: 40 }] },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.parsed.y + ' buildings' } } },
      scales: { x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: CHART_COLORS.text } }, y: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 9 }, color: CHART_COLORS.text } } } },
  });
  const groups = [...new Set(buildings.map(b => b.campus_group).filter(Boolean))];
  const carbonData = groups.map(g => ({ label: g, val: Math.round(buildings.filter(b => b.campus_group === g).reduce((s, b) => s + b.carbon_kg, 0) / 1000) })).sort((a, b) => b.val - a.val);
  new Chart(document.getElementById('chart-sust-carbon'), {
    type: 'bar',
    data: { labels: carbonData.map(d => d.label), datasets: [{ data: carbonData.map(d => d.val), backgroundColor: ['#2c5f6e','#5b8a9c','#8db4c4','#c49a5a','#c45a5a'], borderRadius: 0, barPercentage: 0.7 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.parsed.y.toLocaleString() + 'k kg CO2-e' } } },
      scales: { x: { grid: { display: false }, ticks: { font: { size: 9, family: 'Inter' }, color: CHART_COLORS.text, maxRotation: 45 } }, y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, color: CHART_COLORS.text } } } },
  });
  // Normalise mixed-unit environmental KPIs — show as % of typical university building targets
  const energyVal = summary.avg_energy_kwh_per_sqm;
  const waterVal = Math.round(summary.total_water_kl / summary.total_sqm * 100) / 100;
  const wasteVal = Math.round(summary.total_waste_kg / summary.total_sqm);
  const energyPct = Math.min(100, Math.round(energyVal / 250 * 100));
  const waterPct = Math.min(100, Math.round(waterVal / 3 * 100));
  const wastePct = Math.min(100, Math.round(wasteVal / 10 * 100));

  new Chart(document.getElementById('chart-sust-kpi'), {
    type: 'bar',
    data: {
      labels: ['Energy Efficiency', 'Water Efficiency', 'Waste Intensity'],
      datasets: [{
        data: [energyPct, waterPct, wastePct],
        backgroundColor: ['#2c5f6e','#5b8a9c','#8db4c4'],
        borderRadius: 0,
        barThickness: 44
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const vals = [energyVal + ' kWh/sqm', waterVal + ' kL/sqm', wasteVal + ' kg/sqm'];
              return vals[ctx.dataIndex] + '  (' + ctx.raw + '% of target)';
            }
          }
        }
      },
      scales: {
        x: {
          max: 100,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { font: { size: 10 }, color: CHART_COLORS.text, callback: v => v + '%' }
        },
        y: {
          grid: { display: false },
          ticks: { font: { family: 'Inter', size: 10 }, color: CHART_COLORS.text }
        }
      }
    },
    plugins: [{
      id: 'sustLabels',
      afterDatasetsDraw(chart) {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        ctx.font = '600 10px Inter';
        ctx.fillStyle = '#111';
        ctx.textAlign = 'left';
        meta.data.forEach((bar, i) => {
          const vals = [energyVal + ' kWh/sqm', waterVal + ' kL/sqm', wasteVal + ' kg/sqm'];
          ctx.fillText(vals[i], bar.x + 8, bar.y + 4);
        });
      }
    }]
  });
}
