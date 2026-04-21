import { useState, useCallback } from 'react';
import * as authClient from '../lib/authClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useScenariosStore } from '../stores/useScenariosStore';

interface AuthResult {
  success: boolean;
  error: string | null;
}

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore(s => s.setSession);
  const reset = useAuthStore(s => s.reset);

  const signUp = useCallback(async (
    email: string,
    password: string,
    displayName: string,
  ): Promise<AuthResult> => {
    setLoading(true);
    try {
      const result = await authClient.register(email, password, displayName);
      if (result.success && result.user && result.token) {
        setSession({ access_token: result.token, user: result.user });
      }
      return { success: result.success, error: result.error };
    } finally {
      setLoading(false);
    }
  }, [setSession]);

  const signIn = useCallback(async (
    email: string,
    password: string,
  ): Promise<AuthResult> => {
    setLoading(true);
    try {
      const result = await authClient.login(email, password);
      if (result.success && result.user && result.token) {
        setSession({ access_token: result.token, user: result.user });
      }
      return { success: result.success, error: result.error };
    } finally {
      setLoading(false);
    }
  }, [setSession]);

  const signOut = useCallback(async (): Promise<AuthResult> => {
    setLoading(true);
    try {
      authClient.logout();
      reset();
      // Clear cross-user caches so a 2nd user on the same browser
      // doesn't see the prior user's running scenarios in the Toolbar chip.
      useScenariosStore.getState().reset();
      return { success: true, error: null };
    } finally {
      setLoading(false);
    }
  }, [reset]);

  return {
    loading,
    signUp,
    signIn,
    signOut,
  };
}
