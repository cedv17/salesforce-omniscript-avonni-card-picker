"""Build the three-step tutorial using a validation schema captured in Designer."""
import json
import sys
from omni_metadata import ROOT, element, process, write

SUBTYPE = sys.argv[1] if len(sys.argv) > 1 else 'CardPickerFinal'
COMPONENT = sys.argv[2] if len(sys.argv) > 2 else 'northfieldPlanPicker'
if not SUBTYPE.isalnum() or not COMPONENT.isalnum():
    raise SystemExit('Subtype and component must be alphanumeric')
native = json.loads((ROOT / 'data/native-validation-config.json').read_text())


def expression(path):
    serialized = json.dumps(native['validateExpression'])
    if '"field": "ownerOccupied"' not in serialized:
        raise ValueError('Expected native condition on ownerOccupied')
    return json.loads(serialized.replace('"field": "ownerOccupied"', '"field": "' + path + '"'))


def requirement(name, sequence, parent, path, text):
    return element(name, 'Validation', sequence, {
        'controlWidth': 12, 'label': name, 'hideLabel': True,
        'validateExpression': expression(path),
        'messages': [
            {'value': True, 'type': 'Success', 'text': '', 'active': False},
            {'value': False, 'type': 'Requirement', 'text': text, 'active': True}
        ], 'show': None, 'HTMLTemplateId': ''
    }, parent)


def step(name, sequence, label, children):
    return element(name, 'Step', sequence, {
        'label': label, 'validationRequired': True, 'chevronEnabled': True,
        'previousLabel': 'Previous', 'nextLabel': 'Next', 'allowSaveForLater': False
    }, children=children)


def ip(name, sequence, key, output, payload):
    return element(name, 'Integration Procedure Action', sequence, {
        'label': name, 'integrationProcedureKey': key,
        'responseJSONNode': output, 'responseJSONPath': '', 'sendJSONPath': '', 'sendJSONNode': '',
        'extraPayload': payload, 'sendOnlyExtraPayload': True, 'failOnStepError': True,
        'remoteOptions': {}, 'remoteTimeout': 30000, 'invokeMode': 'default', 'validationRequired': 'Step'
    })


occupancy = element('ownerOccupied', 'Checkbox', 1, {
    'controlWidth': 6, 'label': 'Occupancy', 'checkLabel': 'Owner-occupied', 'defaultValue': True
}, 'PropertyDetails')
year = element('yearBuilt', 'Number', 2, {
    'controlWidth': 6, 'label': 'Year built', 'defaultValue': 1996, 'required': True,
    'pattern': '^[0-9]{4}$', 'ptrnErrText': 'Enter a four-digit year.'
}, 'PropertyDetails')
details = step('PropertyDetails', 1, 'Tell us about the property', occupancy + year)
load = ip('LoadCatalog', 2, 'Northfield_PlanCatalogLive', 'PlanCatalog', {'applicant': '%PropertyDetails%'})
picker = element('PlanPicker', 'Custom Lightning Web Component', 1, {
    'label': 'Choose your annual coverage', 'lwcName': COMPONENT,
    'bStandalone': True, 'controlWidth': 12,
    'customAttributes': [
        {'name': 'catalog', 'source': '%PlanCatalog%'},
        {'name': 'initial-choice', 'source': '%ChoosePlan:PlanPicker:choice%'}
    ]
}, 'ChoosePlan')
choice_valid = 'ChoosePlan:PlanPicker:choice:valid'
choose = step('ChoosePlan', 3, 'Choose a plan', picker + requirement(
    'RequirePlan', 2, 'ChoosePlan', choice_valid, 'Choose an eligible plan before continuing.'))
validate = ip('ValidateSelection', 4, 'Northfield_ValidateSelection', 'QuoteValidation', {
    'selectionKey': '%ChoosePlan:PlanPicker:choice:selection:selectionKey%',
    'ownerOccupied': '%PropertyDetails:ownerOccupied%', 'yearBuilt': '%PropertyDetails:yearBuilt%'
})
review_text = element('SelectedPlan', 'Text Block', 1, {
    'label': 'Verified plan', 'controlWidth': 12,
    'show': expression('QuoteValidation:valid'), 'conditionType': 'Hide if False',
    'text': '<h2>Selected: %QuoteValidation:selection:title% · %QuoteValidation:selection:priceLabel%</h2>'
            '<p>Annual premium in USD. Plan and price verified against the current catalog.</p>'
}, 'ReviewPlan')
review = step('ReviewPlan', 5, 'Review your verified choice', review_text + requirement(
    'RequireVerifiedPlan', 2, 'ReviewPlan', 'QuoteValidation:valid',
    'This plan could not be verified. Go back and choose an eligible plan.'))
write(f'omniScripts/Northfield_{SUBTYPE}_English.os-meta.xml',
      process('OmniScript', 'Northfield Advanced Plan Selection', SUBTYPE, details + load + choose + validate + review))
write('flexipages/Northfield_Advanced_Selection.flexipage-meta.xml', f'''<?xml version="1.0" encoding="UTF-8"?>
<FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
<flexiPageRegions><itemInstances><componentInstance>
<componentInstanceProperties><name>type</name><value>Northfield</value></componentInstanceProperties>
<componentInstanceProperties><name>subType</name><value>{SUBTYPE}</value></componentInstanceProperties>
<componentInstanceProperties><name>language</name><value>English</value></componentInstanceProperties>
<componentName>runtime_omnistudio:omniscript</componentName><identifier>northfield_omniscript</identifier>
</componentInstance></itemInstances><name>main</name><type>Region</type></flexiPageRegions>
<masterLabel>Northfield Plan Selection</masterLabel><template><name>flexipage:defaultAppHomeTemplate</name></template><type>AppPage</type>
</FlexiPage>''')
write('tabs/Northfield_Advanced_Selection.tab-meta.xml', '''<?xml version="1.0" encoding="UTF-8"?>
<CustomTab xmlns="http://soap.sforce.com/2006/04/metadata"><flexiPage>Northfield_Advanced_Selection</flexiPage><label>Northfield Plan Selection</label><motif>Custom20: Compass</motif></CustomTab>''')
print('Generated', SUBTYPE)
