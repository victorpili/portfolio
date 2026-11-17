# Portfólio

Projetos em que uso IA para resolver um problema de negócio de ponta a ponta, da ideia ao produto no ar.

| Projeto | O que faz | Pasta |
|---|---|---|
| **Nave de Agentes** | Uma tripulação de agentes do Claude reescreve fichas de produto Shopify para que assistentes de IA as entendam, e mostra o antes e o depois numa nota de 0 a 100. [Demo no ar](https://portfolio-nave-de-agentes.vercel.app). | [`nave-de-agentes/`](nave-de-agentes/) |
| **Jurix** | Sistema de gestão para advogados autônomos, com clientes, processos, contratos, financeiro, agenda e um dashboard com projeção de caixa. Construído do zero em 5 dias com o Claude Code, ele é usado no dia a dia por uma advogada, que estima economizar cerca de 2 horas por dia. [Demo no navegador](https://victorpili.github.io/portfolio/jurix/). | [`Jurix/`](Jurix/) |

Cada pasta é um projeto independente, com o próprio README, instruções para rodar e testes.

## Fora deste repositório: o CRM comercial que estou construindo no trabalho

Meu projeto principal é um CRM comercial para o escritório onde trabalho. Ele reúne num único lugar todo o histórico comercial de cada cliente com o escritório, como fonte única da verdade. Construí o CRM de agosto a novembro de 2026, dedicando cerca de 30% da minha semana, ao lado das minhas outras atribuições. O MVP está na fase final de entrega. Duas áreas técnicas já testam o sistema, e a base tem mais de 2 mil empresas. A avaliação formal ainda não foi feita, mas as primeiras impressões destacam o uso mais simples e a qualidade dos dados.

O código e os dados pertencem ao escritório, por isso o CRM não está aqui, por confidencialidade. Posso apresentá-lo numa conversa.

- **Pipeline comercial.** Cada iniciativa comercial é um card, vinculado à empresa, aos contatos e às pessoas do escritório envolvidas. As tarefas de prospecção são criadas de dentro do próprio card.
- **Cadastro preenchido por agentes.** O usuário digita só o nome da empresa. Os agentes identificam o CNPJ e pedem confirmação. Depois de confirmado, eles buscam no cartão CNPJ, no site da empresa e em outras fontes os setores de atuação, a faixa de faturamento, o porte, a matriz, se a empresa é familiar etc.
- **Radar de notícias.** Busca notícias por setor, inclusive em órgãos reguladores, e eventos de cada setor. Analisa e categoriza cada notícia, tira insights comerciais de movimentos do mercado e de novas leis e portarias, e aponta quais clientes podem ser afetados.
- **Setores e microsetores.** Criei uma classificação própria: 13 setores gerais e 85 microsetores baseados em CNAEs. Cada empresa tem um setor principal e pode ter microsetores de fora dele. Uma transportadora que só atende o agro tem "transporte e logística" como setor principal. Pelos microsetores do agro, o radar avisa que ela pode ser afetada por uma seca que prejudicou as plantações.
- **Importador de planilhas.** O usuário escolhe o que vai importar (empresas, contatos ou prospecções) e diz em que coluna está cada campo. O sistema liga cada linha às empresas e aos contatos já cadastrados e padroniza os dados. Só grava depois que o usuário confere e confirma.
- **Gestão comercial.** Um dashboard do pipeline, com o funil, a qualidade dos contatos, o ciclo de vendas e indicadores por pessoa e por área. Também tem uma base de empresas com filtros, contatos e mailings vinculados às empresas e às pessoas do escritório, e gestão de tarefas.
- **Controle.** Registro (log) de todas as ações e permissões por área, cargo e pessoa, liberando ver e editar tela a tela.

**Como construí:** com o Claude Code, no VS Code. Os agentes do sistema usam um modelo diferente conforme a complexidade da tarefa: Claude Opus, Claude Haiku ou DeepSeek.

## O que cada projeto mostra

| Capacidade | Onde ver |
|---|---|
| **Orquestração de agentes** | Na Nave de Agentes, três agentes do Claude (Pesquisador, Redator e Revisor) trabalham em sequência. Um coordenador e um verificador escritos em código conferem cada entrega e a devolvem ao agente quando ela falha. |
| **Prompt engineering** | Os [prompts da Nave](nave-de-agentes/prompts/) exigem saída estruturada validada por schema, tratam a ficha da loja como dado e não como instrução, e foram ajustados em ciclos de teste. No Jurix, o [`CLAUDE.md`](Jurix/CLAUDE.md) e as [especificações](Jurix/openspec/changes/) conduziram o Claude Code módulo a módulo. |
| **Produto construído do zero em dias** | O Jurix ficou pronto em 5 dias, com 7 módulos, 12 migrações de banco e cerca de 14 mil linhas de TypeScript, e foi entregue como instalador de Windows. |
| **Ferramenta em uso real** | O Jurix é usado no dia a dia por uma advogada autônoma, que estima economizar cerca de 2 horas por dia de controle manual. |
| **Dashboard funcional** | O [dashboard do Jurix](Jurix/README.md#telas) mostra KPIs por período, cenários, concentração de receita, projeção de 3, 6 e 12 meses ponderada pela chance de êxito e um simulador de cenários. Na Nave, o painel de créditos de API mostra o gasto total, por agente e por missão. |
| **API com IA sem um backend pesado** | O servidor da Nave é pequeno: chama a API do Claude pelo SDK oficial e transmite o andamento por eventos (SSE). O Jurix não tem servidor: o banco roda no próprio computador e, na demo, dentro do navegador. |
