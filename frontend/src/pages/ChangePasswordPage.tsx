import { useState } from 'react';
import { Card, PageHeader } from '../components/ui';
import { fetchWithFallback } from '../lib/api';

export default function ChangePasswordPage({ onDone }: { onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const submit = async () => {
    setError('');
    const p = newPassword.trim();
    if (p.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (p !== confirm.trim()) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    const res = await fetchWithFallback('/api/v1/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: p }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.message || 'Unable to update password.');
      setSaving(false);
      return;
    }
    setSaving(false);
    onDone();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Set a new password" description="For security, you must change your temporary password before continuing." />

      {error ? (
        <div className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">{error}</div>
      ) : null}

      <Card className="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="label-mono">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-surface mt-1 w-full"
              placeholder="Minimum 8 characters"
            />
          </div>
          <div>
            <label className="label-mono">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input-surface mt-1 w-full"
              placeholder="Re-enter password"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={() => void submit()} disabled={saving}>
              {saving ? 'Saving…' : 'Update password'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

