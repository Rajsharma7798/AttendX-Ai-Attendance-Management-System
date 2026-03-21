# AttendX — Project Knowledge Base
*Last Updated: 2026-03-22 | v2.0*

---

## 🏗️ What Was Built

AttendX is a **biometric attendance management system** with facial recognition. Built with:
- **Backend:** Python FastAPI + Firebase Firestore
- **Frontend:** Vanilla HTML/CSS/JS (SPA, no framework)
- **AI:** `face_recognition` library (dlib-based) for face encoding & matching

---

## 📁 File Map

| File | Purpose |
|------|---------|
| `server/main.py` | All API endpoints, Excel sync, admin auth |
| `server/firebase_utils.py` | Firebase init, Firestore `get_db()` helper |
| `server/face_utils.py` | `get_face_encoding()`, `match_face()` |
| `frontend/index.html` | All views in one HTML (role select, student, admin) |
| `frontend/app.js` | All JS: nav switching, camera, fetch calls |
| `frontend/style.css` | Dark glass-morphism theme, responsive |
| `serviceAccountKey.json` | Firebase service account (NOT in git) |
| `firebase.json` | Firebase CLI hosting config |
| `firestore.rules` | Firestore security rules |
| `requirements.txt` | Python dependencies |
| `Attendance.xlsx` | Auto-generated attendance log |
| `Students.xlsx` | Auto-generated student registry |

---

## 🔑 Key Config Values

| Setting | Value |
|---------|-------|
| Firebase Project ID | `attendx-system-1234` |
| Firestore region | `nam5` (multi-region) |
| Admin username | `Admin` |
| Admin password | `Pass@123` |
| Server port | `8000` |
| Python version | `3.10` |
| venv path | `c:\Project\AttendX\venv\` |

---

## 🚦 How to Start the Server

```powershell
# From c:\Project\AttendX\server\
c:\Project\AttendX\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Then open: **http://localhost:8000**

---

## 🔥 Firestore Collections

### `users` (registered students)
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "encoding": [...],       // 128-dim face vector
  "created_at": "ISO string"
}
```

### `attendance_logs`
```json
{
  "user_id": "docId",
  "name": "John Doe",
  "email": "john@example.com",
  "date": "YYYY-MM-DD",
  "time": "HH:MM:SS",
  "timestamp": "ISO string",
  "method": "facial_recognition"
}
```

---

## 🌐 API Reference

| Method | Endpoint | Auth | Body |
|--------|----------|------|------|
| POST | `/api/admin/login` | — | `username`, `password` (form) |
| POST | `/api/register` | — | `name`, `email`, `file` (form) |
| POST | `/api/recognize` | — | `file` (form) |
| GET | `/api/attendance` | — | — |
| PUT | `/api/attendance/{id}` | — | `{name, email, date, time}` JSON |
| DELETE | `/api/attendance/{id}` | — | — |
| GET | `/api/students` | — | — |

---

## 🎨 Frontend Architecture

All views live in `index.html`. Navigation is client-side only (no page reloads):

```
Role Selection  →  Student Panel  →  Mark Attendance (camera)
                                 →  View Attendance (table)
             →  Admin Login     →  Admin Panel  →  Register Student
                                               →  Attendance Sheet (edit/delete)
```

JS state management (in `app.js`):
- `stream` — active MediaStream from camera
- `adminToken` — stored in `sessionStorage` on login
- `attendanceData` — cached array of attendance records
- `currentRole` — `'student'` | `'admin'`

---

## 🐛 Known Issues / Decisions

1. **Admin tokens are in-memory** — cleared on server restart. Users must re-login.
2. **No email in recognition results** — email is fetched from Firestore at mark time.
3. **Face recognition threshold** — uses `face_recognition` default (0.6 tolerance). Adjustable in `face_utils.py`.
4. **Font Awesome removed** — replaced with Unicode emoji (CDN was blocked).
5. **`dlib` wheel** — must be installed from local `.whl` (not on PyPI for Python 3.10 Windows).

---

## 📦 Dependencies

```
fastapi          # Web framework
uvicorn          # ASGI server
pandas           # Excel read/write
openpyxl         # Excel file engine
numpy            # Array math for face encodings
opencv-python-headless  # Image processing
face_recognition # Face encode/match
Pillow           # Image handling
firebase-admin   # Firebase SDK
google-cloud-firestore  # Firestore client
```

---

## 💬 AI Chat Context

This project was built with assistance from the Antigravity AI coding assistant (Google DeepMind) across multiple conversations:

| Conversation Topic | What Was Done |
|---|---|
| Building Biometric Attendance System | Initial project scaffold, face recognition setup |
| Fixing Import Errors (CV2, numpy, firebase) | Resolved venv import issues |
| Fixing Connection Errors | Fixed server crash on unrecognized faces |
| Fixing Firebase Admin Import | Corrected venv Python path |
| Adding Student/Admin Panels | Full role-based UI rebuild, Excel sync, admin auth |

All conversation logs are stored at:
`C:\Users\Raj Jagesh Sharma\.gemini\antigravity\brain\2a0e3aab-6515-4cb1-b629-3c0f60c80d8f\`

---

## 🔮 Possible Future Improvements

- [ ] Real admin authentication (hashed passwords, JWT)
- [ ] Per-student attendance filtering (student views own records only)
- [ ] Email notifications on attendance marked
- [ ] QR code fallback when face not recognized
- [ ] Dashboard with attendance statistics/charts
- [ ] Export filtered attendance to Excel
- [ ] Multi-camera support
