import express from 'express';
import { execute, GraphQLError } from 'graphql';
import { prepareOperation } from './operations.js';
import { resolve } from 'node:path';
import { pool } from './db.js';
import { schema, rootValue } from './schema.js';

const app = express();
app.use(express.json({ limit: '64kb' }));

app.post('/graphql', async (req, res, next) => {
  const started = performance.now();
  res.setHeader('Cache-Control', 'no-store');
  const { query, variables, operationName } = req.body ?? {};
  if (typeof query !== 'string'
    || (variables != null && (typeof variables !== 'object' || Array.isArray(variables)))
    || (operationName != null && typeof operationName !== 'string')) {
    res.status(400).json({ errors: [{ message: 'Send a GraphQL query string with optional variables and operationName.' }] });
    return;
  }
  try {
    const document = prepareOperation(schema, query, operationName);
    const result = await execute({ schema, rootValue, document, variableValues: variables, operationName });
    const duration = performance.now() - started;
    res.setHeader('Server-Timing', `graphql;dur=${duration.toFixed(1)}`);
    if (process.env.PERF_LOGGING === 'true') console.info(JSON.stringify({
      event: 'graphql', operationName: operationName ?? null, durationMs: Math.round(duration),
      errors: result.errors?.length ?? 0, poolTotal: pool.totalCount, poolIdle: pool.idleCount, poolWaiting: pool.waitingCount,
    }));
    res.status(result.data === undefined && result.errors ? 400 : 200).json(result);
  } catch (error) {
    if (error instanceof GraphQLError) {
      res.status(400).json({ errors: [error] });
      return;
    }
    next(error);
  }
});

app.use('/assets', express.static(resolve('web/dist/assets'), { maxAge: '1y', immutable: true }));
app.use(express.static(resolve('web/dist'), { maxAge: 0 }));
const handleError: express.ErrorRequestHandler = (error, _req, res, _next) => {
  const status = error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
  res.status(status).json({ errors: [{ message: status === 500 ? 'Server error. Please try again.' : 'Invalid or oversized JSON request.' }] });
};
app.use(handleError);

const server = app.listen(Number(process.env.PORT || 4000), () => console.log('Release checklist: http://localhost:' + (process.env.PORT || 4000)));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => server.close(() => { void pool.end(); }));
}
