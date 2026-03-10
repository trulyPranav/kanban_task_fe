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
    <div className="comment-section">
      <h4 className="comment-section__title">
        Comments{comments.length > 0 && <span className="badge">{comments.length}</span>}
      </h4>

      {error && <div className="alert alert--error">{error}</div>}

      {loading ? (
        <div className="spinner-sm" />
      ) : comments.length === 0 ? (
        <p className="comment-section__empty">No comments yet. Be the first!</p>
      ) : (
        <div className="comment-list">
          {comments.map((c) => (
            <div key={c.id} className="comment">
              <div className="comment__avatar">
                {c.author?.avatar_url ? (
                  <img src={c.author.avatar_url} alt={c.author.full_name} className="avatar" />
                ) : (
                  <span className="avatar avatar--initials">
                    {c.author ? getInitials(c.author.full_name) : '?'}
                  </span>
                )}
              </div>
              <div className="comment__body">
                <div className="comment__header">
                  <span className="comment__author">
                    {c.author?.full_name ?? 'Deleted user'}
                  </span>
                  <span className="comment__time">{formatTime(c.created_at)}</span>
                  {currentUser && c.user_id === currentUser.id && (
                    <div className="comment__actions">
                      <button
                        className="btn-text btn-text--sm"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditContent(c.content);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-text btn-text--sm btn-text--danger"
                        onClick={() => handleDelete(c.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                {editingId === c.id ? (
                  <div className="comment__edit">
                    <textarea
                      className="textarea"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      maxLength={2000}
                    />
                    <div className="comment__edit-actions">
                      <button
                        className="btn btn--primary btn--sm"
                        onClick={() => handleEditSave(c.id)}
                      >
                        Save
                      </button>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="comment__content">{c.content}</p>
                )}
              </div>
            </div>
          ))}
          {loadingMore && <div className="comment-list__load-more"><div className="spinner-sm" /></div>}
          {hasMore && <div ref={sentinelRef} className="comment-list__sentinel" />}
        </div>
      )}

      <form onSubmit={handleSubmit} className="comment-form">
        <div className="comment-form__avatar">
          {currentUser?.avatar_url ? (
            <img src={currentUser.avatar_url} alt={currentUser.full_name} className="avatar" />
          ) : (
            <span className="avatar avatar--initials">
              {currentUser ? getInitials(currentUser.full_name) : '?'}
            </span>
          )}
        </div>
        <div className="comment-form__input-wrap">
          <textarea
            className="textarea"
            placeholder={currentUser ? 'Write a comment…' : 'Select a user to comment'}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={2}
            maxLength={2000}
            disabled={!currentUser}
          />
          <div className="comment-form__footer">
            <span className="comment-form__hint">{newContent.length}/2000</span>
            <button
              type="submit"
              className="btn btn--primary btn--sm"
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
