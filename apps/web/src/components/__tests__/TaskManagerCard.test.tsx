// @vitest-environment jsdom

import '@testing-library/jest-dom';
import '@testing-library/jest-dom/vitest';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import {
  TaskManagerCard,
  type Task,
  type Filter,
  validateTitle,
  createId,
  loadTasks,
  saveTasks,
} from '../TaskManagerCard';

vi.mock('../../stores/auth-store.js', () => ({
  useAuthStore: () => ({ user: { userId: 'user-1' } }),
}));

describe('M2 — Personal Task Manager component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem('vedmoulya-task-manager-v1');
  });

  describe('validation helpers', () => {
    it('validateTitle rejects empty input', () => {
      expect(validateTitle('')).toBe('Task title is required.');
      expect(validateTitle('   ')).toBe('Task title is required.');
    });

    it('validateTitle rejects overly long input', () => {
      const long = 'x'.repeat(201);
      expect(validateTitle(long)).toBe('Task title must be 200 characters or fewer.');
    });

    it('validateTitle accepts valid input', () => {
      expect(validateTitle('Buy milk')).toBe('Buy milk');
      expect(validateTitle('  Buy milk  ')).toBe('Buy milk');
    });
  });

  describe('CRUD', () => {
    it('adds a task from the add form', async () => {
      render(<TaskManagerCard />);
      const input = screen.getByRole('textbox', { name: /new task title/i });
      const addButton = screen.getByRole('button', { name: /add/i });

      await fireEvent.change(input, { target: { value: 'Buy milk' } });
      await fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Buy milk')).toBeInTheDocument();
      });
      // A freshly added task is active, so its control offers the next action:
      // "Mark task as complete".
      expect(screen.getByRole('checkbox', { name: /mark task as complete/i })).toBeInTheDocument();
    });

    it('rejects an empty task title', async () => {
      render(<TaskManagerCard />);
      const addButton = screen.getByRole('button', { name: /add/i });
      await fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Task title is required.')).toBeInTheDocument();
      });
      expect(screen.queryByRole('listitem')).toBeNull();
    });

    it('toggles a task complete/incomplete', async () => {
      render(<TaskManagerCard />);
      const input = screen.getByRole('textbox', { name: /new task title/i });
      await fireEvent.change(input, { target: { value: 'Buy milk' } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        expect(screen.getByText(/Buy milk/i)).toBeInTheDocument();
      });
      // Active task: the checkbox label describes the next action (complete it).
      fireEvent.click(screen.getByRole('checkbox', { name: /mark task as complete/i }));

      await waitFor(() => {
        expect(screen.getByText(/Buy milk/i)).toHaveClass('line-through');
      });

      // Now completed: the control offers the inverse action.
      const uncheck = screen.getByRole('checkbox', {
        name: /mark task as incomplete/i,
      });
      fireEvent.click(uncheck);
      await waitFor(() => {
        expect(screen.getByText(/Buy milk/i)).not.toHaveClass('line-through');
      });
    });

    it('starts, saves, and cancels an edit', async () => {
      render(<TaskManagerCard />);
      const input = screen.getByRole('textbox', { name: /new task title/i });
      await fireEvent.change(input, { target: { value: 'Old title' } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });

      const editInput = screen.getByRole('textbox', {
        name: /edit task title/i,
      });
      await fireEvent.change(editInput, { target: { value: 'New title' } });
      await fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(screen.getByText('New title')).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: /edit task title/i })).toBeNull();
      });
    });

    it('cancels an edit without changing the title', async () => {
      render(<TaskManagerCard />);
      const input = screen.getByRole('textbox', { name: /new task title/i });
      await fireEvent.change(input, { target: { value: 'Original' } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });

      const editInput = screen.getByRole('textbox', {
        name: /edit task title/i,
      });
      await fireEvent.change(editInput, { target: { value: 'Changed' } });
      await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.getByText('Original')).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: /edit task title/i })).toBeNull();
      });
    });

    it('rejects an edit with an empty title', async () => {
      render(<TaskManagerCard />);
      const input = screen.getByRole('textbox', { name: /new task title/i });
      await fireEvent.change(input, { target: { value: 'Something' } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      });

      const editInput = screen.getByRole('textbox', {
        name: /edit task title/i,
      });
      await fireEvent.change(editInput, { target: { value: '   ' } });
      await fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(screen.getByText('Task title is required.')).toBeInTheDocument();
      });
      // The rejected edit must not mutate the stored title: the row stays in
      // edit mode, so cancel and confirm the original title is intact.
      await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      await waitFor(() => {
        expect(screen.getByText('Something')).toBeInTheDocument();
      });
    });

    it('deletes a task', async () => {
      render(<TaskManagerCard />);
      const input = screen.getByRole('textbox', { name: /new task title/i });
      await fireEvent.change(input, { target: { value: 'Delete me' } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        expect(screen.getByText('Delete me')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /^delete task: delete me$/i }));

      await waitFor(() => {
        expect(screen.queryByText('Delete me')).toBeNull();
      });
    });
  });

  describe('filters', () => {
    it('shows all tasks by default', async () => {
      render(<TaskManagerCard />);
      const input = screen.getByRole('textbox', { name: /new task title/i });
      await fireEvent.change(input, { target: { value: 'Task A' } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        expect(screen.getByText('Task A')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /all/i })).toHaveAttribute('aria-pressed', 'true');
    });

    it('filters to active tasks', async () => {
      render(<TaskManagerCard />);
      const input = screen.getByRole('textbox', { name: /new task title/i });

      await fireEvent.change(input, { target: { value: 'Active task' } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      await fireEvent.change(input, { target: { value: 'Completed task' } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      // Both tasks start active, so both checkboxes share the label
      // "Mark task as complete". Scope to the row for "Completed task".
      const completedRow = screen
        .getAllByTestId('task-row')
        .find((row) => within(row).queryByText('Completed task') !== null)!;
      fireEvent.click(
        within(completedRow).getByRole('checkbox', {
          name: /mark task as complete/i,
        }),
      );

      await waitFor(() => {
        expect(
          within(completedRow).getByRole('checkbox', {
            name: /mark task as incomplete/i,
          }),
        ).toBeInTheDocument();
      });

      // The task titled "Active task" makes a bare /active/i match its Edit/Delete
      // buttons too. Anchor to the filter button's accessible name.
      fireEvent.click(screen.getByRole('button', { name: /^active \(/i }));

      await waitFor(() => {
        expect(screen.getByText('Active task')).toBeInTheDocument();
        expect(screen.queryByText('Completed task')).toBeNull();
      });
      expect(screen.getByRole('button', { name: /^active \(/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('filters to completed tasks', async () => {
      render(<TaskManagerCard />);
      const input = screen.getByRole('textbox', { name: /new task title/i });

      await fireEvent.change(input, { target: { value: 'First' } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      await fireEvent.change(input, { target: { value: 'Second' } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      // Both tasks start active, so both checkboxes share the label
      // "Mark task as complete". Scope to the row for "First".
      const firstRow = screen
        .getAllByTestId('task-row')
        .find((row) => within(row).queryByText('First') !== null)!;
      fireEvent.click(
        within(firstRow).getByRole('checkbox', {
          name: /mark task as complete/i,
        }),
      );

      await waitFor(() => {
        expect(
          within(firstRow).getByRole('checkbox', {
            name: /mark task as incomplete/i,
          }),
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /completed/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.queryByText('Second')).toBeNull();
      });
      expect(screen.getByRole('button', { name: /completed/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  describe('local persistence', () => {
    it('persists tasks to localStorage and reloads them', async () => {
      const { unmount } = render(<TaskManagerCard />);
      const input = screen.getByRole('textbox', { name: /new task title/i });
      await fireEvent.change(input, { target: { value: 'Persistent task' } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        expect(screen.getByText('Persistent task')).toBeInTheDocument();
      });

      const stored = window.localStorage.getItem('vedmoulya-task-manager-v1');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.some((t: Task) => t.title === 'Persistent task')).toBe(true);

      unmount();

      // Re-render to simulate reload from persistence.
      render(<TaskManagerCard />);
      await waitFor(() => {
        expect(screen.getByText('Persistent task')).toBeInTheDocument();
      });
    });

    it('loads initial tasks from localStorage when no tasks are present', async () => {
      window.localStorage.setItem(
        'vedmoulya-task-manager-v1',
        JSON.stringify([
          {
            id: 'seed-1',
            title: 'Seeded task',
            completed: false,
            createdAt: 1,
            updatedAt: 1,
          },
        ]),
      );

      render(<TaskManagerCard />);
      await waitFor(() => {
        expect(screen.getByText('Seeded task')).toBeInTheDocument();
      });
    });
  });

  describe('empty states and counts', () => {
    it('shows an empty state when there are no tasks', () => {
      render(<TaskManagerCard />);
      expect(screen.getByText('No tasks yet. Add one above.')).toBeInTheDocument();
    });

    it('shows the active empty state when filtered to active with no active tasks', async () => {
      render(<TaskManagerCard />);
      const input = screen.getByRole('textbox', { name: /new task title/i });
      await fireEvent.change(input, { target: { value: 'Done' } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      const checkbox = screen.getByRole('checkbox', {
        name: /mark task as complete/i,
      });
      await fireEvent.click(checkbox);

      await waitFor(() => {
        expect(
          screen.getByRole('checkbox', { name: /mark task as incomplete/i }),
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /active/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('No active tasks. You are all caught up.')).toBeInTheDocument();
      });
    });

    it('shows the completed empty state when filtered to completed with no completed tasks', async () => {
      render(<TaskManagerCard />);
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /completed/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('No completed tasks yet.')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility and semantics', () => {
    it('renders the add form with accessible names', () => {
      render(<TaskManagerCard />);
      expect(screen.getByRole('textbox', { name: /new task title/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
    });

    it('renders filter buttons with pressed state', () => {
      render(<TaskManagerCard />);
      const filters = screen.getAllByRole('button', {
        name: /all|active|completed/i,
      });
      expect(filters).toHaveLength(3);
      filters.forEach((b) => expect(b).toHaveAttribute('aria-pressed'));
    });

    it('renders task actions with descriptive labels', async () => {
      render(<TaskManagerCard />);
      const input = screen.getByRole('textbox', { name: /new task title/i });
      await fireEvent.change(input, { target: { value: 'Action labels' } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /edit task: action labels/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /delete task: action labels/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('initialTasks prop', () => {
    it('uses the initialTasks seed when localStorage is empty', () => {
      window.localStorage.removeItem('vedmoulya-task-manager-v1');
      render(
        <TaskManagerCard
          initialTasks={[
            {
              id: 'init-1',
              title: 'Initial task',
              completed: false,
              createdAt: 1,
              updatedAt: 1,
            },
          ]}
        />,
      );
      expect(screen.getByText('Initial task')).toBeInTheDocument();
    });

    it('prefers persisted localStorage data over initialTasks', () => {
      window.localStorage.setItem(
        'vedmoulya-task-manager-v1',
        JSON.stringify([
          {
            id: 'stored-1',
            title: 'Stored task',
            completed: false,
            createdAt: 1,
            updatedAt: 1,
          },
        ]),
      );
      render(
        <TaskManagerCard
          initialTasks={[
            {
              id: 'init-1',
              title: 'Initial task',
              completed: false,
              createdAt: 1,
              updatedAt: 1,
            },
          ]}
        />,
      );
      expect(screen.getByText('Stored task')).toBeInTheDocument();
      expect(screen.queryByText('Initial task')).toBeNull();
    });
  });

  describe('title length validation', () => {
    it('accepts a 200-character title', async () => {
      render(<TaskManagerCard />);
      const input = screen.getByRole('textbox', { name: /new task title/i });
      const title = 'x'.repeat(200);
      await fireEvent.change(input, { target: { value: title } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        expect(screen.getByText(title)).toBeInTheDocument();
        expect(
          screen.getByRole('checkbox', { name: /mark task as complete/i }),
        ).toBeInTheDocument();
      });
    });

    it('rejects a 201-character title', async () => {
      render(<TaskManagerCard />);
      const input = screen.getByRole('textbox', { name: /new task title/i });
      const title = 'x'.repeat(201);
      await fireEvent.change(input, { target: { value: title } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        expect(screen.getByText('Task title must be 200 characters or fewer.')).toBeInTheDocument();
      });
      expect(screen.queryByRole('listitem')).toBeNull();
    });
  });

  describe('edit validation mirrors add validation', () => {
    it('rejects an edit with an overly long title', async () => {
      render(<TaskManagerCard />);
      const input = screen.getByRole('textbox', { name: /new task title/i });
      const title = 'Editable task';
      await fireEvent.change(input, { target: { value: title } });
      await fireEvent.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        expect(screen.getByText(title)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /^edit task: editable task$/i }));

      const editInput = screen.getByRole('textbox', {
        name: /edit task title/i,
      });
      await fireEvent.change(editInput, { target: { value: 'x'.repeat(201) } });
      await fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(screen.getByText('Task title must be 200 characters or fewer.')).toBeInTheDocument();
      });
      // The rejected edit must not mutate the stored title: the row stays in
      // edit mode, so cancel and confirm the original title is intact.
      await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      await waitFor(() => {
        expect(screen.getByText(title)).toBeInTheDocument();
      });
    });
  });
});
