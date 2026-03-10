import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import type { UserResponse, CreateUserPayload } from '../types';

interface UserSelectorProps {
  value: string | null;
  onChange: (userId: string | null) => void;
  placeholder?: string;
  label?: string;
}

const PAGE_SIZE = 20;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function AvatarSmall({ user }: { user: UserResponse | null }) {
  if (!user) return <span className="avatar avatar--empty">—</span>;
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={user.full_name} className="avatar" />;
  }
  return (
    <span className="avatar avatar--initials" title={user.full_name}>
      {getInitials(user.full_name)}
    </span>
  );
}

export default function UserSelector({ value, onChange, placeholder = 'Unassigned', label }: UserSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserPayload>({
    username: '',
    email: '',
    full_name: '',
    avatar_url: '',
  });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const userListRef = useRef<HTMLDivElement>(null);
  const userSentinelRef = useRef<HTMLDivElement>(null);
  const userPageRef = useRef(0);
  const userFetchingMoreRef = useRef(false);
  const selectedUser = users.find((u) => u.id === value) ?? null;

  const fetchUsers = useCallback(async (q: string, pg = 1) => {
    if (pg > 1 && userFetchingMoreRef.current) return;
    if (pg === 1) {
      setLoading(true);
      userPageRef.current = 0; // reset while loading
    } else {
      userFetchingMoreRef.current = true;
      setLoadingMoreUsers(true);
    }
    try {
      const res = await api.getUsers({ search: q || undefined, page_size: PAGE_SIZE, page: pg });
      setUsers((prev) => (pg === 1 ? res.items : [...prev, ...res.items]));
      userPageRef.current = pg;
      setHasMoreUsers(res.has_next);
    } catch {
      // silently ignore
    } finally {
      if (pg === 1) setLoading(false);
      else {
        userFetchingMoreRef.current = false;
        setLoadingMoreUsers(false);
      }
    }
  }, []);

  useEffect(() => {
    if (open) fetchUsers(search);
  }, [open, search, fetchUsers]);

  useEffect(() => {
    const el = userSentinelRef.current;
    const list = userListRef.current;
    if (!el || !list || !hasMoreUsers) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && userPageRef.current > 0) {
          fetchUsers(search, userPageRef.current + 1);
        }
      },
      { root: list, threshold: 0, rootMargin: '40px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreUsers, search, fetchUsers]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (userId: string | null) => {
    onChange(userId);
    setOpen(false);
    setShowCreate(false);
    setSearch('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const payload: CreateUserPayload = {
        username: createForm.username,
        email: createForm.email,
        full_name: createForm.full_name,
        avatar_url: createForm.avatar_url || null,
      };
      const newUser = await api.createUser(payload);
      setUsers((prev) => [newUser, ...prev]);
      handleSelect(newUser.id);
      setCreateForm({ username: '', email: '', full_name: '', avatar_url: '' });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="user-selector" ref={containerRef}>
      {label && <label className="field-label">{label}</label>}
      <button
        type="button"
        className="user-selector__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <AvatarSmall user={selectedUser} />
        <span className="user-selector__name">
          {selectedUser ? selectedUser.full_name : placeholder}
        </span>
        <svg className="user-selector__chevron" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="user-selector__dropdown" role="listbox">
          {!showCreate ? (
            <>
              <div className="user-selector__search">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search users…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="user-selector__search-input"
                />
              </div>

              <div className="user-selector__list" ref={userListRef}>
                <button
                  type="button"
                  className="user-selector__option user-selector__option--clear"
                  onClick={() => handleSelect(null)}
                >
                  <span className="avatar avatar--empty">—</span>
                  <span>None</span>
                </button>

                {loading ? (
                  <div className="user-selector__loading">Loading…</div>
                ) : (
                  users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className={`user-selector__option${value === u.id ? ' user-selector__option--selected' : ''}`}
                      onClick={() => handleSelect(u.id)}
                    >
                      <AvatarSmall user={u} />
                      <span className="user-selector__option-name">{u.full_name}</span>
                      <span className="user-selector__option-username">@{u.username}</span>
                    </button>
                  ))
                )}

                {!loading && users.length === 0 && (
                  <div className="user-selector__empty">No users found</div>
                )}
                {loadingMoreUsers && (
                  <div className="user-selector__loading">Loading…</div>
                )}
                {hasMoreUsers && <div ref={userSentinelRef} className="user-selector__sentinel" />}
              </div>

              <div className="user-selector__footer">
                <button
                  type="button"
                  className="user-selector__create-btn"
                  onClick={() => setShowCreate(true)}
                >
                  + Create new user
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleCreate} className="user-selector__create-form">
              <div className="user-selector__create-header">
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setShowCreate(false)}
                  aria-label="Back"
                >
                  ←
                </button>
                <span>New User</span>
              </div>
              {createError && <div className="form-error">{createError}</div>}
              <input
                required
                type="text"
                placeholder="Full name *"
                value={createForm.full_name}
                onChange={(e) => setCreateForm((f: CreateUserPayload) => ({ ...f, full_name: e.target.value }))}
                className="input"
                minLength={1}
                maxLength={100}
              />
              <input
                required
                type="text"
                placeholder="Username * (letters, numbers, _ . -)"
                value={createForm.username}
                onChange={(e) => setCreateForm((f: CreateUserPayload) => ({ ...f, username: e.target.value }))}
                className="input"
                minLength={3}
                maxLength={50}
                pattern="^[a-zA-Z0-9_.\-]+"
              />
              <input
                required
                type="email"
                placeholder="Email *"
                value={createForm.email}
                onChange={(e) => setCreateForm((f: CreateUserPayload) => ({ ...f, email: e.target.value }))}
                className="input"
              />
              <input
                type="url"
                placeholder="Avatar URL (optional)"
                value={createForm.avatar_url ?? ''}
                onChange={(e) => setCreateForm((f: CreateUserPayload) => ({ ...f, avatar_url: e.target.value }))}
                className="input"
                maxLength={500}
              />
              <button type="submit" className="btn btn--primary btn--sm" disabled={creating}>
                {creating ? 'Creating…' : 'Create User'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
