export const STEPS = [
  { id: 'prepare-changes', label: 'Prepare changes' },
  { id: 'review-code', label: 'Review code' },
  { id: 'pass-tests', label: 'Pass automated tests' },
  { id: 'update-docs', label: 'Update documentation' },
  { id: 'release-notes', label: 'Prepare release notes' },
  { id: 'deploy-staging', label: 'Deploy to staging' },
  { id: 'verify-staging', label: 'Verify staging' },
  { id: 'deploy-production', label: 'Deploy to production' },
] as const;

export type Release = {
  id: string;
  name: string;
  dueAt: string;
  additionalInfo: string | null;
  status: 'planned' | 'ongoing' | 'done';
  steps: { id: string; label: string; completed: boolean }[];
};

export type ReleaseSummary = Pick<Release, 'id' | 'name' | 'dueAt' | 'status'>;
export type ReleasePage = { nodes: ReleaseSummary[]; endCursor: string | null; hasNextPage: boolean };

export function releaseStatus(ids: readonly string[]): Release['status'] {
  const count = new Set(ids.filter((id) => STEPS.some((step) => step.id === id))).size;
  return count === 0 ? 'planned' : count === STEPS.length ? 'done' : 'ongoing';
}
