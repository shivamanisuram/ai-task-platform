import json
import os
import signal
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from dotenv import load_dotenv
from bson import ObjectId
from pymongo import MongoClient
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError
from redis import Redis

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/ai_task_platform")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
QUEUE_NAME = os.getenv("QUEUE_NAME", "ai_tasks")
POLL_TIMEOUT_SECONDS = int(os.getenv("POLL_TIMEOUT_SECONDS", "5"))
HEALTH_PORT = int(os.getenv("HEALTH_PORT", "8080"))

running = True


def utcnow():
    return datetime.now(timezone.utc)


def stop(_signum, _frame):
    global running
    running = False


def append_log(message):
    return {"message": message, "timestamp": utcnow().isoformat()}


def process(operation, input_text):
    if operation == "uppercase":
        return input_text.upper()
    if operation == "lowercase":
        return input_text.lower()
    if operation == "reverse":
        return input_text[::-1]
    if operation == "word_count":
        return {"words": len([word for word in input_text.split() if word])}
    raise ValueError(f"Unsupported operation: {operation}")


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            self.send_response(404)
            self.end_headers()
            return

        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok\n")

    def log_message(self, _format, *_args):
        return


def start_health_server():
    server = ThreadingHTTPServer(("0.0.0.0", HEALTH_PORT), HealthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def redis_task_key(task_id):
    return f"task:{task_id}"


def process_redis_task(redis, task_id):
    raw = redis.get(redis_task_key(task_id))
    if not raw:
        print(f"Redis task {task_id} was missing", flush=True)
        return

    task = json.loads(raw)
    if task.get("status") != "pending":
        print(f"Redis task {task_id} was already claimed", flush=True)
        return

    now = utcnow().isoformat()
    task["status"] = "running"
    task["startedAt"] = now
    task["updatedAt"] = now
    task.setdefault("logs", []).append(append_log("Worker picked up task"))
    redis.set(redis_task_key(task_id), json.dumps(task))

    try:
        result = process(task["operation"], task["inputText"])
        now = utcnow().isoformat()
        task["status"] = "success"
        task["result"] = result
        task["error"] = None
        task["finishedAt"] = now
        task["updatedAt"] = now
        task["logs"].append(append_log("Task completed successfully"))
        print(f"Redis task {task_id} completed", flush=True)
    except Exception as exc:
        now = utcnow().isoformat()
        task["status"] = "failed"
        task["error"] = str(exc)
        task["finishedAt"] = now
        task["updatedAt"] = now
        task["logs"].append(append_log(f"Task failed: {exc}"))
        print(f"Redis task {task_id} failed: {exc}", flush=True)

    redis.set(redis_task_key(task_id), json.dumps(task))


def mongo_is_available(mongo):
    try:
        mongo.admin.command("ping")
        return True
    except PyMongoError:
        return False


def main():
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    health_server = start_health_server()

    mongo = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
    db = mongo.get_default_database()
    tasks = db.tasks
    redis = Redis.from_url(REDIS_URL, decode_responses=True)

    print("Worker started", flush=True)
    while running:
        try:
            item = redis.brpop(QUEUE_NAME, timeout=POLL_TIMEOUT_SECONDS)
            if not item:
                continue

            _, payload = item
            job = json.loads(payload)
            task_id = job["taskId"]

            if "-" in task_id or not mongo_is_available(mongo):
                process_redis_task(redis, task_id)
                continue

            task = tasks.find_one_and_update(
                {"_id": task_id_to_object_id(task_id), "status": "pending"},
                {
                    "$set": {"status": "running", "startedAt": utcnow()},
                    "$push": {"logs": append_log("Worker picked up task")}
                },
                return_document=ReturnDocument.AFTER
            )

            if not task:
                print(f"Task {task_id} was missing or already claimed", flush=True)
                continue

            try:
                result = process(task["operation"], task["inputText"])
                tasks.update_one(
                    {"_id": task["_id"]},
                    {
                        "$set": {
                            "status": "success",
                            "result": result,
                            "error": None,
                            "finishedAt": utcnow(),
                            "updatedAt": utcnow()
                        },
                        "$push": {"logs": append_log("Task completed successfully")}
                    }
                )
                print(f"Task {task_id} completed", flush=True)
            except Exception as exc:
                tasks.update_one(
                    {"_id": task["_id"]},
                    {
                        "$set": {
                            "status": "failed",
                            "error": str(exc),
                            "finishedAt": utcnow(),
                            "updatedAt": utcnow()
                        },
                        "$push": {"logs": append_log(f"Task failed: {exc}")}
                    }
                )
                print(f"Task {task_id} failed: {exc}", flush=True)
        except Exception as exc:
            print(f"Worker loop error: {exc}", file=sys.stderr, flush=True)
            time.sleep(2)

    print("Worker stopped", flush=True)
    health_server.shutdown()


def task_id_to_object_id(task_id):
    return ObjectId(task_id)


if __name__ == "__main__":
    main()
