# VocaFlow Development Setup

Hybrid mode: DB and Redis run in Docker, server and client run locally.

## Start Database and Redis

```bash
docker-compose -f docker-compose.dev.yml up -d
```

## Start Backend

```bash
cd server
npm run dev
```

## Start Frontend

```bash
cd client
npm run dev
```

## Stop Database and Redis

```bash
docker-compose -f docker-compose.dev.yml down
```

## Access

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Login: admin@demo.com / demo1234

## Notes

- First time setup: run `cd server && npx prisma migrate deploy && node prisma/seed.js`
- DB port is 5432 (not 5433 like full Docker mode)
- All API keys are in server/.env
