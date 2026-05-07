import {
  RedshiftDataClient,
  ExecuteStatementCommand,
  DescribeStatementCommand,
  GetStatementResultCommand,
  type ExecuteStatementCommandInput,
} from '@aws-sdk/client-redshift-data';
import { fromSSO } from '@aws-sdk/credential-providers';
import { config } from '../config.ts';

const ORDERS_SCHEMA_DOCS = `
-- Table: ${config.redshift.schema}.orders_latest
-- Description: VTEX OMS orders data. One row per order.
-- DISTSTYLE KEY (orderid), SORTKEY (batch_id, hostname, creationdate)
-- IMPORTANT: Always filter by hostname (tenant). Use creationdate ranges for performance.

CREATE TABLE ${config.redshift.schema}.orders_latest (
  orderid VARCHAR,                          -- Order ID (e.g. "1204801571846-01", "SLR-v2089056anm-02")
  hostname VARCHAR,                         -- TENANT: store account name (e.g. "acerstore", "amend"). ALWAYS filter by this.
  value DOUBLE PRECISION,                   -- Order total in currency units (e.g. 3169.10 BRL). NOT in cents.
  creationdate TIMESTAMPTZ,                 -- Order creation timestamp
  authorizeddate TIMESTAMPTZ,               -- Payment authorization timestamp (null if not authorized)
  invoiceddate TIMESTAMPTZ,                 -- Invoice/fulfillment timestamp (null if not invoiced)
  lastchange TIMESTAMPTZ,                   -- Last modification timestamp
  status VARCHAR,                           -- Order status: null, 'canceled', 'invoiced', 'handling', 'ready-for-handling', 'payment-pending', 'payment-approved', 'window-to-cancel'
  iscompleted BOOLEAN,                      -- Whether the order workflow is complete
  workflowisinerror BOOLEAN,                -- Whether the order workflow has errors
  origin VARCHAR,                           -- 'Marketplace' (received as marketplace) or 'Fulfillment' (fulfilling for another marketplace)
  saleschannel VARCHAR,                     -- Sales channel ID
  affiliateid VARCHAR,                      -- Affiliate/integrator ID (e.g. 'SLR', 'LTR')
  sellerorderid VARCHAR,                    -- Seller's internal order ID
  ordergroup VARCHAR,                       -- Order group ID
  marketplaceorderid VARCHAR,               -- Marketplace order ID (for fulfillment orders)
  seller_parent_account VARCHAR,            -- Parent account for franchise/white-label (e.g. 'lojaanimale')

  -- Customer
  clientprofiledata_email VARCHAR,
  clientprofiledata_userprofileid VARCHAR,

  -- Shipping address
  shippingdata_address_city VARCHAR,
  shippingdata_address_state VARCHAR,
  shippingdata_address_country VARCHAR,     -- Country code: 'BRA', 'ARG', etc.
  shippingdata_postal_code VARCHAR,

  -- Store preferences
  storepreferencesdata_countrycode VARCHAR, -- 'BRA', 'ARG', etc.
  storepreferencesdata_timezone VARCHAR,
  storepreferencesdata_currencycode VARCHAR,-- 'BRL', 'ARS', 'USD', etc.

  -- Marketing / UTM
  marketingdata_utmsource VARCHAR,
  marketingdata_utmmedium VARCHAR,
  marketingdata_utmcampaign VARCHAR,
  marketingdata_utmpartner VARCHAR,
  marketingdata_utmipage VARCHAR,
  marketingdata_utmipart VARCHAR,
  marketingdata_utmicampaign VARCHAR,
  marketingdata_coupon VARCHAR,

  -- Marketplace
  marketplace_name VARCHAR,
  marketplace_baseurl VARCHAR,
  marketplaceservicesendpoint VARCHAR,

  -- Context
  contextdata_useragent VARCHAR,
  contextdata_userid VARCHAR,

  -- Changes
  changesattachment_id VARCHAR,

  -- Batch
  batch_id VARCHAR,                         -- Format: 'YYYY_MM_DD_HH'. Part of SORTKEY.

  -- SUPER columns (JSON arrays stored as strings - use PartiQL to query)
  -- For unnesting: FROM ${config.redshift.schema}.orders_latest o, o.column_name AS alias
  -- Always cast when extracting: ::VARCHAR, ::BIGINT, ::INT, ::BOOLEAN
  -- Values INSIDE super columns are in CENTS (divide by 100.0 for currency)

  totals SUPER,
  -- Array: [{"id":"Items","name":"Total dos Itens","value":379900}, {"id":"Discounts","name":"Total dos Descontos","value":-62990}, {"id":"Shipping","name":"Total do Frete","value":0}, {"id":"Tax","name":"Total da Taxa","value":0}]

  items SUPER,
  -- Array of order items: [{"id":"751","productId":"749","quantity":1,"seller":"1","sellerSku":"751","name":"Product Name","price":379900,"sellingPrice":316910,"listPrice":549900,"tax":0,"measurementUnit":"un","unitMultiplier":1.0,"additionalInfo":{"brandName":"Brand","brandId":"1","categoriesIds":"/36/220/","dimension":{"cubicweight":1.0,"height":6.5,"length":28.8,"weight":2320.0,"width":45.7}},"priceTags":[{"name":"DISCOUNT@MARKETPLACE","identifier":"...","isPercentual":false,"rawValue":-379.9}]}]

  transactions SUPER,
  -- Array: [{"payments":[{"group":"instantPayment","installments":1,"value":316910,"paymentSystemName":"Pix","paymentSystem":"125"}],"merchantName":"STORENAME"}]
  -- payment groups: 'instantPayment' (Pix), 'creditCard', 'debitCard', 'bankInvoice' (boleto), null (affiliate assumed)

  sellers SUPER,
  -- Array: [{"id":"1","name":"Store Name","logo":"","fulfillmentEndpoint":"...","subSellerId":null}]

  packages SUPER,
  -- Array of invoices/packages: [{"courier":"Sequoia","invoiceNumber":"000250562","invoiceValue":31920,"issuanceDate":"2022-01-20T12:41:52Z","trackingNumber":"SFS1637699418039BR","trackingUrl":"https://...","type":"Output","courierStatus":null}]

  shippingdata_logisticsinfo SUPER,
  -- Array per item: [{"deliveryIds":[{"courierId":"id","warehouseId":"1_1","dockId":"id","courierName":"Frete Gratis","quantity":1}],"shippingEstimate":"5bd","deliveryChannel":"delivery","selectedSla":"Normal - Correios","sellingPrice":0,"listPrice":0,"price":0}]
  -- shippingEstimate format: "Xbd" (X business days)

  rateandbenefitsidentifiers SUPER,
  -- Array of applied promotions: [{"id":"uuid","name":"Desconto 10% PIX","featured":false,"description":"Desconto 10% PIX"}]

  marketingdata_marketingtags SUPER,        -- Array of strings: ["vtexSocialSelling"]
  marketplace_iscertified SUPER,            -- Boolean as super: "true" or null
  contextdata_loggedin SUPER,               -- Boolean as super or null
  giftcards SUPER,                          -- Array of gift cards (usually [])
  changesattachment_changesdata SUPER       -- Post-order changes (usually null)
);

-- PARTIQL EXAMPLES for querying SUPER columns:

-- Count items per order:
-- SELECT orderid, JSON_ARRAY_LENGTH(items) as item_count FROM ${config.redshift.schema}.orders_latest WHERE hostname = 'store_name';

-- Unnest items to get product details:
-- SELECT orderid, item.name::VARCHAR, item.sellingPrice::BIGINT / 100.0 as price FROM ${config.redshift.schema}.orders_latest o, o.items AS item WHERE hostname = 'store_name';

-- Get payment method:
-- SELECT orderid, txn.payments[0].paymentSystemName::VARCHAR as method, txn.payments[0].installments::INT FROM ${config.redshift.schema}.orders_latest o, o.transactions AS txn WHERE hostname = 'store_name';

-- Get shipping totals:
-- SELECT orderid, t.value::BIGINT / 100.0 as shipping FROM ${config.redshift.schema}.orders_latest o, o.totals AS t WHERE hostname = 'store_name' AND t.id = 'Shipping';

-- Get tracking info from packages:
-- SELECT orderid, pkg.invoiceNumber::VARCHAR, pkg.trackingNumber::VARCHAR, pkg.courier::VARCHAR FROM ${config.redshift.schema}.orders_latest o, o.packages AS pkg WHERE hostname = 'store_name' AND pkg.trackingNumber IS NOT NULL;

-- Get delivery SLA:
-- SELECT orderid, logi.selectedSla::VARCHAR, logi.shippingEstimate::VARCHAR FROM ${config.redshift.schema}.orders_latest o, o.shippingdata_logisticsinfo AS logi WHERE hostname = 'store_name';

-- Get applied promotions:
-- SELECT orderid, promo.name::VARCHAR, promo.description::VARCHAR FROM ${config.redshift.schema}.orders_latest o, o.rateandbenefitsidentifiers AS promo WHERE hostname = 'store_name';
`;

interface RedshiftRow {
  [key: string]: string | number | boolean | null;
}

export class RedshiftService {
  private client: RedshiftDataClient;

  constructor() {
    this.client = new RedshiftDataClient({
      region: config.redshift.awsRegion,
      credentials: fromSSO({ profile: config.redshift.awsProfile }),
    });
  }

  getSchema(): string {
    return ORDERS_SCHEMA_DOCS;
  }

  async validateQuery(sql: string): Promise<boolean> {
    try {
      await this.executeQuery(`EXPLAIN ${sql}`);
      return true;
    } catch {
      return false;
    }
  }

  async query<T = RedshiftRow>(sql: string): Promise<T[]> {
    const safeSql = this.enforceLimitClause(sql);
    return this.executeQuery<T>(safeSql);
  }

  private async executeQuery<T = RedshiftRow>(sql: string): Promise<T[]> {
    const params: ExecuteStatementCommandInput = {
      Database: config.redshift.database,
      Sql: sql,
    };

    if (config.redshift.clusterId) {
      params.ClusterIdentifier = config.redshift.clusterId;
    } else if (config.redshift.workgroupName) {
      params.WorkgroupName = config.redshift.workgroupName;
    }

    if (config.redshift.dbUser) {
      params.DbUser = config.redshift.dbUser;
    }

    const { Id: statementId } = await this.client.send(
      new ExecuteStatementCommand(params)
    );

    if (!statementId) {
      throw new Error('No statement ID returned from RedShift');
    }

    await this.waitForStatement(statementId);

    const result = await this.client.send(
      new GetStatementResultCommand({ Id: statementId })
    );

    return this.parseRows<T>(result);
  }

  private async waitForStatement(statementId: string): Promise<void> {
    const startTime = Date.now();

    while (true) {
      const { Status, Error: errorMsg } = await this.client.send(
        new DescribeStatementCommand({ Id: statementId })
      );

      if (Status === 'FAILED' || Status === 'ABORTED') {
        throw new Error(`RedShift query ${Status}: ${errorMsg}`);
      }

      if (Status === 'FINISHED') {
        return;
      }

      if (Date.now() - startTime > config.redshift.queryTimeoutMs) {
        throw new Error(`RedShift query timed out after ${config.redshift.queryTimeoutMs}ms`);
      }

      await new Promise((r) => setTimeout(r, config.redshift.pollIntervalMs));
    }
  }

  private parseRows<T>(resultResponse: any): T[] {
    if (!resultResponse.Records?.length) {
      return [];
    }

    const columns = resultResponse.ColumnMetadata.map((col: any) => col.name);

    return resultResponse.Records.map((row: any[]) => {
      const obj: Record<string, any> = {};
      row.forEach((field: any, i: number) => {
        obj[columns[i]] = field.stringValue
          ?? field.longValue
          ?? field.doubleValue
          ?? field.booleanValue
          ?? (field.isNull ? null : undefined);
      });
      return obj as T;
    });
  }

  containsHostnameFilter(sql: string): boolean {
    return /hostname\s*=/i.test(sql) || /hostname\s+ILIKE/i.test(sql);
  }

  private enforceLimitClause(sql: string): string {
    if (/\bLIMIT\b/i.test(sql)) {
      return sql;
    }
    return `${sql.replace(/;\s*$/, '')} LIMIT 500`;
  }
}
