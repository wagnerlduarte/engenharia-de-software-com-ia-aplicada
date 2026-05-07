import {
  StateGraph,
  START,
  END,
  MessagesZodMeta,
} from '@langchain/langgraph';
import { withLangGraph } from '@langchain/langgraph/zod';

import { z } from 'zod/v3';
import type { BaseMessage } from '@langchain/core/messages';

import config from '../config.ts';
import { RedshiftService } from '../services/redshiftService.ts';
import type { LLMService } from '../services/llmService.ts';

import { createSqlGeneratorNode } from './nodes/sqlGeneratorNode.ts';
import { createSqlExecutorNode } from './nodes/sqlExecutorNode.ts';
import { createSqlCorrectionNode } from './nodes/sqlCorrectionNode.ts';
import { createQueryPlannerNode } from './nodes/queryPlannerNode.ts';
import { createAnalyticalResponseNode } from './nodes/analyticalResponseNode.ts';
import { createExtractQuestionNode } from './nodes/extractQuestionNode.ts';

const OrdersConfigSchema = z.object({
  hostname: z.string().optional(),
});

export type OrdersConfig = z.infer<typeof OrdersConfigSchema>;

const OrdersStateAnnotation = z.object({
  messages: withLangGraph(
    z.custom<BaseMessage[]>(),
    MessagesZodMeta,
  ),
  question: z.string().optional(),

  // Tenant isolation
  hostname: z.string().optional(),

  // SQL generation
  query: z.string().optional(),
  originalQuery: z.string().optional(),

  // Query execution
  dbResults: z.array(z.any()).optional(),

  // Self-correction
  correctionAttempts: z.number().optional(),
  validationError: z.string().optional(),
  needsCorrection: z.boolean().optional(),

  // Multi-step decomposition
  isMultiStep: z.boolean().optional(),
  subQuestions: z.array(z.string()).optional(),
  currentStep: z.number().optional(),
  subQueries: z.array(z.string()).optional(),
  subResults: z.array(z.array(z.any())).optional(),

  // Response generation
  answer: z.string().optional(),
  followUpQuestions: z.array(z.string()).optional(),

  // Enrichment
  needsEnrichment: z.boolean().optional(),
  enrichedData: z.record(z.any()).optional(),

  // Error handling
  error: z.string().optional(),
});

export type GraphState = z.infer<typeof OrdersStateAnnotation>;

export function buildOrdersGraph(
  llmClient: LLMService,
  redshiftService: RedshiftService,
) {
  const workflow = new StateGraph({
    state: OrdersStateAnnotation,
    context: OrdersConfigSchema,
  })
    .addNode('extractQuestion', createExtractQuestionNode())
    .addNode('queryPlanner', createQueryPlannerNode(llmClient))
    .addNode('sqlGenerator', createSqlGeneratorNode(llmClient, redshiftService))
    .addNode('sqlExecutor', createSqlExecutorNode(redshiftService))
    .addNode('sqlCorrection', createSqlCorrectionNode(llmClient, redshiftService))
    .addNode('analyticalResponse', createAnalyticalResponseNode(llmClient))

    .addEdge(START, 'extractQuestion')

    .addConditionalEdges('extractQuestion', (state: GraphState) => {
      if (state.error) return END;
      return 'queryPlanner';
    })

    .addEdge('queryPlanner', 'sqlGenerator')
    .addEdge('sqlGenerator', 'sqlExecutor')

    .addConditionalEdges('sqlExecutor', (state: GraphState) => {
      if (state.error) {
        return 'analyticalResponse';
      }

      if (state.needsCorrection && (state.correctionAttempts ?? 0) < config.maxCorrectionAttempts) {
        return 'sqlCorrection';
      }

      if (
        state.isMultiStep &&
        state.subQuestions &&
        state.currentStep !== undefined &&
        state.currentStep < state.subQuestions.length
      ) {
        return 'sqlGenerator';
      }

      return 'analyticalResponse';
    })

    .addEdge('sqlCorrection', 'sqlExecutor')
    .addEdge('analyticalResponse', END);

  return workflow.compile();
}
