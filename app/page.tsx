import { currentUser } from '@/lib/auth';
import { hasRole,managesTraining } from '@/lib/roles';
import { redirect } from 'next/navigation';
import FitnessApp from './FitnessApp';
import StudentApp from '@/components/StudentApp';
export default async function Home(){const user=await currentUser();if(!user)redirect('/login/');if(hasRole(user,'student'))return <StudentApp user={user}/>;return <FitnessApp user={user} supportOnly={!managesTraining(user)}/>;}
