'use client';

import { useState } from 'react';
import { tryCopyText } from '@/lib/copy';
import { RemoveLineButton } from '@/components/shared/line-controls';

type FourMessage = { id: number; title: string; content: string; display_order: number };

export function FourMessagesClient({ initialMessages, canManage }: { initialMessages: FourMessage[]; canManage: boolean }) {
  const [messages, setMessages] = useState(initialMessages);
  const [editing, setEditing] = useState<FourMessage | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [error, setError] = useState('');

  function startEdit(message: FourMessage) {
    setEditing(message);
    setTitle(message.title);
    setContent(message.content);
    setError('');
  }

  function startCreate() {
    setEditing(null);
    setTitle('');
    setContent('');
    setError('');
  }

  async function refresh() {
    const response = await fetch('/api/four/messages', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = (await response.json()) as { messages: FourMessage[] };
    setMessages(payload.messages ?? []);
  }

  async function submit() {
    setError('');
    if (!title.trim() || !content.trim()) {
      setError('Titre et contenu requis.');
      return;
    }

    const response = await fetch('/api/four/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsert',
        id: editing?.id,
        title: title.trim(),
        content: content.trim(),
        display_order: editing?.display_order ?? 100
      })
    });
    if (!response.ok) {
      setError((await response.json()).message ?? 'Enregistrement impossible.');
      return;
    }

    startCreate();
    await refresh();
  }

  async function remove(id: number) {
    const response = await fetch('/api/four/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id })
    });
    if (!response.ok) {
      setError((await response.json()).message ?? 'Suppression impossible.');
      return;
    }
    await refresh();
  }

  async function copy(contentToCopy: string) {
    const ok = await tryCopyText(contentToCopy);
    setCopyFeedback(ok ? 'Message copié.' : 'Copie indisponible ici.');
    setTimeout(() => setCopyFeedback(''), 1600);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="glass-card p-5">
        <h3 className="text-lg font-semibold text-[#fff1dd]">Messages prédéfinis FOUR</h3>
        <div className="mt-3 space-y-2">
          {messages.map((message) => (
            <article key={message.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
              <p className="text-sm font-semibold text-[#ffe8ca]">{message.title}</p>
              <p className="mt-1 min-h-[3.75rem] max-h-[4.75rem] overflow-hidden whitespace-pre-wrap text-xs leading-relaxed text-[#efcdab]">{message.content}</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                <button type="button" className="saas-ghost-btn !h-9 !min-h-9 w-full !py-0 text-xs" onClick={() => void copy(message.content)}>Copier</button>
                {canManage ? <button type="button" className="saas-ghost-btn !h-9 !min-h-9 w-full !py-0 text-xs" onClick={() => startEdit(message)}>Modifier</button> : null}
                {canManage ? <div className="flex justify-center sm:justify-end"><RemoveLineButton onClick={() => void remove(message.id)} title="Supprimer le message" /></div> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {canManage ? (
        <section className="glass-card p-5">
          <h3 className="text-lg font-semibold text-[#fff1dd]">{editing ? `Modifier message #${editing.id}` : 'Créer un message'}</h3>
          <div className="mt-3 space-y-3">
            <label className="block space-y-1">
              <span className="text-xs text-[#efcdab]">Titre</span>
              <input className="saas-input !h-10 !min-h-10 w-full" placeholder="Titre du message" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-[#efcdab]">Contenu</span>
              <textarea className="saas-input h-52 min-h-52 w-full resize-y" placeholder="Contenu du message" value={content} onChange={(e) => setContent(e.target.value)} />
            </label>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" className="saas-primary-btn !h-10 !min-h-10 w-full" onClick={() => void submit()}>{editing ? 'Enregistrer' : 'Créer'}</button>
            <button type="button" className="saas-ghost-btn !h-10 !min-h-10 w-full" onClick={startCreate}>Réinitialiser</button>
          </div>
          {error ? <p className="mt-2 text-sm text-red-200">{error}</p> : null}
          {copyFeedback ? <p className="mt-1 text-xs text-[#efcdab]">{copyFeedback}</p> : null}
        </section>
      ) : (
        <section className="glass-card p-5">
          <p className="text-sm text-[#efcdab]">Tu peux consulter et copier les messages prédéfinis. La gestion nécessite la permission dédiée.</p>
          {copyFeedback ? <p className="mt-2 text-xs text-[#efcdab]">{copyFeedback}</p> : null}
        </section>
      )}
    </div>
  );
}
