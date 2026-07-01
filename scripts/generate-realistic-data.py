#!/usr/bin/env python3
"""Generate realistic budget-constrained renewal data with zone/floor-level granularity.
Components are assigned to specific floors/zones within each building."""

import json, random, math
from collections import defaultdict

random.seed(42)

ANNUAL_RENEWAL_BUDGET = 25_000_000
ANNUAL_COMPONENT_BUDGET = 15_000_000

ZONE_LABELS = ['Administration', 'Teaching', 'Laboratory', 'Common Area', 'Storage']

# ── Load existing data ────────────────────────────────────────
with open('data/facilities.json') as f:
    fac_data = json.load(f)

buildings = fac_data['buildings']

# ── 1. Spread building renewals with budget constraint ────────
def spread_budget(items, budget_key, year_key, annual_budget, start_year=2026, horizon=25):
    """Spread items across years respecting annual budget cap.
    If total need exceeds budget capacity, excess is spread proportionally
    across the horizon instead of dumping to the last year."""
    sorted_items = sorted(items, key=lambda x: x.get('priority_score', 0) or 0, reverse=True)
    
    # Calculate total budget capacity with 2% growth
    total_capacity = sum(annual_budget * (1.02 ** i) for i in range(horizon))
    total_need = sum(item.get(budget_key, 0) or 0 for item in sorted_items)
    
    # If need exceeds capacity, scale by a multiplier to allow phased overrun
    overrun_ratio = max(1.0, total_need / total_capacity) if total_capacity > 0 else 1.0
    
    year_costs = defaultdict(float)
    
    for item in sorted_items:
        cost = item.get(budget_key, 0) or 0
        assigned = False
        for y in range(start_year, start_year + horizon):
            # Allow scaled budget to spread the load
            effective_budget = annual_budget * (1.02 ** (y - start_year)) * overrun_ratio
            if year_costs[y] + cost <= effective_budget:
                year_costs[y] += cost
                item[year_key] = y
                assigned = True
                break
        
        if not assigned:
            # If still doesn't fit with scaling, spread across multiple years
            # by finding the least-loaded year
            best_y = min(range(start_year, start_year + horizon), key=lambda y: year_costs[y] + cost)
            year_costs[best_y] += cost
            item[year_key] = best_y
    
    return items, dict(year_costs)

buildings, bldg_year_costs = spread_budget(
    buildings, 'total_renewal_need', 'estimated_renewal_year',
    ANNUAL_RENEWAL_BUDGET, 2026, 25
)

fac_data['summary']['budget_assumptions'] = {
    'annual_renewal_budget': ANNUAL_RENEWAL_BUDGET,
    'budget_growth_rate': '2% per year',
    'planning_horizon_years': 25,
}

with open('data/facilities.json', 'w') as f:
    json.dump(fac_data, f, indent=2)

print(f"✅ Building renewals spread across {len(bldg_year_costs)} years")

# ── 2. Reload updated building data ──────────────────────────
with open('data/facilities.json') as f:
    fac_data = json.load(f)
buildings = fac_data['buildings']

COMPONENT_CATALOG = {
    'HVAC System':       {'lifecycle': (15, 25), 'cost_per_sqm': (80, 200)},
    'Carpet & Flooring': {'lifecycle': (7, 12),  'cost_per_sqm': (30, 80)},
    'Fire Safety':       {'lifecycle': (10, 20), 'cost_per_sqm': (15, 40)},
    'Electrical':        {'lifecycle': (20, 30), 'cost_per_sqm': (60, 150)},
    'Plumbing':          {'lifecycle': (20, 35), 'cost_per_sqm': (40, 100)},
    'Roofing':           {'lifecycle': (20, 30), 'cost_per_sqm': (50, 120)},
    'Lighting':          {'lifecycle': (10, 15), 'cost_per_sqm': (20, 50)},
    'Building Fabric':   {'lifecycle': (25, 40), 'cost_per_sqm': (40, 90)},
}

# Components that belong to the entire building vs per-zone
BUILDING_LEVEL_COMPS = {'Roofing', 'Building Fabric'}  # these apply to entire building
ZONE_LEVEL_COMPS = {'HVAC System', 'Carpet & Flooring', 'Fire Safety', 'Electrical', 'Plumbing', 'Lighting'}

def compute_condition(age_yrs, component_lifecycle):
    min_life, max_life = component_lifecycle
    mid_life = (min_life + max_life) / 2
    pct_used = age_yrs / mid_life
    if pct_used < 0.3:  return 'Good'
    if pct_used < 0.7:  return 'Fair'
    if pct_used < 1.0:  return 'Poor'
    return 'Critical'

def generate_zones(building_name, sqft, bldg_function, num_floors=None):
    """Generate zones/floors for a building."""
    # Determine floor count from building size
    if num_floors is None:
        if sqft < 3000:
            num_floors = 1
        elif sqft < 8000:
            num_floors = random.choice([1, 2])
        elif sqft < 15000:
            num_floors = random.randint(2, 3)
        else:
            num_floors = random.randint(2, 5)
    
    # Generate zones per floor
    zones = []
    for floor in range(1, num_floors + 1):
        # Ground = Level G, then Level 1, 2, 3...
        level_label = 'G' if floor == 1 else str(floor - 1)
        
        # Each floor may have 1-3 zones
        num_zones_on_floor = random.choices([1, 2, 3], weights=[0.5, 0.3, 0.2])[0]
        
        for zone_idx in range(num_zones_on_floor):
            zone_name = random.choice(ZONE_LABELS)
            zone_id = f"{building_name[:8]}_{level_label}_{zone_name[:4]}"
            sqft_share = sqft / (num_floors * num_zones_on_floor) * random.uniform(0.7, 1.3)
            zones.append({
                'zone_id': zone_id,
                'zone_name': zone_name,
                'floor_level': level_label,
                'floor_display': f"Level {level_label}",
                'estimated_sqft': round(sqft_share),
            })
    
    return zones

components = []
component_id = 0
zone_registry = {}  # building_name -> [zones]

for b in buildings:
    bldg_age = b.get('age', 20)
    sqft = b.get('gross_sq_ft', 5000)
    bldg_condition = b.get('condition', 'Fair')
    bldg_function = b.get('building_function', '')
    
    # Generate zones for this building
    zones = generate_zones(b['building_name'], sqft, bldg_function)
    zone_registry[b['building_name']] = zones
    
    age_modifier = {'Good': 0.7, 'Fair': 1.0, 'Poor': 1.3, 'Critical': 1.6}
    mod = age_modifier.get(bldg_condition, 1.0)
    
    for comp_name, spec in COMPONENT_CATALOG.items():
        if comp_name in BUILDING_LEVEL_COMPS:
            # Building-level component: one instance per building
            component_id += 1
            eff_age = max(1, round(bldg_age * mod * random.uniform(0.7, 1.3)))
            cond = compute_condition(eff_age, spec['lifecycle'])
            
            cost_scale = 0.2
            min_c, max_c = spec['cost_per_sqm']
            cost_per = random.uniform(min_c, max_c) * cost_scale
            renewal_cost = round(cost_per * sqft * 0.5)
            
            min_life, max_life = spec['lifecycle']
            mid_life = (min_life + max_life) / 2
            yrs_remaining = max(1, round(mid_life - eff_age))
            
            comp_risk = 'High' if cond in ('Poor', 'Critical') else ('Medium' if cond == 'Fair' else 'Low')
            comp_fci = random.randint(0, 90) if cond == 'Critical' else random.randint(40, 65) if cond == 'Poor' else random.randint(15, 40) if cond == 'Fair' else random.randint(0, 15)
            
            components.append({
                'component_id': component_id,
                'building_name': b['building_name'],
                'campus_group': b.get('campus_group', ''),
                'component_type': comp_name,
                'zone_id': 'BUILDING',
                'floor_level': 'All',
                'zone_name': 'Entire Building',
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
            })
        
        elif comp_name in ZONE_LEVEL_COMPS:
            # Zone-level component: one per zone
            for zone in zones:
                component_id += 1
                # Slight variation per zone
                eff_age = max(1, round(bldg_age * mod * random.uniform(0.6, 1.5)))
                cond = compute_condition(eff_age, spec['lifecycle'])
                
                cost_scale = 0.12 if comp_name in ['Lighting', 'Fire Safety', 'Carpet & Flooring'] else 0.18
                min_c, max_c = spec['cost_per_sqm']
                cost_per = random.uniform(min_c, max_c) * cost_scale
                zone_area = zone['estimated_sqft'] * 0.6
                renewal_cost = round(cost_per * zone_area)
                
                comp_risk = 'High' if cond in ('Poor', 'Critical') else ('Medium' if cond == 'Fair' else 'Low')
                comp_fci = random.randint(65, 90) if cond == 'Critical' else random.randint(40, 65) if cond == 'Poor' else random.randint(15, 40) if cond == 'Fair' else random.randint(0, 15)
                
                components.append({
                    'component_id': component_id,
                    'building_name': b['building_name'],
                    'campus_group': b.get('campus_group', ''),
                    'component_type': comp_name,
                    'zone_id': zone['zone_id'],
                    'floor_level': zone['floor_level'],
                    'zone_name': zone['zone_name'],
                    'floor_display': zone['floor_display'],
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
                })

# Group by building for budget spreading
building_comp_map = defaultdict(list)
for comp in components:
    building_comp_map[comp['building_name']].append(comp)

# Spread with budget constraint (by building)
component_priority = []
for b_name, comps in building_comp_map.items():
    total_cost = sum(c['estimated_renewal_cost'] for c in comps)
    bldg = next((b for b in buildings if b['building_name'] == b_name), None)
    priority = bldg.get('priority_score', 50) if bldg else 50
    component_priority.append((priority, b_name, comps, total_cost))

component_priority.sort(key=lambda x: x[0], reverse=True)

total_comp_need = sum(p[3] for p in component_priority)
total_comp_capacity = sum(ANNUAL_COMPONENT_BUDGET * (1.02 ** i) for i in range(25))
comp_overrun = max(1.0, total_comp_need / total_comp_capacity) if total_comp_capacity > 0 else 1.0

year_costs = defaultdict(float)
assigned = set()

for priority, b_name, comps, total_cost in component_priority:
    if b_name in assigned:
        continue
    
    assigned_year = None
    for y in range(2026, 2051):
        effective_budget = ANNUAL_COMPONENT_BUDGET * (1.02 ** (y - 2026)) * comp_overrun
        if year_costs[y] + total_cost <= effective_budget:
            assigned_year = y
            break
    
    if assigned_year is None:
        best_y = min(range(2026, 2051), key=lambda y: year_costs[y] + total_cost)
        assigned_year = best_y
    
    for comp in comps:
        comp['estimated_replacement_year'] = assigned_year
        stagger = hash(comp['component_type']) % 3 - 1
        comp['estimated_replacement_year'] = max(2026, min(2050, assigned_year + stagger))
    year_costs[assigned_year] += total_cost
    assigned.add(b_name)

# ── Summary ──────────────────────────────────────────────────
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

# Zone summary
zone_count = sum(len(zones) for zones in zone_registry.values())

component_summary = {
    'total_components': len(components),
    'total_renewal_cost': total_comp_cost,
    'critical_count': sum(1 for c in components if c['condition'] in ('Poor', 'Critical')),
    'total_zones': zone_count,
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

from collections import Counter
zone_conditions = Counter(c['zone_name'] for c in components if c['zone_name'] != 'Entire Building')
component_summary['zone_distribution'] = dict(zone_conditions.most_common())

yearly = defaultdict(float)
for c in components:
    yearly[c['estimated_replacement_year']] += c['estimated_renewal_cost']
component_summary['renewal_cost_by_year'] = {str(k): round(v) for k, v in sorted(yearly.items())}

# Save zones as separate data file
all_zones = []
for b_name, zones in zone_registry.items():
    for z in zones:
        all_zones.append({
            'building_name': b_name,
            **z
        })

with open('data/components.json', 'w') as f:
    json.dump({'components': components, 'summary': component_summary, 'zones': all_zones}, f, indent=2)

print(f"✅ {len(components)} components across {len(zone_registry)} buildings")
print(f"   {zone_count} zones generated")
print(f"   Spread across {len(yearly)} years (budget: ${ANNUAL_COMPONENT_BUDGET:,.0f}/yr)")
print(f"   Total component renewal: ${total_comp_cost:,.0f}")
