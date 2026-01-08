'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { progressService } from '@/services/rubrics';

interface WeightingPageProps {
  params: { slug: string };
}

interface WeightingData {
  courseExerciseId: number;
  exerciseName: string;
  weight: number;
}

export default function WeightingPage({ params }: WeightingPageProps) {
  const { token, user } = useAuth();
  const courseId = parseInt(params.slug);
  const [weightings, setWeightings] = useState<WeightingData[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadWeightings();
  }, [courseId, token]);

  const loadWeightings = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const weightings = await progressService.getCourseWeightings(courseId, token);
      setWeightings(weightings || []);
      setError(null);
    } catch (err) {
      console.error('Error loading weightings:', err);
      setError('Error al cargar las ponderaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (courseExerciseId: number, newWeight: number) => {
    setWeightings((prev) =>
      prev.map((w) =>
        w.courseExerciseId === courseExerciseId ? { ...w, weight: newWeight } : w
      )
    );
  };

  const handleSaveWeighting = async (courseExerciseId: number, weight: number) => {
    if (!token) return;

    try {
      setSaving(true);
      await progressService.setWeighting({ course_exercise_id: courseExerciseId, weight }, token);
      setError(null);
      // Reload to verify
      await loadWeightings();
    } catch (err) {
      console.error('Error saving weighting:', err);
      setError('Error al guardar la ponderación');
    } finally {
      setSaving(false);
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
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Ponderación de Ejercicios</h1>

      {loading && <p className="text-gray-600">Cargando ponderaciones...</p>}

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {!loading && weightings.length > 0 && (
        <div className="space-y-4">
          <p className="text-gray-600 mb-4">
            Asigna una ponderación (0-100) a cada ejercicio para calcular el progreso general
          </p>

          {weightings.map((weighting) => (
            <div
              key={weighting.courseExerciseId}
              className="flex items-center gap-4 p-4 border rounded-lg bg-white"
            >
              <div className="flex-1">
                <p className="font-semibold">{weighting.exerciseName}</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={weighting.weight}
                  onChange={(e) =>
                    handleWeightChange(weighting.courseExerciseId, parseInt(e.target.value) || 0)
                  }
                  disabled={saving}
                  className="w-20 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600 w-8">%</span>
              </div>

              <button
                onClick={() =>
                  handleSaveWeighting(weighting.courseExerciseId, weighting.weight)
                }
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          ))}

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-gray-700">
              <strong>Nota:</strong> La suma total de ponderaciones debe ser 100% para un cálculo
              preciso del progreso general.
            </p>
          </div>
        </div>
      )}

      {!loading && weightings.length === 0 && (
        <p className="text-gray-600">No hay ejercicios para asignar ponderaciones</p>
      )}
    </div>
  );
}
