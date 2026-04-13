# 🎓 AttendX — Smart Biometric Attendance System

> A facial-recognition-based attendance management system with separate Student and Admin portals, Firebase Firestore backend, and Excel data export.

---

## 🚀 Features

### 👨‍🎓 Student Portal
- **Mark Attendance** — Live camera + facial recognition via webcam
- **View Attendance** — Read-only table of all attendance logs

### 🛡️ Admin Portal (Login required)
- **Login** — `Username: Admin` | `Password: Pass@123`
- **Register Students** — Enroll students individually or in bulk via Group Registration (auto-detects and crops up to 4 faces from a group photo).
- **Attendance Sheet** — Full CRUD: view, edit, and delete any attendance record

### 📊 Excel Sync
| File | Updated When |
|------|-------------|
| `Attendance.xlsx` | Every attendance mark, edit, or delete |
| `Students.xlsx` | Every new student registration |

---

## 🗂️ Project Structure

```
AttendX/
├── frontend/
│   ├── index.html        ← Main SPA with all views
│   ├── app.js            ← All JS: navigation, camera, API calls
│   └── style.css         ← Full dark-themed CSS
├── server/
│   ├── main.py           ← FastAPI backend (all endpoints)
│   ├── firebase_utils.py ← Firebase init + Firestore helpers
│   └── face_utils.py     ← Face encoding + matching logic
├── serviceAccountKey.json  ← Firebase credentials (NOT in git)
├── firebase.json           ← Firebase CLI config
├── firestore.rules         ← Firestore security rules
├── requirements.txt        ← Python dependencies
├── Attendance.xlsx         ← Auto-generated attendance log
└── Students.xlsx           ← Auto-generated student registry
```

---

## ⚙️ Setup & Run

### 1. Prerequisites
- Python 3.10
- A Firebase project with Firestore enabled
- A `serviceAccountKey.json` (place in project root)

### 2. Create Virtual Environment
```powershell
cd c:\Project\AttendX
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 3. Install Dependencies
```powershell
pip install -r requirements.txt
```

> **Note:** `dlib` is installed from the local `.whl` file:
> ```powershell
> pip install dlib-19.22.99-cp310-cp310-win_amd64.whl
> ```

### 4. Start the Server
```powershell
cd server
..\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Open in Browser
```
http://localhost:8000
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/login` | Admin authentication |
| `POST` | `/api/register` | Register a new student |
| `POST` | `/api/admin/register-group-preview` | Extract faces from a group photo |
| `POST` | `/api/admin/register-group-submit` | Register multiple students securely |
| `POST` | `/api/recognize` | Recognize face & mark attendance |
| `POST` | `/api/attendance/manual` | Manually mark attendance (fallback) |
| `GET` | `/api/attendance` | Get all attendance logs |
| `PUT` | `/api/attendance/{id}` | Update an attendance record |
| `DELETE` | `/api/attendance/{id}` | Delete an attendance record |
| `GET` | `/api/students` | List all registered students |

---

## 🔥 Firebase Setup

- **Project ID:** `attendx-system-1234`
- **Service:** Firestore (Native mode, `nam5` region)
- **Collections:**
  - `users` — registered students + face encodings
  - `attendance_logs` — attendance records

---

## 🐍 Dependencies (`requirements.txt`)

```
fastapi
uvicorn
pandas
openpyxl
numpy
opencv-python-headless
face_recognition
Pillow
firebase-admin
google-cloud-firestore
python-multipart
```

---

## 📝 Admin Credentials

| Field | Value |
|-------|-------|
| Username | `Admin` |
| Password | `Pass@123` |

> These are hardcoded in `server/main.py` for local development.

---

## 🗒️ Development Notes

- **No CDN dependencies** — All icons use Unicode emoji (no Font Awesome)
- **SPA navigation** — All view switching is client-side JS (no page reloads)
- **Excel files** auto-create with correct headers on first run
- **Admin tokens** are in-memory only (reset on server restart)
- **Camera** uses `getUserMedia` — browser must allow camera access

---

## 📅 Changelog

### v2.1 — 2026-03-24
- Added Student Image Upload for attendance marking
- Added Manual Attendance Form for students
- Added Group Registration for Admins (auto-detects up to 4 faces from a group photo)
- Upgraded Docker image base tag to `2.1`

### v2.0 — 2026-03-22
- Added Student/Admin role selection landing page
- Implemented Admin login with session token
- Added student registration under Admin panel
- Added attendance view/edit/delete for Admin
- Added Excel sync for all data
- Fixed Font Awesome dependency (replaced with emoji)

### v1.0 — 2026-03-21
- Initial release
- Facial recognition attendance marking
- Firebase Firestore integration
