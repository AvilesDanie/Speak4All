'use client';

import { useState, useEffect } from 'react';

interface RubricLevel {
  id: number;
  name: string;
  description: string;
  points: number;
  order?: number;
}

interface RubricCriterion {
  id: number;
  name: string;
  description?: string;
  max_points: number;
  order?: number;
  levels: RubricLevel[];
}

interface RubricDisplayProps {
  rubric: {
    id: number;
    max_score: number;
    criteria: RubricCriterion[];
  } | null;
  evaluation?: {
    id?: number;
    total_score: number;
    notes?: string | null;
    criterion_scores: Array<{
      rubric_criteria_id: number;
      rubric_level_id: number;
      points_awarded: number;
    }>;
  } | null;
}

export function RubricDisplay({ rubric, evaluation }: RubricDisplayProps) {
  if (!rubric) return <p className="text-600">Rúbrica no disponible</p>;

  const getSelectedLevel = (criterionId: number) => {
    if (!evaluation) return null;
    const score = evaluation.criterion_scores.find(
      (s) => s.rubric_criteria_id === criterionId
    );
    return score;
  };

  return (
    <div className="space-y-4">
      {/* Información general */}
      <div className="p-4 bg-gray-50 border rounded">
        <p className="text-sm text-gray-600">
          <strong>Puntuación máxima:</strong> {rubric.max_score} puntos
        </p>
        {evaluation && (
          <p className="text-sm text-gray-600 mt-2">
            <strong>Puntuación obtenida:</strong>{' '}
            <span className="text-lg font-bold text-blue-600">{evaluation.total_score}</span> / {rubric.max_score}
          </p>
        )}
      </div>

      {/* Criterios */}
      <div className="space-y-3">
        {rubric.criteria.map((criterion) => {
          const selectedScore = getSelectedLevel(criterion.id);
          const percentage = evaluation
            ? (selectedScore?.points_awarded || 0) / criterion.max_points * 100
            : 0;

          return (
            <div key={criterion.id} className="border rounded p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold">{criterion.name}</h4>
                  <p className="text-sm text-gray-600">Máximo: {criterion.max_points} puntos</p>
                </div>
                {evaluation && (
                  <div className="text-right">
                    <p className="font-bold text-blue-600">
                      {selectedScore?.points_awarded || 0} / {criterion.max_points}
                    </p>
                    <div className="w-32 h-2 bg-gray-200 rounded mt-1 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Niveles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {criterion.levels
                  .slice()
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((level) => {
                    const isSelected = selectedScore?.rubric_level_id === level.id;

                    return (
                      <div
                        key={level.id}
                        className={`p-2 border rounded text-sm ${
                          isSelected
                            ? 'bg-blue-100 border-blue-500'
                            : 'bg-white border-gray-300'
                        }`}
                      >
                        <div className="font-semibold">
                          {level.name}: {level.points} puntos
                          {isSelected && <span className="ml-2">✓</span>}
                        </div>
                        <p className="text-gray-700 mt-1">{level.description}</p>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
