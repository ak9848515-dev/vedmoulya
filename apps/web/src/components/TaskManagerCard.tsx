'use client';

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — M2 Personal Task Manager component
//
// Single isolated workspace surface for the M2 acceptance product.
// Local-first localStorage persistence. No backend, no secrets, no network.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';

import { useState, useEffect, useCallback, type ChangeEvent } from 'react';

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export type Filter = 'all' | 'active' | 'completed';

// ── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vedmoulya-task-manager-v1';

export function loadTasks(): Task[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Task[];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // LocalStorage unavailable — in-memory state still works for the session.
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function validateTitle(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 'Task title is required.';
  if (trimmed.length > 200) return 'Task title must be 200 characters or fewer.';
  return trimmed;
}

// ── Component ────────────────────────────────────────────────────────────────

interface TaskManagerCardProps {
  /** An optional initial task list to seed the component's state (ignored if the
   *  store already has data in localStorage). Used by tests to control initial state. */
  initialTasks?: Task[];
  /** Called whenever the underlying task list changes (persisted copy). */
  onChange?: (tasks: Task[]) => void;
}

export function TaskManagerCard({
  initialTasks = [],
  onChange,
}: TaskManagerCardProps): React.JSX.Element {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const persisted = loadTasks();
    return persisted.length > 0 ? persisted : initialTasks;
  });
  const [filter, setFilter] = useState<Filter>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newTitleError, setNewTitleError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingTitleError, setEditingTitleError] = useState('');

  useEffect(() => {
    if (tasks.length > 0) saveTasks(tasks);
    onChange?.(tasks);
  }, [tasks, onChange]);

  const persist = useCallback((next: Task[]): void => {
    setTasks(next);
  }, []);

  const addTask = useCallback(
    (e: React.SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();
      const title = validateTitle(newTitle);
      setNewTitle('');
      if (title !== newTitle) {
        setNewTitleError(title);
        return;
      }
      if (title.length === 0) return;
      const now = Date.now();
      const task: Task = {
        id: createId(),
        title,
        completed: false,
        createdAt: now,
        updatedAt: now,
      };
      persist([task, ...tasks]);
      setNewTitleError('');
    },
    [tasks, persist, newTitle],
  );

  const toggleTask = useCallback(
    (id: string) => {
      persist(
        tasks.map((t) =>
          t.id === id ? { ...t, completed: !t.completed, updatedAt: Date.now() } : t,
        ),
      );
    },
    [tasks, persist],
  );

  const startEdit = useCallback((task: Task) => {
    setEditingId(task.id);
    setEditingTitle(task.title);
    setEditingTitleError('');
  }, []);

  const commitEdit = useCallback(
    (id: string) => {
      const title = validateTitle(editingTitle);
      setEditingTitle('');
      if (title !== editingTitle) {
        setEditingTitleError(title);
        return;
      }
      if (title.length === 0) return;
      persist(tasks.map((t) => (t.id === id ? { ...t, title, updatedAt: Date.now() } : t)));
      setEditingId(null);
      setEditingTitleError('');
    },
    [tasks, persist, editingTitle],
  );

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingTitle('');
    setEditingTitleError('');
  }, []);

  const deleteTask = useCallback(
    (id: string) => {
      persist(tasks.filter((t) => t.id !== id));
    },
    [tasks, persist],
  );

  const filtered = tasks.filter((t) => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const counts = {
    all: tasks.length,
    active: tasks.length - tasks.filter((t) => t.completed).length,
    completed: tasks.filter((t) => t.completed).length,
  };

  return (
    <div className="mx-auto max-w-xl text-[#0F172A]">
      {/* Add task */}
      <form onSubmit={addTask} className="mb-8 flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setNewTitle(e.target.value);
            if (newTitleError) setNewTitleError('');
          }}
          placeholder="What needs to be done?"
          className="flex-1 rounded-lg border border-[#CBD5E1] bg-white px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2B5FD9] focus:outline-none focus:ring-2 focus:ring-[#2B5FD9]/40 sm:text-base"
          aria-label="New task title"
          aria-invalid={newTitleError !== ''}
          aria-describedby={newTitleError ? 'taskmanager-new-title-error' : undefined}
        />
        <button
          type="submit"
          className="rounded-lg bg-[#2B5FD9] px-5 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1E4AA8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] sm:text-base"
        >
          Add
        </button>
      </form>
      {newTitleError && (
        <p id="taskmanager-new-title-error" className="mb-6 text-sm text-[#B91C1C]" role="alert">
          {newTitleError}
        </p>
      )}
      {/* Filters */}
      <nav aria-label="Filter tasks" className="mb-6 flex gap-2 text-sm">
        {(['all', 'active', 'completed'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFilter(f);
            }}
            className={`rounded-full px-4 py-1.5 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
              filter === f
                ? 'bg-[#2B5FD9] text-white'
                : 'bg-white text-[#475569] hover:bg-[#F1F5F9]'
            }`}
            aria-pressed={filter === f}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'all'
              ? ` (${counts.all})`
              : f === 'active'
                ? ` (${counts.active})`
                : ` (${counts.completed})`}
          </button>
        ))}
      </nav>{' '}
      {/* Task list */}
      {filtered.length === 0 ? (
        <p
          className="rounded-lg border border-[#E2E8F0] bg-white px-5 py-8 text-center text-sm text-[#64748B]"
          data-testid="task-empty"
        >
          {filter === 'active'
            ? 'No active tasks. You are all caught up.'
            : filter === 'completed'
              ? 'No completed tasks yet.'
              : 'No tasks yet. Add one above.'}
        </p>
      ) : (
        <ul className="space-y-2" role="list" data-testid="task-list">
          {filtered.map((task) => (
            <li
              key={task.id}
              data-testid="task-row"
              className="flex items-start gap-3 rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm transition-colors hover:border-[#CBD5E1]"
            >
              {editingId === task.id ? (
                <>
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => {
                      toggleTask(task.id);
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#2B5FD9] focus:ring-[#2B5FD9] focus:ring-offset-0"
                    aria-label={`Mark task as ${task.completed ? 'incomplete' : 'complete'}`}
                  />
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setEditingTitle(e.target.value);
                      if (editingTitleError) setEditingTitleError('');
                    }}
                    className="flex-1 border-none bg-transparent text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-0 sm:text-base"
                    autoFocus
                    aria-label="Edit task title"
                    aria-invalid={editingTitleError !== ''}
                    aria-describedby={
                      editingTitleError ? 'taskmanager-edit-title-error' : undefined
                    }
                  />
                  {editingTitleError && (
                    <p
                      id="taskmanager-edit-title-error"
                      className="mb-1 text-sm text-[#B91C1C]"
                      role="alert"
                    >
                      {editingTitleError}
                    </p>
                  )}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        commitEdit(task.id);
                      }}
                      className="rounded bg-[#15803D] px-3 py-1 text-xs font-medium text-white hover:bg-[#166534] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded bg-[#F1F5F9] px-3 py-1 text-xs font-medium text-[#475569] hover:bg-[#E2E8F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => {
                      toggleTask(task.id);
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#2B5FD9] focus:ring-[#2B5FD9] focus:ring-offset-0"
                    aria-label={`Mark task as ${task.completed ? 'incomplete' : 'complete'}`}
                  />
                  <span
                    className={`flex-1 text-sm sm:text-base ${
                      task.completed ? 'line-through text-[#94A3B8]' : 'text-[#0F172A]'
                    }`}
                  >
                    {task.title}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        startEdit(task);
                      }}
                      className="rounded bg-[#F1F5F9] px-2 py-1 text-xs font-medium text-[#475569] hover:bg-[#E2E8F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
                      aria-label={`Edit task: ${task.title}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteTask(task.id);
                      }}
                      className="rounded bg-[#FEF2F2] px-2 py-1 text-xs font-medium text-[#B91C1C] hover:bg-[#FEE2E2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
                      aria-label={`Delete task: ${task.title}`}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {tasks.length > 0 && (
        <p className="mt-6 border-t border-[#E2E8F0] pt-4 text-center text-xs text-[#94A3B8]">
          {counts.active} active · {counts.completed} completed · {tasks.length} total
          <br />
          Data is stored in this browser only.
        </p>
      )}
    </div>
  );
}
