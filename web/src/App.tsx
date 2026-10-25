import { useEffect, useState } from 'react';
import type { Release } from '../../shared/release';
import { api } from './api';
import { ReleaseForm } from './components/ReleaseForm';
import { ReleaseDetails } from './components/ReleaseDetails';

export function App() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setReleases((await api.list()).releases);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not load releases.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  const selected = releases.find((release) => release.id === selectedId) ?? releases[0];

  function created(release: Release) {
    setReleases((current) => [...current, release].sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id)));
    setSelectedId(release.id);
  }

  return (
    <main>
      <h1>Release checklist</h1>
      {loading ? <p role="status">Loading releases…</p> : <>
        {error && <p role="alert" className="error">{error} <button onClick={() => void load()}>Retry</button></p>}
        <ReleaseForm onCreated={created} />
        <div className="release-layout">
          <section className="card" aria-labelledby="releases-title">
            <h2 id="releases-title">All releases</h2>
            {releases.length === 0 ? <p>No releases yet.</p> : <ul className="release-list">
              {releases.map((release) => (
                <li key={release.id}>
                  <button className="release-item" aria-pressed={selected?.id === release.id} onClick={() => setSelectedId(release.id)}>
                    <strong>{release.name}</strong>
                    <span>{new Date(release.dueAt).toLocaleString()}</span>
                    <span>Status: {release.status}</span>
                  </button>
                </li>
              ))}
            </ul>}
          </section>
          {selected && <ReleaseDetails
            key={selected.id}
            release={selected}
            onUpdated={(updated) => setReleases((current) => current.map((release) => release.id === updated.id ? updated : release))}
            onDeleted={(id) => setReleases((current) => current.filter((release) => release.id !== id))}
          />}
        </div>
      </>}
    </main>
  );
}
