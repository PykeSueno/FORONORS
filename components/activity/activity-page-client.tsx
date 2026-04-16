'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

type ActivityType = 'mailbox' | 'burglary' | 'container';
type ActivityDisplayType = ActivityType | 'drug_sale';
type Item = { id: number; name: string; image_url: string | null; quantity: number; category_key: string; type_key: string | null };
type RecentActivity = {
  id: number;
  activity_type: ActivityDisplayType;
  member_user_id: string | null;
  member_label: string;
  proof_image_url: string | null;
  equipment_item_name: string | null;
  equipment_used: number;
  equipment_before: number;
  equipment_after: number;
  created_at: string;
  activity_items: Array<{
    item_id?: number | null;
    item_name: string;
    quantity_added: number;
    before_quantity: number;
    after_quantity: number;
    item_image_url?: string | null;
  }>;
  activity_members?: Array<{ member_user_id: string | null; member_label: string }>;
};

type Line = { item_id: number; quantity: number };


const TYPE_LABELS: Record<string, string> = {
  weapons: 'Armes',
  ammo: 'Munitions',
  other: 'Autres',
  seeds: 'Graines',
  equipment: 'Équipement',
  bag: 'Pochon',
  production: 'Production'
};

const ACTIVITY_META: Record<ActivityDisplayType, { label: string; icon: string; subtitle: string }> = {
  mailbox: { label: 'Boîte aux lettres', icon: '📬', subtitle: 'Aucun équipement requis' },
  burglary: { label: 'Cambriolage', icon: '🏠', subtitle: 'Consomme des Kits' },
  container: { label: 'Conteneur', icon: '📦', subtitle: 'Consomme des Disqueuses' },
  drug_sale: { label: 'Vente drogue', icon: '🧪', subtitle: 'Session de vente validée' }
};

const CREATE_ACTIVITY_TYPES: ActivityType[] = ['mailbox', 'burglary', 'container'];

export function ActivityPageClient({ items, members, activities, defaultMemberId, defaultMemberLabel, canCreate, canViewRecent, canManageOwn, canManageAny, currentUserId }: { items: Item[]; members: Array<{ id: string; name: string; username: string }>; activities: RecentActivity[]; defaultMemberId: string; defaultMemberLabel: string; canCreate: boolean; canViewRecent: boolean; canManageOwn: boolean; canManageAny: boolean; currentUserId: string }) {
  const [activityType, setActivityType] = useState<ActivityType>('mailbox');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(defaultMemberId ? [defaultMemberId] : []);
  const [memberLabel, setMemberLabel] = useState(defaultMemberLabel || 'Groupe');
  const [equipmentUsed, setEquipmentUsed] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [proofImageUrl, setProofImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [editingActivity, setEditingActivity] = useState<RecentActivity | null>(null);

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const availableTypes = useMemo(() => Array.from(new Set(items.filter((item) => !categoryFilter || item.category_key === categoryFilter).map((item) => item.type_key).filter(Boolean))) as string[], [items, categoryFilter]);
  const availableItems = useMemo(() => items.filter((item) => {
    const qOk = item.name.toLowerCase().includes(query.toLowerCase());
    const categoryOk = !categoryFilter || item.category_key === categoryFilter;
    const typeOk = !typeFilter || item.type_key === typeFilter;
    return qOk && categoryOk && typeOk;
  }), [items, query, categoryFilter, typeFilter]);
  const kitItem = useMemo(() => items.find((item) => item.name.toLowerCase().includes('kit')), [items]);
  const cutterItem = useMemo(() => items.find((item) => item.name.toLowerCase().includes('disqueuse')), [items]);

  function setType(type: ActivityType) {
    setActivityType(type);
    setError('');
    if (type === 'mailbox') setEquipmentUsed(0);
  }

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

  function stepEquipment(delta: number) {
    setError('');
    setEquipmentUsed((current) => Math.max(0, current + delta));
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

  async function onPaste(event: React.ClipboardEvent<HTMLElement>) {
    const item = Array.from(event.clipboardData.items).find((entry) => entry.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    event.preventDefault();
    await uploadImage(file);
  }

  async function submit() {
    if (activityType !== 'mailbox' && equipmentUsed <= 0) {
      setError(activityType === 'burglary' ? 'Pour un cambriolage, indique le nombre de Kits pris.' : 'Pour un conteneur, indique le nombre de Disqueuses prises.');
      return;
    }

    const selectedMembers = members.filter((entry) => selectedMemberIds.includes(entry.id));
    const memberLabels = selectedMembers.map((entry) => entry.name || entry.username);
    const mergedLabel = memberLabels.length > 0 ? memberLabels.join(' + ') : 'Groupe';

    const response = await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activity_type: activityType,
        member_user_id: selectedMemberIds[0] || null,
        member_user_ids: selectedMemberIds,
        member_labels: memberLabels,
        member_label: mergedLabel,
        equipment_used: activityType === 'mailbox' ? 0 : equipmentUsed,
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
        {CREATE_ACTIVITY_TYPES.map((key) => (
          <button key={key} className={`glass-card p-4 text-left ${activityType === key ? 'activity-card-active' : ''}`} onClick={() => setType(key)}>
            <p className="text-2xl">{ACTIVITY_META[key].icon}</p>
            <p className="mt-1 text-base font-semibold text-[#fff1dd]">{ACTIVITY_META[key].label}</p>
            <p className="text-xs text-[#efcdab]">{ACTIVITY_META[key].subtitle}</p>
          </button>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.05fr]">
        <section className="space-y-4">
          <section className="glass-card p-5" onPaste={(e) => void onPaste(e)}>
            <h3 className="text-base font-semibold text-[#fff1dd]">A. Session activité</h3>
          <label className="mt-3 block text-xs text-[#efccaa]">Membre</label>
          <div className="mt-1 rounded-xl border border-white/10 bg-[#2f1d14]/45 p-2">
            <button className={`filter-pill ${selectedMemberIds.length === 0 ? 'filter-pill-active' : ''}`} onClick={() => { setSelectedMemberIds([]); setMemberLabel('Groupe'); }}>Groupe</button>
            <div className="mt-2 flex flex-wrap gap-2">
              {members.map((member) => {
                const selected = selectedMemberIds.includes(member.id);
                return (
                  <button
                    key={member.id}
                    className={`filter-pill ${selected ? 'filter-pill-active' : ''}`}
                    onClick={() => {
                      setSelectedMemberIds((current) => {
                        const exists = current.includes(member.id);
                        const next = exists ? current.filter((id) => id !== member.id) : [...current, member.id];
                        const labels = members.filter((entry) => next.includes(entry.id)).map((entry) => entry.name || entry.username);
                        setMemberLabel(labels.length > 0 ? labels.join(' + ') : 'Groupe');
                        return next;
                      });
                    }}
                  >
                    {member.name || member.username}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-[#efcdab]">Sélection: {memberLabel || 'Groupe'}</p>
          </div>

          {activityType !== 'mailbox' ? (
            <>
              <label className="mt-3 block text-xs text-[#efccaa]">{activityType === 'burglary' ? 'Kits pris' : 'Disqueuses prises'}</label>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-10 w-10 overflow-hidden rounded-lg bg-[#22140e]">
                  {(activityType === 'burglary' ? kitItem?.image_url : cutterItem?.image_url) ? (
                    <Image src={(activityType === 'burglary' ? kitItem?.image_url : cutterItem?.image_url) as string} alt="Équipement" width={40} height={40} className="h-full w-full object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[#f0d0ab]">🧰</div>
                  )}
                </div>
                <button className="saas-ghost-btn !px-3" onClick={() => stepEquipment(-1)}>-</button>
                <input className="saas-input w-20 text-center" value={equipmentUsed} onChange={(e) => setEquipmentUsed(Math.max(0, Number(e.target.value || 0)))} inputMode="numeric" />
                <button className="saas-ghost-btn !px-3" onClick={() => stepEquipment(1)}>+</button>
              </div>
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

          <section className="glass-card p-5">
            <h3 className="text-base font-semibold text-[#fff1dd]">B. Items récupérés</h3>
            <input className="saas-input mt-2 w-full" placeholder="Rechercher item" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={`filter-pill ${!categoryFilter ? 'filter-pill-active' : ''}`} onClick={() => { setCategoryFilter(''); setTypeFilter(''); }}>Tous</button>
              {[['objects', 'Objets'], ['weapons', 'Armes'], ['equipment', 'Équipement'], ['drugs', 'Drogues'], ['other', 'Autres']].map(([key, label]) => (
                <button key={key} className={`filter-pill ${categoryFilter === key ? 'filter-pill-active' : ''}`} onClick={() => { setCategoryFilter(key); setTypeFilter(''); }}>{label}</button>
              ))}
            </div>
            {availableTypes.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button className={`filter-pill ${!typeFilter ? 'filter-pill-active' : ''}`} onClick={() => setTypeFilter('')}>Tous types</button>
                {availableTypes.map((type) => <button key={type} className={`filter-pill ${typeFilter === type ? 'filter-pill-active' : ''}`} onClick={() => setTypeFilter(type)}>{TYPE_LABELS[type] ?? type}</button>)}
              </div>
            ) : null}
            <div className="mt-2 grid max-h-60 gap-2 overflow-auto sm:grid-cols-2">
              {availableItems.map((item) => (
                <button key={item.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#3f281b]/60 px-3 py-2 text-left" onClick={() => addItem(item.id)}>
                  <div className="h-10 w-10 overflow-hidden rounded-lg bg-[#22140e]">
                    {item.image_url ? <Image src={item.image_url} alt={item.name} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs text-[#f0d0ab]">🖼️</div>}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#ffe9cd]">{item.name}</p>
                    <p className="text-xs text-[#efcdab]">Stock actuel: {item.quantity}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </section>

        <section className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">C. Récapitulatif</h3>
          <div className="mt-2 space-y-2">
            {lines.map((line, idx) => {
              const item = itemMap.get(line.item_id);
              if (!item) return null;
              return (
                <div key={`${line.item_id}-${idx}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#3f281b]/55 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 overflow-hidden rounded-lg bg-[#22140e]">
                      {item.image_url ? <Image src={item.image_url} alt={item.name} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs text-[#f0d0ab]">🖼️</div>}
                    </div>
                    <div>
                      <p className="text-sm text-[#ffe9cd]">{item.name}</p>
                      <p className="text-xs text-[#efcdab]">Qté: +{line.quantity} · Avant/Après: {item.quantity} → {item.quantity + line.quantity}</p>
                    </div>
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

      {canViewRecent ? <section className="glass-card p-5">
        <h3 className="text-base font-semibold text-[#fff1dd]">Activités récentes</h3>
        <div className="mt-2 space-y-2">
          {activities.map((activity) => (
            <article key={activity.id} className="rounded-xl border border-white/10 bg-[#4f3220]/55 p-3 text-sm text-[#f3d4b0]">
              <p className="font-medium">👤 {(activity.activity_members ?? []).length > 0 ? activity.activity_members?.map((entry) => entry.member_label).join(' + ') : activity.member_label} — {ACTIVITY_META[activity.activity_type].label} — {new Date(activity.created_at).toLocaleString('fr-FR')}</p>
              {activity.equipment_item_name ? <p>🧰 {activity.equipment_item_name}: {activity.equipment_before} → {activity.equipment_after} (utilisé {activity.equipment_used})</p> : <p>🧰 Aucun équipement requis</p>}
              <div className="mt-2 space-y-1 text-xs text-[#f1cfaa]">
                {activity.activity_items.map((line, index) => (
                  <div key={`${activity.id}-${index}`} className="flex items-center gap-2">
                    <div className="h-8 w-8 overflow-hidden rounded-md bg-[#22140e]">
                      {line.item_image_url ? <Image src={line.item_image_url} alt={line.item_name} width={32} height={32} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-[10px] text-[#f0d0ab]">🖼️</div>}
                    </div>
                    <p>{line.item_name} {line.before_quantity}→{line.after_quantity} (+{line.quantity_added})</p>
                  </div>
                ))}
              </div>
              {activity.proof_image_url ? <Image src={activity.proof_image_url} alt="Preuve activité" width={420} height={180} className="mt-2 h-24 w-full rounded-lg object-cover" unoptimized /> : null}
              {(() => {
                const canManageThis = canManageAny || (canManageOwn && activity.member_user_id === currentUserId);
                if (!canManageThis) return null;

                return (
                  <div className="mt-2 flex justify-end gap-2">
                    <button className="saas-ghost-btn" onClick={() => setEditingActivity(activity)}>Modifier</button>
                    <button className="saas-ghost-btn" onClick={() => { void fetch(`/api/activity/${activity.id}`, { method: 'DELETE' }).then(() => window.location.reload()); }}>Annuler</button>
                  </div>
                );
              })()}
            </article>
          ))}
        </div>
      </section> : null}

      {editingActivity ? <EditActivityModal activity={editingActivity} onClose={() => setEditingActivity(null)} /> : null}
    </div>
  );
}

function EditActivityModal({ activity, onClose }: { activity: RecentActivity; onClose: () => void }) {
  const [memberLabel, setMemberLabel] = useState(activity.member_label);
  const [equipmentUsed, setEquipmentUsed] = useState(activity.equipment_used);
  const [lines, setLines] = useState(activity.activity_items.map((line) => ({ item_id: Number(line.item_id ?? 0), quantity: line.quantity_added, item_name: line.item_name })));


  async function save() {
    const response = await fetch(`/api/activity/${activity.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_label: memberLabel,
        equipment_used: equipmentUsed,
        lines: lines.filter((line) => line.item_id > 0).map((line) => ({ item_id: line.item_id, quantity: line.quantity }))
      })
    });
    if (response.ok) window.location.reload();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="glass-card w-full max-w-xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-[#fff0db]">Modifier activité #{activity.id}</h3>
          <button className="saas-ghost-btn" onClick={onClose}>Fermer</button>
        </div>
        <div className="space-y-2">
          <input className="saas-input w-full" value={memberLabel} onChange={(e) => setMemberLabel(e.target.value)} />
          <input className="saas-input w-full" value={equipmentUsed} onChange={(e) => setEquipmentUsed(Math.max(0, Number(e.target.value || 0)))} />
          <div className="rounded-lg border border-white/10 bg-[#4f3220]/45 p-2 text-xs text-[#efcdab]">
            {lines.map((line, index) => (
              <div key={index} className="flex items-center justify-between gap-2">
                <span>{line.item_name}</span>
                <input className="saas-input w-20" value={line.quantity} onChange={(e) => setLines((current) => current.map((entry, i) => i === index ? { ...entry, quantity: Math.max(1, Number(e.target.value || 1)) } : entry))} />
              </div>
            ))}
          </div>
          <button className="saas-primary-btn w-full" onClick={() => void save()}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
