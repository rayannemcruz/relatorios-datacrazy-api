---
name: relatorio-datacrazy
description: Gera um novo relatório sob demanda no site do DataCrazy deste projeto. Use SEMPRE que o usuário pedir um relatório, levantamento, lista, contagem ou cruzamento de dados do CRM DataCrazy (ex.: "leads da atendente X", "negócios ganhos em outubro", "conversas abertas no Instagram", "quanto a Ana vendeu"). O relatório é adicionado em public/relatorios.js e aparece no site, no topo da sidebar em Relatórios.
---

# Relatórios sob demanda – DataCrazy

## Como o site é organizado (não mudar sem o usuário pedir)

A página `public/index.html` tem uma **sidebar** à esquerda e o conteúdo à direita. Visual limpo e **sem emojis** (inclusive em títulos de relatório e rótulos).

1. **Relatórios** (primeiro grupo da sidebar, recolhível): os relatórios ficam agrupados **por mês** (ex.: "Novembro 2026"), cada mês também recolhível. O mês vem do `criadoEm` (DD/MM/AAAA), por isso ele precisa estar sempre preenchido com a data de hoje. Mês mais recente no topo e aberto; dentro do mês, o dia mais recente primeiro. Ao abrir o site aparece uma **tela inicial** (lista dos relatórios por mês, sem nenhuma requisição à API); a API só é chamada quando o usuário abre um relatório ou item do Acervo. Clicar em "DataCrazy" no topo da sidebar volta para ela. Cada relatório busca os dados **ao vivo** na API quando é aberto e tem um botão "Atualizar". Link direto: `#rel/<id>`.
2. **Acervo** (segundo grupo da sidebar, recolhível): TODOS os endpoints de listagem da API (leads, negócios, pipelines, conversas, atividades, tags, listas, produtos, conexões, atendentes multi/CRM, motivos de perda). Cada um só busca os dados quando é aberto. **O Acero é fixo**: não acrescente relatórios nele e não o altere ao criar relatórios.

Arquivos:

| Arquivo | Papel |
|---|---|
| `public/relatorios.js` | **Único arquivo que você edita para criar um relatório.** Cada relatório é um `RELATORIOS.push({...})` no fim do arquivo. |
| `public/index.html` | Acervo, motor dos relatórios e helpers `api`/`fmt`. Só mexa se um relatório precisar de um helper novo. |
| `server.js` | Proxy local (somente GET) que injeta o token. Porta 3000. Não mexa. |
| `api/proxy.js`, `vercel.json` | Versão do site na Vercel: proxy serverless e rotas. Não mexa. |
| `scripts/testar-relatorio.js` | Roda um relatório no terminal contra a API real, para validar. |
| `.env` | Token da API. **Nunca** exiba, copie para outro arquivo nem coloque no front-end. |

## Passo a passo quando o usuário pedir um relatório

### 1. Entender o pedido
- Identifique **o quê** (leads, negócios, conversas...), **o filtro** (atendente, período, status, tag, pipeline, etapa, canal...) e **o que mostrar** (lista, contagem, soma de valores, agrupamento).
- Se o pedido citar pessoas, tags, pipelines, etapas etc. pelo nome, descubra o **ID** consultando a API (ver "Consultando a API pelo terminal"). Compare sem diferenciar maiúsculas/acentos e ignore espaços extras (ex.: o nome real é `"Ana Correia "`, com espaço no final).
- Se o nome for ambíguo (duas pessoas parecidas) ou não existir, **pergunte ao usuário** antes de criar o relatório e mostre as opções encontradas.
- Datas: interprete no fuso de Brasília (UTC−3). "Outubro de 2026" = `2026-10-01T03:00:00.000Z` até `2026-11-01T02:59:59.999Z`. "Hoje", "esta semana" etc. são relativos à data atual. Prefira calcular essas datas **dentro do `gerar`** (com `new Date()`) quando o pedido for relativo ("últimos 7 dias"), para o relatório continuar certo ao ser atualizado. Use datas fixas quando o pedido citar um período fixo ("outubro").
- Se faltar algo essencial, como o período de um pedido de "vendas", use um padrão sensato, diga qual foi na resposta e informe que dá para ajustar.

### 2. Escrever o relatório
Acrescente **no fim** de `public/relatorios.js`, sem remover nem alterar os relatórios anteriores (a não ser que o usuário peça):

```js
RELATORIOS.push({
  id: 'negocios-ana-correia',               // slug único, kebab-case
  titulo: 'Negócios da atendente Ana Correia',
  pedido: 'quero os negócios da ana com status e valor', // texto do usuário, como ele escreveu
  criadoEm: '02/11/2026',                   // data de hoje, DD/MM/AAAA
  descricao: 'GET /businesses com filter[attendants]=<id da Ana Correia>',
  async gerar(api, fmt) {
    const ANA = '2e3e894c-2509-466f-bc77-9e6f037d95bb'; // Ana Correia (attendants/crm)
    const negocios = await api.getAll('/businesses', { 'filter[attendants]': ANA });
    const ganhos = negocios.filter(n => n.status === 'won');
    return {
      resumo: [
        { label: 'Negócios', valor: fmt.num(negocios.length) },
        { label: 'Ganhos', valor: fmt.num(ganhos.length) },
        { label: 'Valor ganho', valor: fmt.money(ganhos.reduce((s, n) => s + (n.total || 0), 0)) },
      ],
      colunas: [
        ['Código', r => fmt.esc(r.code)],
        ['Lead', r => fmt.esc(r.lead?.name)],
        ['Etapa', r => fmt.pill(r.stage?.name, r.stage?.color)],
        ['Status', r => fmt.status(r.status)],
        ['Total', r => fmt.money(r.total)],
        ['Criado em', r => fmt.date(r.createdAt)],
      ],
      linhas: negocios,
    };
  },
});
```

Regras do objeto:
- `gerar(api, fmt)` **sempre busca os dados ao vivo**. Nunca cole dados fixos (resultados) no arquivo. IDs fixos são permitidos, com um comentário dizendo de quem/que são.
- Retorno: `resumo` (opcional, cartões no topo, `valor` pode ser HTML) + `colunas`/`linhas`, **ou** `secoes: [{ titulo, colunas, linhas }]` para mais de uma tabela (ex.: um resumo agrupado + a lista detalhada).
- `colunas` = `[rótulo, função(linha) → HTML]`. **Todo texto vindo da API passa por `fmt.esc`** (ou por um helper que já escapa: `pill`, `badge`, `tags`, `status`).
- Linhas de tabela são clicáveis e abrem o JSON completo. Para tabelas agrupadas (ex.: uma linha por atendente), monte objetos simples como `{ name: 'Ana', qtd: 10, valor: 500 }`.
- Ordene as linhas de forma útil (mais recente primeiro, ou maior valor primeiro) e diga a ordem na `descricao`, se não for óbvia.
- Tudo em português do Brasil: títulos, rótulos e datas.

Helpers disponíveis:

| `api` | |
|---|---|
| `api.get(path, params)` | Um GET. `path` sem `/api/v1` (ex.: `'/leads'`). `params` é um objeto: `{ take: 10, 'filter[status]': 'won' }`. Já trata o erro 429, esperando o `Retry-After`. |
| `api.getAll(path, params, { max = 5000, pageSize = 500 })` | Pagina com skip/take até acabar ou até `max`. Use para endpoints paginados (leads, businesses, conversations, activities, histórico). Aumente o `max` se o relatório precisar de tudo. |

| `fmt` | |
|---|---|
| `esc(texto)` | Escapa HTML (obrigatório para texto da API) |
| `date(iso)` / `day(iso)` | Data e hora / só data, pt-BR |
| `money(n)` | R$ |
| `num(n)` | Número com separador de milhar |
| `bool(b)` | ✔ sim / ✘ não |
| `tags(arrayDeTags)` | Etiquetas coloridas |
| `pill(texto, cor)` | Etiqueta colorida (ex.: etapa do funil) |
| `badge(texto)` | Etiqueta cinza |
| `status(s)` | Status de negócio traduzido (in_process → Em andamento, won → Ganho, lost → Perdido) |
| `color(hex)` | Amostra de cor |

### 3. Testar antes de entregar (obrigatório)
1. O servidor precisa estar rodando na porta 3000. Verifique com `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/tags`.
   - Se responder 200, use o que já está rodando (provavelmente é o terminal do usuário; **não o encerre**).
   - Se não responder, suba um temporário com `node --env-file=.env server.js` em background, teste e **encerre esse processo no final**. Se ele ficar rodando, o `npm start` do usuário falha com EADDRINUSE.
2. Rode `node scripts/testar-relatorio.js <id>`. O script mostra o resumo, o número de linhas e as 5 primeiras linhas como texto.
3. Confira se faz sentido: o filtro pegou só o que devia? (ex.: todas as linhas são do atendente pedido?) Os números batem com uma consulta direta? Se der zero linhas, investigue antes de entregar. Pode ser filtro errado ou nome de parâmetro errado (ver "Pegadinhas").
4. Confira a sintaxe com `node --check public/relatorios.js`.

### 4. Publicar no site (Vercel)
O site no ar é publicado automaticamente pela Vercel a cada push na branch `main` do GitHub. Depois do teste OK:
```bash
git add public/relatorios.js   # e public/index.html, se precisou de helper novo
git commit -m "Relatório: <titulo>"
git push origin main
```
Se o push falhar (login/permissão), avise o usuário com o erro. Não use `--force`.

### 5. Responder ao usuário
Curto, em português:
- Nome do relatório e onde ele está ("no topo da sidebar, em Relatórios").
- Os números principais do teste (ex.: "17 negócios, 3 ganhos, R$ 4.500").
- Como os dados foram filtrados (endpoint e filtro, em linguagem simples) e qualquer premissa assumida (período padrão, nome interpretado).
- Que já foi publicado: em cerca de 1 minuto aparece no site da Vercel (recarregar com F5). Os dados são sempre buscados ao vivo.

## Referência da API (verificada em 02/11/2026)

Base: `https://api.g1.datacrazy.io/api/v1`, com Bearer token (o proxy injeta). Especificação: `https://api.datacrazy.io/v1/api/openapi/v1/json`. Docs: `https://docs.datacrazy.io/llms.txt`.

Endpoints GET:
- Listas paginadas (`skip`, `take`, `search`, `filter[...]`): `/leads`, `/businesses`, `/conversations`, `/activities`, `/leads/{id}/history`, `/leads/{id}/businesses`, `/leads/{id}/activities`, `/conversations/{id}/messages` (skip/take)
- Listas simples: `/tags`, `/lists`, `/products`, `/instances`, `/attendants/multi` (`search`), `/attendants/crm`, `/pipelines` (`search`), `/business-loss-reasons`
- Por ID: `/leads/{id}`, `/businesses/{id}`, `/pipelines/{id}`, `/pipelines/{id}/stages`, `/tags/{id}`, `/tags/{id}/leads-count`, `/leads/{leadId}/notes`, `/leads/{leadId}/attachments`, `/business/{businessId}/attachments`, `/instances/{id}`, `/attendants/crm/{id}`, `/attendants/multi/{id}`, `/activities/{id}`, `/products/{id}`, `/lists/{id}`, `/business-loss-reasons/{id}`

Filtros (formato `filter[nome]=valor`; listas de IDs separadas por vírgula):
- **Leads**: `attendants` ✅, `tags`, `lists`, `stages`, `products` (aceitam prefixo `every`/`none` + IDs, ex.: `every id1,id2`), `source`, `type` (PERSON|COMPANY), `createdAtGreaterOrEqual`, `createdAtLessOrEqual`, `hasMessages`, `notHasMessages`, `minBusinessesCount`, `maxBusinessesCount`, `address` (`city São Paulo,state SP`), `company`, `role`, `fields` (campos adicionais: `<idCampo> contains texto`)
- **Negócios**: `attendants` ✅, `status` ✅ (`in_process`|`won`|`lost`), `tags`, `products`, `lossReason`, `source`, `minValue`, `maxValue`, `createdAtGreaterOrEqual`, `createdAtLessOrEqual`, `lastMovedAfter`, `lastMovedBefore`, `startDate`/`endDate` (em negociação no intervalo), `externalId`, `fields`, `businessFields`
- **Conversas**: `status` (`unstarted|waiting|opened|automation|finished|error`), `attendants`, `departments`, `instances`, `tags`, `stages`, `openWindow` (`last24h|all`)
- **Atividades**: `attendantId`, `startDate`, `startDateLessThan`, `typeId`, `isCompleted`
- ✅ = testado e confirmado. Os demais estão na documentação, mas **valide no teste** se o resultado foi realmente filtrado. Se um filtro for ignorado, a API devolve a lista inteira sem erro.

## Pegadinhas conhecidas (confirmadas na prática)

- **Leads por atendente usa `filter[attendants]` (plural).** A documentação diz `filter[attendant]`, mas esse é **ignorado** e devolve todos os leads.
- **`total` em `/businesses` é a SOMA DOS VALORES dos negócios, não a quantidade.** A quantidade é `count`. Muitos negócios têm `total: 0`.
- `/leads` **não devolve `count`**. Para contar, use `getAll` e `.length`.
- `skip` máximo é 10000. Acima disso a resposta vem vazia, então `getAll` traz no máximo cerca de 10.500 registros. A conta tem mais de 10.500 leads. Para totais completos, filtre na API (atendente, período...) ou divida em janelas de `createdAtGreaterOrEqual`/`createdAtLessOrEqual`.
- Limite: 60 requisições/min por rota, e **20/min em conversas**. Evite chamar endpoints por ID dentro de laços grandes (ex.: `/leads/{id}/history` para mil leads). Se for inevitável, limite a quantidade e avise o usuário.
- O atendente de um lead vem em `lead.attendant` (objeto ou `null`). No negócio vem em `business.attendant` e `business.attendantId`. O ID é o mesmo de `/attendants/crm`. Os de `/attendants/multi` (multiatendimento/conversas) são outro cadastro, com IDs próprios.
- Nomes vêm com espaços extras e caixa variada (`"Ana Correia "`, `"Tárcia  Castilho "`). Use `.trim()` ao exibir/comparar.
- Negócio traz `stage` com `stage.pipeline` embutidos. Não precisa buscar o pipeline separadamente para mostrar o nome.

## Consultando a API pelo terminal (para descobrir IDs)

Com o servidor rodando, use o proxy (o token não aparece no comando):

```bash
curl -s http://localhost:3000/api/attendants/crm | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>JSON.parse(s).data.forEach(a=>console.log(a.id,'|',a.name.trim())))"
```

Troque `/attendants/crm` por `/tags`, `/pipelines`, `/pipelines/<id>/stages`, `/instances`, `/attendants/multi`, `/business-loss-reasons` conforme a necessidade. Em filtros com colchetes no curl, use `-g` ou codifique (`filter%5Bstatus%5D=won`).

## O que NÃO fazer

- Não usar métodos que alteram dados (POST/PATCH/PUT/DELETE). O proxy só aceita GET, e é assim que deve continuar.
- Não remover nem reescrever relatórios antigos sem pedido explícito. Para "ajustar o relatório X", edite o `push` dele mantendo o `id`.
- Não mexer no Acervo nem no layout para atender a um relatório.
- Não expor o token, nem criar outro caminho do front-end direto para a API.
- Não entregar relatório sem rodar `scripts/testar-relatorio.js`.
