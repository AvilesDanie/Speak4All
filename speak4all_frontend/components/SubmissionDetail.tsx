'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { progressService } from '@/services/rubrics';

interface SubmissionDetailProps {
  submissionId: number;
}

export function SubmissionDetail({ submissionId }: SubmissionDetailProps) {
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubmissionData();
  }, [submissionId, token]);

  const loadSubmissionData = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await progressService.getSubmissionComplete(submissionId, token);
      setData(response);
    } catch (error) {
      console.error('Error loading submission:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4">Cargando...</div>;

  if (!data) return <div className="p-4">No se encontraron datos</div>;

  const { submission, student, evaluation, observations, rubric } = data;

  return (
    <div className="space-y-6">
      {/* Datos del estudiante */}
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center gap-4">
          {student.avatar_path && (
            <img
              src={student.avatar_path}
              alt={student.full_name}
              className="w-12 h-12 rounded-full"
            />
          )}
          <div>
            <h2 className="text-lg font-bold">{student.full_name}</h2>
            <p className="text-sm text-gray-600">{student.email}</p>
          </div>
        </div>
      </div>

      {/* Video/Media */}
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <h3 className="font-semibold mb-3">Evidencia</h3>
        {submission.media_path && (
          <video
            src={submission.media_path}
            controls
            className="w-full max-h-96 rounded bg-black"
          />
        )}
        <p className="text-xs text-gray-500 mt-2">
          Enviado: {new Date(submission.created_at).toLocaleString()}
        </p>
      </div>

      {/* Rúbrica y Evaluación */}
      {rubric && (
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <h3 className="font-semibold mb-4">Rúbrica - {rubric.max_score} pts</h3>
          <div className="space-y-4">
            {rubric.criteria?.map((criteria: any) => {
              const score = evaluation?.criterion_scores?.find(
                (s: any) => s.rubric_criteria_id === criteria.id
              );
              const selectedLevel = criteria.levels?.find(
                (l: any) => l.id === score?.rubric_level_id
              );

              return (
                <div key={criteria.id} className="p-3 border border-gray-200 rounded">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium">{criteria.name}</h4>
                      <p className="text-xs text-gray-500">
                        Máximo: {criteria.max_points} pts
                      </p>
                    </div>
                    {score && (
                      <div className="text-right">
                        <p className="font-bold text-lg">{score.points_awarded}</p>
                        <p className="text-xs text-green-600 font-medium">
                          {selectedLevel?.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {!score && (
                    <p className="text-xs text-gray-400 italic">No evaluado</p>
                  )}
                </div>
              );
            })}
          </div>

          {evaluation && (
            <div className="mt-4 p-3 bg-blue-50 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Puntuación Total</span>
                <span className="text-2xl font-bold">{evaluation.total_score}</span>
              </div>
              <div className="w-full bg-gray-200 rounded h-3">
                <div
                  className="bg-green-600 h-3 rounded transition-all"
                  style={{
                    width: `${Math.min(
                      (evaluation.total_score / rubric.max_score) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {((evaluation.total_score / rubric.max_score) * 100).toFixed(1)}%
              </p>
            </div>
          )}

          {evaluation?.notes && (
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <h4 className="font-semibold mb-2">Notas del Terapeuta</h4>
              <p className="text-sm text-gray-700">{evaluation.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Observaciones */}
      {observations && observations.length > 0 && (
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <h3 className="font-semibold mb-3">Observaciones</h3>
          <div className="space-y-3">
            {observations.map((obs: any) => (
              <div key={obs.id} className="p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-700">{obs.text}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(obs.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
