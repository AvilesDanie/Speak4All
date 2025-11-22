import { Slider } from 'primereact/slider';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import React, { useEffect, useRef, useState } from 'react';


interface AudioPlayerProps {
    src: string;
}

const formatTime = (seconds: number): string => {
    if (!seconds || Number.isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const speedOptions = [
    { label: '0.25x', value: 0.25 },
    { label: '0.50x', value: 0.50 },
    { label: '0.75x', value: 0.75 },
    { label: '1x', value: 1 },
    { label: '1.25x', value: 1.25 },
    { label: '1.5x', value: 1.5 },
    { label: '2x', value: 2 },
];

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const [volume, setVolume] = useState(80);         // 0–100
    const [playbackRate, setPlaybackRate] = useState(1); // 1x por defecto
    const [showOptions, setShowOptions] = useState(false);
    const [loop, setLoop] = useState(false);

    // Cargar duración
    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration || 0);
        }
    };



    const downloadFile = async () => {
        try {
            const response = await fetch(src, {
                // si tu endpoint requiere auth, aquí pondrías headers
                // headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) {
                console.error('Error descargando audio:', response.statusText);
                return;
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = src.split("/").pop() || "audio.mp3";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error en descarga:', err);
        }
    };


    // Actualizar progreso
    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying((prev) => !prev);
    };

    const handleSeek = (value: number) => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = value;
        setCurrentTime(value);
    };

    const handleVolumeChange = (value: number) => {
        setVolume(value);
        if (audioRef.current) {
            audioRef.current.volume = value / 100;
        }
    };


    const handleSpeedChange = (value: number) => {
        setPlaybackRate(value);
        if (audioRef.current) {
            audioRef.current.playbackRate = value;
        }
    };

    // Reset si cambia la URL
    useEffect(() => {
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setVolume(80);
        setPlaybackRate(1);
        setLoop(false);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.volume = 0.8;
            audioRef.current.playbackRate = 1;
            audioRef.current.loop = false;
        }
    }, [src]);

    // Aplicar loop cuando cambie
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.loop = loop;
        }
    }, [loop]);

    return (
        <div className="surface-card border-round-2xl p-3 flex flex-column gap-3 shadow-2">
            {/* Barra principal: play + progreso + tiempos */}
            <div className="flex align-items-center gap-3">
                <Button
                    type="button"
                    icon={isPlaying ? 'pi pi-pause' : 'pi pi-play'}
                    className="p-button-rounded p-button-sm"
                    onClick={togglePlay}
                />

                <div className="flex-1 flex flex-column gap-1">
                    <Slider
                        value={currentTime}
                        onChange={(e) => handleSeek(e.value as number)}
                        min={0}
                        max={duration || 0}
                    />
                    <div className="flex justify-content-between text-xs text-600">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
            </div>

            {/* Controles secundarios: volumen, velocidad, opciones */}
            <div className="flex flex-wrap gap-3 align-items-center justify-content-between">
                {/* Volumen */}
                <div className="flex align-items-center gap-2" style={{ minWidth: '160px' }}>
                    <i
                        className={`pi ${volume === 0 ? 'pi-volume-off' : volume < 50 ? 'pi-volume-down' : 'pi-volume-up'
                            } text-600`}
                    />
                    <Slider
                        value={volume}
                        onChange={(e) => handleVolumeChange(e.value as number)}
                        min={0}
                        max={100}
                        style={{ width: '120px' }}
                    />
                </div>

                {/* Velocidad con slider */}
                <div
                    className="flex flex-column gap-2"
                    style={{ minWidth: '200px', maxWidth: '260px' }}
                >
                    <div className="flex flex-column gap-2" style={{ minWidth: '240px' }}>
                        <div className="flex justify-content-between align-items-center">
                            <span className="text-xs text-600">Velocidad</span>
                            <span className="text-xs font-semibold">
                                {playbackRate.toFixed(2)}x
                            </span>
                        </div>

                        <Slider
                            value={playbackRate}
                            onChange={(e) => handleSpeedChange(e.value as number)}
                            min={0.5}
                            max={2}
                            step={0.05}
                        />

                        <Dropdown
                            value={playbackRate}
                            options={speedOptions}
                            onChange={(e) => handleSpeedChange(e.value)}
                            className="p-inputtext-sm"
                            style={{ width: '110px' }}
                        />
                    </div>

                </div>


                

                {/* Opciones */}
                <div className="flex align-items-center gap-2 ml-auto">
                    <Button
                        type="button"
                        icon="pi pi-cog"
                        className="p-button-rounded p-button-text p-button-sm"
                        onClick={() => setShowOptions((v) => !v)}
                    />
                </div>
            </div>

            {showOptions && (
                <div className="border-top-1 surface-border pt-2 flex flex-wrap gap-3 justify-content-between text-sm">

                    <div
                        className="flex align-items-center gap-2 cursor-pointer"
                        onClick={() => setLoop((v) => !v)}
                    >
                        <i className={`pi ${loop ? 'pi-check-circle text-primary' : 'pi-circle-off text-400'}`} />
                        <span>Repetir en bucle</span>
                    </div>

                    <Button
                        type="button"
                        icon="pi pi-download"
                        label="Descargar"
                        className="p-button-text p-button-sm"
                        onClick={downloadFile}
                    />
                </div>
            )}


            {/* Audio real (oculto) */}
            <audio
                ref={audioRef}
                src={src}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
            />
        </div>
    );
};

export default AudioPlayer;