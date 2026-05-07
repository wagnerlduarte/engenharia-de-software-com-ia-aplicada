import { ORDERS_CONTEXT } from '../src/prompts/v1/ordersContext.ts';
import { getSystemPrompt } from '../src/prompts/v1/sqlGenerator.ts';

const DUMMY_SCHEMA = '-- dummy schema --';
const HOSTNAME = 'thefoschini';

const rendered = getSystemPrompt(DUMMY_SCHEMA, ORDERS_CONTEXT, HOSTNAME);
const parsed = JSON.parse(rendered);

console.log('='.repeat(70));
console.log('VALIDATION 1: diagnostic_strategy field present in system prompt');
console.log('='.repeat(70));
console.log(JSON.stringify(parsed.diagnostic_strategy, null, 2));

console.log('\n' + '='.repeat(70));
console.log('VALIDATION 2: 4 new diagnostic few-shots in partiql_examples');
console.log('='.repeat(70));
const diagnosticExamples = parsed.partiql_examples.filter((ex) =>
  /diagnostic/.test(ex.question)
);
console.log(`Found ${diagnosticExamples.length} diagnostic examples:`);
diagnosticExamples.forEach((ex, i) => {
  console.log(`\n[${i + 1}] Q: ${ex.question}`);
  console.log(`    SQL: ${ex.query.substring(0, 150)}...`);
});

console.log('\n' + '='.repeat(70));
console.log('VALIDATION 3: ORDERS_CONTEXT contains Diagnostic Signals section');
console.log('='.repeat(70));
const hasSignals = /Diagnostic Signals/.test(ORDERS_CONTEXT);
const hasPatterns = /Diagnostic Question Patterns/.test(ORDERS_CONTEXT);
const hasPaymentProblem = /Payment Problem Signals/.test(ORDERS_CONTEXT);
const hasWorkflowError = /Workflow Error Signals/.test(ORDERS_CONTEXT);
const hasDuplicate = /Duplicate Order Signals/.test(ORDERS_CONTEXT);
console.log(`Diagnostic Signals section:          ${hasSignals ? 'PRESENT' : 'MISSING'}`);
console.log(`Diagnostic Question Patterns:        ${hasPatterns ? 'PRESENT' : 'MISSING'}`);
console.log(`Payment Problem Signals subsection:  ${hasPaymentProblem ? 'PRESENT' : 'MISSING'}`);
console.log(`Workflow Error Signals subsection:   ${hasWorkflowError ? 'PRESENT' : 'MISSING'}`);
console.log(`Duplicate Order Signals subsection:  ${hasDuplicate ? 'PRESENT' : 'MISSING'}`);

console.log('\n' + '='.repeat(70));
console.log('VALIDATION 4: Original question first few-shot SQL sanity checks');
console.log('='.repeat(70));
const orig = diagnosticExamples.find((ex) =>
  ex.question.startsWith('Os pedidos iscompleted=false')
);
if (!orig) {
  console.log('MISSING: original question few-shot NOT FOUND');
  process.exit(1);
}
const sql = orig.query;
const checks = [
  { label: 'GROUP BY iscompleted', ok: /GROUP BY iscompleted/i.test(sql) },
  { label: `WHERE hostname = '${HOSTNAME}'`, ok: sql.includes(`hostname = '${HOSTNAME}'`) },
  { label: 'LIMIT present', ok: /\bLIMIT\b/i.test(sql) },
  { label: 'signal no_auth (authorizeddate IS NULL)', ok: /authorizeddate IS NULL/i.test(sql) },
  { label: "signal payment_stuck (status IN ('payment-pending'", ok: /status IN \('payment-pending'/i.test(sql) },
  { label: 'signal no_transaction (JSON_ARRAY_LENGTH(transactions) = 0', ok: /JSON_ARRAY_LENGTH\(transactions\)\s*=\s*0/i.test(sql) },
  { label: 'signal multiple_attempts (JSON_ARRAY_LENGTH(transactions) > 1', ok: /JSON_ARRAY_LENGTH\(transactions\)\s*>\s*1/i.test(sql) },
];
checks.forEach((c) => console.log(`${c.ok ? 'OK ' : 'FAIL'}  ${c.label}`));
const allOk = checks.every((c) => c.ok);
console.log('\n' + (allOk ? 'All SQL sanity checks passed.' : 'SOME CHECKS FAILED - review the few-shot.'));

process.exit(allOk && hasSignals && hasPatterns ? 0 : 1);
