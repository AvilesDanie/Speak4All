import { useState, useEffect } from 'react';
import { rubricService } from '@/services/rubrics';
import { useAuth } from './useAuth';

export function useRubric(courseExerciseId: number | null) {
  const { token } = useAuth();
  const [rubric, setRubric] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRubric = async () => {
    if (!courseExerciseId || !token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      let data = await rubricService.getRubric(courseExerciseId, token);
      setRubric(data);
    } catch (err: any) {
      if (err.message.includes('404') || err.message.includes('no encontrada')) {
        // Crear rúbrica por defecto
        try {
          const data = await rubricService.createDefault(courseExerciseId, token);
          setRubric(data);
        } catch (createErr) {
          setError(createErr instanceof Error ? createErr.message : 'Error creando rúbrica');
        }
      } else {
        setError(err instanceof Error ? err.message : 'Error cargando rúbrica');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRubric();
  }, [courseExerciseId, token]);

  return { rubric, loading, error, refetch: loadRubric };
}
