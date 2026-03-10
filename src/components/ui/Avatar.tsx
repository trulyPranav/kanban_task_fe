import { getInitials } from '@/lib/utils';

type AvatarSize = 'xs' | 'sm' | 'md';

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-[12px]',
};

interface AvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}

export default function Avatar({ name, avatarUrl, size = 'sm', className = '' }: AvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? ''}
        className={`${SIZE_CLASS[size]} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }
  if (name) {
    return (
      <span
        className={`${SIZE_CLASS[size]} rounded-full inline-flex items-center justify-center bg-(--color-surface-3) text-text-2 font-semibold shrink-0 ${className}`}
        title={name}
      >
        {getInitials(name)}
      </span>
    );
  }
  return (
    <span
      className={`${SIZE_CLASS[size]} rounded-full inline-flex items-center justify-center bg-(--color-surface-2) shrink-0 ${className}`}
    >
      <svg width="55%" height="55%" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="3" stroke="var(--color-text-3)" strokeWidth="1.5" />
        <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="var(--color-text-3)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}
