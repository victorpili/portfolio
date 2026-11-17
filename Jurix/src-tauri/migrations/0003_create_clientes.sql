-- Clientes — single table for PF + PJ with type discriminator.

CREATE TABLE IF NOT EXISTS clientes (
  id                       TEXT PRIMARY KEY,
  tipo                     TEXT NOT NULL CHECK (tipo IN ('pf', 'pj')),
  nome                     TEXT NOT NULL,

  -- PF-only fields (NULL for PJ)
  cpf                      TEXT,
  rg                       TEXT,
  data_nascimento          TEXT,    -- ISO YYYY-MM-DD

  -- PJ-only fields (NULL for PF)
  cnpj                     TEXT,
  data_fundacao            TEXT,

  -- Shared
  email                    TEXT,
  telefone                 TEXT,
  cep                      TEXT,
  logradouro               TEXT,
  numero                   TEXT,
  complemento              TEXT,
  bairro                   TEXT,
  cidade                   TEXT,
  estado                   TEXT,    -- UF
  origem_id                TEXT REFERENCES origens(id),
  status_relacionamento    TEXT NOT NULL DEFAULT 'ativo'
                              CHECK (status_relacionamento IN ('ativo', 'inativo')),
  observacoes              TEXT,
  criado_em                TEXT NOT NULL,
  atualizado_em            TEXT NOT NULL,

  -- Type-conditional invariants
  CHECK (
    (tipo = 'pf' AND cnpj IS NULL AND data_fundacao IS NULL)
    OR
    (tipo = 'pj' AND cpf  IS NULL AND rg IS NULL AND data_nascimento IS NULL)
  ),

  -- Document length invariants (only when present)
  CHECK (cpf  IS NULL OR length(cpf)  = 11),
  CHECK (cnpj IS NULL OR length(cnpj) = 14)
);

-- Document uniqueness, partial so NULLs don't collide and only per relevant tipo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_cpf
  ON clientes(cpf) WHERE cpf IS NOT NULL AND tipo = 'pf';
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_cnpj
  ON clientes(cnpj) WHERE cnpj IS NOT NULL AND tipo = 'pj';

CREATE INDEX IF NOT EXISTS idx_clientes_status_relacionamento
  ON clientes(status_relacionamento);
CREATE INDEX IF NOT EXISTS idx_clientes_tipo
  ON clientes(tipo);
CREATE INDEX IF NOT EXISTS idx_clientes_nome
  ON clientes(nome COLLATE NOCASE);
