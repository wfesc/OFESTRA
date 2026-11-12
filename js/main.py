import json
import sqlite3
import os
import hashlib
import hmac
import uuid
import time
import secrets
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Header, Depends, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from database import get_db, init_db

# ============================================================
# OFESTRA SERVER SECRET (temporary development handshake)
# Reads OFESTRA_SECRET_KEY from this folder's .env file.
# Keep the value in .env; do not hardcode it in this file.
# ============================================================
def load_env_file():
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.is_file():
        return

    try:
        lines = env_path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return

    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]

        if name and name not in os.environ:
            os.environ[name] = value


load_env_file()
SERVER_SECRET_KEY = os.getenv("OFESTRA_SECRET_KEY", "").strip()

app = FastAPI(
    title="OFESTRA SERVER",
    version="1.0.0"
)

security = HTTPBearer()

init_db()

# ============================================================
# Temporary browser access configuration for development.
# CORS is not authentication; the secret check below is separate.
# ============================================================
@app.middleware("http")
async def require_ofestra_client_key(request, call_next):
    # Browser CORS preflight requests do not carry the custom key header.
    if request.method == "OPTIONS":
        return await call_next(request)

    # Keep the interactive API documentation available for development.
    if request.url.path in ("/docs", "/openapi.json", "/redoc"):
        return await call_next(request)

    if not SERVER_SECRET_KEY:
        return JSONResponse(
            status_code=503,
            content={"success": False, "detail": "Server secret is not configured"}
        )

    supplied_key = request.headers.get("X-OFESTRA-KEY", "")
    if not supplied_key or not hmac.compare_digest(supplied_key, SERVER_SECRET_KEY):
        return JSONResponse(
            status_code=403,
            content={"success": False, "detail": "Invalid or missing OFESTRA client key"}
        )

    return await call_next(request)

# Add CORS after the HTTP middleware so preflight requests are handled first.
# For production, replace '*' with the exact published game origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSION_DAYS = 30


class RegisterData(BaseModel):
    username: str = Field(min_length=3, max_length=24)
    password: str = Field(min_length=8, max_length=128)


class LoginData(BaseModel):
    username: str
    password: str


def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)

    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        bytes.fromhex(salt),
        300000
    )

    return salt + ":" + hashed.hex()


def verify_password(password, stored):
    try:
        salt, original = stored.split(":")
        check = hash_password(password, salt).split(":")[1]
        return hmac.compare_digest(check, original)
    except Exception:
        return False


def create_session(uid):
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires = int(time.time()) + SESSION_DAYS * 86400

    conn = get_db()
    conn.execute(
        "INSERT INTO sessions (player_uid, token_hash, expires_at) VALUES (?, ?, ?)",
        (uid, token_hash, expires)
    )
    conn.commit()
    conn.close()

    return token


def authenticate(authorization):
    if not authorization:
        raise HTTPException(401, "Authentication required")

    token = authorization.credentials
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    conn = get_db()
    row = conn.execute("""
        SELECT players.uid, players.username
        FROM sessions
        JOIN players ON players.uid = sessions.player_uid
        WHERE sessions.token_hash = ?
        AND sessions.expires_at > ?
    """, (token_hash, int(time.time()))).fetchone()
    conn.close()

    if not row:
        raise HTTPException(401, "Invalid or expired session")

    return row


@app.get("/")
def home():
    return {
        "name": "OFESTRA SERVER",
        "status": "online",
        "version": "1.0.0"
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/auth/register")
def register(data: RegisterData):
    username = data.username.strip()

    if not username or len(username) < 3:
        raise HTTPException(400, "Invalid username")

    conn = get_db()

    existing = conn.execute(
        "SELECT uid FROM players WHERE username = ? COLLATE NOCASE",
        (username,)
    ).fetchone()

    if existing:
        conn.close()
        raise HTTPException(409, "Username already exists")

    uid = "OFS-" + uuid.uuid4().hex[:12].upper()
    password_hash = hash_password(data.password)

    try:
        conn.execute(
            "INSERT INTO players (uid, username, password) VALUES (?, ?, ?)",
            (uid, username, password_hash)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(409, "Account could not be created")

    conn.close()

    token = create_session(uid)

    return {
        "success": True,
        "uid": uid,
        "username": username,
        "token": token
    }


@app.post("/auth/login")
def login(data: LoginData):
    conn = get_db()
    player = conn.execute(
        "SELECT * FROM players WHERE username = ? COLLATE NOCASE",
        (data.username.strip(),)
    ).fetchone()
    conn.close()

    if not player or not verify_password(data.password, player["password"]):
        raise HTTPException(401, "Incorrect username or password")

    token = create_session(player["uid"])

    return {
        "success": True,
        "uid": player["uid"],
        "username": player["username"],
        "token": token
    }


@app.get("/auth/me")
def me(authorization: HTTPAuthorizationCredentials = Depends(security)):
    player = authenticate(authorization)

    return {
        "success": True,
        "uid": player["uid"],
        "username": player["username"]
    }


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=32)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    bio: Optional[str] = Field(default=None, max_length=160)
    settings: Optional[dict] = None
    progress: Optional[dict] = None


@app.get("/profile")
def get_profile(authorization: HTTPAuthorizationCredentials = Depends(security)):
    player = authenticate(authorization)
    conn = get_db()

    conn.execute(
        "INSERT OR IGNORE INTO player_profiles (uid) VALUES (?)",
        (player["uid"],)
    )
    conn.commit()

    row = conn.execute(
        "SELECT * FROM player_profiles WHERE uid = ?",
        (player["uid"],)
    ).fetchone()
    conn.close()

    return {
        "success": True,
        "uid": player["uid"],
        "username": player["username"],
        "profile": {
            "display_name": row["display_name"],
            "avatar_url": row["avatar_url"],
            "bio": row["bio"],
            "settings": json.loads(row["settings_json"]),
            "progress": json.loads(row["progress_json"]),
            "updated_at": row["updated_at"]
        }
    }


@app.put("/profile")
def update_profile(
    data: ProfileUpdate,
    authorization: HTTPAuthorizationCredentials = Depends(security)
):
    player = authenticate(authorization)
    updates = data.model_dump(exclude_unset=True)

    conn = get_db()
    conn.execute(
        "INSERT OR IGNORE INTO player_profiles (uid) VALUES (?)",
        (player["uid"],)
    )

    columns = {
        "display_name": "display_name",
        "avatar_url": "avatar_url",
        "bio": "bio",
        "settings": "settings_json",
        "progress": "progress_json"
    }

    for key, value in updates.items():
        column = columns[key]
        if key in ("settings", "progress"):
            value = json.dumps(value, ensure_ascii=False)
        conn.execute(
            f"UPDATE player_profiles SET {column} = ? WHERE uid = ?",
            (value, player["uid"])
        )

    conn.execute(
        "UPDATE player_profiles SET updated_at = CURRENT_TIMESTAMP WHERE uid = ?",
        (player["uid"],)
    )

    conn.commit()
    conn.close()

    return {"success": True, "message": "Profile updated"}


class FriendRequestData(BaseModel):
    receiver_uid: str = Field(min_length=5, max_length=32)


@app.get("/players/{uid}")
def find_player(uid: str, authorization: HTTPAuthorizationCredentials = Depends(security)):
    authenticate(authorization)
    conn = get_db()

    player = conn.execute("""
        SELECT p.uid, p.username, pr.display_name,
               pr.avatar_url, pr.bio
        FROM players p
        LEFT JOIN player_profiles pr ON pr.uid = p.uid
        WHERE p.uid = ?
    """, (uid.strip().upper(),)).fetchone()

    conn.close()

    if not player:
        raise HTTPException(404, "Player not found")

    return {"success": True, "player": dict(player)}


@app.post("/friends/requests")
def send_friend_request(
    data: FriendRequestData,
    authorization: HTTPAuthorizationCredentials = Depends(security)
):
    sender = authenticate(authorization)
    receiver_uid = data.receiver_uid.strip().upper()

    if sender["uid"] == receiver_uid:
        raise HTTPException(400, "Cannot add yourself")

    conn = get_db()

    receiver = conn.execute(
        "SELECT uid FROM players WHERE uid = ?",
        (receiver_uid,)
    ).fetchone()

    if not receiver:
        conn.close()
        raise HTTPException(404, "Player not found")

    friendship = conn.execute("""
        SELECT id FROM friends
        WHERE (player_uid = ? AND friend_uid = ?)
           OR (player_uid = ? AND friend_uid = ?)
    """, (sender["uid"], receiver_uid, receiver_uid, sender["uid"])).fetchone()

    if friendship:
        conn.close()
        raise HTTPException(409, "Already friends")

    reverse = conn.execute("""
        SELECT id FROM friend_requests
        WHERE sender_uid = ? AND receiver_uid = ?
        AND status = 'pending'
    """, (receiver_uid, sender["uid"])).fetchone()

    if reverse:
        conn.close()
        raise HTTPException(409, "This player already sent you a request")

    existing = conn.execute("""
        SELECT id, status FROM friend_requests
        WHERE sender_uid = ? AND receiver_uid = ?
    """, (sender["uid"], receiver_uid)).fetchone()

    if existing:
        if existing["status"] == "pending":
            conn.close()
            raise HTTPException(409, "Request already sent")

        if existing["status"] == "accepted":
            conn.close()
            raise HTTPException(409, "Already friends")

        conn.execute("""
            UPDATE friend_requests
            SET status = 'pending', created_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (existing["id"],))
        request_id = existing["id"]
    else:
        cursor = conn.execute("""
            INSERT INTO friend_requests
            (sender_uid, receiver_uid)
            VALUES (?, ?)
        """, (sender["uid"], receiver_uid))
        request_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return {"success": True, "request_id": request_id}


@app.get("/friends/requests/incoming")
def incoming_friend_requests(authorization: HTTPAuthorizationCredentials = Depends(security)):
    player = authenticate(authorization)
    conn = get_db()

    rows = conn.execute("""
        SELECT fr.id AS request_id, fr.sender_uid,
               p.username, pr.display_name, pr.avatar_url,
               fr.created_at
        FROM friend_requests fr
        JOIN players p ON p.uid = fr.sender_uid
        LEFT JOIN player_profiles pr ON pr.uid = p.uid
        WHERE fr.receiver_uid = ? AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
    """, (player["uid"],)).fetchall()

    conn.close()

    return {
        "success": True,
        "requests": [dict(row) for row in rows]
    }


@app.post("/friends/requests/{request_id}/accept")
def accept_friend_request(
    request_id: int,
    authorization: HTTPAuthorizationCredentials = Depends(security)
):
    player = authenticate(authorization)
    conn = get_db()

    request = conn.execute("""
        SELECT sender_uid, receiver_uid
        FROM friend_requests
        WHERE id = ? AND receiver_uid = ? AND status = 'pending'
    """, (request_id, player["uid"])).fetchone()

    if not request:
        conn.close()
        raise HTTPException(404, "Pending request not found")

    sender_uid = request["sender_uid"]
    receiver_uid = player["uid"]

    conn.execute("""
        INSERT OR IGNORE INTO friends (player_uid, friend_uid)
        VALUES (?, ?)
    """, (sender_uid, receiver_uid))

    conn.execute("""
        INSERT OR IGNORE INTO friends (player_uid, friend_uid)
        VALUES (?, ?)
    """, (receiver_uid, sender_uid))

    conn.execute("""
        UPDATE friend_requests
        SET status = 'accepted'
        WHERE id = ?
    """, (request_id,))

    conn.commit()
    conn.close()

    return {"success": True, "message": "Friend request accepted"}


@app.post("/friends/requests/{request_id}/reject")
def reject_friend_request(
    request_id: int,
    authorization: HTTPAuthorizationCredentials = Depends(security)
):
    player = authenticate(authorization)
    conn = get_db()

    result = conn.execute("""
        UPDATE friend_requests
        SET status = 'rejected'
        WHERE id = ? AND receiver_uid = ? AND status = 'pending'
    """, (request_id, player["uid"]))

    if result.rowcount == 0:
        conn.close()
        raise HTTPException(404, "Pending request not found")

    conn.commit()
    conn.close()

    return {"success": True, "message": "Friend request rejected"}


@app.get("/friends")
def list_friends(authorization: HTTPAuthorizationCredentials = Depends(security)):
    player = authenticate(authorization)
    conn = get_db()

    rows = conn.execute("""
        SELECT p.uid, p.username, pr.display_name,
               pr.avatar_url, pr.bio
        FROM friends f
        JOIN players p ON p.uid = f.friend_uid
        LEFT JOIN player_profiles pr ON pr.uid = p.uid
        WHERE f.player_uid = ?
        ORDER BY p.username
    """, (player["uid"],)).fetchall()

    conn.close()

    return {
        "success": True,
        "friends": [dict(row) for row in rows]
    }


class MessageData(BaseModel):
    receiver_uid: str = Field(min_length=1, max_length=64)
    message: str = Field(min_length=1, max_length=2000)


@app.post("/messages")
def send_message(
    data: MessageData,
    authorization: HTTPAuthorizationCredentials = Depends(security)
):
    player = authenticate(authorization)
    conn = get_db()

    friendship = conn.execute("""
        SELECT 1 FROM friends
        WHERE player_uid = ? AND friend_uid = ?
    """, (player["uid"], data.receiver_uid)).fetchone()

    if not friendship:
        conn.close()
        raise HTTPException(403, "You can only message your friends")

    result = conn.execute("""
        INSERT INTO messages (sender_uid, receiver_uid, message)
        VALUES (?, ?, ?)
    """, (player["uid"], data.receiver_uid, data.message.strip()))

    conn.commit()
    message_id = result.lastrowid
    conn.close()

    return {"success": True, "message_id": message_id}


@app.get("/messages/unread")
def get_unread_messages(
    authorization: HTTPAuthorizationCredentials = Depends(security)
):
    player = authenticate(authorization)
    conn = get_db()

    rows = conn.execute("""
        SELECT m.sender_uid, COUNT(*) AS unread_count
        FROM messages m
        JOIN friends f
          ON f.player_uid = ? AND f.friend_uid = m.sender_uid
        WHERE m.receiver_uid = ?
          AND m.status != 'read'
        GROUP BY m.sender_uid
    """, (player["uid"], player["uid"])).fetchall()

    unread = [dict(row) for row in rows]
    total = sum(row["unread_count"] for row in unread)

    conn.close()

    return {
        "success": True,
        "total_unread": total,
        "unread_by_sender": unread
    }


@app.get("/messages/{uid}")
def get_messages(
    uid: str,
    authorization: HTTPAuthorizationCredentials = Depends(security)
):
    player = authenticate(authorization)
    conn = get_db()

    friendship = conn.execute("""
        SELECT 1 FROM friends
        WHERE player_uid = ? AND friend_uid = ?
    """, (player["uid"], uid)).fetchone()

    if not friendship:
        conn.close()
        raise HTTPException(403, "You can only view chats with your friends")

    conn.execute("""
        UPDATE messages
        SET status = 'delivered',
            delivered_at = CURRENT_TIMESTAMP
        WHERE sender_uid = ?
          AND receiver_uid = ?
          AND status = 'sent'
    """, (uid, player["uid"]))

    rows = conn.execute("""
        SELECT id, sender_uid, receiver_uid, message,
               created_at, status, delivered_at, read_at
        FROM messages
        WHERE (sender_uid = ? AND receiver_uid = ?)
           OR (sender_uid = ? AND receiver_uid = ?)
        ORDER BY id DESC
        LIMIT 100
    """, (player["uid"], uid, uid, player["uid"])).fetchall()

    conn.commit()
    conn.close()

    return {
        "success": True,
        "messages": [dict(row) for row in reversed(rows)]
    }


@app.post("/messages/{uid}/read")
def mark_messages_read(
    uid: str,
    authorization: HTTPAuthorizationCredentials = Depends(security)
):
    player = authenticate(authorization)
    conn = get_db()

    friendship = conn.execute("""
        SELECT 1 FROM friends
        WHERE player_uid = ? AND friend_uid = ?
    """, (player["uid"], uid)).fetchone()

    if not friendship:
        conn.close()
        raise HTTPException(403, "You can only read messages from your friends")

    result = conn.execute("""
        UPDATE messages
        SET status = 'read',
            delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP),
            read_at = CURRENT_TIMESTAMP
        WHERE sender_uid = ?
          AND receiver_uid = ?
          AND status != 'read'
    """, (uid, player["uid"]))

    conn.commit()
    updated_count = result.rowcount
    conn.close()

    return {
        "success": True,
        "marked_as_read": updated_count
    }


# ==============================
# OFESTRA PLAYER PRESENCE SYSTEM
# ==============================

@app.post("/presence/heartbeat")
def presence_heartbeat(
    authorization: HTTPAuthorizationCredentials = Depends(security)
):
    player = authenticate(authorization)
    conn = get_db()

    conn.execute("""
        INSERT INTO player_presence (uid, is_online, last_seen)
        VALUES (?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(uid) DO UPDATE SET
            is_online = 1,
            last_seen = CURRENT_TIMESTAMP
    """, (player["uid"],))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "status": "online"
    }


@app.post("/presence/offline")
def presence_offline(
    authorization: HTTPAuthorizationCredentials = Depends(security)
):
    player = authenticate(authorization)
    conn = get_db()

    conn.execute("""
        INSERT INTO player_presence (uid, is_online, last_seen)
        VALUES (?, 0, CURRENT_TIMESTAMP)
        ON CONFLICT(uid) DO UPDATE SET
            is_online = 0,
            last_seen = CURRENT_TIMESTAMP,
            typing_to = NULL,
            typing_updated_at = NULL
    """, (player["uid"],))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "status": "offline"
    }


@app.get("/presence/{uid}")
def get_presence(
    uid: str,
    authorization: HTTPAuthorizationCredentials = Depends(security)
):
    player = authenticate(authorization)
    target_uid = uid.strip().upper()

    conn = get_db()

    if player["uid"] != target_uid:
        friendship = conn.execute("""
            SELECT 1 FROM friends
            WHERE player_uid = ? AND friend_uid = ?
        """, (player["uid"], target_uid)).fetchone()

        if not friendship:
            conn.close()
            raise HTTPException(403, "Presence is available to friends only")

    row = conn.execute("""
        SELECT
            uid,
            CASE
                WHEN is_online = 1
                 AND last_seen >= datetime('now', '-45 seconds')
                THEN 1
                ELSE 0
            END AS is_online,
            last_seen
        FROM player_presence
        WHERE uid = ?
    """, (target_uid,)).fetchone()

    conn.close()

    if not row:
        return {
            "success": True,
            "uid": target_uid,
            "is_online": False,
            "last_seen": None
        }

    return {
        "success": True,
        "uid": row["uid"],
        "is_online": bool(row["is_online"]),
        "last_seen": row["last_seen"]
    }


# ==============================
# OFESTRA TYPING INDICATOR
# ==============================

class TypingData(BaseModel):
    receiver_uid: str = Field(min_length=5, max_length=32)


@app.post("/typing/start")
def typing_start(
    data: TypingData,
    authorization: HTTPAuthorizationCredentials = Depends(security)
):
    player = authenticate(authorization)
    receiver_uid = data.receiver_uid.strip().upper()

    conn = get_db()

    friendship = conn.execute("""
        SELECT 1 FROM friends
        WHERE player_uid = ? AND friend_uid = ?
    """, (player["uid"], receiver_uid)).fetchone()

    if not friendship:
        conn.close()
        raise HTTPException(403, "You can only type to your friends")

    conn.execute("""
        INSERT INTO player_presence
        (uid, is_online, last_seen, typing_to, typing_updated_at)
        VALUES (?, 1, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(uid) DO UPDATE SET
            is_online = 1,
            last_seen = CURRENT_TIMESTAMP,
            typing_to = excluded.typing_to,
            typing_updated_at = CURRENT_TIMESTAMP
    """, (player["uid"], receiver_uid))

    conn.commit()
    conn.close()

    return {"success": True, "typing": True}


@app.post("/typing/stop")
def typing_stop(
    data: TypingData,
    authorization: HTTPAuthorizationCredentials = Depends(security)
):
    player = authenticate(authorization)
    receiver_uid = data.receiver_uid.strip().upper()

    conn = get_db()

    conn.execute("""
        UPDATE player_presence
        SET typing_to = NULL,
            typing_updated_at = NULL
        WHERE uid = ? AND typing_to = ?
    """, (player["uid"], receiver_uid))

    conn.commit()
    conn.close()

    return {"success": True, "typing": False}


@app.get("/typing/{uid}")
def get_typing(
    uid: str,
    authorization: HTTPAuthorizationCredentials = Depends(security)
):
    player = authenticate(authorization)
    target_uid = uid.strip().upper()

    conn = get_db()

    friendship = conn.execute("""
        SELECT 1 FROM friends
        WHERE player_uid = ? AND friend_uid = ?
    """, (player["uid"], target_uid)).fetchone()

    if not friendship:
        conn.close()
        raise HTTPException(403, "Typing status is available to friends only")

    row = conn.execute("""
        SELECT
            CASE
                WHEN typing_to = ?
                 AND typing_updated_at >= datetime('now', '-30 seconds')
                 AND last_seen >= datetime('now', '-45 seconds')
                THEN 1
                ELSE 0
            END AS is_typing
        FROM player_presence
        WHERE uid = ?
    """, (player["uid"], target_uid)).fetchone()

    conn.close()

    return {
        "success": True,
        "uid": target_uid,
        "is_typing": bool(row["is_typing"]) if row else False
    }


class ConnectionManager:
    def __init__(self):
        self.active_connections = {}

    async def connect(self, uid, websocket):
        await websocket.accept()
        self.active_connections.setdefault(uid, set()).add(websocket)

    def disconnect(self, uid, websocket):
        if uid in self.active_connections:
            self.active_connections[uid].discard(websocket)
            if not self.active_connections[uid]:
                del self.active_connections[uid]

    async def send_to_player(self, uid, data):
        for connection in list(self.active_connections.get(uid, set())):
            try:
                await connection.send_json(data)
            except Exception:
                self.disconnect(uid, connection)


ws_manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    uid = None

    try:
        auth_data = await websocket.receive_json()

        # Temporary test key is sent in the first WebSocket message.
        supplied_key = str(auth_data.get("key", ""))
        if not SERVER_SECRET_KEY or not hmac.compare_digest(supplied_key, SERVER_SECRET_KEY):
            await websocket.close(code=4403)
            return

        token = auth_data.get("token", "")
        if not token:
            await websocket.close(code=4401)
            return

        token_hash = hashlib.sha256(token.encode()).hexdigest()
        conn = get_db()

        player = conn.execute("""
            SELECT players.uid
            FROM sessions
            JOIN players ON players.uid = sessions.player_uid
            WHERE sessions.token_hash = ?
              AND sessions.expires_at > ?
        """, (token_hash, int(time.time()))).fetchone()

        conn.close()

        if not player:
            await websocket.close(code=4401)
            return

        uid = player["uid"]
        ws_manager.active_connections.setdefault(uid, set()).add(websocket)

        await websocket.send_json({
            "type": "connected",
            "uid": uid
        })

        while True:
            data = await websocket.receive_json()

            if data.get("type") != "message":
                continue

            receiver_uid = str(data.get("receiver_uid", "")).strip().upper()
            message = str(data.get("message", "")).strip()

            if not receiver_uid or not message or len(message) > 2000:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid message"
                })
                continue

            conn = get_db()

            friendship = conn.execute("""
                SELECT 1 FROM friends
                WHERE player_uid = ? AND friend_uid = ?
            """, (uid, receiver_uid)).fetchone()

            if not friendship:
                conn.close()
                await websocket.send_json({
                    "type": "error",
                    "message": "You can only message your friends"
                })
                continue

            result = conn.execute("""
                INSERT INTO messages (sender_uid, receiver_uid, message)
                VALUES (?, ?, ?)
            """, (uid, receiver_uid, message))

            conn.commit()
            message_id = result.lastrowid

            row = conn.execute("""
                SELECT created_at FROM messages WHERE id = ?
            """, (message_id,)).fetchone()

            conn.close()

            payload = {
                "type": "message",
                "id": message_id,
                "sender_uid": uid,
                "receiver_uid": receiver_uid,
                "message": message,
                "created_at": row["created_at"]
            }

            await websocket.send_json({
                "type": "message_sent",
                "id": message_id
            })

            await ws_manager.send_to_player(receiver_uid, payload)

    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
    finally:
        if uid:
            ws_manager.disconnect(uid, websocket)
