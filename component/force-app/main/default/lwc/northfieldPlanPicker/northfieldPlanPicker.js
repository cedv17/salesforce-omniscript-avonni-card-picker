import { LightningElement, api } from 'lwc';
import { buildPlanOptions, visiblePlans, selectedPlan } from './planOptions';

export default class NorthfieldPlanPicker extends LightningElement {
    filter = 'qualified';
    value = '';
    error = '';
    notice = '';
    _initialChoice;
    _connected = false;
    _catalog;
    _options = [];
    _publishAfterRender = true;
    _lastPublished;
    columns = {cols: 1, smallContainerCols: 1, mediumContainerCols: 2, largeContainerCols: 2};
    fieldAttributes = {cols: 1, variant: 'label-stacked'};
    filterOptions = [{label: 'Qualified', value: 'qualified'}, {label: 'All', value: 'all'}];

    @api
    get initialChoice() { return this._initialChoice; }
    set initialChoice(value) {
        this._initialChoice = value;
        if (this._connected) this.restoreChoice();
    }

    @api
    get catalog() { return this._catalog; }
    set catalog(value) {
        this._catalog = value;
        try {
            this._options = buildPlanOptions(value);
            this.error = '';
        } catch (error) {
            this._options = [];
            this.error = error.message;
        }
        this.clearInvalidChoice();
        this._publishAfterRender = true;
    }

    connectedCallback() {
        this._connected = true;
        this.restoreChoice();
    }

    restoreChoice() {
        const saved = this._initialChoice;
        this.filter = saved?.filter === 'all' ? 'all' : 'qualified';
        this.value = saved?.selection?.selectionKey || '';
        if (this._catalog !== undefined) this.clearInvalidChoice();
        this._publishAfterRender = true;
    }

    clearInvalidChoice() {
        if (this.value && !this.selection) {
            this.value = '';
            this.notice = 'Your previous plan no longer qualifies. Review your property details or choose another plan.';
        }
    }

    renderedCallback() {
        if (this._publishAfterRender && this._catalog !== undefined) {
            this._publishAfterRender = false;
            this.publishSelection();
        }
    }

    get items() { return visiblePlans(this._options, this.filter).map((option) => option.item); }
    get planCount() { return this.items.length; }
    get noPlans() { return !this.error && this.planCount === 0; }
    get selection() { return selectedPlan(this._options, this.filter, this.value); }

    handleFilterChange(event) {
        this.filter = event.detail.value;
        this.clearInvalidChoice();
        this.publishSelection();
    }

    handleSelectionChange(event) {
        this.value = event.detail.value;
        this.notice = '';
        this.clearInvalidChoice();
        this.publishSelection();
    }

    publishSelection() {
        // Replace this Custom LWC's node so a cleared selection cannot leave an old price.
        const selection = this.selection;
        const data = {filter: this.filter, selection, valid: Boolean(selection)};
        const signature = JSON.stringify(data);
        if (signature === this._lastPublished) return;
        this._lastPublished = signature;
        this.dispatchEvent(new CustomEvent('omniaggregate', {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: {data, elementId: 'choice', aggregateOverride: true}
        }));
    }

}
