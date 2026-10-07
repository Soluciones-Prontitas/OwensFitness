export type Role = 'admin' | 'instructor' | 'support' | 'student';
export type Identity = { id: string; name: string; email: string | null; roles: Role[]; instructorId: string | null; athleteId: string | null; mustChangePassword: boolean };
export const PEPE_ID = 'instructor-pepe';
export const LOCAL_ID = 'local-support';
export const hasRole = (user: Identity, role: Role) => user.roles.includes(role);
export const managesTraining = (user: Identity) => hasRole(user, 'admin') || hasRole(user, 'instructor');
export const roleLabels: Record<Role, string> = { admin: 'Administrador', instructor: 'Instructor', support: 'Soporte', student: 'Alumno' };
