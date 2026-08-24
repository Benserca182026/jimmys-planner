-- Esquema de Jimmy's Planner en Supabase.
-- Pegá TODO esto en el SQL Editor de Supabase y apretá Run.
--
-- Nota sobre seguridad: se activa RLS y NO se crea ninguna política. Eso
-- significa que nadie puede leer ni escribir con la clave pública. Sólo el
-- servidor del planner, que usa la clave secreta, tiene acceso. El navegador
-- nunca habla directo con Supabase.

create table if not exists tareas (
  id            integer primary key,
  empresa       text        not null,
  tema          text        not null,
  categoria     text        not null,
  estado        text        not null default 'pendiente',
  agenda        text,
  prioridad     text,                    -- 'Urgente' | 'A' | null
  involucrados  text,
  fecha         text,                    -- 'dd/mm', como en el Excel
  confirmada    text,                    -- 'Si' | 'No' | null (null = no se sabe)
  observaciones text,
  comentarios   jsonb       not null default '[]'::jsonb,
  adjuntos      jsonb       not null default '[]'::jsonb,
  -- Estas dos habilitan la urgencia por abandono, que hasta ahora no se podía
  -- calcular porque el dato no existía en ninguna parte.
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Toca la marca de tiempo en cada cambio, sin que la app tenga que acordarse.
create or replace function tocar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end $$;

drop trigger if exists tareas_actualizado on tareas;
create trigger tareas_actualizado
  before update on tareas
  for each row execute function tocar_actualizado();

-- Vínculo tarea ↔ evento del calendario. Hasta ahora vivía dentro del propio
-- evento de Google; acá queda del lado del tablero y sobrevive a todo.
create table if not exists vinculos_calendario (
  id_tarea   integer primary key references tareas(id) on delete cascade,
  id_evento  text not null,
  creado_en  timestamptz not null default now()
);

create index if not exists tareas_estado_idx    on tareas(estado);
create index if not exists tareas_categoria_idx on tareas(categoria);

alter table tareas               enable row level security;
alter table vinculos_calendario  enable row level security;
