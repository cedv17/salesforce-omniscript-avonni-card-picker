import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPlanOptions, visiblePlans, selectedPlan } from '../component/force-app/main/default/lwc/northfieldPlanPicker/planOptions.js';

const fixture = () => JSON.parse(readFileSync(new URL('../data/plan-catalog.json', import.meta.url)));

test('the intake answers produce two qualified cards and All adds exactly two', () => {
    const catalog = fixture();
    const original = structuredClone(catalog);
    const options = buildPlanOptions(catalog);
    assert.equal(options.length, 4);
    assert.deepEqual(visiblePlans(options, 'qualified').map((p) => p.item.value), ['home-basic|condo', 'home-basic|house']);
    assert.equal(visiblePlans(options, 'all').length, 4);
    assert.deepEqual(catalog, original);
});

test('the selected rule retains its identity, numeric price, currency and display label', () => {
    const selected = selectedPlan(buildPlanOptions(fixture()), 'qualified', 'home-basic|condo');
    assert.deepEqual(selected, {
        selectionKey: 'home-basic|condo', productId: 'home-basic', ruleKey: 'condo',
        title: 'Home Basic, Condo', price: 1240, currency: 'USD', period: 'year', priceLabel: '$1,240'
    });
});

test('All explains ineligible offers without allowing their submission', () => {
    const options = buildPlanOptions(fixture());
    assert.equal(selectedPlan(options, 'all', 'rental-cover|landlord'), null);
    assert.equal(selectedPlan(options, 'qualified', 'rental-cover|landlord'), null);
    assert.equal(selectedPlan(options, 'all', 'missing'), null);
    const rental = options.find((p) => p.item.value === 'rental-cover|landlord');
    assert.equal(rental.item.disabled, true);
    assert.match(rental.item.fields[1].value, /Requires tenant occupancy/);
    assert.equal(options[0].item.disabled, undefined);
});

test('changed property details invalidate a previously selected key even in All', () => {
    const catalog = fixture();
    assert.ok(selectedPlan(buildPlanOptions(catalog), 'all', 'home-basic|condo'));
    catalog.applicant.yearBuilt = 1975;
    const options = buildPlanOptions(catalog);
    assert.equal(selectedPlan(options, 'all', 'home-basic|condo'), null);
    assert.equal(visiblePlans(options, 'qualified').length, 0);
    assert.match(options[0].item.fields[1].value, /built after 1980/);
});

test('qualification changes with intake answers and built-after excludes the boundary year', () => {
    const catalog = fixture();
    catalog.applicant = {ownerOccupied: false, yearBuilt: 1981};
    assert.deepEqual(visiblePlans(buildPlanOptions(catalog), 'qualified').map((p) => p.item.value), ['rental-cover|landlord']);
    catalog.applicant.yearBuilt = 1980;
    assert.equal(visiblePlans(buildPlanOptions(catalog), 'qualified').length, 0);
    catalog.applicant = {};
    assert.equal(visiblePlans(buildPlanOptions(catalog), 'qualified').length, 0);
});

test('duplicate active keys and reserved delimiters fail rather than selecting the wrong price', () => {
    const catalog = fixture();
    catalog.products[0].rateGrids.push(structuredClone(catalog.products[0].rateGrids[0]));
    assert.throws(() => buildPlanOptions(catalog), /Duplicate plan key/);
    const invalid = fixture();
    invalid.products[0].productId = 'home|basic';
    assert.throws(() => buildPlanOptions(invalid), /cannot contain/);
});

test('invalid prices fail, and inactive rules never enter the choices', () => {
    const catalog = fixture();
    catalog.products[0].rateGrids[0].rules[0].basePrice = '1240';
    assert.throws(() => buildPlanOptions(catalog), /Invalid annual USD price/);
    assert.ok(buildPlanOptions(fixture()).every((p) => !p.item.value.endsWith('|retired')));
});

test('empty and missing catalogs cannot produce a selection', () => {
    assert.deepEqual(buildPlanOptions({products: []}), []);
    assert.equal(selectedPlan([], 'all', 'home-basic|condo'), null);
    assert.throws(() => buildPlanOptions(null), /unavailable/);
});
