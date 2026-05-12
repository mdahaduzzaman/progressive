"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Todo = { id: string; text: string; done: boolean; createdAt: number };

type Props = {
  tenantSlug: string;
  tenantName: string;
  tenantShortName: string;
};

function storageKey(slug: string) {
  return `progressive.todos.v1.${slug}`;
}

function loadTodos(slug: string): Todo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t && typeof t.id === "string" && typeof t.text === "string");
  } catch {
    return [];
  }
}

export function TodoApp({ tenantSlug, tenantName, tenantShortName }: Props) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTodos(loadTodos(tenantSlug));
    setHydrated(true);
  }, [tenantSlug]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageKey(tenantSlug), JSON.stringify(todos));
  }, [todos, hydrated, tenantSlug]);

  const remaining = useMemo(() => todos.filter((t) => !t.done).length, [todos]);

  function add() {
    const text = draft.trim();
    if (!text) return;
    const todo: Todo = {
      id: crypto.randomUUID(),
      text,
      done: false,
      createdAt: Date.now(),
    };
    setTodos((prev) => [todo, ...prev]);
    setDraft("");
    inputRef.current?.focus();
  }

  function toggle(id: string) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function remove(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  function clearCompleted() {
    setTodos((prev) => prev.filter((t) => !t.done));
  }

  return (
    <main>
      <header className="app-header">
        <div className="logo" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4 4 10-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h1>{tenantName}</h1>
          <p>
            Installable. Offline-first.{" "}
            <span style={{ opacity: 0.7 }}>tenant: <code>{tenantSlug}</code></span>
          </p>
        </div>
        <span className="tenant-badge" aria-label="Active tenant">{tenantShortName}</span>
      </header>

      <div className="card">
        <div className="composer">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="What needs doing?"
            aria-label="New todo"
          />
          <button onClick={add} disabled={!draft.trim()}>
            Add
          </button>
        </div>

        <div className="list" role="list">
          {!hydrated ? null : todos.length === 0 ? (
            <div className="list-empty">No todos yet — add your first one above.</div>
          ) : (
            todos.map((t) => (
              <div className="item" role="listitem" key={t.id}>
                <button
                  className="check"
                  data-on={t.done}
                  onClick={() => toggle(t.id)}
                  aria-label={t.done ? "Mark as not done" : "Mark as done"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12.5l4 4 10-10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div className="text" data-done={t.done}>{t.text}</div>
                <button className="delete" onClick={() => remove(t.id)} aria-label="Delete todo">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="footer-bar">
          <span>{remaining} remaining</span>
          <button onClick={clearCompleted} disabled={todos.every((t) => !t.done)}>
            Clear completed
          </button>
        </div>
      </div>
    </main>
  );
}
