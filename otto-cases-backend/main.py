import os
import json
import io
import firebase_init # Initializes Firebase
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import AsyncOpenAI
from prompts.system_prompt import SYSTEM_PROMPT
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

load_dotenv()

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI(title="OTTO CASES API", version="1.0.0")

def load_directory_text(dir_path: str) -> str:
    content = ""
    if os.path.exists(dir_path):
        for filename in os.listdir(dir_path):
            if filename.endswith(".txt") or filename.endswith(".md") or filename.endswith(".json"):
                if filename.upper() == "README.MD":
                    continue
                file_path = os.path.join(dir_path, filename)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content += f"--- {filename} ---\n{f.read()}\n\n"
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")
    return content

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://pwa.otto.med.br",
        "https://cases.otto.med.br",
        "https://ottomed.com.br",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
    allow_headers=["Authorization","Content-Type"],
)

class CaseInput(BaseModel):
    authorName: str
    institution: str
    patientAge: str
    patientGender: str
    complaint: str
    history: str
    physicalExam: str
    diagnostics: str
    intervention: str
    outcome: str
    keywords: str
    isSurgical: bool = False
    clavienDindo: str = ""
    imageUrls: list[str] = []

class PosterInput(BaseModel):
    title: str
    authorName: str
    institution: str
    posterContent: str
    width: str = "1080"
    height: str = "1920"

from auth_deps import get_current_user
from fastapi import Depends
from routers import cases

app.include_router(cases.router)

@app.get("/")
def read_root():
    return {"status": "OTTO CASES Backend is running"}

@app.get("/api/me")
def read_me(user=Depends(get_current_user)):
    return user

@app.post("/api/generate-case")
async def generate_case(case_data: CaseInput):
    try:
        knowledge_text = load_directory_text("knowledge")
        few_shots_text = load_directory_text("few_shots")
        
        system_context = SYSTEM_PROMPT
        if knowledge_text:
            system_context += f"\n\n[DIRETRIZES DA LITERATURA ORL RECENTE]\nUtilize o embasamento teórico a seguir como fonte absoluta de suporte técnico:\n{knowledge_text}"
        if few_shots_text:
            system_context += f"\n\n[EXEMPLOS DE REDAÇÃO PADRÃO OURO PARA INSPIRAÇÃO DE ESTILO]\nMolde o estilo, formatação e escolha de palavras rigorosamente baseado nestes exemplos:\n{few_shots_text}"

        user_prompt = f"Dados do Caso Clínico:\n{case_data.model_dump_json(indent=2)}\n\nPor favor, retorne o JSON estruturado conforme as instruções do sistema."
        
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_context},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.7
        )
        
        result_content = response.choices[0].message.content
        result_json = json.loads(result_content)
        return result_json
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-poster-pdf")
async def generate_poster_pdf(poster_data: PosterInput):
    try:
        # Load Jinja2 template
        env = Environment(loader=FileSystemLoader("templates"))
        template = env.get_template("poster.html")
        
        # Render HTML with variables
        html_out = template.render(
            title=poster_data.title,
            authorName=poster_data.authorName,
            institution=poster_data.institution,
            posterContent=poster_data.posterContent.replace('\n', '<br>'),
            width=poster_data.width,
            height=poster_data.height
        )
        
        # Convert to PDF
        pdf_bytes = HTML(string=html_out).write_pdf()
        
        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(pdf_bytes), 
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=poster_{poster_data.authorName.replace(' ', '_')}.pdf"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0", port=8000, reload=True)
