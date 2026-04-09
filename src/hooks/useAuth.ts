import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AuthError } from '@supabase/supabase-js';

interface AuthResult {
  success: boolean;
  error: string | null;
}

export function useAuth() {
  const [loading, setLoading] = useState(false);

  const signUp = useCallback(async (
    email: string,
    password: string,
    displayName: string
  ): Promise<AuthResult> => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) {
        return { success: false, error: formatAuthError(error) };
      }

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: 'Unexpected error. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async (
    email: string,
    password: string
  ): Promise<AuthResult> => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: formatAuthError(error) };
      }

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: 'Unexpected error. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.href.split('#')[0],
        },
      });

      if (error) {
        return { success: false, error: formatAuthError(error) };
      }

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: 'Unexpected error. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async (): Promise<AuthResult> => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { success: false, error: formatAuthError(error) };
      }

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: 'Unexpected error. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.href.split('#')[0]}#/reset-password`,
      });

      if (error) {
        return { success: false, error: formatAuthError(error) };
      }

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: 'Unexpected error. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<AuthResult> => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        return { success: false, error: formatAuthError(error) };
      }

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: 'Unexpected error. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    requestPasswordReset,
    updatePassword,
  };
}

function formatAuthError(error: AuthError): string {
  switch (error.message) {
    case 'User already registered':
      return 'This email is already registered. Try signing in.';
    case 'Invalid login credentials':
      return 'Wrong email or password.';
    case 'Email not confirmed':
      return 'Please confirm your email first. Check your inbox.';
    case 'Signup requires a valid password':
      return 'Password must be at least 6 characters.';
    case 'For security purposes, you can only request this once every 60 seconds':
      return 'Please wait 60 seconds before requesting another reset link.';
    case 'New password should be different from the old password.':
      return 'New password must be different from your current password.';
    default:
      return error.message;
  }
}
