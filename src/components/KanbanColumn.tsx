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
    <div className={`kanban-column kanban-column--${status}`}>
      {/* Column header */}
      <div className="kanban-column__header">
        <div className="kanban-column__header-left">
          <span className="kanban-column__icon">{COLUMN_ICON[status]}</span>
          <h2 className="kanban-column__title">{title}</h2>
          <span className="kanban-column__count">{total}</span>
        </div>
        <button
          className="btn-icon kanban-column__add-btn"
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
        className={`kanban-column__tasks${isOver ? ' kanban-column__tasks--over' : ''}`}
      >
        {loading ? (
          <div className="kanban-column__loading">
            <div className="spinner-sm" />
          </div>
        ) : tasks.length === 0 ? (
          <div className={`kanban-column__empty${isOver ? ' kanban-column__empty--over' : ''}`}>
            {isOver ? 'Drop here' : 'No tasks'}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))
        )}
        {loadingMore && (
          <div className="kanban-column__load-more"><div className="spinner-sm" /></div>
        )}
        {!loading && hasMore && <div ref={sentinelRef} className="kanban-column__sentinel" />}
      </div>
    </div>
  );
}
