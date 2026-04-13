'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Lock } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please enter a password');
      return;
    }

    const success = await login(password);
    if (success) {
      router.push('/dashboard');
    } else {
      setError('Invalid password');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f2f2f2]">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-[#f2f2f2] flex items-center justify-center">
              <Lock className="h-7 w-7" style={{ color: '#ff385c' }} />
            </div>
          </div>
          <CardTitle className="text-2xl text-center text-[#222222] font-bold tracking-tight">
            Chiateam Admin
          </CardTitle>
          <CardDescription className="text-center text-[#6a6a6a]">
            Enter your password to access the admin panel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-[#222222]"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            {error && (
              <div className="text-sm text-[#c13515] bg-red-50 p-3 rounded-airbnb border border-red-100">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full">
              Login
            </Button>
          </form>
          <div className="mt-6 text-xs text-[#6a6a6a] text-center space-y-1">
            <p className="font-medium">Hint:</p>
            <p>Admin: Full access (view &amp; edit)</p>
            <p>Viewer: Read-only access</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
