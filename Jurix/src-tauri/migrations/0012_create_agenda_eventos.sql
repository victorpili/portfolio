-- Agenda — events (audiências, prazos, reuniões, compromissos).
-- Optional links to cliente / processo / contrato; event kind via tipos_evento lookup.

CREATE TABLE IF NOT EXISTS agenda_eventos (
  id              TEXT PRIMARY KEY,
  titulo          TEXT NOT NULL,
  tipo_evento_id  TEXT NOT NULL REFERENCES tipos_evento(id),
  data_hora       TEXT NOT NULL,                    -- ISO-8601 local instant (YYYY-MM-DDTHH:MM:SS)
  -- Events are satellite data: when a linked parent is deleted, its events go with it.
  cliente_id      TEXT REFERENCES clientes(id) ON DELETE CASCADE,
  processo_id     TEXT REFERENCES processos(id) ON DELETE CASCADE,
  contrato_id     TEXT REFERENCES contratos(id) ON DELETE CASCADE,
  alerta_dias     INTEGER NOT NULL DEFAULT 1 CHECK (alerta_dias BETWEEN 0 AND 365),
  status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'concluido', 'cancelado')),
  descricao       TEXT,
  criado_em       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agenda_data_hora    ON agenda_eventos(data_hora);
CREATE INDEX IF NOT EXISTS idx_agenda_status_data  ON agenda_eventos(status, data_hora);
CREATE INDEX IF NOT EXISTS idx_agenda_cliente_id   ON agenda_eventos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_agenda_processo_id  ON agenda_eventos(processo_id);
CREATE INDEX IF NOT EXISTS idx_agenda_contrato_id  ON agenda_eventos(contrato_id);
