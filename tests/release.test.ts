import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEPS, releaseStatus } from '../shared/release.js';
import { validateName, validateDate, validateInfo } from '../server/domain.js';

test('status follows checklist completion, including unchecking a completed release', () => {
  const all = STEPS.map((step) => step.id);
  assert.equal(releaseStatus([]), 'planned');
  assert.equal(releaseStatus([all[0]]), 'ongoing');
  assert.equal(releaseStatus(all), 'done');
  assert.equal(releaseStatus(all.slice(1)), 'ongoing');
});

test('release input requires a name and valid date; additional information is optional', () => {
  assert.equal(validateName('  Release 1  '), 'Release 1');
  assert.throws(() => validateName('   '));
  assert.equal(validateDate('2026-11-01T12:00:00Z'), '2026-11-01T12:00:00.000Z');
  assert.throws(() => validateDate('not-a-date'));
  assert.throws(() => validateDate('2026-02-30T12:00:00Z'));
  assert.equal(validateInfo(undefined), null);
  assert.equal(validateInfo('  '), null);
});


// Pagination and demand-control regressions do not require a running database.
import { pageSize, encodeCursor, decodeCursor } from '../server/pagination.js';
import { prepareOperation } from '../server/operations.js';
import { buildSchema, execute } from 'graphql';

test('pagination bounds work and preserves database timestamp precision', () => {
  assert.equal(pageSize(), 25);
  assert.equal(pageSize(100), 100);
  for (const value of [0, -1, 101, 1.5, NaN]) assert.throws(() => pageSize(value));
  const id = '00000000-0000-0000-0000-000000000001';
  const date = '2026-11-01 12:00:00.123456+00';
  assert.deepEqual(decodeCursor(encodeCursor(date, id)), [date, id]);
  for (const value of ['invalid', 'x'.repeat(513), encodeCursor('not-a-date', id), encodeCursor(date, 'bad-id')]) {
    assert.throws(() => decodeCursor(value), /Invalid page cursor/);
  }
});

test('GraphQL limits expand fragments and reject excessive aliases and malformed documents', () => {
  const schema = buildSchema('type Item { id: ID!, child: Item } type Query { item: Item }');
  assert.ok(prepareOperation(schema, '{ item { id } }'));
  assert.ok(prepareOperation(schema, 'query { ...A } fragment A on Query { item { id } }'));
  assert.throws(() => prepareOperation(schema, `{ ${Array.from({ length: 6 }, (_, i) => `a${i}: item { id }`).join(' ')} }`), /too much work/);
  assert.throws(() => prepareOperation(schema, 'query { ...A ...A ...A ...A ...A ...A } fragment A on Query { item { id } }'), /too much work/);
  assert.throws(() => prepareOperation(schema, '{ item { ' + 'child { '.repeat(13) + 'id' + ' }'.repeat(14) + ' }'), /too deep/);
  assert.throws(() => prepareOperation(schema, '{ item { ' + Array.from({ length: 201 }, (_, i) => `a${i}: id`).join(' ') + ' } }'), /too much work/);
  assert.throws(() => prepareOperation(schema, '{ item { ' + 'id '.repeat(2100) + '} }'), /tokens/);
  assert.throws(() => prepareOperation(schema, 'query { ...A } fragment A on Query { ...A }'));
  assert.throws(() => prepareOperation(schema, '{ unknown }'));
});

test('release pages use bounded keyset queries, omit notes, and expose a detail lookup', async (t) => {
  process.env.DATABASE_URL ??= 'postgresql://unused:unused@127.0.0.1:1/unused';
  const { pool } = await import('../server/db.js');
  const { schema, rootValue } = await import('../server/schema.js');
  const rows = Array.from({ length: 3 }, (_, i) => ({
    id: `00000000-0000-0000-0000-00000000000${i + 1}`,
    name: `Release ${i + 1}`, due_at: new Date('2026-11-01T12:00:00Z'),
    cursor_due_at: '2026-11-01 12:00:00.123456+00', completed_step_ids: [], additional_info: 'Long notes',
  }));
  const calls: { sql: string; values: unknown[] }[] = [];
  const mock = t.mock.method(pool, 'query', async (sql: string, values: unknown[]) => {
    calls.push({ sql, values });
    return { rows: sql.includes('WHERE id =') ? [rows[0]] : rows };
  });
  try {
    const page = await rootValue.releases({ first: 2 });
    assert.equal(page.nodes.length, 2);
    assert.equal(page.hasNextPage, true);
    assert.ok(page.endCursor);
    assert.deepEqual(calls[0].values, [3]);
    assert.ok(!calls[0].sql.includes('additional_info'));
    assert.ok(!('steps' in page.nodes[0]));
    assert.ok(!('additionalInfo' in page.nodes[0]));
    const next = await rootValue.releases({ first: 2, after: page.endCursor });
    assert.deepEqual(calls[1].values, [rows[1].cursor_due_at, rows[1].id, 3]);
    assert.match(calls[1].sql, /WHERE \(due_at, id\) > /);
    assert.ok(next);
    const result = await execute({ schema, rootValue, document: prepareOperation(schema,
      '{ releases(first: 2) { nodes { id name status } hasNextPage endCursor } }') });
    assert.equal(result.errors, undefined);
    const detail = await rootValue.release({ id: rows[0].id });
    assert.equal(detail.additionalInfo, 'Long notes');
    assert.equal(detail.steps.length, 8);
    await assert.rejects(() => rootValue.releases({ first: 101 }));
    await assert.rejects(() => rootValue.releases({ after: 'invalid' }));
    mock.mock.mockImplementation(async (sql: string, values: unknown[]) => { calls.push({ sql, values }); return { rows: [] }; });
    const empty = await rootValue.releases({});
    assert.deepEqual(empty, { nodes: [], endCursor: null, hasNextPage: false });
    await assert.rejects(() => rootValue.release({ id: rows[0].id }), /Release not found/);
    mock.mock.mockImplementation(async () => ({ rows: [rows[0]] }));
    const last = await rootValue.releases({ first: 2 });
    assert.equal(last.hasNextPage, false);
    assert.equal(last.nodes.length, 1);
  } finally { mock.mock.restore(); }
});
