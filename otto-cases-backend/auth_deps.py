from fastapi import Header, HTTPException, status
import firebase_admin
from firebase_admin import auth

def get_current_user(authorization: str = Header(None)):
    """
    Dependency do FastAPI para verificar o Bearer Token do Firebase.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header Authorization está faltando",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header Authorization inválido. Formato esperado: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = parts[1]

    try:
        decoded_token = auth.verify_id_token(token, check_revoked=False)
        # O decoded_token normalmente contém {uid, email, name, ...}
        return decoded_token
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")
    except Exception as e:
         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Erro na validação de Auth: {str(e)}")
