const http = require("http");
const fs = require("fs").promises;
const path = require("path");
const { randomUUID, timingSafeEqual } = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const HOST = process.env.HOST || (IS_PRODUCTION ? "0.0.0.0" : "127.0.0.1");
const DATA_DIR = process.env.DATA_DIR || __dirname;
const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const DATABASE_FILE = path.join(DATA_DIR, "reports.json");
const ROBLOX_DATABASE_FILE = path.join(DATA_DIR, "roblox-users.json");

function hasValidAdminCredentials(req) {
    const authorization = req.headers.authorization || "";
    if (!authorization.startsWith("Basic ")) return false;

    const provided = Buffer.from(authorization.slice(6), "base64");
    const expected = Buffer.from(`${ADMIN_USER}:${ADMIN_PASSWORD}`);
    return provided.length === expected.length && timingSafeEqual(provided, expected);
}

async function readReports() {
    try {
        return JSON.parse(await fs.readFile(DATABASE_FILE, "utf8"));
    } catch (error) {
        if (error.code === "ENOENT") {
            return [];
        }

        throw error;
    }
}

async function saveReport(report) {
    const reports = await readReports();
    reports.push(report);
    await fs.writeFile(DATABASE_FILE, JSON.stringify(reports, null, 2));
}

async function deleteReport(id) {
    const reports = await readReports();
    const remainingReports = reports.filter(report => report.id !== id);
    if (remainingReports.length === reports.length) return false;
    await fs.writeFile(DATABASE_FILE, JSON.stringify(remainingReports, null, 2));
    return true;
}

async function readRobloxUsers() {
    try {
        return JSON.parse(await fs.readFile(ROBLOX_DATABASE_FILE, "utf8"));
    } catch (error) {
        if (error.code === "ENOENT") {
            return [];
        }

        throw error;
    }
}

async function saveRobloxUser(user) {
    const users = await readRobloxUsers();
    const now = new Date().toISOString();
    const existingUser = users.find(savedUser => savedUser.id === user.id);

    if (existingUser) {
        Object.assign(existingUser, user, { lastCheckedAt: now });
    } else {
        users.push({ ...user, firstSeenAt: now, lastCheckedAt: now });
    }

    await fs.writeFile(ROBLOX_DATABASE_FILE, JSON.stringify(users, null, 2));
}

async function deleteRobloxUser(id) {
    const users = await readRobloxUsers();
    const remainingUsers = users.filter(user => String(user.id) !== id);
    if (remainingUsers.length === users.length) return false;
    await fs.writeFile(ROBLOX_DATABASE_FILE, JSON.stringify(remainingUsers, null, 2));
    return true;
}

const html = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RavenWatch</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">

    <style>
        :root {
            color-scheme: light;
            --ink: #172d27;
            --forest: #173b32;
            --forest-deep: #102c25;
            --paper: #f1f4ed;
            --surface: #fffefa;
            --line: #d7dfd5;
            --muted: #687970;
            --lime: #c8ed78;
            --coral: #dc775d;
        }

        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; color: var(--ink); background: var(--paper); font-family: "DM Sans", "Segoe UI", sans-serif; }
        a { color: inherit; }
        .site-header { padding: 0 28px; color: #fffefa; background: var(--forest-deep); }
        .site-header-inner { width: min(1120px, 100%); min-height: 76px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .brand { display: inline-flex; align-items: center; gap: 12px; text-decoration: none; font-family: "Space Grotesk", "Segoe UI", sans-serif; font-size: 18px; font-weight: 700; }
        .brand-mark { width: 36px; aspect-ratio: 1; display: grid; place-items: center; color: var(--forest-deep); background: var(--lime); border-radius: 5px; font-size: 19px; }
        .brand-meta { display: grid; gap: 2px; }
        .brand-meta small { color: #a5b9ac; font: 600 10px "DM Sans", sans-serif; }
        .admin-link { display: inline-flex; align-items: center; gap: 12px; padding: 10px 13px; border: 1px solid #49665b; border-radius: 5px; color: #f7faef; font-size: 13px; font-weight: 700; text-decoration: none; transition: background 160ms ease, color 160ms ease; }
        .admin-link:hover { color: var(--forest-deep); background: var(--lime); }
        .home-main { width: min(1120px, calc(100% - 48px)); margin: 38px auto 72px; }
        .hero { min-height: 210px; position: relative; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; overflow: hidden; padding: 32px 38px; color: #f8f8ef; background-color: var(--forest); background-image: repeating-linear-gradient(135deg, transparent 0 17px, rgba(255,255,255,.035) 17px 18px); border-radius: 7px; }
        .hero::after { content: "RW"; position: absolute; right: 185px; bottom: -45px; color: rgba(200,237,120,.11); font: 700 190px/.9 "Space Grotesk", sans-serif; pointer-events: none; }
        .eyebrow { margin: 0 0 12px; color: var(--coral); font-size: 11px; font-weight: 700; }
        .hero .eyebrow { color: var(--lime); }
        .hero h1 { position: relative; z-index: 1; margin: 0; font: 600 44px/1.08 "Space Grotesk", "Segoe UI", sans-serif; }
        .hero-index { position: relative; z-index: 1; min-width: 110px; padding-left: 14px; border-left: 1px solid #779084; color: #dce9db; font-size: 11px; font-weight: 700; line-height: 1.7; letter-spacing: 1px; }
        .report-section { margin-top: 22px; padding: 28px 32px 30px; background: var(--surface); border: 1px solid var(--line); border-radius: 7px; box-shadow: 0 12px 32px rgba(23,45,39,.055); }
        .section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; padding-bottom: 19px; border-bottom: 1px solid var(--line); }
        .section-heading .eyebrow { margin-bottom: 6px; }
        .section-heading h2 { margin: 0; font: 600 24px/1.2 "Space Grotesk", "Segoe UI", sans-serif; }
        .required-note { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 10px; font-weight: 700; }
        .required-note span { width: 7px; height: 7px; border-radius: 50%; background: var(--coral); }
        .report-fields { display: grid; grid-template-columns: minmax(190px, .72fr) minmax(0, 1.6fr); gap: 20px; padding-top: 22px; }
        .field { display: grid; align-content: start; gap: 8px; }
        .field-full { grid-column: 1 / -1; }
        label { color: var(--ink); font-size: 13px; font-weight: 700; }
        input, textarea { width: 100%; margin: 0; padding: 12px 13px; border: 1px solid #cbd6ce; border-radius: 4px; color: var(--ink); background: #fbfcf8; font: inherit; outline: none; transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease; }
        input { min-height: 46px; }
        textarea { min-height: 150px; resize: vertical; line-height: 1.5; }
        input:focus, textarea:focus { border-color: #397b64; background: #fff; box-shadow: 0 0 0 3px rgba(57,123,100,.13); }
        .form-actions { display: flex; align-items: center; gap: 16px; margin-top: 20px; }
        button { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 16px; padding: 0 17px; border: 0; border-radius: 4px; color: var(--forest-deep); background: var(--lime); font: 700 13px "DM Sans", sans-serif; cursor: pointer; transition: transform 150ms ease, background 150ms ease; }
        button:hover { transform: translateY(-1px); background: #b9df64; }
        button:focus-visible, a:focus-visible { outline: 3px solid var(--coral); outline-offset: 3px; }
        .result { flex: 1; min-width: 0; margin: 0; color: var(--muted); font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
        .page-footer { margin-top: 18px; color: #78877f; font-size: 11px; }
        @media (max-width: 640px) {
            .site-header { padding: 0 18px; }
            .site-header-inner { min-height: 68px; }
            .home-main { width: min(100% - 32px, 560px); margin-top: 20px; }
            .hero { min-height: 170px; padding: 24px; }
            .hero h1 { font-size: 34px; }
            .hero::after { right: 80px; font-size: 135px; }
            .hero-index { min-width: 76px; font-size: 9px; }
            .report-section { padding: 22px 18px; }
            .report-fields { grid-template-columns: 1fr; gap: 16px; }
            .field-full { grid-column: auto; }
            .section-heading { align-items: flex-start; flex-direction: column; }
            .form-actions { align-items: flex-start; flex-direction: column; }
            .form-actions button { width: 100%; }
        }
    </style>
</head>

<body>

<header class="site-header">
    <div class="site-header-inner">
        <a class="brand" href="/">
            <span class="brand-mark" aria-hidden="true">R</span>
            <span class="brand-meta">RavenWatch<small>COMMUNITY DESK</small></span>
        </a>
        <a class="admin-link" href="/Admin"><span>ADMIN</span><span aria-hidden="true">↗</span></a>
    </div>
</header>

<main class="home-main">
    <section class="hero">
        <div>
            <p class="eyebrow">RAVENWATCH / FIELD DESK</p>
            <h1>Laporan publik</h1>
        </div>
        <div class="hero-index">REPORT<br>NO. 01</div>
    </section>

    <section class="report-section">
        <div class="section-heading">
            <div>
                <p class="eyebrow">SUBMIT REPORT</p>
                <h2>Kirim laporan</h2>
            </div>
            <span class="required-note"><span></span> KOLOM WAJIB</span>
        </div>

        <div class="report-fields">
            <div class="field">
                <label for="reportUsername">Username</label>
                <input
            id="reportUsername"
            type="text"
            placeholder="Username yang dilaporkan"
                >
            </div>
            <div class="field field-full">
                <label for="description">Kronologi</label>
                <textarea
            id="description"
            placeholder="Jelaskan laporan..."
                ></textarea>
            </div>
        </div>
        <div class="form-actions">
            <button onclick="submitReport()"><span>Kirim laporan</span><span aria-hidden="true">↗</span></button>
            <div id="reportResult" class="result" aria-live="polite">Belum ada laporan.</div>
        </div>
    </section>
    <footer class="page-footer">RAVENWATCH <span aria-hidden="true">/</span> LOCAL DESK</footer>
</main>

<script>

async function submitReport() {

    const username =
        document.getElementById("reportUsername").value.trim();

    const description =
        document.getElementById("description").value.trim();

    if (!username || !description) {

        document.getElementById("reportResult").textContent =
            "Username dan kronologi wajib diisi.";

        return;
    }

    const result = document.getElementById("reportResult");
    result.textContent = "Menyimpan laporan...";

    try {
        const response = await fetch("/api/reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, description })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Gagal menyimpan laporan.");
        }

        result.textContent = "Laporan berhasil disimpan.";
    } catch (error) {
        result.textContent = error.message || "Tidak dapat menghubungi server.";
    }
}

</script>

</body>
</html>
`;

const adminHtml = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Laporan | RavenWatch</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
    <style>
        :root { color-scheme: light; --ink: #172d27; --forest: #173b32; --forest-deep: #102c25; --paper: #f1f4ed; --surface: #fffefa; --line: #d7dfd5; --muted: #687970; --lime: #c8ed78; --coral: #dc775d; }
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; color: var(--ink); background: var(--paper); font-family: "DM Sans", "Segoe UI", sans-serif; }
        main { width: min(1180px, calc(100% - 48px)); margin: 30px auto 64px; }
        .admin-topbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 22px 26px; color: #fffefa; background: var(--forest-deep); border-radius: 6px; }
        .admin-kicker, .eyebrow { margin: 0 0 6px; color: var(--lime); font-size: 10px; font-weight: 700; }
        h1 { margin: 0; font: 600 28px/1.15 "Space Grotesk", "Segoe UI", sans-serif; }
        h2 { margin: 0; font: 600 21px/1.25 "Space Grotesk", "Segoe UI", sans-serif; }
        a, button { font: 700 13px "DM Sans", sans-serif; }
        button { min-height: 42px; padding: 0 15px; color: var(--forest-deep); background: var(--lime); border: 0; border-radius: 4px; cursor: pointer; transition: transform 150ms ease, background 150ms ease; }
        button:hover { transform: translateY(-1px); background: #b9df64; }
        a:focus-visible, button:focus-visible, input:focus-visible { outline: 3px solid var(--coral); outline-offset: 3px; }
        .back-link { padding: 10px 13px; color: #fffefa; border: 1px solid #49665b; border-radius: 4px; text-decoration: none; white-space: nowrap; }
        .back-link:hover { color: var(--forest-deep); background: var(--lime); }
        .admin-search { display: grid; grid-template-columns: minmax(200px, .8fr) minmax(0, 1.5fr); align-items: end; gap: 20px 28px; margin: 20px 0 34px; padding: 22px 24px; background: #e1eadf; border: 1px solid #d0ddd0; border-radius: 6px; }
        .search-title .eyebrow, .section-head .eyebrow { color: #a45740; }
        .search-fields { display: flex; align-items: end; gap: 10px; }
        .search-fields label { display: grid; flex: 1; gap: 7px; font-size: 12px; font-weight: 700; }
        input { width: 100%; min-height: 42px; padding: 10px 12px; color: var(--ink); background: var(--surface); border: 1px solid #bdcfc1; border-radius: 4px; font: inherit; }
        .status { margin: 8px 0 0; color: var(--muted); font-size: 12px; }
        .search-status { grid-column: 1 / -1; min-height: 16px; }
        .data-section { margin-top: 30px; animation: rise-in 420ms ease both; }
        .section-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
        .section-head .status { margin: 0; text-align: right; }
        .table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; min-width: 700px; }
        th, td { padding: 13px 15px; text-align: left; vertical-align: top; border-bottom: 1px solid #e4e9e2; }
        th { color: #eaf1e8; background: var(--forest); font-size: 11px; letter-spacing: .4px; }
        td { color: #31443c; font-size: 13px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
        tbody tr:last-child td { border-bottom: 0; }
        tbody tr:hover { background: #f4f7ef; }
        .delete-button { min-height: 34px; padding: 0 11px; color: #fff; background: #b64e3e; }
        .delete-button:hover { background: #983d31; }
        .user-list { display: grid; gap: 12px; margin-top: 12px; }
        .user-record { padding: 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 5px; animation: rise-in 360ms ease both; }
        .user-record-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .user-record-title { margin: 0; color: var(--forest); font: 600 18px "Space Grotesk", sans-serif; overflow-wrap: anywhere; }
        .user-record-subtitle { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
        .user-details { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 17px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); }
        .user-field { min-width: 0; }
        .user-field-label { display: block; margin-bottom: 5px; color: var(--muted); font-size: 10px; font-weight: 700; }
        .user-field-value { margin: 0; color: var(--ink); font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; white-space: pre-wrap; }
        .user-field-description { grid-column: 1 / -1; }
        .user-profile-link { display: inline-block; color: #27664f; font-size: 13px; white-space: nowrap; }
        .user-profile-link:hover { color: #a45740; }
        @keyframes rise-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .01ms !important; } }
        @media (max-width: 700px) { main { width: min(100% - 32px, 560px); margin-top: 18px; } .admin-search { grid-template-columns: 1fr; gap: 14px; padding: 18px; } .search-status { grid-column: auto; } .user-details { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 480px) { .admin-topbar { align-items: flex-start; flex-direction: column; padding: 20px; } .search-fields { align-items: stretch; flex-direction: column; } .search-fields button { width: 100%; } .section-head { align-items: flex-start; flex-direction: column; } .section-head .status { text-align: left; } .user-record-header { align-items: flex-start; } .user-details { grid-template-columns: 1fr; } .user-field-description { grid-column: auto; } }
    </style>
</head>
<body>
<main>
    <header class="admin-topbar">
        <div><p class="admin-kicker">RAVENWATCH / CONTROL ROOM</p><h1>Database laporan</h1></div>
        <a class="back-link" href="/">Kembali ke beranda ↗</a>
    </header>
    <section class="admin-search">
        <div class="search-title"><p class="eyebrow">PROFILE LOOKUP / 01</p><h2>Pencarian Profil Roblox</h2></div>
        <div class="search-fields">
            <label for="adminRobloxUsername">Username Roblox<input id="adminRobloxUsername" type="text" maxlength="20" placeholder="Masukkan username Roblox"></label>
            <button onclick="lookupAdminRoblox()">Cari dan simpan <span aria-hidden="true">↗</span></button>
        </div>
        <p id="robloxLookupStatus" class="status search-status" aria-live="polite"></p>
    </section>
    <section class="data-section">
        <div class="section-head"><div><p class="eyebrow">INBOX / 01</p><h2>Laporan masuk</h2></div><p id="status" class="status">Memuat laporan...</p></div>
        <div class="table-wrap">
            <table>
                <thead><tr><th>Waktu</th><th>Username</th><th>Kronologi</th><th>Aksi</th></tr></thead>
                <tbody id="reports"></tbody>
            </table>
        </div>
    </section>
    <section class="data-section">
        <div class="section-head"><div><p class="eyebrow">ROBLOX / 02</p><h2>Data profil Roblox</h2></div><p id="robloxStatus" class="status">Memuat profil Roblox...</p></div>
        <div id="robloxUsers" class="user-list"></div>
    </section>
</main>
<script>
async function lookupAdminRoblox() {
    const username = document.getElementById("adminRobloxUsername").value.trim();
    const status = document.getElementById("robloxLookupStatus");
    if (!username) {
        status.textContent = "Masukkan username Roblox terlebih dahulu.";
        return;
    }

    status.textContent = "Mencari profil Roblox...";
    try {
        const response = await fetch("/Admin/roblox?username=" + encodeURIComponent(username));
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Profil tidak dapat ditemukan.");
        status.textContent = data.message;
        await loadRobloxUsers();
    } catch (error) {
        status.textContent = error.message || "Gagal menghubungi layanan Roblox.";
    }
}

async function deleteAdminRecord(endpoint, description, statusId, reload) {
    if (!window.confirm("Hapus " + description + " secara permanen?")) return;
    const status = document.getElementById(statusId);
    try {
        const response = await fetch(endpoint, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal menghapus data.");
        await reload();
        status.textContent = data.message;
    } catch (error) {
        status.textContent = error.message || "Gagal menghapus data.";
    }
}

async function loadReports() {
    const status = document.getElementById("status");
    const body = document.getElementById("reports");
    try {
        const response = await fetch("/Admin/reports");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal memuat laporan.");
        body.replaceChildren();
        for (const report of data.reports) {
            const row = document.createElement("tr");
            for (const value of [new Date(report.createdAt).toLocaleString("id-ID"), report.username, report.description]) {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            }
            const actionCell = document.createElement("td");
            const deleteButton = document.createElement("button");
            deleteButton.className = "delete-button";
            deleteButton.textContent = "Hapus";
            deleteButton.onclick = () => deleteAdminRecord(
                "/Admin/reports/" + encodeURIComponent(report.id),
                "laporan ini",
                "status",
                loadReports
            );
            actionCell.appendChild(deleteButton);
            row.appendChild(actionCell);
            body.appendChild(row);
        }
        status.textContent = data.reports.length + " laporan tersimpan.";
    } catch (error) {
        status.textContent = error.message || "Tidak dapat memuat database.";
    }
}
loadReports();

async function loadRobloxUsers() {
    const status = document.getElementById("robloxStatus");
    const body = document.getElementById("robloxUsers");
    try {
        const response = await fetch("/Admin/roblox-users");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal memuat data Roblox.");
        body.replaceChildren();
        for (const user of data.users) {
            const card = document.createElement("article");
            card.className = "user-record";
            const cardHeader = document.createElement("div");
            cardHeader.className = "user-record-header";
            const identity = document.createElement("div");
            const title = document.createElement("h3");
            title.className = "user-record-title";
            title.textContent = "@" + user.username;
            const subtitle = document.createElement("p");
            subtitle.className = "user-record-subtitle";
            subtitle.textContent = user.displayName;
            identity.append(title, subtitle);

            const deleteButton = document.createElement("button");
            deleteButton.className = "delete-button";
            deleteButton.textContent = "Hapus";
            deleteButton.onclick = () => deleteAdminRecord(
                "/Admin/roblox-users/" + encodeURIComponent(user.id),
                "data akun Roblox " + user.username,
                "robloxStatus",
                loadRobloxUsers
            );
            cardHeader.append(identity, deleteButton);
            card.appendChild(cardHeader);

            const details = document.createElement("div");
            details.className = "user-details";
            const addField = (label, value, className = "") => {
                const field = document.createElement("div");
                field.className = "user-field " + className;
                const fieldLabel = document.createElement("span");
                fieldLabel.className = "user-field-label";
                fieldLabel.textContent = label;
                const fieldValue = document.createElement("p");
                fieldValue.className = "user-field-value";
                fieldValue.textContent = value;
                field.append(fieldLabel, fieldValue);
                details.appendChild(field);
            };

            addField("User ID", user.id);
            addField("Bergabung di Roblox", new Date(user.created).toLocaleDateString("id-ID"));
            addField("Pertama ditemukan", new Date(user.firstSeenAt).toLocaleString("id-ID"));
            addField("Terakhir dicari", new Date(user.lastCheckedAt).toLocaleString("id-ID"));

            const profileField = document.createElement("div");
            profileField.className = "user-field";
            const profileLabel = document.createElement("span");
            profileLabel.className = "user-field-label";
            profileLabel.textContent = "Profil";
            const profileLink = document.createElement("a");
            profileLink.className = "user-profile-link";
            profileLink.href = user.profileUrl;
            profileLink.target = "_blank";
            profileLink.rel = "noopener noreferrer";
            profileLink.textContent = "Buka profil Roblox";
            profileField.append(profileLabel, profileLink);
            details.appendChild(profileField);

            addField("Deskripsi publik", user.description || "Tidak ada deskripsi publik.", "user-field-description");
            card.appendChild(details);
            body.appendChild(card);
        }
        status.textContent = data.users.length + " profil Roblox tersimpan.";
    } catch (error) {
        status.textContent = error.message || "Tidak dapat memuat data Roblox.";
    }
}
loadRobloxUsers();
</script>
</body>
</html>
`;

const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url, `http://${HOST}:${PORT}`);
    const routePath = requestUrl.pathname.toLowerCase();

    if (IS_PRODUCTION && (routePath === "/admin" || routePath.startsWith("/admin/"))) {
        if (!ADMIN_USER || !ADMIN_PASSWORD) {
            res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Admin credentials are not configured.");
            return;
        }

        if (!hasValidAdminCredentials(req)) {
            res.writeHead(401, {
                "Content-Type": "text/plain; charset=utf-8",
                "WWW-Authenticate": 'Basic realm="RavenWatch Admin", charset="UTF-8"',
                "Cache-Control": "no-store"
            });
            res.end("Authentication required.");
            return;
        }
    }

    if (req.method === "GET" && routePath === "/") {

        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8"
        });

        res.end(html);

        return;
    }

    if (req.method === "GET" && ["/admin", "/admin/"].includes(routePath)) {
        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store"
        });
        res.end(adminHtml);
        return;
    }

    if (req.method === "GET" && routePath === "/admin/reports") {
        readReports().then(reports => {
            res.writeHead(200, {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-store"
            });
            res.end(JSON.stringify({ reports }));
        }).catch(() => {
            res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "Database laporan tidak dapat dibaca." }));
        });
        return;
    }

    if (req.method === "GET" && routePath === "/admin/roblox-users") {
        readRobloxUsers().then(users => {
            res.writeHead(200, {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-store"
            });
            res.end(JSON.stringify({ users }));
        }).catch(() => {
            res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "Database Roblox tidak dapat dibaca." }));
        });
        return;
    }

    if (req.method === "DELETE") {
        const reportMatch = routePath.match(/^\/admin\/reports\/([a-f0-9-]+)$/i);
        const robloxMatch = routePath.match(/^\/admin\/roblox-users\/(\d+)$/);

        if (reportMatch || robloxMatch) {
            try {
                const deleted = reportMatch
                    ? await deleteReport(reportMatch[1])
                    : await deleteRobloxUser(robloxMatch[1]);
                res.writeHead(deleted ? 200 : 404, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({
                    message: deleted ? "Data berhasil dihapus." : "Data tidak ditemukan.",
                    error: deleted ? undefined : "Data tidak ditemukan."
                }));
            } catch (error) {
                res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({ error: "Data tidak dapat dihapus." }));
            }
            return;
        }
    }

    if (req.method === "GET" && routePath === "/admin/roblox") {
        const username = requestUrl.searchParams.get("username") || "";

        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "Username Roblox harus 3-20 karakter dan hanya berisi huruf, angka, atau garis bawah." }));
            return;
        }

        try {
            const response = await fetch("https://users.roblox.com/v1/usernames/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                throw new Error("Layanan Roblox sedang tidak tersedia.");
            }

            const result = await response.json();
            const user = result.data && result.data[0];

            if (!user) {
                res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({ error: "Username Roblox tidak ditemukan." }));
                return;
            }

            const profileResponse = await fetch(`https://users.roblox.com/v1/users/${user.id}`, {
                signal: AbortSignal.timeout(10000)
            });
            if (!profileResponse.ok) {
                throw new Error("Detail profil Roblox tidak tersedia.");
            }
            const profile = await profileResponse.json();

            await saveRobloxUser({
                id: user.id,
                username: user.name,
                displayName: user.displayName,
                description: profile.description,
                created: profile.created,
                profileUrl: `https://www.roblox.com/users/${user.id}/profile`
            });
            res.writeHead(200, {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-store"
            });
            res.end(JSON.stringify({ message: "Profil ditemukan dan disimpan. Buka /Admin untuk melihat data." }));
        } catch (error) {
            res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "Tidak dapat mengambil profil dari Roblox saat ini." }));
        }
        return;
    }

    if (req.method === "POST" && routePath === "/api/reports") {
        let body = "";
        req.on("data", chunk => {
            body += chunk;
            if (body.length > 100000) {
                res.writeHead(413, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({ error: "Ukuran laporan terlalu besar." }));
                req.destroy();
            }
        });
        req.on("end", async () => {
            if (res.writableEnded) return;
            try {
                const report = JSON.parse(body);
                const username = typeof report.username === "string" ? report.username.trim() : "";
                const description = typeof report.description === "string" ? report.description.trim() : "";
                if (!username || !description) {
                    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
                    res.end(JSON.stringify({ error: "Username dan kronologi wajib diisi." }));
                    return;
                }

                await saveReport({
                    id: randomUUID(),
                    createdAt: new Date().toISOString(),
                    username: username.slice(0, 100),
                    description: description.slice(0, 10000)
                });
                res.writeHead(201, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({ message: "Laporan berhasil disimpan." }));
            } catch (error) {
                const invalidJson = error instanceof SyntaxError;
                res.writeHead(invalidJson ? 400 : 500, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({ error: invalidJson ? "Format laporan tidak valid." : "Laporan tidak dapat disimpan." }));
            }
        });
        return;
    }

    res.writeHead(404);

    res.end("Not Found");
});

fs.mkdir(DATA_DIR, { recursive: true }).then(() => {
    server.listen(PORT, HOST, () => {
        console.log("RavenWatch berjalan!");
        console.log("Alamat lokal: http://localhost:" + PORT);
    });
}).catch(error => {
    console.error("Direktori database tidak dapat disiapkan:", error.message);
    process.exitCode = 1;
});