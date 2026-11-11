"""Small XML helpers shared by the tutorial's fixture generators."""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'org/force-app/main/default'


def write(relative, content):
    path = OUT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def element(name, kind, sequence, config, parent=None, children=''):
    tag = 'childElements' if parent else 'omniProcessElements'
    parent_xml = f'<parentElementName>{parent}</parentElementName><parentElementType>Step</parentElementType>' if parent else ''
    return f'''<{tag}><name>{name}</name><type>{kind}</type><level>{1 if parent else 0}</level>
<sequenceNumber>{sequence}</sequenceNumber><isActive>true</isActive>{parent_xml}
<propertySetConfig>{html.escape(json.dumps(config, ensure_ascii=False))}</propertySetConfig>{children}</{tag}>'''


def process(root, name, subtype, elements, integration=False):
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<{root} xmlns="http://soap.sforce.com/2006/04/metadata">
<description>Fictional Northfield Mutual tutorial data and card selection.</description>
<isActive>true</isActive><isIntegrationProcedure>{str(integration).lower()}</isIntegrationProcedure>
<isOmniScriptEmbeddable>false</isOmniScriptEmbeddable><isWebCompEnabled>{str(not integration).lower()}</isWebCompEnabled>
<language>English</language><name>{name}</name><omniProcessType>{'Integration Procedure' if integration else 'OmniScript'}</omniProcessType>
{elements}<subType>{subtype}</subType><type>Northfield</type>
<uniqueName>Northfield_{subtype}_English_1</uniqueName><versionNumber>1</versionNumber>
</{root}>'''
