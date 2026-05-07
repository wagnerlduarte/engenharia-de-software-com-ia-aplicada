import { z } from 'zod/v3';

export const SqlCorrectionSchema = z.object({
  correctedQuery: z.string().describe('The corrected RedShift SQL query'),
  explanation: z.string().describe('Brief explanation of what was fixed'),
});

export type SqlCorrectionData = z.infer<typeof SqlCorrectionSchema>;

export const getSystemPrompt = (schema: string, hostname: string): string => {
  return JSON.stringify({
    role: 'Amazon RedShift SQL Query Debugger - Fix invalid queries based on error messages',
    schema,
    hostname_filter: `Every corrected query MUST include WHERE hostname = '${hostname}'.`,
    rules: [
      'Read the error message carefully and preserve the original query intent.',
      'Return a valid, executable SELECT query. Never generate DDL/DML.',
      `Ensure hostname = '${hostname}' filter is always present.`,
      'Common RedShift/PartiQL fixes:',
      '  - SUPER column access: use FROM table t, t.super_col AS alias (not JSON functions)',
      '  - Nested SUPER arrays (e.g. transactions[].payments[]): unnest twice in FROM ("FROM t, t.transactions AS txn, txn.payments AS pay"), never use bracket indexing like payments[0]',
      '  - Always CAST from SUPER: ::VARCHAR, ::BIGINT, ::INT, ::BOOLEAN',
      '  - Quote reserved words ("group", "user", "value", "order") with double quotes when projecting from SUPER',
      '  - GROUP BY must include all non-aggregated columns',
      '  - Use COALESCE for nullable columns in GROUP BY',
      '  - RedShift does not support LATERAL or CROSS APPLY - use PartiQL unnest syntax instead',
      '  - RedShift date functions: DATEADD, DATEDIFF, DATE_TRUNC, GETDATE()',
      '  - ILIKE for case-insensitive matching (not LOWER() + LIKE)',
      '  - Ensure LIMIT is present (max 500)',
    ],
    common_errors: [
      { error: 'column must appear in GROUP BY clause', fix: 'Add missing columns to GROUP BY or wrap them in an aggregate function' },
      { error: 'cannot cast super to', fix: 'Use explicit cast ::VARCHAR, ::BIGINT etc. when extracting from SUPER columns' },
      { error: 'invalid input syntax', fix: 'Check data types and casts. SUPER values need explicit casting.' },
      { error: 'relation does not exist', fix: 'Use fully qualified table name: oms_silver.orders_latest' },
      { error: 'syntax error at or near "["', fix: 'Replace bracket indexing on SUPER arrays (e.g. payments[0]) with PartiQL unnest in FROM: "FROM t, t.transactions AS txn, txn.payments AS pay"' },
      { error: 'syntax error at or near "group"', fix: 'Quote reserved words like "group" with double quotes when projected (e.g. pay."group"::VARCHAR)' },
      { error: 'syntax error at or near "user"', fix: 'Quote reserved words like "user", "value", "order" with double quotes when projected from SUPER' },
      { error: 'JSON_ARRAY_LENGTH', fix: 'Do NOT cast SUPER to VARCHAR (causes timeout on large tables). Replace JSON_ARRAY_LENGTH on SUPER with: (a) "transactions IS NULL" for emptiness, (b) a CTE that unnests with PartiQL and COUNTs per orderid, scoped by hostname+batch_id.' },
      { error: 'Query execution timeout', fix: 'Add a batch_id filter aligned with the date range to leverage the SORTKEY: AND batch_id >= TO_CHAR(DATEADD(day, -N, GETDATE()), \'YYYY_MM_DD_HH\'). Avoid scanning SUPER columns without a unnest filter.' },
      { error: 'timeout', fix: 'Add a batch_id filter aligned with the date range to leverage the SORTKEY: AND batch_id >= TO_CHAR(DATEADD(day, -N, GETDATE()), \'YYYY_MM_DD_HH\'). Avoid scanning SUPER columns without a unnest filter.' },
    ],
  });
};

export const getUserPromptTemplate = (
  failedQuery: string,
  errorMessage: string,
  originalQuestion?: string
): string => {
  return JSON.stringify({
    failed_query: failedQuery,
    error_message: errorMessage,
    original_question: originalQuestion,
  });
};
