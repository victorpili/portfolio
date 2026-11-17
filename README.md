# Portfólio

Projetos em que uso IA para resolver um problema de negócio de ponta a ponta, da ideia ao produto no ar.

| Projeto | O que faz | Pasta |
|---|---|---|
| **Nave de Agentes** | Uma tripulação de agentes do Claude reescreve fichas de produto Shopify para que assistentes de IA as entendam, e mostra o antes e o depois numa nota de 0 a 100. [Demo no ar](https://portfolio-nave-de-agentes.vercel.app). | [`nave-de-agentes/`](nave-de-agentes/) |
| **Jurix** | Sistema de gestão para advogados autônomos, com clientes, processos, contratos, financeiro, agenda e um dashboard com projeção de caixa. Construído do zero em 5 dias com o Claude Code, ele é usado no dia a dia por uma advogada, que estima economizar cerca de 2 horas por dia. [Demo no navegador](https://victorpili.github.io/portfolio/jurix/). | [`Jurix/`](Jurix/) |

Cada pasta é um projeto independente, com o próprio README, instruções para rodar e testes.

## O que cada projeto mostra

| Capacidade | Onde ver |
|---|---|
| **Orquestração de agentes** | Na Nave de Agentes, três agentes do Claude (Pesquisador, Redator e Revisor) trabalham em sequência. Um coordenador e um verificador escritos em código conferem cada entrega e a devolvem ao agente quando ela falha. |
| **Prompt engineering** | Os [prompts da Nave](nave-de-agentes/prompts/) exigem saída estruturada validada por schema, tratam a ficha da loja como dado e não como instrução, e foram ajustados em ciclos de teste. No Jurix, o [`CLAUDE.md`](Jurix/CLAUDE.md) e as [especificações](Jurix/openspec/changes/) conduziram o Claude Code módulo a módulo. |
| **Produto construído do zero em dias** | O Jurix ficou pronto em 5 dias, com 7 módulos, 12 migrações de banco e cerca de 14 mil linhas de TypeScript, e foi entregue como instalador de Windows. |
| **Ferramenta em uso real** | O Jurix é usado no dia a dia por uma advogada autônoma, que estima economizar cerca de 2 horas por dia de controle manual. |
| **Dashboard funcional** | O [dashboard do Jurix](Jurix/README.md#telas) mostra KPIs por período, cenários, concentração de receita, projeção de 3, 6 e 12 meses ponderada pela chance de êxito e um simulador de cenários. Na Nave, o painel de créditos de API mostra o gasto total, por agente e por missão. |
| **API com IA sem um backend pesado** | O servidor da Nave é pequeno: chama a API do Claude pelo SDK oficial e transmite o andamento por eventos (SSE). O Jurix não tem servidor: o banco roda no próprio computador e, na demo, dentro do navegador. |
