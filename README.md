# OmniScript card picker with server validation

This tutorial uses Northfield Mutual, a fictional insurer. Its catalog and pricing rules are demo fixtures, not a production rating service.

The manual implementation combines Avonni Visual Picker with a standalone custom LWC, native OmniScript validation, and two Integration Procedures. The AI implementation is generated independently using the Avonni LWC skill and live MCP documentation.

## Requirements

- A disposable Salesforce org with OmniStudio standard runtime and Designer.
- Avonni Components installed. The tutorial was tested with version 1.14.0 on November 6, 2026.
- Salesforce CLI, an authenticated demo org alias, and access to deploy metadata.
- Node.js 18 or later for the included local tests.
- Python 3.9 or later for the server tests and optional metadata generators.
- Omnistudio Metadata enabled in Setup, and the OmniStudioAdmin and OmniStudioUser permission sets.

## Deploy the manual example

Replace `northfield-demo` with your demo org alias. From the extracted companion folder:

```sh
cd component
sf project deploy start --source-dir force-app --target-org northfield-demo
cd ../org
sf project deploy start --source-dir force-app --target-org northfield-demo
sf org assign permset --name Northfield_Tutorial --target-org northfield-demo
sf org assign permset --name OmniStudioAdmin --target-org northfield-demo
sf org assign permset --name OmniStudioUser --target-org northfield-demo
```

Open the **Northfield Mutual** app, then **Northfield Plan Selection**. The OmniScript is `Northfield / CardPickerFinal / English`.

## Follow the contract

1. PropertyDetails collects `ownerOccupied` and `yearBuilt`.
2. `Northfield_PlanCatalogLive` returns the catalog under `PlanCatalog`.
3. The Custom LWC accepts `catalog` and `initial-choice`. Its native **Standalone LWC** property is `bStandalone: true`.
4. `omniaggregate` replaces `ChoosePlan.PlanPicker.choice` with `filter`, `selection`, and `valid`.
5. A native Messaging Requirement guards Next using `choice.valid`.
6. `Northfield_ValidateSelection` receives only the key and property answers. It returns the catalog price for an eligible active offer.
7. ReviewPlan reads `QuoteValidation.selection`; its own requirement prevents completion when the server response is invalid.

The wrapper has no public `checkValidity` or `reportValidity` methods. That is the tested standalone pattern for this example; it is not a general rule for mixin-based OmniScript components.

## Test it

From the companion folder:

```sh
node --test tests/planOptions.test.mjs
python3 tests/validate_ip.py --target-org northfield-demo
```

The server test exercises 13 cases through the Salesforce Connect REST API, including a price of 1 supplied by the client. An eligible Condo selection must still return the server price of 1240.

In Salesforce, verify:

1. Owner-occupied, built 1996: two Qualified offers, four in All, with two disabled and their reasons shown.
2. Empty Next stays on the selection step with an explanation.
3. Condo reaches the server-verified $1,240 annual premium with one Next.
4. Previous restores that valid selection.
5. Changing the year to 1975 clears the choice and blocks Next.
6. Restoring 1996 and choosing House reaches the server-verified $1,680 premium.
7. Keyboard selection skips disabled cards; a narrow container has no horizontal overflow.

## Build the AI version

Use a separate project and a disposable org. Install the Avonni LWC skill and configure the Avonni MCP for that project. Supply `BUILD-PROMPT.md`, the data fixtures, server tests, and native metadata schemas, without copying the manual LWC into the AI project.

Review the plan, let the assistant generate and deploy its own component, then repeat the Salesforce acceptance test above. A successful deployment or a local test alone does not verify the return trip.

To inspect or deploy the result of the filmed session, use the included `ai-component` project after the shared server metadata above is deployed:

```sh
cd ai-component
sf project deploy start --source-dir force-app --target-org northfield-demo
sf org assign permset --name Northfield_AI_Tutorial --target-org northfield-demo
```

Open **Northfield AI Selection** from the App Launcher. The generated OmniScript is `Northfield / CardPickerAi / English`.

If an updated page appears to serve an older definition, confirm the loaded component and the active OmniScript subtype in a fresh browser session before diagnosing the integration.

## Sources

- [Avonni LWC Components](https://www.avonni.app/product/lwc-components)
- [Avonni Agent Skills setup](https://www.avonni.app/product/agent-skills-setup)
- [Salesforce standalone custom LWC](https://help.salesforce.com/s/articleView?id=sf.os_create_a_standalone_custom_lightning_web_component_18102.htm&language=en_US&type=5)
- [Salesforce OmniScript messages](https://help.salesforce.com/s/articleView?id=xcloud.os_display_messages_in_omniscripts_19551.htm&language=en_US&type=5)
- [Salesforce Integration Procedure execution API](https://developer.salesforce.com/docs/industries/industries-common-dev/guide/connect-resources-integration-procedure.html)
