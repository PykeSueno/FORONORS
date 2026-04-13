'use client';

import { useEffect, useState } from 'react';

export function WelcomeCardActions({ canUpdatePassword }: { canUpdatePassword: boolean }) {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!showPasswordModal) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [showPasswordModal]);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('foronors_session_token');
    window.location.assign('/login');
  }

  async function savePassword() {
    setError('');
    const response = await fetch('/api/account/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword })
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Modification impossible.');
      return;
    }

    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {canUpdatePassword ? (
          <button aria-label="Modifier mot de passe" className="icon-key-btn" onClick={() => setShowPasswordModal(true)}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M14.5 7.5a4.5 4.5 0 1 1-8.9 1 4.5 4.5 0 0 1 8.9-1Z" /><path d="M13 9l8 0" /><path d="M18 9v3" /><path d="M20 9v2" /></svg>
          </button>
        ) : null}

        <button aria-label="Se déconnecter" className="icon-logout-btn" onClick={() => void logout()}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></svg>
        </button>
      </div>

      {showPasswordModal && canUpdatePassword ? (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onClick={() => setShowPasswordModal(false)}>
          <div className="glass-card w-full max-w-md p-6" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#fff1dd]">Modifier le mot de passe</h3>
            <div className="mt-3 space-y-3">
              <label className="block text-xs text-[#efcdab]">Ancien mot de passe<input type="password" className="saas-input mt-1 w-full" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
              <label className="block text-xs text-[#efcdab]">Nouveau mot de passe<input type="password" className="saas-input mt-1 w-full" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
              <label className="block text-xs text-[#efcdab]">Confirmation<input type="password" className="saas-input mt-1 w-full" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
              {error ? <p className="text-sm text-red-100">{error}</p> : null}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="saas-ghost-btn" onClick={() => setShowPasswordModal(false)}>Annuler</button>
              <button className="saas-primary-btn" onClick={() => void savePassword()}>Enregistrer</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
