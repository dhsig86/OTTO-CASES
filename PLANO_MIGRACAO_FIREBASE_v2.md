# OTTO CASES — Plano de Migração Supabase → Firebase (v2)

> Este documento substitui o rascunho anterior. Foi revisado para corrigir imprecisões técnicas, remover antipatterns (upload em proxy, CORS inseguro), adicionar decisões que estavam ausentes (refresh de token, Security Rules, schema Firestore, migração de dados) e reestruturar o trabalho em **frentes paralelizáveis**, para que múltiplos agentes/sessões possam executar sem bloqueio mútuo.
>
> **Regra geral para o executor:** cada frente abaixo pode ser iniciada de forma independente, exceto quando marcada explicitamente como `blockedBy`. Leia a frente inteira antes de começar.

---

## 0. Diagnóstico (por que estamos migrando)

**Fato correto:** o Supabase Free Tier **pausa** projetos após ~7 dias sem atividade de API e exige reativação manual — ele **não apaga dados silenciosamente**, mas a fricção de reativar + o risco de pausa no meio de uso de médico real é inaceitável para uma ferramenta clínica.

**Fato real que pesa mais:** o OTTO PWA (shell pai) emite SSO via **Firebase ID Token**, enquanto o Cases autentica separadamente via Supabase Auth. Isso cria dois sistemas de identidade distintos, obriga mapeamento de UID, e está quebrando o fluxo de sessão do médico (não consegue salvar rascunho entre visitas).

**Decisão:** unificar em Firebase (Auth + Firestore + Storage) para alinhar com o PWA e eliminar a camada de tradução. O backend Python continua sendo o único ponto de escrita no banco — frontend nunca fala direto com Firestore.

---

## 1. Arquitetura Alvo

```
[OTTO PWA (Shell Firebase)]
        │  postMessage { type: 'otto-context', firebaseToken, uid, email }
        ▼
[OTTO CASES Frontend (React/Vite)]
        │  axios + Authorization: Bearer <ID_TOKEN>
        ▼
[OTTO CASES Backend (FastAPI)]
        │  firebase-admin verify_id_token
        ├──► Firestore (coleção cases) — leitura/escrita
        ├──► Firebase Storage (emite Signed URLs; NÃO faz proxy de bytes)
        └──► OpenAI / WeasyPrint / pandoc (geração de conteúdo)
```

**Princípios invioláveis**

1. Nenhuma credencial de admin do Firebase é enviada ao frontend.
2. Frontend nunca usa o SDK cliente do Firebase para gravar — apenas recebe token do PWA pai.
3. Upload de arquivo binário **não passa pelo backend** — usa Signed URL emitida pelo backend.
4. CORS restrito a origens conhecidas (sem `"*"` com credenciais).
5. Firestore Security Rules negam tudo por padrão (backend é o único caminho válido).

---

## 2. Decisões de Design (pré-requisito para codar)

### 2.1 Schema Firestore

Coleção `cases/{caseId}` com os seguintes campos (os tipos são Firestore-nativos):

```
cases/{caseId}
├─ uid: string              # Firebase UID do autor (chave de isolamento)
├─ authorName: string
├─ institution: string
├─ status: string           # 'draft' | 'generated' | 'finalized'
├─ createdAt: timestamp
├─ updatedAt: timestamp     # atualizado em todo save
├─ patient: {
│   age, gender
│ }
├─ clinical: {
│   complaint, history, physicalExam,
│   diagnostics, intervention, outcome,
│   isSurgical, clavienDindo, keywords
│ }
├─ ai: {
│   title, abstract, posterContent,
│   lastGeneratedAt, model, promptVersion
│ }
└─ images: [                # array embutido (≤ 20 itens, ≤ 1MB/doc total)
    { storagePath, publicUrl, caption, uploadedAt, widthPx, heightPx }
  ]
```

**Por que array embutido e não subcoleção:** um relato de caso raramente tem >10 imagens, e queremos carregar o caso inteiro num único read (Firestore cobra por documento lido). Se um caso ultrapassar 20 imagens ou 1MB, migrar aquele documento específico para subcoleção.

**Índice composto obrigatório (criar via console ou `firestore.indexes.json`):**

```
Collection: cases
Fields: uid ASC, updatedAt DESC
```

Sem esse índice, a query do Dashboard (`where uid == ? order by updatedAt desc`) falha.

### 2.2 Firestore Security Rules

Arquivo `firestore.rules` a ser publicado via Firebase CLI:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;  // backend-only via Admin SDK
    }
  }
}
```

O Admin SDK **ignora** essas rules (é essa a garantia). Qualquer cliente web com a API Key pública vai bater em `PERMISSION_DENIED`.

### 2.3 Storage Rules

Arquivo `storage.rules`:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

Uploads acontecem via Signed URL emitida pelo backend (`V4 signed URL, expires=15min, method=PUT`). Reads públicos dos assets já subidos usam download URL de longa duração, também emitida pelo backend.

### 2.4 Refresh de Token (ponto crítico)

ID tokens Firebase expiram em **1 hora**. O plano antigo só dizia "setar o header quando chega postMessage" — insuficiente.

Estratégia de duas pontas:

- **PWA pai (fora do escopo deste projeto, mas precisa ser alinhado com o time do Shell):** a cada 45 minutos, e imediatamente após `onIdTokenChanged`, re-emitir `postMessage({ type: 'otto-context', firebaseToken, uid, email })` para o iframe.
- **Cases frontend:** manter o último token em estado React. Interceptor axios lê o token *a cada requisição* (não seta default uma única vez). Se uma response vier com `401`, despacha um `window.parent.postMessage({ type: 'otto-request-refresh' })` e fila a requisição por até 10s aguardando o novo `otto-context`.

### 2.5 Upload de Imagem via Signed URL (NÃO proxy)

Fluxo correto:

```
Frontend → POST /api/uploads/sign   { filename, contentType, sha256? }
Backend  → retorna                  { uploadUrl, storagePath, publicUrl, expiresAt }
Frontend → PUT uploadUrl            (bytes da imagem WebP comprimida, direto ao GCS)
Frontend → POST /api/cases/{id}/images { storagePath, caption }
```

Benefícios: backend não processa bytes, não tem gargalo, não paga banda dobrada, e o upload é resumable por padrão.

### 2.6 CORS

Em `main.py`, listar origens explicitamente:

```python
allow_origins=[
    "https://pwa.otto.med.br",          # substituir pelo domínio real do PWA
    "https://cases.otto.med.br",
    "http://localhost:5173",             # dev Vite
    "http://localhost:3000",
]
allow_credentials=True
allow_methods=["GET","POST","PUT","PATCH","DELETE","OPTIONS"]
allow_headers=["Authorization","Content-Type"]
```

`allow_origins=["*"]` **não funciona** com `allow_credentials=True` nem com header `Authorization` em muitos browsers modernos.

### 2.7 Custo & Autosave

Firestore cobra por write. Autosave a cada tecla é proibitivo.

- **Debounce de 5 segundos** no CaseWizard (sem request em flight: cancelar o anterior).
- **Rascunho espelhado em `localStorage`** com chave `otto-cases:draft:{caseId}` a cada keystroke (instantâneo, zero custo).
- **Indicador de UI:** `Digitando... → Salvando... → Salvo às HH:MM`. Mostrar "Salvando..." só quando há request em voo real.
- **Conflict policy:** o backend usa `updatedAt` como token de última escrita. Se frontend mandar um update com `clientUpdatedAt` menor que o do servidor, responder `409` e forçar reload do caso.

### 2.8 Credenciais Firebase Admin

**Nunca commitar o `.json` no repositório.**

- Dev local: ler caminho de `FIREBASE_CREDENTIALS_PATH` no `.env` (fora do git).
- Render / prod: env var `FIREBASE_CREDENTIALS_JSON` contendo o JSON serializado inteiro. O `main.py` faz `json.loads(os.environ["FIREBASE_CREDENTIALS_JSON"])` e passa para `credentials.Certificate(dict)`.

---

## 3. Frentes de Execução (paralelizáveis)

Cada frente é autocontida e pode ser atribuída a um executor independente (humano ou agente). Dependências estão marcadas.

### 🟦 Frente A — Fundação Backend (Auth + Init Firebase)

**Pré-requisitos:** nenhum.
**Entrega:** `main.py` carrega `firebase-admin`, middleware `get_current_user` funciona.

- [ ] Adicionar ao `requirements.txt`: `firebase-admin`, `python-multipart`, `google-cloud-firestore`, `google-cloud-storage`.
- [ ] Criar módulo `firebase_init.py` que:
  - Lê `FIREBASE_CREDENTIALS_JSON` (env var) ou fallback para `FIREBASE_CREDENTIALS_PATH` (arquivo local).
  - Inicializa `firebase_admin.initialize_app(cred, { 'storageBucket': os.getenv('FIREBASE_STORAGE_BUCKET') })`.
  - Exporta `db = firestore.client()` e `bucket = storage.bucket()`.
- [ ] Criar `auth_deps.py` com `get_current_user(authorization: str = Header(...))` que:
  - Extrai token após `"Bearer "`.
  - Chama `auth.verify_id_token(token, check_revoked=False)`.
  - Retorna `{ uid, email, name }`.
  - Levanta `HTTPException(401)` em qualquer falha.
- [ ] Substituir CORS em `main.py` pelas origens explícitas da seção 2.6.
- [ ] Adicionar rota `GET /api/me` (health-check autenticado) que devolve o dict do user — útil pro frontend confirmar que o token foi aceito.

### 🟦 Frente B — Schema & Rules (infra Firebase, fora do código)

**Pré-requisitos:** nenhum. Pode rodar em paralelo com A.
**Entrega:** projeto Firebase configurado, rules publicadas, índice criado.

- [ ] Criar/confirmar projeto Firebase (`otto-ecossistema` ou nome existente).
- [ ] Habilitar Firestore (modo Native, região `southamerica-east1` — mesma do bucket, para latência baixa de SP).
- [ ] Habilitar Storage no mesmo projeto.
- [ ] Publicar `firestore.rules` da seção 2.2 via `firebase deploy --only firestore:rules`.
- [ ] Publicar `storage.rules` da seção 2.3 via `firebase deploy --only storage`.
- [ ] Criar `firestore.indexes.json` com o índice composto (uid ASC, updatedAt DESC) e deployar.
- [ ] Gerar service account JSON e guardar em gerenciador de segredos (não no git). Registrar fingerprint no `logins_senhas.txt`.

### 🟦 Frente C — Endpoints CRUD de Casos

**Pré-requisitos:** A concluída.
**Entrega:** `routers/cases.py` com todas as rotas do Dashboard e do Wizard.

- [ ] `GET /api/cases` — lista casos do `uid` do token, ordenado por `updatedAt desc`, projetando só `{id, aiTitle, complaint, status, updatedAt}` (economia de read).
- [ ] `GET /api/cases/{id}` — retorna caso completo; valida que `doc.uid == current_user.uid` (senão `404`, não `403`, para não vazar existência).
- [ ] `POST /api/cases` — cria novo documento, seta `uid`, `createdAt`, `updatedAt`, `status='draft'`. Retorna `{id}`.
- [ ] `PATCH /api/cases/{id}` — upsert parcial. Recebe `clientUpdatedAt`, compara com servidor, retorna `409` se stale. Atualiza `updatedAt = SERVER_TIMESTAMP`.
- [ ] `DELETE /api/cases/{id}` — soft delete (set `status='deleted'`, não remove doc; facilita recuperação).
- [ ] Validação: todos os handlers dependem de `Depends(get_current_user)` e verificam `uid` em cada leitura.

### 🟦 Frente D — Upload via Signed URL

**Pré-requisitos:** A concluída, B concluída.
**Entrega:** upload funciona end-to-end sem passar bytes pelo backend.

- [ ] `POST /api/uploads/sign` — recebe `{filename, contentType}`, valida contentType em whitelist (`image/webp`, `image/jpeg`, `image/png`), gera `storagePath = f"cases/{uid}/{uuid4()}.webp"`, emite V4 Signed URL com `method='PUT'` e `expiration=timedelta(minutes=15)`. Retorna `{uploadUrl, storagePath, publicUrl}`.
- [ ] `POST /api/cases/{id}/images` — anexa `{storagePath, caption}` ao array `images` do caso (com `firestore.ArrayUnion`). Valida ownership.
- [ ] `DELETE /api/cases/{id}/images` — recebe `storagePath`, remove do array e também do bucket (`blob.delete()`).
- [ ] Configurar CORS do bucket para aceitar `PUT` das origens da seção 2.6 (via `gsutil cors set`).

### 🟩 Frente E — Frontend: Auth + Token Refresh

**Pré-requisitos:** nenhum (pode começar junto com A; integração final depende de A + /api/me).
**Entrega:** App.jsx não mostra Login, recebe token do PWA, e recupera de expiração.

- [ ] Criar `src/auth/ottoContext.js` com:
  - `AuthProvider` React Context que mantém `{token, uid, email, status}`.
  - `useEffect` que escuta `window.addEventListener('message', ...)` filtrando `event.data.type === 'otto-context'`. Valida `event.origin` contra allowlist do PWA.
  - Timeout de 8s: se não chegar contexto, seta `status='no-shell'` e renderiza tela de erro ("Abra o OTTO Cases pelo OTTO PWA").
- [ ] Criar `src/api/client.js`:
  - Instância axios com `baseURL` do backend.
  - Request interceptor lê token do contexto a cada chamada.
  - Response interceptor trata `401`: despacha `window.parent.postMessage({type: 'otto-request-refresh'}, parentOrigin)`, aguarda até 10s por novo contexto, reenvia a request original **uma única vez**.
- [ ] Refatorar `App.jsx`:
  - Remover `currentView === 'login'`.
  - Envolver tudo em `<AuthProvider>`.
  - Se `status === 'authenticated'` → Dashboard; se `loading` → spinner; se `no-shell` → tela de erro.
- [ ] Deletar `Login.jsx` (ou mover para `src/pages/_legacy/` caso queira manter para referência).
- [ ] **Fallback de dev (opcional, bem isolado):** se `import.meta.env.VITE_DEV_TOKEN` existir em build de dev, injetar esse token no contexto e pular postMessage. Nunca em produção.

### 🟩 Frente F — Frontend: Remoção Supabase + Refatoração de Telas

**Pré-requisitos:** E iniciada (precisa do `api/client.js`). Endpoints C prontos para funcionar end-to-end.
**Entrega:** `@supabase/supabase-js` zerado do bundle; Dashboard e CaseWizard falam com a API nova.

- [ ] `package.json`: remover `@supabase/supabase-js`. Rodar `npm prune` e `npm i`.
- [ ] Deletar `src/supabase.js`.
- [ ] `Dashboard.jsx`: trocar o bloco `supabase.from('cases').select(...)` por `api.get('/api/cases')`. Manter loading/empty states.
- [ ] `CaseWizard.jsx`:
  - `loadCase(id)` → `api.get('/api/cases/{id}')`.
  - `autoSaveDraft(payload)` → debounce 5s + cancel token + `api.patch('/api/cases/{id}', payload)`.
  - Se `caseId == null`, primeiro save dispara `POST /api/cases` e guarda o ID retornado.
  - Indicador de UI conforme seção 2.7.
- [ ] Upload de imagem: fluxo de três passos da seção 2.5. Remover qualquer `supabase.storage.from(...)`.
- [ ] Grep de sanidade: `grep -r supabase src/` deve retornar vazio.

### 🟨 Frente G — Migração de Dados Legados (one-shot)

**Pré-requisitos:** A + B + C concluídas.
**Entrega:** script `scripts/migrate_supabase_to_firestore.py` executado uma vez; contagem de docs bate.

- [ ] Exportar dump do Supabase (`pg_dump` ou CSV via dashboard) da tabela `cases` e `case_images`.
- [ ] Para cada row:
  - Mapear `user_id` (Supabase) → `uid` (Firebase) via tabela de equivalência do PWA. **Se não houver equivalência confiável, o caso precisa ser marcado e revisado manualmente — não inventar UID.**
  - Transformar campos snake_case → camelCase do novo schema.
  - Para imagens: baixar do Supabase Storage, reupload no Firebase Storage, recompor `images[]`.
- [ ] Rodar em modo `--dry-run` primeiro (apenas loga). Depois `--commit`.
- [ ] Registrar no doc final: quantos casos migrados, quantos marcados pra revisão, data.

### 🟪 Frente H — Roadmap Pós-MVP (independente; não bloqueia nada)

Cada item aqui é uma PR própria, depois que A–F estiverem em produção.

- [ ] **Export DocX via pandoc (não python-docx).** Backend gera markdown estruturado a partir do conteúdo do caso, chama `pandoc -f markdown -t docx -o out.docx --reference-doc=templates/journal.docx`. O `reference-doc` define estilos de fonte, espaçamento e margens que periódicos pedem. `python-docx` não preserva formatação científica com a mesma qualidade.
- [ ] **Refinamento assistido (HITL).** Endpoint `POST /api/cases/{id}/refine` recebe `{instruction, targetSection}`, replaya a geração com o contexto atual + a instrução do médico. Salva histórico em subcoleção `cases/{id}/refinements/` para auditoria.
- [ ] **Autosave robusto.** Implementar o debounce + localStorage + reconciliação descritos em 2.7. Testar em modo offline (airplane mode) e reconexão.
- [ ] **RAG com guidelines atualizadas.** Indexar os arquivos de `knowledge/` em um vector store (pgvector na OpenAI ou Firestore + Vertex AI embeddings). O prompt de geração recupera top-K chunks relevantes ao invés de concatenar tudo (que hoje estoura contexto e é caro).
- [ ] **Observabilidade.** Sentry no frontend, structured logging + request id no backend. Sem isso, debugar erro de médico em produção é adivinhação.

---

## 4. Ordem sugerida de merge

```
Sprint 1 (paralelo): A, B, E
Sprint 2 (paralelo): C (depende de A), F (depende de E + C estar quase pronta)
Sprint 3: D (depende de A e B)
Sprint 4: G (one-shot), QA end-to-end
Sprint 5+: H (cada item PR independente)
```

---

## 5. Checklist de "Definition of Done" (antes de considerar MVP pronto)

- [ ] Médico abre o OTTO Cases dentro do PWA → Dashboard carrega casos sem ver tela de login.
- [ ] Médico fica 90 minutos editando um caso, token expira, e **o save seguinte funciona transparentemente** (refresh via postMessage).
- [ ] `grep -r supabase otto-cases-frontend/src otto-cases-backend` retorna zero.
- [ ] Tentativa de ler `cases/*` via SDK cliente do Firebase (com API Key pública) retorna `PERMISSION_DENIED`.
- [ ] Upload de imagem de 5MB completa em <10s em 4G e nunca passa pelo backend (verificar em Network tab).
- [ ] Autosave não dispara mais de 1 request a cada 5s mesmo digitando rápido.
- [ ] Deploy no Render usa env var `FIREBASE_CREDENTIALS_JSON`, e o `.json` **não** está no git.
- [ ] CORS no backend rejeita origens fora da allowlist (testar com `curl -H "Origin: https://evil.com"`).

---

## 6. O que explicitamente **não** está no escopo deste documento

- Redesign visual do Cases.
- Mudança do provedor do LLM (continua OpenAI).
- Multi-tenant / múltiplos hospitais (cada médico vê só os próprios casos via `uid`; features de grupo ficam para depois).
- Versionamento/histórico completo de edições do caso (fora H.2).

---

*Doc v2 — pronto para execução paralela por múltiplos agentes. Revisar Frente H antes de estimar prazo final; o MVP de verdade é A–G.*
