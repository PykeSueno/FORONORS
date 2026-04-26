'use client';

import Image from 'next/image';
import { FormEvent, useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';
import { isMoneyLinkedItemName, needsWeaponId } from '@/lib/items';
import { RemoveLineButton } from '@/components/shared/line-controls';

type Category = {
  key: string;
  label: string;
  types: readonly { key: string; label: string }[];
};

type Item = {
  id: number;
  name: string;
  image_url: string | null;
  buy_price: number;
  sell_price: number;
  quantity: number;
  weapon_identifier: string | null;
  is_money_item: boolean;
  category_key: string;
  category_label: string;
  type_key: string | null;
  type_label: string | null;
};

const EMPTY_FORM = {
  name: '',
  image_url: '',
  buy_price: '0',
  sell_price: '0',
  quantity: '0',
  category_key: 'objects',
  type_key: '',
  weapon_identifier: '',
};

export function ItemsPageClient({
  initialItems,
  categories,
  canCreate,
  canEdit,
  canDelete
}: {
  initialItems: Item[];
  categories: readonly Category[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteFlow, setDeleteFlow] = useState<{ item: Item; step: 1 | 2 } | null>(null);
  const [error, setError] = useState('');

  const availableTypes = categories.find((category) => category.key === categoryFilter)?.types ?? [];

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const qOk = !query || item.name.toLowerCase().includes(query.toLowerCase());
      const categoryOk = !categoryFilter || item.category_key === categoryFilter;
      const typeOk = !typeFilter || item.type_key === typeFilter;
      return qOk && categoryOk && typeOk;
    });
  }, [items, query, categoryFilter, typeFilter]);

  async function refresh() {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (categoryFilter) params.set('category', categoryFilter);
    if (typeFilter) params.set('type', typeFilter);

    const response = await fetch(`/api/items?${params.toString()}`);
    if (!response.ok) {
      setError('Chargement des items impossible.');
      return;
    }

    const data = (await response.json()) as { items: Item[] };
    setItems(data.items);
  }

  async function removeItem(itemId: number) {
    const response = await fetch(`/api/items/${itemId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm_delete: true })
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      setError(data.message ?? 'Suppression impossible.');
      return;
    }
    setDeleteFlow(null);
    await refresh();
  }

  return (
    <div className="space-y-5">
      <section className="glass-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-[#fff1dd]">Items</h1>
          {canCreate ? <button className="saas-primary-btn" onClick={() => setCreating(true)}>Créer un item</button> : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <input className="saas-input w-full" placeholder="Rechercher un item" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="saas-ghost-btn" onClick={() => void refresh()}>Appliquer</button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className={`filter-pill ${!categoryFilter ? 'filter-pill-active' : ''}`} onClick={() => { setCategoryFilter(''); setTypeFilter(''); }}>
            Tous
          </button>
          {categories.map((category) => (
            <button
              key={category.key}
              className={`filter-pill ${categoryFilter === category.key ? 'filter-pill-active' : ''}`}
              onClick={() => {
                setCategoryFilter(category.key);
                setTypeFilter('');
              }}
            >
              {category.label}
            </button>
          ))}
        </div>

        {availableTypes.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={`filter-pill ${!typeFilter ? 'filter-pill-active' : ''}`} onClick={() => setTypeFilter('')}>Tous les types</button>
            {availableTypes.map((type) => (
              <button key={type.key} className={`filter-pill ${typeFilter === type.key ? 'filter-pill-active' : ''}`} onClick={() => setTypeFilter(type.key)}>
                {type.label}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      <section className="space-y-2">
        {filteredItems.map((item) => (
          <article key={item.id} className="glass-card border-l-4 border-l-[#f1c792] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-16 w-16 overflow-hidden rounded-lg border border-white/10 bg-[#2a1a12]/45">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} width={96} height={96} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-[#f0d0ab]">🖼️</div>
                )}
              </div>

              <div className="min-w-[180px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-[#fff1db]">{item.name}</p>
                  <span className="rounded-full bg-[#3f281b]/70 px-2 py-0.5 text-xs text-[#f8d9b8]">{item.category_label}</span>
                  {item.type_label ? <span className="rounded-full bg-[#3f281b]/50 px-2 py-0.5 text-xs text-[#f8d9b8]">{item.type_label}</span> : null}
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {item.is_money_item ? null : (
                    <>
                      <div className="rounded-lg border border-white/10 bg-[#2f1f15]/60 px-3 py-2">
                        <p className="text-[11px] text-[#efccaa]">📥 Achat</p>
                        <p className="text-base font-semibold text-[#ffe8c9]">{formatUsd(Number(item.buy_price))}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-[#2f1f15]/60 px-3 py-2">
                        <p className="text-[11px] text-[#efccaa]">💸 Vente</p>
                        <p className="text-base font-semibold text-[#ffe8c9]">{formatUsd(Number(item.sell_price))}</p>
                      </div>
                    </>
                  )}
                  <div className="rounded-lg border border-white/10 bg-[#2f1f15]/60 px-3 py-2">
                    <p className="text-[11px] text-[#efccaa]">📦 Stock</p>
                    <p className="text-xl font-bold text-[#fff3df]">{item.quantity}</p>
                  </div>
                </div>
                {item.weapon_identifier ? <p className="text-xs text-[#fce7ce]">ID arme: {item.weapon_identifier}</p> : null}
              </div>

              {(canEdit || canDelete) ? (
                <div className="flex gap-2">
                  {canEdit ? <button className="saas-ghost-btn" onClick={() => setEditing(item)}>Modifier</button> : null}
                  {canDelete ? (
                    <div className="flex items-center">
                      <RemoveLineButton onClick={() => setDeleteFlow({ item, step: 1 })} title="Supprimer l’item" />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      {creating ? (
        <ItemModal
          title="Créer un item"
          categories={categories}
          onClose={() => setCreating(false)}
          onSubmit={async (payload) => {
            const response = await fetch('/api/items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!response.ok) {
              const data = (await response.json()) as { message?: string };
              setError(data.message ?? 'Création impossible.');
              return false;
            }
            setCreating(false);
            await refresh();
            return true;
          }}
        />
      ) : null}

      {editing ? (
        <ItemModal
          title="Modifier item"
          initial={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            const response = await fetch(`/api/items/${editing.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!response.ok) {
              const data = (await response.json()) as { message?: string };
              setError(data.message ?? 'Modification impossible.');
              return false;
            }
            setEditing(null);
            await refresh();
            return true;
          }}
        />
      ) : null}

      {deleteFlow ? (
        <DeleteItemConfirmModal
          item={deleteFlow.item}
          step={deleteFlow.step}
          onClose={() => setDeleteFlow(null)}
          onNext={() => setDeleteFlow((current) => (current ? { ...current, step: 2 } : current))}
          onConfirm={() => void removeItem(deleteFlow.item.id)}
        />
      ) : null}
    </div>
  );
}

function DeleteItemConfirmModal({
  item,
  step,
  onClose,
  onNext,
  onConfirm
}: {
  item: Item;
  step: 1 | 2;
  onClose: () => void;
  onNext: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card w-full max-w-md space-y-4 p-5" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-lg font-semibold text-[#fff1dd]">Suppression item</h3>
        {step === 1 ? (
          <p className="text-sm text-[#f1d2ad]">Tu es sûr de vouloir supprimer cet item : <span className="font-semibold text-[#ffe8ca]">{item.name}</span> ?</p>
        ) : (
          <p className="text-sm text-[#f1d2ad]">Confirmation finale : cette suppression retirera l’item du catalogue. Continuer ?</p>
        )}
        <div className="flex justify-end gap-2">
          <button className="saas-ghost-btn" onClick={onClose}>Annuler</button>
          {step === 1 ? (
            <button className="saas-primary-btn" onClick={onNext} autoFocus>Continuer</button>
          ) : (
            <button className="rounded-full border border-red-300/40 bg-red-600/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600" onClick={onConfirm} autoFocus>
              Confirmer la suppression
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemModal({
  title,
  initial,
  categories,
  onClose,
  onSubmit
}: {
  title: string;
  initial?: Item;
  categories: readonly Category[];
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(initial
      ? {
          name: initial.name,
          image_url: initial.image_url ?? '',
          buy_price: String(initial.buy_price),
          sell_price: String(initial.sell_price),
          quantity: String(initial.quantity),
          category_key: initial.category_key,
          type_key: initial.type_key ?? '',
          weapon_identifier: initial.weapon_identifier ?? '',
        }
      : {})
  });
  const [uploading, setUploading] = useState(false);
  const category = categories.find((item) => item.key === form.category_key) ?? categories[0];
  const isMoneyItemDraft = isMoneyLinkedItemName(form.name || '');

  function step(field: 'buy_price' | 'sell_price' | 'quantity', delta: number) {
    const current = Number(form[field] || '0');
    const next = Math.max(0, current + delta);
    setForm((state) => ({ ...state, [field]: String(next) }));
  }

  async function uploadImage(file: File) {
    setUploading(true);
    const body = new FormData();
    body.append('file', file);
    const response = await fetch('/api/items/upload-image', { method: 'POST', body });
    setUploading(false);

    if (!response.ok) return;
    const data = (await response.json()) as { url: string };
    setForm((current) => ({ ...current, image_url: data.url }));
  }

  async function onPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(event.clipboardData.items).find((clipboardItem) => clipboardItem.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    event.preventDefault();
    await uploadImage(file);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const type = category.types.find((entry) => entry.key === form.type_key) ?? null;
    await onSubmit({
      name: form.name,
      image_url: form.image_url || null,
      buy_price: Number(form.buy_price),
      sell_price: Number(form.sell_price),
      quantity: Number(form.quantity),
      category_key: category.key,
      category_label: category.label,
      type_key: type?.key ?? null,
      type_label: type?.label ?? null,
      weapon_identifier: form.weapon_identifier || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="glass-card w-full max-w-xl p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-[#fff1dc]">{title}</h3>
          <button className="saas-ghost-btn" onClick={onClose}>Fermer</button>
        </div>

        <form className="space-y-3" onSubmit={save}>
          <label className="block text-xs text-[#efccaa]">Nom</label>
          <input className="saas-input w-full" placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

          <div onPaste={(e) => void onPaste(e)} className="rounded-xl border border-dashed border-[#f1cfaa]/60 bg-[#2e1d14]/40 p-3 text-sm text-[#f4d8b6]">
            <p>Image (Ctrl+V pour coller)</p>
            {uploading ? <p className="mt-1 text-xs">Upload en cours...</p> : null}
            {form.image_url ? (
              <div className="mt-2 space-y-2">
                <Image src={form.image_url} alt="Preview" width={640} height={256} className="h-32 w-full rounded-xl object-cover" unoptimized />
                <div className="flex gap-2">
                  <label className="saas-ghost-btn cursor-pointer">Remplacer
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadImage(file); }} />
                  </label>
                  <RemoveLineButton onClick={() => setForm({ ...form, image_url: '' })} title="Supprimer l’image" />
                </div>
              </div>
            ) : (
              <label className="mt-2 inline-block cursor-pointer rounded-xl border border-white/25 px-3 py-2">Choisir un fichier
                <input type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadImage(file); }} />
              </label>
            )}
          </div>

          {!isMoneyItemDraft ? (
            <>
              <NumberField label="Prix achat" value={form.buy_price} onChange={(value) => setForm({ ...form, buy_price: value })} onMinus={() => step('buy_price', -1)} onPlus={() => step('buy_price', 1)} />
              <NumberField label="Prix vente" value={form.sell_price} onChange={(value) => setForm({ ...form, sell_price: value })} onMinus={() => step('sell_price', -1)} onPlus={() => step('sell_price', 1)} />
            </>
          ) : (
            <p className="rounded-xl border border-white/10 bg-[#2f1f15]/60 px-3 py-2 text-xs text-[#efcdab]">Item Argent détecté : prix achat/vente désactivés, la quantité représente directement le montant.</p>
          )}
          <NumberField label="Quantité" value={form.quantity} onChange={(value) => setForm({ ...form, quantity: value })} onMinus={() => step('quantity', -1)} onPlus={() => step('quantity', 1)} />

          <label className="block text-xs text-[#efccaa]">Catégorie</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((entry) => (
              <button key={entry.key} type="button" className={`filter-pill ${form.category_key === entry.key ? 'filter-pill-active' : ''}`} onClick={() => setForm({ ...form, category_key: entry.key, type_key: '', weapon_identifier: '' })}>
                {entry.label}
              </button>
            ))}
          </div>

          {category.types.length > 0 ? (
            <>
              <label className="block text-xs text-[#efccaa]">Type</label>
              <div className="flex flex-wrap gap-2">
                {category.types.map((entry) => (
                  <button key={entry.key} type="button" className={`filter-pill ${form.type_key === entry.key ? 'filter-pill-active' : ''}`} onClick={() => setForm({ ...form, type_key: entry.key })}>
                    {entry.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {needsWeaponId(form.category_key, form.type_key || null) ? (
            <>
              <label className="block text-xs text-[#efccaa]">ID arme</label>
              <input className="saas-input w-full" placeholder="ID arme" value={form.weapon_identifier} onChange={(e) => setForm({ ...form, weapon_identifier: e.target.value })} required />
            </>
          ) : null}

          <div className="flex justify-end gap-2">
            <button type="button" className="saas-ghost-btn" onClick={onClose}>Annuler</button>
            <button type="submit" className="saas-primary-btn">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, onMinus, onPlus }: { label: string; value: string; onChange: (value: string) => void; onMinus: () => void; onPlus: () => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-[#efccaa]">{label}</label>
      <div className="flex items-center gap-2">
        <button type="button" className="saas-ghost-btn" onClick={onMinus}>-</button>
        <input className="saas-input w-full" value={value} onChange={(e) => onChange(e.target.value)} required />
        <button type="button" className="saas-ghost-btn" onClick={onPlus}>+</button>
      </div>
    </div>
  );
}
