'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { formatUsd } from '@/lib/currency';

type Member = { id: string; name: string; username: string };
type Item = { id: number; name: string; image_url: string | null; quantity: number };
type Transfo = { id: number; transfo_type: 'coke' | 'meth'; target_group: string | null; quantity_sent: number; quantity_expected: number; quantity_received: number | null; status: string; sent_at: string; created_by: string | null };
type Sale = { id: number; drug_type: 'coke' | 'meth' | 'fentanyl'; quantity_sold: number; member_labels: string[]; is_group_sale: boolean; estimated_min: number; estimated_max: number; estimated_avg: number; actual_amount: number; created_at: string };

export function DrugsPageClient({ transfos, sales, members, items, canTransfoCreate, canTransfoValidate, canTransfoCancelOwn, canTransfoCancelAny, canSalesCreate }: {
  transfos: Transfo[];
  sales: Sale[];
  members: Member[];
  items: Item[];
  canTransfoCreate: boolean;
  canTransfoValidate: boolean;
  canTransfoCancelOwn: boolean;
  canTransfoCancelAny: boolean;
  canSalesCreate: boolean;
}) {
  const [tab, setTab] = useState<'transfo' | 'sales'>('transfo');
  const [transfoType, setTransfoType] = useState<'coke' | 'meth'>('coke');
  const [targetGroup, setTargetGroup] = useState('');
  const [quantitySent, setQuantitySent] = useState(100);
  const [note, setNote] = useState('');
  const [saleType, setSaleType] = useState<'coke' | 'meth' | 'fentanyl'>('coke');
  const [saleQty, setSaleQty] = useState(10);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [actualAmount, setActualAmount] = useState(0);
  const [error, setError] = useState('');

  const transfoExpected = useMemo(() => transfoType === 'coke' ? Math.floor(quantitySent * 0.95) : quantitySent * 2, [transfoType, quantitySent]);
  const saleRange = useMemo(() => saleType === 'coke' ? [75, 85] : saleType === 'meth' ? [120, 140] : [60, 75], [saleType]);
  const saleEst = useMemo(() => ({ min: saleQty * saleRange[0], max: saleQty * saleRange[1], avg: Math.round((saleQty * saleRange[0] + saleQty * saleRange[1]) / 2) }), [saleQty, saleRange]);

  async function createTransfo() {
    const response = await fetch('/api/drugs/transfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transfo_type: transfoType, target_group: targetGroup, quantity_sent: quantitySent, note })
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.message ?? 'Création transfo impossible.');
      return;
    }
    window.location.reload();
  }

  async function transfoAction(transfoId: number, action: 'validate' | 'cancel') {
    const response = await fetch('/api/drugs/transfo', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transfo_id: transfoId, action }) });
    if (!response.ok) {
      const data = await response.json();
      setError(data.message ?? 'Action transfo impossible.');
      return;
    }
    window.location.reload();
  }

  async function createSale() {
    const selected = members.filter((member) => selectedMembers.includes(member.id));
    const labels = selected.map((member) => member.name || member.username);
    const response = await fetch('/api/drugs/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drug_type: saleType, quantity_sold: saleQty, is_group_sale: labels.length === 0, member_user_ids: selectedMembers, member_labels: labels, actual_amount: actualAmount || saleEst.avg })
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.message ?? 'Création vente impossible.');
      return;
    }
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <section className="glass-card p-5 flex items-center justify-between">
        <div className="flex gap-2">
          <button className={`filter-pill ${tab === 'transfo' ? 'filter-pill-active' : ''}`} onClick={() => setTab('transfo')}>Transfo</button>
          <button className={`filter-pill ${tab === 'sales' ? 'filter-pill-active' : ''}`} onClick={() => setTab('sales')}>Vente drogue</button>
        </div>
      </section>

      {tab === 'transfo' ? (
        <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <article className="glass-card p-5 space-y-3">
            <h3 className="text-base font-semibold text-[#fff1dd]">Nouvelle transfo</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className={`filter-pill ${transfoType === 'coke' ? 'filter-pill-active' : ''}`} onClick={() => setTransfoType('coke')}>Coke</button>
              <button className={`filter-pill ${transfoType === 'meth' ? 'filter-pill-active' : ''}`} onClick={() => setTransfoType('meth')}>Meth</button>
            </div>
            <input className="saas-input w-full" placeholder="Groupe destinataire" value={targetGroup} onChange={(e) => setTargetGroup(e.target.value)} />
            <input className="saas-input w-full" value={quantitySent} onChange={(e) => setQuantitySent(Math.max(1, Number(e.target.value || 1)))} />
            <textarea className="saas-input w-full" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="grid gap-2 sm:grid-cols-3">
              <Metric label="Envoyé" value={String(quantitySent)} />
              <Metric label="Attendu" value={String(transfoExpected)} />
              <Metric label="Statut" value="En attente" />
            </div>
            {canTransfoCreate ? <button className="saas-primary-btn w-full" onClick={() => void createTransfo()}>Envoyer</button> : null}
          </article>

          <article className="glass-card p-5 space-y-2">
            <h3 className="text-base font-semibold text-[#fff1dd]">Transfos</h3>
            <div className="max-h-[520px] space-y-2 overflow-y-auto">
              {transfos.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
                  <p className="text-sm font-medium text-[#ffe8ca]">#{entry.id} · {entry.transfo_type === 'coke' ? 'Coke' : 'Meth'} · {entry.target_group || '—'}</p>
                  <p className="text-xs text-[#efcdab]">Envoyé {entry.quantity_sent} · Attendu {entry.quantity_expected} · Reçu {entry.quantity_received ?? '-'} · Statut {entry.status}</p>
                  <p className="text-xs text-[#efcdab]">{new Date(entry.sent_at).toLocaleString('fr-FR')}</p>
                  <div className="mt-2 flex gap-2">
                    {entry.status === 'pending' && canTransfoValidate ? <button className="saas-primary-btn !py-1 !px-2" onClick={() => void transfoAction(entry.id, 'validate')}>Valider réception</button> : null}
                    {entry.status === 'pending' && (canTransfoCancelAny || canTransfoCancelOwn) ? <button className="saas-ghost-btn !py-1 !px-2" onClick={() => void transfoAction(entry.id, 'cancel')}>Annuler</button> : null}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <article className="glass-card p-5 space-y-3">
            <h3 className="text-base font-semibold text-[#fff1dd]">Nouvelle vente drogue</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {(['coke', 'meth', 'fentanyl'] as const).map((drug) => <button key={drug} className={`filter-pill ${saleType === drug ? 'filter-pill-active' : ''}`} onClick={() => setSaleType(drug)}>{drug}</button>)}
            </div>
            <input className="saas-input w-full" value={saleQty} onChange={(e) => setSaleQty(Math.max(1, Number(e.target.value || 1)))} />
            <div className="rounded-xl border border-white/10 bg-[#2f1d14]/45 p-2">
              <button className={`filter-pill ${selectedMembers.length === 0 ? 'filter-pill-active' : ''}`} onClick={() => setSelectedMembers([])}>Groupe</button>
              <div className="mt-2 flex flex-wrap gap-2">
                {members.map((member) => {
                  const selected = selectedMembers.includes(member.id);
                  return <button key={member.id} className={`filter-pill ${selected ? 'filter-pill-active' : ''}`} onClick={() => setSelectedMembers((current) => selected ? current.filter((id) => id !== member.id) : [...current, member.id])}>{member.name || member.username}</button>;
                })}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Metric label="Estimation min" value={formatUsd(saleEst.min)} />
              <Metric label="Estimation max" value={formatUsd(saleEst.max)} />
              <Metric label="Estimation moyenne" value={formatUsd(saleEst.avg)} />
            </div>
            <input className="saas-input w-full" placeholder="Montant réel récupéré" value={actualAmount} onChange={(e) => setActualAmount(Math.max(0, Number(e.target.value || 0)))} />
            {canSalesCreate ? <button className="saas-primary-btn w-full" onClick={() => void createSale()}>Valider vente</button> : null}
          </article>

          <article className="glass-card p-5 space-y-2">
            <h3 className="text-base font-semibold text-[#fff1dd]">Historique ventes drogue</h3>
            <div className="max-h-[520px] space-y-2 overflow-y-auto">
              {sales.map((sale) => (
                <div key={sale.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
                  <p className="text-sm font-medium text-[#ffe8ca]">#{sale.id} · {sale.drug_type} · Qté {sale.quantity_sold}</p>
                  <p className="text-xs text-[#efcdab]">{sale.is_group_sale ? 'Groupe' : (sale.member_labels ?? []).join(' + ')}</p>
                  <p className="text-xs text-[#efcdab]">Estimation {formatUsd(sale.estimated_min)} - {formatUsd(sale.estimated_max)} · Réel {formatUsd(sale.actual_amount)}</p>
                  <p className="text-xs text-[#efcdab]">{new Date(sale.created_at).toLocaleString('fr-FR')}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}

      {error ? <p className="rounded-xl border border-red-300/45 bg-red-500/10 px-4 py-2 text-sm text-red-100">{error}</p> : null}

      <section className="glass-card p-5">
        <h3 className="text-base font-semibold text-[#fff1dd]">Repères stock drogue</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {items.filter((item) => /coke|meth|fentanyl/i.test(item.name)).slice(0, 9).map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-[#3f281b]/55 p-3">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 overflow-hidden rounded-lg bg-[#22140e]">{item.image_url ? <Image src={item.image_url} alt={item.name} width={40} height={40} className="h-full w-full object-cover" unoptimized /> : null}</div>
                <div><p className="text-sm text-[#ffe8ca]">{item.name}</p><p className="text-xs text-[#efcdab]">Stock {item.quantity}</p></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-[#342116]/60 px-3 py-2"><p className="text-xs text-[#efcdab]">{label}</p><p className="text-sm font-semibold text-[#ffe8ca]">{value}</p></div>;
}
