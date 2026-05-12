'use client';

import { useCallback, useMemo, useState } from 'react';

function humanAction(action: string) {
  if (action === 'money.edit') return 'Ajustement dargent';
  if (action.includes('stock_in')) return 'Entree stock';
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

type LogResponse = {
  logs: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
};

const MODULE_OPTIONS = ['', 'Argent', 'Transactions', 'Vente objets', 'Tablette', 'Activite', 'FOUR', 'Drogues', 'Membres', 'Permissions', 'Logs'];

function inferModule(log: LogEntry) {
  const blob = `${log.action} ${log.entity_type} ${log.summary}`.toLowerCase();
  if (blob.includes('money') || blob.includes('cash')) return 'Argent';
  if (blob.includes('transaction')) return 'Transactions';
  if (blob.includes('sale.objects') || blob.includes('vente objets')) return 'Vente objets';
  if (blob.includes('tablet') || blob.includes('tablette')) return 'Tablette';
  if (blob.includes('activity') || blob.includes('activit')) return 'Activite';
  if (blob.includes('four')) return 'FOUR';
  if (blob.includes('drug') || blob.includes('drogue')) return 'Drogues';
  if (blob.includes('member') || blob.includes('membre')) return 'Membres';
  if (blob.includes('permission') || blob.includes('role')) return 'Permissions';
  if (blob.includes('log')) return 'Logs';
  return 'Autre';
}

function inferItemCategory(log: LogEntry) {
  const blob = `${log.summary} ${JSON.stringify(log.new_values ?? {})}`.toLowerCase();
  if (blob.includes('category_key\":\"objects') || blob.includes('objet')) return 'Objets';
  if (blob.includes('category_key\":\"weapons') || blob.includes('arme')) return 'Armes';
  if (blob.includes('category_key\":\"equipment') || blob.includes('equipement') || blob.includes('equip')) return 'Equipement';
  if (blob.includes('category_key\":\"drugs') || blob.includes('drogue')) return 'Drogues';
  if (blob.includes('category_key\":\"other') || blob.includes('autre')) return 'Autres';
  return '';
}

export function LogsPageClient({
  initialLogs,
  initialTotal,
  initialWebhookUrl,
  canManageWebhook,
  canViewTabletWebhook,
  canEditTabletWebhook,
  initialTabletWebhookConfigured
}: {
  initialLogs: LogEntry[];
  initialTotal: number;
  initialWebhookUrl: string;
  canManageWebhook: boolean;
  canViewTabletWebhook: boolean;
  canEditTabletWebhook: boolean;
  initialTabletWebhookConfigured: boolean;
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [itemCategoryFilter, setItemCategoryFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl);
  const [tabletWebhookUrl, setTabletWebhookUrl] = useState('');
  const [tabletWebhookConfigured, setTabletWebhookConfigured] = useState(initialTabletWebhookConfigured);
  const [tabletWebhookMessage, setTabletWebhookMessage] = useState('');
  const [tabletWebhookBusy, setTabletWebhookBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const actionOptions = useMemo(() => Array.from(new Set(logs.map((log) => log.action))), [logs]);
  const entityOptions = useMemo(() => Array.from(new Set(logs.map((log) => log.entity_type))), [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const moduleValue = inferModule(log);
      const categoryValue = inferItemCategory(log);
      const q = query.toLowerCase();
      const qOk = !q || [log.actor_name, log.actor_username, log.summary, log.action].join(' ').toLowerCase().includes(q);
      const actionOk = !actionFilter || log.action === actionFilter;
      const entityOk = !entityFilter || log.entity_type === entityFilter;
      const moduleOk = !moduleFilter || moduleValue === moduleFilter;
      const categoryOk = !itemCategoryFilter || categoryValue === itemCategoryFilter;
      return qOk && actionOk && entityOk && moduleOk && categoryOk;
    });
  }, [logs, query, actionFilter, entityFilter, moduleFilter, itemCategoryFilter]);

  const hasNextPage = page * pageSize < total;

  const refresh = useCallback(
    async (requestedPage: number, replace: boolean) => {
      const params = new URLSearchParams();
      params.set('page', String(requestedPage));
      params.set('page_size', String(pageSize));
      if (query) params.set('q', query);
      if (actionFilter) params.set('action', actionFilter);
      if (entityFilter) params.set('entity_type', entityFilter);
      if (moduleFilter) params.set('module', moduleFilter);
      if (from) params.set('date_from', from);
      if (to) params.set('date_to', to);

      setLoading(true);
      setError('');
      const response = await fetch(`/api/logs?${params.toString()}`);
      setLoading(false);

      if (!response.ok) {
        setError('Chargement logs impossible.');
        return;
      }

      const data = (await response.json()) as LogResponse;
      setLogs((prev) => (replace ? data.logs : [...prev, ...data.logs]));
      setTotal(data.total ?? 0);
      setPage(data.page ?? requestedPage);
    },
    [actionFilter, entityFilter, from, moduleFilter, pageSize, query, to]
  );

  const handleSearch = useCallback(() => {
    void refresh(1, true);
  }, [refresh]);

  const handleLoadMore = useCallback(() => {
    if (!hasNextPage || loading) return;
    void refresh(page + 1, false);
  }, [hasNextPage, loading, page, refresh]);

  async function saveWebhook() {
    const response = await fetch('/api/logs/webhook', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl })
    });
    if (!response.ok) {
      setError('Mise a jour webhook impossible.');
      return;
    }
    setError('');
  }

  async function saveTabletWebhook() {
    setTabletWebhookBusy(true);
    setTabletWebhookMessage('');
    const response = await fetch('/api/logs/webhooks/tablet', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: tabletWebhookUrl })
    });
    setTabletWebhookBusy(false);
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setTabletWebhookMessage(data.message ?? 'Mise a jour webhook tablette impossible.');
      return;
    }
    const data = (await response.json()) as { configured?: boolean };
    setTabletWebhookConfigured(Boolean(data.configured));
    setTabletWebhookUrl('');
    setTabletWebhookMessage('Webhook tablette enregistré.');
  }

  async function testTabletWebhook() {
    setTabletWebhookBusy(true);
    setTabletWebhookMessage('');
    const response = await fetch('/api/logs/webhooks/tablet/test', { method: 'POST' });
    setTabletWebhookBusy(false);
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setTabletWebhookMessage(data.message ?? 'Test webhook tablette impossible.');
      return;
    }
    setTabletWebhookMessage('Test webhook tablette envoyé.');
  }

  return (
    <div className="space-y-5">
      <section className="glass-card p-6">
        <h1 className="text-2xl font-semibold text-[#fff1dc]">Logs</h1>
        <p className="mt-1 text-sm text-[#f6d7b5]">Suivi des actions du site et webhook Discord.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input className="saas-input w-full" placeholder="Rechercher" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="saas-input w-full" value={actionFilter} onChange={(event) => {
            setActionFilter(event.target.value);
          }}>
            <option value="">Toutes les actions</option>
            {actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
          <select className="saas-input w-full" value={entityFilter} onChange={(event) => {
            setEntityFilter(event.target.value);
          }}>
            <option value="">Tous les modules</option>
            {entityOptions.map((entity) => <option key={entity} value={entity}>{entity}</option>)}
          </select>
          <button className="saas-primary-btn" onClick={handleSearch}>Filtrer</button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="grid gap-2 sm:grid-cols-4">
            <input className="saas-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <input className="saas-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            <button className="saas-primary-btn !justify-center" onClick={handleSearch}>Appliquer dates</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {MODULE_OPTIONS.map((entry) => (
              <button
                key={entry || 'all-modules'}
                type="button"
                className={`filter-pill ${moduleFilter === entry ? 'filter-pill-active' : ''}`}
                onClick={() => setModuleFilter(entry)}
              >
                {entry || 'Tous modules'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {['', 'Objets', 'Armes', 'Equipement', 'Drogues', 'Autres'].map((entry) => (
            <button
              key={entry || 'all-categories'}
              type="button"
              className={`filter-pill ${itemCategoryFilter === entry ? 'filter-pill-active' : ''}`}
              onClick={() => setItemCategoryFilter(entry)}
            >
              {entry || 'Tous items'}
            </button>
          ))}
        </div>
      </section>

      {canManageWebhook ? (
        <section className="glass-card p-5">
          <h2 className="text-lg font-semibold text-[#fff1dd]">Webhook Discord</h2>
          <p className="mt-1 text-xs text-[#f2cfa8]">Configurez l URL webhook pour les embeds de logs.</p>
          <div className="mt-3 flex gap-2">
            <input className="saas-input w-full" placeholder="https://discord.com/api/webhooks/..." value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} />
            <button className="saas-primary-btn" onClick={() => void saveWebhook()}>Enregistrer</button>
          </div>
        </section>
      ) : null}

      {canViewTabletWebhook ? (
        <section className="glass-card border border-[#e8b979]/30 bg-[#3b2418]/75 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#fff1dd]">📱 Webhook Tablette</h2>
              <p className="mt-1 text-xs text-[#f2cfa8]">Configuration Discord dédiée aux messages Tablette.</p>
              <p className="mt-2 text-xs text-[#efcdab]">
                Statut : <span className={tabletWebhookConfigured ? 'font-semibold text-emerald-200' : 'font-semibold text-red-200'}>{tabletWebhookConfigured ? '✅ Configuré' : '❌ Non configuré'}</span>
              </p>
            </div>
            {canEditTabletWebhook ? <button className="saas-ghost-btn" disabled={!tabletWebhookConfigured || tabletWebhookBusy} onClick={() => void testTabletWebhook()}>Tester</button> : null}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              className="saas-input w-full"
              type={canEditTabletWebhook ? 'password' : 'text'}
              placeholder={tabletWebhookConfigured ? 'URL webhook Discord Tablette - coller une nouvelle URL pour remplacer' : 'URL webhook Discord Tablette'}
              value={canEditTabletWebhook ? tabletWebhookUrl : (tabletWebhookConfigured ? 'Webhook configuré' : 'Aucun webhook configuré')}
              onChange={(event) => setTabletWebhookUrl(event.target.value)}
              readOnly={!canEditTabletWebhook}
              autoComplete="off"
            />
            {canEditTabletWebhook ? <button className="saas-primary-btn" disabled={tabletWebhookBusy} onClick={() => void saveTabletWebhook()}>Enregistrer</button> : null}
          </div>
          {tabletWebhookMessage ? <p className="mt-2 text-xs text-[#efcdab]">{tabletWebhookMessage}</p> : null}
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
              <img
                src={log.new_values.proofImageUrl as string}
                alt="Preuve activite"
                className="mt-2 h-24 w-full rounded-lg object-cover"
              />
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#efc89f]">
              <span className="rounded-full bg-[#3f281b]/70 px-2 py-1">User {log.actor_name} (@{log.actor_username})</span>
              <span className="rounded-full bg-[#3f281b]/70 px-2 py-1">Role {log.actor_role || 'N/A'}</span>
              <span className="rounded-full bg-[#3f281b]/70 px-2 py-1">Type {log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#f2d2ae]">
          {filteredLogs.length} / {total} logs
        </p>
        {hasNextPage ? (
          <button className="saas-primary-btn" onClick={handleLoadMore} disabled={loading}>
            {loading ? 'Chargement...' : 'Charger plus'}
          </button>
        ) : null}
      </section>
    </div>
  );
}
