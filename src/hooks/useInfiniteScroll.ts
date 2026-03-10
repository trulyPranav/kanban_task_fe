import { useEffect, type RefObject } from 'react';

export function useInfiniteScroll(
  sentinelRef: RefObject<HTMLElement | null>,
  onLoadMore: () => void,
  hasMore: boolean,
  rootMargin = '80px',
  root?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onLoadMore(); },
      { threshold: 0, rootMargin, root: root?.current ?? null },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sentinelRef, hasMore, onLoadMore, rootMargin, root]);
}
