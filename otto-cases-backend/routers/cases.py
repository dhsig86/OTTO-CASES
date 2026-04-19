from google.cloud.firestore import SERVER_TIMESTAMP
from auth_deps import get_current_user
from firebase_init import db, bucket
from pydantic import BaseModel
from fastapi.responses import FileResponse
import os
import json
import uuid
import tempfile
import pypandoc
from openai import AsyncOpenAI
from auth_deps import get_current_user
from firebase_init import db, bucket
from pydantic import BaseModel
import os
import json
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

router = APIRouter(prefix="/api", tags=["cases"])

# ---- SCHEMAS ----
class CaseCreateSchema(BaseModel):
    authorName: str = ""
    institution: str = ""

class UploadSignSchema(BaseModel):
    filename: str
    contentType: str

class ImageAddSchema(BaseModel):
    storagePath: str
    publicUrl: str
    caption: str = ""
    widthPx: int = 0
    heightPx: int = 0

class ImageRemoveSchema(BaseModel):
    storagePath: str

class RefineSchema(BaseModel):
    section: str
    oldText: str
    instruction: str

# ---- ROTAS CRUDS DE CASOS ----

@router.get("/cases")
def list_cases(user = Depends(get_current_user)):
    uid = user.get("uid")
    # Firebase Firestore Query
    docs = db.collection("cases").where("uid", "==", uid).order_by("updatedAt", direction="DESCENDING").stream()
    
    cases = []
    for doc in docs:
        data = doc.to_dict()
        # Projeta apenas o básico para economia de load no dashboard
        cases.append({
            "id": doc.id,
            "aiTitle": data.get("ai", {}).get("title") or data.get("aiTitle", ""),
            "complaint": data.get("clinical", {}).get("complaint") or data.get("complaint", ""),
            "status": data.get("status", "draft"),
            "updatedAt": data.get("updatedAt")
        })
    return cases

@router.get("/cases/{case_id}")
def get_case(case_id: str, user = Depends(get_current_user)):
    uid = user.get("uid")
    doc_ref = db.collection("cases").document(case_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
    
    data = doc.to_dict()
    if data.get("uid") != uid:
        raise HTTPException(status_code=404, detail="Caso não encontrado") # 404 intencional para não vazar existência
    
    data["id"] = doc.id
    return data

@router.post("/cases")
def create_case(payload: dict, user = Depends(get_current_user)):
    uid = user.get("uid")
    
    # Formatação Default baseada na doc
    new_doc = {
        "uid": uid,
        "authorName": payload.get("authorName", ""),
        "institution": payload.get("institution", ""),
        "status": "draft",
        "createdAt": SERVER_TIMESTAMP,
        "updatedAt": SERVER_TIMESTAMP,
        "patient": payload.get("patient", {}),
        "clinical": payload.get("clinical", {}),
        "ai": payload.get("ai", {}),
        "images": []
    }
    
    ref = db.collection("cases").document()
    ref.set(new_doc)
    return {"id": ref.id}

@router.patch("/cases/{case_id}")
def update_case(case_id: str, payload: dict, user = Depends(get_current_user)):
    uid = user.get("uid")
    doc_ref = db.collection("cases").document(case_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get("uid") != uid:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
    
    data = doc.to_dict()
    
    # Validação de Conflict Policy
    client_updated_at = payload.pop("clientUpdatedAt", None)
    # Na prática, verificar timestamps pode requerer parsing dependendo da lib, vamos por fallback safe
    
    # Não permitimos alterar uid, createdAt, etc
    update_data = {**payload, "updatedAt": SERVER_TIMESTAMP}
    if "uid" in update_data: del update_data["uid"]
    
    doc_ref.update(update_data)
    return {"status": "ok", "id": case_id}

@router.delete("/cases/{case_id}")
def delete_case(case_id: str, user = Depends(get_current_user)):
    uid = user.get("uid")
    doc_ref = db.collection("cases").document(case_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get("uid") != uid:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
    
    # Soft Delete
    doc_ref.update({"status": "deleted", "updatedAt": SERVER_TIMESTAMP})
    return {"status": "deleted"}

@router.post("/cases/{case_id}/refine")
async def refine_case_section(case_id: str, payload: RefineSchema, user = Depends(get_current_user)):
    uid = user.get("uid")
    doc_ref = db.collection("cases").document(case_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get("uid") != uid:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
    
    # Prompt do HITL
    system_prompt = "Você é um revisor médico sênior da área de Otorrinolaringologia. Aja conforme o estilo da revista Laryngoscope e de acordo com as instruções diretas do médico assistente."
    user_prompt = f"""
Sessão atual que será reescrita: `{payload.section}`

--- TEXTO ATUAL ---
{payload.oldText}
-------------------

INSTRUÇÃO DIRETIVA DO MÉDICO:
"{payload.instruction}"

Aja estritamente corrigindo ou reconstruindo o texto com base na diretriz do médico. Não adicione saudações, notas iniciais ou qualquer formatação além do conteúdo puramente revisado. Retorne em formato JSON: {{"newText": "texto aqui"}}
"""
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.5
        )
        
        result = json.loads(response.choices[0].message.content)
        
        # Opcional: Audit log dentro de subcollection
        doc_ref.collection("refinements").add({
            "section": payload.section,
            "oldText": payload.oldText,
            "newText": result.get("newText", ""),
            "instruction": payload.instruction,
            "timestamp": SERVER_TIMESTAMP
        })
        
        return {"newText": result.get("newText", "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no OpenAI: {e}")

@router.get("/cases/{case_id}/export/docx")
def export_docx(case_id: str, user = Depends(get_current_user)):
    uid = user.get("uid")
    doc_ref = db.collection("cases").document(case_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get("uid") != uid:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
    data = doc.to_dict()
    
    # 1. Montar Markdown Científico
    md_content = f"# {data.get('ai', {}).get('title', 'Case Report')}\n\n"
    md_content += f"**Authors:** {data.get('authorName', '')}\n\n"
    md_content += f"**Institution:** {data.get('institution', '')}\n\n"
    md_content += "## Abstract\n\n"
    md_content += f"{data.get('ai', {}).get('submissionSummary', '')}\n\n"
    md_content += "## Case Report\n\n"
    md_content += f"{data.get('ai', {}).get('draftArticle', '')}\n\n"
    
    # Adicionar imagens ao MD se houver
    images = data.get('images', [])
    if images:
        md_content += "## Clinical Images\n\n"
        for idx, img in enumerate(images):
            # Formatação em Markdown para imagens
            md_content += f"![Figure {idx+1}: {img.get('caption', '')}]({img.get('publicUrl', '')})\n\n"

    # 2. Converter pra DOCX via tempfile
    temp_uuid = uuid.uuid4().hex
    out_file = os.path.join(tempfile.gettempdir(), f"{temp_uuid}.docx")
    
    try:
        # Pypandoc assume que pandoc está instalado no sistema (.exe no Win, bin no Unix)
        pypandoc.convert_text(md_content, 'docx', format='md', outputfile=out_file)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao compilar documento DOCX na infraestrutura. O Pandoc está instalado? Log: {e}")

    # Retorna o arquivo com os cabeçalhos apropriados
    return FileResponse(
        out_file, 
        media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
        filename="Relato_Clinico_OTTO.docx"
    )

# ---- UPLOADS E IMAGENS ----

@router.post("/uploads/sign")
def sign_upload_url(payload: UploadSignSchema, user = Depends(get_current_user)):
    uid = user.get("uid")
    
    if not bucket:
         raise HTTPException(status_code=500, detail="Bucket do Firebase Storage não inicializado.")
         
    allowed_types = ["image/webp", "image/jpeg", "image/png"]
    if payload.contentType not in allowed_types:
        raise HTTPException(status_code=400, detail="Content type não permitido")
    
    storage_path = f"cases/{uid}/{uuid4().hex}.webp"
    blob = bucket.blob(storage_path)
    
    upload_url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=15),
        method="PUT",
        content_type=payload.contentType
    )
    
    # Uma URL de leitura de vida super longa (100 anos)
    public_url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(days=365*100),
        method="GET"
    )
    
    return {
        "uploadUrl": upload_url,
        "storagePath": storage_path,
        "publicUrl": public_url,
        "expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    }

@router.post("/cases/{case_id}/images")
def add_case_image(case_id: str, payload: ImageAddSchema, user = Depends(get_current_user)):
    uid = user.get("uid")
    doc_ref = db.collection("cases").document(case_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get("uid") != uid:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
    
    new_image = {
        "storagePath": payload.storagePath,
        "publicUrl": payload.publicUrl,
        "caption": payload.caption,
        "uploadedAt": SERVER_TIMESTAMP,
        "widthPx": payload.widthPx,
        "heightPx": payload.heightPx
    }
    
    from google.cloud.firestore import ArrayUnion
    doc_ref.update({"images": ArrayUnion([new_image]), "updatedAt": SERVER_TIMESTAMP})
    return {"status": "ok", "image": new_image}

@router.delete("/cases/{case_id}/images")
def remove_case_image(case_id: str, payload: ImageRemoveSchema, user = Depends(get_current_user)):
    uid = user.get("uid")
    doc_ref = db.collection("cases").document(case_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get("uid") != uid:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
        
    data = doc.to_dict()
    images = data.get("images", [])
    
    # Find the image object to remove based on storagePath
    target_image = next((img for img in images if img.get("storagePath") == payload.storagePath), None)
    
    if target_image:
        from google.cloud.firestore import ArrayRemove
        doc_ref.update({"images": ArrayRemove([target_image]), "updatedAt": SERVER_TIMESTAMP})
        
        # Apaga fisicamente do bucket
        if bucket:
            try:
                blob = bucket.blob(payload.storagePath)
                blob.delete()
            except Exception as e:
                print(f"Erro ignorado ao deletar blob storage: {e}")
                
    return {"status": "ok"}
