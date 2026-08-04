/**
 * DDL de las tablas del chat comunitario (chats / chat_members / chat_messages).
 *
 * Este bloque es idempotente: puede ejecutarse completo o por partes, tantas
 * veces como sea necesario (create table/index if not exists + drop policy
 * antes de cada create policy + publicación realtime protegida).
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
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_chat_created_idx on public.chat_messages (chat_id, created_at);
create index if not exists chat_members_user_idx on public.chat_members (user_id);

alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;

-- chats: lectura pública, creación por el propio usuario
drop policy if exists chats_read on public.chats;
create policy chats_read on public.chats for select using (true);
drop policy if exists chats_insert on public.chats;
create policy chats_insert on public.chats for insert with check (auth.uid() = created_by);

-- chat_members: lectura pública, cada usuario se añade/elimina a sí mismo
drop policy if exists chat_members_read on public.chat_members;
create policy chat_members_read on public.chat_members for select using (true);
drop policy if exists chat_members_self_insert on public.chat_members;
create policy chat_members_self_insert on public.chat_members for insert with check (auth.uid() = user_id);
drop policy if exists chat_members_self_delete on public.chat_members;
create policy chat_members_self_delete on public.chat_members for delete using (auth.uid() = user_id);

-- chat_messages: lectura pública, cada usuario escribe con su propia identidad
drop policy if exists chat_messages_read on public.chat_messages;
create policy chat_messages_read on public.chat_messages for select using (true);
drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages for insert with check (auth.uid() = sender_id);

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
