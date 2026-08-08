/**
 * DDL de las tablas del chat comunitario (chats / chat_members / chat_messages)
 * y de la biblioteca de stickers por cuenta (stickers).
 *
 * Este bloque es idempotente: puede ejecutarse completo o por partes, tantas
 * veces como sea necesario (create table/index if not exists + limpieza total
 * de políticas + publicación realtime protegida).
 *
 * Se usa desde:
 *  - El instalador general de esquema (setup.ts), que lo añade al SQL completo.
 *  - El panel "Instalar chat" que aparece en el chat cuando las tablas faltan.
 */
export const CHAT_SCHEMA_SQL = `-- ─────────────────────────── CHAT COMUNITARIO ───────────────────────────

create table if not exists public.chats (
  id uuid primary key,
  type text not null default 'group',
  name text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  is_community boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  media_url text,
  media_type text not null default 'image',
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  kind text not null default 'message',
  gift_id uuid,
  created_at timestamptz not null default now()
);

-- Para instalaciones previas que aún no tienen la columna (audio de voz)
alter table public.chat_messages add column if not exists media_type text not null default 'image';
-- Avisos del grupo y paquetes de regalo (añadidos tras el audio de voz)
alter table public.chat_messages add column if not exists kind text not null default 'message';
alter table public.chat_messages add column if not exists gift_id uuid;

create index if not exists chat_messages_chat_created_idx on public.chat_messages (chat_id, created_at);
create index if not exists chat_members_user_idx on public.chat_members (user_id);

-- ─────── PAQUETES DE REGALO (ORBES) ───────
-- El administrador crea un paquete con una cantidad de orbes por persona
-- (par, mínimo 100) y un número de personas que pueden abrirlo. Cuando se
-- abren todos los regalos, el paquete se cierra automáticamente.
create table if not exists public.orb_gifts (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  amount_per_person bigint not null,
  max_claims int not null,
  claims int not null default 0,
  total_orbes bigint not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table if not exists public.orb_gift_claims (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.orb_gifts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (gift_id, user_id)
);

create index if not exists orb_gifts_chat_status_idx on public.orb_gifts (chat_id, status);
create index if not exists orb_gift_claims_gift_idx on public.orb_gift_claims (gift_id);

-- Caducidad de paquetes de regalo (para tablas creadas antes de esta función).
alter table public.orb_gifts add column if not exists expires_at timestamptz not null default now() + interval '24 hours';

-- ─────── BIBLIOTECA DE STICKERS POR CUENTA ───────
-- Cada usuario guarda sus propios stickers; persisten entre sesiones y
-- dispositivos. Solo el dueño puede verlos, añadirlos y eliminarlos.
create table if not exists public.stickers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);

create index if not exists stickers_user_idx on public.stickers (user_id);

alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.stickers enable row level security;
alter table public.orb_gifts enable row level security;
alter table public.orb_gift_claims enable row level security;

-- Limpieza total: elimina CUALQUIER política previa de las tablas del chat,
-- incluidas las de instalaciones antiguas con otros nombres que provocan el
-- error «infinite recursion detected in policy for relation chat_members».
-- Después se recrean abajo las políticas definitivas.
do $$
declare _t text;
declare _p record;
begin
  for _t in select unnest(array['chats', 'chat_members', 'chat_messages', 'stickers', 'orb_gifts', 'orb_gift_claims']) loop
    for _p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = _t
    loop
      execute format('drop policy if exists %I on public.%I', _p.policyname, _t);
    end loop;
  end loop;
end $$;

-- chats: lectura pública, creación por el propio usuario
create policy chats_read on public.chats for select using (true);
create policy chats_insert on public.chats for insert with check (auth.uid() = created_by);

-- chat_members: lectura pública, cada usuario se añade/elimina a sí mismo
create policy chat_members_read on public.chat_members for select using (true);
create policy chat_members_self_insert on public.chat_members for insert with check (auth.uid() = user_id);
create policy chat_members_self_delete on public.chat_members for delete using (auth.uid() = user_id);

-- chat_messages: el chat del grupo es de lectura pública; los chats
-- individuales (dm) solo los leen sus participantes.
create policy chat_messages_read on public.chat_messages for select using (
  exists (select 1 from public.chats c where c.id = chat_messages.chat_id and c.type = 'group')
  or exists (select 1 from public.chat_members m
             where m.chat_id = chat_messages.chat_id and m.user_id = auth.uid())
);
create policy chat_messages_insert on public.chat_messages for insert with check (auth.uid() = sender_id);
create policy chat_messages_update on public.chat_messages for update using (auth.uid() = sender_id);
create policy chat_messages_delete on public.chat_messages for delete using (auth.uid() = sender_id);

-- stickers: biblioteca privada de cada cuenta
create policy stickers_select on public.stickers for select using (auth.uid() = user_id);
create policy stickers_insert on public.stickers for insert with check (auth.uid() = user_id);
create policy stickers_delete on public.stickers for delete using (auth.uid() = user_id);

-- orb_gifts: lectura pública (el estado del paquete lo ve todo el chat).
-- La creación y las aperturas van SOLO por funciones RPC (la seguridad real
-- está en el servidor: solo el administrador crea; cualquiera abre una vez).
create policy orb_gifts_read on public.orb_gifts for select using (true);

-- orb_gift_claims: cada usuario solo ve sus propios registros.
create policy orb_gift_claims_read on public.orb_gift_claims for select using (auth.uid() = user_id);

-- ─────── CHATS INDIVIDUALES (DMs) ───────
-- Reutilizan chats (type='dm'), chat_members (los 2 participantes) y
-- chat_messages. last_read_at guarda hasta dónde ha leído cada participante
-- para calcular los no leídos de cada conversación.
alter table public.chat_members add column if not exists last_read_at timestamptz;

-- ¿a y b se siguen mutuamente?
create or replace function public.are_mutual(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.follows where follower_id = a and following_id = b)
     and exists (select 1 from public.follows where follower_id = b and following_id = a)
$$;

-- Devuelve (o crea) el chat individual con _other_id. Solo se permite si se
-- siguen mutuamente. Crea el chat tipo 'dm' y añade a ambos como miembros.
create or replace function public.get_or_create_dm(_other_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_chat_id uuid;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'Inicia sesión para chatear');
  end if;
  if v_me = _other_id then
    return jsonb_build_object('ok', false, 'error', 'No puedes chatear contigo mismo');
  end if;
  if not public.are_mutual(v_me, _other_id) then
    return jsonb_build_object('ok', false, 'error', 'Solo puedes chatear con personas que te siguen mutuamente');
  end if;
  -- Buscar un chat dm existente con ambos miembros (el tipo válido en la
  -- tabla chats es 'direct', definido por su CHECK constraint)
  select c.id into v_chat_id
  from public.chats c
  join public.chat_members a on a.chat_id = c.id and a.user_id = v_me
  join public.chat_members b on b.chat_id = c.id and b.user_id = _other_id
  where c.type = 'direct'
  limit 1;
  if v_chat_id is null then
    insert into public.chats (type, name, created_by, is_community)
    values ('direct', 'Chat individual', v_me, false)
    returning id into v_chat_id;
    insert into public.chat_members (chat_id, user_id, role) values
      (v_chat_id, v_me, 'member'),
      (v_chat_id, _other_id, 'member');
  end if;
  return jsonb_build_object('ok', true, 'chat_id', v_chat_id);
end $$;

-- Lista mis chats individuales: perfil del otro, último mensaje y no leídos.
create or replace function public.my_dm_chats()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'last_at' desc nulls last), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'chat_id', c.id,
      'other', (select to_jsonb(p) from public.profiles p where p.id = (
        select m.user_id from public.chat_members m
        where m.chat_id = c.id and m.user_id <> auth.uid() limit 1
      )),
      'last_message', (select to_jsonb(msg) from public.chat_messages msg
        where msg.chat_id = c.id order by msg.created_at desc limit 1),
      'last_at', (select max(msg.created_at) from public.chat_messages msg where msg.chat_id = c.id),
      'unread', (select count(*) from public.chat_messages msg
        where msg.chat_id = c.id and msg.sender_id <> auth.uid()
          and (msg.created_at > coalesce(
            (select m.last_read_at from public.chat_members m
             where m.chat_id = c.id and m.user_id = auth.uid()),
            'epoch'::timestamptz)))
    ) x
    from public.chats c
    join public.chat_members cm on cm.chat_id = c.id and cm.user_id = auth.uid()
    where c.type = 'direct'
  ) t
$$;

-- Perfiles con los que me sigo mutuamente (para el apartado de DMs).
create or replace function public.my_mutual_follows()
returns setof public.profiles language sql stable security definer set search_path = public as $$
  select p.* from public.profiles p
  where public.are_mutual(auth.uid(), p.id)
$$;

-- Marca como leído un chat individual (actualiza last_read_at del participante).
create or replace function public.mark_dm_read(_chat_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.chat_members set last_read_at = now()
  where chat_id = _chat_id and user_id = auth.uid();
$$;

-- ─────── RPC: AVISOS Y REGALOS ───────
-- ¿El usuario conectado es el administrador propietario? Solo
-- linkyteam989@gmail.com puede publicar avisos y crear paquetes de regalo.
create or replace function public.is_owner_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'linkyteam989@gmail.com'
$$;

-- Publica un aviso del grupo, destacado y visible para todos (solo admin).
create or replace function public.create_announcement(_chat_id uuid, _content text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_admin uuid := auth.uid();
  v_msg jsonb;
begin
  if v_admin is null then
    return jsonb_build_object('ok', false, 'error', 'Inicia sesión para publicar avisos');
  end if;
  if not public.is_owner_admin() then
    return jsonb_build_object('ok', false, 'error', 'Solo el administrador puede publicar avisos');
  end if;
  if _content is null or length(trim(_content)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'El aviso no puede estar vacío');
  end if;
  insert into public.chat_messages (chat_id, sender_id, content, kind)
    values (_chat_id, v_admin, trim(_content), 'announcement')
    returning to_jsonb(chat_messages) into v_msg;
  return jsonb_build_object('ok', true, 'message', v_msg);
end $$;  -- Crea un paquete de regalos de orbes en el chat (cualquier usuario con
  -- saldo suficiente). Descuenta el total (cantidad x personas) de los orbes
  -- del creador al instante.
create or replace function public.create_orb_gift(_chat_id uuid, _title text, _amount_per_person bigint, _max_claims int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_admin uuid := auth.uid();
  v_total bigint;
  v_gift_id uuid;
  v_balance bigint;
  v_msg jsonb;
begin
  if v_admin is null then
    return jsonb_build_object('ok', false, 'error', 'Inicia sesión para crear regalos');
  end if;
  if _amount_per_person is null or _amount_per_person < 100 or mod(_amount_per_person, 2) <> 0 then
    return jsonb_build_object('ok', false, 'error', 'La cantidad por persona debe ser par y de mínimo 100 orbes');
  end if;
  if _max_claims is null or _max_claims < 1 or _max_claims > 1000 then
    return jsonb_build_object('ok', false, 'error', 'La cantidad de personas debe estar entre 1 y 1000');
  end if;
  v_total := _amount_per_person * _max_claims;
  select coalesce(orbes, 0) into v_balance from public.profiles where id = v_admin;
  if v_balance < v_total then
    return jsonb_build_object('ok', false, 'error',
      'No tienes suficientes orbes: necesitas ' || v_total || ' y tienes ' || v_balance);
  end if;
  update public.profiles set orbes = orbes - v_total, updated_at = now() where id = v_admin;
  insert into public.orbe_transactions (user_id, amount, kind, description)
    values (v_admin, -v_total, 'adjustment', 'Paquete de regalos: ' || coalesce(nullif(trim(_title), ''), 'Regalo comunitario'));
  insert into public.orb_gifts (chat_id, created_by, amount_per_person, max_claims, total_orbes, expires_at)
    values (_chat_id, v_admin, _amount_per_person, _max_claims, v_total, now() + interval '24 hours')
    returning id into v_gift_id;
  insert into public.chat_messages (chat_id, sender_id, content, kind, gift_id)
    values (_chat_id, v_admin, coalesce(nullif(trim(_title), ''), '¡Hay regalos para la comunidad! 🎁'), 'gift', v_gift_id)
    returning to_jsonb(chat_messages) into v_msg;
  return jsonb_build_object('ok', true, 'gift_id', v_gift_id, 'total', v_total, 'message', v_msg);
end $$;

-- Abre un regalo: reserva un hueco del paquete, acredita los orbes al usuario
-- y cierra el paquete con su animación cuando se llenan todos los huecos.
create or replace function public.claim_orb_gift(_gift_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_row public.orb_gifts%rowtype;
  v_closed boolean := false;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'Inicia sesión para abrir el regalo');
  end if;
  select * into v_row from public.orb_gifts where id = _gift_id;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'El paquete de regalos no existe');
  end if;
  if v_row.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'Este paquete ya se cerró');
  end if;
  if exists (select 1 from public.orb_gift_claims where gift_id = _gift_id and user_id = v_user) then
    return jsonb_build_object('ok', false, 'error', 'Ya abriste este regalo');
  end if;
  -- Reserva atómica del hueco: solo se concede si aún quedan plazas.
  update public.orb_gifts set claims = claims + 1
  where id = _gift_id and status = 'open' and claims < max_claims
  returning * into v_row;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'El paquete ya se llenó y se cerró');
  end if;
  if v_row.claims >= v_row.max_claims then
    update public.orb_gifts set status = 'closed', closed_at = now()
    where id = _gift_id;
    v_closed := true;
  end if;
  insert into public.orb_gift_claims (gift_id, user_id) values (_gift_id, v_user);
  update public.profiles set orbes = orbes + v_row.amount_per_person, updated_at = now()
  where id = v_user;
  insert into public.orbe_transactions (user_id, amount, kind, description)
    values (v_user, v_row.amount_per_person, 'adjustment', 'Regalo de la comunidad');
  return jsonb_build_object('ok', true, 'amount', v_row.amount_per_person, 'claims', v_row.claims, 'closed', v_closed);
end $$;

-- Estado actual de un paquete de regalo (para la tarjeta del chat).
create or replace function public.get_orb_gift(_gift_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', g.id,
    'chat_id', g.chat_id,
    'created_by', g.created_by,
    'amount_per_person', g.amount_per_person,
    'max_claims', g.max_claims,
    'claims', g.claims,
    'total_orbes', g.total_orbes,
    'status', g.status,
    'created_at', g.created_at,
    'closed_at', g.closed_at,
    'expires_at', g.expires_at,
    'claimed_by_me', exists (select 1 from public.orb_gift_claims c where c.gift_id = g.id and c.user_id = auth.uid())
  )
  from public.orb_gifts g
  where g.id = _gift_id
$$;

-- Caducidad: si en 24 horas el paquete no se llenó, se cierra y se devuelven
-- al creador los orbes que nadie reclamó (con su registro de transacción).
create or replace function public.expire_orb_gifts()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_gift record;
  v_claimed bigint;
  v_unclaimed bigint;
  v_count int := 0;
begin
  for v_gift in
    select id, created_by, total_orbes from public.orb_gifts
    where status = 'open' and expires_at < now()
  loop
    select count(*) into v_claimed
    from public.orb_gift_claims where gift_id = v_gift.id;
    v_unclaimed := greatest(v_gift.total_orbes - v_claimed * (select amount_per_person from public.orb_gifts where id = v_gift.id), 0);

    update public.orb_gifts
    set status = 'expired', closed_at = now()
    where id = v_gift.id and status = 'open';

    if v_unclaimed > 0 then
      update public.profiles
      set orbes = orbes + v_unclaimed, updated_at = now()
      where id = v_gift.created_by;
      insert into public.orbe_transactions (user_id, amount, kind, description)
        values (v_gift.created_by, v_unclaimed, 'refund',
          'Reembolso de paquete de regalos caducado (' || v_unclaimed || ' orbes sin reclamar)');
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Realtime: los mensajes nuevos llegan al instante a todos los clientes conectados.
-- Se protege por si la publicación ya existe o el proyecto no la tiene.
do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.chats;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.chat_members;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.orb_gifts;
  exception when duplicate_object then null;
  end;
exception when undefined_object then
  null;
end $$;
`;
