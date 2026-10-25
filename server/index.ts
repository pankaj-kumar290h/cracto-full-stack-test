import express from 'express';
import { graphql } from 'graphql';
import { resolve } from 'node:path';
import { pool } from './db.js';
import { schema, rootValue } from './schema.js';

const app = express();
app.use(express.json({ limit: '64kb' }));

app.post('/graphql', async (req, res, next) => {
  const { query, variables, operationName } = req.body ?? {};
  if (typeof query !== 'string'
    || (variables != null && (typeof variables !== 'object' || Array.isArray(variables)))
    || (operationName != null && typeof operationName !== 'string')) {
    res.status(400).json({ errors: [{ message: 'Send a GraphQL query string with optional variables and operationName.' }] });
    return;
  }
  try {
    const result = await graphql({ schema, rootValue, source: query, variableValues: variables, operationName });
    res.status(result.data === undefined && result.errors ? 400 : 200).json(result);
  } catch (error) {
    next(error);
  }
});

app.use(express.static(resolve('web/dist')));
const handleError: express.ErrorRequestHandler = (error, _req, res, _next) => {
  const status = error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
  res.status(status).json({ errors: [{ message: status === 500 ? 'Server error. Please try again.' : 'Invalid or oversized JSON request.' }] });
};
app.use(handleError);

const server = app.listen(Number(process.env.PORT || 4000), () => console.log('Release checklist: http://localhost:' + (process.env.PORT || 4000)));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => server.close(() => { void pool.end(); }));
}
