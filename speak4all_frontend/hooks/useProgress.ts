import { useState, useEffect } from 'react';
import { progressService } from '@/services/rubrics';
import { useAuth } from './useAuth';

// Hook genérico para cargar progreso de un estudiante
export function useProgress(
  studentId: number | null,
  courseId: number | null,
  token: string | null,
  refreshTrigger?: number
) {
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId || !courseId || !token) {
      setLoading(false);
      return;
    }

    const loadProgress = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await progressService.getStudentProgress(studentId, courseId, token);
        setProgress(data);
      } catch (err) {
        console.error('Error loading progress:', err);
        setError('Error al cargar el progreso');
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, [studentId, courseId, token, refreshTrigger]);

  return { progress, loading, error };
}

export function useStudentProgress(studentId: number | null, courseId: number | null) {
  const { token } = useAuth();
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadProgress = async () => {
    if (!studentId || !courseId || !token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await progressService.getStudentProgress(studentId, courseId, token);
      setProgress(data);
    } catch (err) {
      console.error('Error loading progress:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, [studentId, courseId, token]);

  return { progress, loading, refetch: loadProgress };
}

export function useCourseProgress(courseId: number | null) {
  const { token } = useAuth();
  const [progressList, setProgressList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProgress = async () => {
    if (!courseId || !token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await progressService.getCourseProgress(courseId, token);
      setProgressList(data || []);
    } catch (err) {
      console.error('Error loading course progress:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, [courseId, token]);

  return { progressList, loading, refetch: loadProgress };
}
