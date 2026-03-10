import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ApiError } from '../api';
import type { CommentResponse, UserResponse } from '../types';

interface CommentSectionProps {
  taskId: string;
  currentUser: UserResponse | null;
  onCountChange?: (count: number) => void;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const PAGE_SIZE = 20;

export default function CommentSection({ taskId, currentUser, onCountChange }: CommentSectionProps) {
  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const fetchingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError('');
    pageRef.current = 1;
    try {
      const res = await api.getComments(taskId, { page_size: PAGE_SIZE, page: 1 });
      setComments(res.items);
      setHasMore(res.has_next);
      onCountChange?.(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [taskId, onCountChange]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const loadMore = useCallback(async () => {
    if (fetchingMoreRef.current) return;
    fetchingMoreRef.current = true;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    try {
      const res = await api.getComments(taskId, { page_size: PAGE_SIZE, page: nextPage });
      setComments((prev) => [...prev, ...res.items]);
      pageRef.current = nextPage;
      setHasMore(res.has_next);
      onCountChange?.(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load more comments');
    } finally {
      fetchingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [taskId, onCountChange]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    setSubmitting(true);
    try {
      const comment = await api.createComment(taskId, {
        content: newContent.trim(),
        user_id: currentUser?.id ?? null,
      });
      setComments((prev) => [...prev, comment]);
      setNewContent('');
      onCountChange?.(comments.length + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSave = async (commentId: string) => {
    if (!editContent.trim()) return;
    try {
      const updated = await api.updateComment(taskId, commentId, editContent.trim());
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update comment');
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await api.deleteComment(taskId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCountChange?.(comments.length - 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete comment');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Section heading */}
      <div className="flex items-center gap-2">
        <h4 className="text-[11px] font-medium text-text-3 uppercase tracking-widest">Comments</h4>
        {comments.length > 0 && (
          <span className="text-[10px] font-medium text-text-3 tabular-nums">
            {comments.length}
          </span>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-(--color-danger-light) border border-(--color-border) text-[12px] text-(--color-danger)">
          {error}
        </div>
      )}

      {loading ? (
        <div className="w-4 h-4 rounded-full border-[1.5px] border-(--color-border) border-t-(--color-accent) animate-spin-fast mx-auto my-3" />
      ) : comments.length === 0 ? (
        <p className="text-[12px] text-text-3 py-1">No comments yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              {/* Avatar */}
              <div className="shrink-0 mt-0.5">
                {c.author?.avatar_url ? (
                  <img
                    src={c.author.avatar_url}
                    alt={c.author.full_name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-full inline-flex items-center justify-center bg-(--color-surface-3) text-text-2 text-[9px] font-semibold">
                    {c.author ? getInitials(c.author.full_name) : '?'}
                  </span>
                )}
              </div>
              {/* Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-medium text-(--color-text-1)">
                    {c.author?.full_name ?? 'Deleted user'}
                  </span>
                  <span className="text-[11px] text-text-3">{formatTime(c.created_at)}</span>
                  {currentUser && c.user_id === currentUser.id && (
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        className="bg-transparent border-none cursor-pointer text-[11px] text-text-3 hover:text-(--color-text-1) transition-colors p-0"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditContent(c.content);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="bg-transparent border-none cursor-pointer text-[11px] text-text-3 hover:text-(--color-danger) transition-colors p-0"
                        onClick={() => handleDelete(c.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                {editingId === c.id ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      className="field-input resize-y"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      maxLength={2000}
                    />
                    <div className="flex gap-2">
                      <button
                        className="h-7 px-3 inline-flex items-center justify-center rounded-lg bg-(--color-text-1) text-white text-[11px] font-medium hover:bg-primary-hover transition-colors cursor-pointer"
                        onClick={() => handleEditSave(c.id)}
                      >
                        Save
                      </button>
                      <button
                        className="h-7 px-3 inline-flex items-center justify-center rounded-lg border border-(--color-border) text-text-2 text-[11px] font-medium hover:bg-(--color-surface-2) transition-colors cursor-pointer bg-transparent"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-text-2 whitespace-pre-wrap wrap-break-word leading-relaxed">{c.content}</p>
                )}
              </div>
            </div>
          ))}
          {loadingMore && (
            <div className="flex justify-center py-1">
              <div className="w-4 h-4 rounded-full border-[1.5px] border-(--color-border) border-t-(--color-accent) animate-spin-fast" />
            </div>
          )}
          {hasMore && <div ref={sentinelRef} className="h-px" />}
        </div>
      )}

      {/* New comment */}
      <form onSubmit={handleSubmit} className="flex gap-2.5 pt-1 border-t border-(--color-border)">
        <div className="shrink-0 mt-2">
          {currentUser?.avatar_url ? (
            <img src={currentUser.avatar_url} alt={currentUser.full_name} className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <span className="w-6 h-6 rounded-full inline-flex items-center justify-center bg-(--color-surface-3) text-text-2 text-[9px] font-semibold">
              {currentUser ? getInitials(currentUser.full_name) : '?'}
            </span>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-1.5 pt-1">
          <textarea
            className="field-input resize-y disabled:opacity-50"
            placeholder={currentUser ? 'Add a commentâ€¦' : 'Select a user to comment'}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={2}
            maxLength={2000}
            disabled={!currentUser}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-3 tabular-nums">{newContent.length}/2000</span>
            <button
              type="submit"
              className="h-7 px-3 inline-flex items-center justify-center rounded-lg bg-(--color-text-1) text-white text-[11px] font-medium hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={submitting || !newContent.trim() || !currentUser}
            >
              {submitting ? 'Postingâ€¦' : 'Comment'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

