import os
import json
import base64
import pypdfium2
import logging
import re
from fastapi import FastAPI, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from openai import OpenAI
from dotenv import load_dotenv
from io import BytesIO

# Cargar variables de entorno
load_dotenv()

# Configurar FastAPI
app = FastAPI()

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configurar OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clean_number(value):
    """Limpia y convierte un string numérico a float"""
    try:
        if isinstance(value, (int, float)):
            return float(value)
        # Eliminar símbolos de moneda y espacios
        cleaned = value.replace('S/', '').replace('$', '').strip()
        # Eliminar comas y convertir a float
        cleaned = cleaned.replace(',', '')
        return float(cleaned)
    except (ValueError, AttributeError):
        return 0.0

def generate_speech(text):
    """Genera audio a partir de texto usando OpenAI TTS"""
    try:
        response = client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=text
        )
        temp_file = f"temp_audio_{os.urandom(8).hex()}.mp3"
        response.stream_to_file(temp_file)
        return temp_file
    except Exception as e:
        logger.error(f"Error generando audio: {str(e)}")
        return None

def analyze_image_base64(base64_image):
    """Analizar imagen usando OpenAI Vision"""
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Analiza esta factura y extrae SOLO los siguientes campos exactos en formato JSON: "
                                  "Fecha_emision, Nombre_proveedor, RUC_proveedor, Nro_factura, "
                                  "Fecha_vencimiento, Valor_Venta (sin símbolo de moneda ni comas), "
                                  "IGV (sin símbolo de moneda ni comas), Importe_Total (sin símbolo de moneda ni comas), "
                                  "Moneda (PEN o USD). Además, genera un resumen corto y claro."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=500
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error en análisis de imagen: {str(e)}")
        return None
@app.post("/chat")
async def chat_with_invoices(request: Request):
    try:
        data = await request.json()
        user_message = data.get('message', '')
        invoice_data = data.get('invoices', [])

        # Crear un contexto con la información de las facturas
        context = "Información de las facturas procesadas:\n"
        for inv in invoice_data:
            context += f"- Factura {inv['data']['Nro_factura']} de {inv['data']['Nombre_proveedor']}"
            context += f" por {inv['data']['Importe_Total']} emitida el {inv['data']['Fecha_emision']}\n"

        # Llamar a OpenAI con el contexto y la pregunta
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": """Eres un asistente especializado en análisis de facturas.
                 Debes proporcionar respuestas concisas y relevantes sobre la información de las facturas.
                 Utiliza un tono profesional pero amigable.
                 Si te preguntan por Miltondinho di que es un genio y un crack muy guapo pero es nerd"""},
                {"role": "user", "content": f"Contexto de las facturas:\n{context}\n\nPregunta del usuario: {user_message}"}
            ]
        )
        
        return JSONResponse(content={
            "response": response.choices[0].message.content
        })
    except Exception as e:
        logger.error(f"Error en chat: {str(e)}")
        return JSONResponse(
            content={"error": "Error procesando la consulta"},
            status_code=500
        )
@app.post("/process_invoice")
async def process_invoice(file: UploadFile = File(...)):
    try:
        logger.info(f"Procesando archivo: {file.filename}")
        content = await file.read()
        
        if not file.filename.lower().endswith('.pdf'):
            return JSONResponse(
                content={"error": "El archivo debe ser un PDF"},
                status_code=400
            )

        try:
            pdf = pypdfium2.PdfDocument(BytesIO(content))
            page = pdf[0]
            pil_image = page.render().to_pil()
            
            img_byte_array = BytesIO()
            pil_image.save(img_byte_array, format='PNG')
            base64_image = base64.b64encode(img_byte_array.getvalue()).decode('utf-8')
            
            analysis = analyze_image_base64(base64_image)
            
            if not analysis:
                return JSONResponse(
                    content={"error": "No se pudo analizar la imagen"},
                    status_code=500
                )

            try:
                # Extraer el JSON del texto
                json_match = re.search(r'\{.*\}', analysis, re.DOTALL)
                if not json_match:
                    raise ValueError("No se encontró JSON en la respuesta")
                
                json_data = json.loads(json_match.group())
                summary = analysis[json_match.end():].strip()

                # Limpiar valores monetarios
                monetary_fields = ['Valor_Venta', 'IGV', 'Importe_Total']
                for field in monetary_fields:
                    if field in json_data:
                        json_data[field] = clean_number(json_data[field])

                # Generar audio del resumen
                audio_file = None
                if summary:
                    audio_file = generate_speech(summary)
                    if audio_file:
                        audio_file = os.path.basename(audio_file)

                logger.info(f"Datos procesados exitosamente: {json_data}")
                return JSONResponse(content={
                    "status": "success",
                    "data": json_data,
                    "summary": summary,
                    "audio_file": audio_file
                })

            except json.JSONDecodeError as e:
                logger.error(f"Error decodificando JSON: {str(e)}")
                return JSONResponse(
                    content={"error": "Error procesando los datos extraídos"},
                    status_code=500
                )
            except ValueError as e:
                logger.error(f"Error de valor: {str(e)}")
                return JSONResponse(
                    content={"error": str(e)},
                    status_code=500
                )

        except Exception as e:
            logger.error(f"Error procesando PDF: {str(e)}")
            return JSONResponse(
                content={"error": "Error procesando el PDF"},
                status_code=500
            )

    except Exception as e:
        logger.error(f"Error general: {str(e)}")
        return JSONResponse(
            content={"error": "Error general procesando el archivo"},
            status_code=500
        )

@app.get("/audio/{filename}")
async def get_audio(filename: str):
    if os.path.exists(filename):
        return FileResponse(filename, media_type='audio/mpeg')
    return JSONResponse(
        content={"error": "Audio no encontrado"},
        status_code=404
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3090)