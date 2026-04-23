'use client';

import { ReactNode } from 'react';

type QuantityStepperProps = {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  onChange: (next: number) => void;
};

export function RemoveLineButton({ onClick, title = 'Supprimer la ligne' }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-5 w-5 items-center justify-center text-[#f0baba] transition-colors duration-150 hover:text-[#ff8f8f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2a180f]"
      onClick={onClick}
      aria-label={title}
      title={title}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
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

export function QuantityStepper({ value, onDecrease, onIncrease, onChange }: QuantityStepperProps) {
  return (
    <div className="flex h-9 items-center gap-1">
      <button type="button" className="saas-ghost-btn !h-9 !min-h-9 !px-1.5 !py-0" onClick={onDecrease}>−</button>
      <input
        className="saas-input !h-9 !min-h-9 w-12 px-1 text-center text-sm"
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
      />
      <button type="button" className="saas-ghost-btn !h-9 !min-h-9 !px-1.5 !py-0" onClick={onIncrease}>+</button>
    </div>
  );
}

export function LineControlsRow({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-nowrap items-end gap-2 overflow-x-auto pb-1">{children}</div>;
}

export function CompactLineGrid({ type, children }: { type: 'transaction' | 'four' | 'sale'; children: ReactNode }) {
  const template = type === 'transaction'
    ? 'lg:grid-cols-[7rem_8.25rem_6.25rem_6.25rem_1.25rem]'
    : type === 'four'
      ? 'lg:grid-cols-[6.75rem_8.25rem_6.25rem_1.25rem]'
      : 'lg:grid-cols-[9rem_3rem_6.25rem_6.25rem_1.25rem]';

  return <div className={`mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-2 lg:inline-grid ${template} lg:w-fit lg:items-end`}>{children}</div>;
}

export function CompactField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="min-w-0 space-y-1">
      <span className="block text-xs text-[#efcdab]">{label}</span>
      {children}
    </label>
  );
}
