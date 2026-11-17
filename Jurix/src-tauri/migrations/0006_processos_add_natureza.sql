-- Add natureza (judicial / administrativo) to processos.
-- Rename numero_cnj → numero_processo (semantics differ by natureza).
-- For administrativo, the number is free-form text (no length constraint, no mask at the UI).
--
-- SQLite cannot drop CHECK constraints in place, so we recreate the table.

DROP INDEX IF EXISTS idx_processos_numero_cnj;
DROP INDEX IF EXISTS idx_processos_cliente_id;
DROP INDEX IF EXISTS idx_processos_status;

CREATE TABLE processos_new (
  id                   TEXT PRIMARY KEY,
  cliente_id           TEXT NOT NULL REFERENCES clientes(id),
  natureza             TEXT NOT NULL DEFAULT 'judicial'
                          CHECK (natureza IN ('judicial', 'administrativo')),
  numero_processo      TEXT,
  vara                 TEXT,
  tribunal             TEXT,
  comarca              TEXT,
  fase                 TEXT NOT NULL DEFAULT 'conhecimento'
                          CHECK (fase IN ('conhecimento', 'recurso', 'execucao', 'arquivado', 'outro')),
  fase_custom          TEXT,
  parte_adversa        TEXT,
  advogado_adversario  TEXT,
  oab_adversario       TEXT,
  valor_causa          INTEGER,
  chance_exito         INTEGER         CHECK (chance_exito IS NULL OR (chance_exito >= 0 AND chance_exito <= 100)),
  link_documentos      TEXT,
  status               TEXT NOT NULL DEFAULT 'em_andamento'
                          CHECK (status IN ('em_andamento', 'encerrado', 'suspenso')),
  observacoes          TEXT,
  criado_em            TEXT NOT NULL,
  atualizado_em        TEXT NOT NULL,

  -- Length invariant: only judicial requires 20 digits. Administrativo is free.
  CHECK (
    natureza = 'administrativo'
    OR numero_processo IS NULL
    OR length(numero_processo) = 20
  ),

  -- fase/fase_custom invariant: only 'outro' uses fase_custom
  CHECK (
    (fase = 'outro' AND fase_custom IS NOT NULL AND length(trim(fase_custom)) > 0)
    OR
    (fase <> 'outro' AND fase_custom IS NULL)
  )
);

-- Migrate data: every existing row defaults to natureza='judicial'.
INSERT INTO processos_new (
  id, cliente_id, natureza, numero_processo, vara, tribunal, comarca,
  fase, fase_custom, parte_adversa, advogado_adversario, oab_adversario,
  valor_causa, chance_exito, link_documentos, status, observacoes,
  criado_em, atualizado_em
)
SELECT
  id, cliente_id, 'judicial', numero_cnj, vara, tribunal, comarca,
  fase, fase_custom, parte_adversa, advogado_adversario, oab_adversario,
  valor_causa, chance_exito, link_documentos, status, observacoes,
  criado_em, atualizado_em
FROM processos;

DROP TABLE processos;
ALTER TABLE processos_new RENAME TO processos;

-- Recreate indexes. Uniqueness only applies to judicial processo numbers (CNJs).
-- Administrativo numbers may legitimately repeat across different agencies.
CREATE UNIQUE INDEX idx_processos_numero_judicial
  ON processos(numero_processo)
  WHERE numero_processo IS NOT NULL AND natureza = 'judicial';

CREATE INDEX idx_processos_cliente_id ON processos(cliente_id);
CREATE INDEX idx_processos_status     ON processos(status);
