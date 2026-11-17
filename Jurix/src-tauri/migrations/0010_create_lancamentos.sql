-- Lançamentos — financial entries (entradas / saídas), parent of parcelas.

CREATE TABLE IF NOT EXISTS lancamentos (
  id                TEXT PRIMARY KEY,
  descricao         TEXT,
  natureza          TEXT NOT NULL CHECK (natureza IN ('entrada', 'saida')),
  cliente_id        TEXT NOT NULL REFERENCES clientes(id),
  contrato_id       TEXT REFERENCES contratos(id),
  processo_id       TEXT REFERENCES processos(id),
  tipo              TEXT NOT NULL,
  centro_custo_id   TEXT REFERENCES centros_custo(id),
  garantido         INTEGER NOT NULL DEFAULT 0 CHECK (garantido IN (0, 1)),
  forma_pagamento   TEXT NOT NULL CHECK (forma_pagamento IN ('avista', 'parcelado')),
  num_parcelas      INTEGER,
  valor             INTEGER NOT NULL,                 -- cents (total for avista, per-parcela for parcelado)
  data_prevista     TEXT,                             -- avista only
  data_pagamento    TEXT,                             -- avista only
  status_pagamento  TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status_pagamento IN
                        ('pendente', 'pago', 'parcialmente_pago', 'cancelado', 'inadimplente')),
  numero_documento  TEXT,
  observacoes       TEXT,
  criado_em         TEXT NOT NULL,
  atualizado_em     TEXT NOT NULL,

  -- tipo allowed values depend on natureza
  CHECK (
    (natureza = 'entrada' AND tipo IN
      ('mensalidade', 'pagamento_unico', 'sucumbencia', 'acordo', 'reembolso_custas'))
    OR
    (natureza = 'saida' AND tipo IN
      ('despesa_escritorio', 'custas_processuais', 'reembolso_cliente'))
  ),

  -- centro de custo required for saídas, forbidden for entradas
  CHECK (
    (natureza = 'saida'   AND centro_custo_id IS NOT NULL)
    OR
    (natureza = 'entrada' AND centro_custo_id IS NULL)
  ),

  -- num_parcelas only for parcelado (>= 2)
  CHECK (
    (forma_pagamento = 'parcelado' AND num_parcelas >= 2)
    OR
    (forma_pagamento = 'avista'    AND num_parcelas IS NULL)
  ),

  -- data_prevista only for avista
  CHECK (
    (forma_pagamento = 'avista'    AND data_prevista IS NOT NULL)
    OR
    (forma_pagamento = 'parcelado' AND data_prevista IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_lancamentos_cliente_id   ON lancamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_contrato_id  ON lancamentos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_processo_id  ON lancamentos(processo_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_natureza_st  ON lancamentos(natureza, status_pagamento);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data_prev    ON lancamentos(data_prevista);
CREATE INDEX IF NOT EXISTS idx_lancamentos_centro_custo ON lancamentos(centro_custo_id);
