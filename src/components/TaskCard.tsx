import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { formatDueDate } from '@/lib/utils';
import Avatar from '@/components/ui/Avatar';
import type { TaskResponse, TaskPriority } from '@/types';

interface TaskCardProps {
  task: TaskResponse;
  onClick: (task: TaskResponse) => void;
  isDragOverlay?: boolean;
}

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low:    'bg-(--color-prio-low)',
  medium: 'bg-prio-med',
  high:   'bg-(--color-prio-high)',
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
};

const PRIORITY_TEXT: Record<TaskPriority, string> = {
  low:    'text-prio-low-text',
  medium: 'text-prio-med-text',
  high:   'text-(--color-prio-high-text)',
};

function CardContent({ task }: { task: TaskResponse }) {
  const dueInfo = formatDueDate(task.due_date);
  return (
    <>
      {/* Priority + Due row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
          <span className={`text-[11px] font-medium ${PRIORITY_TEXT[task.priority]}`}>
            {PRIORITY_LABEL[task.priority]}
          </span>
        </div>
        {task.due_date && dueInfo && (
          <span className={`text-[11px] tabular-nums ${dueInfo.overdue ? 'text-(--color-danger) font-medium' : 'text-text-3'}`}>
            {dueInfo.text}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-[13px] font-medium text-(--color-text-1) leading-snug line-clamp-2 mt-1.5">{task.title}</h3>

      {/* Description */}
      {task.description && (
        <p className="text-[12px] text-text-3 leading-relaxed line-clamp-2 mt-0.5">{task.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {task.assignee ? (
            <>
              <Avatar size="xs" name={task.assignee.full_name} avatarUrl={task.assignee.avatar_url} />
              <span className="text-[11px] text-text-3 whitespace-nowrap overflow-hidden text-ellipsis max-w-22.5">{task.assignee.full_name}</span>
            </>
          ) : (
            <span className="text-[11px] text-text-3">Unassigned</span>
          )}
        </div>
        {task.comment_count > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-text-3 shrink-0">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M2 2h12v9H9l-3 3v-3H2V2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
            {task.comment_count}
          </span>
        )}
      </div>
    </>
  );
}

export function TaskCardOverlay({ task }: { task: TaskResponse }) {
  return (
    <div className="bg-white rounded-xl p-3.5 border border-(--color-border) shadow-xl cursor-grabbing flex flex-col rotate-1 opacity-95">
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
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl p-3.5 border border-(--color-border) cursor-grab active:cursor-grabbing flex flex-col select-none transition-shadow hover:shadow-sm hover:border-(--color-surface-3)${isDragging ? ' shadow-none' : ''}`}
      onClick={() => !isDragging && onClick(task)}
      {...listeners}
      {...attributes}
    >
      <CardContent task={task} />
    </div>
  );
}

