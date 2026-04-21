const GRADE_ORDER = ['patron', 'commandant', 'gerant', 'ancien', 'membre', 'nouveau'] as const;

function normalize(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function memberGradeRank(roleName: string | null | undefined) {
  const normalized = normalize(roleName);
  const idx = GRADE_ORDER.findIndex((entry) => normalized.includes(entry));
  return idx >= 0 ? idx : GRADE_ORDER.length;
}

export function sortMembersByGrade<T extends { role_name?: string | null; name?: string | null; username?: string | null }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const rank = memberGradeRank(a.role_name) - memberGradeRank(b.role_name);
    if (rank !== 0) return rank;
    const nameA = (a.name || a.username || '').toLowerCase();
    const nameB = (b.name || b.username || '').toLowerCase();
    return nameA.localeCompare(nameB, 'fr');
  });
}
