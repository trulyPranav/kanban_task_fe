import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api';
import type {
  TaskResponse,
  TaskStatus,
  TaskPriority,
  CreateTaskPayload,
  UpdateTaskPayload,
  UserResponse,
} from '../types';
import UserSelector from './UserSelector';
import CommentSection from './CommentSection';

interface TaskModalProps {
  /** null = create mode */
  task: TaskResponse | null;
  initialStatus?: TaskStatus;
  currentUser: UserResponse | null;
  onClose: () => void;
  onSaved: (task: TaskResponse) => void;
  onDeleted?: (taskId: string) => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

function PriorityDot({ priority }: { priority: TaskPriority }) {
  const colors: Record<TaskPriority, string> = {
    low:    'bg-[var(--color-prio-low)]',
    medium: 'bg-[var(--color-prio-med)]',
    high:   'bg-[var(--color-prio-high)]',
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[priority]}`} />;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default function TaskModal({
  task,
  initialStatus = 'todo',
  currentUser,
  onClose,
  onSaved,
  onDeleted,
}: TaskModalProps) {
  const isCreating = task === null;
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>(isCreating ? 'create' : 'view');

  // form state
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? initialStatus);
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(toDateInputValue(task?.due_date ?? null));
  const [assignedToId, setAssignedToId] = useState<string | null>(task?.assigned_to_id ?? null);
  const [createdById, setCreatedById] = useState<string | null>(
    task?.created_by_id ?? currentUser?.id ?? null,
  );

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [commentCount, setCommentCount] = useState(task?.comment_count ?? 0);

  // Refresh task data when viewing
  const refreshTask = useCallback(async () => {
    if (!task) return;
    try {
      const fresh = await api.getTask(task.id);
      setCommentCount(fresh.comment_count);
    } catch {
      // non-critical
    }
  }, [task]);

  useEffect(() => {
    if (mode === 'view') refreshTask();
  }, [mode, refreshTask]);

  // Sync form state when switching from view → edit
  useEffect(() => {
    if (mode === 'edit' && task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(toDateInputValue(task.due_date));
      setAssignedToId(task.assigned_to_id);
      setCreatedById(task.created_by_id);
    }
  }, [mode, task]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload: CreateTaskPayload | UpdateTaskPayload = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        assigned_to_id: assignedToId,
        ...(isCreating ? { created_by_id: createdById } : {}),
      };

      const saved = isCreating
        ? await api.createTask(payload as CreateTaskPayload)
        : await api.updateTask(task!.id, payload as UpdateTaskPayload);

      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task || !confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteTask(task.id);
      onDeleted?.(task.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete task');
    } finally {
      setDeleting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-5 animate-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[calc(100vh-40px)] flex flex-col animate-modal overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] gap-3 shrink-0">
          {mode === 'view' && task ? (
            <>
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <PriorityDot priority={task.priority} />
                <h2 className="text-base font-bold text-[var(--color-text-1)] whitespace-nowrap overflow-hidden text-ellipsis">{task.title}</h2>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border-[1.5px] border-[var(--color-border)] bg-transparent text-[var(--color-text-2)] text-xs font-semibold cursor-pointer hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-1)] transition-all disabled:opacity-55"
                  onClick={() => setMode('edit')}
                >
                  Edit
                </button>
                <button
                  className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border-[1.5px] border-red-300 bg-transparent text-[var(--color-danger)] text-xs font-semibold cursor-pointer hover:bg-[var(--color-danger-light)] transition-all disabled:opacity-55"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? '…' : 'Delete'}
                </button>
                <button
                  className="w-7 h-7 inline-flex items-center justify-center rounded text-[var(--color-text-2)] bg-transparent border-none cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors"
                  onClick={onClose}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-base font-bold text-[var(--color-text-1)]">{isCreating ? 'New Task' : 'Edit Task'}</h2>
              <button
                className="w-7 h-7 inline-flex items-center justify-center rounded text-[var(--color-text-2)] bg-transparent border-none cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors"
                onClick={onClose}
                aria-label="Close"
              >
                ✕
              </button>
            </>
          )}
        </div>

        {error && (
          <div className="mx-5 mt-3 px-3.5 py-2.5 rounded-lg text-[13px] border border-red-300 bg-[var(--color-danger-light)] text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {/* ── View mode ── */}
        {mode === 'view' && task && (
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-0">
            {/* Meta grid */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-5">
              {/* Status */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[var(--color-text-3)] uppercase tracking-widest">Status</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold self-start ${
                  task.status === 'todo'        ? 'bg-[var(--color-status-todo-bg)] text-[var(--color-status-todo)]' :
                  task.status === 'in_progress' ? 'bg-[var(--color-status-progress-bg)] text-[var(--color-status-progress)]' :
                                                  'bg-[var(--color-status-done-bg)] text-[var(--color-status-done)]'
                }`}>
                  {STATUS_OPTIONS.find((s) => s.value === task.status)?.label}
                </span>
              </div>
              {/* Priority */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[var(--color-text-3)] uppercase tracking-widest">Priority</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold self-start ${
                  task.priority === 'low'    ? 'bg-[var(--color-prio-low-bg)] text-[var(--color-prio-low-text)]' :
                  task.priority === 'medium' ? 'bg-[var(--color-prio-med-bg)] text-[var(--color-prio-med-text)]' :
                                               'bg-[var(--color-prio-high-bg)] text-[var(--color-prio-high-text)]'
                }`}>
                  <PriorityDot priority={task.priority} />
                  {PRIORITY_OPTIONS.find((p) => p.value === task.priority)?.label}
                </span>
              </div>
              {/* Due Date */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[var(--color-text-3)] uppercase tracking-widest">Due Date</span>
                <span className="text-[13px] text-[var(--color-text-1)]">{formatDate(task.due_date)}</span>
              </div>
              {/* Assignee */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[var(--color-text-3)] uppercase tracking-widest">Assignee</span>
                <span className="text-[13px] text-[var(--color-text-1)]">{task.assignee ? task.assignee.full_name : 'Unassigned'}</span>
              </div>
              {/* Created by */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[var(--color-text-3)] uppercase tracking-widest">Created by</span>
                <span className="text-[13px] text-[var(--color-text-1)]">{task.creator ? task.creator.full_name : '—'}</span>
              </div>
              {/* Created */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[var(--color-text-3)] uppercase tracking-widest">Created</span>
                <span className="text-[13px] text-[var(--color-text-1)]">{formatDate(task.created_at)}</span>
              </div>
            </div>

            {task.description && (
              <div className="mb-5">
                <h4 className="text-xs font-bold text-[var(--color-text-2)] uppercase tracking-widest mb-2">Description</h4>
                <p className="text-sm text-[var(--color-text-1)] leading-relaxed whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            <div className="h-px bg-[var(--color-border)] my-1 mb-5" />

            <CommentSection
              taskId={task.id}
              currentUser={currentUser}
              onCountChange={setCommentCount}
            />
          </div>
        )}

        {/* ── Create / Edit form ── */}
        {(mode === 'create' || mode === 'edit') && (
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 flex flex-col gap-3.5">
            {/* Title */}
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-semibold text-[var(--color-text-2)] mb-1" htmlFor="task-title">Title *</label>
              <input
                id="task-title"
                type="text"
                className="w-full px-3 py-2 border-[1.5px] border-[var(--color-border)] focus:border-[var(--color-border-focus)] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] rounded-lg text-sm text-[var(--color-text-1)] bg-white outline-none transition-all placeholder:text-[var(--color-text-3)]"
                placeholder="Task title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={1}
                maxLength={200}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-semibold text-[var(--color-text-2)] mb-1" htmlFor="task-desc">Description</label>
              <textarea
                id="task-desc"
                className="w-full px-3 py-2 border-[1.5px] border-[var(--color-border)] focus:border-[var(--color-border-focus)] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] rounded-lg text-sm text-[var(--color-text-1)] bg-white outline-none transition-all resize-y placeholder:text-[var(--color-text-3)]"
                placeholder="Add a description…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={5000}
              />
              <span className="text-[11px] text-[var(--color-text-3)] text-right mt-0.5">{description.length}/5000</span>
            </div>

            {/* Status / Priority / Due */}
            <div className="flex gap-3 flex-wrap items-start">
              <div className="flex flex-col gap-1 flex-1">
                <label className="block text-xs font-semibold text-[var(--color-text-2)] mb-1" htmlFor="task-status">Status</label>
                <select
                  id="task-status"
                  className="select-arrow w-full px-3 py-2 border-[1.5px] border-[var(--color-border)] focus:border-[var(--color-border-focus)] rounded-lg text-sm text-[var(--color-text-1)] bg-white outline-none cursor-pointer transition-all"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 flex-1">
                <label className="block text-xs font-semibold text-[var(--color-text-2)] mb-1" htmlFor="task-priority">Priority</label>
                <select
                  id="task-priority"
                  className="select-arrow w-full px-3 py-2 border-[1.5px] border-[var(--color-border)] focus:border-[var(--color-border-focus)] rounded-lg text-sm text-[var(--color-text-1)] bg-white outline-none cursor-pointer transition-all"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 flex-1">
                <label className="block text-xs font-semibold text-[var(--color-text-2)] mb-1" htmlFor="task-due">Due Date</label>
                <input
                  id="task-due"
                  type="date"
                  className="w-full px-3 py-2 border-[1.5px] border-[var(--color-border)] focus:border-[var(--color-border-focus)] rounded-lg text-sm text-[var(--color-text-1)] bg-white outline-none transition-all"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Assignee / Created by */}
            <div className="flex gap-3 flex-wrap items-start">
              <UserSelector
                label="Assignee"
                value={assignedToId}
                onChange={setAssignedToId}
                placeholder="Unassigned"
              />
              {isCreating && (
                <UserSelector
                  label="Created by"
                  value={createdById}
                  onChange={setCreatedById}
                  placeholder="Select creator"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              {mode === 'edit' && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg border-[1.5px] border-[var(--color-border)] bg-transparent text-[var(--color-text-2)] text-[13px] font-semibold cursor-pointer hover:bg-[var(--color-surface-2)] transition-all"
                  onClick={() => setMode('view')}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg border-[1.5px] border-[var(--color-primary)] bg-[var(--color-primary)] text-white text-[13px] font-semibold cursor-pointer hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-55 disabled:cursor-not-allowed"
                disabled={saving}
              >
                {saving ? 'Saving…' : isCreating ? 'Create Task' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* comment count chip */}
        {mode === 'view' && task && (
          <div className="px-5 py-2.5 border-t border-[var(--color-border)] text-xs text-[var(--color-text-3)] shrink-0">
            💬 {commentCount} comment{commentCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
