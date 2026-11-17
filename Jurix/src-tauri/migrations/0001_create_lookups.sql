-- Cadastros auxiliares: five identically-shaped lookup tables.
-- Created first so other modules can FK them.

CREATE TABLE IF NOT EXISTS areas_direito (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL COLLATE NOCASE,
  ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em   TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_areas_direito_nome ON areas_direito(nome COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS tipos_contrato (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL COLLATE NOCASE,
  ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em   TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_contrato_nome ON tipos_contrato(nome COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS centros_custo (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL COLLATE NOCASE,
  ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em   TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_centros_custo_nome ON centros_custo(nome COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS origens (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL COLLATE NOCASE,
  ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em   TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_origens_nome ON origens(nome COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS tipos_evento (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL COLLATE NOCASE,
  ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em   TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_evento_nome ON tipos_evento(nome COLLATE NOCASE);
