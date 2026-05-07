const openrouter = {
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: 'https://openrouter.ai/api/v1',
  httpReferer: '',
  xTitle: 'IA Devs - Orders Analytics Assistant',
  models: [
    'arcee-ai/trinity-large-preview:free',
  ],
  provider: {
    sort: {
      by: 'throughput',
      partition: 'none',
    },
  },
};

const litellm = {
  apiKey: process.env.LITELLM_PROXY_API_KEY!,
  baseURL: process.env.LITELLM_PROXY_API_BASE!,
  model: process.env.LITELLM_MODEL ?? 'us.anthropic.claude-sonnet-4-20250514-v1:0',
};

export const config = {
  llmProvider: (process.env.LLM_PROVIDER ?? 'openrouter') as 'openrouter' | 'litellm',

  openrouter,
  litellm,

  // Backwards-compatible aliases (point to openrouter defaults)
  apiKey: openrouter.apiKey,
  httpReferer: openrouter.httpReferer,
  xTitle: openrouter.xTitle,
  models: openrouter.models,
  provider: openrouter.provider,

  temperature: 0.7,
  redshift: {
    awsProfile: process.env.AWS_PROFILE!,
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    clusterId: process.env.REDSHIFT_CLUSTER_ID,
    workgroupName: process.env.REDSHIFT_WORKGROUP,
    database: process.env.REDSHIFT_DATABASE!,
    dbUser: process.env.REDSHIFT_DB_USER,
    schema: process.env.REDSHIFT_SCHEMA || 'oms_silver',
    queryTimeoutMs: parseInt(process.env.REDSHIFT_QUERY_TIMEOUT_MS || '30000', 10),
    pollIntervalMs: parseInt(process.env.REDSHIFT_POLL_INTERVAL_MS || '800', 10),
  },
  maxCorrectionAttempts: 2,
  maxSubQuestions: 3,
};

export default config;
