-- Contatos PJ — child of clientes, only for tipo='pj' (enforced in app layer).

CREATE TABLE IF NOT EXISTS contatos_pj (
  id            TEXT PRIMARY KEY,
  cliente_id    TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  cargo         TEXT,
  email         TEXT,
  telefone      TEXT,
  observacoes   TEXT,
  criado_em     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contatos_pj_cliente_id ON contatos_pj(cliente_id);
