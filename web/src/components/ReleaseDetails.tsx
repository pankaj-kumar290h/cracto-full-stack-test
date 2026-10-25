import { useState, type FormEvent } from 'react';
import type { Release } from '../../../shared/release';
import { api } from '../api';

type Props = {
  release: Release;
  onUpdated: (release: Release) => void;
  onDeleted: (id: string) => void;
};

export function ReleaseDetails({ release, onUpdated, onDeleted }: Props) {
  const [info, setInfo] = useState(release.additionalInfo ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function update(action: () => Promise<Release>) {
    setBusy(true);
    setError('');
    try {
      onUpdated(await action());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update release.');
    } finally {
      setBusy(false);
    }
  }

  function saveInfo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void update(async () => {
      const updated = (await api.info(release.id, info)).updateReleaseInfo;
      setInfo(updated.additionalInfo ?? '');
      setSaved(true);
      return updated;
    });
  }

  async function remove() {
    if (!window.confirm(`Delete "${release.name}"? This cannot be undone.`)) return;
    setBusy(true);
    setError('');
    try {
      await api.delete(release.id);
      onDeleted(release.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not delete release.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="detail-title" aria-busy={busy}>
      <h2 id="detail-title">{release.name}</h2>
      <p>Due: {new Date(release.dueAt).toLocaleString()}<br />Status: <strong>{release.status}</strong></p>
      <fieldset disabled={busy}>
        <legend>Release steps</legend>
        <ul className="checklist">
          {release.steps.map((step) => (
            <li key={step.id}>
              <label><input type="checkbox" checked={step.completed} onChange={(event) => {
                const completed = event.target.checked;
                void update(async () => (await api.step(release.id, step.id, completed)).setReleaseStep);
              }} />{step.label}</label>
            </li>
          ))}
        </ul>
        <form onSubmit={saveInfo}>
          <label>Additional information<textarea value={info} onChange={(event) => { setInfo(event.target.value); setSaved(false); }} rows={4} maxLength={10000} /></label>
          <div className="actions">
            <button type="submit" disabled={info === (release.additionalInfo ?? '')}>Save information</button>
            <span role="status">{busy ? 'Saving…' : saved ? 'Information saved.' : ''}</span>
          </div>
        </form>
        <button type="button" className="danger" onClick={() => void remove()}>Delete release</button>
      </fieldset>
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  );
}
