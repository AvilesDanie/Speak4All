'use client';

import { useStudentProgress, useCourseProgress } from '@/hooks/useProgress';
import { useAuth } from '@/hooks/useAuth';

interface StudentProgressCardProps {
  studentId?: number;
  courseId: number;
  showAll?: boolean;
}

export function StudentProgressCard({
  studentId,
  courseId,
  showAll = false,
}: StudentProgressCardProps) {
  const { user } = useAuth();
  const { progress, loading } = useStudentProgress(
    studentId || (user?.id as number | null),
    courseId
  );
  const { progressList, loading: loadingAll } = useCourseProgress(
    showAll ? courseId : null
  );

  if (showAll && loadingAll) {
    return <div className="p-4">Cargando progreso...</div>;
  }

  if (!showAll && loading) {
    return <div className="p-4">Cargando progreso...</div>;
  }

  if (showAll) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Estudiante</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Progreso</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">
                Evaluaciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {progressList?.map((p: any) => (
              <tr key={p.student_id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">{p.full_name}</p>
                    <p className="text-xs text-gray-500">{p.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="w-full bg-gray-200 rounded h-2">
                    <div
                      className="bg-blue-600 h-2 rounded transition-all"
                      style={{
                        width: `${Math.min(p.weighted_score, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-sm font-semibold mt-1">{p.weighted_score.toFixed(1)}%</p>
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-600">
                  {p.evaluated_exercises}/{p.total_exercises}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!progress) {
    return <div className="p-4">No hay datos de progreso</div>;
  }

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg">
      <div className="mb-4">
        <h2 className="text-xl font-bold">{progress.full_name}</h2>
        <p className="text-sm text-gray-600">{progress.email}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-3 bg-blue-50 rounded">
          <p className="text-xs text-gray-600 mb-1">Progreso General</p>
          <p className="text-2xl font-bold text-blue-600">{progress.weighted_score}%</p>
        </div>

        <div className="p-3 bg-green-50 rounded">
          <p className="text-xs text-gray-600 mb-1">Evaluaciones</p>
          <p className="text-2xl font-bold text-green-600">
            {progress.evaluated_exercises}/{progress.total_exercises}
          </p>
        </div>

        <div className="p-3 bg-purple-50 rounded">
          <p className="text-xs text-gray-600 mb-1">Estado</p>
          <p className="text-sm font-medium text-purple-600">
            {progress.evaluated_exercises === progress.total_exercises
              ? 'Completado'
              : 'En Progreso'}
          </p>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Detalles</h3>
        <div className="w-full bg-gray-200 rounded h-3 mb-2">
          <div
            className="bg-blue-600 h-3 rounded transition-all"
            style={{
              width: `${Math.min(progress.weighted_score, 100)}%`,
            }}
          />
        </div>
        <p className="text-xs text-gray-600">{progress.evaluations_summary}</p>
      </div>
    </div>
  );
}
