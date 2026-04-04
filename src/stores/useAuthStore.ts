import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  fetchProfile: () => Promise<void>;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  initialized: false,

  setSession: (session) => set({
    session,
    user: session?.user ?? null,
  }),

  setProfile: (profile) => set({ profile }),

  setLoading: (loading) => set({ loading }),

  setInitialized: (initialized) => set({ initialized }),

  fetchProfile: async () => {
    const { user } = get();
    if (!user) {
      set({ profile: null });
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      set({ profile: data as Profile });
    }
  },

  reset: () => set({
    user: null,
    session: null,
    profile: null,
    loading: false,
  }),
}));

// Initialize auth listener
export function initAuthListener() {
  // Get initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.getState().setSession(session);
    if (session) {
      useAuthStore.getState().fetchProfile();
    }
    useAuthStore.getState().setLoading(false);
    useAuthStore.getState().setInitialized(true);
  });

  // Listen for auth changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      useAuthStore.getState().setSession(session);
      if (session) {
        useAuthStore.getState().fetchProfile();
      } else {
        useAuthStore.getState().reset();
      }
    }
  );

  return subscription;
}
