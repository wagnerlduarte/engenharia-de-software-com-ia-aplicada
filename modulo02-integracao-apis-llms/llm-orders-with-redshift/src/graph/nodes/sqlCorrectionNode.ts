import type { LLMService } from '../../services/llmService.ts';
import { RedshiftService } from '../../services/redshiftService.ts';
import type { GraphState } from '../graph.ts';
import { SqlCorrectionSchema, getSystemPrompt, getUserPromptTemplate } from '../../prompts/v1/sqlCorrection.ts';
import { getTargetQuestion } from './stepUtils.ts';

export function createSqlCorrectionNode(
  llmClient: LLMService,
  redshiftService: RedshiftService,
) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {
      const hostname = state.hostname;
      if (!hostname) {
        return { error: 'No hostname provided for query correction.' };
      }

      console.log('🔧 Auto-correcting SQL query...');

      const schema = redshiftService.getSchema();
      const systemPrompt = getSystemPrompt(schema, hostname);
      const targetQuestion = getTargetQuestion(state);
      const userPrompt = getUserPromptTemplate(
        state.query!,
        state.validationError!,
        targetQuestion,
      );

      const { data, error } = await llmClient.generateStructured(
        systemPrompt,
        userPrompt,
        SqlCorrectionSchema,
      );

      if (error) {
        return { error: `Query correction failed: ${error}` };
      }

      const correctedQuery = data?.correctedQuery ?? '';

      if (!redshiftService.containsHostnameFilter(correctedQuery)) {
        return { error: 'Corrected query does not contain required hostname filter. Query rejected.' };
      }

      console.log(`✅ Query corrected: ${data?.explanation}`);

      return {
        query: correctedQuery,
        originalQuery: state.originalQuery ?? state.query,
        correctionAttempts: (state.correctionAttempts ?? 0) + 1,
        validationError: undefined,
        needsCorrection: false,
      };
    } catch (error: any) {
      console.error('Error correcting query:', error.message);
      return { error: `Query correction failed: ${error.message}` };
    }
  };
}
