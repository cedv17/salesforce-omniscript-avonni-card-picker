"""Exercise the deployed fixture IP through the official Connect REST API."""
import html
import argparse
import json
import os
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--target-org', default=os.environ.get('SF_TARGET_ORG'))
args = parser.parse_args()
if not args.target_org:
    parser.error('Pass --target-org with your demo org alias, or set SF_TARGET_ORG.')

cases = [
    ('condo', {'selectionKey': 'home-basic|condo', 'ownerOccupied': True, 'yearBuilt': 1996}, 1240),
    ('house', {'selectionKey': 'home-basic|house', 'ownerOccupied': True, 'yearBuilt': 1996}, 1680),
    ('new home', {'selectionKey': 'home-plus|new-home', 'ownerOccupied': True, 'yearBuilt': 2020}, 1920),
    ('rental', {'selectionKey': 'rental-cover|landlord', 'ownerOccupied': False, 'yearBuilt': 1996}, 1480),
    ('changed year', {'selectionKey': 'home-basic|condo', 'ownerOccupied': True, 'yearBuilt': 1975}, None),
    ('boundary year', {'selectionKey': 'home-basic|condo', 'ownerOccupied': True, 'yearBuilt': 1980}, None),
    ('wrong occupation', {'selectionKey': 'home-basic|condo', 'ownerOccupied': False, 'yearBuilt': 1996}, None),
    ('unknown key', {'selectionKey': 'missing', 'ownerOccupied': True, 'yearBuilt': 1996}, None),
    ('inactive rule', {'selectionKey': 'home-basic|retired', 'ownerOccupied': True, 'yearBuilt': 1996}, None),
    ('tampered price', {'selectionKey': 'home-basic|condo', 'ownerOccupied': True, 'yearBuilt': 1996, 'price': 1}, 1240),
    ('missing answers', {'selectionKey': 'home-basic|condo'}, None),
    ('missing rental occupancy', {'selectionKey': 'rental-cover|landlord', 'yearBuilt': 1996}, None),
    ('fractional year', {'selectionKey': 'home-basic|condo', 'ownerOccupied': True, 'yearBuilt': 1996.5}, None),
]
request = {'input': {'inputs': [json.dumps(inputs) for _, inputs, _ in cases]}}
result = subprocess.run([
    'sf', 'api', 'request', 'rest',
    '/services/data/v68.0/connect/omni-global/integration-procedure/execute/Northfield_ValidateSelection',
    '--target-org', args.target_org, '--method', 'POST', '--body', json.dumps(request)
], check=True, capture_output=True, text=True)
payload = json.loads(result.stdout)
assert not payload.get('error'), payload
responses = payload['response']
assert len(responses) == len(cases), payload
evidence = []
for (name, inputs, price), raw in zip(cases, responses):
    envelope = json.loads(html.unescape(raw))
    output = json.loads(envelope['response'])
    assert not json.loads(envelope.get('error') or '{}'), (name, envelope)
    assert output['valid'] is (price is not None), (name, output)
    if price is None:
        assert output.get('selection') is None and output['message'], (name, output)
    else:
        assert output['selection']['price'] == price, (name, output)
        assert output['selection']['selectionKey'] == inputs['selectionKey'], (name, output)
    evidence.append({'case': name, 'input': inputs, 'result': output})
    print('PASS:', name)
out = Path(__file__).resolve().parents[1] / 'raw/recon/server-validation.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(evidence, indent=2))
