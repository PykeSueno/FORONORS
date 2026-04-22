'use client';

import { ReactNode } from 'react';

type QuantityStepperProps = {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  onChange: (next: number) => void;
  extraAction?: { label: string; onClick: () => void };
};

export function RemoveLineButton({ onClick, title = 'Supprimer la ligne' }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      className="saas-ghost-btn !h-9 !min-h-9 !w-9 !px-0 !py-0 text-[#f3c4c4] hover:!border-red-200/40 hover:!bg-red-500/15 hover:text-[#ffd3d3]"
      onClick={onClick}
      aria-label={title}
      title={title}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 10v7M14 10v7" />
      </svg>
    </button>
  );
}

export function LineField({ label, widthClass = 'w-[9rem]', children }: { label: string; widthClass?: string; children: ReactNode }) {
  return (
    <label className={`${widthClass} min-w-0 space-y-1`}>
      <span className="block text-xs text-[#efcdab]">{label}</span>
      {children}
    </label>
  );
}

export function QuantityStepper({ value, onDecrease, onIncrease, onChange, extraAction }: QuantityStepperProps) {
  return (
    <div className="flex h-9 items-center gap-1.5">
      <button type="button" className="saas-ghost-btn !h-9 !min-h-9 !px-2 !py-0" onClick={onDecrease}>−</button>
      <input
        className="saas-input !h-9 !min-h-9 w-14 px-1 text-center text-sm"
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
      />
      <button type="button" className="saas-ghost-btn !h-9 !min-h-9 !px-2 !py-0" onClick={onIncrease}>+</button>
      {extraAction ? <button type="button" className="saas-primary-btn !h-9 !min-h-9 !px-2.5 !py-0 text-[10px] font-semibold uppercase tracking-wide" onClick={extraAction.onClick}>{extraAction.label}</button> : null}
    </div>
  );
}

export function LineControlsRow({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-nowrap items-end gap-2 overflow-x-auto pb-1">{children}</div>;
}
