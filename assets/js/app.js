// Marcaje · demo estática. Mismas pantallas y flujos que la app real, sin backend.
import * as D from './data.js';

let S = D.load();
const persist = () => D.save(S);
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view');
const me = () => (S.session ? D.user(S, S.session) : null);
const isAdmin = () => me()?.role === 'admin';

// ── QR real con qrcode-generator (incluida en assets/vendor) ──
function qrSvg(text, cell = 4) {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: cell, margin: 2, scalable: true }).replace('<svg ', '<svg role="img" aria-label="Código QR" ');
}

// ── sonido del kiosco ──
let audio;
function beep(kind) {
    try {
        audio ??= new (window.AudioContext || window.webkitAudioContext)();
        const tones = { ok: [[880, 0, 0.09], [1320, 0.1, 0.14]], dup: [[523, 0, 0.12], [523, 0.18, 0.12]], unknown: [[220, 0, 0.4]] }[kind];
        const t0 = audio.currentTime;
        for (const [f, start, dur] of tones) {
            const o = audio.createOscillator(); const g = audio.createGain();
            o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0 + start);
            g.gain.exponentialRampToValueAtTime(0.22, t0 + start + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
            o.connect(g).connect(audio.destination); o.start(t0 + start); o.stop(t0 + start + dur + 0.02);
        }
    } catch {}
}

// ── estructura común ──
const NAV = [
    ['', [['inicio', 'Inicio', 'all']]],
    ['Escuela', [['alumnos', 'Alumnos', 'all'], ['docentes', 'Docentes', 'admin'], ['grupos', 'Grupos', 'admin']]],
    ['Asistencia', [['pase-de-lista', 'Pase de lista', 'all'], ['entrada-manual', 'Entrada manual', 'all'], ['clases', 'Clases', 'all'], ['credenciales', 'Credenciales', 'admin'], ['kioscos', 'Kioscos', 'admin'], ['reportes', 'Reportes', 'admin'], ['ajustes', 'Ajustes', 'admin']]],
];

function shell(active, content, { flush = false } = {}) {
    const u = me();
    const nav = NAV.map(([title, items]) => {
        const vis = items.filter(([, , who]) => who === 'all' || (who === 'admin' && isAdmin()));
        if (!vis.length) return '';
        return (title ? `<h4>${title}</h4>` : '') + vis.map(([r, l]) => `<a href="#/${r}" ${active === r ? 'aria-current="page"' : ''}>${l}</a>`).join('');
    }).join('');
    return `<div class="app">
        <header class="topbar"><a class="brand" href="#/inicio">Marcaje</a><button type="button" data-nav-toggle aria-expanded="false">Menú</button></header>
        <aside class="side" id="side">
            <a class="brand" href="#/inicio">Marcaje<small>${esc(S.settings.institution)}</small></a>
            <nav aria-label="Principal">${nav}</nav>
            <div class="me"><div>${esc(D.userName(u))}<small>${u.role === 'admin' ? 'Dirección' : 'Docente'}</small></div>
                <div class="actions"><button type="button" class="link" data-act="theme">Tema</button><button type="button" class="link" data-act="logout">Salir</button></div></div>
        </aside>
        <main class="main ${flush ? 'flush' : ''}">${content}</main>
    </div>`;
}

function foot() {
    return `<footer class="site-foot">
        <a href="legal/privacidad.html">Aviso de privacidad</a><a href="legal/terminos.html">Términos de uso</a>
        <a href="legal/cookies.html">Política de cookies</a><a href="legal/demo.html">Aviso de demostración</a>
        <span class="spacer"></span><span>Marcaje, de Enrique Rentería León. <a href="https://enriqueleondev.github.io/">Portafolio</a></span>
    </footer>`;
}

let flashMsg = null;
const notice = () => { const m = flashMsg; flashMsg = null; return m ? `<p class="notice ${m.err ? 'is-error' : ''}" role="status" style="margin:16px 0">${esc(m.text)}</p>` : ''; };
const say = (text, err = false) => { flashMsg = { text, err }; };

// ── enrutador ──
const ROUTES = {
    login, inicio, alumnos, docentes, grupos, credenciales, imprimir, kioscos, kiosco, 'pase-de-lista': paseDeLista,
    'entrada-manual': entradaManual, clases, reportes, ajustes,
};
const ADMIN_ONLY = new Set(['docentes', 'grupos', 'credenciales', 'imprimir', 'kioscos', 'reportes', 'ajustes']);

function parse() {
    const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
    const [name, ...rest] = path.split('/');
    return { name: name || 'inicio', args: rest, q: new URLSearchParams(query) };
}

function render() {
    const r = parse();
    if (!me() && r.name !== 'login' && r.name !== 'kiosco') return go('login');
    if (r.name === 'login' && me()) return go('inicio');
    if (ADMIN_ONLY.has(r.name) && !isAdmin()) { say('Esa sección es solo para dirección.', true); return go('inicio'); }
    const fn = ROUTES[r.name] ?? inicio;
    document.body.classList.toggle('kiosk-mode', r.name === 'kiosco');
    view.innerHTML = fn(r) + (r.name === 'kiosco' || r.name === 'imprimir' ? '' : foot());
    after.forEach((f) => f()); after.length = 0;
    window.scrollTo(0, 0);
}
const after = [];
const go = (hash) => { if (location.hash === '#/' + hash) render(); else location.hash = '#/' + hash; };
window.addEventListener('hashchange', render);

// ══ Pantallas ══════════════════════════════════════════

function login() {
    const acc = (id, color) => { const u = D.user(S, id); return `<button type="button" class="account" data-act="login" data-id="${id}"><i class="sq ${color}"></i><b>${esc(D.userName(u))}</b><span>${u.role === 'admin' ? 'Dirección' : 'Docente'}, ${esc(u.email)}</span></button>`; };
    return `<div class="auth">
        <aside class="auth-side"><div class="brand">Marcaje<small>${esc(S.settings.institution)}</small></div>
            <p class="motto">Cada entrada cuenta.</p>
            <div class="foot"><span>Pase de lista con credencial NFC y QR</span><span>Demo</span></div></aside>
        <main class="auth-main"><div class="auth-form">
            <h1>Entrar a la demo</h1>
            <p>Elige una cuenta de prueba. No hay contraseñas: todo es ficticio y se guarda solo en este navegador.</p>
            <div class="accounts">${acc(1, 'presente')}${acc(2, 'retardo')}</div>
            <p class="after">¿Quieres ver el kiosco de entrada? <a class="link" href="#/kiosco">Abrir el kiosco</a></p>
            <p class="demo-note">En la app real se entra con correo y contraseña, con bloqueo tras intentos fallidos y contraseñas temporales que vencen en 24 h.</p>
        </div></main></div>`;
}

function inicio() {
    const u = me();
    const items = isAdmin()
        ? [['alumnos', 'Alumnos y credenciales', 'Busca un alumno, mira su QR real, vincula una pegatina NFC o regenera su código.'], ['kiosco', 'Kiosco de entrada', 'Teclea un código (como el lector USB) o usa "Simular lectura".'], ['reportes', 'Reportes', 'Asistencia por alumno, quién entró pero no llegó a clase y qué docentes no pasan lista.'], ['entrada-manual', 'Entrada manual', 'Para el alumno que olvidó o dañó su credencial.'], ['ajustes', 'Ajustes', 'Nombre de la escuela y minutos del anti-duplicado.']]
        : [['pase-de-lista', 'Pase de lista', 'Retícula de lugares: toca un lugar o usa P, R y F. Confirma todas las entradas de un clic.'], ['clases', 'Mis clases', 'Tus clases, su horario y sus alumnos.'], ['entrada-manual', 'Entrada manual', 'Registra la entrada de quien no pudo pasar su credencial.'], ['kiosco', 'Kiosco de entrada', 'Prueba cómo registran su entrada los alumnos.']];
    return shell('inicio', `<div class="page-head"><div><h1>Hola, ${esc(u.first)}.</h1><p>${u.role === 'admin' ? 'Dirección' : 'Docente'} en ${esc(S.settings.institution)}. Esto es lo que puedes probar:</p></div></div>
        ${notice()}<ul class="day">${items.map(([r, t, d]) => `<li class="day-item" style="grid-template-columns:1fr auto"><span class="day-name"><b class="serif">${t}</b><span class="muted">${d}</span></span><a class="btn" href="#/${r}">Abrir</a></li>`).join('')}</ul>`);
}

// ── alumnos ──
let alumnosState = { q: '', grade: null, number: null };
function alumnos(r) {
    const sel = Number(r.q.get('id')) || null;
    const { q, grade, number } = alumnosState;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = S.students.filter((st) => !st.deleted).filter((st) => {
        const g = D.group(S, st.groupId);
        if (grade && g?.grade !== grade) return false;
        if (number && g?.number !== number) return false;
        const hay = `${st.first} ${st.pat} ${st.mat} ${st.enrollment}`.toLowerCase();
        return words.every((w) => hay.includes(w));
    }).sort(D.byName);
    const chips = (label, key, vals, fmt) => `<div class="chips" role="group" aria-label="${label}"><span class="chips-label">${label}</span>${vals.map((v) => `<button type="button" data-act="chip" data-key="${key}" data-v="${v}" aria-pressed="${alumnosState[key] === v}">${fmt(v)}</button>`).join('')}</div>`;
    const st = sel && D.student(S, sel);
    return shell('alumnos', `<div class="md">
        <div class="list"><div class="list-head">
            <div class="row"><h1>Alumnos</h1>${isAdmin() ? '<button class="btn primary" data-act="new-student">Agregar</button>' : ''}</div>
            <input class="input" id="a-search" type="search" placeholder="Buscar por nombre o matrícula" value="${esc(q)}" autocomplete="off" aria-label="Buscar alumnos">
            ${chips('Grado', 'grade', [1, 2, 3], (v) => v + '°')}${chips('Grupo', 'number', [1, 2, 3, 4], (v) => v)}
            <p class="mono muted">${list.length} alumnos</p></div>
            <div class="items">${list.map((x) => `<a class="item" href="#/alumnos?id=${x.id}" aria-current="${x.id === sel}"><b>${esc(D.listName(x))}</b><span class="mono">${D.groupShort(S, x.groupId)}</span><span class="mono">${esc(x.enrollment)}</span></a>`).join('') || '<p class="empty">Ningún alumno coincide. Prueba con otro nombre o quita los filtros.</p>'}</div>
        </div>
        <section class="insp" aria-label="Detalle del alumno">${notice()}${r.q.get('nuevo') ? newStudentForm() : st ? inspector(st) : '<div class="insp-empty"><p class="serif">Elige un alumno de la lista para ver sus datos.</p></div>'}</section>
    </div>`, { flush: true });
}

function inspector(st) {
    const qr = D.activeCred(S, st.id, 'qr');
    const nfc = D.activeCred(S, st.id, 'nfc');
    const days = [...new Set(S.entries.map((e) => D.ymd(new Date(e.at))))].sort().slice(-20);
    const mine = new Set(S.entries.filter((e) => e.studentId === st.id).map((e) => D.ymd(new Date(e.at))));
    const cred = isAdmin() ? `<div class="cred">
        <div class="qr-box">${qr ? qrSvg(qr.value) : '<span class="mono muted">Sin QR activo</span>'}</div>
        <div class="cred-rows">
            <div class="cred-row"><span class="k">Código QR</span>${qr ? `<span class="v big mono">${D.qrDisplay(qr.value)}</span><span class="a"><button class="link" data-act="regen" data-id="${st.id}">Regenerar</button><button class="link warn" data-act="revoke" data-type="qr" data-id="${st.id}">Revocar</button></span>` : `<span class="v muted">Revocado</span><span class="a"><button class="link" data-act="regen" data-id="${st.id}">Generar QR</button></span>`}</div>
            ${qr ? `<div class="cred-row"><span class="k">Credencial</span><span class="v links"><a class="link" href="#/imprimir?alumno=${st.id}">Imprimir</a><button class="link" data-act="download" data-id="${st.id}">Descargar SVG</button></span></div>` : ''}
            <div class="cred-row"><span class="k">NFC</span>${nfc ? `<span class="v mono"><i class="sq presente"></i>${esc(nfc.value)}</span><span class="a"><button class="link warn" data-act="revoke" data-type="nfc" data-id="${st.id}">Quitar</button></span>` : `<form class="v nfc-form" data-form="nfc" data-id="${st.id}"><label class="sr-only" for="nfc-in">UID</label><input class="input compact mono" id="nfc-in" placeholder="Teclea o pasa un UID (ej. 04A23F1B5C8000)" autocomplete="off"><button class="btn" type="submit">Vincular</button></form>`}</div>
        </div></div>` : '';
    return `<div class="insp-head"><div><h2>${esc(st.first)}<br>${esc(`${st.pat} ${st.mat}`)}</h2><p>${D.groupLong(S, st.groupId)}. Matrícula <span class="mono">${esc(st.enrollment)}</span>.</p></div>
        ${isAdmin() ? `<div class="head-actions"><button class="btn danger" data-act="drop" data-id="${st.id}">Dar de baja</button></div>` : ''}</div>
        <dl class="facts"><dt>Nombre(s)</dt><dd>${esc(st.first)}</dd><dt>Apellido paterno</dt><dd>${esc(st.pat)}</dd><dt>Apellido materno</dt><dd>${esc(st.mat || '—')}</dd><dt>Matrícula</dt><dd class="mono">${esc(st.enrollment)}</dd></dl>
        ${cred}
        <div class="sec"><h3 class="sec-title" style="justify-content:space-between"><span>Últimos ${days.length} días de clases</span><span>Entró ${days.filter((d) => mine.has(d)).length} de ${days.length}</span></h3>
            <div class="days">${days.map((d) => `<i class="${mine.has(d) ? 'p' : 'f'}" title="${d}"></i>`).join('')}</div></div>
        <form class="sec" data-form="group" data-id="${st.id}"><h3 class="sec-title"><label for="g-sel">Grado y grupo</label></h3>
            <div class="inline-form"><select class="input compact" id="g-sel"><option value="">Sin grupo</option>${S.groups.map((g) => `<option value="${g.id}" ${g.id === st.groupId ? 'selected' : ''}>${g.grade}° grado, grupo ${g.number}</option>`).join('')}</select><button class="btn" type="submit">Cambiar grupo</button></div></form>`;
}

function newStudentForm() {
    return `<form class="form-narrow" data-form="new-student" style="margin-top:0"><div class="page-head"><div><h1>Agregar alumno</h1><p>Los alumnos no tienen cuenta: solo los manejan docentes y dirección.</p></div></div>
        <div class="field" style="margin-top:20px"><label for="n-first">Nombre(s)</label><input class="input" id="n-first" required></div>
        <div class="field"><label for="n-pat">Apellido paterno</label><input class="input" id="n-pat" required></div>
        <div class="field"><label for="n-mat">Apellido materno</label><input class="input" id="n-mat"></div>
        <div class="field"><label for="n-group">Grado y grupo</label><select class="input" id="n-group">${S.groups.map((g) => `<option value="${g.id}">${g.grade}° grado, grupo ${g.number}</option>`).join('')}</select></div>
        <p class="error" id="n-error" hidden></p>
        <div class="form-actions"><button class="btn primary" type="submit">Agregar alumno</button><a class="btn" href="#/alumnos">Cancelar</a></div></form>`;
}

// ── docentes, grupos ──
function docentes() {
    const rows = S.users.map((u) => `<tr><td class="serif cell-name">${esc(D.userName(u))}${u.id === S.session ? ' <span class="mono muted">(tú)</span>' : ''}</td><td>${esc(u.email)}</td><td>${u.role === 'admin' ? 'Dirección' : 'Docente'}</td>
        <td><span class="tag"><i class="sq ${u.temp ? 'confirmar' : 'presente'}"></i>${u.temp ? 'Contraseña temporal, vence en 24 h' : 'Activa'}</span></td>
        <td class="actions-cell">${u.id === S.session ? '' : `<button class="link" data-act="temp" data-id="${u.id}">Generar contraseña temporal</button>`}</td></tr>`).join('');
    return shell('docentes', `<div class="page-head"><div><h1>Docentes y dirección</h1><p>Cuentas del personal. Los alumnos no tienen cuenta.</p></div></div>${notice()}
        <div class="table-wrap block"><table class="table"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Acceso</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${rows}</tbody></table></div>`);
}

function grupos() {
    const rows = S.groups.map((g) => `<tr><td class="serif cell-name">${g.grade}° ${g.number}</td><td class="mono">${S.students.filter((s) => s.groupId === g.id && !s.deleted).length}</td><td class="actions-cell"><a class="link" href="#/imprimir?grupo=${g.id}">Imprimir credenciales</a></td></tr>`).join('');
    return shell('grupos', `<div class="page-head"><div><h1>Grupos</h1><p>${S.settings.grades} grados con ${S.settings.groupsPerGrade} grupos cada uno.</p></div></div>
        <div class="table-wrap block"><table class="table"><thead><tr><th>Grupo</th><th>Alumnos</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${rows}</tbody></table></div>`);
}

// ── credenciales ──
function credenciales() {
    const act = S.students.filter((s) => !s.deleted);
    const withNfc = act.filter((s) => D.activeCred(S, s.id, 'nfc')).length;
    return shell('credenciales', `<div class="page-head"><div><h1>Credenciales</h1><p>Cada alumno tiene un código QR propio y puede tener una pegatina NFC vinculada.</p></div></div>
        <div class="counts-row"><div><b>${act.length}</b><span>Alumnos</span></div><div><b>${act.filter((s) => D.activeCred(S, s.id, 'qr')).length}</b><span><i class="sq presente"></i>Con código QR</span></div><div><b>${withNfc}</b><span><i class="sq presente"></i>Con NFC</span></div><div><b>${act.length - withNfc}</b><span><i class="sq confirmar"></i>Sin NFC</span></div></div>
        <section class="block"><h2 class="block-title">Imprimir por grupo</h2><div class="table-wrap"><table class="table"><tbody>
        ${S.groups.map((g) => `<tr><td class="serif cell-name">${g.grade}° ${g.number}</td><td class="actions-cell"><a class="link" href="#/imprimir?grupo=${g.id}">Imprimir credenciales</a></td></tr>`).join('')}</tbody></table></div></section>
        <p class="demo-note">El código QR es aleatorio (8 caracteres, sin 0/O/1/I) y nunca usa datos personales como la fecha de nacimiento.</p>`);
}

function imprimir(r) {
    const gid = Number(r.q.get('grupo')); const sid = Number(r.q.get('alumno'));
    const list = (sid ? [D.student(S, sid)] : S.students.filter((s) => s.groupId === gid && !s.deleted).sort(D.byName)).filter((s) => s && D.activeCred(S, s.id, 'qr'));
    return `<div class="print-bar"><div><h1 class="serif">Credenciales${gid ? ' ' + D.groupShort(S, gid) : ''}</h1><p class="muted">${list.length} credenciales. Tamaño tarjeta (85.6 × 54 mm), 8 por hoja carta.</p></div>
        <div class="head-actions"><a class="btn" href="#/${sid ? 'alumnos?id=' + sid : 'credenciales'}">Volver</a><button class="btn primary" data-act="print">Imprimir</button></div></div>
        <div class="sheet">${list.map((s) => { const qr = D.activeCred(S, s.id, 'qr'); return `<article class="card"><div class="card-info"><span class="card-org">${esc(S.settings.institution)}</span><span class="card-name">${esc(s.first)}<br>${esc(`${s.pat} ${s.mat}`)}</span><span class="card-meta">${D.groupLong(S, s.groupId)}</span><span class="card-meta mono">Matrícula ${esc(s.enrollment)}</span></div><div class="card-qr">${qrSvg(qr.value)}<span class="mono">${D.qrDisplay(qr.value)}</span></div></article>`; }).join('')}</div>`;
}

// ── kioscos y kiosco ──
function kioscos() {
    const t = D.today();
    return shell('kioscos', `<div class="page-head"><div><h1>Kioscos</h1><p>Tabletas donde los alumnos registran su entrada. ${S.entries.filter((e) => D.ymd(new Date(e.at)) === t).length} entradas hoy.</p></div></div>
        <div class="table-wrap block"><table class="table"><thead><tr><th>Kiosco</th><th>Estado</th><th>Hoy</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>
        ${S.kiosks.map((k) => `<tr><td><span class="serif cell-name">${esc(k.name)}</span><br><span class="muted">${esc(k.location)}</span></td><td><span class="tag"><i class="sq presente"></i>En línea</span></td><td class="mono">${S.entries.filter((e) => e.kioskId === k.id && D.ymd(new Date(e.at)) === t).length}</td><td class="actions-cell"><a class="btn" href="#/kiosco/${k.id}">Abrir kiosco</a></td></tr>`).join('')}
        </tbody></table></div><p class="demo-note">En la app real cada tableta se vincula escaneando un QR con un token propio (solo se guarda su hash), funciona sin conexión con una cola en IndexedDB y se instala como app.</p>`);
}

let kioskTimer; let kioskClock;
function kiosco(r) {
    const kid = Number(r.args[0]) || 1;
    const k = S.kiosks.find((x) => x.id === kid) ?? S.kiosks[0];
    after.push(() => { renderStrip(k.id); tickClock(); clearInterval(kioskClock); kioskClock = setInterval(tickClock, 1000); });
    return `<div class="k-screen" data-kiosk="${k.id}">
        <div class="k-greet"><div class="k-org"><div><b>${esc(S.settings.institution)}</b>${esc(k.name)}, ${esc(k.location)}</div><a href="#/${me() ? 'kioscos' : 'login'}">Salir del kiosco</a></div>
            <h1 id="k-greeting">Buenos días.</h1><p class="k-instr">Pasa tu credencial por el lector o muestra tu código QR.</p>
            <div class="k-clock"><b id="k-clock">--:--:--</b><span id="k-date"></span></div></div>
        <div class="k-zone"><div class="k-target"><i></i><i></i><i></i><i></i><span>Lector NFC<br>y QR</span></div>
            <div class="k-sim" aria-label="Simular lecturas"><button type="button" data-act="sim" data-kind="qr">Simular lectura QR</button><button type="button" data-act="sim" data-kind="nfc">Simular NFC</button><button type="button" data-act="sim" data-kind="dup">Repetir la última</button><button type="button" data-act="sim" data-kind="bad">Credencial inválida</button></div>
            <div class="k-status"><span id="k-today"></span><span>También puedes teclear un código y pulsar Enter, como un lector USB.</span></div></div>
        <ol class="k-strip" id="k-strip" aria-label="Últimas entradas"></ol>
    </div>
    <div class="k-flash" id="k-flash" role="status" aria-live="assertive" hidden><div class="k-mono" id="k-mono"></div><div><p class="k-kind"><i></i><span id="k-kind"></span></p><p class="k-name" id="k-name"></p><dl><dt>Grado y grupo</dt><dd id="k-group"></dd><dt id="k-tlabel">Hora</dt><dd id="k-time"></dd><dt>Método</dt><dd id="k-method"></dd></dl></div></div>`;
}

function tickClock() {
    const el = $('#k-clock'); if (!el) return clearInterval(kioskClock);
    const d = new Date(); el.textContent = D.hms(d);
    $('#k-date').textContent = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    const h = d.getHours(); $('#k-greeting').textContent = h >= 5 && h < 12 ? 'Buenos días.' : h < 19 && h >= 12 ? 'Buenas tardes.' : 'Buenas noches.';
}

function renderStrip(kid) {
    const t = D.today();
    const todays = S.entries.filter((e) => D.ymd(new Date(e.at)) === t);
    const last = todays.filter((e) => e.kioskId === kid).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
    $('#k-today').textContent = `${todays.length} entradas hoy`;
    $('#k-strip').innerHTML = last.length ? last.map((e) => { const st = D.student(S, e.studentId); return `<li><span>${D.hm(new Date(e.at))}</span><b>${esc(st.first)} ${esc(st.pat)}</b><span>${D.groupShort(S, st.groupId)}, ${D.methodLabel(e.method)}</span></li>`; }).join('') : '<li style="grid-column:1/-1"><span>Aquí aparecerán las últimas entradas.</span></li>';
}

let lastSim = null;
function kioskScan(raw) {
    const screen = $('.k-screen'); if (!screen) return;
    const kid = Number(screen.dataset.kiosk);
    const res = D.recordScan(S, raw, kid); persist();
    const f = $('#k-flash');
    const kind = res.status === 'ok' ? 'ok' : res.status === 'duplicate' ? 'dup' : 'unknown';
    f.className = 'k-flash ' + kind;
    $('#k-kind').textContent = { ok: 'Entrada registrada', dup: 'Tu entrada ya estaba registrada', unknown: 'Credencial no reconocida' }[kind];
    $('#k-mono').textContent = res.student ? D.initials(res.student) : '?';
    $('#k-name').textContent = res.student ? D.fullName(res.student) : 'Pide ayuda en dirección.';
    $('#k-group').textContent = res.student ? D.groupShort(S, res.student.groupId) : '';
    $('#k-tlabel').textContent = kind === 'dup' ? 'Registrada a las' : 'Hora';
    $('#k-time').textContent = kind === 'ok' ? D.hms(new Date(res.entry.at)) : kind === 'dup' ? D.hm(new Date(res.previous.at)) : '';
    $('#k-method').textContent = res.method ?? '';
    const m = $('#k-mono'); m.style.animation = 'none'; void m.offsetWidth; m.style.animation = '';
    f.hidden = false; beep(kind);
    clearTimeout(kioskTimer); kioskTimer = setTimeout(() => { f.hidden = true; }, 1500);
    if (kind === 'ok') renderStrip(kid);
}

function simulate(kind) {
    if (kind === 'bad') return kioskScan('ZZZZ9999');
    if (kind === 'dup' && lastSim) return kioskScan(lastSim);
    const t = D.today();
    const entered = new Set(S.entries.filter((e) => D.ymd(new Date(e.at)) === t).map((e) => e.studentId));
    const pool = S.credentials.filter((c) => !c.revokedAt && c.type === (kind === 'nfc' ? 'nfc' : 'qr') && !entered.has(c.studentId) && !D.student(S, c.studentId)?.deleted);
    const c = pool[Math.floor(Math.random() * pool.length)] ?? S.credentials.find((x) => !x.revokedAt);
    lastSim = c.value;
    // El NFC se "teclea" con separadores, como algunos lectores: la app lo normaliza.
    kioskScan(kind === 'nfc' ? c.value.match(/../g).join(':') : c.value);
}

// Lectores HID: teclean el código y Enter. Captura global sin campo enfocado.
let buf = ''; let lastKey = 0;
document.addEventListener('keydown', (e) => {
    if (!$('.k-screen') || e.target.closest('input, textarea, select')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const now = performance.now();
    if (now - lastKey > 1500) buf = ''; // en la demo se tolera teclear a mano
    lastKey = now;
    if (e.key === 'Enter') { e.preventDefault(); if (buf.length >= 4) kioskScan(buf); buf = ''; }
    else if (e.key.length === 1) { e.preventDefault(); buf += e.key; }
}, true);

// ── pase de lista ──
function scheduleToday(course) {
    const wd = D.isoWeekday(D.today());
    const list = S.schedules.filter((x) => x.courseId === course.id);
    return list.find((x) => x.weekday === wd) ?? list[0];
}
const myCourses = () => S.courses.filter((c) => isAdmin() || c.teacherId === S.session);

function paseDeLista(r) {
    if (r.args[0]) return rollSheet(Number(r.args[0]));
    const now = D.hm(new Date());
    const items = myCourses().map((c) => ({ c, s: scheduleToday(c) })).sort((a, b) => a.s.start.localeCompare(b.s.start));
    const weekend = D.isoWeekday(D.today()) > 5;
    return shell('pase-de-lista', `<div class="page-head"><div><h1>Pase de lista</h1><p>Hoy, ${new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}.</p></div></div>
        ${weekend ? '<p class="demo-note">Es fin de semana. En la demo puedes pasar lista igual, como si fuera día de clases.</p>' : ''}
        <ol class="day">${items.map(({ c, s }) => { const live = now >= s.start && now <= s.end; return `<li class="day-item ${live ? 'is-now' : ''}"><span class="day-time mono">${s.start} a ${s.end}</span><span class="day-name"><b class="serif">${esc(c.name)}, ${D.groupShort(S, c.groupId)}</b><span class="muted">${esc(c.room)}${isAdmin() ? ', ' + esc(D.userName(D.user(S, c.teacherId))) : ''}</span></span><span class="day-state"><span class="tag"><i class="sq ${live ? 'presente' : 'confirmar'}"></i>${live ? 'En curso' : now < s.start ? 'Próxima' : 'Terminó'}</span></span><span class="day-action"><a class="btn ${live ? 'primary' : ''}" href="#/pase-de-lista/${c.id}">Pasar lista</a></span></li>`; }).join('')}</ol>
        <p class="demo-note">En la demo cualquier lista se puede editar a cualquier hora. En la app real solo durante el horario de la clase, y el servidor lo valida.</p>`);
}

let rollSel = null; let reordering = false;
function rollSheet(courseId) {
    const c = S.courses.find((x) => x.id === courseId);
    if (!c || (!isAdmin() && c.teacherId !== S.session)) { say('Esa clase no es tuya.', true); go('pase-de-lista'); return ''; }
    const sch = scheduleToday(c);
    const rc = D.openRollCall(S, sch.id, D.today()); persist();
    let rows = D.seatOrder(S, c).map((st) => { const e = D.entryFor(S, st.id, D.today(), sch.end); return { st, e, state: D.markState(rc.marks[st.id], !!e) }; });
    const key = { paternal: (x) => `${x.st.pat} ${x.st.mat} ${x.st.first}`, maternal: (x) => `${x.st.mat} ${x.st.pat} ${x.st.first}`, first_name: (x) => `${x.st.first} ${x.st.pat} ${x.st.mat}` }[c.sort];
    if (key) rows.sort((a, b) => D.collator.compare(key(a), key(b)));
    if (c.sort === 'arrival') rows.sort((a, b) => (a.e?.at ?? '9').localeCompare(b.e?.at ?? '9'));
    const counts = Object.fromEntries(Object.keys(D.STATES).map((k) => [k, 0])); rows.forEach((x) => counts[x.state]++);
    const sel = rows.find((x) => x.st.id === rollSel);
    after.push(() => { const s = document.querySelector(`.seat[data-id="${rollSel}"]`); s?.focus(); });
    return shell('pase-de-lista', `<div class="room" data-course="${c.id}" data-rc="${rc.id}">
        <div class="room-main"><div class="room-head"><div><h1>${esc(c.name)}, ${D.groupShort(S, c.groupId)}</h1><p class="sub"><span>${new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</span><span class="mono">${sch.start} a ${sch.end}</span><span>${esc(c.room)}</span></p></div>
            <div class="room-tools"><label class="sr-only" for="sort">Ordenar</label><select class="input compact" id="sort" ${reordering ? 'disabled' : ''}>${[['seat', 'Mi orden'], ['paternal', 'Apellido paterno'], ['maternal', 'Apellido materno'], ['first_name', 'Nombre'], ['arrival', 'Hora de llegada']].map(([v, l]) => `<option value="${v}" ${c.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <button type="button" class="btn" data-act="reorder" aria-pressed="${reordering}">${reordering ? 'Listo' : 'Acomodar lugares'}</button></div></div>
            ${reordering ? '<div class="reorder-bar" role="status"><span>Arrastra los lugares o elige uno y usa Alt + flechas.</span><button type="button" class="link" data-act="alpha">Volver al alfabético</button></div>' : ''}
            ${notice()}<div class="front" aria-hidden="true">Pizarrón</div>
            <div class="seats" role="grid" aria-label="Lugares del aula">${rows.map((x, i) => `<button type="button" class="seat" role="gridcell" data-id="${x.st.id}" data-entry="${x.e ? 1 : 0}" data-s="${x.state}" aria-selected="${x.st.id === rollSel}" ${reordering ? 'draggable="true"' : ''} aria-label="${esc(D.fullName(x.st))}, ${D.STATES[x.state]}"><span class="seat-top"><span class="mono">${String(i + 1).padStart(2, '0')}</span><i class="sq ${x.state}"></i></span><b>${esc(x.st.first)}<br>${esc(x.st.pat)}</b><span class="t">${x.e ? (x.e.method === 'manual' ? `${D.hm(new Date(x.e.at))} <span class="manual-tag">Entrada manual</span>` : `${D.hm(new Date(x.e.at))} ${D.methodLabel(x.e.method)}`) : 'Sin entrada'}</span></button>`).join('')}</div></div>
        <aside class="panel"><div class="clockline"><div>Lista abierta</div><div class="track"><i style="width:40%"></i></div><div class="ends"><span>${sch.start}</span><span>Cierra ${sch.end}</span></div></div>
            <div><h3>Resumen</h3><div class="counts">${Object.entries(D.STATES).map(([k, l]) => `<div><b>${counts[k]}</b><span><i class="sq ${k}"></i>${l}</span></div>`).join('')}</div></div>
            <button type="button" class="btn primary block" data-act="confirm-all" ${counts.confirmar ? '' : 'disabled'}>${counts.confirmar ? `Confirmar todas las entradas (${counts.confirmar})` : 'Sin entradas por confirmar'}</button>
            ${sel ? `<div class="actionbar"><p><span class="muted">Lugar elegido</span> <b class="serif">${esc(sel.st.first)} ${esc(sel.st.pat)}</b></p><div class="actions"><button type="button" class="act" data-act="mark" data-v="present"><i class="sq presente"></i>Presente</button><button type="button" class="act" data-act="mark" data-v="late"><i class="sq retardo"></i>Retardo</button><button type="button" class="act" data-act="mark" data-v="absent"><i class="sq ${sel.e ? 'noaula' : 'falta'}"></i>${sel.e ? 'No en aula' : 'Falta'}</button></div>
                <div class="actions-sub"><button type="button" class="link" data-act="mark" data-v="">Quitar marca</button>${reordering ? '<button type="button" class="link" data-act="move" data-d="-1">Mover antes</button><button type="button" class="link" data-act="move" data-d="1">Mover después</button>' : ''}<button type="button" class="link" data-act="unsel">Cerrar</button></div></div>` : ''}
            <div class="keys-help"><h3>Teclado</h3><div class="keys"><span><kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd></span><span>Moverse</span><kbd>P</kbd><span>Presente</span><kbd>R</kbd><span>Retardo</span><kbd>F</kbd><span>Falta o no en aula</span><kbd>C</kbd><span>Confirmar todas</span><kbd>⌫</kbd><span>Quitar marca</span></div></div>
        </aside></div>`, { flush: true });
}

function setMark(status) {
    const room = $('.room'); if (!room || rollSel == null) return;
    const rc = S.rollCalls.find((x) => x.id === Number(room.dataset.rc));
    rc.marks[rollSel] = status || null; persist(); render();
}
function moveSeat(sid, delta) {
    const c = S.courses.find((x) => x.id === Number($('.room').dataset.course));
    const ids = D.seatOrder(S, c).map((s) => s.id);
    const i = ids.indexOf(sid); if (i < 0) return;
    ids.splice(i, 1); ids.splice(Math.max(0, Math.min(ids.length, i + delta)), 0, sid);
    c.seats = ids; c.sort = 'seat'; persist(); render();
}

// ── clases ──
function clases(r) {
    if (r.args[0]) return claseDetalle(Number(r.args[0]));
    const rows = myCourses().map((c) => { const ss = S.schedules.filter((x) => x.courseId === c.id); return `<tr><td><span class="serif cell-name">${esc(c.name)}</span><br><span class="muted">${D.groupShort(S, c.groupId)}, ${esc(c.room)}</span></td><td class="mono">Lun a vie ${ss[0].start} a ${ss[0].end}</td><td class="mono">${c.students.length}</td>${isAdmin() ? `<td>${esc(D.userName(D.user(S, c.teacherId)))}</td>` : ''}<td class="actions-cell"><a class="link" href="#/clases/${c.id}">Abrir</a></td></tr>`; }).join('');
    return shell('clases', `<div class="page-head"><div><h1>${isAdmin() ? 'Clases' : 'Mis clases'}</h1><p>Cada clase tiene su horario y su lista de alumnos.</p></div></div>
        <div class="table-wrap block"><table class="table"><thead><tr><th>Clase</th><th>Horario</th><th>Alumnos</th>${isAdmin() ? '<th>Docente</th>' : ''}<th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${rows}</tbody></table></div>`);
}

function claseDetalle(id) {
    const c = S.courses.find((x) => x.id === id);
    if (!c || (!isAdmin() && c.teacherId !== S.session)) { say('Esa clase no es tuya.', true); go('clases'); return ''; }
    const members = c.students.map((x) => D.student(S, x)).filter(Boolean).sort(D.byName);
    const others = S.students.filter((x) => !x.deleted && !c.students.includes(x.id) && x.groupId === c.groupId);
    return shell('clases', `<div class="page-head"><div><h1>${esc(c.name)}</h1><p>${D.groupLong(S, c.groupId)}. ${esc(c.room)}.</p></div><a class="btn primary" href="#/pase-de-lista/${c.id}">Pasar lista</a></div>${notice()}
        <div class="two-col"><section class="sec"><h2 class="sec-title">Alumnos de la clase <span class="mono">${members.length}</span></h2>
            <ul class="roster">${members.map((m) => `<li><span class="serif">${esc(D.listName(m))}</span><span class="mono muted">${D.groupShort(S, m.groupId)}</span><button class="link warn" data-act="course-remove" data-course="${c.id}" data-id="${m.id}">Quitar</button></li>`).join('')}</ul>
            ${others.length ? `<p style="margin-top:14px"><button class="btn" data-act="course-add-group" data-course="${c.id}">Agregar a los ${others.length} del grupo que faltan</button></p>` : ''}</section>
        <aside class="sec"><h2 class="sec-title">Horario</h2><ul class="roster">${S.schedules.filter((x) => x.courseId === c.id).map((s) => `<li><span>${D.DAYS[s.weekday]}</span><span class="mono">${s.start} a ${s.end}</span><span></span></li>`).join('')}</ul></aside></div>`);
}

// ── entrada manual ──
let manualState = { q: '', sid: null, reason: '', note: '', time: '' };
function entradaManual() {
    const m = manualState; m.time ||= D.hm(new Date());
    const st = m.sid && D.student(S, m.sid);
    const words = m.q.toLowerCase().split(/\s+/).filter(Boolean);
    const results = !st && m.q.trim().length >= 2 ? S.students.filter((x) => !x.deleted && words.every((w) => `${x.first} ${x.pat} ${x.mat} ${x.enrollment}`.toLowerCase().includes(w))).sort(D.byName).slice(0, 10) : [];
    const todays = S.entries.filter((e) => e.method === 'manual' && D.ymd(new Date(e.at)) === D.today()).sort((a, b) => b.at.localeCompare(a.at));
    const existing = st && D.entryFor(S, st.id, D.today());
    return shell('entrada-manual', `<div class="page-head"><div><h1>Entrada manual</h1><p>Para el alumno que no pudo pasar su credencial en el kiosco. Queda registrado quién la hizo y por qué.</p></div></div>${notice()}
        <div class="two-col"><form class="sec" data-form="manual" novalidate>
            <div class="field"><span class="field-label">Alumno</span>${st ? `<div class="picked"><div><b class="serif">${esc(D.fullName(st))}</b><span class="mono muted">${D.groupShort(S, st.groupId)}, ${esc(st.enrollment)}</span></div><button type="button" class="link" data-act="manual-clear">Cambiar</button></div>${existing ? `<p class="hint">Ya tiene entrada hoy a las ${D.hm(new Date(existing.at))} (${D.methodLabel(existing.method)}).</p>` : ''}`
                : `<input class="input" id="m-search" type="search" placeholder="Nombre o matrícula (prueba con “ma”)" value="${esc(m.q)}" autocomplete="off" aria-label="Buscar alumno">${results.length ? `<ul class="roster pick">${results.map((x) => `<li><button type="button" class="pick-btn" data-act="manual-pick" data-id="${x.id}"><span class="serif">${esc(D.listName(x))}</span><span class="mono muted">${D.groupShort(S, x.groupId)}</span></button></li>`).join('')}</ul>` : m.q.trim().length >= 2 ? '<p class="hint">Ningún alumno coincide.</p>' : ''}`}</div>
            <fieldset class="field"><legend class="field-label">Motivo</legend><div class="radio-col">${Object.entries(D.MANUAL_REASONS).map(([v, l]) => `<label class="check"><input type="radio" name="reason" value="${v}" ${m.reason === v ? 'checked' : ''}> ${l}</label>`).join('')}</div></fieldset>
            ${m.reason === 'other' ? `<div class="field"><label for="m-note">¿Cuál?</label><input class="input" id="m-note" maxlength="200" value="${esc(m.note)}" placeholder="Ej. llegó con su tutor por cita médica"></div>` : ''}
            <div class="field"><label for="m-time">Hora de entrada (hoy)</label><input class="input compact mono" id="m-time" type="time" value="${m.time}"></div>
            <p class="error" id="m-error" hidden></p>
            <div class="form-actions"><button class="btn primary" type="submit">Registrar entrada</button></div></form>
        <aside class="sec"><h2 class="sec-title">Entradas manuales de hoy <span class="mono">${todays.length}</span></h2>${todays.length ? `<ul class="roster">${todays.map((e) => { const x = D.student(S, e.studentId); return `<li class="manual-row"><span><span class="serif">${esc(D.listName(x))}</span><br><span class="muted small">${D.MANUAL_REASONS[e.manualReason]}${e.manualNote ? ': ' + esc(e.manualNote) : ''}. Registró ${esc(D.userName(D.user(S, e.createdBy)))}.</span></span><span class="mono">${D.hm(new Date(e.at))}</span></li>`; }).join('')}</ul>` : '<p class="muted">Ninguna todavía.</p>'}</aside></div>`);
}

// ── reportes ──
let rep = null;
function reportes() {
    const t = D.today();
    rep ??= { from: (() => { const d = new Date(); d.setDate(d.getDate() - 14); return D.ymd(d); })(), to: t, grade: null, number: null, tab: 'alumnos' };
    const rows = D.reportRows(S, rep.from, rep.to, { grade: rep.grade, number: rep.number }).sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || D.byName(a.student, b.student));
    const tot = rows.reduce((a, r) => { for (const k of ['total', 'present', 'late', 'unconfirmed', 'notInClass', 'absent']) a[k] += r[k]; return a; }, { total: 0, present: 0, late: 0, unconfirmed: 0, notInClass: 0, absent: 0 });
    const rate = tot.total ? Math.round((tot.present + tot.late + tot.unconfirmed) / tot.total * 100) + '%' : '—';
    const chips = (label, key, vals, fmt) => `<div class="chips" role="group" aria-label="${label}"><span class="chips-label">${label}</span>${vals.map((v) => `<button type="button" data-act="rep-chip" data-key="${key}" data-v="${v}" aria-pressed="${rep[key] === v}">${fmt(v)}</button>`).join('')}</div>`;
    let body = '';
    if (rep.tab === 'alumnos') {
        body = rows.length ? `<div class="table-wrap"><table class="table report"><thead><tr><th>Alumno</th><th>Grupo</th><th class="n">Clases</th><th class="n">Presente</th><th class="n">Retardo</th><th class="n">Sin conf.</th><th class="n">No en aula</th><th class="n">Falta</th><th>Asistencia</th></tr></thead><tbody>${rows.map((r) => `<tr><td><a class="serif cell-name plain-link" href="#/alumnos?id=${r.student.id}">${esc(D.listName(r.student))}</a></td><td class="mono">${D.groupShort(S, r.student.groupId)}</td><td class="mono n">${r.total}</td><td class="mono n">${r.present}</td><td class="mono n">${r.late}</td><td class="mono n">${r.unconfirmed}</td><td class="mono n">${r.notInClass}</td><td class="mono n">${r.absent}</td><td><span class="rate ${r.rate < 80 ? 'low' : ''}"><span class="bar"><i style="width:${r.rate}%"></i></span><span class="mono">${r.rate}%</span></span></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No hay pases de lista en este periodo.</p>';
    } else if (rep.tab === 'no-en-aula') {
        const list = [];
        for (const rc of S.rollCalls) { if (rc.date < rep.from || rc.date > rep.to) continue; const sch = S.schedules.find((x) => x.id === rc.scheduleId); const c = S.courses.find((x) => x.id === sch.courseId);
            for (const [sid, st] of Object.entries(rc.marks)) { const e = D.entryFor(S, Number(sid), rc.date, sch.end); if (st === 'absent' && e) list.push({ rc, sch, c, s: D.student(S, Number(sid)), e }); } }
        list.sort((a, b) => b.rc.date.localeCompare(a.rc.date));
        body = `<p class="muted tab-intro">Alumnos que registraron su entrada pero el docente marcó que no estaban en clase.</p>` + (list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Alumno</th><th>Grupo</th><th>Clase</th><th>Entrada</th><th>Docente</th></tr></thead><tbody>${list.map((x) => `<tr><td class="mono">${x.rc.date.slice(8)}/${x.rc.date.slice(5, 7)} ${x.sch.start}</td><td class="serif cell-name">${esc(D.listName(x.s))}</td><td class="mono">${D.groupShort(S, x.s.groupId)}</td><td>${esc(x.c.name)}</td><td class="mono">${D.hm(new Date(x.e.at))} ${D.methodLabel(x.e.method)}</td><td class="muted">${esc(D.userName(D.user(S, x.c.teacherId)))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Nadie en este periodo.</p>');
    } else {
        const out = S.courses.map((c) => { let expected = 0, missing = 0, unconf = 0; const now = new Date();
            for (let d = new Date(rep.from + 'T12:00'); D.ymd(d) <= rep.to; d.setDate(d.getDate() + 1)) { const date = D.ymd(d);
                for (const s of S.schedules.filter((x) => x.courseId === c.id && x.weekday === D.isoWeekday(date))) { if (D.at(date, s.end) > now) continue; expected++; const rc = S.rollCalls.find((x) => x.scheduleId === s.id && x.date === date); if (!rc) missing++; else for (const [sid, st] of Object.entries(rc.marks)) if (st === null && D.entryFor(S, Number(sid), date, s.end)) unconf++; } }
            return { c, expected, missing, unconf }; }).sort((a, b) => b.missing - a.missing || b.unconf - a.unconf);
        body = `<p class="muted tab-intro">Sesiones que ya terminaron. "Sin pase de lista": nadie abrió la lista. "Sin confirmar": entradas que el docente no confirmó.</p><div class="table-wrap"><table class="table report"><thead><tr><th>Clase</th><th>Docente</th><th class="n">Sesiones</th><th class="n">Sin pase de lista</th><th class="n">Sin confirmar</th></tr></thead><tbody>${out.map((x) => `<tr><td><span class="serif cell-name">${esc(x.c.name)}</span> <span class="mono muted">${D.groupShort(S, x.c.groupId)}</span></td><td>${esc(D.userName(D.user(S, x.c.teacherId)))}</td><td class="mono n">${x.expected}</td><td class="mono n">${x.missing ? `<span class="tag"><i class="sq falta"></i>${x.missing}</span>` : '0'}</td><td class="mono n">${x.unconf ? `<span class="tag"><i class="sq confirmar"></i>${x.unconf}</span>` : '0'}</td></tr>`).join('')}</tbody></table></div>`;
    }
    return shell('reportes', `<div class="page-head"><div><h1>Reportes</h1><p>Del ${rep.from} al ${rep.to}.</p></div><button class="btn" data-act="csv">Exportar CSV</button></div>
        <div class="filters"><div class="inline-form"><label class="field-label" for="r-from">Desde</label><input class="input compact mono" type="date" id="r-from" value="${rep.from}" max="${t}"><label class="field-label" for="r-to">Hasta</label><input class="input compact mono" type="date" id="r-to" value="${rep.to}" max="${t}"></div>
            ${chips('Grado', 'grade', [1, 2, 3], (v) => v + '°')}${chips('Grupo', 'number', [1, 2, 3, 4], (v) => v)}</div>
        <div class="counts-row six"><div><b>${rate}</b><span>Asistencia a clases</span></div><div><b>${tot.present}</b><span><i class="sq presente"></i>Presente</span></div><div><b>${tot.late}</b><span><i class="sq retardo"></i>Retardo</span></div><div><b>${tot.unconfirmed}</b><span><i class="sq confirmar"></i>Sin confirmar</span></div><div><b>${tot.notInClass}</b><span><i class="sq noaula"></i>No en aula</span></div><div><b>${tot.absent}</b><span><i class="sq falta"></i>Falta</span></div></div>
        <p class="mono muted note">"Sin confirmar": tenía entrada y el docente no la confirmó; cuenta como asistencia.</p>
        <div class="tabs-bar" role="tablist">${[['alumnos', 'Por alumno'], ['no-en-aula', 'Entró pero no llegó a clase'], ['clases', 'Clases y docentes']].map(([k, l]) => `<button type="button" role="tab" data-act="rep-tab" data-v="${k}" aria-selected="${rep.tab === k}">${l}</button>`).join('')}</div>${body}`);
}

// Evita inyección de fórmulas al abrir el CSV en Excel (=, +, -, @ al inicio).
const csvCell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function exportCsv() {
    const rows = D.reportRows(S, rep.from, rep.to, { grade: rep.grade, number: rep.number });
    const lines = [['matricula', 'alumno', 'grupo', 'clases', 'presente', 'retardo', 'sin_confirmar', 'no_en_aula', 'falta', 'asistencia_pct'], ...rows.map((r) => [r.student.enrollment, D.listName(r.student), D.groupShort(S, r.student.groupId), r.total, r.present, r.late, r.unconfirmed, r.notInClass, r.absent, r.rate])];
    const blob = new Blob(['﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `asistencia-por-alumno_${rep.from}_${rep.to}.csv` });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── ajustes ──
function ajustes() {
    return shell('ajustes', `<div class="page-head"><div><h1>Ajustes</h1><p>Lo propio de cada escuela vive aquí, no en el código: cada cliente tiene su propia instalación.</p></div></div>${notice()}
        <form class="form-narrow" data-form="settings"><div class="field"><label for="s-name">Nombre de la institución</label><input class="input" id="s-name" maxlength="80" value="${esc(S.settings.institution)}"></div>
            <div class="field"><label for="s-win">Anti-duplicado del kiosco (minutos)</label><input class="input compact mono" id="s-win" type="number" min="1" max="60" value="${S.settings.windowMin}"><p class="hint">Si el mismo alumno pasa otra vez dentro de este tiempo, no se registra otra entrada.</p></div>
            <div class="field"><span class="field-label">Grados y grupos</span><p>${S.settings.grades} grados × ${S.settings.groupsPerGrade} grupos</p></div>
            <div class="form-actions"><button class="btn primary" type="submit">Guardar</button></div></form>
        <section class="sec" style="max-width:480px;margin-top:24px"><h2 class="sec-title">Datos de la demo</h2><p class="muted">Todo se guarda solo en este navegador. Reiniciar borra tus cambios y vuelve a los datos ficticios de arranque.</p><p style="margin-top:12px"><button class="btn danger" data-act="reset">Reiniciar demo</button></p></section>`);
}

// ══ Eventos (delegados) ══════════════════════════════
document.addEventListener('click', (e) => {
    const seat = e.target.closest('.seat');
    if (seat) { rollSel = Number(seat.dataset.id); render(); return; }
    const t = e.target.closest('[data-act], [data-nav-toggle], [data-reset]');
    if (!t) { if (!e.target.closest('.side')) document.querySelector('.app')?.classList.remove('nav-open'); return; }
    if (t.matches('[data-nav-toggle]')) { const a = $('.app'); a.classList.toggle('nav-open'); t.setAttribute('aria-expanded', a.classList.contains('nav-open')); return; }
    if (t.matches('[data-reset]')) return resetDemo();
    const act = t.dataset.act; const id = Number(t.dataset.id);
    const actions = {
        login: () => { S.session = id; persist(); go('inicio'); },
        logout: () => { S.session = null; persist(); go('login'); },
        theme: () => { const d = document.documentElement; const dark = d.dataset.theme ? d.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; d.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('marcaje-demo-theme', d.dataset.theme); } catch {} },
        chip: () => { const k = t.dataset.key, v = Number(t.dataset.v); alumnosState[k] = alumnosState[k] === v ? null : v; render(); },
        'new-student': () => go('alumnos?nuevo=1'),
        regen: () => { S.credentials.filter((c) => c.studentId === id && c.type === 'qr' && !c.revokedAt).forEach((c) => (c.revokedAt = new Date().toISOString())); S.credentials.push({ id: D.nextId(S, 'cred'), studentId: id, type: 'qr', value: D.randomCode(), revokedAt: null }); persist(); say('Código QR nuevo generado. El anterior ya no funciona.'); render(); },
        revoke: () => { S.credentials.filter((c) => c.studentId === id && c.type === t.dataset.type && !c.revokedAt).forEach((c) => (c.revokedAt = new Date().toISOString())); persist(); say(t.dataset.type === 'nfc' ? 'Pegatina NFC desvinculada.' : 'Código QR revocado.'); render(); },
        download: () => { const qr = D.activeCred(S, id, 'qr'); const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([qrSvg(qr.value)], { type: 'image/svg+xml' })), download: `qr-${D.student(S, id).enrollment}.svg` }); a.click(); },
        drop: () => { if (!confirm('¿Dar de baja al alumno? Sus credenciales se revocan.')) return; D.student(S, id).deleted = true; S.credentials.filter((c) => c.studentId === id && !c.revokedAt).forEach((c) => (c.revokedAt = new Date().toISOString())); persist(); say('Alumno dado de baja. Su historial se conserva.'); go('alumnos'); },
        temp: () => { const u = D.user(S, id); u.temp = true; persist(); say(`Contraseña temporal de ${u.first}: ${Array.from({ length: 3 }, () => Math.random().toString(36).slice(2, 6)).join('-')} (de mentira: es una demo).`); render(); },
        print: () => window.print(),
        sim: () => simulate(t.dataset.kind),
        reorder: () => { reordering = !reordering; const c = S.courses.find((x) => x.id === Number($('.room').dataset.course)); c.sort = 'seat'; persist(); render(); },
        alpha: () => { const c = S.courses.find((x) => x.id === Number($('.room').dataset.course)); c.seats = []; persist(); say('Lugares en orden alfabético.'); render(); },
        'confirm-all': () => { const rc = S.rollCalls.find((x) => x.id === Number($('.room').dataset.rc)); const sch = S.schedules.find((x) => x.id === rc.scheduleId); let n = 0; for (const sid of Object.keys(rc.marks)) if (rc.marks[sid] === null && D.entryFor(S, Number(sid), rc.date, sch.end)) { rc.marks[sid] = 'present'; n++; } persist(); say(`${n} entradas confirmadas.`); render(); },
        mark: () => setMark(t.dataset.v),
        move: () => moveSeat(rollSel, Number(t.dataset.d)),
        unsel: () => { rollSel = null; render(); },
        'course-remove': () => { const c = S.courses.find((x) => x.id === Number(t.dataset.course)); c.students = c.students.filter((x) => x !== id); persist(); say('Alumno quitado de la clase.'); render(); },
        'course-add-group': () => { const c = S.courses.find((x) => x.id === Number(t.dataset.course)); S.students.filter((x) => !x.deleted && x.groupId === c.groupId && !c.students.includes(x.id)).forEach((x) => c.students.push(x.id)); persist(); say('Alumnos agregados.'); render(); },
        'manual-pick': () => { manualState.sid = id; render(); },
        'manual-clear': () => { manualState.sid = null; render(); },
        'rep-chip': () => { const k = t.dataset.key, v = Number(t.dataset.v); rep[k] = rep[k] === v ? null : v; render(); },
        'rep-tab': () => { rep.tab = t.dataset.v; render(); },
        csv: exportCsv,
        reset: resetDemo,
    };
    actions[act]?.();
});

function resetDemo() {
    if (!confirm('¿Reiniciar la demo? Se borran tus cambios y vuelven los datos ficticios de arranque.')) return;
    D.reset(); S = D.load(); rollSel = null; reordering = false; rep = null; manualState = { q: '', sid: null, reason: '', note: '', time: '' }; alumnosState = { q: '', grade: null, number: null };
    go('login');
}

document.addEventListener('input', (e) => {
    if (e.target.id === 'a-search') { alumnosState.q = e.target.value; const pos = e.target.selectionStart; render(); const i = $('#a-search'); i.focus(); i.setSelectionRange(pos, pos); }
    if (e.target.id === 'm-search') { manualState.q = e.target.value; const pos = e.target.selectionStart; render(); const i = $('#m-search'); i.focus(); i.setSelectionRange(pos, pos); }
    if (e.target.id === 'm-note') manualState.note = e.target.value;
    if (e.target.id === 'm-time') manualState.time = e.target.value;
});
document.addEventListener('change', (e) => {
    if (e.target.name === 'reason') { manualState.reason = e.target.value; render(); }
    if (e.target.id === 'sort') { const c = S.courses.find((x) => x.id === Number($('.room').dataset.course)); c.sort = e.target.value; persist(); render(); }
    if (e.target.id === 'r-from' || e.target.id === 'r-to') { rep[e.target.id === 'r-from' ? 'from' : 'to'] = e.target.value || D.today(); if (rep.from > rep.to) [rep.from, rep.to] = [rep.to, rep.from]; render(); }
});

document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]'); if (!f) return;
    e.preventDefault();
    const id = Number(f.dataset.id);
    if (f.dataset.form === 'nfc') {
        const v = D.normalize($('#nfc-in').value);
        if (v.length < 4) { say('No se leyó un UID válido.', true); return render(); }
        const taken = S.credentials.find((c) => !c.revokedAt && c.value === v);
        if (taken) { say(`Esa pegatina ya está vinculada a ${D.fullName(D.student(S, taken.studentId))}.`, true); return render(); }
        S.credentials.push({ id: D.nextId(S, 'cred'), studentId: id, type: 'nfc', value: v, revokedAt: null }); persist(); say(`Pegatina NFC ${v} vinculada.`); render();
    }
    if (f.dataset.form === 'group') { D.student(S, id).groupId = Number($('#g-sel').value) || null; persist(); say('Grupo actualizado.'); render(); }
    if (f.dataset.form === 'new-student') {
        const first = $('#n-first').value.trim(), pat = $('#n-pat').value.trim();
        if (!first || !pat) { const err = $('#n-error'); err.textContent = 'Escribe nombre y apellido paterno.'; err.hidden = false; return; }
        const st = { id: D.nextId(S, 'student'), first, pat, mat: $('#n-mat').value.trim(), enrollment: String(20259000 + D.nextId(S, 'enroll')), groupId: Number($('#n-group').value), deleted: false };
        S.students.push(st); S.credentials.push({ id: D.nextId(S, 'cred'), studentId: st.id, type: 'qr', value: D.randomCode(), revokedAt: null }); persist();
        say(`${D.fullName(st)} fue agregado con su código QR.`); go('alumnos?id=' + st.id);
    }
    if (f.dataset.form === 'manual') {
        const m = manualState; const err = $('#m-error');
        const fail = (t) => { err.textContent = t; err.hidden = false; };
        if (!m.sid) return fail('Elige al alumno.');
        if (!m.reason) return fail('Elige el motivo.');
        if (m.reason === 'other' && !m.note.trim()) return fail('Escribe el motivo.');
        const res = D.recordManual(S, m.sid, m.reason, m.note.trim(), m.time || D.hm(new Date()), S.session);
        if (res.status === 'future') return fail('La hora no puede ser posterior a ahora.');
        if (res.status === 'duplicate') { say(`Ya tiene entrada a las ${D.hm(new Date(res.previous.at))} (${D.methodLabel(res.previous.method)}). No se registró otra.`, true); return render(); }
        persist(); say(`Entrada manual registrada: ${D.fullName(D.student(S, m.sid))}, ${m.time}.`);
        manualState = { q: '', sid: null, reason: '', note: '', time: '' }; render();
    }
    if (f.dataset.form === 'settings') {
        const name = $('#s-name').value.trim(); const win = Number($('#s-win').value);
        if (!name || !(win >= 1 && win <= 60)) { say('Revisa los datos: nombre obligatorio y minutos entre 1 y 60.', true); return render(); }
        S.settings.institution = name; S.settings.windowMin = win; persist(); say('Ajustes guardados.'); render();
    }
});

// Teclado del pase de lista y arrastre de lugares
document.addEventListener('keydown', (e) => {
    const seat = e.target.closest?.('.seat'); if (!seat) return;
    const list = [...document.querySelectorAll('.seat')]; const i = list.indexOf(seat);
    const cols = getComputedStyle($('.seats')).gridTemplateColumns.split(' ').length;
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (step !== undefined) { e.preventDefault(); if (e.altKey && reordering) return moveSeat(Number(seat.dataset.id), step); const n = list[Math.max(0, Math.min(list.length - 1, i + step))]; rollSel = Number(n.dataset.id); n.focus(); list.forEach((s) => s.setAttribute('aria-selected', s === n)); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    rollSel = Number(seat.dataset.id);
    const map = { p: 'present', r: 'late', f: 'absent' }; const k = e.key.toLowerCase();
    if (map[k]) { e.preventDefault(); setMark(map[k]); }
    else if (k === 'c') { e.preventDefault(); $('[data-act="confirm-all"]')?.click(); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); setMark(''); }
});
let dragId = null;
document.addEventListener('dragstart', (e) => { const s = e.target.closest?.('.seat'); if (s && reordering) { dragId = Number(s.dataset.id); e.dataTransfer.effectAllowed = 'move'; } });
document.addEventListener('dragover', (e) => { if (dragId && e.target.closest?.('.seat')) e.preventDefault(); });
document.addEventListener('drop', (e) => {
    const s = e.target.closest?.('.seat'); if (!s || !dragId) return; e.preventDefault();
    const c = S.courses.find((x) => x.id === Number($('.room').dataset.course));
    const ids = D.seatOrder(S, c).map((x) => x.id); const to = ids.indexOf(Number(s.dataset.id));
    ids.splice(ids.indexOf(dragId), 1); ids.splice(to, 0, dragId); c.seats = ids; c.sort = 'seat'; dragId = null; persist(); render();
});

try { const t = localStorage.getItem('marcaje-demo-theme'); if (t) document.documentElement.dataset.theme = t; } catch {}
render();
