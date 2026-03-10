import type { TaskStatus, TaskPriority } from '@/types';

const STATUS_STYLES: Record<TaskStatus, string> = {
  todo:        'bg-status-todo-bg text-status-todo',
  in_progress: 'bg-status-progress-bg text-status-progress',
  done:        'bg-status-done-bg text-status-done',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  done:        'Done',
};

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low:    'bg-(--color-prio-low)',
  medium: 'bg-prio-med',
  high:   'bg-(--color-prio-high)',
};

const PRIORITY_TEXT: Record<TaskPriority, string> = {
  low:    'text-prio-low-text',
  medium: 'text-prio-med-text',
  high:   'text-(--color-prio-high-text)',
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${PRIORITY_TEXT[priority]}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[priority]}`} />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function PriorityDot({ priority, className = '' }: { priority: TaskPriority; className?: string }) {
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[priority]} ${className}`} />;
}
