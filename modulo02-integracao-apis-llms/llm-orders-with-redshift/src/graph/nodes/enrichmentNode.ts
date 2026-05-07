import { EnrichmentService } from '../../services/enrichmentService.ts';
import type { GraphState } from '../graph.ts';

/**
 * Enrichment node -- checks if the SQL results contain order IDs
 * that could benefit from additional data from internal APIs.
 *
 * Currently this is a pass-through that marks enrichment as not needed.
 * To activate, implement the EnrichmentService.fetchOrderDetails() method
 * and wire this node into the graph between sqlExecutor and analyticalResponse.
 */
export function createEnrichmentNode(enrichmentService: EnrichmentService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {
      if (!state.dbResults?.length || !state.hostname) {
        return { needsEnrichment: false };
      }

      const orderIds = state.dbResults
        .map((row: any) => row.orderid)
        .filter(Boolean)
        .slice(0, 10);

      if (!orderIds.length) {
        return { needsEnrichment: false };
      }

      const enriched = await enrichmentService.enrich(orderIds, state.hostname);

      if (!enriched.length) {
        return { needsEnrichment: false };
      }

      const enrichedMap: Record<string, any> = {};
      for (const item of enriched) {
        enrichedMap[item.orderId] = item.data;
      }

      return {
        needsEnrichment: false,
        enrichedData: enrichedMap,
      };
    } catch (error: any) {
      console.warn('⚠️  Enrichment failed, continuing without:', error.message);
      return { needsEnrichment: false };
    }
  };
}
