-- Parcelas — installments auto-generated for parcelado lançamentos.

CREATE TABLE IF NOT EXISTS parcelas (
  id              TEXT PRIMARY KEY,
  lancamento_id   TEXT NOT NULL REFERENCES lancamentos(id) ON DELETE CASCADE,
  numero          INTEGER NOT NULL,
  valor           INTEGER NOT NULL,                 -- cents
  data_prevista   TEXT NOT NULL,
  data_pagamento  TEXT,
  status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'pago', 'inadimplente')),
  observacoes     TEXT
);

CREATE INDEX IF NOT EXISTS idx_parcelas_lancamento_id ON parcelas(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_data_prevista ON parcelas(data_prevista);
CREATE INDEX IF NOT EXISTS idx_parcelas_status        ON parcelas(status);
