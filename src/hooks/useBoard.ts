import { useState, useCallback, useRef, useEffect } from 'react';
import { api, ApiError } from '@/api';
import type { TaskResponse, TaskStatus } from '@/types';

const PAGE_SIZE = 20;

export type TasksByStatus = Record<TaskStatus, TaskResponse[]>;

export function useBoard() {
  const [tasks, setTasks] = useState<TasksByStatus>({ todo: [], in_progress: [], done: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef('');

  const colPagesRef = useRef<Record<TaskStatus, number>>({ todo: 1, in_progress: 1, done: 1 });
  const colFetchingRef = useRef<Record<TaskStatus, boolean>>({ todo: false, in_progress: false, done: false });
  const [hasMore, setHasMore] = useState<Record<TaskStatus, boolean>>({ todo: false, in_progress: false, done: false });
  const [colLoadingMore, setColLoadingMore] = useState<Record<TaskStatus, boolean>>({ todo: false, in_progress: false, done: false });
  const [totals, setTotals] = useState<Record<TaskStatus, number>>({ todo: 0, in_progress: 0, done: 0 });
  const [overallTotal, setOverallTotal] = useState(0);

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

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSearchChange = useCallback((q: string) => {
    setSearch(q);
    searchRef.current = q;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchAll(q), 400);
  }, [fetchAll]);

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

  const handleTaskSaved = useCallback((saved: TaskResponse) => {
    setTasks((prev) => {
      const next = { ...prev };
      for (const s of Object.keys(next) as TaskStatus[]) {
        next[s] = next[s].filter((t) => t.id !== saved.id);
      }
      next[saved.status] = [saved, ...next[saved.status]];
      return next;
    });
  }, []);

  const handleTaskDeleted = useCallback((taskId: string) => {
    setTasks((prev) => {
      const next = { ...prev };
      for (const s of Object.keys(next) as TaskStatus[]) {
        next[s] = next[s].filter((t) => t.id !== taskId);
      }
      return next;
    });
  }, []);

  return {
    tasks, setTasks, loading, error, setError,
    search, handleSearchChange,
    hasMore, colLoadingMore, totals, overallTotal,
    loadMoreForColumn,
    handleTaskSaved, handleTaskDeleted,
    fetchAll,
  };
}
