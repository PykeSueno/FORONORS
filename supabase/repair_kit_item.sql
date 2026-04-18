-- Réparation ciblée de l'item "Kit" (à exécuter une seule fois en maintenance).
-- Objectif:
-- 1) restaurer Kit s'il a été supprimé
-- 2) rétablir une image valide si image manquante
-- 3) conserver la cohérence stock/catégorie sans créer de doublon

do $$
declare
  v_kit_id bigint;
  v_image text := 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="100%%" height="100%%" fill="%232b1a12"/><rect x="18" y="46" width="220" height="170" rx="18" fill="%238a5a3b"/><rect x="30" y="58" width="196" height="146" rx="12" fill="%23cfa57f"/><text x="50%%" y="56%%" dominant-baseline="middle" text-anchor="middle" font-size="88">🧰</text></svg>';
begin
  select id
  into v_kit_id
  from public.items
  where lower(trim(name)) = 'kit'
  order by id
  limit 1;

  if v_kit_id is null then
    insert into public.items (
      name,
      image_url,
      buy_price,
      sell_price,
      quantity,
      category_key,
      category_label,
      type_key,
      type_label
    ) values (
      'Kit',
      v_image,
      0,
      0,
      0,
      'equipment',
      'Équipement',
      'kits',
      'Kits'
    )
    returning id into v_kit_id;
  else
    update public.items
    set
      name = 'Kit',
      image_url = case when coalesce(trim(image_url), '') = '' then v_image else image_url end,
      category_key = coalesce(nullif(category_key, ''), 'equipment'),
      category_label = coalesce(nullif(category_label, ''), 'Équipement'),
      type_key = coalesce(type_key, 'kits'),
      type_label = coalesce(type_label, 'Kits'),
      updated_at = timezone('utc', now())
    where id = v_kit_id;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    summary,
    created_at
  ) values (
    null,
    'items.repair.kit',
    'item',
    v_kit_id::text,
    'Réparation admin: restauration/normalisation de l''item Kit',
    timezone('utc', now())
  );
end $$;
