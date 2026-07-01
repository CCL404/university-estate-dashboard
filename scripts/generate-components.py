#!/usr/bin/env python3
"""Generate synthetic component-level asset data for the dashboard.
Each building gets realistic HVAC, carpet, fire, plumbing, electrical, and roofing components
with condition, age, lifecycle, and renewal cost consistent with the building's profile."""

import json, random, math
random.seed(42)

# Load building data
with open('data/facilities.json') as f:
    data = json.load(f)

buildings = data['buildings']

# Component types with typical lifecycle (years), cost per sqm, and naming
COMPONENT_CATALOG = {
    'HVAC System':       {'lifecycle': (15, 25), 'cost_per_sqm': (80, 200), 'unit': 'system'},
    'Carpet & Flooring': {'lifecycle': (7, 12),  'cost_per_sqm': (30, 80),  'unit': 'sqm'},
    'Fire Safety':       {'lifecycle': (10, 20), 'cost_per_sqm': (15, 40),  'unit': 'system'},
    'Electrical':        {'lifecycle': (20, 30), 'cost_per_sqm': (60, 150), 'unit': 'system'},
    'Plumbing':          {'lifecycle': (20, 35), 'cost_per_sqm': (40, 100), 'unit': 'system'},
    'Roofing':           {'lifecycle': (20, 30), 'cost_per_sqm': (50, 120), 'unit': 'sqm'},
    'Lighting':          {'lifecycle': (10, 15), 'cost_per_sqm': (20, 50),  'unit': 'system'},
    'Building Fabric':   {'lifecycle': (25, 40), 'cost_per_sqm': (40, 90),  'unit': 'sqm'},
}

def compute_condition(age_yrs, component_lifecycle):
    """Estimate component condition based on age vs lifecycle."""
    min_life, max_life = component_lifecycle
    mid_life = (min_life + max_life) / 2
    pct_used = age_yrs / mid_life
    if pct_used < 0.3:  return 'Good'
    if pct_used < 0.7:  return 'Fair'
    if pct_used < 1.0:  return 'Poor'
    return 'Critical'

def compute_renewal_cost(cost_per_sqm_range, gross_sq_ft, coverage_pct=0.3):
    """Estimate renewal cost based on building size."""
    min_c, max_c = cost_per_sqm_range
    cost_per = random.uniform(min_c, max_c)
    area = gross_sq_ft * coverage_pct * random.uniform(0.6, 1.0)
    return round(cost_per * area)

components = []
component_id = 0

for b in buildings:
    bldg_age = b.get('age', 20)
    sqft = b.get('gross_sq_ft', 5000)
    bldg_condition = b.get('condition', 'Fair')
    
    # Condition modifier: buildings in worse condition have older components
    age_modifier = {'Good': 0.7, 'Fair': 1.0, 'Poor': 1.3, 'Critical': 1.6}
    mod = age_modifier.get(bldg_condition, 1.0)
    
    for comp_name, spec in COMPONENT_CATALOG.items():
        component_id += 1
        # Effective age varies per component
        eff_age = max(1, round(bldg_age * mod * random.uniform(0.6, 1.4)))
        
        cond = compute_condition(eff_age, spec['lifecycle'])
        renewal_cost = compute_renewal_cost(spec['cost_per_sqm'], sqft)
        
        # Determine replacement year
        min_life, max_life = spec['lifecycle']
        mid_life = (min_life + max_life) / 2
        yrs_remaining = max(1, round(mid_life - eff_age))
        replacement_year = 2026 + yrs_remaining
        
        # Risk assessment
        if cond == 'Critical': comp_risk = 'High'
        elif cond == 'Poor': comp_risk = 'High'
        elif cond == 'Fair': comp_risk = 'Medium'
        else: comp_risk = 'Low'
        
        # FCI-like score for this component
        if cond == 'Critical': comp_fci = random.randint(65, 90)
        elif cond == 'Poor': comp_fci = random.randint(40, 65)
        elif cond == 'Fair': comp_fci = random.randint(15, 40)
        else: comp_fci = random.randint(0, 15)
        
        components.append({
            'component_id': component_id,
            'building_name': b['building_name'],
            'campus_group': b.get('campus_group', ''),
            'component_type': comp_name,
            'condition': cond,
            'fci': comp_fci,
            'age_years': eff_age,
            'estimated_renewal_cost': renewal_cost,
            'estimated_replacement_year': replacement_year,
            'risk_band': comp_risk,
            'recommended_action': (
                'Replace urgently' if cond == 'Critical' else
                'Renew within 1 year' if cond == 'Poor' else
                'Monitor' if cond == 'Fair' else
                'Routine inspection'
            ),
        })

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
}

# Cost by year
from collections import defaultdict
yearly = defaultdict(float)
for c in components:
    yearly[c['estimated_replacement_year']] += c['estimated_renewal_cost']
component_summary['renewal_cost_by_year'] = {
    str(k): round(v) for k, v in sorted(yearly.items())
}

# Save
with open('data/components.json', 'w') as f:
    json.dump({'components': components, 'summary': component_summary}, f, indent=2)

print(f"Generated {len(components)} components across {len(buildings)} buildings")
print(f"Total component renewal cost: ${total_comp_cost:,.0f}")
print(f"Poor/Critical components: {component_summary['critical_count']}")
print("\nBy type:")
for t, v in component_summary['component_type_summary'].items():
    print(f"  {t:20s}: {v['count']:4d} units, ${v['total_cost']:>10,.0f}, {v['pct_critical']:5.1f}% critical")
