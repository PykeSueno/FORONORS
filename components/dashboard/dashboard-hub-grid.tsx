'use client';

import Link from 'next/link';
import { DragEvent, PointerEvent, useEffect, useMemo, useState } from 'react';

type HubCardItem = {
  id: string;
  href: string;
  enabled: boolean;
  icon: string;
  title: string;
  value: string;
  subtitle: string;
};

export function DashboardHubGrid({ cards, initialOrder }: { cards: HubCardItem[]; initialOrder: string[] }) {
  const initialNormalizedOrder = useMemo(() => {
    const cardIds = cards.map((card) => card.id);
    const validStored = initialOrder.filter((id) => cardIds.includes(id));
    const missing = cardIds.filter((id) => !validStored.includes(id));
    return [...validStored, ...missing];
  }, [cards, initialOrder]);

  const [order, setOrder] = useState<string[]>(initialNormalizedOrder);
  const [dragging, setDragging] = useState<string | null>(null);
  const [draftOrder, setDraftOrder] = useState<string[]>(initialNormalizedOrder);
  const [hasDragged, setHasDragged] = useState(false);
  const [pointerDrag, setPointerDrag] = useState<{ pointerId: number; cardId: string } | null>(null);

  useEffect(() => {
    setOrder(initialNormalizedOrder);
    setDraftOrder(initialNormalizedOrder);
  }, [initialNormalizedOrder]);

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
    setHasDragged(true);
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
    setPointerDrag(null);
    setHasDragged(false);
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

  function onPointerDown(event: PointerEvent<HTMLDivElement>, cardId: string) {
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    setPointerDrag({ pointerId: event.pointerId, cardId });
    setDragging(cardId);
    setHasDragged(false);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointerDrag) return;
    const hovered = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const card = hovered?.closest('[data-hub-card-id]') as HTMLElement | null;
    const targetCardId = card?.dataset.hubCardId;
    if (!targetCardId) return;
    if (targetCardId !== dragging) setHasDragged(true);
    moveCard(targetCardId);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!pointerDrag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    endDrag();
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {orderedCards.map((card) => (
        <div
          key={card.id}
          data-hub-card-id={card.id}
          draggable
          onDragStart={(event) => onDragStart(event, card.id)}
          onDragOver={(event) => onDragOver(event, card.id)}
          onDrop={onDrop}
          onDragEnd={endDrag}
          onPointerDown={(event) => onPointerDown(event, card.id)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={endDrag}
          onClickCapture={(event) => { if (hasDragged || dragging) event.preventDefault(); }}
          className={`cursor-grab active:cursor-grabbing ${dragging === card.id ? 'opacity-70' : ''}`}
        >
          <HubCard {...card} />
        </div>
      ))}
    </section>
  );
}

function HubCard({ href, enabled, icon, title, value, subtitle }: Omit<HubCardItem, 'id'>) {
  const content = (
    <>
      <div className="flex items-center justify-between"><p className="text-3xl">{icon}</p><p className="text-2xl font-semibold text-[#ffe9cd]">{value}</p></div>
      <p className="mt-3 text-lg font-semibold text-[#fff2de]">{title}</p>
      <p className="text-sm text-[#f1d1ac]">{subtitle}</p>
    </>
  );

  if (!enabled) return <div className="glass-card block cursor-not-allowed opacity-90 p-6">{content}</div>;
  return <Link href={href} className="glass-card smooth-hover block p-6">{content}</Link>;
}
