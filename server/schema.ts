import { randomUUID } from 'node:crypto';
import { buildSchema } from 'graphql';
import { STEPS, releaseStatus, type Release } from '../shared/release.js';
import { notFound, validateId, validateName, validateDate, validateInfo, validateStep } from './domain.js';
import { pool } from './db.js';
import { pageSize, decodeCursor, encodeCursor } from './pagination.js';

export const schema = buildSchema(`
  enum ReleaseStatus { planned ongoing done }
  type Step { id: ID!, label: String!, completed: Boolean! }
  type Release {
    id: ID!
    name: String!
    dueAt: String!
    additionalInfo: String
    status: ReleaseStatus!
    steps: [Step!]!
  }
  input CreateReleaseInput { name: String!, dueAt: String!, additionalInfo: String }
  type ReleaseSummary { id: ID!, name: String!, dueAt: String!, status: ReleaseStatus! }
  type ReleasePage { nodes: [ReleaseSummary!]!, endCursor: String, hasNextPage: Boolean! }
  type Query { releases(first: Int = 25, after: String): ReleasePage!, release(id: ID!): Release! }
  type Mutation {
    createRelease(input: CreateReleaseInput!): Release!
    setReleaseStep(id: ID!, stepId: ID!, completed: Boolean!): Release!
    updateReleaseInfo(id: ID!, additionalInfo: String): Release!
    deleteRelease(id: ID!): ID!
  }
`);

type ReleaseRow = {
  id: string;
  name: string;
  due_at: Date;
  additional_info: string | null;
  completed_step_ids: string[];
  cursor_due_at: string;
};

async function query(sql: string, values: unknown[] = []) {
  const started = performance.now();
  try {
    return (await pool.query<ReleaseRow>(sql, values)).rows;
  } catch (error) {
    console.error(error);
    throw new Error('Database request failed. Please try again.');
  } finally {
    const duration = performance.now() - started;
    if (process.env.PERF_LOGGING === 'true') console.info(JSON.stringify({ event: 'database', command: sql.trim().split(/\s+/)[0], durationMs: Math.round(duration) }));
  }
}

function toRelease(row?: ReleaseRow): Release {
  if (!row) throw notFound();
  return {
    id: row.id,
    name: row.name,
    dueAt: row.due_at.toISOString(),
    additionalInfo: row.additional_info,
    status: releaseStatus(row.completed_step_ids),
    steps: STEPS.map((step) => ({ ...step, completed: row.completed_step_ids.includes(step.id) })),
  };
}

export const rootValue = {
  releases: async ({ first, after }: { first?: number; after?: string | null }) => {
    const size = pageSize(first);
    const cursor = after == null ? null : decodeCursor(after);
    const columns = 'id, name, due_at, completed_step_ids, due_at::text AS cursor_due_at';
    const rows = cursor
      ? await query(`SELECT ${columns} FROM releases WHERE (due_at, id) > ($1::timestamptz, $2::uuid) ORDER BY due_at, id LIMIT $3`, [...cursor, size + 1])
      : await query(`SELECT ${columns} FROM releases ORDER BY due_at, id LIMIT $1`, [size + 1]);
    const page = rows.slice(0, size);
    const last = page.at(-1);
    return {
      nodes: page.map(row => ({ id: row.id, name: row.name, dueAt: row.due_at.toISOString(), status: releaseStatus(row.completed_step_ids) })),
      endCursor: last ? encodeCursor(last.cursor_due_at, last.id) : null,
      hasNextPage: rows.length > size,
    };
  },

  release: async ({ id }: { id: string }) => toRelease((await query(
    'SELECT id, name, due_at, additional_info, completed_step_ids FROM releases WHERE id = $1', [validateId(id)],
  ))[0]),

  createRelease: async ({ input }: { input: { name: string; dueAt: string; additionalInfo?: string | null } }) => {
    const rows = await query(
      'INSERT INTO releases (id, name, due_at, additional_info) VALUES ($1, $2, $3, $4) RETURNING *',
      [randomUUID(), validateName(input.name), validateDate(input.dueAt), validateInfo(input.additionalInfo)],
    );
    return toRelease(rows[0]);
  },

  setReleaseStep: async ({ id, stepId, completed }: { id: string; stepId: string; completed: boolean }) => {
    // A single SQL update preserves simultaneous changes to different steps.
    const rows = await query(
      `UPDATE releases SET completed_step_ids = CASE
        WHEN $3::boolean AND NOT ($2 = ANY(completed_step_ids)) THEN array_append(completed_step_ids, $2)
        WHEN NOT $3::boolean THEN array_remove(completed_step_ids, $2)
        ELSE completed_step_ids END, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [validateId(id), validateStep(stepId), completed],
    );
    return toRelease(rows[0]);
  },

  updateReleaseInfo: async ({ id, additionalInfo }: { id: string; additionalInfo?: string | null }) => {
    const rows = await query(
      'UPDATE releases SET additional_info = $2, updated_at = now() WHERE id = $1 RETURNING *',
      [validateId(id), validateInfo(additionalInfo)],
    );
    return toRelease(rows[0]);
  },

  deleteRelease: async ({ id }: { id: string }) => {
    const rows = await query('DELETE FROM releases WHERE id = $1 RETURNING id', [validateId(id)]);
    if (!rows[0]) throw notFound();
    return rows[0].id;
  },
};
