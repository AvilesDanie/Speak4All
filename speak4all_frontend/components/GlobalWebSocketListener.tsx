'use client';

/**
 * Componente que mantiene una conexión WebSocket global a todos los cursos del usuario
 * 
 * NOTA: Las notificaciones globales ahora se manejan en:
 * - GlobalSubmissionNotifier: Para notificaciones de entregas (terapeutas)
 * - GlobalExerciseNotifier: Para notificaciones de ejercicios (estudiantes)
 * 
 * Este componente ahora solo retorna null y se puede remover en el futuro
 */
export function GlobalWebSocketListener() {
    // Las notificaciones globales se manejan en componentes especializados
    return null;
}
