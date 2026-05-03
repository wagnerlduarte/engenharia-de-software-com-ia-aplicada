import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config.ts';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type { z } from 'zod/v3';
import { createAgent, providerStrategy } from 'langchain';
import { type QueryAnalysisData } from '../prompts/v1/queryAnalyzer.ts';

export type LLMResponse = {
  model: string;
  content: string;
};

export class OpenRouterService {
  private readonly llmClient: ChatOpenAI;

  constructor() {
    this.llmClient = new ChatOpenAI({
      apiKey: config.apiKey,
      modelName: config.models[0],
      temperature: config.temperature,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': config.httpReferer,
          'X-Title': config.xTitle,
        },
      },

      // Pass provider routing and models array to OpenRouter
      modelKwargs: {
        models: config.models,
        provider: config.provider,
      },
    });
  }

  private createModelClient(temperature?: number): ChatOpenAI {
    if (typeof temperature !== "number") {
      return this.llmClient;
    }

    return new ChatOpenAI({
      apiKey: config.apiKey,
      modelName: config.models[0],
      temperature,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": config.httpReferer,
          "X-Title": config.xTitle,
        },
      },
      modelKwargs: {
        models: config.models,
        provider: config.provider,
      },
    });
  }

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>,
    options?: {
      temperature?: number;
    },
  ) {
    try {
      const modelClient = this.createModelClient(options?.temperature);

      const agent = createAgent({
        model: modelClient,
        tools: [],
        responseFormat: providerStrategy(schema),
      })

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ];

      const data = await agent.invoke({ messages });
      const structuredResponse = data?.structuredResponse as T | undefined;

      if (!structuredResponse) {
        return {
          success: false,
          error: "Model returned an empty structured response",
        };
      }

      return {
        success: true,
        data: structuredResponse,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
