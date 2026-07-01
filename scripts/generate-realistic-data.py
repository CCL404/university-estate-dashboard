#!/usr/bin/env python3
"""Apply realistic budget-constrained renewal spreading to building and component data.
Instead of clustering renewals by risk band year, spread them across the planning horizon
based on annual budget capacity."""

import json, random, math
from collections import defaultdict

random.seed(42)

ANNUAL_RENEWAL_BUDGET = 25_000_000  # $25M/year baseline for major building renewals
ANNUAL_COMPONENT_BUDGET = 15_000_000  # $15M/year for component-level renewal

# ── Load existing data ────────────────────────────────────────
with open('data/facilities.json') as f:
    fac_data = json.load(f)

buildings = fac_data['buildings']

# ── 1. Spread building renewals with budget constraint ────────
# Priority: higher priority score → earlier renewal
# Constraint: total annual cost cannot exceed budget

def spread_budget(items, budget_key, year_key, annual_budget, start_year=2026, horizon=25):
    """Spread items across years respecting annual budget cap."""
    # Sort by priority (highest first)
    sorted_items = sorted(items, key=lambda x: x.get('priority_score', 0) or 0, reverse=True)
    
    # Assign years
    year_costs = defaultdict(float)
    result = []
    
    for item in sorted_items:
        cost = item.get(budget_key, 0) or 0
        # Find earliest year with budget capacity
        assigned = False
        for y in range(start_year, start_year + horizon):
            if year_costs[y] + cost <= annual_budget * (1.02 ** (y - start_year)):  # 2% annual budget growth
                year_costs[y] += cost
                item[year_key] = y
                assigned = True
                break
        
        if not assigned:
            # Force into latest year if nothing fits (edge case)
            item[year_key] = start_year + horizon - 1
    
    return items, dict(year_costs)

# Apply to building data
buildings, bldg_year_costs = spread_budget(
    buildings, 'total_renewal_need', 'estimated_renewal_year',
    ANNUAL_RENEWAL_BUDGET, 2026, 25
)

# Update summary
fac_data['summary']['budget_assumptions'] = {
    'annual_renewal_budget': ANNUAL_RENEWAL_BUDGET,
    'budget_growth_rate': '2% per year',
    'planning_horizon_years': 25,
}

# Update year-based metrics
renewal_years = defaultdict(lambda: {'count': 0, 'need': 0.0})
for b in buildings:
    y = b['estimated_renewal_year']
    renewal_years[y]['count'] += 1
    renewal_years[y]['need'] += b['total_renewal_need']

# Save updated building data
with open('data/facilities.json', 'w') as f:
    json.dump(fac_data, f, indent=2)

print(f"✅ Building renewals spread across {len(bldg_year_costs)} years (budget: ${ANNUAL_RENEWAL_BUDGET:,.0f}/yr)")
print(f"   Year range: {min(bldg_year_costs.keys())}–{max(bldg_year_costs.keys())}")
print(f"   Peak year: ${max(bldg_year_costs.values()):,.0f}")

# ── 2. Re-generate components with budget spreading ──────────
# Load buildings fresh (with updated renewal years)
with open('data/facilities.json') as f:
    fac_data = json.load(f)
buildings = fac_data['buildings']

COMPONENT_CATALOG = {
    'HVAC System':       {'lifecycle': (15, 25), 'cost_per_sqm': (80, 200), 'unit': 'system', 'count_range': (1, 4)},
    'Carpet & Flooring': {'lifecycle': (7, 12),  'cost_per_sqm': (30, 80),  'unit': 'sqm',     'count_range': (1, 1)},
    'Fire Safety':       {'lifecycle': (10, 20), 'cost_per_sqm': (15, 40),  'unit': 'system', 'count_range': (2, 6)},
    'Electrical':        {'lifecycle': (20, 30), 'cost_per_sqm': (60, 150), 'unit': 'system', 'count_range': (1, 3)},
    'Plumbing':          {'lifecycle': (20, 35), 'cost_per_sqm': (40, 100), 'unit': 'system', 'count_range': (1, 3)},
    'Roofing':           {'lifecycle': (20, 30), 'cost_per_sqm': (50, 120), 'unit': 'sqm',     'count_range': (1, 1)},
    'Lighting':          {'lifecycle': (10, 15), 'cost_per_sqm': (20, 50),  'unit': 'system', 'count_range': (2, 5)},
    'Building Fabric':   {'lifecycle': (25, 40), 'cost_per_sqm': (40, 90),  'unit': 'sqm',     'count_range': (1, 1)},
}

def compute_condition(age_yrs, component_lifecycle):
    min_life, max_life = component_lifecycle
    mid_life = (min_life + max_life) / 2
    pct_used = age_yrs / mid_life
    if pct_used < 0.3:  return 'Good'
    if pct_used < 0.7:  return 'Fair'
    if pct_used < 1.0:  return 'Poor'
    return 'Critical'

components = []
component_id = 0
building_component_map = defaultdict(list)  # building_name -> [component]

for b in buildings:
    bldg_age = b.get('age', 20)
    sqft = b.get('gross_sq_ft', 5000)
    bldg_condition = b.get('condition', 'Fair')
    bldg_priority = b.get('priority_score', 50)
    
    age_modifier = {'Good': 0.7, 'Fair': 1.0, 'Poor': 1.3, 'Critical': 1.6}
    mod = age_modifier.get(bldg_condition, 1.0)
    
    for comp_name, spec in COMPONENT_CATALOG.items():
        component_id += 1
        eff_age = max(1, round(bldg_age * mod * random.uniform(0.6, 1.4)))
        cond = compute_condition(eff_age, spec['lifecycle'])
        
        min_c, max_c = spec['cost_per_sqm']
        # Scale costs to be realistic: components are ~30-50% of total building renewal
        cost_scale = 0.15 if comp_name in ['Lighting', 'Fire Safety', 'Carpet & Flooring'] else 0.25
        cost_per = random.uniform(min_c, max_c) * cost_scale
        area = sqft * 0.25 * random.uniform(0.5, 1.0)
        renewal_cost = round(cost_per * area)
        
        min_life, max_life = spec['lifecycle']
        mid_life = (min_life + max_life) / 2
        yrs_remaining = max(1, round(mid_life - eff_age))
        
        if cond == 'Critical': comp_risk = 'High'
        elif cond == 'Poor': comp_risk = 'High'
        elif cond == 'Fair': comp_risk = 'Medium'
        else: comp_risk = 'Low'
        
        if cond == 'Critical': comp_fci = random.randint(65, 90)
        elif cond == 'Poor': comp_fci = random.randint(40, 65)
        elif cond == 'Fair': comp_fci = random.randint(15, 40)
        else: comp_fci = random.randint(0, 15)
        
        comp = {
            'component_id': component_id,
            'building_name': b['building_name'],
            'campus_group': b.get('campus_group', ''),
            'component_type': comp_name,
            'condition': cond,
            'fci': comp_fci,
            'age_years': eff_age,
            'estimated_renewal_cost': renewal_cost,
            'risk_band': comp_risk,
            'recommended_action': (
                'Replace urgently' if cond == 'Critical' else
                'Renew within 1 year' if cond == 'Poor' else
                'Monitor' if cond == 'Fair' else
                'Routine inspection'
            ),
        }
        components.append(comp)
        building_component_map[b['building_name']].append(comp)

# Apply budget spreading per building group
# Components within the same building are renewed in the same year or adjacent years
# Budget spreads across buildings to smooth the curve

# Group components by building
component_priority = []
for b_name, comps in building_component_map.items():
    total_cost = sum(c['estimated_renewal_cost'] for c in comps)
    # Find the building's priority score
    bldg = next((b for b in buildings if b['building_name'] == b_name), None)
    priority = bldg.get('priority_score', 50) if bldg else 50
    component_priority.append((priority, b_name, comps, total_cost))

# Sort by building priority (highest first)
component_priority.sort(key=lambda x: x[0], reverse=True)

# Spread with budget constraint
year_costs = defaultdict(float)
assigned = set()

for priority, b_name, comps, total_cost in component_priority:
    if b_name in assigned:
        continue
    
    # Try to assign all components of this building to the same year
    assigned_year = None
    for y in range(2026, 2051):
        if year_costs[y] + total_cost <= ANNUAL_COMPONENT_BUDGET * (1.02 ** (y - 2026)):
            assigned_year = y
            break
    
    if assigned_year is None:
        assigned_year = 2050
    
    for comp in comps:
        comp['estimated_replacement_year'] = assigned_year
        # Add slight stagger within building for different components
        yr_offset = ['HVAC System', 'Roofing', 'Electrical'].index(comp['component_type']) % 3 - 1 \
            if comp['component_type'] in ['HVAC System', 'Roofing', 'Electrical'] else 0
        comp['estimated_replacement_year'] = max(2026, min(2050, assigned_year + yr_offset))
    
    year_costs[assigned_year] += total_cost
    assigned.add(b_name)

# Summary
total_comp_cost = sum(c['estimated_renewal_cost'] for c in components)
comp_by_type = {}
for c in components:
    t = c['component_type']
    if t not in comp_by_type:
        comp_by_type[t] = {'count': 0, 'total_cost': 0, 'critical': 0}
    comp_by_type[t]['count'] += 1
    comp_by_type[t]['total_cost'] += c['estimated_renewal_cost']
    if c['condition'] in ('Poor', 'Critical'):
        comp_by_type[t]['critical'] += 1

component_summary = {
    'total_components': len(components),
    'total_renewal_cost': total_comp_cost,
    'critical_count': sum(1 for c in components if c['condition'] in ('Poor', 'Critical')),
    'component_type_summary': {
        t: {
            'count': v['count'],
            'total_cost': round(v['total_cost']),
            'pct_critical': round(v['critical'] / v['count'] * 100, 1),
        }
        for t, v in sorted(comp_by_type.items())
    },
    'renewal_cost_by_year': {},
    'budget_assumptions': {
        'annual_component_budget': ANNUAL_COMPONENT_BUDGET,
        'budget_growth_rate': '2% per year',
        'planning_horizon_years': 25,
    },
}

# Yearly cost
yearly = defaultdict(float)
for c in components:
    yearly[c['estimated_replacement_year']] += c['estimated_renewal_cost']
component_summary['renewal_cost_by_year'] = {
    str(k): round(v) for k, v in sorted(yearly.items())
}

with open('data/components.json', 'w') as f:
    json.dump({'components': components, 'summary': component_summary}, f, indent=2)

print(f"✅ Component renewals spread across {len(yearly)} years (budget: ${ANNUAL_COMPONENT_BUDGET:,.0f}/yr)")
print(f"   Total: {len(components)} components, ${total_comp_cost:,.0f}")

# Print yearly distribution
print("\nYear | Buildings (need $) | Components (need $)")
print("-" * 60)
years_range = range(2026, 2051)
for y in years_range:
    b_cost = bldg_year_costs.get(y, 0)
    c_cost = yearly.get(y, 0)
    if b_cost > 0 or c_cost > 0:
        print(f"{y} | ${b_cost:>8,.0f} (budget) | ${c_cost:>8,.0f} (components)")
