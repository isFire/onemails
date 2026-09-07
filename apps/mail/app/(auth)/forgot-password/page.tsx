import { useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await authClient.forgetPassword({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message || 'Failed to send reset email');
        return;
      }
      // Always show the same message whether or not the email is registered,
      // to avoid leaking which emails have accounts.
      setSubmitted(true);
    } catch {
      toast.error('Failed to send reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#111111] px-4">
      <div className="animate-in slide-in-from-bottom-4 w-full max-w-[400px] space-y-6 duration-500">
        <div className="space-y-2 text-center">
          <p className="text-3xl font-bold text-white md:text-4xl">Reset your password</p>
          <p className="text-sm text-white/60">
            Enter your email and we will send you a password reset link.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-6">
            <div className="rounded-lg border border-white/10 bg-white/5 p-5">
              <div className="flex items-start">
                <CheckCircle2 size={24} className="mt-0.5 shrink-0 text-green-400" />
                <p className="ml-3 text-sm text-white/80">
                  If an account exists for <span className="font-medium text-white">{email}</span>,
                  a password reset email has been sent. Please check your inbox.
                </p>
              </div>
            </div>
            <Link to="/login" className="block">
              <Button className="h-12 w-full rounded-lg" variant="outline">
                Back to Login
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/80">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-lg">
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
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
