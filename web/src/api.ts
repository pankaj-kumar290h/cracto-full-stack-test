import type { Release } from '../../shared/release';

export const RELEASE_FIELDS = `id name dueAt additionalInfo status steps { id label completed }`;

export async function request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error('Cannot connect to the server. Check your connection and try again.');
  }
  let result: { data?: T; errors?: { message: string; }[]; };
  try { result = await response.json(); } catch {
    throw new Error('The server is unavailable. Please try again.');
  }
  if (result.errors?.length) throw new Error(result.errors.map((error) => error.message).join(' '));
  if (!response.ok || !result.data) throw new Error('Unable to complete the request. Please try again.');
  return result.data;
}

export const api = {
  list: () => request<{ releases: Release[]; }>(`query Releases { releases { ${RELEASE_FIELDS} } }`),
  create: (input: { name: string; dueAt: string; additionalInfo: string; }) => request<{ createRelease: Release; }>(
    `mutation CreateRelease($input: CreateReleaseInput!) { createRelease(input: $input) { ${RELEASE_FIELDS} } }`, { input }),
  step: (id: string, stepId: string, completed: boolean) => request<{ setReleaseStep: Release; }>(
    `mutation SetStep($id: ID!, $stepId: ID!, $completed: Boolean!) { setReleaseStep(id: $id, stepId: $stepId, completed: $completed) { ${RELEASE_FIELDS} } }`, { id, stepId, completed }),
  info: (id: string, additionalInfo: string) => request<{ updateReleaseInfo: Release; }>(
    `mutation UpdateInfo($id: ID!, $additionalInfo: String) { updateReleaseInfo(id: $id, additionalInfo: $additionalInfo) { ${RELEASE_FIELDS} } }`, { id, additionalInfo }),
  delete: (id: string) => request<{ deleteRelease: string; }>('mutation DeleteRelease($id: ID!) { deleteRelease(id: $id) }', { id }),
};
