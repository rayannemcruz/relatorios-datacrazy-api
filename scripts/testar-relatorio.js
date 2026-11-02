// Executa um relatório de public/relatorios.js no terminal, contra a API real (via server.js).
// Uso: node scripts/testar-relatorio.js <id-do-relatorio>   (sem id = o último adicionado)
// Requer o servidor rodando (npm start) na porta 3000.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const helpers = html.match(/<script>([\s\S]*?)<\/script>/)[1]; // 1º <script>: fmt + api

globalThis.window = globalThis;
globalThis.location = { hostname: 'localhost', port: 'node' }; // força API_URL = http://localhost:3000/api
globalThis.document = { addEventListener() {}, getElementById() {} };
vm.runInThisContext(helpers + ';globalThis.api = api; globalThis.fmt = fmt;');
vm.runInThisContext(fs.readFileSync(path.join(root, 'public', 'relatorios.js'), 'utf8'));

const id = process.argv[2];
const rel = id ? RELATORIOS.find(r => r.id === id) : RELATORIOS[RELATORIOS.length - 1];
if (!rel) {
  console.error(id ? `Relatório "${id}" não encontrado.` : 'Nenhum relatório cadastrado.');
  console.error('Disponíveis:', RELATORIOS.map(r => r.id).join(', ') || '(nenhum)');
  process.exit(1);
}

const text = h => String(h ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

(async () => {
  console.log(`== ${rel.titulo} (${rel.id})`);
  const t0 = Date.now();
  const r = await rel.gerar(api, fmt);
  for (const c of r.resumo || []) console.log(`  [${c.label}] ${text(c.valor)}`);
  const secoes = r.secoes || [{ colunas: r.colunas, linhas: r.linhas }];
  for (const s of secoes) {
    console.log(`\n-- ${s.titulo || 'Tabela'}: ${s.linhas.length} linha(s)`);
    console.log('  ' + s.colunas.map(c => c[0]).join(' | '));
    for (const linha of s.linhas.slice(0, 5)) console.log('  ' + s.colunas.map(c => text(c[1](linha))).join(' | '));
  }
  console.log(`\nOK em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
