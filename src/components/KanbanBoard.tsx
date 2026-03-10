import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { api, ApiError } from '../api';
import type { TaskResponse, TaskStatus, UserResponse } from '../types';
import KanbanColumn from './KanbanColumn';
import TaskModal from './TaskModal';
import { TaskCardOverlay } from './TaskCard';
import UserSelector from './UserSelector';

const PAGE_SIZE = 20;

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: 'todo', title: 'To Do' },
  { status: 'in_progress', title: 'In Progress' },
  { status: 'done', title: 'Done' },
];

type TasksByStatus = Record<TaskStatus, TaskResponse[]>;

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<TasksByStatus>({ todo: [], in_progress: [], done: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef('');

  // Per-column infinite scroll
  const colPagesRef = useRef<Record<TaskStatus, number>>({ todo: 1, in_progress: 1, done: 1 });
  const colFetchingRef = useRef<Record<TaskStatus, boolean>>({ todo: false, in_progress: false, done: false });
  const [hasMore, setHasMore] = useState<Record<TaskStatus, boolean>>({ todo: false, in_progress: false, done: false });
  const [colLoadingMore, setColLoadingMore] = useState<Record<TaskStatus, boolean>>({ todo: false, in_progress: false, done: false });
  const [totals, setTotals] = useState<Record<TaskStatus, number>>({ todo: 0, in_progress: 0, done: 0 });
  const [overallTotal, setOverallTotal] = useState(0);

  // Modal state
  const [selectedTask, setSelectedTask] = useState<TaskResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>('todo');
  const [isCreating, setIsCreating] = useState(false);

  // Current user (persisted in localStorage)
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [showUserPicker, setShowUserPicker] = useState(false);

  // Drag state
  const [activeTask, setActiveTask] = useState<TaskResponse | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (q?: string) => {
    searchRef.current = q ?? '';
    setLoading(true);
    setError('');
    colPagesRef.current = { todo: 1, in_progress: 1, done: 1 };
    try {
      const [todo, inProgress, done] = await Promise.all([
        api.getTasks({ status: 'todo', search: q || undefined, page_size: PAGE_SIZE, page: 1 }),
        api.getTasks({ status: 'in_progress', search: q || undefined, page_size: PAGE_SIZE, page: 1 }),
        api.getTasks({ status: 'done', search: q || undefined, page_size: PAGE_SIZE, page: 1 }),
      ]);
      setTasks({ todo: todo.items, in_progress: inProgress.items, done: done.items });
      setHasMore({ todo: todo.has_next, in_progress: inProgress.has_next, done: done.has_next });
      setTotals({ todo: todo.total, in_progress: inProgress.total, done: done.total });
      setOverallTotal(todo.total + inProgress.total + done.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load tasks. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSearchChange = (q: string) => {
    setSearch(q);
    searchRef.current = q;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchAll(q), 400);
  };

  const loadMoreForColumn = useCallback(async (status: TaskStatus) => {
    if (colFetchingRef.current[status]) return;
    colFetchingRef.current = { ...colFetchingRef.current, [status]: true };
    const nextPage = colPagesRef.current[status] + 1;
    setColLoadingMore((p) => ({ ...p, [status]: true }));
    try {
      const res = await api.getTasks({
        status,
        search: searchRef.current || undefined,
        page_size: PAGE_SIZE,
        page: nextPage,
      });
      colPagesRef.current = { ...colPagesRef.current, [status]: nextPage };
      setTasks((prev) => ({ ...prev, [status]: [...prev[status], ...res.items] }));
      setHasMore((prev) => ({ ...prev, [status]: res.has_next }));
      setTotals((prev) => ({ ...prev, [status]: res.total }));
    } catch {
      // silent — user can scroll again to retry
    } finally {
      colFetchingRef.current = { ...colFetchingRef.current, [status]: false };
      setColLoadingMore((p) => ({ ...p, [status]: false }));
    }
  }, []);

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const findTask = useCallback(
    (id: string): TaskResponse | undefined => {
      for (const list of Object.values(tasks)) {
        const found = list.find((t) => t.id === id);
        if (found) return found;
      }
    },
    [tasks],
  );

  const getStatusFromId = useCallback(
    (id: string): TaskStatus | null => {
      if (['todo', 'in_progress', 'done'].includes(id)) return id as TaskStatus;
      const task = findTask(id);
      return task?.status ?? null;
    },
    [findTask],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(findTask(event.active.id as string) ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = getStatusFromId(over.id as string);
    if (!newStatus) return;

    const task = findTask(taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    const oldStatus = task.status;
    setTasks((prev) => {
      const updatedTask = { ...task, status: newStatus };
      return {
        ...prev,
        [oldStatus]: prev[oldStatus].filter((t) => t.id !== taskId),
        [newStatus]: [...prev[newStatus], updatedTask],
      };
    });

    try {
      const updated = await api.patchTaskStatus(taskId, newStatus);
      setTasks((prev) => ({
        ...prev,
        [newStatus]: prev[newStatus].map((t) => (t.id === taskId ? updated : t)),
      }));
    } catch {
      // Revert on failure
      setTasks((prev) => {
        const revertedTask = { ...task, status: oldStatus };
        return {
          ...prev,
          [newStatus]: prev[newStatus].filter((t) => t.id !== taskId),
          [oldStatus]: [...prev[oldStatus], revertedTask],
        };
      });
      setError('Failed to move task. Please try again.');
    }
  };

  // ── Modal handlers ────────────────────────────────────────────────────────
  const openCreate = (status: TaskStatus) => {
    setCreateStatus(status);
    setIsCreating(true);
    setSelectedTask(null);
    setModalOpen(true);
  };

  const openDetail = (task: TaskResponse) => {
    setSelectedTask(task);
    setIsCreating(false);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedTask(null);
  };

  const handleTaskSaved = (saved: TaskResponse) => {
    setTasks((prev) => {
      const newTasks = { ...prev };
      // Remove from any column it was in (update case)
      for (const status of Object.keys(newTasks) as TaskStatus[]) {
        newTasks[status] = newTasks[status].filter((t) => t.id !== saved.id);
      }
      // Add to the correct column
      newTasks[saved.status] = [saved, ...newTasks[saved.status]];
      return newTasks;
    });
  };

  const handleTaskDeleted = (taskId: string) => {
    setTasks((prev) => {
      const newTasks = { ...prev };
      for (const status of Object.keys(newTasks) as TaskStatus[]) {
        newTasks[status] = newTasks[status].filter((t) => t.id !== taskId);
      }
      return newTasks;
    });
  };

  // ── Current user selection ────────────────────────────────────────────────
  const handleCurrentUserChange = async (userId: string | null) => {
    if (!userId) {
      setCurrentUser(null);
      localStorage.removeItem('currentUser');
      setShowUserPicker(false);
      return;
    }
    try {
      const user = await api.getUser(userId);
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
    } catch {
      // silently ignore
    }
    setShowUserPicker(false);
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* ── Header ── */}
      <header className="flex items-center gap-5 px-6 h-14 bg-white border-b border-[var(--color-border)] sticky top-0 z-50 shrink-0">
        {/* Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[var(--color-text-1)] flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" fill="white" opacity="0.9"/>
              <rect x="8" y="1" width="5" height="5" rx="1" fill="white" opacity="0.55"/>
              <rect x="1" y="8" width="5" height="5" rx="1" fill="white" opacity="0.55"/>
              <rect x="8" y="8" width="5" height="5" rx="1" fill="white" opacity="0.3"/>
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight text-[var(--color-text-1)]">Tasks</span>
          <span className="text-[11px] text-[var(--color-text-3)] tabular-nums">
            {overallTotal}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-[var(--color-border)] shrink-0" />

        {/* Search */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2 border border-[var(--color-border)] focus-within:border-[var(--color-border-focus)] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] rounded-lg px-3 py-2 max-w-xs w-full transition-all bg-white">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0 text-[var(--color-text-3)]">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="search"
              className="border-none bg-transparent outline-none text-[13px] text-[var(--color-text-1)] flex-1 min-w-0 placeholder:text-[var(--color-text-3)]"
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {search && (
              <button
                className="border-none bg-transparent cursor-pointer text-[var(--color-text-3)] hover:text-[var(--color-text-2)] p-0 leading-none text-xs transition-colors"
                onClick={() => handleSearchChange('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-lg bg-[var(--color-text-1)] text-white text-[12px] font-medium cursor-pointer transition-colors hover:bg-[var(--color-primary-hover)]"
            onClick={() => openCreate('todo')}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            New Task
          </button>
          <div className="relative">
            {showUserPicker ? (
              <div className="absolute right-0 top-[calc(100%+8px)] bg-white border border-[var(--color-border)] rounded-xl shadow-lg shadow-black/5 p-4 min-w-[280px] z-[100]">
                <UserSelector
                  value={currentUser?.id ?? null}
                  onChange={handleCurrentUserChange}
                  placeholder="Select your user"
                  label="Signed in as"
                />
              </div>
            ) : (
              <button
                className="flex items-center gap-2 h-8 pl-1 pr-3 border border-[var(--color-border)] rounded-lg bg-white cursor-pointer text-[13px] text-[var(--color-text-1)] transition-all hover:border-[var(--color-border-focus)] hover:shadow-[0_0_0_3px_rgba(99,102,241,0.08)]"
                onClick={() => setShowUserPicker(true)}
                title={currentUser ? `Signed in as ${currentUser.full_name}` : 'Select user'}
              >
                {currentUser ? (
                  currentUser.avatar_url ? (
                    <img src={currentUser.avatar_url} alt={currentUser.full_name} className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <span className="w-6 h-6 rounded-full inline-flex items-center justify-center bg-[var(--color-surface-2)] text-[var(--color-text-2)] text-[10px] font-semibold">
                      {getInitials(currentUser.full_name)}
                    </span>
                  )
                ) : (
                  <span className="w-6 h-6 rounded-full inline-flex items-center justify-center bg-[var(--color-surface-2)]">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="var(--color-text-3)" strokeWidth="1.5"/><path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="var(--color-text-3)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </span>
                )}
                <span className="text-[12px] font-medium max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap text-[var(--color-text-2)]">
                  {currentUser ? currentUser.full_name : 'Sign in'}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center justify-between gap-3 px-6 py-2.5 bg-[var(--color-danger-light)] text-[var(--color-danger)] border-b border-[var(--color-border)] text-[13px]">
          <span>{error}</span>
          <button
            className="bg-transparent border-none cursor-pointer text-[13px] font-medium text-[var(--color-danger)] underline hover:no-underline"
            onClick={() => { setError(''); fetchAll(search); }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Board ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <main className="flex gap-5 px-6 py-5 overflow-x-auto flex-1 items-start">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              status={col.status}
              title={col.title}
              tasks={tasks[col.status]}
              loading={loading}
              onTaskClick={openDetail}
              onAddTask={openCreate}
              total={totals[col.status]}
              hasMore={hasMore[col.status]}
              loadingMore={colLoadingMore[col.status]}
              onLoadMore={loadMoreForColumn}
            />
          ))}
        </main>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
          {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {/* ── Modal ── */}
      {modalOpen && (
        <TaskModal
          task={isCreating ? null : selectedTask}
          initialStatus={createStatus}
          currentUser={currentUser}
          onClose={handleModalClose}
          onSaved={handleTaskSaved}
          onDeleted={handleTaskDeleted}
        />
      )}
    </div>
  );
}
