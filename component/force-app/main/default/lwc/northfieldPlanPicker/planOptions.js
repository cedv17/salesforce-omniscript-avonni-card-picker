// Demo contract: prices are annual USD amounts; requirements use two intake answers.
export function buildPlanOptions(catalog) {
    if (!catalog || !Array.isArray(catalog.products)) {
        throw new Error('The plan catalog is unavailable. Please reload this step.');
    }
    const applicant = catalog.applicant || {};
    const keys = new Set();
    return catalog.products.flatMap((product) => {
        if (!Array.isArray(product.rateGrids)) throw new Error('Missing rate grids.');
        return product.rateGrids.filter((grid) => grid.active === true).flatMap((grid) => {
            if (!Array.isArray(grid.rules)) throw new Error('Missing pricing rules.');
            return grid.rules.map((rule) => {
                const parts = [product.productId, rule.ruleKey];
                if (parts.some((part) => typeof part !== 'string' || !part || part.includes('|'))) {
                    throw new Error('Plan identifiers must be nonempty and cannot contain |.');
                }
                const value = parts.join('|');
                if (keys.has(value)) throw new Error('Duplicate plan key: ' + value);
                keys.add(value);
                if (!Number.isFinite(rule.basePrice) || rule.basePrice < 0 || rule.currency !== 'USD') {
                    throw new Error('Invalid annual USD price for ' + value);
                }
                const requirements = rule.requirements;
                if (!requirements || typeof requirements.ownerOccupied !== 'boolean' ||
                    !Number.isInteger(requirements.builtAfter) ||
                    typeof product.name !== 'string' || typeof rule.label !== 'string' ||
                    typeof rule.description !== 'string') {
                    throw new Error('Incomplete plan details for ' + value);
                }
                const title = product.name + ', ' + rule.label;
                const priceLabel = new Intl.NumberFormat('en-US', {
                    style: 'currency', currency: rule.currency, maximumFractionDigits: 2
                }).format(rule.basePrice).replace(/\.00$/, '');
                const reasons = [];
                if (applicant.ownerOccupied !== requirements.ownerOccupied) {
                    reasons.push(requirements.ownerOccupied ? 'Requires owner occupancy' : 'Requires tenant occupancy');
                }
                if (!Number.isInteger(applicant.yearBuilt) || applicant.yearBuilt <= requirements.builtAfter) {
                    reasons.push('Requires a home built after ' + requirements.builtAfter);
                }
                const qualified = reasons.length === 0;
                return {
                    qualified,
                    item: {
                        value, title, titlePosition: 'top',
                        ...(!qualified ? {disabled: true} : {}),
                        description: rule.description, descriptionPosition: 'bottom',
                        tags: [
                            {label: requirements.ownerOccupied ? 'Owner-occupied' : 'Tenant-occupied'},
                            {label: 'Built after ' + requirements.builtAfter}
                        ],
                        fields: [
                            {label: 'Annual premium (USD)', value: priceLabel},
                            ...(!qualified ? [{label: 'Not eligible', value: reasons.join('. ')}] : [])
                        ]
                    },
                    selection: {
                        selectionKey: value, productId: product.productId, ruleKey: rule.ruleKey,
                        title, price: rule.basePrice, currency: rule.currency, period: 'year', priceLabel
                    }
                };
            });
        });
    });
}

export function visiblePlans(options, filter) {
    return filter === 'all' ? options : options.filter((option) => option.qualified);
}

export function selectedPlan(options, filter, value) {
    return visiblePlans(options, filter).find((option) => option.qualified && option.item.value === value)?.selection || null;
}
