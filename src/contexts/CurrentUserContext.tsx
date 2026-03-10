import { createContext, useContext, useState, type ReactNode } from 'react';
import { api } from '@/api';
import type { UserResponse } from '@/types';

interface CurrentUserContextValue {
  currentUser: UserResponse | null;
  setCurrentUser: (user: UserResponse | null) => void;
  handleCurrentUserChange: (userId: string | null) => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<UserResponse | null>(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      return stored ? (JSON.parse(stored) as UserResponse) : null;
    } catch {
      return null;
    }
  });

  function setCurrentUser(user: UserResponse | null) {
    setCurrentUserState(user);
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
  }

  async function handleCurrentUserChange(userId: string | null) {
    if (!userId) {
      setCurrentUser(null);
      return;
    }
    try {
      const user = await api.getUser(userId);
      setCurrentUser(user);
    } catch {
      // silently ignore
    }
  }

  return (
    <CurrentUserContext.Provider value={{ currentUser, setCurrentUser, handleCurrentUserChange }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error('useCurrentUser must be used within CurrentUserProvider');
  return ctx;
}
