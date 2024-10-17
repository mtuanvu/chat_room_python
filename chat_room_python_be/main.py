from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from firebase_admin import credentials, firestore, initialize_app
import sqlite3
import os
import json

app = FastAPI()

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Khởi tạo Firebase Firestore
firebase_cred_path = "D:/Downloads/python_fire.json"
cred = credentials.Certificate(firebase_cred_path)
initialize_app(cred)
db = firestore.client()

# Khởi tạo SQLite
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, "messages.db")
conn = sqlite3.connect(db_path, check_same_thread=False)
cursor = conn.cursor()
cursor.execute("CREATE TABLE IF NOT EXISTS rooms (room_id TEXT PRIMARY KEY, password TEXT)")
cursor.execute("CREATE TABLE IF NOT EXISTS messages (room_id TEXT, nickname TEXT, content TEXT)")
conn.commit()

# Lưu trữ các kết nối WebSocket theo phòng
room_connections = {}

# Pydantic model cho dữ liệu đầu vào của tạo phòng
class RoomCreate(BaseModel):
    room_id: str
    password: str

# Endpoint tạo phòng
@app.post("/create_room")
async def create_room(room: RoomCreate):
    try:
        cursor.execute("INSERT INTO rooms (room_id, password) VALUES (?, ?)", (room.room_id, room.password))
        conn.commit()
        return {"message": f"Room {room.room_id} created successfully"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Room already exists")

# Endpoint tham gia phòng
@app.post("/join_room")
async def join_room(room: RoomCreate):
    cursor.execute("SELECT * FROM rooms WHERE room_id = ? AND password = ?", (room.room_id, room.password))
    room_exists = cursor.fetchone()
    if room_exists:
        return {"message": f"Joined room {room.room_id} successfully"}
    else:
        raise HTTPException(status_code=401, detail="Invalid Room ID or Password")

# Hàm lưu tin nhắn vào Firebase
def save_message_to_firebase(room_id: str, nickname: str, message: str):
    try:
        db.collection("rooms").document(room_id).collection("messages").add({"nickname": nickname, "content": message})
        print("Message saved to Firebase.")
    except Exception as e:
        print(f"Error saving message to Firebase: {e}")

# Hàm lưu tin nhắn vào SQLite
def save_message_to_sqlite(room_id: str, nickname: str, message: str):
    try:
        cursor.execute("INSERT INTO messages (room_id, nickname, content) VALUES (?, ?, ?)", (room_id, nickname, message))
        conn.commit()
        print("Message saved to SQLite.")
    except sqlite3.Error as e:
        print(f"Error saving message to SQLite: {e}")

# WebSocket xử lý tin nhắn thời gian thực theo phòng
@app.websocket("/ws/{room_id}/{nickname}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, nickname: str):
    await websocket.accept()
    if room_id not in room_connections:
        room_connections[room_id] = set()
    room_connections[room_id].add(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.dumps({"nickname": nickname, "content": data})
            
            # Lưu tin nhắn vào Firebase và SQLite
            save_message_to_firebase(room_id, nickname, data)
            save_message_to_sqlite(room_id, nickname, data)

            # Phát tin nhắn đến tất cả client trong cùng phòng
            for connection in room_connections[room_id]:
                if connection != websocket:
                    await connection.send_text(message_data)
    except Exception as e:
        print("WebSocket Error:", e)
    finally:
        room_connections[room_id].remove(websocket)
        await websocket.close()

# API tải lịch sử tin nhắn từ SQLite
@app.get("/history/{room_id}")
def get_history(room_id: str):
    cursor.execute("SELECT nickname, content FROM messages WHERE room_id = ?", (room_id,))
    messages = cursor.fetchall()
    return [{"nickname": msg[0], "content": msg[1]} for msg in messages]
