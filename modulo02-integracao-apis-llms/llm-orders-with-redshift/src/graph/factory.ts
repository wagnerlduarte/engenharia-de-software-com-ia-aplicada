import { OpenRouterService } from '../services/openrouterService.ts';
import { LiteLLMService } from '../services/litellmService.ts';
import { RedshiftService } from '../services/redshiftService.ts';
import type { LLMService } from '../services/llmService.ts';
import { config } from '../config.ts';
import { buildOrdersGraph } from './graph.ts';

export function buildOrdersQAGraph() {
  const llmClient: LLMService =
    config.llmProvider === 'litellm'
      ? new LiteLLMService()
      : new OpenRouterService();
  const redshiftService = new RedshiftService();
  return {
    graph: buildOrdersGraph(llmClient, redshiftService),
    llmClient,
    redshiftService,
  };
}

export const graph = buildOrdersQAGraph();
