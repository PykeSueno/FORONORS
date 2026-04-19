'use client';

import { useMemo, useState } from 'react';

function humanAction(action: string) {
  if (action === 'money.edit') return "Ajustement d’argent";
  if (action.includes('stock_in')) return 'Entrée stock';
  if (action.includes('stock_out')) return 'Sortie stock';
  return action;
}

type LogEntry = {
  id: number;
  actor_name: string;
  actor_username: string;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  new_values?: Record<string, unknown> | null;
  created_at: string;
};

function inferModule(log: LogEntry) {
  const blob = `${log.action} ${log.entity_type} ${log.summary}`.toLowerCase();
  if (blob.includes('money') || blob.includes('cash')) return 'Argent';
  if (blob.includes('transaction')) return 'Transactions';
  if (blob.includes('sale.objects') || blob.includes('vente objets')) return 'Vente objets';
  if (blob.includes('tablet') || blob.includes('tablette')) return 'Tablette';
  if (blob.includes('activity') || blob.includes('activit')) return 'Activité';
  if (blob.includes('four')) return 'FOUR';
  if (blob.includes('drug') || blob.includes('drogue')) return 'Drogues';
  if (blob.includes('member') || blob.includes('membre')) return 'Membres';
  if (blob.includes('permission') || blob.includes('role')) return 'Permissions';
  return 'Autres';
}

function inferItemCategory(log: LogEntry) {
  const blob = `${log.summary} ${JSON.stringify(log.new_values ?? {})}`.toLowerCase();
  if (blob.includes('category_key":"objects') || blob.includes('objet')) return 'Objets';
  if (blob.includes('category_key":"weapons') || blob.includes('arme')) return 'Armes';
  if (blob.includes('category_key":"equipment') || blob.includes('équipement') || blob.includes('equip')) return 'Équipement';
  if (blob.includes('category_key":"drugs') || blob.includes('drogue')) return 'Drogues';
  if (blob.includes('category_key":"other') || blob.includes('autre')) return 'Autres';
  return '';
}

export function LogsPageClient({
  initialLogs,
  initialWebhookUrl,
  canManageWebhook
}: {
  initialLogs: LogEntry[];
  initialWebhookUrl: string;
  canManageWebhook: boolean;
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [itemCategoryFilter, setItemCategoryFilter] = useState('');
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl);
  const [error, setError] = useState('');

  const actionOptions = useMemo(() => Array.from(new Set(logs.map((log) => log.action))), [logs]);
  const entityOptions = useMemo(() => Array.from(new Set(logs.map((log) => log.entity_type))), [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = query.toLowerCase();
      const qOk = !q || [log.actor_name, log.actor_username, log.summary, log.action].join(' ').toLowerCase().includes(q);
      const actionOk = !actionFilter || log.action === actionFilter;
      const entityOk = !entityFilter || log.entity_type === entityFilter;
      const moduleOk = !moduleFilter || inferModule(log) === moduleFilter;
      const categoryValue = inferItemCategory(log);
      const categoryOk = !itemCategoryFilter || categoryValue === itemCategoryFilter;
      return qOk && actionOk && entityOk && moduleOk && categoryOk;
    });
  }, [logs, query, actionFilter, entityFilter, moduleFilter, itemCategoryFilter]);

  async function refresh() {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (actionFilter) params.set('action', actionFilter);
    if (entityFilter) params.set('entity_type', entityFilter);

    const response = await fetch(`/api/logs?${params.toString()}`);
    if (!response.ok) {
      setError('Chargement logs impossible.');
      return;
    }

    const data = (await response.json()) as { logs: LogEntry[] };
    setLogs(data.logs);
  }

  async function saveWebhook() {
    const response = await fetch('/api/logs/webhook', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl })
    });
    if (!response.ok) {
      setError('Mise à jour webhook impossible.');
      return;
    }
    setError('');
  }

  return (
    <div className="space-y-5">
      <section className="glass-card p-6">
        <h1 className="text-2xl font-semibold text-[#fff1dc]">Logs</h1>
        <p className="mt-1 text-sm text-[#f6d7b5]">Suivi des actions du site et webhook Discord.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input className="saas-input w-full" placeholder="Rechercher" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="saas-input w-full" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">Toutes les actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          <select className="saas-input w-full" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
            <option value="">Tous les modules</option>
            {entityOptions.map((entity) => (
              <option key={entity} value={entity}>{entity}</option>
            ))}
          </select>
          <button className="saas-primary-btn" onClick={() => void refresh()}>Filtrer</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {['', 'Objets', 'Armes', 'Équipement', 'Drogues', 'Autres'].map((entry) => (
            <button key={entry || 'all'} type="button" className={`filter-pill ${itemCategoryFilter === entry ? 'filter-pill-active' : ''}`} onClick={() => setItemCategoryFilter(entry)}>
              {entry || 'Tous items'}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {['', 'Argent', 'Transactions', 'Vente objets', 'Tablette', 'Activité', 'FOUR', 'Drogues', 'Membres', 'Permissions'].map((entry) => (
            <button key={entry || 'all-modules'} type="button" className={`filter-pill ${moduleFilter === entry ? 'filter-pill-active' : ''}`} onClick={() => setModuleFilter(entry)}>
              {entry || 'Tous modules'}
            </button>
          ))}
        </div>
      </section>

      {canManageWebhook ? (
        <section className="glass-card p-5">
          <h2 className="text-lg font-semibold text-[#fff1dd]">Webhook Discord</h2>
          <p className="mt-1 text-xs text-[#f2cfa8]">Configurez l’URL webhook pour les embeds de logs.</p>
          <div className="mt-3 flex gap-2">
            <input className="saas-input w-full" placeholder="https://discord.com/api/webhooks/..." value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
            <button className="saas-primary-btn" onClick={() => void saveWebhook()}>Enregistrer</button>
          </div>
        </section>
      ) : null}

      {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}

      <section className="space-y-2">
        {filteredLogs.map((log) => (
          <article key={log.id} className="glass-card border-l-4 border-l-[#f1c792] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#ffe9cb]">{humanAction(log.action)}</p>
              <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-[#f8d9b8]">{new Date(log.created_at).toLocaleString('fr-FR')}</span>
            </div>
            <p className="mt-1 text-sm text-[#f2d2ae]">{log.summary}</p>
            {typeof log.new_values?.proofImageUrl === 'string' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={log.new_values.proofImageUrl} alt="Preuve activité" className="mt-2 h-24 w-full rounded-lg object-cover" />
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#efc89f]">
              <span className="rounded-full bg-[#3f281b]/70 px-2 py-1">👤 {log.actor_name} (@{log.actor_username})</span>
              <span className="rounded-full bg-[#3f281b]/70 px-2 py-1">🛡️ {log.actor_role || 'N/A'}</span>
              <span className="rounded-full bg-[#3f281b]/70 px-2 py-1">📦 {log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}</span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
