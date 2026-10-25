CREATE TABLE IF NOT EXISTS releases (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  due_at TIMESTAMPTZ NOT NULL,
  additional_info TEXT CHECK (char_length(additional_info) <= 10000),
  completed_step_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_step_ids CHECK (
    completed_step_ids <@ ARRAY['prepare-changes', 'review-code', 'pass-tests', 'update-docs',
      'release-notes', 'deploy-staging', 'verify-staging', 'deploy-production']::TEXT[]
    AND array_position(completed_step_ids, NULL) IS NULL
  )
);
CREATE INDEX IF NOT EXISTS releases_due_at_id_idx ON releases (due_at, id);
