import { useState, useRef } from 'react';
import { useCurrentUser } from '@/contexts/CurrentUserContext';
import { useClickOutside } from '@/hooks/useClickOutside';
import Avatar from '@/components/ui/Avatar';
import UserSelector from '@/components/UserSelector';
interface BoardHeaderProps {
  overallTotal: number;
  search: string;
  chartOpen: boolean;
  onSearch: (q: string) => void;
  onToggleChart: () => void;
  onNewTask: () => void;
}

export default function BoardHeader({
  overallTotal,
  search,
  chartOpen,
  onSearch,
  onToggleChart,
  onNewTask,
}: BoardHeaderProps) {
  const { currentUser, handleCurrentUserChange } = useCurrentUser();
  const [showUserPicker, setShowUserPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useClickOutside(pickerRef, () => setShowUserPicker(false), showUserPicker);

  const handleUserChange = async (userId: string | null) => {
    await handleCurrentUserChange(userId);
    setShowUserPicker(false);
  };

  return (
    <header className="flex items-center gap-5 px-6 h-14 bg-white border-b border-(--color-border) sticky top-0 z-50 shrink-0">
      {/* Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-(--color-text-1) flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="5" height="5" rx="1" fill="white" opacity="0.9" />
            <rect x="8" y="1" width="5" height="5" rx="1" fill="white" opacity="0.55" />
            <rect x="1" y="8" width="5" height="5" rx="1" fill="white" opacity="0.55" />
            <rect x="8" y="8" width="5" height="5" rx="1" fill="white" opacity="0.3" />
          </svg>
        </div>
        <span className="text-sm font-semibold tracking-tight text-(--color-text-1)">Tasks</span>
        <span className="text-[11px] text-text-3 tabular-nums">{overallTotal}</span>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-(--color-border) shrink-0" />

      {/* Search */}
      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-2 border border-(--color-border) focus-within:border-(--color-border-focus) focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] rounded-lg px-3 py-2 max-w-xs w-full transition-all bg-white">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0 text-text-3">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            className="border-none bg-transparent outline-none text-[13px] text-(--color-text-1) flex-1 min-w-0 placeholder:text-text-3"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => onSearch(e.target.value.trim())}
          />
          {search && (
            <button
              className="border-none bg-transparent cursor-pointer text-text-3 hover:text-text-2 p-0 leading-none text-xs transition-colors"
              onClick={() => onSearch('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          title={chartOpen ? 'Hide chart' : 'Show activity chart'}
          className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
            chartOpen
              ? 'border-(--color-border-focus) bg-(--color-surface-2) text-(--color-text-1)'
              : 'border-(--color-border) bg-white text-text-3 hover:text-(--color-text-1) hover:border-(--color-border-focus)'
          }`}
          onClick={onToggleChart}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="8" width="3" height="7" rx="1" fill="currentColor" opacity="0.5" />
            <rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor" opacity="0.75" />
            <rect x="11" y="1" width="3" height="14" rx="1" fill="currentColor" />
          </svg>
        </button>

        <button
          className="inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-lg bg-(--color-text-1) text-white text-[12px] font-medium cursor-pointer transition-colors hover:bg-primary-hover"
          onClick={onNewTask}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          New Task
        </button>

        {/* Current user picker */}
        <div className="relative" ref={pickerRef}>
          {showUserPicker && (
            <div className="absolute right-0 top-[calc(100%+8px)] bg-white border border-(--color-border) rounded-xl shadow-lg shadow-black/5 p-4 min-w-70 z-100">
              <UserSelector
                value={currentUser?.id ?? null}
                onChange={handleUserChange}
                placeholder="Select your user"
                label="Signed in as"
              />
            </div>
          )}
          <button
            className="flex items-center gap-2 h-8 pl-1 pr-3 border border-(--color-border) rounded-lg bg-white cursor-pointer text-[13px] text-(--color-text-1) transition-all hover:border-(--color-border-focus) hover:shadow-[0_0_0_3px_rgba(99,102,241,0.08)]"
            onClick={() => setShowUserPicker((o) => !o)}
            title={currentUser ? `Signed in as ${currentUser.full_name}` : 'Select user'}
          >
            <Avatar name={currentUser?.full_name} avatarUrl={currentUser?.avatar_url} size="sm" />
            <span className="text-[12px] font-medium max-w-25 overflow-hidden text-ellipsis whitespace-nowrap text-text-2">
              {currentUser ? currentUser.full_name : 'Sign in'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
