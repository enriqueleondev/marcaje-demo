// Datos y reglas de la demo. Todo es ficticio y vive en localStorage de este navegador.
// Las reglas imitan a la app real: anti-duplicado de entradas, estados del pase de lista
// (Por confirmar, Presente, Retardo, No en aula, Falta) y cálculo de reportes.

const KEY = 'marcaje-demo-v1';
export const QR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ── utilidades de fecha (hora local del navegador) ──
export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const hms = (d) => `${hm(d)}:${pad(d.getSeconds())}`;
export const today = () => ymd(new Date());
export const isoWeekday = (dateStr) => { const d = new Date(dateStr + 'T12:00'); return ((d.getDay() + 6) % 7) + 1; };
export const at = (dateStr, time) => new Date(`${dateStr}T${time}`);
export const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// ── generador pseudoaleatorio con semilla (los datos de arranque siempre son los mismos) ──
function prng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function code(rand) {
    let c = '';
    for (let i = 0; i < 8; i++) c += QR_ALPHABET[Math.floor(rand() * QR_ALPHABET.length)];
    return c;
}
const uid = (rand) => Array.from({ length: 7 }, () => Math.floor(rand() * 256).toString(16).padStart(2, '0').toUpperCase()).join('');

const FIRST = ['Ximena', 'Diego', 'Valeria', 'Emiliano', 'Renata', 'Santiago', 'Camila', 'Mateo', 'Regina', 'Leonardo', 'Natalia', 'Sebastián', 'Fernanda', 'Iker', 'Sofía', 'Joaquín', 'María José', 'Alejandro', 'Daniela', 'Rodrigo', 'Andrea', 'Bruno', 'Paula', 'Gael', 'Isabella', 'Héctor', 'Ana Paula', 'Tomás', 'Elena', 'Julián', 'Lucía', 'Marco', 'Abril', 'Nicolás', 'Victoria', 'Adrián'];
const LAST = ['Ortega', 'Hernández', 'Campos', 'Reyes', 'Vázquez', 'Morales', 'Domínguez', 'Guerrero', 'Fuentes', 'Castro', 'Ríos', 'Juárez', 'Delgado', 'Navarro', 'Cabrera', 'Herrera', 'Luna', 'Sandoval', 'Montes', 'Estrada', 'Salazar', 'Mendoza', 'Cervantes', 'Espinoza', 'Rangel', 'Zamora', 'Quiroz', 'Becerra', 'Aguilar', 'Arellano', 'Bautista', 'Cortés', 'Escobar', 'Galván', 'Lozano', 'Mora', 'Ochoa', 'Peña', 'Ponce', 'Tapia'];

export function seed() {
    const rand = prng(20261110);
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const s = {
        version: 1,
        settings: { institution: 'Plantel Demo', grades: 3, groupsPerGrade: 4, windowMin: 5 },
        users: [
            { id: 1, role: 'admin', first: 'Gabriela', last: 'Solís Ruiz', email: 'direccion@plantel-demo.test' },
            { id: 2, role: 'teacher', first: 'Ricardo', last: 'Ibarra Luna', email: 'docente@plantel-demo.test' },
            { id: 3, role: 'teacher', first: 'Laura', last: 'Pineda Ávila', email: 'laura.pineda@plantel-demo.test' },
            { id: 4, role: 'teacher', first: 'Martín', last: 'Cárdenas Vela', email: 'martin.cardenas@plantel-demo.test' },
            { id: 5, role: 'teacher', first: 'Sara', last: 'Medina Robles', email: 'sara.medina@plantel-demo.test' },
        ],
        groups: [], students: [], credentials: [], entries: [], courses: [], schedules: [], rollCalls: [],
        kiosks: [{ id: 1, name: 'Kiosco 1', location: 'Acceso principal' }, { id: 2, name: 'Kiosco 2', location: 'Acceso de estacionamiento' }],
        seq: {},
        session: null,
    };
    const next = (k) => (s.seq[k] = (s.seq[k] ?? 0) + 1);

    for (let g = 1; g <= 3; g++) for (let n = 1; n <= 4; n++) s.groups.push({ id: next('group'), grade: g, number: n });

    let enrollment = 20250100;
    for (const group of s.groups) {
        for (let i = 0; i < 8; i++) {
            const st = { id: next('student'), first: pick(FIRST), pat: pick(LAST), mat: pick(LAST), enrollment: String(enrollment += 7), groupId: group.id, deleted: false };
            s.students.push(st);
            s.credentials.push({ id: next('cred'), studentId: st.id, type: 'qr', value: code(rand), revokedAt: null });
            if (rand() < 0.75) s.credentials.push({ id: next('cred'), studentId: st.id, type: 'nfc', value: uid(rand), revokedAt: null });
        }
    }

    const course = (teacherId, name, grade, number, room, start, end) => {
        const group = s.groups.find((x) => x.grade === grade && x.number === number);
        const c = { id: next('course'), teacherId, name, groupId: group.id, room, sort: 'seat', seats: [], students: s.students.filter((x) => x.groupId === group.id).map((x) => x.id) };
        s.courses.push(c);
        for (let d = 1; d <= 5; d++) s.schedules.push({ id: next('sched'), courseId: c.id, weekday: d, start, end });
    };
    course(2, 'Biología I', 1, 1, 'Laboratorio 2', '07:00', '07:50');
    course(2, 'Química II', 2, 3, 'Aula B-14', '08:00', '08:50');
    course(2, 'Ecología', 3, 2, 'Aula C-03', '12:00', '12:50');
    course(3, 'Matemáticas III', 3, 1, 'Aula C-01', '07:00', '07:50');
    course(4, 'Física II', 2, 1, 'Laboratorio 1', '09:00', '09:50');
    course(5, 'Inglés I', 1, 2, 'Aula A-05', '10:00', '10:50');

    // Historial: los últimos 10 días hábiles y lo que va de hoy.
    const now = new Date();
    const days = [];
    for (let back = 14; back >= 0 && days.length < 11; back--) {
        const d = new Date(now); d.setDate(d.getDate() - back);
        if (d.getDay() !== 0 && d.getDay() !== 6) days.push(ymd(d));
    }
    if (days.at(-1) !== today()) days.push(today());

    for (const date of days) {
        const isToday = date === today();
        for (const st of s.students) {
            if (rand() > 0.9) continue;
            const t = at(date, '06:40'); t.setMinutes(t.getMinutes() + Math.floor(rand() * 45));
            if (isToday && t > now) continue;
            const nfc = s.credentials.find((c) => c.studentId === st.id && c.type === 'nfc');
            s.entries.push({ id: next('entry'), studentId: st.id, method: nfc && rand() < 0.7 ? 'nfc' : 'qr', at: t.toISOString(), kioskId: rand() < 0.6 ? 1 : 2 });
        }
        if (isToday) continue;
        for (const sch of s.schedules.filter((x) => x.weekday === isoWeekday(date))) {
            if (rand() < 0.15) continue; // a veces el docente no pasa lista
            const c = s.courses.find((x) => x.id === sch.courseId);
            const marks = {};
            for (const sid of c.students) {
                const has = !!entryFor(s, sid, date, sch.end);
                const r = rand();
                marks[sid] = has ? (r < 0.7 ? 'present' : r < 0.78 ? 'late' : r < 0.83 ? 'absent' : null) : (r < 0.7 ? 'absent' : null);
            }
            s.rollCalls.push({ id: next('rc'), scheduleId: sch.id, date, marks });
        }
    }
    return s;
}

// ── almacenamiento ──
export function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) { const s = JSON.parse(raw); if (s.version === 1) return s; }
    } catch {}
    const s = seed();
    save(s);
    return s;
}
export function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
export function reset() {
    try { localStorage.removeItem(KEY); } catch {}
}
export const nextId = (s, k) => (s.seq[k] = (s.seq[k] ?? 0) + 1);

// ── consultas ──
export const group = (s, id) => s.groups.find((g) => g.id === id);
export const groupShort = (s, id) => { const g = group(s, id); return g ? `${g.grade}° ${g.number}` : 'Sin grupo'; };
export const groupLong = (s, id) => { const g = group(s, id); return g ? `${g.grade}° grado, grupo ${g.number}` : 'Sin grupo'; };
export const student = (s, id) => s.students.find((x) => x.id === id);
export const fullName = (st) => `${st.first} ${st.pat} ${st.mat ?? ''}`.trim();
export const listName = (st) => `${st.pat} ${st.mat ?? ''}`.trim() + `, ${st.first}`;
export const initials = (st) => (st.first[0] + st.pat[0]).toUpperCase();
export const user = (s, id) => s.users.find((u) => u.id === id);
export const userName = (u) => (u ? `${u.first} ${u.last}` : '');
export const activeCred = (s, sid, type) => s.credentials.find((c) => c.studentId === sid && c.type === type && !c.revokedAt);
export const qrDisplay = (v) => `${v.slice(0, 4)}-${v.slice(4)}`;
export const normalize = (raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const collator = new Intl.Collator('es-MX');
export const byName = (a, b) => collator.compare(`${a.pat} ${a.mat} ${a.first}`, `${b.pat} ${b.mat} ${b.first}`);

export function randomCode() {
    const buf = new Uint32Array(8);
    crypto.getRandomValues(buf);
    return Array.from(buf, (n) => QR_ALPHABET[n % 32]).join('');
}

/** Primera entrada del alumno en una fecha, antes de la hora de fin dada (HH:MM). */
export function entryFor(s, sid, date, endTime) {
    const end = endTime ? at(date, endTime) : null;
    return s.entries
        .filter((e) => e.studentId === sid && ymd(new Date(e.at)) === date && (!end || new Date(e.at) <= end))
        .sort((a, b) => a.at.localeCompare(b.at))[0] ?? null;
}

// ── entradas ──
function duplicateOf(s, sid, when) {
    const w = s.settings.windowMin * 60000;
    return s.entries.find((e) => e.studentId === sid && Math.abs(new Date(e.at) - when) < w) ?? null;
}

/** Lectura de kiosco: busca credencial activa (QR o NFC) y aplica el anti-duplicado. */
export function recordScan(s, raw, kioskId) {
    const value = normalize(raw);
    const cred = s.credentials.find((c) => !c.revokedAt && c.value === value);
    const st = cred && student(s, cred.studentId);
    if (!st || st.deleted) return { status: 'unknown' };
    const now = new Date();
    const prev = duplicateOf(s, st.id, now);
    if (prev) return { status: 'duplicate', student: st, method: cred.type.toUpperCase(), previous: prev };
    const e = { id: nextId(s, 'entry'), studentId: st.id, method: cred.type, at: now.toISOString(), kioskId };
    s.entries.push(e);
    return { status: 'ok', student: st, method: cred.type.toUpperCase(), entry: e };
}

export function recordManual(s, sid, reason, note, time, byUserId) {
    const when = at(today(), time);
    if (when > new Date(Date.now() + 60000)) return { status: 'future' };
    const prev = duplicateOf(s, sid, when);
    if (prev) return { status: 'duplicate', previous: prev };
    const e = { id: nextId(s, 'entry'), studentId: sid, method: 'manual', at: when.toISOString(), createdBy: byUserId, manualReason: reason, manualNote: note || null };
    s.entries.push(e);
    return { status: 'ok', entry: e };
}
export const MANUAL_REASONS = { forgot: 'Olvidó su credencial', damaged: 'Credencial dañada', other: 'Otro' };
export const methodLabel = (m) => ({ nfc: 'NFC', qr: 'QR', manual: 'Manual' }[m] ?? m);

// ── pase de lista ──
export const STATES = { confirmar: 'Por confirmar', presente: 'Presente', retardo: 'Retardo', noaula: 'No en aula', falta: 'Falta' };
export function markState(status, hasEntry) {
    if (status === 'present') return 'presente';
    if (status === 'late') return 'retardo';
    if (status === 'absent') return hasEntry ? 'noaula' : 'falta';
    return hasEntry ? 'confirmar' : 'falta';
}

export function openRollCall(s, scheduleId, date) {
    let rc = s.rollCalls.find((r) => r.scheduleId === scheduleId && r.date === date);
    if (!rc) { rc = { id: nextId(s, 'rc'), scheduleId, date, marks: {} }; s.rollCalls.push(rc); }
    const c = s.courses.find((x) => x.id === s.schedules.find((x) => x.id === scheduleId).courseId);
    for (const sid of c.students) if (!(sid in rc.marks)) rc.marks[sid] = null;
    return rc;
}

export function seatOrder(s, course) {
    const sts = course.students.map((id) => student(s, id)).filter((x) => x && !x.deleted);
    const pos = new Map(course.seats.map((id, i) => [id, i]));
    return sts.sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9) || byName(a, b));
}

// ── reportes ──
export function reportRows(s, from, to, filter = {}) {
    const rows = new Map();
    for (const rc of s.rollCalls) {
        if (rc.date < from || rc.date > to) continue;
        const sch = s.schedules.find((x) => x.id === rc.scheduleId);
        for (const [sidStr, status] of Object.entries(rc.marks)) {
            const sid = Number(sidStr);
            const st = student(s, sid);
            if (!st) continue;
            const g = group(s, st.groupId);
            if (filter.grade && g?.grade !== filter.grade) continue;
            if (filter.number && g?.number !== filter.number) continue;
            const has = !!entryFor(s, sid, rc.date, sch.end);
            const r = rows.get(sid) ?? { student: st, total: 0, present: 0, late: 0, unconfirmed: 0, notInClass: 0, absent: 0 };
            r.total++;
            const state = markState(status, has);
            if (state === 'presente') r.present++;
            else if (state === 'retardo') r.late++;
            else if (state === 'confirmar') r.unconfirmed++;
            else if (state === 'noaula') r.notInClass++;
            else r.absent++;
            rows.set(sid, r);
        }
    }
    return [...rows.values()].map((r) => ({ ...r, rate: r.total ? Math.round((r.present + r.late + r.unconfirmed) / r.total * 100) : null }));
}
