"""Build a small server-side fixture validator from the same Northfield catalog.

Conditional Response Actions stop at the matching admissible offer. The fallback
rejects unknown, inactive or ineligible keys. Client-supplied prices are never read.
"""
import html
import json
from pathlib import Path
from omni_metadata import element, process, write

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'org/force-app/main/default/omniIntegrationProcedures'
catalog = json.loads((ROOT / 'data/plan-catalog.json').read_text())


def response(name, sequence, output, condition=''):
    config = {
        'returnOnlyAdditionalOutput': True, 'returnFullDataJSON': False,
        'responseFormat': 'JSON', 'useFormulas': False,
        'additionalOutput': output, 'executionConditionalFormula': condition,
        'sendJSONPath': '', 'sendJSONNode': '', 'responseDefaultData': {}
    }
    return f'''<omniProcessElements><name>{name}</name><type>Response Action</type>
<level>0</level><sequenceNumber>{sequence}</sequenceNumber><isActive>true</isActive>
<propertySetConfig>{html.escape(json.dumps(config))}</propertySetConfig></omniProcessElements>'''


elements = []
for product in catalog['products']:
    for grid in product['rateGrids']:
        if not grid['active']:
            continue
        for rule in grid['rules']:
            key = product['productId'] + '|' + rule['ruleKey']
            required = rule['requirements']
            condition = (
                f'%selectionKey% == "{key}" && '
                f'%ownerOccupied% == {str(required["ownerOccupied"]).lower()} && '
                f'%yearBuilt% > {required["builtAfter"]} && '
                f'ROUND(%yearBuilt%, 0) == %yearBuilt%'
            )
            price_label = f'${rule["basePrice"]:,.2f}'.removesuffix('.00')
            selection = {
                'selectionKey': key, 'productId': product['productId'],
                'ruleKey': rule['ruleKey'], 'title': product['name'] + ', ' + rule['label'],
                'price': rule['basePrice'], 'currency': rule['currency'],
                'period': 'year', 'priceLabel': price_label
            }
            number = len(elements) + 1
            elements.append(response(f'AcceptOffer{number}', number,
                                     {'valid': True, 'selection': selection, 'message': ''}, condition))
elements.append(response('RejectSelection', len(elements) + 1, {
    'valid': False, 'selection': None,
    'message': 'This plan is unavailable for these property details. Choose another plan.'
}))
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'Northfield_ValidateSelection_English_1.oip-meta.xml').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<OmniIntegrationProcedure xmlns="http://soap.sforce.com/2006/04/metadata">
<description>Northfield tutorial fixture only. Validates the key and property details against the server catalog.</description>
<isActive>true</isActive><isIntegrationProcedure>true</isIntegrationProcedure>
<isOmniScriptEmbeddable>false</isOmniScriptEmbeddable><isWebCompEnabled>false</isWebCompEnabled>
<language>English</language><name>Northfield_ValidateSelection</name><omniProcessType>Integration Procedure</omniProcessType>
{''.join(elements)}<subType>ValidateSelection</subType><type>Northfield</type>
<uniqueName>Northfield_ValidateSelection_English_1</uniqueName><versionNumber>1</versionNumber>
</OmniIntegrationProcedure>''')
print('Generated Northfield_ValidateSelection from active catalog rules')

# Keep the original static catalog for baseline evidence. This second IP echoes
# the actual intake answers used by the advanced OmniScript.
live_catalog = dict(catalog, applicant='%applicant%')
live_response = element('ReturnCatalog', 'Response Action', 1, {
    'returnOnlyAdditionalOutput': True, 'returnFullDataJSON': False,
    'responseFormat': 'JSON', 'useFormulas': True, 'additionalOutput': live_catalog,
    'sendJSONPath': '', 'sendJSONNode': '', 'responseDefaultData': {}
})
write('omniIntegrationProcedures/Northfield_PlanCatalogLive_English_1.oip-meta.xml',
      process('OmniIntegrationProcedure', 'Northfield_PlanCatalogLive', 'PlanCatalogLive', live_response, True))
print('Generated Northfield_PlanCatalogLive with intake answers')
