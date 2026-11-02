// =====================================================================
// RELATÓRIOS SOB DEMANDA
// Cada pedido de relatório vira um item RELATORIOS.push({...}) no FIM deste arquivo.
// A página mostra o mais recente primeiro, abaixo do Acervo.
// Regras completas: .claude/skills/relatorio-datacrazy/SKILL.md
//
// Formato:
// RELATORIOS.push({
//   id: 'slug-unico',
//   titulo: 'Título curto',
//   pedido: 'texto do pedido do usuário, como ele escreveu',
//   criadoEm: 'DD/MM/AAAA',
//   descricao: 'Como os dados são obtidos (endpoint + filtros)',
//   async gerar(api, fmt) {
//     // api.get(path, params) / api.getAll(path, params, { max })
//     // fmt.esc, date, day, money, num, bool, tags, pill, color, badge, status
//     return {
//       resumo: [{ label: 'Total', valor: '10' }],          // opcional: cartões no topo
//       colunas: [['Nome', r => fmt.esc(r.name)]],           // [rótulo, função que devolve HTML]
//       linhas: [...],
//       // ou, para várias tabelas: secoes: [{ titulo, colunas, linhas }]
//     };
//   },
// });
// =====================================================================

window.RELATORIOS = [];
