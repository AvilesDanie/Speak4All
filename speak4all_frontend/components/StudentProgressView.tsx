'use client';

import { useAuth } from '@/hooks/useAuth';
import { useProgress } from '@/hooks/useProgress';
import { useState } from 'react';

interface StudentProgressViewProps {
  studentId: number;
  courseId: number;
}

export function StudentProgressView({ studentId, courseId }: StudentProgressViewProps) {
  const { token } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { progress, loading, error } = useProgress(studentId, courseId, token, refreshTrigger);

  if (loading) {
    return <p className="text-gray-600">Cargando progreso...</p>;
  }

  if (error) {
    return <p className="text-red-600">Error al cargar el progreso</p>;
  }

  if (!progress) {
    return <p className="text-gray-600">No hay datos de progreso disponibles</p>;
  }

  const overallPercentage = Math.round(progress.weighted_score || 0);

  return (
    <div className="space-y-6">
      {/* Resumen general */}
      <div className="p-6 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
        <h2 className="text-xl font-bold mb-4">Progreso General</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded">
            <p className="text-sm text-gray-600">Puntuación Ponderada</p>
            <p className="text-3xl font-bold text-blue-600">{overallPercentage}%</p>
          </div>

          <div className="bg-white p-4 rounded">
            <p className="text-sm text-gray-600">Evaluaciones Completadas</p>
            <p className="text-3xl font-bold text-green-600">
              {progress.evaluated_exercises || 0}
            </p>
          </div>

          <div className="bg-white p-4 rounded">
            <p className="text-sm text-gray-600">Ejercicios</p>
            <p className="text-3xl font-bold text-purple-600">
              {progress.total_exercises || 0}
            </p>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mt-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Progreso</span>
            <span className="text-sm font-semibold text-gray-700">{overallPercentage}%</span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
              style={{ width: `${overallPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Detalles por ejercicio */}
      {progress.exercise_scores && progress.exercise_scores.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-4">Desempeño por Ejercicio</h3>

          <div className="space-y-3">
            {progress.exercise_scores.map((exercise: any) => (
              <div key={exercise.course_exercise_id} className="p-4 border rounded bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold">{exercise.exercise_name}</h4>
                    <p className="text-sm text-gray-600">
                      Ponderación: {exercise.weight || 0}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">
                      {exercise.score || 0} / {exercise.max_score || 0}
                    </p>
                    <p className="text-sm text-gray-600">
                      {exercise.max_score ? Math.round((exercise.score || 0) / exercise.max_score * 100) : 0}%
                    </p>
                  </div>
                </div>

                {/* Barra de progreso del ejercicio */}
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{
                      width: `${exercise.max_score ? Math.min((exercise.score || 0) / exercise.max_score * 100, 100) : 0}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sin evaluaciones: mostrar solo si no hay ninguna evaluada */}
      {(!progress || (progress.evaluated_exercises || 0) === 0) && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-gray-700">
            No hay evaluaciones aún. El progreso aparecerá una vez que el terapeuta evalúe tus
            ejercicios.
          </p>
        </div>
      )}
    </div>
  );
}
