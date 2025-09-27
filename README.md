# UMADSEDE — Sistema de Pedidos e Caixa

Aplicação completa para operação de evento (hamburgueria) com vendas pelo site e no caixa, produção de cozinha em tempo real e BI. Monolito Docker com Django + DRF (backend), React + Vite + Tailwind (frontend), MySQL e Redis, pensado para rodar em uma única instância EC2.

## Sumário
- Visão geral e recursos
- Arquitetura e pastas
- Variáveis de ambiente
- Como rodar localmente (Docker)
- Deploy em produção (EC2 + Caddy + GitHub Actions)
- Integração Mercado Pago (Pix dentro do site)
- Estoque (política de vendidos/disponível)
- Páginas e rotas
- BI (filtros e gráficos)
- Migrações, backup e troubleshooting

---

## Visão geral e recursos

- Site de pedidos do cliente (carrinho, checkout, Pix no modal)
- Caixa (vendas presenciais sem MP; confirmação no sistema) — envia para a cozinha
- Cozinha (kanban) e TV (painel de retirada) em tempo real via WebSocket
- BI com filtros reativos (data, status, origem, pagos, busca) e 4 pizzas: origem, meio, status e categoria; lista detalhada em tabela
- Controle de estoque por item (estoque inicial, vendidos, disponível) — item esgotado não aparece nas páginas de venda

## Arquitetura

```
docker-compose.yml
  ├─ backend (Django + DRF + Channels + Gunicorn)
  ├─ frontend (Vite build + Nginx)
  ├─ db (MySQL 8)
  ├─ redis (Channels / WS)
  └─ caddy (reverse proxy + TLS automático)
```

Principais pastas:
- `backend/apps/orders` — modelos, views, serviços de pagamento (Mercado Pago)
- `frontend/src` — React (páginas, componentes, estilos)

## Variáveis de ambiente (.env na raiz)

Backend/Docker
- `DJANGO_SECRET_KEY` — chave secreta do Django
- `DJANGO_DEBUG` — True/False
- `DJANGO_ALLOWED_HOSTS` — lista separada por vírgula (ex.: `seu.dominio,localhost`)
- `FRONT_URL` — URL pública do site (ex.: `https://seu.dominio`)
- `BACKEND_URL` — URL pública do backend (igual ao `FRONT_URL` em proxy único)
- `MP_ACCESS_TOKEN` — Access Token do Mercado Pago (TEST/PROD)
- `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PORT`
- `REDIS_HOST`, `REDIS_PORT`
- `WEB_PORT` — não usado quando exposto via Caddy
- `SITE_DOMAIN` — domínio para o Caddy emitir TLS (ex.: `seu.dominio` ou `umadsede.<IP>.sslip.io`)

Frontend (arquivo commitado no repo)
- `frontend/.env.production` — `VITE_MP_PUBLIC_KEY=...` (TEST/PROD pareada com o backend)

## Rodando localmente

Pré‑requisitos: Docker e Docker Compose.

1) Copie `.env.example` para `.env` e ajuste (pode usar URLs `http://localhost`).
2) `docker compose up -d --build`
3) Acesse o frontend: `http://localhost`
4) API health: `http://localhost/healthz`

Comandos úteis:
- Migrações: `docker compose exec backend python manage.py migrate`
- Logs: `docker compose logs -f backend` | `frontend` | `db` | `caddy`

## Deploy em produção (EC2 + Caddy)

1) Crie EC2 (Amazon Linux 2023), abra portas 80/443/22, associe Elastic IP
2) Instale Docker/Compose e clone o repositório
3) Crie `.env` com variáveis de produção (inclua `SITE_DOMAIN`, `FRONT_URL`, `BACKEND_URL` e `DJANGO_ALLOWED_HOSTS` com seu domínio)
4) Crie `frontend/.env.production` com `VITE_MP_PUBLIC_KEY`
5) Suba: `docker compose up -d --build`
6) Caddy emite TLS automático para `SITE_DOMAIN`

CI/CD (opcional): GitHub Actions por SSH — secrets:
- `EC2_HOST`, `EC2_USER`, `EC2_KEY` (chave privada), `REPO_PATH`
O workflow executa `git pull`, `docker compose up -d --build` e `migrate` a cada push na `main`.

## Mercado Pago (Pix dentro do site)

- Backend usa Payments API para criar Pix (endpoint `POST /api/payments/pix`) e retorna QR e “copia e cola”
- Webhook: `POST /api/payments/webhook` — somente confirma quando `payment.status=='approved'`
- Frontend exibe Pix dentro do modal (sem sair do site), com botão “Copiar” e verificação segura
- Credenciais: `MP_ACCESS_TOKEN` (backend) e `VITE_MP_PUBLIC_KEY` (frontend)

## Estoque

- Item possui `estoque_inicial` e `vendidos`
- Disponível = `max(estoque_inicial - vendidos, 0)`
- Quando um pedido é pago (site/caixa), `vendidos` é incrementado; itens esgotados não aparecem nas páginas de venda
- Página `/admin/estoque` calcula “Vendidos” pelos pedidos pagos e exibe barra de progresso por item

## Páginas e rotas

- Cliente: `/cliente` (carrinho, checkout Pix no modal)
- Caixa: `/admin/vendas` (venda presencial; confirma no sistema; envia para cozinha)
- Cozinha: `/cozinha` (kanban; avanço direto para produção)
- TV: `/tv` (1/4 produção; 3/4 prontos; ordenado por mais antigos)
- Itens: `/admin/itens` (cadastro/ativação)
- Estoque: `/admin/estoque` (grupos por categoria, barras)
- BI: `/admin/relatorio` (filtros reativos, 4 pizzas, top itens, detalhado em tabela)

## BI (filtros e gráficos)

- Filtros: Data (De/Até), Status, Somente pagos, Origem (Cliente/Caixa), Busca (cliente, item, observações, ID)
- 4 gráficos (pizza): origem, meios de pagamento, status, categorias
- “Top itens vendidos” e “Vendas por categoria” respeitam os filtros
- “Relatório detalhado” exibe tabela com todos os campos relevantes dos pedidos

## Migrações e backup

- Migrações: `docker compose exec backend python manage.py migrate`
- MySQL dump: `docker compose exec -T db sh -c 'mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' > dump.sql`
- Restore: `docker compose exec -T db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < dump.sql`

## Troubleshooting

- 400 (Bad Request) após HTTPS/domínio — adicione o domínio em `DJANGO_ALLOWED_HOSTS`
- 404 em `/api/payments/pix` — publique o backend (git pull + build) e verifique `backend/core/urls.py`
- WebSocket warning — use `uvicorn[standard]` (já configurado), verifique logs do backend
- 413 ao enviar imagens base64 — `client_max_body_size 10m` no `frontend/nginx.conf`
- `permission denied /app/entrypoint.sh` — `chmod +x` após `COPY . .` no Dockerfile (já aplicado)

## Segurança

- Nunca commit secrets. Use `.env` na instância
- Mantenha `DJANGO_DEBUG=False` em produção
- Restrinja SSH no Security Group à sua origem

---

Qualquer ajuste adicional (ex.: export CSV no BI, auto‑refresh no estoque/BI, sticky header na tabela) posso implementar rapidamente.
