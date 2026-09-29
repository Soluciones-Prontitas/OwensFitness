import { authorized } from '@/lib/auth';
import { redirect } from 'next/navigation';
import FitnessApp from './FitnessApp';
export default async function Home() {
  if (!(await authorized())) redirect('/login');
  return <FitnessApp />;
}
