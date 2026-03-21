from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from contextlib import asynccontextmanager
from datetime import datetime
import pandas as pd
import os
import secrets

from firebase_utils import init_firebase, get_db
from face_utils import get_face_encoding, match_face

# --- Config ---
ADMIN_USERNAME = "Admin"
ADMIN_PASSWORD = "Pass@123"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ATTENDANCE_EXCEL = os.path.join(BASE_DIR, "Attendance.xlsx")
STUDENTS_EXCEL = os.path.join(BASE_DIR, "Students.xlsx")

# Simple token store (in-memory, resets on restart)
admin_tokens = set()


def _ensure_excel(path, columns):
    """Create an Excel file with headers if it doesn't exist."""
    if not os.path.exists(path):
        pd.DataFrame(columns=columns).to_excel(path, index=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_firebase()
    _ensure_excel(ATTENDANCE_EXCEL, ["Record_ID", "User_ID", "Name", "Email", "Date", "Time", "Method"])
    _ensure_excel(STUDENTS_EXCEL, ["Student_ID", "Name", "Email", "Registered_At"])
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===========================
#   ADMIN AUTH
# ===========================

@app.post("/api/admin/login")
async def admin_login(username: str = Form(...), password: str = Form(...)):
    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        token = secrets.token_hex(16)
        admin_tokens.add(token)
        return {"status": "success", "message": "Login successful.", "token": token}
    return JSONResponse(status_code=401, content={"status": "error", "message": "Invalid username or password."})


def _verify_admin(token: str):
    if token not in admin_tokens:
        raise HTTPException(status_code=403, detail="Unauthorized. Admin login required.")


# ===========================
#   REGISTER STUDENT (Admin)
# ===========================

@app.post("/api/register")
async def register_user(
    name: str = Form(...),
    email: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        image_bytes = await file.read()
        encoding = get_face_encoding(image_bytes)

        if encoding is None:
            return JSONResponse(status_code=400, content={"status": "error", "message": "No face found in the image. Please upload a clear photo."})

        db = get_db()
        if not db:
            return JSONResponse(status_code=500, content={"status": "error", "message": "Database not initialized."})

        user_data = {
            "name": name,
            "email": email,
            "encoding": encoding,
            "created_at": datetime.now().isoformat()
        }

        doc_ref = db.collection("users").document()
        doc_ref.set(user_data)

        # Write to Students Excel
        try:
            _ensure_excel(STUDENTS_EXCEL, ["Student_ID", "Name", "Email", "Registered_At"])
            df = pd.read_excel(STUDENTS_EXCEL)
            new_row = pd.DataFrame([{
                "Student_ID": doc_ref.id,
                "Name": name,
                "Email": email,
                "Registered_At": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }])
            df = pd.concat([df, new_row], ignore_index=True)
            df.to_excel(STUDENTS_EXCEL, index=False)
        except Exception as e:
            print(f"Failed to write to Students Excel: {e}")

        return {"status": "success", "message": f"Student '{name}' registered successfully!", "id": doc_ref.id}
    except Exception as e:
        print(f"Registration error: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": f"Server error: {str(e)}"})


# ===========================
#   RECOGNIZE / MARK ATTENDANCE
# ===========================

@app.post("/api/recognize")
async def recognize_face(file: UploadFile = File(...)):
    image_bytes = await file.read()
    encoding = get_face_encoding(image_bytes)

    if encoding is None:
        return JSONResponse(status_code=400, content={"status": "error", "message": "No face detected. Please look at the camera."})

    db = get_db()
    if not db:
        return JSONResponse(status_code=500, content={"status": "error", "message": "Database not initialized."})

    users_ref = db.collection("users").stream()
    known_encodings = {}
    user_details = {}

    for doc in users_ref:
        data = doc.to_dict()
        if "encoding" in data:
            known_encodings[doc.id] = data["encoding"]
            user_details[doc.id] = data

    matched_id = match_face(encoding, known_encodings)

    if matched_id:
        user = user_details[matched_id]
        now = datetime.now()
        attendance_data = {
            "user_id": matched_id,
            "name": user["name"],
            "email": user.get("email", ""),
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M:%S"),
            "timestamp": now.isoformat(),
            "method": "facial_recognition"
        }
        doc_ref = db.collection("attendance_logs").document()
        doc_ref.set(attendance_data)

        # Write to Attendance Excel
        try:
            _ensure_excel(ATTENDANCE_EXCEL, ["Record_ID", "User_ID", "Name", "Email", "Date", "Time", "Method"])
            df = pd.read_excel(ATTENDANCE_EXCEL)
            new_row = pd.DataFrame([{
                "Record_ID": doc_ref.id,
                "User_ID": matched_id,
                "Name": user["name"],
                "Email": user.get("email", ""),
                "Date": attendance_data["date"],
                "Time": attendance_data["time"],
                "Method": attendance_data["method"]
            }])
            df = pd.concat([df, new_row], ignore_index=True)
            df.to_excel(ATTENDANCE_EXCEL, index=False)
        except Exception as e:
            print(f"Failed to write to Attendance Excel: {e}")

        return {"status": "success", "message": f"Welcome, {user['name']}! Attendance marked.", "user": user["name"]}
    else:
        return JSONResponse(status_code=401, content={"status": "error", "message": "Face not recognized. Please register first."})


# ===========================
#   ATTENDANCE CRUD
# ===========================

@app.get("/api/attendance")
async def get_attendance():
    db = get_db()
    if not db:
        return JSONResponse(status_code=500, content={"status": "error", "message": "Database not initialized."})

    logs = []
    for doc in db.collection("attendance_logs").order_by("timestamp", direction="DESCENDING").stream():
        data = doc.to_dict()
        data["id"] = doc.id
        logs.append(data)
    return {"status": "success", "data": logs}


@app.put("/api/attendance/{record_id}")
async def update_attendance(record_id: str, updates: dict = Body(...)):
    db = get_db()
    if not db:
        return JSONResponse(status_code=500, content={"status": "error", "message": "Database not initialized."})

    doc_ref = db.collection("attendance_logs").document(record_id)
    doc = doc_ref.get()
    if not doc.exists:
        return JSONResponse(status_code=404, content={"status": "error", "message": "Record not found."})

    allowed_fields = {"name", "email", "date", "time", "method"}
    filtered = {k: v for k, v in updates.items() if k in allowed_fields}
    doc_ref.update(filtered)

    # Sync Excel
    _sync_attendance_excel(db)

    return {"status": "success", "message": "Attendance record updated."}


@app.delete("/api/attendance/{record_id}")
async def delete_attendance(record_id: str):
    db = get_db()
    if not db:
        return JSONResponse(status_code=500, content={"status": "error", "message": "Database not initialized."})

    doc_ref = db.collection("attendance_logs").document(record_id)
    doc = doc_ref.get()
    if not doc.exists:
        return JSONResponse(status_code=404, content={"status": "error", "message": "Record not found."})

    doc_ref.delete()

    # Sync Excel
    _sync_attendance_excel(db)

    return {"status": "success", "message": "Attendance record deleted."}


def _sync_attendance_excel(db):
    """Re-write the entire Attendance Excel from Firestore data."""
    try:
        logs = []
        for doc in db.collection("attendance_logs").order_by("timestamp", direction="DESCENDING").stream():
            data = doc.to_dict()
            logs.append({
                "Record_ID": doc.id,
                "User_ID": data.get("user_id", ""),
                "Name": data.get("name", ""),
                "Email": data.get("email", ""),
                "Date": data.get("date", ""),
                "Time": data.get("time", ""),
                "Method": data.get("method", "")
            })
        df = pd.DataFrame(logs) if logs else pd.DataFrame(columns=["Record_ID", "User_ID", "Name", "Email", "Date", "Time", "Method"])
        df.to_excel(ATTENDANCE_EXCEL, index=False)
    except Exception as e:
        print(f"Excel sync error: {e}")


# ===========================
#   STUDENTS LIST
# ===========================

@app.get("/api/students")
async def list_students():
    db = get_db()
    if not db:
        return JSONResponse(status_code=500, content={"status": "error", "message": "Database not initialized."})

    students = []
    for doc in db.collection("users").stream():
        data = doc.to_dict()
        students.append({
            "id": doc.id,
            "name": data.get("name", ""),
            "email": data.get("email", ""),
            "created_at": data.get("created_at", "")
        })
    return {"status": "success", "data": students}


# ===========================
#   STATIC FILES
# ===========================

frontend_dir = os.path.join(BASE_DIR, "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
