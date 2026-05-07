export interface EnrichmentResult {
  orderId: string;
  data: Record<string, any>;
  source: string;
}

export class EnrichmentService {
  /**
   * Enriches order data by calling internal APIs.
   * Currently a placeholder -- implement actual API calls per your internal services.
   */
  async enrich(
    orderIds: string[],
    hostname: string,
    fields: string[] = [],
  ): Promise<EnrichmentResult[]> {
    console.log(`🔄 Enrichment requested for ${orderIds.length} order(s) on ${hostname}`);
    console.log(`   Fields: ${fields.length ? fields.join(', ') : 'all available'}`);

    const results: EnrichmentResult[] = [];

    for (const orderId of orderIds) {
      try {
        const data = await this.fetchOrderDetails(orderId, hostname, fields);
        if (data) {
          results.push({ orderId, data, source: 'internal-api' });
        }
      } catch (error: any) {
        console.warn(`⚠️  Failed to enrich order ${orderId}: ${error.message}`);
      }
    }

    console.log(`✅ Enriched ${results.length}/${orderIds.length} order(s)`);
    return results;
  }

  /**
   * Placeholder for actual API call to fetch order details.
   * Replace with your internal API client (e.g. VTEX OMS API, logistics API, etc.)
   */
  private async fetchOrderDetails(
    orderId: string,
    hostname: string,
    _fields: string[],
  ): Promise<Record<string, any> | null> {
    // TODO: Implement actual API call
    // Example: const response = await fetch(`https://${hostname}.vtexcommercestable.com.br/api/oms/pvt/orders/${orderId}`, { headers: { ... } });
    console.log(`   [stub] Would fetch details for order ${orderId} on ${hostname}`);
    return null;
  }
}
