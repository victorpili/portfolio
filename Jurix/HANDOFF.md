# Jurix — Documento de Handoff

Sistema de gestão para advogados autônomos. App desktop local (Tauri 2) com dados em SQLite.
Este documento descreve a arquitetura, o estado atual e o contexto necessário para continuar o desenvolvimento.

> Documentos relacionados no repositório:
> - [`CLAUDE.md`](CLAUDE.md) — guia curto para sessões automatizadas (decisões-chave).
> - [`openspec/`](openspec/) — specs de cada módulo (proposal, design, spec, tasks).

---

## 1. Visão geral & stack

| Camada | Tecnologia |
|---|---|
| Shell desktop | Tauri 2 (backend Rust) |
| Frontend | React 19 + TypeScript 5.8 + Vite 7 |
| Estilo | Tailwind CSS v4 (plugin `@tailwindcss/vite`) |
| Banco de dados | SQLite local via `@tauri-apps/plugin-sql` |
| Roteamento | `react-router-dom` 7 |
| Ícones | `@phosphor-icons/react` (sempre `weight="light"`) |
| Fontes | `@fontsource-variable/plus-jakarta-sans` (UI) + `@fontsource-variable/fraunces` (display) |
| IDs | `uuid` v4 |
| Specs | `@fission-ai/openspec` (devDependency) |
| Datas | utilitários próprios em `src/lib/format/dates.ts` + `date-fns` (usado pelo dashboard) |
| Gráficos | `recharts` 3 — só no dashboard, carregado sob demanda via `React.lazy` |

**O projeto está na pasta `Jurix/`** deste repositório.
Todos os comandos npm rodam de dentro de `Jurix/`.

```bash
cd Jurix
npm install
npm run tauri dev        # exige Rust instalado (https://rustup.rs/)
npm run build            # tsc + vite build — NÃO exige Rust
npx tsc --noEmit         # type-check
npx openspec list        # status das specs
npx openspec validate <change>
```

> **Rust** só é necessário para `npm run tauri dev` / `tauri build`. Todo o trabalho de
> TypeScript, build do Vite e validação OpenSpec roda sem Rust.

---

## 2. Decisões técnicas (com justificativa)

### 2.1 Acesso ao banco: JS-driven via `tauri-plugin-sql`
As migrations são registradas em [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) e ficam como
arquivos `.sql` em [`src-tauri/migrations/`](src-tauri/migrations/). Rodam automaticamente no
boot do app. As queries em runtime usam `Database.load("sqlite:jurix.db")` direto do React
(`src/lib/db.ts` expõe um singleton).

Não há comandos Rust customizados — a spec original pedia "Rust commands for CRUD", mas como o
plugin-sql já é uma ponte de comandos Tauri, a regra foi cumprida por ele. A lógica de negócio
vive na camada de API em TypeScript (`src/features/<modulo>/api.ts`), reforçada por `CHECK`
constraints e índices únicos parciais no SQL.

### 2.2 ⚠️ NUNCA usar `BEGIN`/`COMMIT` manual com plugin-sql
O plugin usa um **pool de conexões**: cada `db.execute()`/`db.select()` pode rodar numa conexão
diferente. Um `BEGIN` numa chamada e `COMMIT` em outra deixam uma transação pendurada e
**travam o banco** (`database is locked`). Isso já causou um bug (ver §5).

Para atomicidade multi-statement: usar `ON DELETE CASCADE` nas FKs (o SQLite envolve cada
statement numa transação implícita), ou statements independentes ordenados quando a validação
garante que não vão falhar. **Não escrever transações à mão em TS.**

### 2.3 Moeda em centavos (INTEGER)
Todo valor monetário é `INTEGER` de centavos no banco e na camada de API. Formatação BRL
(`R$ 1.234,56`) é só na apresentação. Utilitários em `src/lib/format/currency.ts`. O componente
`CurrencyInput` recebe/emite centavos.

### 2.4 Documentos como dígitos puros
CPF, CNPJ, CEP, telefone e número CNJ são gravados **só com dígitos**. Máscara é aplicada na
digitação e na exibição (`src/lib/format/documents.ts`). Índices únicos parciais garantem
unicidade apenas quando o valor existe.

### 2.5 Linguagem visual: Soft Structuralism + acento editorial
Definida em `src/index.css` via `@theme`. Canvas off-white, tinta carvão, um único acento
azul-marinho. Display serif (Fraunces) para h1/h2; sans (Plus Jakarta Sans) para UI. Cards usam
o padrão **Double-Bezel** (casca externa com hairline + núcleo interno com inset highlight) pelo
componente `Card`. Transições usam o cubic-bezier `--ease-out-soft`. Sem cores excessivas — as
semânticas (`positive`/`warning`/`critical`) são reservadas para badges de status.

### 2.6 Todo dropdown é um Combobox com autocomplete
Exigência explícita do usuário (advogado com muitos cadastros). O componente
`src/components/ui/Combobox.tsx` faz filtro por substring acento-insensível, navegação por
teclado, `allowClear`, `dotColor` (ponto colorido por opção). **Nenhum `<select>` nativo em
formulários novos.** Escolhas binárias categóricas (PF/PJ, judicial/administrativo, matriz/filial,
entrada/saída, à vista/parcelado) usam *pill toggle* — não são dropdowns.

### 2.7 Inadimplência computada
Um lançamento/parcela `pendente` com `data_prevista` no passado é tratado como `inadimplente`.
As queries de leitura computam isso na hora (SQL `CASE`); além disso
`lancamentosRecomputeInadimplencia()` persiste o estado e roda no boot do app (`App.tsx`).

### 2.8 Classificação efetiva no Dashboard (`garantido` × status)
Os KPIs de cenário e o gráfico Fluxo Mensal **não usam a flag `garantido` crua** — derivam uma
classificação **efetiva** combinando flag + status de pagamento:

| Status | Entrada | Saída |
|---|---|---|
| **Pago** | garantido | garantido |
| **Pendente em dia** | flag do usuário | flag do usuário |
| **Vencido e não pago** | incerto (a garantia falhou) | garantido (dívida vencida é certa) |

Calculado por `CASE` no bloco SQL `MOVIMENTOS` em `features/dashboard/api.ts`. O "vencido" é
inferido na hora (`data_prevista < hoje`), cobrindo tanto o status `inadimplente` persistido
quanto um `pendente` que já passou da data. A flag do lançamento permanece intocada — só o
dashboard interpreta.

O gráfico **Fluxo Mensal** ancora os lançamentos **pagos** pela `data_pagamento` (regime de caixa,
alinha com livro-caixa) e os **pendentes futuros** pela `data_prevista`, recortados de hoje em
diante. A escolha de cenário (lucro garantido / pior / melhor), clicável nos cards de KPI,
filtra quais lançamentos pendentes entram no trecho futuro do gráfico. Quando o período abrange
um único mês, o mês anterior é prependido para a linha não virar um ponto solto.

---

## 3. Status atual

### ✅ Concluído

| Módulo | Estado | Spec (tasks) |
|---|---|---|
| Cadastros Auxiliares | Completo (backend + tela `/configuracoes`, 5 abas, CRUD inline, guarda de exclusão) | `add-cadastros-auxiliares` 16/17 |
| 1 — Clientes | Completo (PF/PJ, contatos PJ, inscrições estaduais, matriz/filial) | `add-clientes-module` 19/21 |
| 2 — Processos | Completo (judicial/administrativo, CNJ, fase, chance de êxito) | `add-processos-module` 19/20 |
| 3 — Contratos | Completo (código auto CTR-AAAA-NNNN, resumo financeiro) | `add-contratos-module` 18/19 |
| 4 — Lançamentos + Parcelas | Completo (geração de parcelas, status derivado, inadimplência) | `add-lancamentos-module` 21/22 |
| 5 — Agenda | Completo (calendário/semana/próximos, eventos, alerta, `AgendaSection` embutida) | `add-agenda-module` 17/19 |
| 6 — Dashboard Financeiro | Completo (período, KPIs, gráficos recharts, projeção 3/6/12, simulador) | `add-dashboard-financeiro` 22/23 |

As tasks restantes em cada change são, em geral, smoke tests manuais (exigem Rust) já validados
pelo usuário em conversa.

### ⏳ Pendente

Todos os módulos das specs originais estão implementados. Não há frentes pendentes —
apenas smoke tests manuais (exigem Rust) e melhorias futuras. `ComingSoonPage` não é mais
referenciado por nenhuma rota.

---

## 4. Padrões de código estabelecidos

### 4.1 Estrutura de pastas
```
jurix/
├── src-tauri/
│   ├── migrations/000N_verbo_substantivo.sql   # versionadas, nunca editar uma já aplicada
│   └── src/lib.rs                              # registra plugins + migrations
└── src/
    ├── index.css                  # Tailwind v4 + @theme tokens
    ├── App.tsx                    # rotas + recompute de inadimplência no boot
    ├── lib/
    │   ├── db.ts                  # singleton Database.load()
    │   ├── cn.ts                  # helper de classnames
    │   ├── errors.ts              # ValidationError / ConflictError / DeleteBlockedError
    │   └── format/                # documents.ts, currency.ts, dates.ts
    ├── components/
    │   ├── ui/                    # Button, Card, Input, Select, Combobox, CurrencyInput,
    │   │                          # Badge, EmptyState, PageHeader, Toast, ConfirmDialog
    │   └── layout/                # AppShell, Sidebar
    └── features/<modulo>/
        ├── types.ts               # interfaces do domínio
        ├── api.ts                 # CRUD + regras de negócio
        ├── pages/                 # <Entidade>ListPage / FormPage / DetailPage
        └── components/            # badges, sections embutíveis, helpers
```

### 4.2 Convenções de nomenclatura
- **Funções de API**: `<entidade>Create/Update/Delete/Get/List` em camelCase
  (`clientesCreate`, `processosList`, `contratosResumoFinanceiro`). Sub-entidades seguem o pai:
  `contatosPjCreate`, `inscricoesEstaduaisSync`, `parcelasMarcarPago`.
- **Tipos**: PascalCase. `<Entidade>` (linha do banco), `<Entidade>Input` (payload de form),
  `<Entidade>ListRow` (linha enriquecida da lista), `<Entidade>ListFilters`.
- **Páginas**: `<Entidade>ListPage`, `<Entidade>FormPage`, `<Entidade>DetailPage`.
- **Seções embutíveis**: `<Entidade>Section` (ex.: `ProcessosSection`, `LancamentosSection`) —
  recebem um `context` discriminado por `kind` quando aparecem em mais de um pai.
- **SQL**: colunas em snake_case; toda tabela tem `criado_em`/`atualizado_em` (ISO string);
  migrations `000N_verbo_substantivo.sql` sequenciais.
- **Rotas**: `/<modulo>`, `/<modulo>/novo`, `/<modulo>/:id`, `/<modulo>/:id/editar`.
  Deep-links de criação pré-preenchem via query string (`?cliente_id=...&contrato_id=...`).

### 4.3 Padrão da camada de API
Cada função: recebe input TS → normaliza (tira pontuação, trim) → valida (lança
`ValidationError`/`ConflictError`/`DeleteBlockedError`) → chama `db.execute()`/`db.select()`.
Referências cross-módulo (ex.: `clientesDelete` checando `contratos`) são guardadas por checagem
de existência em `sqlite_master`, permitindo entregar módulos em qualquer ordem.

### 4.4 Padrão das telas de formulário
Estado local num único objeto `FormState`; função `set(key, value)` que também limpa o erro do
campo; `validate()` retorna boolean e popula `errors`; `toInput(state)` converte para o
`<Entidade>Input` da API. Erros de API (`ConflictError`/`ValidationError`) viram toast + erro
inline no campo (`e.field`).

### 4.5 UI
- Cards: componente `Card` (double-bezel) — `<Card className="col-span-N">`.
- Grid das páginas: `grid grid-cols-12 gap-7`.
- Rótulo de seção: classe `eyebrow`.
- Toasts: `useToast()` → `.success()/.error()/.warning()`.
- Confirmações destrutivas: `ConfirmDialog`.
- Badges de status: um por módulo (`StatusProcessoBadge`, `StatusContratoBadge`,
  `StatusFinanceiroBadge`, `StatusPagamentoBadge`) — cores via tokens semânticos.

---

## 5. Problemas encontrados e soluções

| # | Problema | Causa | Solução |
|---|---|---|---|
| 1 | `npm create tauri-app` instalou em subpasta | Comportamento do comando (`jurix` vira pasta) | Rodar sempre os comandos de dentro de `jurix/`. |
| 2 | Rust ausente | Não instalado na máquina | Não bloqueia specs nem `npm run build`; só `tauri dev`. Instalar via rustup. |
| 3 | Pacote OpenSpec errado | `openspec` não existe no npm | O correto é `@fission-ai/openspec`. |
| 4 | CurrencyInput "pulava" o cursor | Input controlado re-renderizava o valor formatado e o cursor ficava no meio | Reescrito com **padrão acumulador** (dígitos entram pela direita) + cursor fixado no fim após cada tecla. |
| 5 | Excluir cliente: `FOREIGN KEY constraint failed` | `processos.cliente_id` sem `ON DELETE` e o delete só checava contratos | `clientesDelete` agora bloqueia se há contrato `ativo` ou processo `em_andamento`, e cascateia `contratos → processos → clientes` em statements ordenados. |
| 6 | `database is locked` | `BEGIN`/`COMMIT` manuais em `execute()` separados, em conexões diferentes do pool | Removidos os `BEGIN`/`COMMIT`; deletes independentes ordenados. Ver §2.2. |
| 7 | `ambiguous column name: criado_em` | `ORDER BY criado_em` sobre JOIN de 3 tabelas que têm a coluna | `lancamentosList` envolve a query interna numa subquery antes do `ORDER BY`. |
| 8 | Matriz/filial em PF ou PJ? | Pedido dizia "pessoa física", mas é conceito de PJ | Confirmado com o usuário: **apenas PJ**. |

---

## 6. Detalhes por módulo concluído

### Cadastros Auxiliares (`features/cadastros/api.ts`)
5 tabelas lookup idênticas: `areas_direito`, `tipos_contrato`, `centros_custo`, `origens`,
`tipos_evento`. Migrations `0001` (criação) e `0002` (seed com defaults BR). `lookupList(table,
{ onlyActive })` é a única função pronta. **Falta** `lookupCreate/Update/ToggleAtivo/Delete` e a
tela `/configuracoes` (5 abas, CRUD inline, guarda de exclusão por referência).

### Módulo 1 — Clientes (`features/clientes/`)
Tabela única PF/PJ (`tipo`). Sub-registros: `contatos_pj` (PJ), `inscricoes_estaduais` (PJ, uma
por UF), matriz/filial (`tipo_unidade` + `matriz_id` auto-referencial). `status_financeiro`
computado de `lancamentos` + `parcelas`. Exclusão bloqueada por contrato ativo / processo em
andamento / filiais; senão cascateia.

### Módulo 2 — Processos (`features/processos/`)
`natureza` judicial/administrativo. Judicial usa CNJ 20 dígitos com máscara; administrativo é
texto livre. `numero_processo` único globalmente. `fase` controlada + `outro`. `chance_exito`
0–100 (alimenta a projeção do dashboard). `valor_causa` em centavos.

### Módulo 3 — Contratos (`features/contratos/`)
Código auto `CTR-AAAA-NNNN` (sequência por ano via `GLOB`, editável). FK para cliente/processo/
area_direito/tipo_contrato. `contratosResumoFinanceiro` agrega faturado/recebido/em aberto de
`lancamentos`+`parcelas`.

### Módulo 4 — Lançamentos + Parcelas (`features/lancamentos/`)
`natureza` entrada/saída; `tipo` condicionado à natureza; `centro_custo` só para saída.
`garantido` é uma flag editável tanto em entradas (garantida/não garantida) quanto em saídas
(garantida/incerta) — forçada a false apenas para sucumbência/acordo. Alimenta os KPIs de
cenário do dashboard (classificação efetiva em §2.8). À vista vs parcelado. **Parcelas geradas no
mesmo dia do mês, com clamp ao último dia** (`addMonthsClamped` em `dates.ts`). Status do
parcelado derivado das parcelas; `cancelado` é sticky. Inadimplência computada (§2.7). Mudança
estrutural bloqueada após parcela paga. A **data de pagamento** (parcela e à vista) é editável
inline no detalhe via `<input type="date">` com commit no `onBlur` — assim o usuário pode navegar
livremente o seletor sem cada mudança de mês disparar um save e recarregar a tela.

### Módulo 5 — Agenda (`features/agenda/`)
Tabela `agenda_eventos` (migration `0012`) com FK obrigatória para `tipos_evento` + FKs opcionais
para cliente/processo/contrato, todas com `ON DELETE CASCADE` (eventos são satélites). Campos:
`titulo`, `data_hora` (ISO local), `alerta_dias` (0–365, default 1), `status`
(`pendente`/`concluido`/`cancelado`), `descricao`. API: `agendaCreate/Update/Delete`,
`agendaSetStatus`, `agendaListCalendar(year, month)`, `agendaListWindow(de, ate, statuses)`,
`agendaListByEntity`. UI: `AgendaPage` com 4 modos (calendário grid CSS puro, semana,
próximos 7, próximos 30) + `EventoFormDialog` (modal com auto-fill do cliente a partir do
processo, e do contrato a partir do processo quando há apenas um vinculado) + `AgendaSection`
embutida em cliente/processo/contrato detail. Alerta visual ("🔔 alerta") em `EventoListItem`
quando `pendente` E hoje ∈ `[data_hora − alerta_dias, data_hora]`.

### Módulo 6 — Dashboard Financeiro (`features/dashboard/`)
Read-only sobre o schema existente — **sem novas tabelas**. Camada de API em
`features/dashboard/api.ts` com blocos SQL compartilhados (`RECEBIMENTOS_ENTRADA`, `SAIDAS_PAGAS`,
`RECEBIVEIS_PENDENTES`, `ENTRADAS_FUTURAS`, `SAIDAS_FUTURAS`, `MOVIMENTOS`, `CHART_MOVIMENTOS`).
A página é carregada sob demanda via `React.lazy` em `App.tsx` para tirar o `recharts` do bundle
inicial — vira chunk separado de ~440 KB que só baixa ao abrir `/dashboard`.

**Visão Geral**: seletor de período (`mes_atual` / `trimestre` / `ano` / `personalizado`), 4 KPIs
realizados (entradas recebidas, saídas pagas, ticket médio, inadimplência) + trio "Cenários do
período" — **Pior cenário** / **Lucro garantido** / **Melhor cenário** — **clicáveis** para
escolher qual cenário governa o trecho futuro do gráfico. Banner de concentração quando ≥3
clientes pagantes E o top >40% do faturamento. Gráfico Fluxo Mensal: área (linhas com fill em
gradiente — verde entradas, vermelho saídas; série de maior total é renderizada embaixo para que
a menor fique visível). 2 donuts (receita por área e por tipo de contrato — "Sem contrato" para
itens sem `contrato_id`). Próximos 7/30 dias expansíveis. Tabela de inadimplência paginada,
ordenada por `dias_atrasado` desc.

**Projeção**: cards 3/6/12 meses (`garantidas + ponderadas − saídas`); painel "Sem chance de
êxito atribuída" linkando para `/processos/:id/editar`; **Simulador** (3 modos: novo contrato
mensalista / aumento de despesa fixa / perda de cliente — função pura `simular()` em TS, sem ida
ao backend).

Regras-chave do dashboard (classificação efetiva e âncora do gráfico) estão em §2.8.

---

## 7. Contexto para continuar

Todas as specs originais (módulos 1–6 + Cadastros) estão implementadas (§3). O app já foi
empacotado como **v0.1.0**: instalador Windows gerado (`npm run tauri build`) e `.dmg` macOS em
geração num Mac M5 emprestado para teste com uma advogada. Próxima fase: validação com dados
reais e iteração para v2.

### 7.1 Frentes em aberto (sem spec ainda)

- **Módulo de tributação** — discutido com o usuário (notas no histórico): cobre carnê-leão/IRPF,
  ISS municipal, INSS como contribuinte individual, retenções na fonte e livro-caixa. Insumos já
  presentes no app: entradas/saídas em centavos com `data_pagamento`, classificação por `tipo`,
  cliente PF/PJ (define se há retenção), despesas categorizadas por centro de custo. **Lacunas
  conhecidas**: cadastro do próprio advogado/escritório (CPF, OAB, município, regime INSS), campos
  de retenção (IRRF/ISS/INSS/PIS/COFINS/CSLL) por lançamento, parâmetros fiscais configuráveis,
  `cliente_id` obrigatório em saídas (limitação para despesas gerais do escritório). Quando for
  atacar, criar como `add-tributacao-module`.

- **Lançamento `recorrente`** — diferente de `parcelado` (que tem `num_parcelas` fixo), seria
  aberto e sem fim definido (ex.: aluguel, retainer). Exige migration recriando `lancamentos`
  (CHECK do `forma_pagamento` aceitando `'recorrente'`), decisão de geração de parcelas num
  horizonte rolante (ou modelo virtual em runtime), e integração com dashboard/projeção. Vale
  spec'ar como `add-recorrente-lancamento` **antes** de implementar — tem decisões de design
  importantes.

### 7.2 Checklist ao adicionar um módulo

1. Migration(s) `.sql` numerada(s) sequencialmente + registrar em `src-tauri/src/lib.rs`.
2. `features/<modulo>/types.ts` e `api.ts`.
3. Páginas List/Form/Detail + componentes (badge de status, section embutível quando fizer sentido).
4. Rotas em `App.tsx`; ajustar `Sidebar.tsx` se houver item novo.
5. Todo dropdown = `Combobox`. Moeda = `CurrencyInput`. Datas/documentos = utilitários de
   `lib/format/`.
6. Atualizar `tasks.md` da spec e rodar `npx openspec validate <change>`.
7. `npx tsc --noEmit` e `npm run build` devem passar limpos.

### 7.3 Checklist ao gerar uma release / atualização

1. Bumpar a versão **nos três arquivos** (precisam bater): `package.json`,
   `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.
2. `npm run tauri build` — exige Rust + MSVC no Windows; Xcode CLT no Mac.
3. Output em `src-tauri/target/release/bundle/`:
   - Windows: `nsis/Jurix_<v>_x64-setup.exe`
   - macOS: `dmg/Jurix_<v>_aarch64.dmg` (ou `_universal.dmg` se buildar com
     `--target universal-apple-darwin`).
4. `git tag v<versão>`.
5. **NUNCA mudar o `identifier` `com.jurix.app`** — é a chave que faz o `jurix.db` do usuário
   sobreviver às atualizações (Windows: `%APPDATA%\com.jurix.app\jurix.db`; macOS:
   `~/Library/Application Support/com.jurix.app/jurix.db`).
6. **NUNCA editar uma migration já aplicada** — sempre escrever uma nova sequencial. O usuário
   instala a v2 por cima da v1, e as migrations novas rodam automaticamente sobre o banco existente.

---

## 8. Mapa rápido de arquivos

| Quero… | Arquivo |
|---|---|
| Registrar migration | `src-tauri/src/lib.rs` + `src-tauri/migrations/` |
| Tokens de design / CSS base | `src/index.css` |
| Rotas e boot do app | `src/App.tsx` |
| Conexão com o banco | `src/lib/db.ts` |
| Erros de domínio | `src/lib/errors.ts` |
| Formatar moeda / documento / data | `src/lib/format/{currency,documents,dates}.ts` |
| Componentes de UI reutilizáveis | `src/components/ui/` |
| Shell (sidebar + layout) | `src/components/layout/` |
| Lógica de um módulo | `src/features/<modulo>/api.ts` |
| Specs e progresso | `openspec/changes/<change>/` |
| Decisões resumidas p/ IA | `CLAUDE.md` |

---

## 9. Estado de verificação

- `npx tsc --noEmit` — passa limpo.
- `npm run build` — passa. Bundle inicial ~599 KB / ~156 KB gzip; o Dashboard é carregado sob
  demanda (`React.lazy`), isolando o `recharts` num chunk separado (~446 KB / ~129 KB gzip) que só
  baixa ao abrir `/dashboard`.
- `npx openspec validate` — todos os changes válidos.
- Smoke tests dos módulos 1–6 validados em conversa com o usuário; smoke test num app empacotado
  pendente até o build da v1 ser testado por advogada externa.
- **v0.1.0 empacotada**: instalador Windows gerado; `.dmg` macOS em geração num Mac M5 emprestado.
- `tauri.conf.json`: `productName: "Jurix"`, janela 1280×800 (min 1024×700, centralizada),
  `identifier: com.jurix.app` (**imutável** — preserva os dados entre atualizações).

_Última atualização: após empacotamento da v0.1.0 e ajustes finos do Dashboard (gráfico Fluxo
Mensal por período, KPIs de cenário pela classificação efetiva §2.8, edição inline de data de
pagamento)._
