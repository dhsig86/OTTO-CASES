# OTTO CASES 🩺

OTTO CASES é uma plataforma de Inteligência Clínica baseada em Inteligência Artificial para estruturação e geração automática de Relatos de Caso e E-Pôsteres na área de Otorrinolaringologia e Cirurgia Cérvico-Facial. O sistema é programado para seguir as diretrizes estritas do **CARE/SCARE** e os formatos do congresso da **FORL** e **ABORL-CCF**.

## Demonstração Visual

![Tutorial Animado do OTTO CASES](tutorial.webp)

## Arquitetura e Deploy

O sistema é dividido em duas partes, cada uma com seus arquivos de deploy automáticos:

1. **Frontend (Vite + React)**
   - Localizado na subpasta `otto-cases-frontend`.
   - Pode ser implantado instantaneamente na **Vercel**. O arquivo `vercel.json` na raiz do repositório já configura o Vercel para puxar desta subpasta e rodar o `npm run build`.

2. **Backend (Python + FastAPI)**
   - Localizado na subpasta `otto-cases-backend`.
   - Pode ser implantado via **Render.com**. O arquivo `render.yaml` já está configurado para o Web Service (Python 3.11).
   - Dependências: OpenAI, WeasyPrint, Jinja2, etc.

## Como Executar Localmente

### 1. Iniciar o Servidor Backend (Python + IA)
```bash
cd otto-cases-backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
# Crie e preencha um arquivo .env nesta pasta com sua OPENAI_API_KEY="sk-..."
uvicorn main:app --reload
```

### 2. Iniciar o Frontend (React)
- Abra um **novo** terminal:
```bash
cd otto-cases-frontend
npm install
npm run dev
```
Acesse `http://localhost:5173`. Para simular um login, você pode inserir qualquer email e senha.

## Tutoriais Opcionais

O repositório contém `test_case.txt` para você copiar e colar no workflow e testar a geração visual das respostas com 1 clique!
