import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api.js";
import "./styles.css";

const operations = [
  { value: "uppercase", label: "Uppercase" },
  { value: "lowercase", label: "Lowercase" },
  { value: "reverse", label: "Reverse" },
  { value: "word_count", label: "Word count" }
];

function AuthForm({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const payload =
        mode === "register"
          ? form
          : {
              email: form.email,
              password: form.password
            };
      const data = await api(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">AI Task Processing Platform</p>
          <h1>Queue text jobs and watch workers process them.</h1>
        </div>
        <div className="tabs" role="tablist">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">
            Login
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">
            Register
          </button>
        </div>
        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Name
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                minLength={2}
                required
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              minLength={mode === "register" ? 8 : 1}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">
            {mode === "register" ? "Create account" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function TaskForm({ onCreated }) {
  const [form, setForm] = useState({
    title: "",
    inputText: "",
    operation: "uppercase"
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm({ title: "", inputText: "", operation: "uppercase" });
      onCreated(data.task);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="task-form" onSubmit={submit}>
      <label>
        Title
        <input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          maxLength={120}
          required
        />
      </label>
      <label>
        Operation
        <select value={form.operation} onChange={(event) => setForm({ ...form, operation: event.target.value })}>
          {operations.map((operation) => (
            <option key={operation.value} value={operation.value}>
              {operation.label}
            </option>
          ))}
        </select>
      </label>
      <label className="wide">
        Input text
        <textarea
          value={form.inputText}
          onChange={(event) => setForm({ ...form, inputText: event.target.value })}
          rows={6}
          maxLength={10000}
          required
        />
      </label>
      {error && <p className="error wide">{error}</p>}
      <button className="primary wide" disabled={busy} type="submit">
        {busy ? "Queueing..." : "Run task"}
      </button>
    </form>
  );
}

function TaskDetails({ task }) {
  if (!task) {
    return <div className="empty">Select a task to inspect logs and results.</div>;
  }

  return (
    <section className="details">
      <div className="details-head">
        <div>
          <h2>{task.title}</h2>
          <p>{operations.find((item) => item.value === task.operation)?.label}</p>
        </div>
        <span className={`status ${task.status}`}>{task.status}</span>
      </div>
      <div className="result-box">
        <h3>Result</h3>
        <pre>{task.result === null || task.result === undefined ? task.error || "No result yet" : JSON.stringify(task.result, null, 2)}</pre>
      </div>
      <div className="log-box">
        <h3>Logs</h3>
        {task.logs?.length ? (
          <ol>
            {task.logs.map((log, index) => (
              <li key={`${log.timestamp}-${index}`}>
                <time>{new Date(log.timestamp).toLocaleString()}</time>
                {log.message}
              </li>
            ))}
          </ol>
        ) : (
          <p>No logs yet.</p>
        )}
      </div>
    </section>
  );
}

function Dashboard({ user, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [error, setError] = useState("");

  async function loadTasks() {
    try {
      const data = await api("/api/tasks");
      setTasks(data.tasks);
      setError("");
      if (!selectedId && data.tasks[0]) {
        setSelectedId(data.tasks[0]._id);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadSelectedTask(id) {
    if (!id) return;
    try {
      const data = await api(`/api/tasks/${id}`);
      setSelectedTask(data.task);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    loadSelectedTask(selectedId);
    const interval = setInterval(() => {
      loadTasks();
      loadSelectedTask(selectedId);
    }, 2500);
    return () => clearInterval(interval);
  }, [selectedId]);

  const counts = useMemo(
    () =>
      tasks.reduce(
        (acc, task) => {
          acc[task.status] += 1;
          return acc;
        },
        { pending: 0, running: 0, success: 0, failed: 0 }
      ),
    [tasks]
  );

  return (
    <main className="dashboard">
      <header>
        <div>
          <p className="eyebrow">Signed in as {user.name}</p>
          <h1>AI Task Processor</h1>
        </div>
        <button className="ghost" onClick={onLogout} type="button">
          Logout
        </button>
      </header>
      <section className="metrics">
        {Object.entries(counts).map(([status, count]) => (
          <div key={status}>
            <span>{status}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </section>
      {error && <p className="error">{error}</p>}
      <section className="workspace-grid">
        <div>
          <h2>Create Task</h2>
          <TaskForm
            onCreated={(task) => {
              setTasks((current) => [task, ...current]);
              setSelectedId(task._id);
            }}
          />
          <h2>Recent Tasks</h2>
          <div className="task-list">
            {tasks.map((task) => (
              <button
                className={task._id === selectedId ? "task-row active" : "task-row"}
                key={task._id}
                onClick={() => setSelectedId(task._id)}
                type="button"
              >
                <span>
                  <strong>{task.title}</strong>
                  <small>{new Date(task.createdAt).toLocaleString()}</small>
                </span>
                <em className={`status ${task.status}`}>{task.status}</em>
              </button>
            ))}
            {!tasks.length && <div className="empty">No tasks yet.</div>}
          </div>
        </div>
        <TaskDetails task={selectedTask} />
      </section>
    </main>
  );
}

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  return user ? <Dashboard user={user} onLogout={logout} /> : <AuthForm onAuth={setUser} />;
}

createRoot(document.getElementById("root")).render(<App />);
