'use client';

import Link from 'next/link';
import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type HubCardItem = {
  id: string;
  href: string;
  enabled: boolean;
  icon: ReactNode;
  title: string;
  value: string;
  subtitle: string;
};

export function DashboardHubGrid({ cards, initialOrder }: { cards: HubCardItem[]; initialOrder: string[] }) {
  const visibleCards = useMemo(() => cards.filter((card) => card.enabled), [cards]);
  const initialNormalizedOrder = useMemo(() => {
    const cardIds = visibleCards.map((card) => card.id);
    const validStored = initialOrder.filter((id) => cardIds.includes(id));
    const missing = cardIds.filter((id) => !validStored.includes(id));
    return [...validStored, ...missing];
  }, [visibleCards, initialOrder]);

  const [dragging, setDragging] = useState<string | null>(null);
  const [draftOrder, setDraftOrder] = useState<string[]>(initialNormalizedOrder);
  const [hasDragged, setHasDragged] = useState(false);
  const [pointerDrag, setPointerDrag] = useState<{ pointerId: number; cardId: string; startX: number; startY: number; startAt: number; draggingStarted: boolean } | null>(null);
  const orderRef = useRef(initialNormalizedOrder);
  const draftOrderRef = useRef(initialNormalizedOrder);
  const draggingRef = useRef<string | null>(null);

  useEffect(() => {
    setDraftOrder(initialNormalizedOrder);
    orderRef.current = initialNormalizedOrder;
    draftOrderRef.current = initialNormalizedOrder;
  }, [initialNormalizedOrder]);

  const orderedCards = useMemo(() => {
    const map = new Map(visibleCards.map((card) => [card.id, card]));
    const listed = draftOrder.map((id) => map.get(id)).filter(Boolean) as HubCardItem[];
    const missing = visibleCards.filter((card) => !draftOrder.includes(card.id));
    return [...listed, ...missing];
  }, [visibleCards, draftOrder]);

  async function persist(nextOrder: string[]) {
    orderRef.current = nextOrder;
    draftOrderRef.current = nextOrder;
    setDraftOrder(nextOrder);
    await fetch('/api/dashboard/layout', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: nextOrder })
    });
  }

  function moveCard(targetId: string) {
    const activeDragging = draggingRef.current ?? dragging;
    if (!activeDragging || activeDragging === targetId) return;
    setHasDragged(true);
    const next = [...draftOrderRef.current];
    const from = next.indexOf(activeDragging);
    const to = next.indexOf(targetId);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, activeDragging);
    draftOrderRef.current = next;
    setDraftOrder(next);
  }

  function endDrag() {
    const activeDragging = draggingRef.current ?? dragging;
    if (!activeDragging) return;
    draggingRef.current = null;
    setDragging(null);
    setPointerDrag(null);
    setHasDragged(false);
    const latestOrder = draftOrderRef.current;
    if (latestOrder.join('|') !== orderRef.current.join('|')) void persist(latestOrder);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>, cardId: string) {
    const origin = event.target as HTMLElement;
    if (!origin.closest('[data-drag-handle]')) return;
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    setPointerDrag({
      pointerId: event.pointerId,
      cardId,
      startX: event.clientX,
      startY: event.clientY,
      startAt: Date.now(),
      draggingStarted: false
    });
    draggingRef.current = null;
    setHasDragged(false);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointerDrag) return;
    const dx = event.clientX - pointerDrag.startX;
    const dy = event.clientY - pointerDrag.startY;
    const distance = Math.hypot(dx, dy);
    const elapsed = Date.now() - pointerDrag.startAt;
    const DRAG_DISTANCE_THRESHOLD = 18;
    const DRAG_HOLD_THRESHOLD_MS = 120;
    if (!pointerDrag.draggingStarted && (distance < DRAG_DISTANCE_THRESHOLD || elapsed < DRAG_HOLD_THRESHOLD_MS)) return;
    if (!pointerDrag.draggingStarted) {
      setPointerDrag((current) => (current ? { ...current, draggingStarted: true } : current));
      draggingRef.current = pointerDrag.cardId;
      setDragging(pointerDrag.cardId);
      setHasDragged(true);
    }
    const activeDragging = draggingRef.current ?? dragging;
    if (!activeDragging) return;
    const hovered = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const card = hovered?.closest('[data-hub-card-id]') as HTMLElement | null;
    const targetCardId = card?.dataset.hubCardId;
    if (!targetCardId) return;
    if (targetCardId !== activeDragging) setHasDragged(true);
    moveCard(targetCardId);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!pointerDrag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!pointerDrag.draggingStarted && !draggingRef.current) {
      setPointerDrag(null);
      setDragging(null);
      setHasDragged(false);
      return;
    }
    endDrag();
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {orderedCards.map((card) => (
        <div
          key={card.id}
          data-hub-card-id={card.id}
          onPointerDown={(event) => onPointerDown(event, card.id)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={endDrag}
          onClickCapture={(event) => { if (hasDragged || dragging) event.preventDefault(); }}
          className={`${dragging === card.id ? 'opacity-70' : ''}`}
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
      <div className="flex items-center justify-between gap-2">
        <p
          data-drag-handle={enabled ? 'true' : undefined}
          className={`text-3xl ${enabled ? 'inline-flex select-none items-center justify-center rounded-md p-1 cursor-grab active:cursor-grabbing' : ''}`}
          title={enabled ? 'Maintenir cette icône pour réorganiser le dashboard' : undefined}
        >
          {icon}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-semibold text-[#ffe9cd]">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-lg font-semibold text-[#fff2de]">{title}</p>
      <p className="text-sm text-[#f1d1ac]">{subtitle}</p>
    </>
  );

  if (!enabled) return <div className="glass-card block cursor-not-allowed opacity-90 p-6">{content}</div>;
  return <Link href={href} className="glass-card smooth-hover block p-6">{content}</Link>;
}
