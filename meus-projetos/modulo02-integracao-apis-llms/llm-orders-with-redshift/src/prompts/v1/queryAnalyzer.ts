import { z } from 'zod/v3';

export const QueryAnalysisSchema = z
  .object({
    complexity: z.enum(['simple', 'complex']).describe('Whether the query is simple or complex'),
    requiresDecomposition: z.boolean().describe('Whether the query needs to be broken down into sub-queries'),
    subQuestions: z.array(z.string()).describe('Sub-questions if decomposition is required (empty array if simple)'),
    reasoning: z.string().describe('Brief explanation of the analysis'),
  })
  .refine(
    (d) => d.requiresDecomposition === (d.subQuestions.length > 0),
    {
      message:
        'subQuestions must be non-empty if and only if requiresDecomposition is true',
      path: ['subQuestions'],
    },
  );

export type QueryAnalysisData = z.infer<typeof QueryAnalysisSchema>;

export const getSystemPrompt = (): string => {
  return JSON.stringify({
    role: 'Query Complexity Analyzer - Determine if questions need multi-step decomposition into ORTHOGONAL sub-questions',
    architecture_note:
      'The downstream pipeline executes each sub-question in ISOLATION (no step has access to results from another step). Results are only joined at the final synthesis stage. Therefore sub-questions MUST be self-contained and orthogonal.',
    rules: [
      'Generate sub-questions in the SAME language as the input question (ignore data language).',
      'Simple: Single entity, direct retrieval, no group comparisons.',
      'Complex: Comparing groups, multiple dependent calculations, relationship analysis.',
      'Decompose into max 3 sub-questions, each independently answerable as SQL, logically ordered.',
      'ORTHOGONALITY (HARD RULE): Each sub-question MUST be self-contained and runnable in isolation. The downstream SQL generator does NOT receive results from previous steps.',
      'FORBIDDEN in sub-questions: referential pronouns or back-references like "desses", "destes", "deles", "esses", "estes", "those", "these", "the above", "from the previous step", "from step 1". Each sub-question must spell out its own filters.',
      'When the original question implies dependency (top-N + per-item metric of those N), prefer ONE SQL with window/CTE/JOIN (mark as simple). If decomposition is needed, generate sub-questions over the SAME universe (same time range, same hostname filter, same status filter), so the synthesis can join by a shared key (productId, orderid, etc.).',
      'DIAGNOSTIC questions ("tem problema", "ha correlacao", "ha inconsistencia", "qual a taxa", "por que", "esta com erro", "is there an issue", "rate of", "correlation", "why") MUST NOT be decomposed. They are answered by ONE comparative SQL with GROUP BY suspect_dimension and CASE WHEN signal THEN 1 ELSE 0 END / COUNT(*) rates. Mark them as simple.',
      'Sub-questions that are pure interpretation/synthesis ("Existe correlacao?", "Why?", "What does this mean?", "How can we improve?") are NEVER valid SQL sub-steps. They are produced by the analytical response node from the SQL results, not by SQL itself.',
      'Consistency: requiresDecomposition must be true if and only if subQuestions is non-empty.',
    ],
    examples: [
      // {
      //   question: 'List all available courses',
      //   complexity: 'simple',
      //   requiresDecomposition: false,
      //   subQuestions: [],
      //   reasoning: 'Direct retrieval, no comparisons',
      // },
      {
        question: 'Os pedidos da última semana com isCompleted=false tem problema com transação de pagamento?',
        complexity: 'simple',
        requiresDecomposition: false,
        subQuestions: [],
        reasoning:
          'Diagnostic comparative question - answer with a single GROUP BY iscompleted query computing payment-problem rates. Do not split.',
      },
      {
        question: 'Existe correlação entre status do pedido e taxa de cancelamento esta semana?',
        complexity: 'simple',
        requiresDecomposition: false,
        subQuestions: [],
        reasoning: 'Diagnostic correlation - one GROUP BY status query with cancel rate per group answers it.',
      },
      {
        question: 'Quais são os 5 produtos mais vendidos esta semana e qual a taxa de cancelamento de cada um?',
        complexity: 'complex',
        requiresDecomposition: true,
        subQuestions: [
          'Quais são os 5 produtos mais vendidos esta semana, retornando productId, productName e total_sold?',
          'Qual a taxa de cancelamento (canceled/total) por productId para todos os pedidos desta semana?',
        ],
        reasoning:
          'Two ORTHOGONAL sub-questions over the SAME universe (this week, same hostname). Step 2 does NOT reference step 1 (no "desses" pronoun) - it computes the cancel rate per productId for the entire week. The synthesis joins by productId to keep only the 5 productIds returned by step 1.',
      },
      {
        question: 'BAD EXAMPLE - DO NOT EMIT: Quais são os 5 produtos mais vendidos esta semana e qual a taxa de cancelamento de cada um?',
        complexity: 'complex',
        requiresDecomposition: true,
        subQuestions: [
          'Quais são os 5 produtos mais vendidos esta semana?',
          'Qual a taxa de cancelamento desses produtos?',
        ],
        reasoning:
          'ANTI-PATTERN: the second sub-question uses the pronoun "desses" referring to step 1, but step 2 runs without access to step 1 results. The downstream SQL generator will either invent a filter or return data for the whole table. NEVER emit sub-questions like this.',
      },
    ],
  });
};

export const getUserPromptTemplate = (question: string): string => {
  return question;
};
