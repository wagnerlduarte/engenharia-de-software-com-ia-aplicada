import type { z } from 'zod/v3';

export type LLMStructuredResult<T> =
  | { success: true; data: T; error?: undefined }
  | { success: false; data?: undefined; error: string };

export interface LLMService {
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<LLMStructuredResult<T>>;
}
