export const ITEM_CATEGORIES = [
  { key: 'objects', label: 'Objets', types: [] },
  {
    key: 'weapons',
    label: 'Armes',
    types: [
      { key: 'weapons', label: 'Armes' },
      { key: 'ammo', label: 'Munitions' },
      { key: 'other', label: 'Autres' }
    ]
  },
  { key: 'equipment', label: 'Équipement', types: [] },
  {
    key: 'drugs',
    label: 'Drogues',
    types: [
      { key: 'seeds', label: 'Graines' },
      { key: 'equipment', label: 'Equipement' },
      { key: 'bag', label: 'Pochon' }
    ]
  },
  { key: 'other', label: 'Autres', types: [] }
] as const;

export function needsWeaponId(categoryKey: string, typeKey: string | null) {
  return categoryKey === 'weapons' && typeKey === 'weapons';
}
