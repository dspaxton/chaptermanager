import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bike, Chrome } from 'lucide-react';
import { authApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data.email, data.password);
      const { user, accessToken, refreshToken } = response.data.data;
      setAuth(user, accessToken, refreshToken);
      toast.success('Welcome back!');
      navigate('/');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-hog-black-950 via-hog-black-900 to-hog-black-950">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-hog-orange-500 rounded-2xl mb-4">
            <Bike className="w-10 h-10 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold">HOG Chapter Manager</h1>
          <p className="text-hog-black-400 mt-2">Sign in to your account</p>
        </div>

        {/* Login form */}
        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-hog-black-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-hog-black-900 text-hog-black-400">Or continue with</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="btn-secondary w-full"
            >
              <Chrome className="w-5 h-5 mr-2" />
              Google
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-hog-black-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-hog-orange-500 hover:text-hog-orange-400">
              Sign up
            </Link>
          </p>
        </div>

        {/* Demo credentials */}
        <p className="mt-4 text-center text-xs text-hog-black-500">
          Demo: admin@chapter.local / Password123
        </p>
      </div>
    </div>
  );
}
