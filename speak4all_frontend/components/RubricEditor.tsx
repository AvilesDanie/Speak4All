'use client';

import { useState } from 'react';
import { useRubric } from '@/hooks/useRubric';
import { useAuth } from '@/hooks/useAuth';
import { rubricService } from '@/services/rubrics';

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

interface RubricEditorProps {
  courseExerciseId: number;
  onSave?: () => void;
}

export function RubricEditor({ courseExerciseId, onSave }: RubricEditorProps) {
  const { rubric, loading, refetch } = useRubric(courseExerciseId);
  const { token } = useAuth();
  const typedRubric = rubric as Rubric | null;
  const [newCriteriaName, setNewCriteriaName] = useState('');
  const [newCriteriaPoints, setNewCriteriaPoints] = useState(25);
  const [maxScore, setMaxScore] = useState(100);

  const handleAddCriteria = async () => {
    if (!newCriteriaName || !token) return;

    try {
      await rubricService.addCriteria(
        courseExerciseId,
        {
          name: newCriteriaName,
          max_points: newCriteriaPoints,
          order: (typedRubric?.criteria?.length || 0),
          levels: [
            { name: 'Excelente', points: newCriteriaPoints, order: 3 },
            { name: 'Bueno', points: Math.floor(newCriteriaPoints * 0.8), order: 2 },
            { name: 'Aceptable', points: Math.floor(newCriteriaPoints * 0.6), order: 1 },
            { name: 'Insuficiente', points: 0, order: 0 },
          ],
        },
        token
      );
      setNewCriteriaName('');
      setNewCriteriaPoints(25);
      await refetch();
      onSave?.();
    } catch (error) {
      console.error('Error adding criteria:', error);
    }
  };

  const handleUpdateMaxScore = async () => {
    if (!token) return;

    try {
      await rubricService.updateRubric(courseExerciseId, { max_score: maxScore }, token);
      await refetch();
      onSave?.();
    } catch (error) {
      console.error('Error updating max score:', error);
    }
  };

  if (loading) return <div className="p-4">Cargando rúbrica...</div>;

  if (!typedRubric) return <div className="p-4">Rúbrica no disponible</div>;

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Editor de Rúbrica</h2>

      {/* Puntuación máxima */}
      <div className="mb-6 p-4 bg-blue-50 rounded">
        <label className="block text-sm font-medium mb-2">
          Puntuación Máxima
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={maxScore}
            onChange={(e) => setMaxScore(parseInt(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2 w-32"
          />
          <button
            onClick={handleUpdateMaxScore}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Criterios */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Criterios</h3>
        <div className="space-y-3">
          {typedRubric.criteria?.map((criteria) => (
            <div key={criteria.id} className="p-3 border border-gray-200 rounded">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium">{criteria.name}</h4>
                  <p className="text-sm text-gray-600">{criteria.max_points} pts máximo</p>
                  <div className="mt-2 space-y-1">
                    {criteria.levels?.map((level) => (
                      <div
                        key={level.id}
                        className="text-xs text-gray-500"
                      >
                        • {level.name}: {level.points} pts
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agregar criterio */}
      <div className="p-4 bg-gray-50 rounded">
        <h3 className="text-sm font-semibold mb-3">Agregar Criterio</h3>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Nombre del criterio"
            value={newCriteriaName}
            onChange={(e) => setNewCriteriaName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          <input
            type="number"
            placeholder="Puntos máximos"
            value={newCriteriaPoints}
            onChange={(e) => setNewCriteriaPoints(parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          <button
            onClick={handleAddCriteria}
            className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Agregar Criterio
          </button>
        </div>
      </div>
    </div>
  );
}
