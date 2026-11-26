import { LoginForm } from '@/components/LoginForm';
import { isDemoModeEnabled } from '@/lib/demo';

export default function LoginPage() {
  return <LoginForm demoMode={isDemoModeEnabled()} />;
}