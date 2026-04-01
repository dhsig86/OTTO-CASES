import os
import json
import io
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

class PosterInput(BaseModel):
    title: str
    authorName: str
    institution: str
    posterContent: str
    width: str = "1080"
    height: str = "1920"

@app.get("/")
def read_root():
    return {"status": "OTTO CASES Backend is running"}

@app.post("/api/generate-case")
async def generate_case(case_data: CaseInput):
    try:
        user_prompt = f"Dados do Caso Clínico:\n{case_data.model_dump_json(indent=2)}\n\nPor favor, retorne o JSON estruturado conforme as instruções do sistema."
        
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
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
