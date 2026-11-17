## 1. Database

- [x] 1.1 Create migration `0010_create_lancamentos.sql` with all columns and CHECK constraints (natureza, forma_pagamento, status_pagamento, tipo↔natureza, centro_custo↔natureza, num_parcelas↔forma, data_prevista↔forma), FKs to clientes/contratos/processos/centros_custo. _(filename adjusted — migrations 0001–0009 already taken.)_
- [x] 1.2 Create migration `0011_create_parcelas.sql` with FK ON DELETE CASCADE to lancamentos, CHECK constraint on `status`.
- [x] 1.3 Add indexes: `lancamentos(cliente_id/contrato_id/processo_id)`, `lancamentos(natureza, status_pagamento)`, `lancamentos(data_prevista)`, `lancamentos(centro_custo_id)`, `parcelas(lancamento_id/data_prevista/status)`.
- [x] 1.4 Wire migrations into plugin-sql migrations array.

## 2. Backend (data layer)

> See CLAUDE.md — plugin-sql is JS-driven; logic lives in `src/features/lancamentos/api.ts`. No manual transactions (pooled connections); validation runs before any write so the multi-statement parcela generation cannot fail mid-way.

- [x] 2.1 Implement `lancamentosCreate(input)` — validates tipo/natureza match, centro_custo/natureza rules, forces garantido=false for sucumbencia/acordo, generates parcelas if parcelado, sets data_prevista NULL on the parent for parcelado.
- [x] 2.2 Implement `lancamentosUpdate(id, input)` — same validations; locks valor/num_parcelas/forma/first-parcela date once a parcela is paid; regenerates parcelas when no payment exists.
- [x] 2.3 Implement `lancamentosDelete(id)` — parcelas cascade via the FK.
- [x] 2.4 Implement `lancamentosList(filters)` — rich filtering; the `status_pagamento` filter applies to a computed `status_efetivo` so overdue pendentes surface as inadimplente.
- [x] 2.5 Implement `lancamentosGet(id)` returning the lancamento plus its parcelas; `parcelasList(lancamento_id)`.
- [x] 2.6 Implement `lancamentosMarcarPagoAvista(id, data)`, `parcelasMarcarPago(id, data)`, `parcelasDesmarcarPago(id)`.
- [x] 2.7 Implement `recomputeParceladoStatus(id)` (internal) — the only writer to `status_pagamento` for parcelado entries; preserves `cancelado`. Plus `lancamentosCancelar` / `lancamentosReativar`.
- [x] 2.8 Implement `lancamentosRecomputeInadimplencia()` — flips overdue pendente parcelas and avista lancamentos to `inadimplente` and refreshes parcelado parents; runs at app start (App.tsx useEffect).

## 3. Frontend (React + Tailwind)

- [x] 3.1 Build `LancamentosListPage` with a KPI strip, free-text search, natureza and status filter chips.
- [x] 3.2 Build `LancamentoFormPage`: natureza pill toggle drives the tipo Combobox options; centro_custo Combobox appears only for saída; garantido toggle auto-locks for sucumbencia/acordo; forma_pagamento pill toggle drives the parcelado section (num_parcelas + data_primeira_parcela). All dropdowns are autocomplete Comboboxes. Structural fields lock when a parcela is paid. Supports `?cliente_id=&contrato_id=&processo_id=` deep links.
- [x] 3.3 Build `ParcelasPreview` showing the computed same-day-of-month schedule live before save.
- [x] 3.4 Build `LancamentoDetailPage`: resumo card (status, valor total, recebido, cancelar/reativar), detalhes, `ParcelasTable` with per-parcela "Pagar" + "Desfazer" (parcelado), single "Marcar como pago" action (avista).
- [x] 3.5 Embed `LancamentosSection` inside `ContratoDetailPage`, `ProcessoDetailPage` and `ClienteDetailPage`, with a "Novo lançamento" CTA that pre-fills cliente / contrato / processo via deep link.
- [x] 3.6 Reuse the `CurrencyInput` (BRL accumulator) for valor; add `StatusPagamentoBadge` for the status colour language.

## 4. Verification

- [x] 4.1 `npx tsc --noEmit` passes; `npm run build` succeeds.
- [x] 4.2 `clientesStatusFinanceiro` and `contratosResumoFinanceiro` were upgraded from placeholders to real aggregations over lancamentos + parcelas.
- [x] 4.3 Run `npx openspec validate add-lancamentos-module`.
- [ ] 4.4 Manual smoke test (requires Rust toolchain): create avista entrada and mark paid; create parcelado mensalidade with 6 parcelas, verify the same-day-of-month schedule, mark one parcela paid → parent flips to `parcialmente_pago`; cancel a parcelado; attempt to change num_parcelas after a payment (must be rejected).
