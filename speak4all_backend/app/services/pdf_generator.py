# app/services/pdf_generator.py
"""
Servicio para generar PDFs interactivos de ejercicios.
Usa FPDF para crear PDFs de manera multiplataforma.
"""

import io
import os
from datetime import datetime, timezone
from fpdf import FPDF
import qrcode
from app.services.storage import upload_fileobj


def generate_exercise_pdf(
    exercise_name: str,
    exercise_text: str,
    exercise_prompt: str | None = None,
    audio_url: str | None = None,
) -> bytes:
    """
    Genera un PDF interactivo con el contenido del ejercicio.
    
    Args:
        exercise_name: Nombre del ejercicio
        exercise_text: Texto del ejercicio (sin marcadores [REP])
        exercise_prompt: Objetivo/prompt del ejercicio (opcional)
        audio_url: URL del audio para generar QR code (opcional)
    
    Returns:
        Bytes del PDF generado
    """
    
    try:
        # Crear PDF simple
        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)
        
        # Título principal
        pdf.set_font('Helvetica', 'B', 20)
        pdf.set_text_color(79, 70, 229)  # Azul indigo
        pdf.cell(0, 10, exercise_name, 0, 1, 'C')
        pdf.set_text_color(0, 0, 0)
        
        # Subtítulo (objetivo)
        if exercise_prompt:
            pdf.set_font('Helvetica', 'I', 11)
            pdf.set_text_color(100, 100, 100)
            pdf.multi_cell(0, 5, exercise_prompt)
            pdf.ln(3)
        
        pdf.ln(2)
        
        # Línea separadora
        pdf.set_draw_color(79, 70, 229)
        pdf.line(15, pdf.get_y(), 195, pdf.get_y())
        pdf.ln(3)
        
        # Instrucciones
        pdf.set_font('Helvetica', 'B', 11)
        pdf.cell(0, 6, 'Instrucciones:', 0, 1)
        pdf.set_font('Helvetica', '', 10)
        pdf.multi_cell(0, 5, 
            'Lee el texto del ejercicio. Escucha el audio de referencia y practica '
            'según las indicaciones. Puedes pausar o repetir el audio las veces que necesites.')
        pdf.ln(2)
        
        # Texto del ejercicio
        pdf.set_font('Helvetica', 'B', 11)
        pdf.cell(0, 6, 'Texto del Ejercicio:', 0, 1)
        pdf.set_font('Helvetica', '', 10)
        
        # Procesar el texto
        for line in exercise_text.split('\n'):
            clean_line = line.strip()
            if clean_line:
                pdf.multi_cell(0, 5, clean_line)
            else:
                pdf.ln(1)
        
        pdf.ln(2)
        
        # Consejos
        pdf.set_font('Helvetica', 'B', 11)
        pdf.cell(0, 6, 'Consejos para practicar:', 0, 1)
        pdf.set_font('Helvetica', '', 10)
        
        tips = [
            "Escucha con atención el audio de referencia",
            "Practica a tu propio ritmo",
            "No dudes en repetir varias veces",
            "Intenta imitar la pronunciación lo más posible"
        ]
        
        for tip in tips:
            pdf.cell(5, 5, '-', 0, 0)
            pdf.multi_cell(0, 5, tip)
        
        pdf.ln(3)
        
        # QR Code para acceder al audio (si hay URL disponible)
        if audio_url:
            pdf.set_font('Helvetica', 'B', 11)
            pdf.cell(0, 6, 'Audio de Referencia:', 0, 1)
            pdf.set_font('Helvetica', '', 10)
            pdf.cell(0, 4, 'Escanea el codigo QR para acceder al audio:', 0, 1)
            pdf.ln(1)
            
            # Generar QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=5,
                border=1,
            )
            qr.add_data(audio_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="black", back_color="white")
            
            # Convertir QR a bytes
            qr_bytes = io.BytesIO()
            qr_img.save(qr_bytes, format='PNG')
            qr_bytes.seek(0)
            
            # Insertar QR en el PDF (tamaño 40x40 mm, centrado)
            qr_path = 'temp_qr.png'
            with open(qr_path, 'wb') as f:
                f.write(qr_bytes.getvalue())
            
            # Centrar QR
            pdf.image(qr_path, x=85, y=pdf.get_y(), w=40, h=40)
            pdf.ln(42)
            
            # Limpiar archivo temporal
            os.remove(qr_path)
        
        pdf.ln(2)
        
        # Footer
        pdf.set_font('Helvetica', 'I', 8)
        pdf.set_text_color(150, 150, 150)
        timestamp = datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')
        pdf.cell(0, 4, f'Generado: {timestamp}', 0, 1, 'C')
        pdf.cell(0, 4, 'Speak4All - Plataforma de Terapia del Habla', 0, 1, 'C')
        
        # Obtener bytes del PDF
        # Usar dest='S' para obtener el PDF como string en lugar de imprimir a stdout
        pdf_output = pdf.output(dest='S')
        
        # Convertir string a bytes usando latin-1 encoding (como FPDF lo genera)
        if isinstance(pdf_output, str):
            pdf_bytes = pdf_output.encode('latin-1')
        else:
            pdf_bytes = pdf_output
        
        return pdf_bytes
        
    except Exception as e:
        raise Exception(f"Error al generar el PDF: {str(e)}")


def upload_exercise_pdf_to_storage(
    pdf_bytes: bytes,
    exercise_id: int,
    exercise_name: str,
) -> str:
    """
    Sube el PDF generado a Google Cloud Storage.
    
    Args:
        pdf_bytes: Bytes del PDF
        exercise_id: ID del ejercicio
        exercise_name: Nombre del ejercicio (para el nombre del archivo)
    
    Returns:
        blob_name (ruta en el storage)
    """
    
    try:
        # Crear nombre descriptivo del archivo
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
        safe_name = exercise_name.replace(' ', '_')[:50]
        filename = f"{exercise_id}_{safe_name}_{timestamp}.pdf"
        destination_blob_name = f"exercises/{exercise_id}/pdf/{filename}"
        
        # Convertir bytes a file object y asegurar que está al inicio
        pdf_file_obj = io.BytesIO(pdf_bytes)
        pdf_file_obj.seek(0)  # Asegurar que el cursor está al inicio
        
        # Subir a storage
        blob_name = upload_fileobj(
            pdf_file_obj,
            destination_blob_name,
            content_type="application/pdf"
        )
        
        return blob_name
    except Exception as e:
        raise Exception(f"Error al subir el PDF al almacenamiento: {str(e)}")



