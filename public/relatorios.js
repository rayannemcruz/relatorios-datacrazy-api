// =====================================================================
// RELATÓRIOS SOB DEMANDA
// Cada pedido de relatório vira um item RELATORIOS.push({...}) no FIM deste arquivo.
// A página mostra o mais recente primeiro, no topo da sidebar.
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

RELATORIOS.push({
  id: 'funil-leads-outubro-2026',
  titulo: 'Funil dos leads de outubro de 2026',
  pedido: 'gere um relatorio do mes de outubro de 2026 Quantos leads entram, em que etapa estão, onde travam e quanto tempo ficam parados',
  criadoEm: '02/11/2026',
  descricao: 'Leads criados de 01/10 a 31/10/2026 (horário de Brasília), via GET /leads com filter[createdAtGreaterOrEqual/LessOrEqual]. '
    + 'A etapa vem dos negócios desses leads (GET /businesses criados a partir de 01/10). '
    + 'Tempo parado = hoje menos a data da última movimentação do negócio (lastMovedAt). '
    + 'Etapas finais (Finalizados, Perdidos, Emitida/Emitidas, Sem interesse, ou status Ganho/Perdido) não contam como travadas. '
    + 'Travado = negócio aberto há mais de 7 dias sem mudar de etapa.',
  async gerar(api, fmt) {
    const INI = '2026-10-01T03:00:00.000Z';
    const FIM = '2026-11-01T02:59:59.999Z';
    const LIMITE_DIAS = 7;
    const agora = Date.now();
    const dias = iso => iso ? Math.floor((agora - new Date(iso).getTime()) / 86400000) : null;
    const final = b => b.status !== 'in_process' || /finaliz|perdid|emitid|sem interesse|ganh/i.test(b.stage?.name || '');

    const leads = await api.getAll('/leads', {
      'filter[createdAtGreaterOrEqual]': INI, 'filter[createdAtLessOrEqual]': FIM,
    }, { max: 20000 });
    const idsLeads = new Set(leads.map(l => l.id));
    const negociosTodos = await api.getAll('/businesses', { 'filter[createdAtGreaterOrEqual]': INI }, { max: 20000 });
    const negocios = negociosTodos.filter(b => idsLeads.has(b.leadId));
    const leadsComNegocio = new Set(negocios.map(b => b.leadId));
    for (const b of negocios) { b._dias = dias(b.lastMovedAt || b.createdAt); b._final = final(b); }
    const abertos = negocios.filter(b => !b._final);
    const travados = abertos.filter(b => b._dias > LIMITE_DIAS);
    const media = arr => arr.length ? arr.reduce((s, b) => s + b._dias, 0) / arr.length : 0;

    // Entradas por semana do mês
    const semanas = [
      ['01 a 07/10', 1, 7], ['08 a 14/10', 8, 14], ['15 a 21/10', 15, 21], ['22 a 28/10', 22, 28], ['29 a 31/10', 29, 31],
    ].map(([nome, de, ate]) => {
      const qtd = leads.filter(l => {
        const d = new Date(new Date(l.createdAt).getTime() - 3 * 3600000).getUTCDate();
        return d >= de && d <= ate;
      }).length;
      return { semana: nome, qtd };
    });

    // Por etapa
    const porEtapa = new Map();
    for (const b of negocios) {
      const k = b.stage?.id || 'sem-etapa';
      if (!porEtapa.has(k)) porEtapa.set(k, {
        funil: (b.stage?.pipeline?.name || '').trim(), etapa: (b.stage?.name || 'Sem etapa').trim(),
        cor: b.stage?.color, ordem: b.stage?.index ?? 99, final: b._final, itens: [],
      });
      porEtapa.get(k).itens.push(b);
    }
    const etapas = [...porEtapa.values()].map(e => {
      const abertosE = e.itens.filter(b => !b._final);
      return {
        ...e, qtd: e.itens.length, leads: new Set(e.itens.map(b => b.leadId)).size,
        travados: abertosE.filter(b => b._dias > LIMITE_DIAS).length,
        media: media(e.itens), max: Math.max(...e.itens.map(b => b._dias)),
        semMover: e.itens.filter(b => b.lastMovedAt === b.createdAt).length,
      };
    }).sort((a, b) => a.funil.localeCompare(b.funil) || a.ordem - b.ordem);

    const gargalos = etapas.filter(e => !e.final && e.travados > 0).sort((a, b) => b.travados - a.travados);

    const faixas = [['Até 7 dias', 0, 7], ['8 a 15 dias', 8, 15], ['16 a 30 dias', 16, 30], ['Mais de 30 dias', 31, Infinity]]
      .map(([faixa, de, ate]) => ({ faixa, qtd: abertos.filter(b => b._dias >= de && b._dias <= ate).length }));

    const pct = (n, t) => t ? (n / t * 100).toFixed(1).replace('.', ',') + '%' : '0%';
    const etapaCol = r => fmt.pill(r.etapa, r.cor);

    return {
      resumo: [
        { label: 'Leads que entraram', valor: fmt.num(leads.length) },
        { label: 'Com negócio no funil', valor: `${fmt.num(leadsComNegocio.size)} (${pct(leadsComNegocio.size, leads.length)})` },
        { label: 'Sem negócio', valor: fmt.num(leads.length - leadsComNegocio.size) },
        { label: 'Negócios abertos', valor: fmt.num(abertos.length) },
        { label: `Travados (+${LIMITE_DIAS} dias)`, valor: `${fmt.num(travados.length)} (${pct(travados.length, abertos.length)})` },
        { label: 'Tempo médio parado (abertos)', valor: `${fmt.num(Math.round(media(abertos)))} dias` },
      ],
      secoes: [
        {
          titulo: 'Onde travam: etapas abertas com negócios parados há mais de 7 dias',
          colunas: [
            ['Funil', r => fmt.esc(r.funil)], ['Etapa', etapaCol],
            ['Travados', r => fmt.num(r.travados)], ['Total na etapa', r => fmt.num(r.qtd)],
            ['Média parado', r => `${fmt.num(Math.round(r.media))} dias`], ['Máximo parado', r => `${fmt.num(r.max)} dias`],
          ],
          linhas: gargalos,
        },
        {
          titulo: 'Em que etapa estão (ordem do funil)',
          colunas: [
            ['Funil', r => fmt.esc(r.funil)], ['Etapa', etapaCol],
            ['Tipo', r => fmt.badge(r.final ? 'Final' : 'Aberta')],
            ['Negócios', r => fmt.num(r.qtd)], ['Leads', r => fmt.num(r.leads)],
            ['Nunca movidos', r => fmt.num(r.semMover)],
            ['Média parado', r => `${fmt.num(Math.round(r.media))} dias`], ['Máximo', r => `${fmt.num(r.max)} dias`],
          ],
          linhas: etapas,
        },
        {
          titulo: 'Quanto tempo ficam parados (negócios abertos)',
          colunas: [['Tempo sem mudar de etapa', r => fmt.esc(r.faixa)], ['Negócios', r => fmt.num(r.qtd)], ['%', r => pct(r.qtd, abertos.length)]],
          linhas: faixas,
        },
        {
          titulo: 'Entrada de leads por semana',
          colunas: [['Semana', r => fmt.esc(r.semana)], ['Leads', r => fmt.num(r.qtd)]],
          linhas: semanas,
        },
        {
          titulo: 'Negócios travados (mais tempo parado primeiro)',
          colunas: [
            ['Código', r => fmt.esc(r.code)], ['Lead', r => fmt.esc(r.lead?.name?.trim())],
            ['Funil', r => fmt.esc(r.stage?.pipeline?.name?.trim())], ['Etapa', r => fmt.pill(r.stage?.name?.trim(), r.stage?.color)],
            ['Atendente', r => fmt.esc(r.attendant?.name?.trim() || 'Sem atendente')],
            ['Última movimentação', r => fmt.date(r.lastMovedAt)], ['Parado há', r => `${fmt.num(r._dias)} dias`],
          ],
          linhas: travados.sort((a, b) => b._dias - a._dias),
        },
      ],
    };
  },
});

RELATORIOS.push({
  id: 'desempenho-atendentes-outubro-2026',
  titulo: 'Desempenho por atendente em outubro de 2026',
  pedido: 'gere para mim um relatorio do mes de outubro com o desenpenho por consultor/atendente: tempo de primiera resposta, taxa de conversao e lead sem retorno',
  criadoEm: '02/11/2026',
  descricao: 'Leads criados de 01/10 a 31/10/2026 (horário de Brasília), via GET /leads com filter[createdAtGreaterOrEqual/LessOrEqual], agrupados pelo atendente do lead. '
    + 'Convertido = lead com negócio (criado a partir de 01/10) nas etapas APÓLICE EMITIDA ou VENDAS EMITIDAS. '
    + 'Sem retorno = a última mensagem da conversa foi do lead, ou ele mandou mensagem e nunca recebeu resposta (contato do lead, lastContactStatus). '
    + 'Mensagens automáticas contam como resposta. Sem conversa = lead sem nenhuma mensagem registrada. '
    + 'O tempo de primeira resposta ficou de fora: exigiria abrir conversa por conversa (limite de 60 por minuto na API). '
    + 'Tabela ordenada pelo número de leads.',
  async gerar(api, fmt) {
    const INI = '2026-10-01T03:00:00.000Z';
    const FIM = '2026-11-01T02:59:59.999Z';
    const agora = Date.now();
    const nome = s => (s || '').replace(/\s+/g, ' ').trim();
    const pct = (n, t) => t ? (n / t * 100).toFixed(1).replace('.', ',') + '%' : '0%';

    const leads = await api.getAll('/leads', {
      'filter[createdAtGreaterOrEqual]': INI, 'filter[createdAtLessOrEqual]': FIM,
    }, { max: 20000 });
    const idsLeads = new Set(leads.map(l => l.id));
    const negocios = (await api.getAll('/businesses', { 'filter[createdAtGreaterOrEqual]': INI }, { max: 20000 }))
      .filter(b => idsLeads.has(b.leadId));
    const convertidos = new Set(negocios.filter(b => /emitid/i.test(b.stage?.name || '')).map(b => b.leadId));

    // Situação da conversa de cada lead, pelos últimos envios/recebimentos dos contatos
    for (const l of leads) {
      const cs = (l.contacts || []).map(c => c.lastContactStatus).filter(Boolean);
      const rec = Math.max(0, ...cs.map(c => c.lastReceivedMessage ? Date.parse(c.lastReceivedMessage.date) : 0));
      const env = Math.max(0, ...cs.map(c => c.lastSendedMessage ? Date.parse(c.lastSendedMessage.date) : 0));
      l._semConversa = !rec && !env;
      l._semRetorno = rec > 0 && rec > env;
      l._ultimaDoLead = rec ? new Date(rec).toISOString() : null;
      l._ultimoEnvio = env ? new Date(env).toISOString() : null;
      l._esperaDias = rec ? Math.floor((agora - rec) / 86400000) : null;
      l._convertido = convertidos.has(l.id);
      l._atendente = nome(l.attendant?.name) || 'Sem atendente';
    }

    const grupos = new Map();
    for (const l of leads) {
      if (!grupos.has(l._atendente)) grupos.set(l._atendente, []);
      grupos.get(l._atendente).push(l);
    }
    const linhas = [...grupos.entries()].map(([atendente, ls]) => ({
      atendente,
      leads: ls.length,
      convertidos: ls.filter(l => l._convertido).length,
      semRetorno: ls.filter(l => l._semRetorno).length,
      semConversa: ls.filter(l => l._semConversa).length,
    })).sort((a, b) => (a.atendente === 'Sem atendente') - (b.atendente === 'Sem atendente') || b.leads - a.leads);

    const totConv = leads.filter(l => l._convertido).length;
    const semRetorno = leads.filter(l => l._semRetorno).sort((a, b) => b._esperaDias - a._esperaDias);
    const semAtendente = grupos.get('Sem atendente')?.length || 0;

    return {
      resumo: [
        { label: 'Leads de outubro', valor: fmt.num(leads.length) },
        { label: 'Convertidos (emitidos)', valor: `${fmt.num(totConv)} (${pct(totConv, leads.length)})` },
        { label: 'Sem retorno', valor: `${fmt.num(semRetorno.length)} (${pct(semRetorno.length, leads.length)})` },
        { label: 'Leads sem atendente', valor: `${fmt.num(semAtendente)} (${pct(semAtendente, leads.length)})` },
      ],
      secoes: [
        {
          titulo: 'Desempenho por atendente',
          colunas: [
            ['Atendente', r => fmt.esc(r.atendente)],
            ['Leads', r => fmt.num(r.leads)],
            ['Convertidos', r => fmt.num(r.convertidos)],
            ['Taxa de conversão', r => pct(r.convertidos, r.leads)],
            ['Sem retorno', r => fmt.num(r.semRetorno)],
            ['% sem retorno', r => pct(r.semRetorno, r.leads)],
            ['Sem conversa', r => fmt.num(r.semConversa)],
          ],
          linhas,
        },
        {
          titulo: 'Leads sem retorno (há mais tempo esperando primeiro)',
          colunas: [
            ['Lead', r => fmt.esc(nome(r.name))],
            ['Telefone', r => fmt.esc(r.phone)],
            ['Atendente', r => fmt.esc(r._atendente)],
            ['Última mensagem do lead', r => fmt.date(r._ultimaDoLead)],
            ['Última resposta enviada', r => r._ultimoEnvio ? fmt.date(r._ultimoEnvio) : fmt.badge('Nunca')],
            ['Esperando há', r => `${fmt.num(r._esperaDias)} dias`],
            ['Etiquetas', r => fmt.tags(r.tags)],
          ],
          linhas: semRetorno,
        },
      ],
    };
  },
});
