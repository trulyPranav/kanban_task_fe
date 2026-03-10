import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { TaskResponse, TaskPriority } from '../types';

interface TaskCardProps {
  task: TaskResponse;
  onClick: (task: TaskResponse) => void;
  isDragOverlay?: boolean;
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Med',
  high: 'High',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDueDate(iso: string | null): { text: string; overdue: boolean } | null {
  if (!iso) return null;
  const due = new Date(iso);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return { text: 'Overdue', overdue: true };
  if (diffDays === 0) return { text: 'Today', overdue: false };
  if (diffDays === 1) return { text: 'Tomorrow', overdue: false };
  return {
    text: new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    overdue: false,
  };
}

/** Card rendered inside the DragOverlay (no drag listeners needed) */
function CardContent({ task }: { task: TaskResponse }) {
  const dueInfo = formatDueDate(task.due_date);
  return (
    <>
      <div className="task-card__top">
        <span className={`priority-badge priority-badge--${task.priority}`}>
          {PRIORITY_LABEL[task.priority]}
        </span>
        {task.due_date && dueInfo && (
          <span className={`task-card__due${dueInfo.overdue ? ' task-card__due--overdue' : ''}`}>
            📅 {dueInfo.text}
          </span>
        )}
      </div>

      <h3 className="task-card__title">{task.title}</h3>

      {task.description && (
        <p className="task-card__desc">{task.description}</p>
      )}

      <div className="task-card__footer">
        <div className="task-card__assignee">
          {task.assignee ? (
            <>
              {task.assignee.avatar_url ? (
                <img
                  src={task.assignee.avatar_url}
                  alt={task.assignee.full_name}
                  className="avatar avatar--xs"
                />
              ) : (
                <span className="avatar avatar--xs avatar--initials">
                  {getInitials(task.assignee.full_name)}
                </span>
              )}
              <span className="task-card__assignee-name">{task.assignee.full_name}</span>
            </>
          ) : (
            <span className="task-card__unassigned">Unassigned</span>
          )}
        </div>
        {task.comment_count > 0 && (
          <span className="task-card__comments">
            💬 {task.comment_count}
          </span>
        )}
      </div>
    </>
  );
}

export function TaskCardOverlay({ task }: { task: TaskResponse }) {
  return (
    <div className={`task-card task-card--priority-${task.priority} task-card--overlay`}>
      <CardContent task={task} />
    </div>
  );
}

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card task-card--priority-${task.priority}${isDragging ? ' task-card--dragging' : ''}`}
      onClick={() => !isDragging && onClick(task)}
      {...listeners}
      {...attributes}
    >
      <CardContent task={task} />
    </div>
  );
}
