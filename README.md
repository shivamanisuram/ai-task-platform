# AI Task Processing Platform

MERN-style full stack assignment with a React frontend, Express API, MongoDB, Redis queue, Python worker, Docker, Kubernetes manifests, Argo CD application, and GitHub Actions CI/CD.

## Services

- `frontend`: React/Vite app served by Nginx.
- `backend`: Express API with JWT auth, bcrypt password hashing, Helmet, rate limiting, task CRUD, and Redis enqueueing.
- `worker`: Python background processor that consumes Redis jobs and updates MongoDB task status, logs, and results.
- `mongo`: task and user storage.
- `redis`: job queue.

## Local Setup

1. Copy environment files if you want custom values:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

2. Start everything:

   ```bash
   docker compose up --build
   ```

3. Open the app:

   - Frontend: `http://localhost:5173`
   - API health: `http://localhost:4000/health`

## Development Commands

Backend:

```bash
cd backend
npm install
npm run dev
npm run lint
```

Frontend:

```bash
cd frontend
npm install
npm run dev
npm run lint
npm run build
```

Worker:

```bash
cd worker
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python worker.py
```

## API Overview

- `POST /api/auth/register`: create user and return JWT.
- `POST /api/auth/login`: authenticate and return JWT.
- `GET /api/tasks`: list current user's tasks.
- `POST /api/tasks`: create task and enqueue work.
- `GET /api/tasks/:id`: view logs, status, and result.

Supported operations are `uppercase`, `lowercase`, `reverse`, and `word_count`.

## Kubernetes and GitOps

The sibling `../infra-repo` directory contains deployable manifests and an Argo CD `Application`.

Typical flow:

```bash
kubectl apply -f ../infra-repo/argocd/project.yaml
kubectl apply -f ../infra-repo/argocd/application.yaml
```

Replace placeholder repository URLs, image names, hosts, and base64 secret values before deploying to a real cluster.

## CI/CD

`.github/workflows/ci-cd.yml` lints, builds Docker images, pushes to a registry, then updates image tags in the infrastructure repository. Required repository secrets:

- `REGISTRY_USERNAME`
- `REGISTRY_TOKEN`
- `INFRA_REPO_TOKEN`

Optional variables:

- `REGISTRY`: defaults to `docker.io`
- `IMAGE_NAMESPACE`: defaults to the registry username
- `INFRA_REPO`: `owner/repo` for the separate infrastructure repository
