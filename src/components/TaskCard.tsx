import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { TaskResponse, TaskPriority } from '../types';

interface TaskCardProps {
  task: TaskResponse;
  onClick: (task: TaskResponse) => void;
  isDragOverlay?: boolean;
}

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low:    'bg-[var(--color-prio-low-bg)] text-[var(--color-prio-low-text)]',
  medium: 'bg-[var(--color-prio-med-bg)] text-[var(--color-prio-med-text)]',
  high:   'bg-[var(--color-prio-high-bg)] text-[var(--color-prio-high-text)]',
};

const PRIORITY_BORDER: Record<TaskPriority, string> = {
  low:    'border-l-[var(--color-prio-low)]',
  medium: 'border-l-[var(--color-prio-med)]',
  high:   'border-l-[var(--color-prio-high)]',
};

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
      <div className="flex items-center justify-between gap-1.5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${PRIORITY_BADGE[task.priority]}`}>
          {PRIORITY_LABEL[task.priority]}
        </span>
        {task.due_date && dueInfo && (
          <span className={`text-[11px] whitespace-nowrap ${dueInfo.overdue ? 'text-[var(--color-danger)] font-semibold' : 'text-[var(--color-text-2)]'}`}>
            📅 {dueInfo.text}
          </span>
        )}
      </div>

      <h3 className="text-[13px] font-semibold text-[var(--color-text-1)] leading-snug line-clamp-2">{task.title}</h3>

      {task.description && (
        <p className="text-xs text-[var(--color-text-2)] leading-relaxed line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between gap-2 mt-0.5">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {task.assignee ? (
            <>
              {task.assignee.avatar_url ? (
                <img
                  src={task.assignee.avatar_url}
                  alt={task.assignee.full_name}
                  className="w-[22px] h-[22px] rounded-full object-cover shrink-0"
                />
              ) : (
                <span className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center bg-[var(--color-primary-light)] text-[var(--color-primary)] text-[9px] font-bold shrink-0">
                  {getInitials(task.assignee.full_name)}
                </span>
              )}
              <span className="text-[11px] text-[var(--color-text-2)] whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">{task.assignee.full_name}</span>
            </>
          ) : (
            <span className="text-[11px] text-[var(--color-text-3)] italic">Unassigned</span>
          )}
        </div>
        {task.comment_count > 0 && (
          <span className="text-[11px] text-[var(--color-text-3)] whitespace-nowrap shrink-0">
            💬 {task.comment_count}
          </span>
        )}
      </div>
    </>
  );
}

export function TaskCardOverlay({ task }: { task: TaskResponse }) {
  return (
    <div className={`bg-white rounded-lg p-3 border-[1.5px] border-l-[3px] border-[var(--color-border)] ${PRIORITY_BORDER[task.priority]} shadow-xl cursor-grabbing flex flex-col gap-2 rotate-2 opacity-100`}>
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
      className={`bg-white rounded-lg p-3 border-[1.5px] border-l-[3px] border-[var(--color-border)] ${PRIORITY_BORDER[task.priority]} shadow-xs cursor-grab active:cursor-grabbing flex flex-col gap-2 select-none transition-shadow hover:shadow-md hover:-translate-y-px${isDragging ? ' opacity-40 shadow-none' : ''}`}
      onClick={() => !isDragging && onClick(task)}
      {...listeners}
      {...attributes}
    >
      <CardContent task={task} />
    </div>
  );
}
