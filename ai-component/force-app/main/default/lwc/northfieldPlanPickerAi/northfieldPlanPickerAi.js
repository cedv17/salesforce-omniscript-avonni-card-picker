import { LightningElement, api, track } from 'lwc';

const FILTER_QUALIFIED = 'qualified';
const FILTER_ALL = 'all';

const FILTER_OPTIONS = [
    { label: 'Qualified', value: FILTER_QUALIFIED },
    { label: 'All', value: FILTER_ALL }
];

// One column in a narrow container, two once the container is >= 480px wide.
const COLUMN_ATTRIBUTES = { cols: 1, smallContainerCols: 2 };

function parseJson(value) {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch (e) {
            return undefined;
        }
    }
    return value;
}

function parseBoolean(value) {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
}

function parseYear(value) {
    if (value === null || value === undefined || value === '') return undefined;
    const year = Number(value);
    return Number.isInteger(year) ? year : undefined;
}

function formatPrice(amount, currency) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
        maximumFractionDigits: 0
    }).format(amount);
}

function occupancyLabel(ownerOccupied) {
    return ownerOccupied ? 'Owner-occupied' : 'Tenant-occupied';
}

/**
 * Turns the catalog contract into a flat list of offers.
 * One rule of an active rate grid = one offer, keyed productId|ruleKey.
 */
export function buildOffers(catalog) {
    const applicant = (catalog && catalog.applicant) || {};
    const ownerOccupied = parseBoolean(applicant.ownerOccupied);
    const yearBuilt = parseYear(applicant.yearBuilt);
    const offers = [];

    ((catalog && catalog.products) || []).forEach((product) => {
        (product.rateGrids || [])
            .filter((grid) => grid && grid.active === true)
            .forEach((grid) => {
                (grid.rules || []).forEach((rule) => {
                    if (!rule || !rule.ruleKey) return;
                    const requirements = rule.requirements || {};
                    const conditions = [];

                    if (typeof requirements.ownerOccupied === 'boolean') {
                        conditions.push({
                            label: occupancyLabel(requirements.ownerOccupied),
                            met: ownerOccupied === requirements.ownerOccupied,
                            reason: requirements.ownerOccupied
                                ? 'Requires an owner-occupied property'
                                : 'Requires a tenant-occupied property'
                        });
                    }
                    if (requirements.builtAfter !== undefined) {
                        conditions.push({
                            label: `Built after ${requirements.builtAfter}`,
                            met:
                                yearBuilt !== undefined &&
                                yearBuilt > Number(requirements.builtAfter),
                            reason: `Requires a property built after ${requirements.builtAfter}`
                        });
                    }

                    const title = `${product.name}, ${rule.label || rule.ruleKey}`;
                    const price = Number(rule.basePrice);
                    offers.push({
                        selectionKey: `${product.productId}|${rule.ruleKey}`,
                        productId: product.productId,
                        ruleKey: rule.ruleKey,
                        title,
                        description: rule.description || '',
                        price,
                        currency: rule.currency || 'USD',
                        priceLabel: formatPrice(price, rule.currency),
                        conditions,
                        eligible: conditions.every((c) => c.met),
                        unmet: conditions.filter((c) => !c.met).map((c) => c.reason)
                    });
                });
            });
    });
    return offers;
}

function toSelection(offer) {
    return {
        selectionKey: offer.selectionKey,
        productId: offer.productId,
        ruleKey: offer.ruleKey,
        title: offer.title,
        price: offer.price,
        currency: offer.currency,
        period: 'year',
        priceLabel: offer.priceLabel
    };
}

/** Normalizes any state (ours or the parent's echo) so it can be compared. */
function normalizeState(state) {
    if (!state || typeof state !== 'object') return null;
    const s = state.selection;
    const selection =
        s && s.selectionKey
            ? {
                  selectionKey: String(s.selectionKey),
                  productId: s.productId,
                  ruleKey: s.ruleKey,
                  title: s.title,
                  price: Number(s.price),
                  currency: s.currency,
                  period: s.period,
                  priceLabel: s.priceLabel
              }
            : null;
    return {
        filter: state.filter === FILTER_ALL ? FILTER_ALL : FILTER_QUALIFIED,
        selection,
        valid: parseBoolean(state.valid) === true && selection !== null
    };
}

function signature(state) {
    return JSON.stringify(normalizeState(state));
}

export default class NorthfieldPlanPickerAi extends LightningElement {
    filterOptions = FILTER_OPTIONS;
    columnAttributes = COLUMN_ATTRIBUTES;

    @track offers = [];
    filter = FILTER_QUALIFIED;
    selectedKey = null;
    notice = '';

    _catalog;
    _initialChoice;
    _connected = false;
    _syncQueued = false;
    _lastPublishedSig; // last state this component sent
    _lastIncomingSig; // last state received through initialChoice
    _parentSig; // state the OmniScript currently holds, as far as we know

    @api
    get catalog() {
        return this._catalog;
    }
    set catalog(value) {
        this._catalog = parseJson(value);
        this.scheduleSync();
    }

    @api
    get initialChoice() {
        return this._initialChoice;
    }
    set initialChoice(value) {
        this._initialChoice = parseJson(value);
        this.scheduleSync();
    }

    connectedCallback() {
        this._connected = true;
        this.sync();
    }

    disconnectedCallback() {
        this._connected = false;
    }

    // Coalesce setter calls made in the same tick into a single reconciliation.
    scheduleSync() {
        if (!this._connected || this._syncQueued) return;
        this._syncQueued = true;
        Promise.resolve().then(() => {
            this._syncQueued = false;
            if (this._connected) this.sync();
        });
    }

    sync() {
        const catalog = this._catalog;
        if (!catalog || !Array.isArray(catalog.products)) {
            return; // Wait for the catalog before deciding anything.
        }
        this.offers = buildOffers(catalog);

        const incoming = normalizeState(this._initialChoice);
        const incomingSig = JSON.stringify(incoming);
        const incomingChanged = incomingSig !== this._lastIncomingSig;
        this._lastIncomingSig = incomingSig;
        if (incomingChanged) {
            this._parentSig = incomingSig;
        }

        // Adopt the parent's state only when it differs from what we published
        // (e.g. the component is re-created after Previous).
        if (incoming && incomingChanged && incomingSig !== this._lastPublishedSig) {
            this.filter = incoming.filter;
            this.selectedKey = incoming.selection ? incoming.selection.selectionKey : null;
        }

        this.dropIneligibleSelection();
        this.publish();
    }

    dropIneligibleSelection() {
        if (!this.selectedKey) return;
        const offer = this.offers.find((o) => o.selectionKey === this.selectedKey);
        if (offer && offer.eligible) return;

        this.notice = offer
            ? `Your previous choice, ${offer.title}, was cleared because it no longer matches the property details. ${offer.unmet.join('. ')}.`
            : 'Your previous choice was cleared because it is no longer offered.';
        this.selectedKey = null;
    }

    get currentState() {
        const offer = this.selectedOffer;
        return {
            filter: this.filter,
            selection: offer ? toSelection(offer) : null,
            valid: Boolean(offer)
        };
    }

    get selectedOffer() {
        if (!this.selectedKey) return null;
        const offer = this.offers.find((o) => o.selectionKey === this.selectedKey);
        return offer && offer.eligible ? offer : null;
    }

    publish() {
        const state = this.currentState;
        const sig = signature(state);
        // The parent already holds exactly this state: avoid a repeated update.
        if (sig === this._parentSig) return;
        this._parentSig = sig;
        this._lastPublishedSig = sig;
        this.dispatchEvent(
            new CustomEvent('omniaggregate', {
                bubbles: true,
                composed: true,
                detail: { data: state, elementId: 'choice', aggregateOverride: true }
            })
        );
    }

    handleFilterChange(event) {
        event.stopPropagation();
        const value = event.detail.value;
        this.filter = value === FILTER_ALL ? FILTER_ALL : FILTER_QUALIFIED;
        this.publish();
    }

    handleSelectionChange(event) {
        event.stopPropagation();
        const value = event.detail.value;
        const offer = this.offers.find((o) => o.selectionKey === value);
        this.selectedKey = offer && offer.eligible ? value : null;
        this.notice = '';
        this.publish();
    }

    get pickerItems() {
        const showAll = this.filter === FILTER_ALL;
        return this.offers
            .filter((offer) => showAll || offer.eligible)
            .map((offer) => {
                const fields = [{ label: 'Annual price', value: `${offer.priceLabel} USD / year` }];
                if (!offer.eligible) {
                    fields.push({ label: 'Not available', value: `${offer.unmet.join('. ')}.` });
                }
                return {
                    value: offer.selectionKey,
                    title: offer.title,
                    description: offer.description,
                    fields,
                    tags: offer.conditions.map((c) => ({
                        label: c.label,
                        variant: c.met ? 'success' : 'error'
                    })),
                    disabled: !offer.eligible
                };
            });
    }

    get pickerValue() {
        return this.selectedKey || '';
    }

    get hasVisibleOffers() {
        return this.pickerItems.length > 0;
    }

    get emptyMessage() {
        if (this.offers.length === 0) {
            return 'No plans are available right now.';
        }
        return 'No plans qualify for these property details. Select All to see each plan and its requirements.';
    }
}
