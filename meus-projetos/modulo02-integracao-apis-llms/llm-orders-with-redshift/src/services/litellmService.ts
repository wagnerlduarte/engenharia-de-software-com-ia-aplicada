import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type { z } from 'zod/v3';
import { createAgent, providerStrategy } from 'langchain';
import { config } from '../config.ts';
import type { LLMService, LLMStructuredResult } from './llmService.ts';

// The `litellm_proxy/` prefix is a Python LiteLLM SDK convention used when
// LiteLLM routes the call internally. When consuming the proxy via an
// OpenAI-compatible client (our case), the model must be passed without it.
function normalizeModelName(model: string): string {
  return model.replace(/^litellm_proxy\//, '');
}

// LiteLLM proxy is OpenAI-compatible and expects the base URL to end in `/v1`.
// We accept both conventions in the env var (with or without trailing `/v1`).
function resolveBaseURL(rawBaseURL: string): string {
  const trimmed = rawBaseURL.replace(/\/$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

export class LiteLLMService implements LLMService {
  private llmClient: ChatOpenAI;

  constructor(modelName?: string) {
    const resolvedModel = normalizeModelName(modelName ?? config.litellm.model);

    this.llmClient = new ChatOpenAI({
      apiKey: config.litellm.apiKey,
      modelName: resolvedModel,
      temperature: config.temperature,
      configuration: {
        baseURL: resolveBaseURL(config.litellm.baseURL),
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
      });

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ];

      const data = await agent.invoke({ messages });
      return {
        success: true,
        data: data.structuredResponse as T,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
