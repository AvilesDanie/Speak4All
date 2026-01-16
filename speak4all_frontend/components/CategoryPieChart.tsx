'use client';

import React from 'react';

interface CategoryPieChartProps {
    labels: string[];
    weights: number[]; // peso proporcional de cada categoría (cantidad de ejercicios)
    performances: number[]; // desempeño promedio de cada categoría
    colors: string[];
}

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({
    labels,
    weights,
    performances,
    colors,
}) => {
    if (!labels || labels.length === 0 || !weights || weights.length === 0) {
        return (
            <div
                style={{
                    height: '200px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#999',
                }}
            >
                Sin datos disponibles
            </div>
        );
    }

    // Función para convertir hex a rgba
    const hexToRgba = (hex: string, alpha: number = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            const r = parseInt(result[1], 16);
            const g = parseInt(result[2], 16);
            const b = parseInt(result[3], 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return hex; // fallback si no es hex
    };

    // Crear gradientes concéntricos
    let outerGradient = ''; // Fondo translúcido (peso total)
    let innerGradient = ''; // Frente sólido (desempeño)
    let currentPercent = 0;

    for (let i = 0; i < labels.length; i++) {
        const weight = weights[i];
        const performance = performances[i];
        const endPercent = currentPercent + weight;

        // Gradiente exterior (translúcido, muestra el peso)
        const pallid = hexToRgba(colors[i], 0.3);
        outerGradient += `${pallid} ${currentPercent}%, ${pallid} ${endPercent}%`;
        if (i < labels.length - 1) {
            outerGradient += ', ';
        }

        // Gradiente interior (sólido, muestra el desempeño ponderado)
        const performanceStart = currentPercent;
        const performanceEnd = currentPercent + (weight * performance) / 100;
        innerGradient += `${colors[i]} ${performanceStart}%, ${colors[i]} ${performanceEnd}%, transparent ${performanceEnd}%, transparent ${endPercent}%`;
        if (i < labels.length - 1) {
            innerGradient += ', ';
        }

        currentPercent = endPercent;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
            {/* Donut Chart with two layers */}
            <div style={{ position: 'relative', width: '200px', height: '200px' }}>
                {/* Background layer - translúcido (peso de categoría) */}
                <div
                    style={{
                        position: 'absolute',
                        width: '200px',
                        height: '200px',
                        borderRadius: '50%',
                        background: `conic-gradient(${outerGradient})`,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        border: '4px solid #ffffff',
                    }}
                />
                {/* Foreground layer - sólido (desempeño ponderado) */}
                <div
                    style={{
                        position: 'absolute',
                        width: '200px',
                        height: '200px',
                        borderRadius: '50%',
                        background: `conic-gradient(${innerGradient})`,
                    }}
                />
            </div>

            {/* Legend */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    width: '100%',
                }}
            >
                {labels.map((label, idx) => (
                    <div
                        key={idx}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '13px',
                            padding: '6px 0',
                        }}
                    >
                        <div
                            style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                backgroundColor: colors[idx],
                                flexShrink: 0,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            }}
                        />
                        <span style={{ flex: 1, fontWeight: '500' }}>{label}</span>
                        <span
                            style={{
                                fontWeight: 'bold',
                                minWidth: '50px',
                                textAlign: 'right',
                                color: colors[idx],
                                fontSize: '14px',
                            }}
                        >
                            {performances[idx]}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

