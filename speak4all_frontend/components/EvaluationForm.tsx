'use client';

import { useState } from 'react';
import { useRubric } from '@/hooks/useRubric';
import { useAuth } from '@/hooks/useAuth';
import { evaluationService } from '@/services/rubrics';

interface RubricLevel {
  id: number;
  level: number;
  name?: string;
  description: string;
  points: number;
}

interface RubricCriterion {
  id: number;
  name: string;
  max_points: number;
  levels: RubricLevel[];
}

interface Rubric {
  id: number;
  max_score: number;
  criteria: RubricCriterion[];
}

interface EvaluationFormProps {
  submissionId: number;
  courseExerciseId: number;
  onSubmit?: () => void;
}

export function EvaluationForm({
  submissionId,
  courseExerciseId,
  onSubmit,
}: EvaluationFormProps) {
  const { rubric, loading } = useRubric(courseExerciseId);
  const { token } = useAuth();
  const typedRubric = rubric as Rubric | null;
  const [selectedLevels, setSelectedLevels] = useState<{
    [key: number]: { levelId: number; points: number };
  }>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectLevel = (criteriaId: number, levelId: number, points: number) => {
    setSelectedLevels((prev) => ({
      ...prev,
      [criteriaId]: { levelId, points },
    }));
  };

  const handleSubmit = async () => {
    if (!typedRubric || !token) return;

    const criterionScores = typedRubric.criteria.map((criteria) => {
      const selection = selectedLevels[criteria.id];
      if (!selection) {
        throw new Error(`Debes seleccionar un nivel para ${criteria.name}`);
      }
      return {
        rubric_criteria_id: criteria.id,
        rubric_level_id: selection.levelId,
        points_awarded: selection.points,
      };
    });

    try {
      setSubmitting(true);
      await evaluationService.createEvaluation(
        {
          submission_id: submissionId,
          rubric_template_id: typedRubric.id,
          criterion_scores: criterionScores,
          notes: notes || undefined,
        },
        token
      );
      onSubmit?.();
    } catch (error) {
      console.error('Error creating evaluation:', error);
      setError(error instanceof Error ? error.message : 'Error creando evaluación');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Cargando rúbrica...</div>;

  if (!typedRubric) return <div>Rúbrica no disponible</div>;

  const allSelected = typedRubric.criteria.every((c) => selectedLevels[c.id]);
  const totalPoints = Object.values(selectedLevels).reduce((sum, s) => sum + s.points, 0);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Evaluar Entrega</h2>

      <div className="space-y-6">
        {typedRubric.criteria?.map((criteria) => (
          <div key={criteria.id} className="p-4 border border-gray-200 rounded">
            <h3 className="font-semibold mb-3">{criteria.name}</h3>
            <div className="space-y-2">
              {criteria.levels
                ?.sort((a, b) => b.points - a.points)
                .map((level) => (
                  <label key={level.id} className="flex items-center p-2 hover:bg-gray-50">
                    <input
                      type="radio"
                      name={`criteria-${criteria.id}`}
                      checked={selectedLevels[criteria.id]?.levelId === level.id}
                      onChange={() =>
                        handleSelectLevel(criteria.id, level.id, level.points)
                      }
                      className="mr-3"
                    />
                    <span className="flex-1">
                      {level.name} ({level.points} pts)
                    </span>
                    {level.description && (
                      <span className="text-xs text-gray-500 ml-2">
                        {level.description}
                      </span>
                    )}
                  </label>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Notas */}
      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">Notas (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observaciones generales sobre la evaluación..."
          className="w-full border border-gray-300 rounded px-3 py-2 h-24"
        />
      </div>

      {/* Resumen */}
      <div className="mt-6 p-4 bg-blue-50 rounded">
        <div className="flex justify-between items-center mb-3">
          <span className="font-medium">Puntuación Total</span>
          <span className="text-lg font-bold">
            {totalPoints}/{typedRubric.max_score} pts
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded h-2">
          <div
            className="bg-blue-600 h-2 rounded transition-all"
            style={{
              width: `${Math.min((totalPoints / typedRubric.max_score) * 100, 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Botones */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={!allSelected || submitting}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          {submitting ? 'Guardando...' : 'Guardar Evaluación'}
        </button>
      </div>

      {!allSelected && (
        <p className="mt-3 text-sm text-red-600">
          Debes seleccionar un nivel para cada criterio
        </p>
      )}

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
