// Servidor simples: serve o front-end e faz proxy (somente GET) para a API do DataCrazy,
// mantendo o token apenas no servidor.
const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.g1.datacrazy.io/api/v1';
const TOKEN = process.env.DATACRAZY_TOKEN;
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
  console.error('Defina DATACRAZY_TOKEN no arquivo .env');
  process.exit(1);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/')) {
    // Permite abrir o index.html por outro servidor local (ex.: Live Server na porta 5500)
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method !== 'GET') {
      res.writeHead(405).end('Somente GET');
      return;
    }
    try {
      const target = API_BASE + url.pathname.slice(4) + url.search;
      const r = await fetch(target, { headers: { Authorization: `Bearer ${TOKEN}` } });
      res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(await r.text());
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  const file = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end('Não encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`A porta ${PORT} já está em uso — provavelmente o servidor já está rodando em outro terminal.`);
    console.error(`Abra http://localhost:${PORT} ou feche o outro processo antes de rodar de novo.`);
    process.exit(1);
  }
  throw err;
}).listen(PORT, () => console.log(`Abra http://localhost:${PORT}`));
