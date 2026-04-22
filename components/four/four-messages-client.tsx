'use client';

import { useState } from 'react';
import { tryCopyText } from '@/lib/copy';

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
    <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
      <section className="glass-card p-5">
        <h3 className="text-lg font-semibold text-[#fff1dd]">Messages prédéfinis FOUR</h3>
        <div className="mt-3 space-y-2">
          {messages.map((message) => (
            <article key={message.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
              <p className="text-sm font-semibold text-[#ffe8ca]">{message.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-[#efcdab]">{message.content}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="saas-ghost-btn !py-1.5 text-xs" onClick={() => void copy(message.content)}>Copier</button>
                {canManage ? <button type="button" className="saas-ghost-btn !py-1.5 text-xs" onClick={() => startEdit(message)}>Modifier</button> : null}
                {canManage ? <button type="button" className="saas-ghost-btn !py-1.5 text-xs" onClick={() => void remove(message.id)}>Supprimer</button> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {canManage ? (
        <section className="glass-card space-y-3 p-5">
          <h3 className="text-lg font-semibold text-[#fff1dd]">{editing ? `Modifier message #${editing.id}` : 'Créer un message'}</h3>
          <input className="saas-input" placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="saas-input min-h-40" placeholder="Contenu" value={content} onChange={(e) => setContent(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="saas-primary-btn" onClick={() => void submit()}>{editing ? 'Enregistrer' : 'Créer'}</button>
            <button type="button" className="saas-ghost-btn" onClick={startCreate}>Réinitialiser</button>
          </div>
          {error ? <p className="text-sm text-red-200">{error}</p> : null}
          {copyFeedback ? <p className="text-xs text-[#efcdab]">{copyFeedback}</p> : null}
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
