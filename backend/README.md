# Family backend (Apps Script)

`family-Code.gs` is the Apps Script backend for one Artha family. Nothing about a family is in the code: people,
allowed Google accounts, roles, platforms and features come from the `FAMILY` script property.

- `node backend/test_family.js` runs it end to end against in-memory stand-ins for the Google services (`mock.js`):
  sign-in, roles (a viewer's write is refused by the server), retries never written twice, another family's
  session key refused, IDs past L9999, formula guard, family-prefixed inbox files.
- Paste `family-Code.gs` into a new Apps Script project as `Code.gs`. Setup steps are in the project handoff.
