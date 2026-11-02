// Função serverless da Vercel: proxy (somente GET) para a API do DataCrazy.
// Equivale ao trecho /api/ do server.js. O token fica só na variável de ambiente DATACRAZY_TOKEN.
// O vercel.json reescreve /api/<caminho>?<query> para /api/proxy?__path=<caminho>&<query>.
const API_BASE = 'https://api.g1.datacrazy.io/api/v1';

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).send('Somente GET');
    return;
  }
  const token = process.env.DATACRAZY_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'DATACRAZY_TOKEN não configurado na Vercel' });
    return;
  }
  const url = new URL(req.url, 'http://x');
  // A Vercel também repassa o parâmetro nomeado da regra ("path"); ignoramos "proxy"
  // caso a função acabe reescrita para ela mesma.
  const candidatos = [...url.searchParams.getAll('__path'), ...url.searchParams.getAll('path')];
  const caminho = (candidatos.find(c => c && c !== 'proxy') || '').replace(/^\/+/, '');
  url.searchParams.delete('__path');
  url.searchParams.delete('path');
  const qs = url.searchParams.toString();
  try {
    const r = await fetch(`${API_BASE}/${caminho}${qs ? '?' + qs : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const retry = r.headers.get('retry-after');
    if (retry) res.setHeader('Retry-After', retry);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(r.status).send(await r.text());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
