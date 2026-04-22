'use client';

import { ReactNode } from 'react';

type QuantityStepperProps = {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  onChange: (next: number) => void;
  extraAction?: { label: string; onClick: () => void };
};

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
