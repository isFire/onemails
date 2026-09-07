import { useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TriangleAlert } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !token) return;

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (error) {
        toast.error(error.message || 'Failed to reset password');
        return;
      }
      toast.success('Password reset successfully. Please log in with your new password.');
      navigate('/login');
    } catch {
      toast.error('Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#111111] px-4">
      <div className="animate-in slide-in-from-bottom-4 w-full max-w-[400px] space-y-6 duration-500">
        <div className="space-y-2 text-center">
          <p className="text-3xl font-bold text-white md:text-4xl">Set a new password</p>
          <p className="text-sm text-white/60">Enter and confirm your new password below.</p>
        </div>

        {!token ? (
          <div className="space-y-6">
            <div className="rounded-lg border border-white/10 bg-white/5 p-5">
              <div className="flex items-start">
                <TriangleAlert size={24} className="mt-0.5 shrink-0 text-yellow-400" />
                <p className="ml-3 text-sm text-white/80">
                  This reset link is invalid or has expired. Please request a new one.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <Link to="/forgot-password" className="block">
                <Button className="h-12 w-full rounded-lg">Request New Link</Button>
              </Link>
              <Link to="/login" className="block">
                <Button className="h-12 w-full rounded-lg" variant="outline">
                  Back to Login
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-white/80">
                New Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-white/80">
                Confirm New Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-lg">
              {isSubmitting ? 'Resetting...' : 'Reset Password'}
            </Button>
            <p className="text-center text-sm text-white/60">
              Remember your password?{' '}
              <Link to="/login" className="text-white underline underline-offset-2">
                Back to Login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
