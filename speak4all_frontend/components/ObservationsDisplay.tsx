'use client';

import { useState } from 'react';

interface Observation {
  id: number;
  text: string;
  created_at: string;
  therapist_name?: string;
  therapist_id?: number;
}

interface ObservationsDisplayProps {
  observations: Observation[];
  evaluationId?: number;
  isTherapist?: boolean;
  onAddObservation?: (text: string) => Promise<void>;
}

export function ObservationsDisplay({
  observations,
  evaluationId,
  isTherapist = false,
  onAddObservation,
}: ObservationsDisplayProps) {
  const [newObservation, setNewObservation] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddObservation = async () => {
    if (!newObservation.trim() || !onAddObservation) return;

    try {
      setAdding(true);
      await onAddObservation(newObservation);
      setNewObservation('');
    } catch (error) {
      console.error('Error adding observation:', error);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Observaciones</h3>

      {/* Formulario para agregar observaciones (solo si es terapeuta) */}
      {isTherapist && onAddObservation && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          <textarea
            value={newObservation}
            onChange={(e) => setNewObservation(e.target.value)}
            placeholder="Agrega una observación sobre el desempeño del estudiante..."
            disabled={adding}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            rows={3}
          />
          <button
            onClick={handleAddObservation}
            disabled={adding || !newObservation.trim()}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {adding ? 'Guardando...' : 'Agregar Observación'}
          </button>
        </div>
      )}

      {/* Listado de observaciones */}
      {observations && observations.length > 0 ? (
        <div className="space-y-3">
          {observations.map((obs) => (
            <div key={obs.id} className="p-4 border rounded bg-white">
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold text-gray-800">
                  {obs.therapist_name || `Terapeuta ${obs.therapist_id ?? ''}`.trim()}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(obs.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <p className="text-gray-700">{obs.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 text-sm">
          {isTherapist
            ? 'Sin observaciones aún. Agrega una arriba.'
            : 'El terapeuta aún no ha agregado observaciones.'}
        </p>
      )}
    </div>
  );
}
