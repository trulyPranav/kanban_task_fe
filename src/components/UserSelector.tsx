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
  if (!user)
    return (
      <span className="w-6 h-6 rounded-full inline-flex items-center justify-center bg-[var(--color-surface-2)] text-[var(--color-text-3)] text-[11px]">
        —
      </span>
    );
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={user.full_name} className="w-6 h-6 rounded-full object-cover" />;
  }
  return (
    <span
      className="w-6 h-6 rounded-full inline-flex items-center justify-center bg-[var(--color-primary-light)] text-[var(--color-primary)] text-[10px] font-bold shrink-0"
      title={user.full_name}
    >
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
    <div className="relative" ref={containerRef}>
      {label && <label className="block text-xs font-semibold text-[var(--color-text-2)] mb-1">{label}</label>}
      <button
        type="button"
        className="flex items-center gap-2 w-full px-2.5 py-2 border-[1.5px] border-[var(--color-border)] rounded-lg bg-white cursor-pointer text-left hover:border-[var(--color-border-focus)] transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <AvatarSmall user={selectedUser} />
        <span className="flex-1 text-sm text-[var(--color-text-1)] truncate">
          {selectedUser ? selectedUser.full_name : placeholder}
        </span>
        <svg className="shrink-0 text-[var(--color-text-3)]" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border-[1.5px] border-[var(--color-border)] rounded-xl shadow-lg z-[200] overflow-hidden"
          role="listbox"
        >
          {!showCreate ? (
            <>
              <div className="px-2 py-1.5 border-b border-[var(--color-border)]">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search users…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border-[1.5px] border-[var(--color-border)] focus:border-[var(--color-border-focus)] rounded-lg bg-white outline-none placeholder:text-[var(--color-text-3)]"
                />
              </div>

              <div className="max-h-[200px] overflow-y-auto p-1" ref={userListRef}>
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left border-none rounded-lg bg-transparent cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors text-sm text-[var(--color-text-3)]"
                  onClick={() => handleSelect(null)}
                >
                  <span className="w-6 h-6 rounded-full inline-flex items-center justify-center bg-[var(--color-surface-2)] text-[var(--color-text-3)] text-[11px]">—</span>
                  <span>None</span>
                </button>

                {loading ? (
                  <div className="px-3 py-2 text-xs text-[var(--color-text-3)]">Loading…</div>
                ) : (
                  users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-left border-none rounded-lg cursor-pointer transition-colors text-sm ${
                        value === u.id
                          ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                          : 'bg-transparent hover:bg-[var(--color-surface-2)] text-[var(--color-text-1)]'
                      }`}
                      onClick={() => handleSelect(u.id)}
                    >
                      <AvatarSmall user={u} />
                      <span className="flex-1 truncate font-medium">{u.full_name}</span>
                      <span className="text-[11px] text-[var(--color-text-3)] shrink-0">@{u.username}</span>
                    </button>
                  ))
                )}

                {!loading && users.length === 0 && (
                  <div className="px-3 py-2 text-xs text-[var(--color-text-3)]">No users found</div>
                )}
                {loadingMoreUsers && (
                  <div className="px-3 py-2 text-xs text-[var(--color-text-3)]">Loading…</div>
                )}
                {hasMoreUsers && <div ref={userSentinelRef} className="h-px" />}
              </div>

              <div className="px-2 py-1.5 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  className="w-full px-2.5 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] rounded-lg transition-colors text-left"
                  onClick={() => setShowCreate(true)}
                >
                  + Create new user
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleCreate} className="flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-2)] transition-colors"
                  onClick={() => setShowCreate(false)}
                  aria-label="Back"
                >
                  ←
                </button>
                <span className="text-sm font-semibold text-[var(--color-text-1)]">New User</span>
              </div>
              {createError && (
                <div className="px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {createError}
                </div>
              )}
              <input
                required
                type="text"
                placeholder="Full name *"
                value={createForm.full_name}
                onChange={(e) => setCreateForm((f: CreateUserPayload) => ({ ...f, full_name: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-sm border-[1.5px] border-[var(--color-border)] focus:border-[var(--color-border-focus)] rounded-lg bg-white outline-none placeholder:text-[var(--color-text-3)]"
                minLength={1}
                maxLength={100}
              />
              <input
                required
                type="text"
                placeholder="Username * (letters, numbers, _ . -)"
                value={createForm.username}
                onChange={(e) => setCreateForm((f: CreateUserPayload) => ({ ...f, username: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-sm border-[1.5px] border-[var(--color-border)] focus:border-[var(--color-border-focus)] rounded-lg bg-white outline-none placeholder:text-[var(--color-text-3)]"
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
                className="w-full px-2.5 py-1.5 text-sm border-[1.5px] border-[var(--color-border)] focus:border-[var(--color-border-focus)] rounded-lg bg-white outline-none placeholder:text-[var(--color-text-3)]"
              />
              <input
                type="url"
                placeholder="Avatar URL (optional)"
                value={createForm.avatar_url ?? ''}
                onChange={(e) => setCreateForm((f: CreateUserPayload) => ({ ...f, avatar_url: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-sm border-[1.5px] border-[var(--color-border)] focus:border-[var(--color-border-focus)] rounded-lg bg-white outline-none placeholder:text-[var(--color-text-3)]"
                maxLength={500}
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={creating}
              >
                {creating ? 'Creating…' : 'Create User'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
