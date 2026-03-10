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
  return <span className={`priority-dot priority-dot--${priority}`} />;
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
    <div className="modal-backdrop" onClick={handleBackdropClick} role="dialog" aria-modal>
      <div className="modal">
        {/* ── Header ── */}
        <div className="modal__header">
          {mode === 'view' && task ? (
            <>
              <div className="modal__header-left">
                <PriorityDot priority={task.priority} />
                <h2 className="modal__title">{task.title}</h2>
              </div>
              <div className="modal__header-actions">
                <button className="btn btn--ghost btn--sm" onClick={() => setMode('edit')}>
                  Edit
                </button>
                <button
                  className="btn btn--danger btn--sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? '…' : 'Delete'}
                </button>
                <button className="btn-icon" onClick={onClose} aria-label="Close">
                  ✕
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="modal__title">{isCreating ? 'New Task' : 'Edit Task'}</h2>
              <button className="btn-icon" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </>
          )}
        </div>

        {error && <div className="alert alert--error modal__alert">{error}</div>}

        {/* ── View mode ── */}
        {mode === 'view' && task && (
          <div className="modal__body modal__body--view">
            <div className="modal__meta-grid">
              <div className="meta-item">
                <span className="meta-label">Status</span>
                <span className={`status-badge status-badge--${task.status}`}>
                  {STATUS_OPTIONS.find((s) => s.value === task.status)?.label}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Priority</span>
                <span className={`priority-badge priority-badge--${task.priority}`}>
                  <PriorityDot priority={task.priority} />
                  {PRIORITY_OPTIONS.find((p) => p.value === task.priority)?.label}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Due Date</span>
                <span className="meta-value">{formatDate(task.due_date)}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Assignee</span>
                <span className="meta-value">
                  {task.assignee ? task.assignee.full_name : 'Unassigned'}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Created by</span>
                <span className="meta-value">
                  {task.creator ? task.creator.full_name : '—'}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Created</span>
                <span className="meta-value">{formatDate(task.created_at)}</span>
              </div>
            </div>

            {task.description && (
              <div className="modal__description">
                <h4 className="modal__section-title">Description</h4>
                <p className="modal__desc-text">{task.description}</p>
              </div>
            )}

            <div className="modal__divider" />

            <CommentSection
              taskId={task.id}
              currentUser={currentUser}
              onCountChange={setCommentCount}
            />
          </div>
        )}

        {/* ── Create / Edit form ── */}
        {(mode === 'create' || mode === 'edit') && (
          <form onSubmit={handleSave} className="modal__body modal__body--form">
            <div className="form-group">
              <label className="field-label" htmlFor="task-title">
                Title *
              </label>
              <input
                id="task-title"
                type="text"
                className="input"
                placeholder="Task title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={1}
                maxLength={200}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="field-label" htmlFor="task-desc">
                Description
              </label>
              <textarea
                id="task-desc"
                className="textarea"
                placeholder="Add a description…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={5000}
              />
              <span className="field-hint">{description.length}/5000</span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="field-label" htmlFor="task-status">
                  Status
                </label>
                <select
                  id="task-status"
                  className="select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="field-label" htmlFor="task-priority">
                  Priority
                </label>
                <select
                  id="task-priority"
                  className="select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="field-label" htmlFor="task-due">
                  Due Date
                </label>
                <input
                  id="task-due"
                  type="date"
                  className="input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
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

            <div className="modal__form-footer">
              {mode === 'edit' && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setMode('view')}
                >
                  Cancel
                </button>
              )}
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving…' : isCreating ? 'Create Task' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* comment count chip (view mode, bottom) */}
        {mode === 'view' && task && (
          <div className="modal__comment-count">
            💬 {commentCount} comment{commentCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
