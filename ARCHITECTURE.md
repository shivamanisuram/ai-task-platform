# Architecture Document

## Overview

The platform has five runtime components:

- React frontend served by Nginx.
- Express backend API for authentication, task creation, task reads, and Redis enqueueing.
- MongoDB for users, tasks, logs, results, and status history.
- Redis for asynchronous task dispatch.
- Python worker replicas that consume Redis jobs and update MongoDB.

The user creates a task from the frontend. The API authenticates the request with JWT, writes a MongoDB task document with `pending` status, and pushes a compact job payload to Redis. A worker consumes the job, atomically claims the pending task by updating it to `running`, performs the selected text operation, appends logs, and writes either `success` with result or `failed` with an error.

## Worker Scaling Strategy

Workers are stateless and horizontally scalable. Each replica blocks on the same Redis list with `BRPOP`, so job distribution is naturally shared across replicas. The worker claims a task with a MongoDB conditional update requiring `status: pending`; if two workers ever see the same job due to retry/manual replay, only one can transition that task to `running`.

In Kubernetes the worker deployment starts with three replicas. It can be scaled manually:

```bash
kubectl scale deploy/worker -n ai-task-platform --replicas=10
```

For production, add a KEDA `ScaledObject` based on Redis queue length, for example one worker per 500 queued jobs with a maximum that matches MongoDB and Redis capacity. Because workers do not keep local state, scaling up and down does not require draining sessions.

## Handling 100k Tasks Per Day

100k tasks/day is about 1.16 tasks/second on average, but the design should expect bursts. The API remains responsive because it only validates input, persists the task, and enqueues a job. The expensive work is shifted to workers.

Recommended production settings:

- Use a managed MongoDB replica set with connection pooling and backups.
- Use Redis with AOF persistence and high availability.
- Run at least two backend replicas and multiple worker replicas.
- Add autoscaling for backend CPU/RPS and workers by queue depth.
- Keep task payloads bounded; the API currently caps input text at 10,000 characters.
- Add pagination beyond the latest 100 tasks if users accumulate large histories.
- Archive old task logs/results to object storage if retention grows.

## Database Indexing Strategy

The backend creates these MongoDB indexes through Mongoose schemas:

- `users.email` unique index for login and registration conflict checks.
- `tasks.userId` for ownership filtering.
- `{ userId: 1, createdAt: -1 }` for dashboard task listing.
- `{ status: 1, createdAt: 1 }` for operational queries, retries, or cleanup jobs.

For heavier reporting, add indexes around the exact query patterns rather than indexing every field. Task logs are embedded because they are small and read with the task details. If logs become large, move them to a separate `task_logs` collection keyed by `taskId`.

## Redis Failure Handling

If Redis is unavailable when creating a task, the API marks the task as `failed` and returns `503`, so the user is not left with an invisible pending task. Worker loop errors are logged and retried after a short delay.

For production resilience:

- Use Redis Sentinel, Redis Cluster, or managed Redis with failover.
- Enable AOF persistence to reduce job loss during restarts.
- Add a reconciliation job that periodically finds stale `pending` tasks and re-enqueues them.
- Add a timeout job that moves tasks stuck in `running` back to `pending` or `failed` after a safe threshold.
- For stronger delivery guarantees, migrate the queue to Redis Streams or BullMQ with acknowledgements and retry/dead-letter support.

## Staging and Production Deployment

Keep the application repository and infrastructure repository separate. CI builds immutable images tagged by commit SHA and updates the infra repository image tags. Argo CD watches the infra repository and auto-syncs cluster state.

Use one of these environment strategies:

- Separate clusters for staging and production.
- Separate namespaces and Argo CD applications in one cluster for lower-cost deployments.

Recommended infra layout:

```text
manifests/
  base/
  overlays/
    staging/
    production/
```

Each overlay should set a different ingress host, image tag policy, resource sizing, replica counts, and secret provider. Never commit real secrets. Use External Secrets, Sealed Secrets, SOPS, or your cloud secret manager.

Promotion flow:

1. Merge to `main`.
2. CI lints, builds, pushes images, and updates staging image tags.
3. Argo CD auto-syncs staging.
4. Run smoke tests.
5. Promote the same image SHA to production through a pull request in the infra repository.

## Security Notes

Passwords are hashed with bcrypt. API authentication uses signed JWTs. Helmet sets secure HTTP headers, CORS is restricted by configured frontend origin, and rate limiting is enabled. Containers run as non-root users. Kubernetes manifests define resource requests/limits and health probes.
