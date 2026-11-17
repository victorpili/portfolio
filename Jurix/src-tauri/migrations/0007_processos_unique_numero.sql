-- Broaden the partial unique index on `numero_processo` so it covers BOTH
-- judicial and administrativo entries. Previously the index was scoped to
-- natureza='judicial', which let two administrativo processos share the same
-- number. Within a single user's portfolio we treat any non-null process
-- number as a unique identifier regardless of natureza.

DROP INDEX IF EXISTS idx_processos_numero_judicial;

CREATE UNIQUE INDEX IF NOT EXISTS idx_processos_numero
  ON processos(numero_processo)
  WHERE numero_processo IS NOT NULL;
