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

  // Sync form state when switching from view â†’ edit
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

  // Shared icon button style
  const iconBtn = "w-7 h-7 inline-flex items-center justify-center rounded-lg text-text-3 bg-transparent border-none cursor-pointer hover:bg-(--color-surface-2) hover:text-(--color-text-1) transition-colors";

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-1000 p-4 animate-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal
    >
      <div className="bg-white rounded-2xl shadow-xl shadow-black/10 w-full max-w-155 max-h-[calc(100vh-32px)] flex flex-col animate-modal overflow-hidden border border-(--color-border)">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-(--color-border) gap-3 shrink-0">
          {mode === 'view' && task ? (
            <>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  task.priority === 'high' ? 'bg-(--color-prio-high)' :
                  task.priority === 'medium' ? 'bg-prio-med' : 'bg-(--color-prio-low)'
                }`} />
                <h2 className="text-[15px] font-semibold text-(--color-text-1) truncate">{task.title}</h2>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  className="h-7 px-3 inline-flex items-center justify-center rounded-lg border border-(--color-border) bg-transparent text-text-2 text-[12px] font-medium cursor-pointer hover:bg-(--color-surface-2) transition-colors"
                  onClick={() => setMode('edit')}
                >
                  Edit
                </button>
                <button
                  className="h-7 px-3 inline-flex items-center justify-center rounded-lg border border-(--color-border) bg-transparent text-(--color-danger) text-[12px] font-medium cursor-pointer hover:bg-(--color-danger-light) transition-colors disabled:opacity-50"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? '…' : 'Delete'}
                </button>
                <button className={iconBtn} onClick={onClose} aria-label="Close">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-[15px] font-semibold text-(--color-text-1)">{isCreating ? 'New task' : 'Edit task'}</h2>
              <button className={iconBtn} onClick={onClose} aria-label="Close">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg text-[12px] border border-(--color-border) bg-(--color-danger-light) text-(--color-danger)">
            {error}
          </div>
        )}

        {/* ── View mode ── */}
        {mode === 'view' && task && (
          <div className="flex-1 overflow-y-auto">
            {/* Meta strip */}
            <div className="px-5 py-4 grid grid-cols-3 gap-y-4 gap-x-6 border-b border-(--color-border)">
              <div>
                <p className="text-[10px] font-medium text-text-3 uppercase tracking-widest mb-1">Status</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                  task.status === 'todo'        ? 'bg-status-todo-bg text-status-todo' :
                  task.status === 'in_progress' ? 'bg-status-progress-bg text-status-progress' :
                                                  'bg-status-done-bg text-status-done'
                }`}>
                  {STATUS_OPTIONS.find((s) => s.value === task.status)?.label}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-medium text-text-3 uppercase tracking-widest mb-1">Priority</p>
                <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${
                  task.priority === 'high' ? 'text-(--color-prio-high-text)' :
                  task.priority === 'medium' ? 'text-prio-med-text' : 'text-prio-low-text'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    task.priority === 'high' ? 'bg-(--color-prio-high)' :
                    task.priority === 'medium' ? 'bg-prio-med' : 'bg-(--color-prio-low)'
                  }`} />
                  {PRIORITY_OPTIONS.find((p) => p.value === task.priority)?.label}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-medium text-text-3 uppercase tracking-widest mb-1">Due date</p>
                <span className="text-[12px] text-(--color-text-1)">{formatDate(task.due_date)}</span>
              </div>
              <div>
                <p className="text-[10px] font-medium text-text-3 uppercase tracking-widest mb-1">Assignee</p>
                <span className="text-[12px] text-(--color-text-1)">{task.assignee ? task.assignee.full_name : '—'}</span>
              </div>
              <div>
                <p className="text-[10px] font-medium text-text-3 uppercase tracking-widest mb-1">Created by</p>
                <span className="text-[12px] text-(--color-text-1)">{task.creator ? task.creator.full_name : '—'}</span>
              </div>
              <div>
                <p className="text-[10px] font-medium text-text-3 uppercase tracking-widest mb-1">Created</p>
                <span className="text-[12px] text-(--color-text-1)">{formatDate(task.created_at)}</span>
              </div>
            </div>

            {/* Description */}
            {task.description && (
              <div className="px-5 py-4 border-b border-(--color-border)">
                <p className="text-[10px] font-medium text-text-3 uppercase tracking-widest mb-2">Description</p>
                <p className="text-[13px] text-text-2 leading-relaxed whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {/* Comments */}
            <div className="px-5 py-4">
              <CommentSection
                taskId={task.id}
                currentUser={currentUser}
                onCountChange={setCommentCount}
              />
            </div>
          </div>
        )}

        {/* ── Create / Edit form ── */}
        {(mode === 'create' || mode === 'edit') && (
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            {/* Title */}
            <div>
              <label className="block text-[11px] font-medium text-text-3 mb-1.5" htmlFor="task-title">Title *</label>
              <input
                id="task-title"
                type="text"
                className="field-input"
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
            <div>
              <label className="block text-[11px] font-medium text-text-3 mb-1.5" htmlFor="task-desc">Description</label>
              <textarea
                id="task-desc"
                className="field-input resize-y"
                placeholder="Add a description…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={5000}
              />
              <span className="block text-[10px] text-text-3 text-right mt-1 tabular-nums">{description.length}/5000</span>
            </div>

            {/* Status / Priority / Due */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-text-3 mb-1.5" htmlFor="task-status">Status</label>
                <select
                  id="task-status"
                  className="select-arrow field-input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-text-3 mb-1.5" htmlFor="task-priority">Priority</label>
                <select
                  id="task-priority"
                  className="select-arrow field-input"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-text-3 mb-1.5" htmlFor="task-due">Due date</label>
                <input
                  id="task-due"
                  type="date"
                  className="field-input"
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

            {/* Form footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-(--color-border) mt-auto">
              {mode === 'edit' && (
                <button
                  type="button"
                  className="h-8 px-4 inline-flex items-center justify-center rounded-lg border border-(--color-border) bg-transparent text-text-2 text-[12px] font-medium cursor-pointer hover:bg-(--color-surface-2) transition-colors"
                  onClick={() => setMode('view')}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="h-8 px-4 inline-flex items-center justify-center rounded-lg bg-(--color-text-1) text-white text-[12px] font-medium cursor-pointer hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={saving}
              >
                {saving ? 'Saving…' : isCreating ? 'Create task' : 'Save changes'}
              </button>
            </div>
          </form>
        )}

        {/* Comment count footer (view mode only) */}
        {mode === 'view' && task && (
          <div className="px-5 py-2.5 border-t border-(--color-border) text-[11px] text-text-3 shrink-0 flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M2 2h12v9H9l-3 3v-3H2V2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
            {commentCount} comment{commentCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

