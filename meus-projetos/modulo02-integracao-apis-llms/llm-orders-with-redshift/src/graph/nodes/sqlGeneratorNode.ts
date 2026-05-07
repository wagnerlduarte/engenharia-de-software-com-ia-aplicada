import type { LLMService } from '../../services/llmService.ts';
import { RedshiftService } from '../../services/redshiftService.ts';
import type { GraphState } from '../graph.ts';
import { SqlQuerySchema, getSystemPrompt, getUserPromptTemplate } from '../../prompts/v1/sqlGenerator.ts';
import { ORDERS_CONTEXT } from '../../prompts/v1/ordersContext.ts';
import { getCurrentStepInfo } from './stepUtils.ts';

export function createSqlGeneratorNode(
  llmClient: LLMService,
  redshiftService: RedshiftService,
) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {
      const hostname = state.hostname;
      if (!hostname) {
        return { error: 'No hostname (store) provided. Cannot generate query.' };
      }

      const stepInfo = getCurrentStepInfo(state);
      const targetQuestion = stepInfo?.question ?? state.question!;

      if (stepInfo) {
        console.log(`🤖 Generating SQL for step ${stepInfo.stepNumber}/${stepInfo.total}: "${targetQuestion}"`);
      } else {
        console.log('🤖 Generating SQL query...');
      }

      const schema = redshiftService.getSchema();
      const systemPrompt = getSystemPrompt(schema, ORDERS_CONTEXT, hostname);
      const userPrompt = getUserPromptTemplate(targetQuestion);

      const { data, error } = await llmClient.generateStructured(
        systemPrompt,
        userPrompt,
        SqlQuerySchema,
      );

      if (error) {
        return { error: `Failed to generate SQL: ${error}` };
      }

      const generatedQuery = data?.query ?? '';
      console.log(`✅ Generated SQL query: ${generatedQuery}`);

      if (!redshiftService.containsHostnameFilter(generatedQuery)) {
        console.log('⚠️  Generated SQL missing hostname filter - rejecting');
        return { error: 'Generated query does not contain required hostname filter. Query rejected for security.' };
      }

      const stepStateReset = {
        correctionAttempts: 0,
        validationError: undefined,
        needsCorrection: false,
        originalQuery: undefined,
      };

      if (state.isMultiStep && stepInfo) {
        const subQueries = [...(state.subQueries ?? [])];
        subQueries[stepInfo.index] = generatedQuery;
        return {
          ...stepStateReset,
          query: generatedQuery,
          subQueries,
        };
      }

      return {
        ...stepStateReset,
        query: generatedQuery,
      };
    } catch (error: any) {
      console.error('Error generating SQL query:', error.message);
      return { error: `Failed to generate query: ${error.message}` };
    }
  };
}
