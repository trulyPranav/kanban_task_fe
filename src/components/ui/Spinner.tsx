type SpinnerSize = 'sm' | 'md';

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={`${SIZE_CLASS[size]} rounded-full border-[1.5px] border-(--color-border) border-t-(--color-accent) animate-spin-fast ${className}`}
    />
  );
}
