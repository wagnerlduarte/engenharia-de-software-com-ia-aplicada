export const ORDERS_CONTEXT = `
## Business Rules - VTEX OMS Orders Analytics

### Value / Currency Rules
- The column "value" stores the order total in CURRENCY UNITS (e.g. 3169.10 BRL)
- Inside SUPER columns (totals, items, transactions, packages), ALL monetary values are in CENTS (e.g. 316910 = R$3,169.10)
- Always divide SUPER column monetary values by 100.0 when displaying to users
- Currency is determined by storepreferencesdata_currencycode: 'BRL', 'ARS', 'USD', etc.

### Tenant / Store Isolation
- "hostname" is the VTEX account name (tenant identifier). EVERY query MUST filter by hostname.
- "seller_parent_account" indicates franchise/white-label parent (e.g. "lojaanimale" is parent of "animalearacaju")

### Order Status Flow
- null: no status defined yet
- "payment-pending": awaiting payment
- "payment-approved": payment confirmed
- "window-to-cancel": in cancellation window
- "ready-for-handling": ready for fulfillment
- "handling": being prepared/shipped
- "invoiced": invoice issued, shipped
- "canceled": order canceled
- Use iscompleted = true to find orders that completed the full workflow
- Use workflowisinerror = true to find orders with workflow errors

### Order Origin
- origin = 'Marketplace': the store received the order as a marketplace
- origin = 'Fulfillment': the store is fulfilling an order from another marketplace
- affiliateid identifies the integration source (e.g. 'SLR' for Seller integration)

### Shipping & Logistics
- shippingEstimate inside shippingdata_logisticsinfo is a string like "5bd" (5 business days)
- deliveryChannel: "delivery" (shipped) or "pickup-in-point" (click & collect)
- selectedSla: the chosen delivery SLA name (e.g. "Normal - Correios", "Frete Gratis")

### Dates & Performance
- SORTKEY is (batch_id, hostname, creationdate) - filter by hostname + creationdate for best performance
- batch_id format: "YYYY_MM_DD_HH" (e.g. "2022_01_21_00")
- Always use creationdate ranges when possible to improve query performance

### Items & Products
- Items array contains full product details with brand, category, dimensions
- sellingPrice = final price paid (after discounts), price = original price, listPrice = catalog price
- priceTags array shows applied discounts with rawValue in cents
- measurementUnit: "un" (unit), "kg" (kilogram, used with unitMultiplier for weight-based products)

### Diagnostic Signals (use these when the question sounds diagnostic)

#### Payment Problem Signals (order has a problem if ANY is true)
- No authorization: \`authorizeddate IS NULL\`
- Stuck in payment: \`status IN ('payment-pending','canceled')\`
- Missing transaction (cheap, no SUPER scan): \`transactions IS NULL\`
- Has cancel reason (often correlated with payment retry): \`cancelreason IS NOT NULL\`
- Multiple attempts (use ONLY when the question explicitly asks; prefer a CTE that unnests transactions ONCE filtered by hostname+batch_id, then counts; never use JSON_ARRAY_LENGTH on SUPER directly).

#### Workflow Error Signals
- Active error: \`workflowisinerror = true\`
- Incomplete flow: \`iscompleted = false\`
- Stuck: \`iscompleted = false AND lastchange < DATEADD(hour, -24, GETDATE())\`

#### Duplicate Order Signals (heuristic)
- Same customer (\`clientprofiledata_email\`), same \`value\`, \`creationdate\` within 10 minutes.

### Diagnostic Question Patterns
These Portuguese/English keywords indicate a DIAGNOSTIC question (generate comparative SQL with rates, not a simple filter):
- Portuguese: "tem problema", "esta com erro", "por que", "qual a taxa", "quantos estao falhando", "esta correto", "ha inconsistencia", "ha correlacao"
- English: "is there an issue", "what's wrong", "why", "rate of", "how many are failing", "is there a correlation"
`;
