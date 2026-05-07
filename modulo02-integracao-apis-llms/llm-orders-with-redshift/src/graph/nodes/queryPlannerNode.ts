import { getSystemPrompt, getUserPromptTemplate, QueryAnalysisSchema } from '../../prompts/v1/queryAnalyzer.ts';
import type { LLMService } from '../../services/llmService.ts';
import type { GraphState } from '../graph.ts';

export function createQueryPlannerNode(llmClient: LLMService) {

  return async (state: GraphState): Promise<Partial<GraphState>> => {

    try {
      const systemPrompt = getSystemPrompt()
      const userPrompt = getUserPromptTemplate(state.question!)
      const { data, error } = await llmClient.generateStructured(
        systemPrompt,
        userPrompt,
        QueryAnalysisSchema,
      )

      if(error) {
        console.log('⚠️  Failed to analyze query, assuming simple');
        return {
          ...state,
          error,
          isMultiStep: false,
        }
      }

      const complexity = data?.complexity ?? 'simple';
      const reasoning = data?.reasoning ?? '(no reasoning provided)';

      if(data?.requiresDecomposition && !!data.subQuestions?.length) {
        const subQuestionsFormatted = data.subQuestions
          .map((q: string, i: number) => `\n   ${i + 1}. ${q}`)
          .join('');

        console.log(`🧭 Query complexity: ${complexity.toUpperCase()} (multi-step)`);
        console.log(`   Reasoning: ${reasoning}`);
        console.log(`📊 Complex query - ${data.subQuestions.length} steps:${subQuestionsFormatted}`);


        return {
          isMultiStep: true,
          subQuestions: data.subQuestions,
          currentStep: 0,
          subQueries:[],
          subResults: []
        }
      }

      console.log(`🧭 Query complexity: ${complexity.toUpperCase()} (single-step)`);
      console.log(`   Reasoning: ${reasoning}`);

      return {
        ...state,
        isMultiStep: false,
      };
    } catch (error: any) {
      console.error('❌ Error analyzing query:', error.message);
      return {
        ...state,
        isMultiStep: false,
      };
    }
  }
}
