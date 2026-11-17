import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ToastProvider } from "./components/ui/Toast";
import { ClientesListPage } from "./features/clientes/pages/ClientesListPage";
import { ClienteFormPage } from "./features/clientes/pages/ClienteFormPage";
import { ClienteDetailPage } from "./features/clientes/pages/ClienteDetailPage";
import { ProcessosListPage } from "./features/processos/pages/ProcessosListPage";
import { ProcessoFormPage } from "./features/processos/pages/ProcessoFormPage";
import { ProcessoDetailPage } from "./features/processos/pages/ProcessoDetailPage";
import { ContratosListPage } from "./features/contratos/pages/ContratosListPage";
import { ContratoFormPage } from "./features/contratos/pages/ContratoFormPage";
import { ContratoDetailPage } from "./features/contratos/pages/ContratoDetailPage";
import { LancamentosListPage } from "./features/lancamentos/pages/LancamentosListPage";
import { LancamentoFormPage } from "./features/lancamentos/pages/LancamentoFormPage";
import { LancamentoDetailPage } from "./features/lancamentos/pages/LancamentoDetailPage";
import { lancamentosRecomputeInadimplencia } from "./features/lancamentos/api";
import { ConfiguracoesPage } from "./features/cadastros/pages/ConfiguracoesPage";
import { AgendaPage } from "./features/agenda/pages/AgendaPage";

// Lazy-loaded so the recharts bundle stays off the initial load.
const DashboardPage = lazy(() =>
  import("./features/dashboard/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);

function App() {
  // Refresh persisted inadimplência once on app start.
  useEffect(() => {
    lancamentosRecomputeInadimplencia().catch(() => {
      /* non-fatal — read queries also compute inadimplência on the fly */
    });
  }, []);

  return (
    <ToastProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/clientes" replace />} />

          <Route
            path="/dashboard"
            element={
              <Suspense
                fallback={
                  <div className="py-24 text-center text-[var(--color-ink-muted)]">Carregando…</div>
                }
              >
                <DashboardPage />
              </Suspense>
            }
          />

          <Route path="/clientes" element={<ClientesListPage />} />
          <Route path="/clientes/novo" element={<ClienteFormPage />} />
          <Route path="/clientes/:id" element={<ClienteDetailPage />} />
          <Route path="/clientes/:id/editar" element={<ClienteFormPage />} />

          <Route path="/processos" element={<ProcessosListPage />} />
          <Route path="/processos/novo" element={<ProcessoFormPage />} />
          <Route path="/processos/:id" element={<ProcessoDetailPage />} />
          <Route path="/processos/:id/editar" element={<ProcessoFormPage />} />

          <Route path="/contratos" element={<ContratosListPage />} />
          <Route path="/contratos/novo" element={<ContratoFormPage />} />
          <Route path="/contratos/:id" element={<ContratoDetailPage />} />
          <Route path="/contratos/:id/editar" element={<ContratoFormPage />} />

          <Route path="/lancamentos" element={<LancamentosListPage />} />
          <Route path="/lancamentos/novo" element={<LancamentoFormPage />} />
          <Route path="/lancamentos/:id" element={<LancamentoDetailPage />} />
          <Route path="/lancamentos/:id/editar" element={<LancamentoFormPage />} />

          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/configuracoes" element={<ConfiguracoesPage />} />

          <Route path="*" element={<Navigate to="/clientes" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}

export default App;
