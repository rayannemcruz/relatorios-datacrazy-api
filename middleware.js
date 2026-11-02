// Protege o site inteiro (página e /api) com usuário/senha (HTTP Basic Auth).
// Configure na Vercel as variáveis SITE_USUARIO e SITE_SENHA.
// Sem SITE_SENHA definida, o site fica bloqueado (para não expor dados do CRM por engano).
export const config = { matcher: '/:path*' };

export default function middleware(request) {
  const usuario = process.env.SITE_USUARIO || 'admin';
  const senha = process.env.SITE_SENHA;
  const auth = request.headers.get('authorization') || '';
  // Botão "Sair": aceita o usuário falso sair:sair só nesta rota, para o navegador
  // substituir o login guardado; depois disso qualquer página volta a pedir a senha.
  if (new URL(request.url).pathname === '/sair') {
    const ok = auth === 'Basic ' + btoa('sair:sair');
    return new Response(ok ? 'Saiu' : 'Acesso restrito', {
      status: ok ? 200 : 401,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (senha && auth.startsWith('Basic ')) {
    const [u, ...resto] = atob(auth.slice(6)).split(':');
    if (u === usuario && resto.join(':') === senha) return; // segue para o site
  }
  return new Response('Acesso restrito', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Relatorios DataCrazy", charset="UTF-8"' },
  });
}
