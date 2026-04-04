import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { initAuthListener } from './stores/useAuthStore';

export default function App() {
  useEffect(() => {
    const subscription = initAuthListener();
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return <RouterProvider router={router} />;
}
