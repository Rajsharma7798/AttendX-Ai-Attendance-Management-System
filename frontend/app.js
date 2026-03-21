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
