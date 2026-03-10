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

  const totalTasks = tasks.todo.length + tasks.in_progress.length + tasks.done.length;

  return (
    <div className="kanban-board-wrapper">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-header__left">
          <span className="app-header__logo">📋</span>
          <h1 className="app-header__title">TaskFlow</h1>
          <span className="app-header__count">{overallTotal} task{totalTasks !== 1 ? 's' : ''}</span>
        </div>
        <div className="app-header__center">
          <div className="search-box">
            <span className="search-box__icon">🔍</span>
            <input
              type="search"
              className="search-box__input"
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {search && (
              <button
                className="search-box__clear"
                onClick={() => handleSearchChange('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="app-header__right">
          <button
            className="btn btn--primary btn--sm"
            onClick={() => openCreate('todo')}
          >
            + New Task
          </button>
          <div className="current-user-wrap">
            {showUserPicker ? (
              <div className="current-user-picker">
                <UserSelector
                  value={currentUser?.id ?? null}
                  onChange={handleCurrentUserChange}
                  placeholder="Select your user"
                  label="You are logged in as"
                />
              </div>
            ) : (
              <button
                className="current-user-btn"
                onClick={() => setShowUserPicker(true)}
                title={currentUser ? `Signed in as ${currentUser.full_name}` : 'Select user'}
              >
                {currentUser ? (
                  currentUser.avatar_url ? (
                    <img src={currentUser.avatar_url} alt={currentUser.full_name} className="avatar" />
                  ) : (
                    <span className="avatar avatar--initials">
                      {getInitials(currentUser.full_name)}
                    </span>
                  )
                ) : (
                  <span className="avatar avatar--empty" title="No user selected">👤</span>
                )}
                <span className="current-user-btn__name">
                  {currentUser ? currentUser.full_name : 'Select user'}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Error banner ── */}
      {error && (
        <div className="board-error">
          <span>{error}</span>
          <button className="btn-text" onClick={() => { setError(''); fetchAll(search); }}>
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
        <main className="kanban-board">
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

        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
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
