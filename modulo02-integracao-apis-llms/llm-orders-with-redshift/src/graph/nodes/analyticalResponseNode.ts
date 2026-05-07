import { AIMessage } from 'langchain';
import type { LLMService } from '../../services/llmService.ts';
import type { GraphState } from '../graph.ts';
import { AnalyticalResponseSchema, getErrorResponsePrompt, getMultiStepSynthesisPrompt, getNoResultsPrompt, getSystemPrompt, getUserPromptTemplate } from '../../prompts/v1/analyticalResponse.ts';


async function handleErrorResponse(state: GraphState, llmClient: LLMService): Promise<Partial<GraphState>> {
  const systemPrompt = getSystemPrompt()
  const userUserPrompt = getErrorResponsePrompt(state.error!, state.question)
  const { data, error } = await llmClient.generateStructured(
    systemPrompt,
    userUserPrompt,
    AnalyticalResponseSchema,
  )

  if (error) {
    return {
      messages: [new AIMessage(`An error ocurred: ${error}`)],
      error,
      answer: `An error ocurred: ${error}`,
      followUpQuestions: [],
    }
  }

  return {
    messages: [new AIMessage(data?.answer!)],
    answer: data?.answer,
    followUpQuestions: data?.followUpQuestions,
  }

}
async function handleSuccessResponse(state: GraphState, llmClient: LLMService): Promise<Partial<GraphState>> {
  const systemPrompt = getSystemPrompt()
  let _userPrompt: string
  if (
    Boolean(
      state.isMultiStep &&
      state.subResults?.length &&
      state.subQuestions?.length &&
      state.subQueries?.length
    )
  ) {
    console.log(`📊 Synthesizing ${state.subResults!.length} step results...`);
    const stepsData = state.subResults!.map((results, index) => {
      const safeResults = Array.isArray(results) ? results : [];
      console.log(`   step ${index + 1}: ${safeResults.length} row(s)`);
      return {
        stepNumber: index + 1,
        question: state.subQuestions![index],
        query: state.subQueries![index],
        rowCount: safeResults.length,
        results: JSON.stringify(safeResults),
      };
    })

    _userPrompt = getMultiStepSynthesisPrompt(state.question!, stepsData)
  } else {
    _userPrompt = getUserPromptTemplate(
      state.question!,
      state.query!,
      JSON.stringify(state.dbResults)
    )
  }

  const { data, error } = await llmClient.generateStructured(
    systemPrompt,
    _userPrompt,
    AnalyticalResponseSchema,
  )

  if (error) {
    console.error('Failed to generate analytical response');
    return {
      error: `Reponse generation faild: ${error ?? 'Unknown error'}`
    }
  }

  console.log('✅ Generated analytical response');
  return {
    messages: [new AIMessage(data?.answer!)],
    answer: data?.answer,
    followUpQuestions: data?.followUpQuestions,
  }
}

async function handleNoResultsResponse(
  state: GraphState,
  llmClient: LLMService,
): Promise<GraphState> {
  console.log('💬 Generating no-results response...');

  const systemPrompt = getSystemPrompt();
  const userPrompt = getNoResultsPrompt(
    state.question ?? 'your query',
    state.query ?? 'N/A'
  );

  const { data, error } = await llmClient.generateStructured(
    userPrompt,
    systemPrompt,
    AnalyticalResponseSchema,
  );

  if (data) {
    return {
      ...state,
      messages: [...state.messages, new AIMessage(data.answer)],
      answer: data.answer,
      followUpQuestions: data.followUpQuestions,
    };
  }

  const noResultsMessage = "No data found matching your query.";
  return {
    ...state,
    messages: [...state.messages, new AIMessage(noResultsMessage)],
    error,
    answer: noResultsMessage,
    followUpQuestions: [],
  };
}

export function createAnalyticalResponseNode(llmClient: LLMService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {

      if (state.error) {
        return await handleErrorResponse(state, llmClient)
      }

      const hasMultiStepData =
        Boolean(state.isMultiStep) &&
        Array.isArray(state.subResults) &&
        state.subResults.some((rows) => Array.isArray(rows) && rows.length > 0);

      if (!hasMultiStepData && !state.dbResults?.length) {
        return await handleNoResultsResponse(state, llmClient);
      }

      return await handleSuccessResponse(state, llmClient)

    } catch (error: any) {
      console.error('Error generating analytical response:', error.message);
      return {
        ...state,
        error: `Response generation failed: ${error.message}`,
      };
    }
  };
}
