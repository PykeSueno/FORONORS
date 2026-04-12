'use client';

import { FormEvent, useMemo, useState } from 'react';
import { needsWeaponId } from '@/lib/items';

type Category = {
  key: string;
  label: string;
  types: Array<{ key: string; label: string }>;
};

type Item = {
  id: number;
  name: string;
  image_url: string | null;
  buy_price: number;
  sell_price: number;
  quantity: number;
  weapon_identifier: string | null;
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
  weapon_identifier: ''
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
  const [error, setError] = useState('');

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
    const response = await fetch(`/api/items/${itemId}`, { method: 'DELETE' });
    if (!response.ok) {
      setError('Suppression impossible.');
      return;
    }
    await refresh();
  }

  return (
    <div className="space-y-5">
      <section className="glass-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-[#fff1dd]">Items</h1>
          {canCreate ? <button className="saas-primary-btn" onClick={() => setCreating(true)}>Créer un item</button> : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input className="saas-input w-full" placeholder="Rechercher un item" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="saas-input w-full" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setTypeFilter(''); }}>
            <option value="">Toutes les catégories</option>
            {categories.map((category) => (
              <option key={category.key} value={category.key}>{category.label}</option>
            ))}
          </select>
          <select className="saas-input w-full" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Tous les types</option>
            {categories
              .find((category) => category.key === categoryFilter)
              ?.types.map((type) => (
                <option key={type.key} value={type.key}>{type.label}</option>
              ))}
          </select>
        </div>

        <div className="mt-3">
          <button className="saas-ghost-btn" onClick={() => void refresh()}>Appliquer les filtres</button>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((item) => (
          <article key={item.id} className="glass-card overflow-hidden p-4">
            <div className="mb-3 h-36 rounded-xl border border-white/10 bg-[#2a1a12]/45">
              {item.image_url ? <img src={item.image_url} alt={item.name} className="h-full w-full rounded-xl object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-[#f0d0ab]">Aucune image</div>}
            </div>
            <p className="text-lg font-semibold text-[#fff1db]">{item.name}</p>
            <p className="text-sm text-[#f8d9b8]">{item.category_label}{item.type_label ? ` · ${item.type_label}` : ''}</p>
            <p className="mt-2 text-sm text-[#fce7ce]">Achat: {Number(item.buy_price).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p>
            <p className="text-sm text-[#fce7ce]">Vente: {Number(item.sell_price).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p>
            <p className="text-sm text-[#fce7ce]">Quantité: {item.quantity}</p>
            {item.weapon_identifier ? <p className="text-sm text-[#fce7ce]">ID arme: {item.weapon_identifier}</p> : null}

            {(canEdit || canDelete) ? (
              <div className="mt-3 flex gap-2">
                {canEdit ? <button className="saas-ghost-btn" onClick={() => setEditing(item)}>Modifier</button> : null}
                {canDelete ? <button className="saas-ghost-btn" onClick={() => void removeItem(item.id)}>Supprimer</button> : null}
              </div>
            ) : null}
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
          weapon_identifier: initial.weapon_identifier ?? ''
        }
      : {})
  });
  const [uploading, setUploading] = useState(false);
  const category = categories.find((item) => item.key === form.category_key) ?? categories[0];

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
      weapon_identifier: form.weapon_identifier || null
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
          <input className="saas-input w-full" placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

          <div onPaste={(e) => void onPaste(e)} className="rounded-xl border border-dashed border-[#f1cfaa]/60 bg-[#2e1d14]/40 p-3 text-sm text-[#f4d8b6]">
            <p>Collez une image avec Ctrl+V dans cette zone.</p>
            {uploading ? <p className="mt-1 text-xs">Upload en cours...</p> : null}
            {form.image_url ? (
              <div className="mt-2 space-y-2">
                <img src={form.image_url} alt="Preview" className="h-32 w-full rounded-xl object-cover" />
                <div className="flex gap-2">
                  <label className="saas-ghost-btn cursor-pointer">
                    Remplacer
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadImage(file);
                      }}
                    />
                  </label>
                  <button type="button" className="saas-ghost-btn" onClick={() => setForm({ ...form, image_url: '' })}>Supprimer image</button>
                </div>
              </div>
            ) : (
              <label className="mt-2 inline-block cursor-pointer rounded-xl border border-white/25 px-3 py-2">
                Choisir un fichier
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadImage(file);
                  }}
                />
              </label>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input className="saas-input w-full" placeholder="Prix achat" value={form.buy_price} onChange={(e) => setForm({ ...form, buy_price: e.target.value })} required />
            <input className="saas-input w-full" placeholder="Prix vente" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} required />
          </div>

          <input className="saas-input w-full" placeholder="Quantité" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />

          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="saas-input w-full"
              value={form.category_key}
              onChange={(e) => setForm({ ...form, category_key: e.target.value, type_key: '', weapon_identifier: '' })}
            >
              {categories.map((entry) => (
                <option key={entry.key} value={entry.key}>{entry.label}</option>
              ))}
            </select>

            <select className="saas-input w-full" value={form.type_key} onChange={(e) => setForm({ ...form, type_key: e.target.value })}>
              <option value="">Aucun type</option>
              {category.types.map((entry) => (
                <option key={entry.key} value={entry.key}>{entry.label}</option>
              ))}
            </select>
          </div>

          {needsWeaponId(form.category_key, form.type_key || null) ? (
            <input className="saas-input w-full" placeholder="ID arme" value={form.weapon_identifier} onChange={(e) => setForm({ ...form, weapon_identifier: e.target.value })} required />
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
