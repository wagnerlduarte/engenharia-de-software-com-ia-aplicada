import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config.ts';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type { z } from 'zod/v3';
import { createAgent, providerStrategy } from 'langchain';
import type { LLMService, LLMStructuredResult } from './llmService.ts';

export type LLMResponse = {
  model: string;
  content: string;
};

export class OpenRouterService implements LLMService {
  private llmClient: ChatOpenAI;

  constructor() {
    this.llmClient = new ChatOpenAI({
      apiKey: config.openrouter.apiKey,
      modelName: config.openrouter.models[0],
      temperature: config.temperature,
      configuration: {
        baseURL: config.openrouter.baseURL,
        defaultHeaders: {
          'HTTP-Referer': config.openrouter.httpReferer,
          'X-Title': config.openrouter.xTitle,
        },
      },

      // Pass provider routing and models array to OpenRouter
      modelKwargs: {
        models: config.openrouter.models,
        provider: config.openrouter.provider,
      },
    });
  }

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<LLMStructuredResult<T>> {
    try {

      const agent = createAgent({
        model: this.llmClient,
        tools: [],
        responseFormat: providerStrategy(schema),
      })

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ];

      const data = await agent.invoke({ messages });
      return {
        success: true,
        data: data.structuredResponse as T,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
