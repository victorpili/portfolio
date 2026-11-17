-- Contratos — billable agreements between escritório and cliente, parent of lancamentos.

CREATE TABLE IF NOT EXISTS contratos (
  id                   TEXT PRIMARY KEY,
  codigo               TEXT NOT NULL UNIQUE,
  nome                 TEXT NOT NULL,

  cliente_id           TEXT NOT NULL REFERENCES clientes(id),
  processo_id          TEXT REFERENCES processos(id),
  area_direito_id      TEXT NOT NULL REFERENCES areas_direito(id),
  tipo_contrato_id     TEXT NOT NULL REFERENCES tipos_contrato(id),

  valor_base           INTEGER NOT NULL,        -- cents
  data_inicio          TEXT    NOT NULL,        -- ISO YYYY-MM-DD
  data_encerramento    TEXT,                    -- nullable

  status               TEXT NOT NULL DEFAULT 'ativo'
                          CHECK (status IN ('ativo', 'inativo', 'suspenso')),
  link_documentos      TEXT,
  observacoes          TEXT,
  criado_em            TEXT NOT NULL,
  atualizado_em        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contratos_cliente_id  ON contratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contratos_processo_id ON contratos(processo_id);
CREATE INDEX IF NOT EXISTS idx_contratos_status      ON contratos(status);
CREATE INDEX IF NOT EXISTS idx_contratos_area_direito_id ON contratos(area_direito_id);
