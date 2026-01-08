'use client';

import { StudentProgressView } from '@/components/StudentProgressView';
import { useAuth } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';

export default function MyProgressPage() {
  const { token, user } = useAuth();
  const params = useParams();
  const courseId = parseInt(params.slug as string);

  if (!token || !user) {
    return (
      <div className="container mx-auto px-4 py-6">
        <p className="text-red-600">Debes iniciar sesión para ver esto</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Mi Progreso</h1>
      <StudentProgressView studentId={user.id} courseId={courseId} />
    </div>
  );
}
