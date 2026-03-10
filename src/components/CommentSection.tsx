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
      {/* Title */}
      <h4 className="flex items-center text-xs font-bold text-text-2 uppercase tracking-widest">
        Comments
        {comments.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-primary-light text-(--color-primary) ml-1.5">
            {comments.length}
          </span>
        )}
      </h4>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="w-6 h-6 rounded-full border-[2.5px] border-border border-t-(--color-primary) animate-spin-fast mx-auto my-4" />
      ) : comments.length === 0 ? (
        <p className="text-sm text-text-3 py-2">No comments yet. Be the first!</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              {/* Avatar */}
              <div className="shrink-0">
                {c.author?.avatar_url ? (
                  <img
                    src={c.author.avatar_url}
                    alt={c.author.full_name}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full inline-flex items-center justify-center bg-primary-light text-(--color-primary) text-[10px] font-bold">
                    {c.author ? getInitials(c.author.full_name) : '?'}
                  </span>
                )}
              </div>
              {/* Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-xs font-semibold text-text-1">
                    {c.author?.full_name ?? 'Deleted user'}
                  </span>
                  <span className="text-[11px] text-text-3">{formatTime(c.created_at)}</span>
                  {currentUser && c.user_id === currentUser.id && (
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        className="bg-transparent border-none cursor-pointer text-[11px] text-(--color-primary) hover:text-primary-hover p-0"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditContent(c.content);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="bg-transparent border-none cursor-pointer text-[11px] text-red-500 hover:text-red-700 p-0"
                        onClick={() => handleDelete(c.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                {editingId === c.id ? (
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      className="w-full px-3 py-2 border-[1.5px] border-border focus:border-(--color-border-focus) rounded-lg text-sm bg-white outline-none resize-y placeholder:text-text-3"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      maxLength={2000}
                    />
                    <div className="flex gap-1.5">
                      <button
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-(--color-primary) text-white hover:bg-primary-hover transition-colors"
                        onClick={() => handleEditSave(c.id)}
                      >
                        Save
                      </button>
                      <button
                        className="px-3 py-1 rounded-lg text-xs font-semibold border border-border text-text-2 hover:bg-surface-2 transition-colors"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-text-1 whitespace-pre-wrap wrap-break-word">{c.content}</p>
                )}
              </div>
            </div>
          ))}
          {loadingMore && (
            <div className="flex justify-center py-2">
              <div className="w-5 h-5 rounded-full border-[2.5px] border-border border-t-(--color-primary) animate-spin-fast" />
            </div>
          )}
          {hasMore && <div ref={sentinelRef} className="h-px" />}
        </div>
      )}

      {/* New comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2.5 pt-1">
        <div className="shrink-0">
          {currentUser?.avatar_url ? (
            <img src={currentUser.avatar_url} alt={currentUser.full_name} className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <span className="w-7 h-7 rounded-full inline-flex items-center justify-center bg-primary-light text-(--color-primary) text-[10px] font-bold">
              {currentUser ? getInitials(currentUser.full_name) : '?'}
            </span>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <textarea
            className="w-full px-3 py-2 border-[1.5px] border-border focus:border-(--color-border-focus) rounded-lg text-sm bg-white outline-none resize-y placeholder:text-text-3 disabled:opacity-60"
            placeholder={currentUser ? 'Write a comment…' : 'Select a user to comment'}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={2}
            maxLength={2000}
            disabled={!currentUser}
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-3">{newContent.length}/2000</span>
            <button
              type="submit"
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-(--color-primary) text-white hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting || !newContent.trim() || !currentUser}
            >
              {submitting ? 'Posting…' : 'Comment'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
