# UMADSEDE Stack
Django + DRF, React + Tailwind e MySQL em uma única VM via Docker.

## Subir
1. Copie .env.example para .env e ajuste variáveis
2. docker compose up -d --build
3. Front: http://<IP>:WEB_PORT
4. API: http://<IP>/api/

## Dados
Os dados são mantidos exclusivamente no MySQL. Não há mais importação via planilha.
Para editar preços diretamente:
- CLI do MySQL (container):
  - `docker compose exec db mysql -uumadsede -pumadsede123 umadsede`
  - `UPDATE orders_item SET preco = 25.00 WHERE sku = 1;`
  - `SELECT id, sku, nome, preco FROM orders_item;`
 testeDeploy test qui 25 set 2025 03:21:52 -04
