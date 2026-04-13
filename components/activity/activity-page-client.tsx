'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

type ActivityType = 'mailbox' | 'burglary' | 'container';
type Item = { id: number; name: string; image_url: string | null; quantity: number; category_key: string; type_key: string | null };
type RecentActivity = {
  id: number;
  activity_type: ActivityType;
  member_label: string;
  proof_image_url: string | null;
  equipment_item_name: string | null;
  equipment_used: number;
  equipment_before: number;
  equipment_after: number;
  created_at: string;
  activity_items: Array<{ item_name: string; quantity_added: number; before_quantity: number; after_quantity: number }>;
};

type Line = { item_id: number; quantity: number };

const ACTIVITY_META: Record<ActivityType, { label: string; icon: string; subtitle: string }> = {
  mailbox: { label: 'Boîte aux lettres', icon: '📬', subtitle: 'Aucun équipement requis' },
  burglary: { label: 'Cambriolage', icon: '🏠', subtitle: 'Consomme des Kits' },
  container: { label: 'Conteneur', icon: '📦', subtitle: 'Consomme des Disqueuses' }
};

export function ActivityPageClient({ items, members, activities, defaultMemberId, defaultMemberLabel, canCreate }: { items: Item[]; members: Array<{ id: string; name: string; username: string }>; activities: RecentActivity[]; defaultMemberId: string; defaultMemberLabel: string; canCreate: boolean }) {
  const [activityType, setActivityType] = useState<ActivityType>('mailbox');
  const [memberId, setMemberId] = useState(defaultMemberId);
  const [memberLabel, setMemberLabel] = useState(defaultMemberLabel);
  const [equipmentUsed, setEquipmentUsed] = useState('0');
  const [lines, setLines] = useState<Line[]>([]);
  const [proofImageUrl, setProofImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const availableItems = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [items, query]);

  function addItem(itemId: number) {
    setLines((current) => {
      const existingIndex = current.findIndex((line) => line.item_id === itemId);
      if (existingIndex >= 0) {
        return current.map((line, idx) => (idx === existingIndex ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [...current, { item_id: itemId, quantity: 1 }];
    });
  }

  function updateLine(index: number, quantity: number) {
    setLines((current) => current.map((line, idx) => (idx === index ? { ...line, quantity: Math.max(1, quantity) } : line)));
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, idx) => idx !== index));
  }

  async function uploadImage(file: File) {
    setUploading(true);
    const body = new FormData();
    body.append('file', file);
    const response = await fetch('/api/items/upload-image', { method: 'POST', body });
    setUploading(false);
    if (!response.ok) {
      setError('Upload image impossible.');
      return;
    }
    const data = (await response.json()) as { url: string };
    setProofImageUrl(data.url);
  }

  async function onPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(event.clipboardData.items).find((entry) => entry.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    event.preventDefault();
    await uploadImage(file);
  }

  async function submit() {
    const response = await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activity_type: activityType,
        member_user_id: memberId,
        member_label: memberLabel,
        equipment_used: activityType === 'mailbox' ? 0 : Number(equipmentUsed || 0),
        proof_image_url: proofImageUrl || null,
        lines
      })
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setError(data.message ?? 'Validation activité impossible.');
      return;
    }

    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-3">
        {(Object.keys(ACTIVITY_META) as ActivityType[]).map((key) => (
          <button key={key} className={`glass-card p-4 text-left ${activityType === key ? 'border-[#f5d4ab]' : ''}`} onClick={() => setActivityType(key)}>
            <p className="text-2xl">{ACTIVITY_META[key].icon}</p>
            <p className="mt-1 text-base font-semibold text-[#fff1dd]">{ACTIVITY_META[key].label}</p>
            <p className="text-xs text-[#efcdab]">{ACTIVITY_META[key].subtitle}</p>
          </button>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="glass-card p-5" onPaste={(e) => void onPaste(e)}>
          <h3 className="text-base font-semibold text-[#fff1dd]">A. Session activité</h3>
          <label className="mt-3 block text-xs text-[#efccaa]">Membre</label>
          <select className="saas-input mt-1 w-full" value={memberId} onChange={(e) => { setMemberId(e.target.value); const m = members.find((entry) => entry.id === e.target.value); setMemberLabel(m ? (m.name || m.username) : 'Groupe'); }}>
            <option value="">Groupe</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name || member.username}</option>)}
          </select>

          {activityType !== 'mailbox' ? (
            <>
              <label className="mt-3 block text-xs text-[#efccaa]">{activityType === 'burglary' ? 'Kits pris' : 'Disqueuses prises'}</label>
              <input className="saas-input mt-1 w-full" value={equipmentUsed} onChange={(e) => setEquipmentUsed(e.target.value)} />
            </>
          ) : null}

          <div className="mt-3 rounded-xl border border-dashed border-[#f1cfaa]/60 bg-[#2e1d14]/40 p-3 text-sm text-[#f4d8b6]">
            <p>Preuve image (Ctrl+V ou fichier)</p>
            {uploading ? <p className="mt-1 text-xs">Upload en cours...</p> : null}
            {proofImageUrl ? <Image src={proofImageUrl} alt="Preuve" width={480} height={220} className="mt-2 h-36 w-full rounded-xl object-cover" unoptimized /> : null}
            <div className="mt-2 flex gap-2">
              <label className="saas-ghost-btn cursor-pointer">Choisir un fichier
                <input type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadImage(file); }} />
              </label>
              {proofImageUrl ? <button className="saas-ghost-btn" onClick={() => setProofImageUrl('')}>Supprimer image</button> : null}
            </div>
          </div>

          {error ? <p className="mt-3 text-sm text-red-100">{error}</p> : null}
        </section>

        <section className="space-y-4">
          <section className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd]">B. Items récupérés</h3>
            <input className="saas-input mt-2 w-full" placeholder="Rechercher item" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="mt-2 grid max-h-60 gap-2 overflow-auto sm:grid-cols-2">
              {availableItems.map((item) => (
                <button key={item.id} className="rounded-lg border border-white/10 bg-[#3f281b]/60 px-3 py-2 text-left" onClick={() => addItem(item.id)}>
                  <p className="text-sm font-medium text-[#ffe9cd]">{item.name}</p>
                  <p className="text-xs text-[#efcdab]">Stock actuel: {item.quantity}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd]">C. Récapitulatif</h3>
            <div className="mt-2 space-y-2">
              {lines.map((line, idx) => {
                const item = items.find((entry) => entry.id === line.item_id);
                if (!item) return null;
                return (
                  <div key={`${line.item_id}-${idx}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#3f281b]/55 px-3 py-2">
                    <div>
                      <p className="text-sm text-[#ffe9cd]">{item.name}</p>
                      <p className="text-xs text-[#efcdab]">Stock: {item.quantity} → {item.quantity + line.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="saas-ghost-btn !px-2" onClick={() => updateLine(idx, line.quantity - 1)}>-</button>
                      <input className="saas-input w-16 text-center" value={line.quantity} onChange={(e) => updateLine(idx, Number(e.target.value || 1))} />
                      <button className="saas-ghost-btn !px-2" onClick={() => updateLine(idx, line.quantity + 1)}>+</button>
                      <button className="saas-ghost-btn !px-2" onClick={() => removeLine(idx)}>🗑️</button>
                    </div>
                  </div>
                );
              })}
              {lines.length === 0 ? <p className="text-sm text-[#f1d0ab]">Aucun item ajouté.</p> : null}
            </div>

            {canCreate ? <button className="saas-primary-btn mt-4 w-full" onClick={() => void submit()}>Valider activité</button> : null}
          </section>
        </section>
      </section>

      <section className="glass-card p-5">
        <h3 className="text-base font-semibold text-[#fff1dd]">Activités récentes</h3>
        <div className="mt-2 space-y-2">
          {activities.map((activity) => (
            <article key={activity.id} className="rounded-xl border border-white/10 bg-[#4f3220]/55 p-3 text-sm text-[#f3d4b0]">
              <p className="font-medium">👤 {activity.member_label} — {ACTIVITY_META[activity.activity_type].label} — {new Date(activity.created_at).toLocaleString('fr-FR')}</p>
              {activity.equipment_item_name ? <p>🧰 {activity.equipment_item_name}: {activity.equipment_before} → {activity.equipment_after} (utilisé {activity.equipment_used})</p> : <p>🧰 Aucun équipement requis</p>}
              <div className="mt-1 text-xs text-[#f1cfaa]">{activity.activity_items.map((line) => `${line.item_name} ${line.before_quantity}→${line.after_quantity} (+${line.quantity_added})`).join(' · ')}</div>
              {activity.proof_image_url ? <Image src={activity.proof_image_url} alt="Preuve activité" width={420} height={180} className="mt-2 h-24 w-full rounded-lg object-cover" unoptimized /> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
