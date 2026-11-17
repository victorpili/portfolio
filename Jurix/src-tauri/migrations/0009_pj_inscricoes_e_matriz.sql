-- PJ enhancements:
--  1. matriz / filial relationship between clientes (self-referential FK).
--  2. inscrições estaduais sub-registry — one free-text registration per UF.

-- 1. Matriz / filial. NULL for PF; 'matriz' or 'filial' for PJ.
ALTER TABLE clientes ADD COLUMN tipo_unidade TEXT
  CHECK (tipo_unidade IS NULL OR tipo_unidade IN ('matriz', 'filial'));

-- matriz_id points at the PJ cliente that is this filial's matriz.
-- Foreign keys added via ALTER TABLE must default to NULL.
ALTER TABLE clientes ADD COLUMN matriz_id TEXT REFERENCES clientes(id);

CREATE INDEX IF NOT EXISTS idx_clientes_matriz_id ON clientes(matriz_id);

-- 2. Inscrições estaduais — one per (cliente, estado).
CREATE TABLE IF NOT EXISTS inscricoes_estaduais (
  id          TEXT PRIMARY KEY,
  cliente_id  TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  estado      TEXT NOT NULL,
  inscricao   TEXT NOT NULL,
  criado_em   TEXT NOT NULL,
  UNIQUE (cliente_id, estado)
);

CREATE INDEX IF NOT EXISTS idx_inscricoes_estaduais_cliente_id
  ON inscricoes_estaduais(cliente_id);
