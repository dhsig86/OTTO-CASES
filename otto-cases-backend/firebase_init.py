import os
import json
import firebase_admin
from firebase_admin import credentials, firestore, storage
from dotenv import load_dotenv

load_dotenv()

def initialize_firebase():
    """
    Inicializa o SDK do Firebase Admin.
    Tenta ler a credencial a partir de JSON direto na variável de ambiente (Production)
    ou de um arquivo apontado por FIREBASE_CREDENTIALS_PATH (Development).
    """
    if not firebase_admin._apps:
        cred = None
        
        firebase_json_env = os.environ.get("FIREBASE_CREDENTIALS_JSON")
        if firebase_json_env:
            try:
                cred_dict = json.loads(firebase_json_env)
                cred = credentials.Certificate(cred_dict)
            except Exception as e:
                print(f"Erro ao parsear FIREBASE_CREDENTIALS_JSON: {e}")
        
        if not cred:
            cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
            if cred_path and os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
            else:
                # Caso a env de ambiente local não esteja setada, tenta ler o arquivo direto do caminho base
                default_path = "firebase_key.json"
                if os.path.exists(default_path):
                    cred = credentials.Certificate(default_path)

        if not cred:
            raise ValueError("Não foi possível encontrar as credenciais do Firebase. Verifique FIREBASE_CREDENTIALS_JSON ou FIREBASE_CREDENTIALS_PATH.")

        # O bucket de storage padrão deve vir da variável de ambiente FIREBASE_STORAGE_BUCKET
        storage_bucket = os.environ.get("FIREBASE_STORAGE_BUCKET")
        options = {}
        if storage_bucket:
             options['storageBucket'] = storage_bucket

        firebase_admin.initialize_app(cred, options)

initialize_firebase()

db = firestore.client()
try:
    bucket = storage.bucket()
except Exception as e:
    bucket = None
    print(f"Warning: Firebase storage bucket não configurado. Certifique-se de configurar FIREBASE_STORAGE_BUCKET. Erro: {e}")
