begin;

insert into public.items (name, image_url, buy_price, sell_price, quantity, category_key, category_label, type_key, type_label)
select 'Pierre', null, 0, 0, 0, 'objects', 'Objets', 'production', 'Production'
where not exists (select 1 from public.items where lower(name) = 'pierre');

commit;
