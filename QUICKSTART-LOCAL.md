# Dev local mais simples (Docker Desktop)

1) Copie variáveis:
   cp .env.example .env
   (ajuste MP_ACCESS_TOKEN=TEST-... e FRONT_URL=http://localhost:5173)

2) Suba tudo:
   docker compose -f compose.local.yml up

3) Acesse:
   Frontend: http://localhost:5173
   Backend:  http://localhost:8000/api/
   MySQL:    localhost:3306 (user e senhas do .env)

Observações:
- Hot reload já habilitado: volumes montados em /backend e /frontend
- O Vite faz proxy de /api -> backend:8000, então não tem CORS
- Para testar webhook Mercado Pago localmente, use ngrok e aponte para http://localhost:8000/api/payments/webhook
