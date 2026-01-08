'use client';

import { StudentProgressCard } from '@/components/StudentProgressCard';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { progressService } from '@/services/rubrics';

interface ProgressPageProps {
  params: { slug: string };
}

export default function ProgressPage({ params }: ProgressPageProps) {
  const { token, user } = useAuth();
  const courseId = parseInt(params.slug);
  const [courseProgress, setCourseProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    loadCourseProgress();
  }, [courseId, token]);

  const loadCourseProgress = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const progress = await progressService.getCourseProgress(courseId, token);
      setCourseProgress(progress);
      setError(null);
    } catch (err) {
      console.error('Error loading course progress:', err);
      setError('Error al cargar el progreso del curso');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-6">
        <p className="text-red-600">Debes iniciar sesión para ver esto</p>
      </div>
    );
  }

  if (user?.role !== 'THERAPIST') {
    return (
      <div className="container mx-auto px-4 py-6">
        <p className="text-red-600">No tienes permisos para acceder a esta página</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Progreso de Estudiantes</h1>

      {loading && <p className="text-gray-600">Cargando progreso...</p>}

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {courseProgress && (
        <StudentProgressCard
          courseId={courseId}
          showAll={true}
        />
      )}
    </div>
  );
}
