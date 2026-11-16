import { StrictMode, useReducer } from 'react';
import { createRoot } from 'react-dom/client';
import { estadoInicial, reduzir } from './estado';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Provisório: a nave, o terminal de verdade e o painel chegam nas Tasks 13 e 14.
function App() {
  const [estado] = useReducer(reduzir, undefined, estadoInicial);
  return (
    <main>
      <h1>Nave de Agentes</h1>
      <p>Fase: {estado.fase}</p>
      <ul>
        {estado.linhas.map((l) => (
          <li key={l.seq}>{l.texto}</li>
        ))}
      </ul>
    </main>
  );
}

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
