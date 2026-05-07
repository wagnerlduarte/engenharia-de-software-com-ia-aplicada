import type { LangGraphRunnableConfig } from '@langchain/langgraph';

import type { GraphState } from '../graph.ts';

export function createExtractQuestionNode() {

  return async (
    state: GraphState,
    config: LangGraphRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    try {
      if (!state.messages?.length) {
        console.error('No messages in state');
        return {
          error: 'No messages provided',
        };
      }

      const question = state.messages.at(-1)?.text ?? '';

      if (!question.trim()) {
        console.error('Extracted question is empty');
        return {
          error: 'No valid question found in messages',
        };
      }

      const runtimeContext = (config?.configurable ?? config?.context) as
        | { hostname?: string }
        | undefined;
      const hostname = state.hostname ?? runtimeContext?.hostname;

      if (!hostname) {
        console.error('No hostname provided in state or runtime config');
        return {
          error:
            'hostname não informado. Preencha no Assistant (configurable) ou no body da requisição.',
        };
      }

      console.log(`📝 Extracted question: "${question}" [${hostname}]`);

      return {
        question,
        hostname,
        error: undefined,
      };
    } catch (error: any) {
      console.error('Error extracting question:', error.message);
      return {
        error: `Failed to extract question: ${error.message}`,
      };
    }
  };
}
