-- Processos — legal cases, FK to clientes.

CREATE TABLE IF NOT EXISTS processos (
  id                   TEXT PRIMARY KEY,
  cliente_id           TEXT NOT NULL REFERENCES clientes(id),
  numero_cnj           TEXT,           -- 20 digits only when present
  vara                 TEXT,
  tribunal             TEXT,
  comarca              TEXT,
  fase                 TEXT NOT NULL DEFAULT 'conhecimento'
                          CHECK (fase IN ('conhecimento', 'recurso', 'execucao', 'arquivado', 'outro')),
  fase_custom          TEXT,
  parte_adversa        TEXT,
  advogado_adversario  TEXT,
  oab_adversario       TEXT,
  valor_causa          INTEGER,        -- cents
  chance_exito         INTEGER         CHECK (chance_exito IS NULL OR (chance_exito >= 0 AND chance_exito <= 100)),
  link_documentos      TEXT,
  status               TEXT NOT NULL DEFAULT 'em_andamento'
                          CHECK (status IN ('em_andamento', 'encerrado', 'suspenso')),
  observacoes          TEXT,
  criado_em            TEXT NOT NULL,
  atualizado_em        TEXT NOT NULL,

  -- Length invariant for CNJ
  CHECK (numero_cnj IS NULL OR length(numero_cnj) = 20),

  -- fase/fase_custom invariant: only 'outro' uses fase_custom
  CHECK (
    (fase = 'outro' AND fase_custom IS NOT NULL AND length(trim(fase_custom)) > 0)
    OR
    (fase <> 'outro' AND fase_custom IS NULL)
  )
);

-- Partial unique index — NULL CNJs do not collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_processos_numero_cnj
  ON processos(numero_cnj) WHERE numero_cnj IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processos_cliente_id ON processos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_processos_status     ON processos(status);
