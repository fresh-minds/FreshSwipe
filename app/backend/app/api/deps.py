"""FastAPI dependencies for authentication and authorization."""
import os
import uuid
import time
import jwt
import httpx
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.config import get_settings
from app.models.user import User

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

# Microsoft OpenID configuration - cached JWKS
DISCOVERY_URL = f"https://login.microsoftonline.com/{settings.AZURE_ENTRA_TENANT_ID}/v2.0/.well-known/openid-configuration"

# Simple in-memory cache for JWKS with TTL
_jwks_cache: dict = {
    "keys": None,
    "fetched_at": 0
}
JWKS_CACHE_TTL = 3600  # 1 hour in seconds


async def get_ms_public_keys():
    """Fetch Microsoft public keys for JWT validation with caching."""
    current_time = time.time()
    
    # Return cached keys if still valid
    if _jwks_cache["keys"] and (current_time - _jwks_cache["fetched_at"]) < JWKS_CACHE_TTL:
        return _jwks_cache["keys"]
    
    # Fetch fresh keys
    async with httpx.AsyncClient() as client:
        resp = await client.get(DISCOVERY_URL)
        config = resp.json()
        jwks_uri = config["jwks_uri"]
        resp = await client.get(jwks_uri)
        keys = resp.json()["keys"]
        
        # Update cache
        _jwks_cache["keys"] = keys
        _jwks_cache["fetched_at"] = current_time
        
        return keys

async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Validate token and return current user."""
    # 1. Local Development Debug User
    debug_user_id = os.getenv("DEBUG_USER_ID")
    debug_enabled = os.getenv("DEBUG", "").strip().lower() in {"1", "true", "yes", "y"}
    if debug_user_id and debug_enabled:
        try:
            result = await db.execute(select(User).where(User.id == uuid.UUID(debug_user_id)))
            user = result.scalar_one_or_none()
            if user:
                return user
            # Create debug user if missing (local/dev convenience)
            debug_email = os.getenv("DEBUG_USER_EMAIL", "debug@local")
            user = User(
                id=uuid.UUID(debug_user_id),
                entra_oid=f"debug-{debug_user_id}",
                tenant_id="debug",
                name="Debug User",
                email=debug_email,
                is_searchable=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            return user
        except ValueError:
            pass  # Invalid UUID, continue to normal auth

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # 2. NextAuth credentials token (HS256) fallback
        try:
            header = jwt.get_unverified_header(token)
            if header.get("alg", "").startswith("HS"):
                nextauth_secret = os.getenv("NEXTAUTH_SECRET")
                if nextauth_secret:
                    payload = jwt.decode(
                        token,
                        nextauth_secret,
                        algorithms=["HS256", "HS384", "HS512"],
                        options={"verify_aud": False},
                    )
                    email = payload.get("email") or payload.get("preferred_username")
                    name = payload.get("name") or "User"
                    if not email:
                        raise HTTPException(status_code=401, detail="Missing email in token")
                    result = await db.execute(select(User).where(User.email == email))
                    user = result.scalar_one_or_none()
                    if not user:
                        user = User(
                            entra_oid=payload.get("sub") or f"local-{email}",
                            tenant_id=payload.get("tid") or "local",
                            name=name,
                            email=email,
                            is_searchable=True,
                        )
                        db.add(user)
                        await db.commit()
                        await db.refresh(user)
                    return user
        except jwt.InvalidTokenError:
            # Fall through to Azure AD validation
            pass

        # 1. Fetch keys (should be cached in production)
        keys = await get_ms_public_keys()
        
        # 2. Decode header to find 'kid'
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        
        # 3. Find matching key
        key = next((k for k in keys if k["kid"] == kid), None)
        if not key:
            raise HTTPException(status_code=401, detail="Invalid token kid")

        # 4. Construct public key and verify
        # Note: Using PyJWT with cryptography
        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
        
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=settings.AZURE_ENTRA_AD_CLIENT_ID,
            issuer=f"https://login.microsoftonline.com/{settings.AZURE_ENTRA_TENANT_ID}/v2.0",
        )
        
        oid = payload.get("oid")
        if not oid:
            raise HTTPException(status_code=401, detail="Missing OID in token")

        # 5. Get or create user from DB
        result = await db.execute(select(User).where(User.entra_oid == oid))
        user = result.scalar_one_or_none()
        
        if not user:
            # First login: create user
            # claims: name, preferred_username (email)
            user = User(
                entra_oid=oid,
                tenant_id=payload.get("tid"),
                name=payload.get("name", "Unknown User"),
                email=payload.get("preferred_username", f"{oid}@freshminds.com"),
                is_searchable=True
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            
        return user

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception:
        raise HTTPException(status_code=500, detail="Auth error")


def is_admin_user(user: User) -> bool:
    if user.entra_oid and user.entra_oid in settings.admin_entra_ids:
        return True
    
    user_email = (user.email or "").lower()
    
    # Check list of admins (normalized)
    if user_email and user_email in [e.lower() for e in settings.admin_emails]:
        return True
        
    # Check single admin (normalized)
    if user_email and settings.admin_email and user_email == settings.admin_email.lower():
        return True
        
    debug_user_id = os.getenv("DEBUG_USER_ID")
    if debug_user_id and str(user.id) == debug_user_id:
        return True
        
    return False
