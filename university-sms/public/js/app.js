const API = '/api';

/* ---------------- Navigation ---------------- */
document.getElementById('nav').addEventListener('click', (e) => {
  const item = e.target.closest('.nav-item');
  if (!item) return;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  item.classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${item.dataset.view}`).classList.add('active');
});

function wireSubtabs(containerId, subviewPrefix, onShow) {
  const container = document.getElementById(containerId);
  container.addEventListener('click', (e) => {
    const tab = e.target.closest('.subtab');
    if (!tab) return;
    container.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    container.parentElement.querySelectorAll('.subview').forEach(sv => sv.style.display = 'none');
    const target = document.getElementById(`${subviewPrefix}-${tab.dataset.sub}`);
    target.style.display = 'block';
    if (onShow) onShow(tab.dataset.sub);
  });
}
wireSubtabs('enrollment-subtabs', 'sub');
wireSubtabs('scheduling-subtabs', 'sub');

function toggleForm(btnId, panelId) {
  document.getElementById(btnId).addEventListener('click', () => {
    document.getElementById(panelId).classList.toggle('open');
  });
}
function closeForm(btnId, panelId) {
  document.getElementById(btnId).addEventListener('click', () => {
    document.getElementById(panelId).classList.remove('open');
  });
}

/* ---------------- Helpers ---------------- */
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = ((+h + 11) % 12) + 1;
  return `${hour}:${m} ${+h < 12 ? 'AM' : 'PM'}`;
}
function pill(value) {
  return `<span class="pill pill-${value}">${value.replace('_', ' ')}</span>`;
}
function setMsg(id, text, ok) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = `form-msg ${ok ? 'ok' : 'err'}`;
}

let departmentsCache = [];

/* ---------------- Dashboard ---------------- */
async function loadDashboard() {
  try {
    const stats = await api('/stats');
    const cards = document.querySelectorAll('#stat-grid .stat-card');
    const labels = [
      ['total_students', 'Active students'],
      ['total_faculty', 'Active faculty'],
      ['total_courses', 'Courses in catalog'],
      ['total_offerings', 'Offerings this term'],
      ['total_enrollments', 'Active enrollments']
    ];
    labels.forEach(([key], i) => {
      cards[i].querySelector('.n').textContent = stats[key];
    });
  } catch (err) {
    console.error(err);
  }

  try {
    const enrollments = await api('/enrollments');
    const tbody = document.getElementById('dash-enrollments');
    const recent = enrollments.slice(0, 8);
    tbody.innerHTML = recent.length ? recent.map(e => `
      <tr>
        <td>${e.student_first_name} ${e.student_last_name}</td>
        <td><span class="code-chip">${e.course_code}</span> ${e.title}</td>
        <td>${e.semester} ${e.academic_year}</td>
        <td>${pill(e.status)}</td>
        <td>${e.grade}</td>
      </tr>
    `).join('') : `<tr class="empty-row"><td colspan="5">No enrollments yet</td></tr>`;
  } catch (err) {
    document.getElementById('dash-enrollments').innerHTML =
      `<tr class="empty-row"><td colspan="5">Could not load data — is the API running? (${err.message})</td></tr>`;
  }
}

/* ---------------- Departments (shared reference data) ---------------- */
async function loadDepartments() {
  departmentsCache = await api('/departments');
  const opts = departmentsCache.map(d => `<option value="${d.department_id}">${d.dept_name}</option>`).join('');
  ['f-student-dept', 'f-course-dept', 'f-faculty-dept'].forEach(id => {
    document.getElementById(id).innerHTML = opts;
  });
}

/* ---------------- Students ---------------- */
async function loadStudents(query = '') {
  const tbody = document.getElementById('students-table');
  try {
    const students = await api(`/students${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    tbody.innerHTML = students.length ? students.map(s => `
      <tr>
        <td><span class="code-chip">${s.student_number}</span></td>
        <td>${s.first_name} ${s.last_name}</td>
        <td>${s.dept_name}</td>
        <td>${pill(s.standing)}</td>
        <td>${pill(s.status)}</td>
        <td><button class="btn danger" data-del-student="${s.student_id}">Remove</button></td>
      </tr>
    `).join('') : `<tr class="empty-row"><td colspan="6">No students yet</td></tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${err.message}</td></tr>`;
  }
}
document.getElementById('student-search').addEventListener('input', (e) => loadStudents(e.target.value));

toggleForm('toggle-student-form', 'student-form-panel');
closeForm('cancel-student', 'student-form-panel');
document.getElementById('submit-student').addEventListener('click', async () => {
  try {
    await api('/students', {
      method: 'POST',
      body: JSON.stringify({
        student_number: document.getElementById('f-student-number').value,
        first_name: document.getElementById('f-student-first').value,
        last_name: document.getElementById('f-student-last').value,
        email: document.getElementById('f-student-email').value,
        major_department_id: document.getElementById('f-student-dept').value,
        enrollment_year: document.getElementById('f-student-year').value,
        standing: document.getElementById('f-student-standing').value
      })
    });
    setMsg('student-form-msg', 'Student added.', true);
    loadStudents();
    loadDashboard();
    populateEnrollDropdowns();
  } catch (err) {
    setMsg('student-form-msg', err.message, false);
  }
});
document.getElementById('students-table').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-del-student]');
  if (!btn) return;
  if (!confirm('Remove this student and all their enrollment records?')) return;
  try {
    await api(`/students/${btn.dataset.delStudent}`, { method: 'DELETE' });
    loadStudents();
    loadDashboard();
  } catch (err) {
    alert(err.message);
  }
});

/* ---------------- Enrollments ---------------- */
async function populateEnrollDropdowns() {
  const [students, offerings] = await Promise.all([api('/students'), api('/schedules')]);
  document.getElementById('f-enroll-student').innerHTML = students.map(s =>
    `<option value="${s.student_id}">${s.first_name} ${s.last_name} (${s.student_number})</option>`
  ).join('');
  document.getElementById('f-enroll-schedule').innerHTML = offerings.map(o =>
    `<option value="${o.schedule_id}">${o.course_code} — ${o.semester} ${o.academic_year} (${o.seats_available}/${o.capacity} open)</option>`
  ).join('');
}

async function loadEnrollments() {
  const tbody = document.getElementById('enrollments-table');
  try {
    const rows = await api('/enrollments');
    tbody.innerHTML = rows.length ? rows.map(e => `
      <tr>
        <td>${e.student_first_name} ${e.student_last_name}</td>
        <td><span class="code-chip">${e.course_code}</span></td>
        <td>${e.semester} ${e.academic_year}</td>
        <td>${pill(e.status)}</td>
        <td>${e.grade}</td>
        <td><button class="btn danger" data-del-enroll="${e.enrollment_id}">Withdraw</button></td>
      </tr>
    `).join('') : `<tr class="empty-row"><td colspan="6">No enrollment records yet</td></tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${err.message}</td></tr>`;
  }
}

toggleForm('toggle-enrollment-form', 'enrollment-form-panel');
closeForm('cancel-enrollment', 'enrollment-form-panel');
document.getElementById('submit-enrollment').addEventListener('click', async () => {
  try {
    const result = await api('/enrollments', {
      method: 'POST',
      body: JSON.stringify({
        student_id: document.getElementById('f-enroll-student').value,
        schedule_id: document.getElementById('f-enroll-schedule').value
      })
    });
    setMsg('enrollment-form-msg', `Enrolled — status: ${result.status}.`, true);
    loadEnrollments();
    loadDashboard();
    populateEnrollDropdowns();
  } catch (err) {
    setMsg('enrollment-form-msg', err.message, false);
  }
});
document.getElementById('enrollments-table').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-del-enroll]');
  if (!btn) return;
  try {
    await api(`/enrollments/${btn.dataset.delEnroll}`, { method: 'DELETE' });
    loadEnrollments();
    loadDashboard();
    populateEnrollDropdowns();
  } catch (err) {
    alert(err.message);
  }
});

/* ---------------- Courses ---------------- */
async function loadCourses() {
  const tbody = document.getElementById('courses-table');
  try {
    const courses = await api('/courses');
    tbody.innerHTML = courses.length ? courses.map(c => `
      <tr>
        <td><span class="code-chip">${c.course_code}</span></td>
        <td>${c.title}</td>
        <td>${c.credits}</td>
        <td>${c.dept_name}</td>
        <td><button class="btn danger" data-del-course="${c.course_id}">Remove</button></td>
      </tr>
    `).join('') : `<tr class="empty-row"><td colspan="5">No courses yet</td></tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${err.message}</td></tr>`;
  }
}

toggleForm('toggle-course-form', 'course-form-panel');
closeForm('cancel-course', 'course-form-panel');
document.getElementById('submit-course').addEventListener('click', async () => {
  try {
    await api('/courses', {
      method: 'POST',
      body: JSON.stringify({
        course_code: document.getElementById('f-course-code').value,
        title: document.getElementById('f-course-title').value,
        credits: document.getElementById('f-course-credits').value,
        department_id: document.getElementById('f-course-dept').value,
        description: document.getElementById('f-course-desc').value
      })
    });
    setMsg('course-form-msg', 'Course added to catalog.', true);
    loadCourses();
    loadDashboard();
    populateOfferingDropdowns();
  } catch (err) {
    setMsg('course-form-msg', err.message, false);
  }
});
document.getElementById('courses-table').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-del-course]');
  if (!btn) return;
  try {
    await api(`/courses/${btn.dataset.delCourse}`, { method: 'DELETE' });
    loadCourses();
    loadDashboard();
  } catch (err) {
    alert(err.message);
  }
});

/* ---------------- Offerings (course_schedule) ---------------- */
async function populateOfferingDropdowns() {
  const [courses, faculty] = await Promise.all([api('/courses'), api('/faculty')]);
  document.getElementById('f-off-course').innerHTML = courses.map(c =>
    `<option value="${c.course_id}">${c.course_code} — ${c.title}</option>`
  ).join('');
  document.getElementById('f-off-faculty').innerHTML = faculty.map(f =>
    `<option value="${f.faculty_id}">${f.first_name} ${f.last_name}</option>`
  ).join('');
}

async function loadOfferings() {
  const tbody = document.getElementById('offerings-table');
  try {
    const rows = await api('/schedules');
    tbody.innerHTML = rows.length ? rows.map(o => {
      const pct = Math.round((o.seats_taken / o.capacity) * 100);
      return `
      <tr>
        <td><span class="code-chip">${o.course_code}</span> ${o.title}</td>
        <td>${o.semester} ${o.academic_year}</td>
        <td>${o.days_of_week} ${fmtTime(o.start_time)}–${fmtTime(o.end_time)}</td>
        <td>${o.room}</td>
        <td>${o.faculty_first_name} ${o.faculty_last_name}</td>
        <td class="seats">${o.seats_taken}/${o.capacity}<span class="seats-bar"><span class="seats-bar-fill" style="width:${pct}%"></span></span></td>
        <td><button class="btn danger" data-del-offering="${o.schedule_id}">Remove</button></td>
      </tr>`;
    }).join('') : `<tr class="empty-row"><td colspan="7">No offerings scheduled yet</td></tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">${err.message}</td></tr>`;
  }
}

toggleForm('toggle-offering-form', 'offering-form-panel');
closeForm('cancel-offering', 'offering-form-panel');
document.getElementById('submit-offering').addEventListener('click', async () => {
  try {
    await api('/schedules', {
      method: 'POST',
      body: JSON.stringify({
        course_id: document.getElementById('f-off-course').value,
        faculty_id: document.getElementById('f-off-faculty').value,
        semester: document.getElementById('f-off-semester').value,
        academic_year: document.getElementById('f-off-year').value,
        days_of_week: document.getElementById('f-off-days').value,
        start_time: document.getElementById('f-off-start').value,
        end_time: document.getElementById('f-off-end').value,
        room: document.getElementById('f-off-room').value,
        capacity: document.getElementById('f-off-capacity').value
      })
    });
    setMsg('offering-form-msg', 'Offering scheduled.', true);
    loadOfferings();
    loadDashboard();
    populateEnrollDropdowns();
  } catch (err) {
    setMsg('offering-form-msg', err.message, false);
  }
});
document.getElementById('offerings-table').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-del-offering]');
  if (!btn) return;
  try {
    await api(`/schedules/${btn.dataset.delOffering}`, { method: 'DELETE' });
    loadOfferings();
    loadDashboard();
    populateEnrollDropdowns();
  } catch (err) {
    alert(err.message);
  }
});

/* ---------------- Faculty ---------------- */
async function loadFaculty() {
  const tbody = document.getElementById('faculty-table');
  try {
    const faculty = await api('/faculty');
    tbody.innerHTML = faculty.length ? faculty.map(f => `
      <tr data-view-faculty="${f.faculty_id}" style="cursor:pointer;">
        <td>${f.first_name} ${f.last_name}</td>
        <td>${f.title}</td>
        <td>${f.dept_name}</td>
        <td>${pill(f.status)}</td>
        <td><button class="btn danger" data-del-faculty="${f.faculty_id}">Remove</button></td>
      </tr>
    `).join('') : `<tr class="empty-row"><td colspan="5">No faculty yet</td></tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${err.message}</td></tr>`;
  }
}

toggleForm('toggle-faculty-form', 'faculty-form-panel');
closeForm('cancel-faculty', 'faculty-form-panel');
document.getElementById('submit-faculty').addEventListener('click', async () => {
  try {
    await api('/faculty', {
      method: 'POST',
      body: JSON.stringify({
        first_name: document.getElementById('f-faculty-first').value,
        last_name: document.getElementById('f-faculty-last').value,
        email: document.getElementById('f-faculty-email').value,
        title: document.getElementById('f-faculty-title').value,
        department_id: document.getElementById('f-faculty-dept').value,
        hire_date: document.getElementById('f-faculty-hire').value
      })
    });
    setMsg('faculty-form-msg', 'Faculty member added.', true);
    loadFaculty();
    loadDashboard();
    populateOfferingDropdowns();
  } catch (err) {
    setMsg('faculty-form-msg', err.message, false);
  }
});
document.getElementById('faculty-table').addEventListener('click', async (e) => {
  const delBtn = e.target.closest('[data-del-faculty]');
  if (delBtn) {
    if (!confirm('Remove this faculty member? This fails if they still teach an active offering.')) return;
    try {
      await api(`/faculty/${delBtn.dataset.delFaculty}`, { method: 'DELETE' });
      loadFaculty();
      loadDashboard();
    } catch (err) {
      alert(err.message);
    }
    return;
  }
  const row = e.target.closest('[data-view-faculty]');
  if (!row) return;
  try {
    const f = await api(`/faculty/${row.dataset.viewFaculty}`);
    document.getElementById('faculty-detail').style.display = 'block';
    document.getElementById('faculty-detail-title').textContent = `Course load — ${f.first_name} ${f.last_name}`;
    const tbody = document.getElementById('faculty-load-table');
    tbody.innerHTML = f.course_load.length ? f.course_load.map(c => `
      <tr>
        <td><span class="code-chip">${c.course_code}</span> ${c.title}</td>
        <td>${c.semester} ${c.academic_year}</td>
        <td>${c.days_of_week} ${fmtTime(c.start_time)}–${fmtTime(c.end_time)}</td>
        <td>${c.room}</td>
      </tr>
    `).join('') : `<tr class="empty-row"><td colspan="4">No offerings assigned</td></tr>`;
    document.getElementById('faculty-detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    alert(err.message);
  }
});

/* ---------------- Init ---------------- */
(async function init() {
  await loadDepartments();
  loadDashboard();
  loadStudents();
  loadCourses();
  loadFaculty();
  loadOfferings();
  loadEnrollments();
  populateEnrollDropdowns();
  populateOfferingDropdowns();
})();
