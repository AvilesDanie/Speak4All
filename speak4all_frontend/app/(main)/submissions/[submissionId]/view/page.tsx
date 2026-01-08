'use client';

import { SubmissionDetail } from '@/components/SubmissionDetail';
import { EvaluationForm } from '@/components/EvaluationForm';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { progressService, evaluationService } from '@/services/rubrics';

interface SubmissionViewPageProps {
  params: { submissionId: string; courseExerciseId: string };
}

export default function SubmissionViewPage({
  params,
}: SubmissionViewPageProps) {
  const { token, user } = useAuth();
  const submissionId = parseInt(params.submissionId);
  const courseExerciseId = parseInt(params.courseExerciseId);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [checkingEval, setCheckingEval] = useState(true);

  useEffect(() => {
    checkEvaluation();
  }, [submissionId, token]);

  const checkEvaluation = async () => {
    if (!token) return;

    try {
      setCheckingEval(true);
      const evaluationData = await evaluationService.getEvaluationBySubmission(submissionId, token);
      setEvaluation(evaluationData);
    } catch (error) {
      console.error('Error checking evaluation:', error);
    } finally {
      setCheckingEval(false);
    }
  };

  const isTherapist = user?.role === 'THERAPIST';

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Detalles de Entrega</h1>

      <SubmissionDetail submissionId={submissionId} />

      {/* Mostrar formulario de evaluación solo si es terapeuta y no hay evaluación */}
      {isTherapist && !evaluation && !checkingEval && (
        <div className="mt-8 pt-8 border-t">
          <h2 className="text-xl font-bold mb-4">Crear Evaluación</h2>
          <EvaluationForm
            submissionId={submissionId}
            courseExerciseId={courseExerciseId}
            onSubmit={checkEvaluation}
          />
        </div>
      )}
    </div>
  );
}
