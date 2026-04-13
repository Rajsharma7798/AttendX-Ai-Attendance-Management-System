const API_BASE = window.location.protocol === 'file:'
    ? 'http://127.0.0.1:8000/api'
    : `${window.location.origin}/api`;

// ===========================
//   STATE
// ===========================
let stream = null;
let adminToken = sessionStorage.getItem('adminToken') || null;
let currentRole = null; // 'student' | 'admin'

// ===========================
//   ELEMENT REFS
// ===========================
const navLinks = document.getElementById('navLinks');
const allViews = () => document.querySelectorAll('.view');

// ===========================
//   VIEW HELPERS
// ===========================
function showView(id) {
    allViews().forEach(v => {
        v.classList.remove('active-view');
        v.classList.add('hidden-view');
    });
    const target = document.getElementById(id);
    if (target) {
        target.classList.remove('hidden-view');
        target.classList.add('active-view');
    }
}

function buildStudentNav(active) {
    navLinks.innerHTML = `
        <button class="nav-back-btn" onclick="backToRoles()">
            ← Back
        </button>
        <a href="#" id="nav-mark" class="${active === 'mark' ? 'active' : ''}"
           onclick="switchStudentTab('mark', event)">
           📷 Mark Attendance
        </a>
        <a href="#" id="nav-view" class="${active === 'view' ? 'active' : ''}"
           onclick="switchStudentTab('view', event)">
           📋 View Attendance
        </a>`;
}

function buildAdminNav(active) {
    navLinks.innerHTML = `
        <button class="nav-back-btn" onclick="adminLogout()">
            🚪 Logout
        </button>
        <a href="#" id="nav-register" class="${active === 'register' ? 'active' : ''}"
           onclick="switchAdminTab('register', event)">
           ➕ Register Student
        </a>
        <a href="#" id="nav-admin-mark" class="${active === 'admin-mark' ? 'active' : ''}"
           onclick="switchAdminTab('admin-mark', event)">
           📝 Process Attendance
        </a>
        <a href="#" id="nav-sheet" class="${active === 'sheet' ? 'active' : ''}"
           onclick="switchAdminTab('sheet', event)">
           📊 Attendance Sheet
        </a>`;
}

function clearNav() {
    navLinks.innerHTML = '';
}

// ===========================
//   ROLE SELECTION
// ===========================
function backToRoles() {
    currentRole = null;
    stopCamera();
    clearNav();
    showView('roleSelection');
}

function showStudentPanel() {
    currentRole = 'student';
    buildStudentNav('mark');
    showView('studentAttendanceView');
    startCamera();
    // Fill manual form defaults
    const today = new Date();
    const dd = String(today.getDate()).padStart(2,'0');
    const mm = String(today.getMonth()+1).padStart(2,'0');
    const dateEl = document.getElementById('manualDate');
    const timeEl = document.getElementById('manualTime');
    if (dateEl) dateEl.value = `${today.getFullYear()}-${mm}-${dd}`;
    if (timeEl) timeEl.value = today.toTimeString().slice(0,8);
}

function showAdminPanel() {
    currentRole = 'admin';
    if (adminToken) {
        buildAdminNav('register');
        showView('adminRegisterView');
    } else {
        clearNav();
        showView('adminLoginView');
    }
}

// ===========================
//   STUDENT TABS
// ===========================
function switchStudentTab(tab, event) {
    if (event) event.preventDefault();
    buildStudentNav(tab);
    if (tab === 'mark') {
        showView('studentAttendanceView');
        startCamera();
        // Fill manual form defaults
        const today = new Date();
        const dd = String(today.getDate()).padStart(2,'0');
        const mm = String(today.getMonth()+1).padStart(2,'0');
        const dateEl = document.getElementById('manualDate');
        const timeEl = document.getElementById('manualTime');
        if (dateEl) dateEl.value = `${today.getFullYear()}-${mm}-${dd}`;
        if (timeEl) timeEl.value = today.toTimeString().slice(0,8);
    } else {
        stopCamera();
        showView('studentViewAttendance');
        loadAttendanceTable('studentAttendanceBody', false);
    }
}

// ===========================
//   ADMIN TABS
// ===========================
function switchAdminTab(tab, event) {
    if (event) event.preventDefault();
    buildAdminNav(tab);
    if (tab === 'register') {
        showView('adminRegisterView');
    } else if (tab === 'admin-mark') {
        showView('adminMarkAttendanceView');
        // Initialize Admin-side manual entry date/time
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        document.getElementById('adminManualDate').value = `${today.getFullYear()}-${mm}-${dd}`;
        document.getElementById('adminManualTime').value = today.toTimeString().slice(0, 8);
    } else {
        showView('adminAttendanceView');
        loadAttendanceTable('adminAttendanceBody', true);
    }
}

// ===========================
//   CAMERA
// ===========================
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        const video = document.getElementById('liveVideo');
        if (video) video.srcObject = stream;
    } catch (err) {
        console.error('Camera error:', err);
        showMessage('attendanceResult', 'Camera access denied. Please allow camera permissions.', 'error');
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
        const video = document.getElementById('liveVideo');
        if (video) video.srcObject = null;
    }
}

function captureFrame() {
    const video = document.getElementById('liveVideo');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}

// ===========================
//   MESSAGES
// ===========================
function showMessage(elementId, text, type) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const icon = type === 'success' ? '✅' : '❌';
    el.className = `result-message ${type}`;
    el.innerHTML = `${icon} ${text}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 8000);
}

// ===========================
//   CAPTURE / MARK ATTENDANCE
// ===========================
document.getElementById('captureBtn').addEventListener('click', async () => {
    const captureBtn = document.getElementById('captureBtn');
    const loader = document.getElementById('loader');
    const cameraContainer = document.querySelector('.camera-container');
    if (!stream) return;

    captureBtn.disabled = true;
    captureBtn.textContent = '⏳ Processing...';
    loader.classList.remove('hidden');
    cameraContainer.classList.add('scanning');

    try {
        const blob = await captureFrame();
        const fd = new FormData();
        fd.append('file', blob, 'frame.jpg');

        const res = await fetch(`${API_BASE}/recognize`, { method: 'POST', body: fd });
        const data = await res.json();
        showMessage('attendanceResult', data.message, res.ok ? 'success' : 'error');
    } catch (err) {
        showMessage('attendanceResult', 'Could not connect to server. Is it running?', 'error');
    } finally {
        captureBtn.disabled = false;
        captureBtn.textContent = '🔍 Authenticate & Log';
        loader.classList.add('hidden');
        cameraContainer.classList.remove('scanning');
    }
});

// ===========================
//   PHOTO UPLOAD (Register)
// ===========================
const uploadArea = document.getElementById('uploadArea');
const photoInput = document.getElementById('userPhoto');
const previewImage = document.getElementById('previewImage');
const retakeBtn = document.getElementById('retakeBtn');

uploadArea.addEventListener('click', (e) => {
    if (e.target !== retakeBtn) photoInput.click();
});

photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        previewImage.src = ev.target.result;
        previewImage.classList.remove('hidden');
        retakeBtn.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
});

retakeBtn.addEventListener('click', () => {
    photoInput.value = '';
    previewImage.src = '';
    previewImage.classList.add('hidden');
    retakeBtn.classList.add('hidden');
});

// ===========================
//   REGISTER STUDENT
// ===========================
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const file = photoInput.files[0];
    const btn = document.getElementById('submitRegisterBtn');

    if (!file) {
        showMessage('registerResult', 'Please upload a face photo.', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Processing...';

    const fd = new FormData();
    fd.append('name', name);
    fd.append('email', email);
    fd.append('file', file);

    try {
        const res = await fetch(`${API_BASE}/register`, { method: 'POST', body: fd });
        const data = await res.json();
        if (res.ok) {
            showMessage('registerResult', data.message, 'success');
            document.getElementById('registerForm').reset();
            retakeBtn.click();
        } else {
            showMessage('registerResult', data.message || 'Registration failed.', 'error');
        }
    } catch (err) {
        showMessage('registerResult', 'Could not connect to server.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '➕ Register Student';
    }
});

// ===========================
//   ADMIN LOGIN
// ===========================
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    const btn = document.getElementById('adminLoginBtn');

    btn.disabled = true;
    btn.textContent = '⏳ Signing in...';

    const fd = new FormData();
    fd.append('username', username);
    fd.append('password', password);

    try {
        const res = await fetch(`${API_BASE}/admin/login`, { method: 'POST', body: fd });
        const data = await res.json();
        if (res.ok) {
            adminToken = data.token;
            sessionStorage.setItem('adminToken', adminToken);
            buildAdminNav('register');
            showView('adminRegisterView');
        } else {
            showMessage('loginResult', data.message || 'Login failed.', 'error');
        }
    } catch (err) {
        showMessage('loginResult', 'Could not connect to server.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🚪 Sign In';
    }
});

function adminLogout() {
    adminToken = null;
    sessionStorage.removeItem('adminToken');
    backToRoles();
}

// ===========================
//   ATTENDANCE TABLE
// ===========================
let attendanceData = [];

async function loadAttendanceTable(tbodyId, isAdmin) {
    const tbody = document.getElementById(tbodyId);
    const cols = isAdmin ? 7 : 6;
    tbody.innerHTML = `<tr><td colspan="${cols}" class="empty-state"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE}/attendance`);
        const data = await res.json();

        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="${cols}" class="empty-state">Failed to load records.</td></tr>`;
            return;
        }

        attendanceData = data.data || [];
        renderAttendanceTable(tbodyId, isAdmin);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="${cols}" class="empty-state">Server error. Please check the backend.</td></tr>`;
    }
}

function renderAttendanceTable(tbodyId, isAdmin) {
    const tbody = document.getElementById(tbodyId);
    const cols = isAdmin ? 7 : 6;

    if (!attendanceData.length) {
        tbody.innerHTML = `<tr><td colspan="${cols}" class="empty-state">No attendance records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = attendanceData.map((row, i) => {
        const method = row.method === 'facial_recognition'
            ? '<span class="badge badge-face">🤖 Face</span>'
            : row.method === 'photo_upload'
            ? '<span class="badge badge-upload">📤 Upload</span>'
            : row.method === 'manual'
            ? '<span class="badge badge-manual">✍️ Manual</span>'
            : row.method || '-';

        const actionsCells = isAdmin ? `
            <td>
                <div class="td-actions">
                    <button class="btn edit-btn" onclick="openEditModal('${row.id}')">
                        ✏️ Edit
                    </button>
                    <button class="btn danger-btn" onclick="deleteRecord('${row.id}')">
                        🗑️
                    </button>
                </div>
            </td>` : '';

        return `<tr>
            <td>${i + 1}</td>
            <td>${row.name || '-'}</td>
            <td>${row.email || '-'}</td>
            <td>${row.date || '-'}</td>
            <td>${row.time || '-'}</td>
            <td>${method}</td>
            ${actionsCells}
        </tr>`;
    }).join('');
}

// ===========================
//   EDIT MODAL
// ===========================
function openEditModal(id) {
    const row = attendanceData.find(r => r.id === id);
    if (!row) return;

    document.getElementById('editRecordId').value = id;
    document.getElementById('editName').value = row.name || '';
    document.getElementById('editEmail').value = row.email || '';
    document.getElementById('editDate').value = row.date || '';
    document.getElementById('editTime').value = row.time || '';
    document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
}

// Close modal on overlay click
document.getElementById('editModal').addEventListener('click', function(e) {
    if (e.target === this) closeEditModal();
});

document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editRecordId').value;
    const updates = {
        name: document.getElementById('editName').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        date: document.getElementById('editDate').value,
        time: document.getElementById('editTime').value,
    };
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '⏳ Saving...';

    try {
        const res = await fetch(`${API_BASE}/attendance/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        const data = await res.json();
        if (res.ok) {
            closeEditModal();
            loadAttendanceTable('adminAttendanceBody', true);
        } else {
            alert(data.message || 'Update failed.');
        }
    } catch (err) {
        alert('Could not connect to server.');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Save Changes';
    }
});

async function deleteRecord(id) {
    if (!confirm('Delete this attendance record permanently?')) return;

    try {
        const res = await fetch(`${API_BASE}/attendance/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            loadAttendanceTable('adminAttendanceBody', true);
        } else {
            alert(data.message || 'Delete failed.');
        }
    } catch (err) {
        alert('Could not connect to server.');
    }
}

// ===========================
//   INIT
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    // Start at role selection every time (don't auto-login to admin panel)
    showView('roleSelection');
    clearNav();
});

// ===========================
//   UPLOAD ATTENDANCE (Multi-Face)
// ===========================
const uploadAttendanceArea  = document.getElementById('uploadAttendanceArea');
const uploadAttendancePhoto = document.getElementById('uploadAttendancePhoto');
const uploadAttendancePreview = document.getElementById('uploadAttendancePreview');
const retakeUploadBtn       = document.getElementById('retakeUploadBtn');

uploadAttendanceArea.addEventListener('click', (e) => {
    if (e.target !== retakeUploadBtn) uploadAttendancePhoto.click();
});

uploadAttendancePhoto.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        uploadAttendancePreview.src = ev.target.result;
        uploadAttendancePreview.classList.remove('hidden');
        retakeUploadBtn.classList.remove('hidden');
        document.getElementById('faceResultsGrid').classList.add('hidden');
        document.getElementById('faceResultsGrid').innerHTML = '';
    };
    reader.readAsDataURL(file);
});

retakeUploadBtn.addEventListener('click', () => {
    uploadAttendancePhoto.value = '';
    uploadAttendancePreview.src = '';
    uploadAttendancePreview.classList.add('hidden');
    retakeUploadBtn.classList.add('hidden');
    document.getElementById('faceResultsGrid').classList.add('hidden');
    document.getElementById('faceResultsGrid').innerHTML = '';
});

document.getElementById('recognizeUploadBtn').addEventListener('click', async () => {
    const file = uploadAttendancePhoto.files[0];
    if (!file) {
        alert('Please upload a photo first.');
        return;
    }

    const btn = document.getElementById('recognizeUploadBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Analyzing...';

    const fd = new FormData();
    fd.append('file', file);

    try {
        const res = await fetch(`${API_BASE}/recognize-upload`, { method: 'POST', body: fd });
        const data = await res.json();
        const grid = document.getElementById('faceResultsGrid');

        if (!res.ok) {
            grid.innerHTML = `<div class="face-result-card card-error"><span class="face-num">Upload Error</span><span class="face-name">❌ Failed</span><span class="face-msg">${data.message}</span></div>`;
            grid.classList.remove('hidden');
            return;
        }

        const statusIcon = { success: '✅', error: '❌', duplicate: '⚠️' };
        const statusClass = { success: 'card-success', error: 'card-error', duplicate: 'card-duplicate' };

        grid.innerHTML = data.results.map(r => `
            <div class="face-result-card ${statusClass[r.status] || ''} ">
                <span class="face-num">Face ${r.face}</span>
                <span class="face-name">${statusIcon[r.status] || ''} ${r.name}</span>
                <span class="face-msg">${r.message}</span>
            </div>
        `).join('');
        grid.classList.remove('hidden');

        // Summary banner
        const total = data.total_faces;
        const recorded = data.recorded;
        const summary = document.getElementById('attendanceResult');
        showMessage('attendanceResult',
            `Detected ${total} face${total !== 1 ? 's' : ''} — ${recorded} attendance record${recorded !== 1 ? 's' : ''} saved.`,
            recorded > 0 ? 'success' : 'error'
        );
    } catch (err) {
        showMessage('attendanceResult', 'Could not connect to server. Is it running?', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🔍 Recognize & Mark All';
    }
});

// ===========================
//   MANUAL ATTENDANCE ENTRY
// ===========================
document.getElementById('manualAttendanceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name  = document.getElementById('manualName').value.trim();
    const email = document.getElementById('manualEmail').value.trim();
    const date  = document.getElementById('manualDate').value;
    const time  = document.getElementById('manualTime').value;
    const btn   = document.getElementById('submitManualBtn');

    btn.disabled = true;
    btn.textContent = '⏳ Submitting...';

    const fd = new FormData();
    fd.append('name',  name);
    fd.append('email', email);
    fd.append('date',  date);
    fd.append('time',  time);

    try {
        const res  = await fetch(`${API_BASE}/attendance/manual`, { method: 'POST', body: fd });
        const data = await res.json();
        showMessage('manualAttendanceResult', data.message, res.ok ? 'success' : 'error');
        if (res.ok) {
            document.getElementById('manualAttendanceForm').reset();
            // Re-set defaults
            const today = new Date();
            const dd = String(today.getDate()).padStart(2,'0');
            const mm = String(today.getMonth()+1).padStart(2,'0');
            document.getElementById('manualDate').value = `${today.getFullYear()}-${mm}-${dd}`;
            document.getElementById('manualTime').value = today.toTimeString().slice(0,8);
        }
    } catch (err) {
        showMessage('manualAttendanceResult', 'Could not connect to server. Is it running?', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '✅ Submit Manual Entry';
    }
});
// ===========================
//   ADMIN: ATTENDANCE PROCESSING
// ===========================

// 1. Admin Photo Upload Area
const adminUploadArea = document.getElementById('adminUploadAttendanceArea');
const adminUploadPhoto = document.getElementById('adminUploadAttendancePhoto');
const adminPreviewImg = document.getElementById('adminUploadAttendancePreview');
const adminRetakeBtn = document.getElementById('adminRetakeUploadBtn');

adminUploadArea.addEventListener('click', () => adminUploadPhoto.click());

['dragover', 'dragleave', 'drop'].forEach(evName => {
    adminUploadArea.addEventListener(evName, (e) => {
        e.preventDefault();
        if (evName === 'dragover') adminUploadArea.classList.add('dragover');
        else adminUploadArea.classList.remove('dragover');
        if (evName === 'drop') {
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                adminUploadPhoto.files = e.dataTransfer.files;
                adminUploadPhoto.dispatchEvent(new Event('change'));
            }
        }
    });
});

adminUploadPhoto.addEventListener('change', () => {
    const file = adminUploadPhoto.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        adminPreviewImg.src = ev.target.result;
        adminPreviewImg.classList.remove('hidden');
        adminRetakeBtn.classList.remove('hidden');
        document.getElementById('adminFaceResultsGrid').classList.add('hidden');
        document.getElementById('adminFaceResultsGrid').innerHTML = '';
    };
    reader.readAsDataURL(file);
});

adminRetakeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    adminUploadPhoto.value = '';
    adminPreviewImg.src = '';
    adminPreviewImg.classList.add('hidden');
    adminRetakeBtn.classList.add('hidden');
    document.getElementById('adminFaceResultsGrid').classList.add('hidden');
    document.getElementById('adminFaceResultsGrid').innerHTML = '';
});

// 2. Admin Multi-Face Recognition
document.getElementById('adminRecognizeUploadBtn').addEventListener('click', async () => {
    const file = adminUploadPhoto.files[0];
    if (!file) {
        alert('Please upload a photo first.');
        return;
    }

    const btn = document.getElementById('adminRecognizeUploadBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Analyzing...';

    const fd = new FormData();
    fd.append('file', file);

    try {
        const res = await fetch(`${API_BASE}/recognize-upload`, { method: 'POST', body: fd });
        const data = await res.json();
        const grid = document.getElementById('adminFaceResultsGrid');

        if (!res.ok) {
            grid.innerHTML = `<div class="face-result-card card-error"><span class="face-num">Upload Error</span><span class="face-name">❌ Failed</span><span class="face-msg">${data.message}</span></div>`;
            grid.classList.remove('hidden');
            return;
        }

        const iconMap = { success: '✅', error: '❌', duplicate: '⚠️' };
        const classMap = { success: 'card-success', error: 'card-error', duplicate: 'card-duplicate' };

        grid.innerHTML = data.results.map(r => `
            <div class="face-result-card ${classMap[r.status] || ''}">
                <span class="face-num">Face ${r.face}</span>
                <span class="face-name">${iconMap[r.status] || ''} ${r.name}</span>
                <span class="face-msg">${r.message}</span>
            </div>
        `).join('');
        grid.classList.remove('hidden');

        const total = data.total_faces;
        const recorded = data.recorded;
        // Using a generic way to show a global message if needed, or just let the grid speak.
        // For Admin, we can reuse showMessage with an alert if we want.
    } catch (err) {
        alert('Could not connect to server.');
    } finally {
        btn.disabled = false;
        btn.textContent = '🔍 Recognize & Mark All';
    }
});

// 3. Admin Manual Attendance Entry
document.getElementById('adminManualAttendanceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name  = document.getElementById('adminManualName').value.trim();
    const email = document.getElementById('adminManualEmail').value.trim();
    const date  = document.getElementById('adminManualDate').value;
    const time  = document.getElementById('adminManualTime').value;
    const btn   = document.getElementById('adminSubmitManualBtn');

    btn.disabled = true;
    btn.textContent = '⏳ Submitting...';

    const fd = new FormData();
    fd.append('name',  name);
    fd.append('email', email);
    fd.append('date',  date);
    fd.append('time',  time);

    try {
        const res  = await fetch(`${API_BASE}/attendance/manual`, { method: 'POST', body: fd });
        const data = await res.json();
        showMessage('adminManualAttendanceResult', data.message, res.ok ? 'success' : 'error');
        if (res.ok) {
            document.getElementById('adminManualAttendanceForm').reset();
            // Re-set defaults
            const today = new Date();
            const dd = String(today.getDate()).padStart(2,'0');
            const mm = String(today.getMonth()+1).padStart(2,'0');
            document.getElementById('adminManualDate').value = `${today.getFullYear()}-${mm}-${dd}`;
            document.getElementById('adminManualTime').value = today.toTimeString().slice(0,8);
        }
    } catch (err) {
        showMessage('adminManualAttendanceResult', 'Could not connect to server.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '✅ Submit Manual Entry';
    }
});

// ===========================
//   ADMIN: GROUP REGISTRATION
// ===========================
const adminGroupUploadArea = document.getElementById('adminGroupUploadArea');
const adminGroupPhoto = document.getElementById('adminGroupPhoto');
const adminGroupPreview = document.getElementById('adminGroupPreview');
const adminGroupRetakeBtn = document.getElementById('adminGroupRetakeBtn');
const adminGroupScanBtn = document.getElementById('adminGroupScanBtn');
const adminGroupFormsContainer = document.getElementById('adminGroupFormsContainer');
const adminGroupSubmitBtn = document.getElementById('adminGroupSubmitBtn');
const adminGroupRegisterResult = document.getElementById('adminGroupRegisterResult');

let currentGroupFaces = [];

if (adminGroupUploadArea) {
    adminGroupUploadArea.addEventListener('click', () => adminGroupPhoto.click());

    ['dragover', 'dragleave', 'drop'].forEach(evName => {
        adminGroupUploadArea.addEventListener(evName, (e) => {
            e.preventDefault();
            if (evName === 'dragover') adminGroupUploadArea.classList.add('dragover');
            else adminGroupUploadArea.classList.remove('dragover');
            if (evName === 'drop') {
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    adminGroupPhoto.files = e.dataTransfer.files;
                    adminGroupPhoto.dispatchEvent(new Event('change'));
                }
            }
        });
    });

    adminGroupPhoto.addEventListener('change', () => {
        const file = adminGroupPhoto.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            adminGroupPreview.src = ev.target.result;
            adminGroupPreview.classList.remove('hidden');
            adminGroupRetakeBtn.classList.remove('hidden');
            adminGroupFormsContainer.classList.add('hidden');
            adminGroupFormsContainer.innerHTML = '';
            adminGroupSubmitBtn.classList.add('hidden');
            adminGroupScanBtn.classList.remove('hidden');
            adminGroupRegisterResult.classList.add('hidden');
            currentGroupFaces = [];
        };
        reader.readAsDataURL(file);
    });

    adminGroupRetakeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        adminGroupPhoto.value = '';
        adminGroupPreview.src = '';
        adminGroupPreview.classList.add('hidden');
        adminGroupRetakeBtn.classList.add('hidden');
        adminGroupFormsContainer.classList.add('hidden');
        adminGroupFormsContainer.innerHTML = '';
        adminGroupSubmitBtn.classList.add('hidden');
        adminGroupScanBtn.classList.remove('hidden');
        adminGroupRegisterResult.classList.add('hidden');
        currentGroupFaces = [];
    });

    adminGroupScanBtn.addEventListener('click', async () => {
        const file = adminGroupPhoto.files[0];
        if (!file) {
            showMessage('adminGroupRegisterResult', 'Please upload a photo first.', 'error');
            return;
        }

        adminGroupScanBtn.disabled = true;
        adminGroupScanBtn.textContent = '⏳ Scanning...';
        adminGroupRegisterResult.classList.add('hidden');

        const fd = new FormData();
        fd.append('file', file);

        try {
            const res = await fetch(`${API_BASE}/admin/register-group-preview`, { method: 'POST', body: fd });
            const data = await res.json();
            
            if (!res.ok) {
                showMessage('adminGroupRegisterResult', data.message || 'Scan failed.', 'error');
                return;
            }

            currentGroupFaces = data.faces;
            adminGroupScanBtn.classList.add('hidden');
            adminGroupFormsContainer.innerHTML = '';

            currentGroupFaces.forEach((face, index) => {
                const formHtml = `
                    <div class="group-face-card" data-index="${index}">
                        <img src="data:image/jpeg;base64,${face.face_image_b64}" alt="Face ${index + 1}">
                        <div class="group-face-inputs">
                            <input type="text" class="group-name-input" placeholder="Face ${index + 1} Name" required>
                            <input type="email" class="group-email-input" placeholder="Face ${index + 1} Email" required>
                        </div>
                    </div>
                `;
                adminGroupFormsContainer.insertAdjacentHTML('beforeend', formHtml);
            });

            adminGroupFormsContainer.classList.remove('hidden');
            adminGroupSubmitBtn.classList.remove('hidden');
            
        } catch (err) {
            showMessage('adminGroupRegisterResult', 'Could not connect to server.', 'error');
        } finally {
            adminGroupScanBtn.disabled = false;
            adminGroupScanBtn.textContent = '🔍 Scan Group Image';
        }
    });

    adminGroupSubmitBtn.addEventListener('click', async () => {
        const cards = adminGroupFormsContainer.querySelectorAll('.group-face-card');
        const studentsData = [];
        let isValid = true;

        cards.forEach(card => {
            const index = card.getAttribute('data-index');
            const nameInput = card.querySelector('.group-name-input');
            const emailInput = card.querySelector('.group-email-input');

            if (!nameInput.value.trim() || !emailInput.value.trim()) {
                isValid = false;
                nameInput.style.borderColor = '#ff4d4f';
                emailInput.style.borderColor = '#ff4d4f';
            } else {
                nameInput.style.borderColor = 'rgba(255,255,255,0.2)';
                emailInput.style.borderColor = 'rgba(255,255,255,0.2)';
                studentsData.push({
                    name: nameInput.value.trim(),
                    email: emailInput.value.trim(),
                    encoding: currentGroupFaces[index].encoding
                });
            }
        });

        if (!isValid) {
            showMessage('adminGroupRegisterResult', 'Please fill in all names and emails.', 'error');
            return;
        }

        adminGroupSubmitBtn.disabled = true;
        adminGroupSubmitBtn.textContent = '⏳ Registering...';

        try {
            const res = await fetch(`${API_BASE}/admin/register-group-submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(studentsData)
            });
            const data = await res.json();

            if (res.ok) {
                showMessage('adminGroupRegisterResult', data.message, 'success');
                setTimeout(() => {
                    adminGroupRetakeBtn.click();
                }, 3000);
            } else {
                showMessage('adminGroupRegisterResult', data.message || 'Registration failed.', 'error');
            }
        } catch (err) {
            showMessage('adminGroupRegisterResult', 'Could not connect to server.', 'error');
        } finally {
            adminGroupSubmitBtn.disabled = false;
            adminGroupSubmitBtn.textContent = '✅ Register All Students';
        }
    });
}
