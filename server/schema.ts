import { randomUUID } from 'node:crypto';
import { buildSchema } from 'graphql';
import { STEPS, releaseStatus, type Release } from '../shared/release.js';
import { notFound, validateId, validateName, validateDate, validateInfo, validateStep } from './domain.js';
import { pool } from './db.js';

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
  type Query { releases: [Release!]! }
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
};

async function query(sql: string, values: unknown[] = []) {
  try {
    return (await pool.query<ReleaseRow>(sql, values)).rows;
  } catch (error) {
    console.error(error);
    throw new Error('Database request failed. Please try again.');
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
  releases: async () => (await query('SELECT * FROM releases ORDER BY due_at, id')).map(toRelease),

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
    const rows = await query('DELETE FROM releases WHERE id = $1 RETURNING *', [validateId(id)]);
    if (!rows[0]) throw notFound();
    return rows[0].id;
  },
};
