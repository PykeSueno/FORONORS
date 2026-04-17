'use client';

import Link from 'next/link';
import { DragEvent, useMemo, useState } from 'react';

type HubCardItem = {
  id: string;
  href: string;
  enabled: boolean;
  icon: string;
  title: string;
  value: string;
  subtitle: string;
  hoverDetails?: string[];
};

export function DashboardHubGrid({ cards, initialOrder }: { cards: HubCardItem[]; initialOrder: string[] }) {
  const [order, setOrder] = useState<string[]>(initialOrder);
  const [dragging, setDragging] = useState<string | null>(null);
  const [draftOrder, setDraftOrder] = useState<string[]>(initialOrder);

  const orderedCards = useMemo(() => {
    const map = new Map(cards.map((card) => [card.id, card]));
    const listed = draftOrder.map((id) => map.get(id)).filter(Boolean) as HubCardItem[];
    const missing = cards.filter((card) => !draftOrder.includes(card.id));
    return [...listed, ...missing];
  }, [cards, draftOrder]);

  async function persist(nextOrder: string[]) {
    setOrder(nextOrder);
    setDraftOrder(nextOrder);
    await fetch('/api/dashboard/layout', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: nextOrder })
    });
  }

  function moveCard(targetId: string) {
    if (!dragging || dragging === targetId) return;
    const next = [...draftOrder];
    const from = next.indexOf(dragging);
    const to = next.indexOf(targetId);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, dragging);
    setDraftOrder(next);
  }

  function endDrag() {
    if (!dragging) return;
    setDragging(null);
    if (draftOrder.join('|') !== order.join('|')) void persist(draftOrder);
  }

  function onDragStart(event: DragEvent<HTMLDivElement>, cardId: string) {
    setDragging(cardId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', cardId);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>, cardId: string) {
    event.preventDefault();
    if (!dragging) {
      const sourceId = event.dataTransfer.getData('text/plain');
      if (sourceId) setDragging(sourceId);
    }
    moveCard(cardId);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    endDrag();
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {orderedCards.map((card) => (
        <div
          key={card.id}
          draggable
          onDragStart={(event) => onDragStart(event, card.id)}
          onDragOver={(event) => onDragOver(event, card.id)}
          onDrop={onDrop}
          onDragEnd={endDrag}
          onPointerDown={() => setDragging(card.id)}
          onPointerEnter={() => moveCard(card.id)}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={(event) => { if (dragging) event.preventDefault(); }}
          className={dragging === card.id ? 'opacity-70' : ''}
        >
          <HubCard {...card} />
        </div>
      ))}
    </section>
  );
}

function HubCard({ href, enabled, icon, title, value, subtitle, hoverDetails }: Omit<HubCardItem, 'id'>) {
  const content = (
    <div className="relative">
      <div className="flex items-center justify-between"><p className="text-3xl">{icon}</p><p className="text-2xl font-semibold text-[#ffe9cd]">{value}</p></div>
      <p className="mt-3 text-lg font-semibold text-[#fff2de]">{title}</p>
      <p className="text-sm text-[#f1d1ac]">{subtitle}</p>
      {hoverDetails && hoverDetails.length > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 top-full z-40 mt-2 hidden rounded-xl border border-white/10 bg-[#2a180f]/95 p-2 text-xs text-[#f4d7b6] shadow-xl group-hover:block">
          {hoverDetails.map((line) => <p key={line}>{line}</p>)}
        </div>
      ) : null}
    </div>
  );

  if (!enabled) return <div className="glass-card group block cursor-not-allowed opacity-90 p-6">{content}</div>;
  return <Link href={href} className="glass-card smooth-hover group block p-6">{content}</Link>;
}
