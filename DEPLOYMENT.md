# Live Deployment

The fastest hosted deployment path is Render for the three app services, MongoDB Atlas for MongoDB, and Upstash Redis for Redis.

## Required Values

- `MONGO_URI`: MongoDB Atlas connection string.
- `REDIS_URL`: Upstash Redis connection string.
- `JWT_SECRET`: long random secret.
- `FRONTEND_ORIGIN`: deployed frontend URL.
- `VITE_API_URL`: deployed backend URL.

## Render Blueprint

This repository includes `render.yaml`.

1. Open Render.
2. Create a new Blueprint from the GitHub repository.
3. Select `shivamanisuram/ai-task-platform`.
4. Fill the synced environment variables.
5. Deploy.

After Render creates URLs:

- Set backend `FRONTEND_ORIGIN` to the frontend URL.
- Set frontend `VITE_API_URL` to the backend URL.
- Redeploy frontend and backend.

## Kubernetes Path

Use `infra-repo` for the Argo CD deployment. Push it to:

```text
https://github.com/shivamanisuram/ai-task-platform-infra
```

Then apply:

```bash
kubectl apply -f argocd/project.yaml
kubectl apply -f argocd/application.yaml
```
