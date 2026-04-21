import { useState, useCallback } from 'react';
import * as authClient from '../lib/authClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useScenariosStore } from '../stores/useScenariosStore';
import { useFlowStore } from '../stores/useFlowStore';
import { disconnectMT5 } from '../lib/mt5';
import { disconnectBinance } from '../lib/binance';

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

      // Clear EVERY cross-user surface so a 2nd user on the same browser
      // never sees the prior user's strategies, ML state, or open
      // MT5/Binance WebSockets. Reviewer flagged this as a demo-killer
      // ("investor A signs in after B and sees B's canvas").
      useScenariosStore.getState().reset();
      // Flow store: zero canvas nodes/edges + clear the "current strategy"
      // pointer so autosave doesn't race to upload the prev user's work.
      useFlowStore.getState().clear();
      // Close any live broker connections the previous session opened.
      // Idempotent — safe to call even if user never connected.
      disconnectMT5();
      disconnectBinance();

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
