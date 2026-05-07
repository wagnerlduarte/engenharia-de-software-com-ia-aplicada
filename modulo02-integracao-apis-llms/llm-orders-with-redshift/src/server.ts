import { buildOrdersQAGraph } from './graph/factory.ts';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { HumanMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

export const createServer = () => {
  const app = Fastify({ logger: false });
  app.register(cors, { origin: true });
  const { graph } = buildOrdersQAGraph();

  app.post('/orders', {
    schema: {
      body: {
        type: 'object',
        required: ['question', 'hostname'],
        properties: {
          question: { type: 'string', minLength: 3 },
          hostname: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async function (request, reply) {
    try {
      const { question, hostname } = request.body as {
        question: string;
        hostname: string;
      };

      console.log('\n' + '='.repeat(60));
      console.log(`📊 Orders Assistant [${hostname}]: "${question}"`);
      console.log('='.repeat(60));

      const startTime = Date.now();
      const response = await graph.invoke({
        messages: [new HumanMessage(question)],
        hostname,
      });

      const processingTimeMs = Date.now() - startTime;

      console.log('\n' + '='.repeat(60));
      console.log(`✅ Analysis completed in ${processingTimeMs}ms`);
      console.log(`💬 Answer: ${response.answer}${(response?.answer?.length || 0) > 100 ? '...' : ''}`);
      console.log(`🔍 SQL: ${response.query}${(response?.query?.length || 0) > 80 ? '...' : ''}`);
      const followUps = response.followUpQuestions ?? [];
      console.log(`❓ Follow-ups (${followUps.length} suggested):`);
      followUps.forEach((q: string, i: number) => console.log(`   ${i + 1}. ${q}`));
      console.log('='.repeat(60) + '\n');

      return {
        answer: response.answer || 'No answer generated',
        followUpQuestions: response.followUpQuestions || [],
        query: response.query,
        error: response.error,
        processingTimeMs,
      };
    } catch (error) {
      console.error('Error processing orders query', error);
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.get('/health', async () => ({ status: 'ok' }));

  // TEMP: smoke test endpoint for LiteLLM proxy connectivity. Remove once validated.
  app.get('/litellm/ping', async (_request, reply) => {
    const baseURL = process.env.LITELLM_PROXY_API_BASE;
    const apiKey = process.env.LITELLM_PROXY_API_KEY;
    const model = process.env.LITELLM_MODEL;

    if (!baseURL || !apiKey || !model) {
      return reply.status(400).send({
        ok: false,
        error: 'Missing LITELLM_PROXY_API_BASE / LITELLM_PROXY_API_KEY / LITELLM_MODEL',
      });
    }

    const resolvedBaseURL = baseURL.replace(/\/$/, '').endsWith('/v1')
      ? baseURL.replace(/\/$/, '')
      : `${baseURL.replace(/\/$/, '')}/v1`;

    const llm = new ChatOpenAI({
      apiKey,
      modelName: model.replace(/^litellm_proxy\//, ''),
      configuration: { baseURL: resolvedBaseURL },
      temperature: 0,
    });

    const startTime = Date.now();
    try {
      const res = await llm.invoke('Say "pong".');
      return {
        ok: true,
        latencyMs: Date.now() - startTime,
        baseURL: resolvedBaseURL,
        model,
        content: typeof res.content === 'string' ? res.content : JSON.stringify(res.content),
      };
    } catch (error) {
      return reply.status(502).send({
        ok: false,
        latencyMs: Date.now() - startTime,
        baseURL: resolvedBaseURL,
        model,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return app;
};
