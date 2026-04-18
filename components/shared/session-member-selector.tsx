'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type MemberOption = { id: string; label: string };

export function SessionMemberSelector({
  members,
  selectedMemberIds,
  onSelectedMemberIdsChange,
  groupMode,
  onGroupModeChange,
  groupLabel = '👥 Groupe',
  membersLabel = '👤 Membres',
  helperText = 'Active “Groupe” ou sélectionne des membres individuellement.',
  selectedHint = 'Membres sélectionnés',
  groupHint = 'Mode Groupe actif : les membres individuels sont ignorés pour cette session.',
  defaultHint
}: {
  members: MemberOption[];
  selectedMemberIds: string[];
  onSelectedMemberIdsChange: (next: string[]) => void;
  groupMode: boolean;
  onGroupModeChange: (next: boolean) => void;
  groupLabel?: string;
  membersLabel?: string;
  helperText?: string;
  selectedHint?: string;
  groupHint?: string;
  defaultHint?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const membersButtonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const selectedMembers = useMemo(
    () => members.filter((member) => selectedMemberIds.includes(member.id)),
    [members, selectedMemberIds]
  );

  useEffect(() => {
    function closeOnOutsidePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (membersButtonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setPickerOpen(false);
    }

    window.addEventListener('pointerdown', closeOnOutsidePointerDown);
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointerDown);
  }, []);

  useEffect(() => {
    if (!pickerOpen || !membersButtonRef.current) return;

    function updatePosition() {
      if (!membersButtonRef.current) return;
      const rect = membersButtonRef.current.getBoundingClientRect();
      const width = Math.min(360, Math.max(rect.width, 280));
      const maxLeft = Math.max(8, window.innerWidth - width - 8);
      setMenuStyle({
        top: rect.bottom + 8,
        left: Math.max(8, Math.min(rect.left, maxLeft)),
        width
      });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [pickerOpen]);

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-[#2f1d14]/45 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`filter-pill ${groupMode ? 'filter-pill-active' : ''}`}
          onClick={() => onGroupModeChange(true)}
        >
          {groupLabel}
        </button>
        <button
          ref={membersButtonRef}
          type="button"
          className={`filter-pill ${!groupMode ? 'filter-pill-active' : ''} ${groupMode ? 'opacity-60' : ''}`}
          onClick={() => {
            onGroupModeChange(false);
            setPickerOpen((current) => !current);
          }}
        >
          {membersLabel} ({selectedMemberIds.length})
        </button>
        <p className="text-xs text-[#efcdab]">{helperText}</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#2b1a12]/50 p-2 text-xs text-[#efcdab]">
        {groupMode ? (
          <p>{groupHint}</p>
        ) : selectedMembers.length > 0 ? (
          <p>{selectedHint} : {selectedMembers.map((member) => member.label).join(', ')}</p>
        ) : (
          <p>Aucun membre sélectionné.</p>
        )}
        {!groupMode && defaultHint ? <p className="mt-1 text-[11px] text-[#e7c39d]">{defaultHint}</p> : null}
      </div>

      {pickerOpen && !groupMode && menuStyle
        ? createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: menuStyle.top, left: menuStyle.left, width: menuStyle.width, zIndex: 9999 }}
            className="rounded-xl border border-white/15 bg-[#2f1c14]/95 p-2 shadow-2xl backdrop-blur"
          >
            <div className="max-h-64 space-y-1 overflow-auto pr-1">
              {members.map((member) => {
                const selected = selectedMemberIds.includes(member.id);
                return (
                  <label key={member.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-[#4f3220]/55 px-2 py-1.5 text-sm text-[#f8e2c6]">
                    <span className="truncate pr-2">{member.label}</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#ffcf9a]"
                      checked={selected}
                      onChange={(event) => {
                        const shouldSelect = event.target.checked;
                        if (shouldSelect) {
                          onSelectedMemberIdsChange(
                            selectedMemberIds.includes(member.id) ? selectedMemberIds : [...selectedMemberIds, member.id]
                          );
                          return;
                        }
                        onSelectedMemberIdsChange(selectedMemberIds.filter((id) => id !== member.id));
                      }}
                    />
                  </label>
                );
              })}
            </div>
          </div>,
          document.body
        )
        : null}
    </div>
  );
}
