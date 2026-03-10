import { useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import type { TaskResponse, TaskStatus } from '@/types';
import TaskCard from '@/components/TaskCard';

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

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  todo:        'bg-[var(--color-status-todo)]',
  in_progress: 'bg-[var(--color-status-progress)]',
  done:        'bg-[var(--color-status-done)]',
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

  useInfiniteScroll(sentinelRef, () => onLoadMore(status), hasMore, '80px');

  return (
    <div className="min-w-[292px] w-[292px] shrink-0 flex flex-col rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] max-h-[calc(100vh-88px)] overflow-hidden">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-white border-b border-[var(--color-border)] rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${COLUMN_ACCENT[status]}`} />
          <h2 className="text-[13px] font-semibold text-[var(--color-text-1)] tracking-tight">{title}</h2>
          <span className="text-[11px] font-medium text-[var(--color-text-3)] tabular-nums">{total}</span>
        </div>
        <button
          className="w-6 h-6 inline-flex items-center justify-center rounded-md text-[var(--color-text-3)] bg-transparent border-none cursor-pointer hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-1)] transition-colors"
          onClick={() => onAddTask(status)}
          title={`Add task to ${title}`}
          aria-label={`Add task to ${title}`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto py-3 px-3 pb-4 flex flex-col gap-2 min-h-[80px] transition-colors${isOver ? ' bg-[var(--color-accent-light)]' : ''}`}
      >
        {loading ? (
          <div className="flex justify-center p-5">
            <div className="w-5 h-5 rounded-full border-[1.5px] border-[var(--color-border)] border-t-[var(--color-accent)] animate-spin-fast" />
          </div>
        ) : tasks.length === 0 ? (
          <div className={`text-center text-[var(--color-text-3)] py-8 px-4 text-[12px] border border-dashed border-[var(--color-border)] rounded-lg${isOver ? ' border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-light)]' : ''}`}>
            {isOver ? 'Release to drop' : 'No tasks'}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))
        )}
        {loadingMore && (
          <div className="flex justify-center py-2">
            <div className="w-4 h-4 rounded-full border-[1.5px] border-[var(--color-border)] border-t-[var(--color-accent)] animate-spin-fast" />
          </div>
        )}
        {!loading && hasMore && <div ref={sentinelRef} className="h-px" />}
      </div>
    </div>
  );
}
