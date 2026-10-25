import { useState, type FormEvent } from 'react';
import type { Release } from '../../../shared/release';
import { api } from '../api';

export function ReleaseForm({ onCreated }: { onCreated: (release: Release) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setError('');
    try {
      const result = await api.create({
        name: String(data.get('name')),
        dueAt: new Date(String(data.get('dueAt'))).toISOString(),
        additionalInfo: String(data.get('additionalInfo') || ''),
      });
      onCreated(result.createRelease);
      form.reset();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not create release.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" aria-labelledby="create-title">
      <h2 id="create-title">Create a release</h2>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={saving}>
          <div className="form-fields">
            <label>Release name<input name="name" required maxLength={200} /></label>
            <label>Due date and time<input name="dueAt" type="datetime-local" required /><small>Your local timezone.</small></label>
            <label className="full-width">Additional information (optional)<textarea name="additionalInfo" rows={3} maxLength={10000} /></label>
          </div>
          <button className="primary" type="submit">{saving ? 'Creating…' : 'Create release'}</button>
        </fieldset>
        {error && <p role="alert" className="error">{error}</p>}
      </form>
    </section>
  );
}
