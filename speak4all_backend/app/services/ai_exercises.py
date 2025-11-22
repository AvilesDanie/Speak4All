# app/services/ai_exercises.py
import os, re, subprocess, tempfile
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# === CONFIG (todas desde .env si quieres) ===
OPENAI_MODEL      = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_TTS_MODEL  = os.getenv("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
VOICE_NAME        = os.getenv("TTS_VOICE_NAME", "verse")  # alloy, coral, shimmer, fable, verse, etc.
SAMPLE_RATE       = int(os.getenv("AUDIO_RATE", "44100"))
BITRATE           = os.getenv("BITRATE", "192k")

# Pausas globales
PAUSA_BLOQUE_S    = float(os.getenv("PAUSA_BLOQUE_S", "1.0"))   # pausa breve entre bloques "normales"

# Heurística para pausa automática de [REP] sin duración:
REP_BASE_S        = float(os.getenv("REP_BASE_S", "0.8"))       # base
REP_POR_PAL_S     = float(os.getenv("REP_POR_PAL_S", "0.45"))   # por palabra (~sílabas)
REP_MAX_S         = float(os.getenv("REP_MAX_S", "3.5"))        # límite superior

client = OpenAI()

# ========= 1) Generar texto con marcadores [REP]...[/REP] =========

SYSTEM_RULES = (
    "Eres un terapeuta del habla. Escribe el guion del ejercicio en español, claro, "
    "en texto plano (sin markdown). IMPORTANTE: cada fragmento que el niño deba repetir "
    "después de escuchar, ENMÁRCALO con [REP] ... [/REP]. "
    "Si es útil, puedes especificar segundos en el marcador así: [REP 2.0] ... [/REP]. "
    "Demostraciones o ejemplos que no deban ser repetidos, NO los marques. "
    "Saluda brevemente al inicio, explica qué va a hacer el niño, y despide al final. "
    "Sugiere que puede pausar el audio si necesita más tiempo. No pidas feedback."
)

def generate_marked_text_from_prompt(therapist_prompt: str) -> str:
    """
    Usa IA para generar el guion con marcadores [REP]...[/REP].
    """
    r = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_RULES},
            {"role": "user", "content": therapist_prompt},
        ],
        temperature=0.6,
        max_tokens=700,
    )
    return r.choices[0].message.content.strip()


# ========= 2) Eliminar [REP] para mostrar texto limpio al usuario =========

REP_PATTERN = re.compile(
    r"\[REP(?:\s+([0-9]+(?:\.[0-9]+)?))?\](.+?)\[/REP\]",
    flags=re.I | re.S
)

def strip_rep_tags(marked_text: str) -> str:
    """
    Devuelve el mismo guion pero sin [REP] ni [/REP].
    Solo deja el texto interno.
    """
    def _repl(m: re.Match) -> str:
        inner = m.group(2) or ""
        return inner.strip()

    cleaned = REP_PATTERN.sub(_repl, marked_text)
    # Limpieza suave de espacios dobles y saltos extra
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    cleaned = re.sub(r'[ \t]{2,}', ' ', cleaned)
    return cleaned.strip()


# ========= 3) Split en segmentos (bloques normales y REP con pausas) =========

def split_into_segments(marked_text: str):
    """
    Devuelve lista de segmentos:
      { 'type': 'rep'|'block', 'text': str, 'pause': float }

    Mejora:
    - Normaliza saltos de línea: cualquier cosa como \n\n\n\n se reduce a \n\n.
    - Junta líneas dentro de un párrafo.
    - Ignora bloques que no tengan texto “real” (solo puntos, espacios, etc.).
    """
    # Normalizar saltos de línea (evita bloques vacíos raros)
    text = marked_text.replace("\r\n", "\n")
    text = re.sub(r"\n{2,}", "\n\n", text)  # cualquier secuencia larga -> exactamente dos \n

    segments: list[dict] = []
    pos = 0

    def add_block_chunk(chunk: str):
        """
        Toma un trozo de texto normal (sin [REP]) y lo parte en párrafos.
        Cada párrafo se convierte en un bloque 'block' si tiene texto real.
        """
        chunk = chunk.strip()
        if not chunk:
            return

        # separamos por párrafos (doble salto de línea o más)
        paras = re.split(r"\n\s*\n+", chunk)
        for para in paras:
            para = para.strip()
            if not para:
                continue

            # junta líneas dentro del párrafo en una sola línea
            para = " ".join(para.splitlines()).strip()

            # si no contiene ninguna palabra (solo signos) la saltamos
            if not re.search(r"\w", para, flags=re.UNICODE):
                continue

            segments.append({
                "type": "block",
                "text": para,
                "pause": PAUSA_BLOQUE_S,
            })

    # Recorremos todos los [REP]...[/REP]
    for m in REP_PATTERN.finditer(text):
        start, end = m.span()

        # 1) Bloque normal antes del [REP]
        before = text[pos:start]
        add_block_chunk(before)

        # 2) Fragmento REP
        dur = m.group(1)          # segundos opcionales [REP 2.0]
        rep_text = (m.group(2) or "").strip()

        if dur:
            pause_val = max(0.2, float(dur))
        else:
            # pausa heurística según nº de palabras
            n_words = max(1, len(re.findall(r"\w+", rep_text, flags=re.UNICODE)))
            pause_val = min(REP_MAX_S, REP_BASE_S + REP_POR_PAL_S * n_words)

        segments.append({
            "type": "rep",
            "text": rep_text,
            "pause": pause_val,
        })

        pos = end

    # Cola final después del último [REP]
    tail = text[pos:]
    add_block_chunk(tail)

    return segments



# ========= 4) Utilidades TTS =========

def tts_to_wav(text: str, out_wav: Path):
    with client.audio.speech.with_streaming_response.create(
        model=OPENAI_TTS_MODEL,
        voice=VOICE_NAME,
        input=text,
        response_format="wav",
        instructions="Español neutro latino, cálido y pausado; dicción clara y amable.",
    ) as resp:
        resp.stream_to_file(str(out_wav))


def gen_silence(seconds: float, out_wav: Path):
    cmd = [
        "ffmpeg","-y",
        "-f","lavfi","-t", f"{seconds}",
        "-i", f"anullsrc=r={SAMPLE_RATE}:cl=mono",
        "-ar", str(SAMPLE_RATE), "-ac","1",
        str(out_wav)
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def ensure_wav(src: Path, out_wav: Path):
    cmd = ["ffmpeg","-y","-i",str(src), "-ar", str(SAMPLE_RATE), "-ac","1", str(out_wav)]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def concat_to_mp3(wavs: list[Path], out_mp3: Path):
    valid = [w for w in wavs if w.exists() and w.stat().st_size > 2000]
    if not valid:
        raise RuntimeError("No hay fragmentos válidos para concatenar.")

    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".txt", encoding="utf-8") as lst:
        for w in valid:
            lst.write(f"file '{w.as_posix()}'\n")
        lst_path = lst.name.replace("\\", "/")

    cmd = [
        "ffmpeg","-y",
        "-f","concat","-safe","0",
        "-i", lst_path,
        "-ar", str(SAMPLE_RATE), "-ac","1",
        "-af","loudnorm,highpass=f=120,lowpass=f=9000",
        "-c:a","libmp3lame","-b:a", BITRATE,
        str(out_mp3)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("❌ FFmpeg:", result.stderr[:800])
        raise RuntimeError("Fallo en la concatenación de audio.")


# ========= 5) Construcción del audio =========

def build_audio_from_marked_text(marked_text: str, base_dir: Path | None = None) -> str:
    """
    Genera el mp3 a partir del guion marcado con [REP].

    Devuelve una ruta **relativa** (por ejemplo "tts_build_.../exercise_....mp3")
    para guardar en la base de datos.
    """
    if base_dir is None:
        base_dir = Path.cwd()

    segments = split_into_segments(marked_text)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    workdir = base_dir / f"tts_build_{ts}"
    tmp = workdir / "tmp"
    tmp.mkdir(parents=True, exist_ok=True)

    chain: list[Path] = []

    for i, seg in enumerate(segments, start=1):
        seg_wav = tmp / f"seg_{i:03d}.wav"
        tts_to_wav(seg['text'], seg_wav)
        chain.append(seg_wav)

        pause = max(0.0, float(seg['pause']))
        if pause > 0:
            sil = tmp / f"sil_{i:03d}.wav"
            gen_silence(pause, sil)
            chain.append(sil)

    # normalizar a wav mono
    norm: list[Path] = []
    for i, wav in enumerate(chain):
        n = tmp / f"n_{i:03d}.wav"
        ensure_wav(wav, n)
        norm.append(n)

    out_mp3 = workdir / f"exercise_{ts}_marcado_con_pausas.mp3"
    concat_to_mp3(norm, out_mp3)

    # devolvemos ruta relativa
    rel_path = out_mp3.relative_to(base_dir)
    return str(rel_path)
