import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../lib/api';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');

    if (error) {
      toast.error('OAuth login failed');
      navigate('/login');
      return;
    }

    if (accessToken && refreshToken) {
      // Temporarily set tokens to make the /me request
      useAuthStore.setState({ accessToken, refreshToken });

      // Fetch user data
      authApi.me()
        .then((response) => {
          const user = response.data.data;
          setAuth(user, accessToken, refreshToken);
          toast.success('Welcome!');
          navigate('/');
        })
        .catch(() => {
          toast.error('Failed to get user data');
          navigate('/login');
        });
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate, setAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-hog-black-950">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-hog-orange-500 mx-auto mb-4" />
        <p className="text-hog-black-400">Completing sign in...</p>
      </div>
    </div>
  );
}
