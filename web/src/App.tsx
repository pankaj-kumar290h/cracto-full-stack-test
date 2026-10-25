import { useEffect, useRef, useState } from 'react';
import type { Release, ReleasePage } from '../../shared/release';
import { api } from './api';
import { ReleaseForm } from './components/ReleaseForm';
import { ReleaseDetails } from './components/ReleaseDetails';

export function App() {
  const [page, setPage] = useState<ReleasePage>({ nodes: [], endCursor: null, hasNextPage: false });
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [revision, setRevision] = useState(0);
  const [recentCreated, setRecentCreated] = useState<Release | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Release | null>(null);
  const cache = useRef(new Map<string, { release: Release; fetchedAt: number }>());
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const after = cursors[cursors.length - 1];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void api.list(after, controller.signal).then(({ releases }) => {
      // Back up if concurrent deletions leave this page empty.
      if (!releases.nodes.length && after !== null) {
        setCursors(current => current.slice(0, -1));
        return;
      }
      setPage(releases);
      setSelectedId(current => (current === recentCreated?.id || releases.nodes.some(release => release.id === current)) ? current : releases.nodes[0]?.id ?? null);
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load releases.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [after, revision, recentCreated]);

  useEffect(() => {
    const controller = new AbortController();
    setDetailError('');
    const cached = selectedId ? cache.current.get(selectedId) : undefined;
    if (!selectedId) { setDetail(null); setDetailLoading(false); return; }
    if (cached && Date.now() - cached.fetchedAt < 30000) {
      setDetail(cached.release); setDetailLoading(false); return;
    }
    setDetail(null);
    setDetailLoading(true);
    void api.detail(selectedId, controller.signal).then(({ release }) => {
      if (controller.signal.aborted) return;
      if (cache.current.size >= 50) cache.current.delete(cache.current.keys().next().value!);
      cache.current.set(release.id, { release, fetchedAt: Date.now() });
      setDetail(release);
    }).catch(error => {
      if (!controller.signal.aborted) setDetailError(error instanceof Error ? error.message : 'Could not load details.');
    }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId, revision]);

  function updated(release: Release) {
    cache.current.set(release.id, { release, fetchedAt: Date.now() });
    setDetail(current => current?.id === release.id ? release : current);
    setPage(current => ({ ...current, nodes: current.nodes.map(item => item.id === release.id ? release : item) }));
  }

  function created(release: Release) {
    cache.current.clear();
    cache.current.set(release.id, { release, fetchedAt: Date.now() });
    setRecentCreated(release);
    setCursors([null]);
    setRevision(current => current + 1);
    setSelectedId(release.id);
  }

  function deleted(id: string) {
    cache.current.delete(id);
    setDetail(null);
    setSelectedId(current => current === id ? null : current);
    setRecentCreated(current => current?.id === id ? null : current);
    setRevision(current => current + 1);
  }

  return (
    <main>
      <h1>Release checklist</h1>
      <ReleaseForm onCreated={created} />
      {error && <p role="alert" className="error">{error} <button onClick={() => setRevision(current => current + 1)}>Retry</button></p>}
      <div className="release-layout">
        <section className="card" aria-labelledby="releases-title" aria-busy={loading}>
          <h2 id="releases-title">Releases</h2>
          {recentCreated && !page.nodes.some(release => release.id === recentCreated.id) && <p>
            Created: <button onClick={() => setSelectedId(recentCreated.id)}>{recentCreated.name}</button>
          </p>}
          {loading ? <p role="status">Loading releases…</p> : page.nodes.length === 0 ? <p>No releases yet.</p> : <ul className="release-list">
            {page.nodes.map(release => <li key={release.id}>
              <button className="release-item" aria-pressed={selectedId === release.id} onClick={() => setSelectedId(release.id)}>
                <strong>{release.name}</strong>
                <span>{new Date(release.dueAt).toLocaleString()}</span>
                <span>Status: {release.status}</span>
              </button>
            </li>)}
          </ul>}
          <div className="actions">
            <button disabled={loading || cursors.length === 1} onClick={() => { setRecentCreated(null); setCursors(current => current.slice(0, -1)); }}>Previous</button>
            <span>Page {cursors.length}</span>
            <button disabled={loading || !page.hasNextPage} onClick={() => { setRecentCreated(null); setCursors(current => [...current, page.endCursor]); }}>Next</button>
          </div>
        </section>
        {detailLoading ? <p role="status">Loading details…</p> : detailError ? <p role="alert" className="error">{detailError} <button onClick={() => setRevision(current => current + 1)}>Retry</button></p> : detail && detail.id === selectedId && <ReleaseDetails
          key={detail.id} release={detail} onUpdated={updated} onDeleted={deleted}
        />}
      </div>
    </main>
  );
}
