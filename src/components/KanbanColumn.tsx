import { useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { TaskResponse, TaskStatus } from '../types';
import TaskCard from './TaskCard';

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: TaskResponse[];
  loading: boolean;
  onTaskClick: (task: TaskResponse) => void;
  onAddTask: (status: TaskStatus) => void;
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: (status: TaskStatus) => void;
}

const COLUMN_ICON: Record<TaskStatus, string> = {
  todo: '⚪',
  in_progress: '🔵',
  done: '🟢',
};

const COLUMN_TOP_COLOR: Record<TaskStatus, string> = {
  todo: 'border-t-[var(--color-status-todo)]',
  in_progress: 'border-t-[var(--color-status-progress)]',
  done: 'border-t-[var(--color-status-done)]',
};

export default function KanbanColumn({
  status,
  title,
  tasks,
  loading,
  onTaskClick,
  onAddTask,
  total,
  hasMore,
  loadingMore,
  onLoadMore,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onLoadMore(status); },
      { threshold: 0, rootMargin: '80px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, status, onLoadMore]);

  return (
    <div className={`min-w-[300px] w-[300px] shrink-0 flex flex-col rounded-xl overflow-hidden bg-[var(--color-surface-2)] border-[1.5px] border-t-[3px] border-[var(--color-border)] ${COLUMN_TOP_COLOR[status]} max-h-[calc(100vh-120px)]`}>
      {/* Column header */}
      <div className="flex items-center justify-between px-3.5 py-3 shrink-0 bg-white border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <span className="text-sm">{COLUMN_ICON[status]}</span>
          <h2 className="text-[13px] font-bold text-[var(--color-text-1)]">{title}</h2>
          <span className="text-[11px] font-bold min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]">
            {total}
          </span>
        </div>
        <button
          className="w-6.5 h-6.5 inline-flex items-center justify-center rounded text-lg leading-none text-[var(--color-text-3)] bg-transparent border-none cursor-pointer hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)] transition-colors"
          onClick={() => onAddTask(status)}
          title={`Add task to ${title}`}
          aria-label={`Add task to ${title}`}
        >
          +
        </button>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto py-2.5 px-2.5 pb-4 flex flex-col gap-2 min-h-[80px] tasks-scroll transition-colors${isOver ? ' bg-indigo-50/60' : ''}`}
      >
        {loading ? (
          <div className="flex justify-center p-4">
            <div className="w-6 h-6 rounded-full border-[2.5px] border-[var(--color-border)] border-t-[var(--color-primary)] animate-spin-fast" />
          </div>
        ) : tasks.length === 0 ? (
          <div className={`text-center text-[var(--color-text-3)] py-6 px-4 text-[13px] border-[1.5px] border-dashed border-[var(--color-border)] rounded-lg m-1${isOver ? ' border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary-light)]' : ''}`}>
            {isOver ? 'Drop here' : 'No tasks'}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))
        )}
        {loadingMore && (
          <div className="flex justify-center py-2">
            <div className="w-6 h-6 rounded-full border-[2.5px] border-[var(--color-border)] border-t-[var(--color-primary)] animate-spin-fast" />
          </div>
        )}
        {!loading && hasMore && <div ref={sentinelRef} className="h-px" />}
      </div>
    </div>
  );
}
