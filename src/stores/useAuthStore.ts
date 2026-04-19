import { create } from 'zustand';
import { fetchMe, getToken, setToken, type AuthUser } from '../lib/authClient';

export interface Session {
  access_token: string;
  user: AuthUser;
}

interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  profile: AuthUser | null;
  loading: boolean;
  initialized: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  fetchProfile: () => Promise<void>;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  initialized: false,

  setSession: (session) => set({
    session,
    user: session?.user ?? null,
    profile: session?.user ?? null,
  }),

  setProfile: (profile) => set({ profile }),

  setLoading: (loading) => set({ loading }),

  setInitialized: (initialized) => set({ initialized }),

  fetchProfile: async () => {
    const me = await fetchMe();
    if (me) {
      set({ profile: me, user: me });
    } else {
      set({ profile: null });
    }
  },

  reset: () => {
    setToken(null);
    set({
      user: null,
      session: null,
      profile: null,
      loading: false,
    });
  },
}));

// Initialize: check localStorage for token, fetch /me.
// Returns a cleanup function matching the old Supabase subscription shape.
export function initAuthListener(): { unsubscribe: () => void } {
  const token = getToken();
  if (!token) {
    useAuthStore.setState({ loading: false, initialized: true });
    return { unsubscribe: () => {} };
  }

  fetchMe()
    .then(user => {
      if (user) {
        useAuthStore.getState().setSession({ access_token: token, user });
      } else {
        // Token invalid — clear
        setToken(null);
        useAuthStore.getState().reset();
      }
    })
    .catch(() => {
      setToken(null);
      useAuthStore.getState().reset();
    })
    .finally(() => {
      useAuthStore.setState({ loading: false, initialized: true });
    });

  return { unsubscribe: () => {} };
}
