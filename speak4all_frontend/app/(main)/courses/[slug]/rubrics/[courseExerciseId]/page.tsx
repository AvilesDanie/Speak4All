'use client';

import { RubricEditor } from '@/components/RubricEditor';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRubric } from '@/hooks/useRubric';

interface RubricPageProps {
  params: { courseExerciseId: string };
}

export default function RubricPage({ params }: RubricPageProps) {
  const { token, user } = useAuth();
  const courseExerciseId = parseInt(params.courseExerciseId);
  const { rubric, loading, error } = useRubric(courseExerciseId);

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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <p className="text-gray-600">Cargando rúbrica...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <p className="text-red-600">Error al cargar la rúbrica: {error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Editar Rúbrica de Evaluación</h1>
      {rubric && (
        <RubricEditor courseExerciseId={courseExerciseId} />
      )}
    </div>
  );
}
