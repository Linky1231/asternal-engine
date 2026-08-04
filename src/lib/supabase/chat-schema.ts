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
  created_at timestamptz not null default now()
);

-- Para instalaciones previas que aún no tienen la columna (audio de voz)
alter table public.chat_messages add column if not exists media_type text not null default 'image';

create index if not exists chat_messages_chat_created_idx on public.chat_messages (chat_id, created_at);
create index if not exists chat_members_user_idx on public.chat_members (user_id);

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

-- Limpieza total: elimina CUALQUIER política previa de las tablas del chat,
-- incluidas las de instalaciones antiguas con otros nombres que provocan el
-- error «infinite recursion detected in policy for relation chat_members».
-- Después se recrean abajo las políticas definitivas.
do $$
declare _t text;
declare _p record;
begin
  for _t in select unnest(array['chats', 'chat_members', 'chat_messages', 'stickers']) loop
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

-- chat_messages: lectura pública, cada usuario escribe/edita/elimina solo lo suyo
create policy chat_messages_read on public.chat_messages for select using (true);
create policy chat_messages_insert on public.chat_messages for insert with check (auth.uid() = sender_id);
create policy chat_messages_update on public.chat_messages for update using (auth.uid() = sender_id);
create policy chat_messages_delete on public.chat_messages for delete using (auth.uid() = sender_id);

-- stickers: biblioteca privada de cada cuenta
create policy stickers_select on public.stickers for select using (auth.uid() = user_id);
create policy stickers_insert on public.stickers for insert with check (auth.uid() = user_id);
create policy stickers_delete on public.stickers for delete using (auth.uid() = user_id);

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
exception when undefined_object then
  null;
end $$;
`;
