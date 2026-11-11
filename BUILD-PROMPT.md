# Claude Code rehearsal prompt

Used for the second tutorial path, rehearsed and then filmed in an isolated project. Run it in your own demo org, with the Avonni LWC skill and MCP available, using a separate component name and OmniScript subtype. Never target a customer org. The generated implementation included in ai-component is the result of the filmed session; another run can produce different code.

```text
Build an advanced Salesforce OmniScript card picker for the fictional insurer
Northfield Mutual. Use avonni-visual-picker and the avonni-lwc-components skill.
Use the Avonni MCP toolset lwc: list components, read the component documentation,
resolve all complex types and read styling hooks before generating any code.
Show your implementation plan before you build.

The provided Integration Procedures and sample JSON define the demo contract.
One rule in an active rate grid produces one card. Its stable key is
productId|ruleKey. Show the title, description, annual USD price and condition
badges. Use only documented item fields, properties, events and styling hooks.
Use one title inside each card combining the product and rule labels. Put unmet
conditions in a documented field inside the card, not an itemTitle/itemDescription
caption outside it. Use one column in a narrow container and two when space allows.

Qualified shows eligible offers for ownerOccupied and yearBuilt. All also shows
ineligible offers, disabled, with the unmet conditions explained. Keep a valid
selection when the user navigates back. Clear a selection that becomes ineligible
after the property answers change, explain why, and publish the cleared state so
the OmniScript cannot retain the previous price.

Use the standard runtime standalone integration demonstrated in this project:
extend LightningElement, accept catalog and initialChoice as public properties,
and emit the documented omniaggregate event with elementId choice and
aggregateOverride true. Publish filter, selection and valid. Do not create a mock
OmniscriptBaseMixin or add a dependency on an unavailable customization package.
Avoid repeated updates when the parent passes the same state back to the LWC.
In this tested standalone integration, do not expose public checkValidity or
reportValidity methods: the native Messaging Requirement owns navigation.

The OmniScript has three steps: property details, plan selection and review.
A native Messaging Requirement guards navigation using choice.valid. Before
review, the provided validation IP receives only the selection key and property
answers. The review must display the title and price returned by that IP, not
trust a price supplied by the browser. Use the supplied native metadata schemas.
Enable the native Standalone LWC checkbox with bStandalone:true in the Custom LWC
property set; standalone:true is not the property saved by this Designer.

Use a separate component named northfieldPlanPickerAi and a separate OmniScript
subtype. Deploy only to the rehearsal org explicitly configured in this project.

Test the component you actually generated in Salesforce:
1. Owner-occupied, built1996: two qualified cards, four in All.
2. No selection: Next stays on the step with an explanation.
3. Select Condo: one Next reaches the server-verified $1,240 annual price.
4. Previous restores the valid selection.
5. Go back to property details, change the year to1975: old choice is cleared,
   no qualified offers remain, All explains the requirements, Next is blocked.
6. Restore1996, select a valid offer and reach review again.
7. Check keyboard selection and a narrow container.

Run the provided server tests too: unknown and inactive keys, wrong occupation,
boundary or fractional years and missing answers must fail; a client price of
1 must not replace the server price of1240 for an eligible Condo selection.
Report what was really tested and any remaining failures. Do not claim success
from a deployment or local unit tests alone.
```
