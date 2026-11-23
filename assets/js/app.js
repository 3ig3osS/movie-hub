(() => {
  "use strict";
  const STORAGE_KEY = "movieHub.collection.v1";
  const FAVORITES_KEY = "movieHub.favorites.v1";
  const HISTORY_KEY = "movieHub.history.v1";
  const $ = (id) => document.getElementById(id);
  const state = { movies: [], favorites: new Set(), history: [], view: "home", category: "ทั้งหมด", query: "" };
  const safeUrl = (value) => {
    try { const u = new URL(String(value)); return ["http:", "https:"].includes(u.protocol) ? u.href : ""; }
    catch (_) { return ""; }
  };
  const escapeHTML = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const validMovie = (m) => m && typeof m === "object" && typeof m.title === "string" && m.title.trim() &&
    typeof m.category === "string" && safeUrl(m.url) &&
    (!m.poster || safeUrl(m.poster)) &&
    (m.year === undefined || m.year === null || (Number.isInteger(Number(m.year)) && Number(m.year) >= 1888 && Number(m.year) <= 2100));
  const normalizeMovie = (m) => ({ id: String(m.id || `m-${Date.now()}-${Math.random().toString(36).slice(2,7)}`),
    title: String(m.title).trim(), category: String(m.category || "อื่น ๆ").trim(),
    year: m.year ? Number(m.year) : "", poster: m.poster ? safeUrl(m.poster) : "",
    description: String(m.description || "").slice(0,500), url: safeUrl(m.url) });

  function toast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2300);
  }
  function loadStored(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch (_) { return fallback; } }
  async function loadMovies() {
    const local = loadStored(STORAGE_KEY, null);
    if (Array.isArray(local)) { state.movies = local.filter(validMovie).map(normalizeMovie); return; }
    try {
      const response = await fetch("./data/movies.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("Unable to load movies.json");
      const data = await response.json();
      state.movies = Array.isArray(data) ? data.filter(validMovie).map(normalizeMovie) : [];
    } catch (error) { console.warn(error); state.movies = []; }
  }
  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.movies)); }
  function savePrefs() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0,50)));
  }
  function posterMarkup(movie, className="") {
    if (movie.poster) return `<div class="poster-frame"> <img class="${className}" src="${escapeHTML(movie.poster)}" alt="โปสเตอร์ ${escapeHTML(movie.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div class="poster-fallback ${className}" hidden>${escapeHTML(movie.title)}</div></div>`;
    return `<div class="poster-fallback ${className}">${escapeHTML(movie.title)}</div>`;
  }
  function visibleMovies() {
    let list = [...state.movies];
    if (state.view === "favorites") list = list.filter(m => state.favorites.has(m.id));
    if (state.view === "history") list = list.filter(m => state.history.includes(m.id));
    if (state.category !== "ทั้งหมด") list = list.filter(m => m.category === state.category);
    if (state.query) list = list.filter(m => `${m.title} ${m.category} ${m.description}`.toLowerCase().includes(state.query.toLowerCase()));
    if (state.view === "history") list.sort((a,b) => state.history.indexOf(a.id)-state.history.indexOf(b.id));
    return list;
  }
  function render() {
    const categories = ["ทั้งหมด", ...new Set(state.movies.map(m => m.category).filter(Boolean))];
    $("categoryFilters").innerHTML = categories.map(c => `<button class="filter-chip ${state.category===c?"selected":""}" data-category="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join("");
    $("totalCount").textContent = state.movies.length;
    $("favoriteCount").textContent = state.favorites.size;
    $("categoryCount").textContent = new Set(state.movies.map(m=>m.category)).size;
    const title = state.view === "favorites" ? "รายการโปรด" : state.view === "history" ? "ประวัติการเข้าชม" : "สำรวจคลังหนัง";
    $("sectionTitle").textContent = title;
    $("sectionSubtitle").textContent = state.view === "favorites" ? "เรื่องที่คุณบันทึกไว้" : state.view === "history" ? "รายการที่คุณเคยเปิดรับชม" : "คัดสรรเรื่องที่คุณอยากเก็บไว้รับชม";
    const list = visibleMovies();
    $("movieGrid").innerHTML = list.map(m => `<article class="movie-card" data-detail="${escapeHTML(m.id)}">
      <div class="poster-wrap">${posterMarkup(m)}<div class="poster-overlay"></div>
      <button class="fav-btn ${state.favorites.has(m.id)?"active":""}" data-fav="${escapeHTML(m.id)}" aria-label="บันทึกรายการโปรด">${state.favorites.has(m.id)?"♥":"♡"}</button></div>
      <div class="card-meta"><span class="category">${escapeHTML(m.category)}</span>${m.year?`<span>•</span><span>${m.year}</span>`:""}</div>
      <h3>${escapeHTML(m.title)}</h3><p>${escapeHTML(m.description || "เพิ่มรายละเอียดเรื่องนี้")}</p></article>`).join("");
    $("emptyState").classList.toggle("hidden", list.length > 0);
    $("movieGrid").classList.toggle("hidden", list.length === 0);
    document.querySelectorAll(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.view === state.view));
  }
  function switchView(view) { state.view = view; state.category = "ทั้งหมด"; render(); $("library").scrollIntoView({behavior:"smooth"}); }
  function showDetail(id) {
    const m = state.movies.find(x => x.id === id); if (!m) return;
    $("detailContent").innerHTML = `<div class="detail-layout">${posterMarkup(m,"detail-poster")}<div class="detail-copy"><div class="eyebrow">MOVIE HUB SELECTION</div><div class="detail-tags">${escapeHTML(m.category)} ${m.year?`• ${m.year}`:""}</div><h2>${escapeHTML(m.title)}</h2><p>${escapeHTML(m.description || "ยังไม่มีเรื่องย่อสำหรับรายการนี้")}</p><div class="detail-actions"><button class="primary-btn" id="watchNow">เปิดเว็บไซต์รับชม ↗</button><button class="secondary-btn" id="detailFav">${state.favorites.has(id)?"♥ บันทึกแล้ว":"♡ รายการโปรด"}</button></div><p class="form-note">คุณกำลังจะเปิดเว็บไซต์ต้นทางในแท็บใหม่ โปรดตรวจสอบความน่าเชื่อถือและสิทธิ์ในการรับชมของเว็บไซต์นั้น</p></div></div>`;
    $("detailDialog").showModal();
    $("watchNow").addEventListener("click", () => {
      const url = safeUrl(m.url); if (!url) return toast("ลิงก์ไม่ถูกต้อง");
      state.history = [id, ...state.history.filter(x => x !== id)]; savePrefs();
      window.open(url, "_blank", "noopener,noreferrer"); render();
    });
    $("detailFav").addEventListener("click", () => toggleFavorite(id));
  }
  function toggleFavorite(id) {
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    savePrefs(); render();
    const btn = $("detailFav"); if (btn) btn.textContent = state.favorites.has(id) ? "♥ บันทึกแล้ว" : "♡ รายการโปรด";
  }
  function openAdmin(tab="manage") { renderAdmin(); $("adminDialog").showModal(); setTab(tab); }
  function setTab(tab) {
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    ["manage","add","data"].forEach(t => $("tab-"+t).classList.toggle("hidden", t !== tab));
  }
  function renderAdmin() {
    $("adminList").innerHTML = state.movies.length ? state.movies.map(m => `<div class="admin-row">${m.poster?`<img class="admin-thumb" src="${escapeHTML(m.poster)}" alt="">`:`<div class="admin-thumb"></div>`}<div class="admin-info"><strong>${escapeHTML(m.title)}</strong><span>${escapeHTML(m.category)} ${m.year||""}</span></div><div class="row-actions"><button class="mini-btn" data-edit="${escapeHTML(m.id)}">แก้ไข</button><button class="mini-btn delete" data-delete="${escapeHTML(m.id)}">ลบ</button></div></div>`).join("") : `<p class="form-note">ยังไม่มีรายการหนังในคลัง</p>`;
  }
  function clearForm() { $("movieForm").reset(); $("movieId").value = ""; }
  function editMovie(id) {
    const m = state.movies.find(x=>x.id===id); if(!m) return;
    $("movieId").value=m.id; $("movieTitle").value=m.title; $("movieCategory").value=m.category;
    $("movieYear").value=m.year||""; $("moviePoster").value=m.poster||""; $("movieDescription").value=m.description||""; $("movieUrl").value=m.url;
    setTab("add");
  }
  function downloadJSON() {
    const blob = new Blob([JSON.stringify(state.movies,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob), a=document.createElement("a"); a.href=url; a.download="movies.json"; a.click(); URL.revokeObjectURL(url);
  }
  async function importJSON() {
    const file=$("jsonImport").files[0]; if(!file) return toast("กรุณาเลือกไฟล์ JSON");
    try {
      const parsed=JSON.parse(await file.text());
      if(!Array.isArray(parsed) || !parsed.every(validMovie)) throw new Error("รูปแบบ JSON ไม่ถูกต้อง หรือมีข้อมูลบางรายการไม่ครบ");
      state.movies=parsed.map(normalizeMovie); persist(); render(); renderAdmin(); $("jsonImport").value="";
      toast(`นำเข้าสำเร็จ ${state.movies.length} รายการ`);
    } catch(e) { toast(e.message || "ไม่สามารถอ่านไฟล์ JSON"); }
  }
  function bindEvents() {
    document.querySelectorAll(".nav-link").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
    $("categoryFilters").addEventListener("click",e=>{const b=e.target.closest("[data-category]");if(b){state.category=b.dataset.category;render();}});
    $("movieGrid").addEventListener("click",e=>{
      const fav=e.target.closest("[data-fav]"); if(fav){e.stopPropagation();toggleFavorite(fav.dataset.fav);return;}
      const card=e.target.closest("[data-detail]"); if(card) showDetail(card.dataset.detail);
    });
    $("searchInput").addEventListener("input",e=>{state.query=e.target.value;render();});
    $("searchToggle").addEventListener("click",()=>{$("searchWrap").classList.remove("hidden");$("searchInput").focus();$("library").scrollIntoView({behavior:"smooth"});});
    $("exploreBtn").addEventListener("click",()=>$("library").scrollIntoView({behavior:"smooth"}));
    $("adminOpen").addEventListener("click",()=>openAdmin()); $("heroAdminBtn").addEventListener("click",()=>openAdmin("add")); $("emptyAddBtn").addEventListener("click",()=>openAdmin("add"));
    document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.close).close()));
    document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
    $("adminList").addEventListener("click",e=>{
      const edit=e.target.closest("[data-edit]"), del=e.target.closest("[data-delete]");
      if(edit) editMovie(edit.dataset.edit);
      if(del && confirm("ต้องการลบรายการนี้หรือไม่?")) {
        const id=del.dataset.delete; state.movies=state.movies.filter(m=>m.id!==id); state.favorites.delete(id); state.history=state.history.filter(x=>x!==id);
        persist();savePrefs();render();renderAdmin();toast("ลบรายการแล้ว");
      }
    });
    $("movieForm").addEventListener("submit",e=>{
      e.preventDefault();
      const raw={id:$("movieId").value || undefined,title:$("movieTitle").value,category:$("movieCategory").value,year:$("movieYear").value||"",poster:$("moviePoster").value,description:$("movieDescription").value,url:$("movieUrl").value};
      if(!validMovie(raw)){toast("กรุณาตรวจสอบชื่อ ลิงก์ และ URL ภาพให้ถูกต้อง");return;}
      const movie=normalizeMovie(raw), idx=state.movies.findIndex(m=>m.id===movie.id);
      if(idx>=0) state.movies[idx]=movie; else state.movies.unshift(movie);
      persist();render();renderAdmin();clearForm();setTab("manage");toast(idx>=0?"อัปเดตรายการแล้ว":"เพิ่มรายการแล้ว");
    });
    $("cancelEdit").addEventListener("click",()=>{clearForm();setTab("manage");});
    $("exportBtn").addEventListener("click",downloadJSON); $("importBtn").addEventListener("click",importJSON);
    $("resetBtn").addEventListener("click",async()=>{
      if(!confirm("คืนค่าข้อมูลเริ่มต้น? การแก้ไขในเครื่องจะถูกแทนที่")) return;
      localStorage.removeItem(STORAGE_KEY); await loadMovies(); persist(); render(); renderAdmin(); toast("คืนค่าเริ่มต้นแล้ว");
    });
    $("detailDialog").addEventListener("click",e=>{if(e.target===$("detailDialog")) $("detailDialog").close();});
    $("adminDialog").addEventListener("click",e=>{if(e.target===$("adminDialog")) $("adminDialog").close();});
  }
  async function init() {
    await loadMovies();
    state.favorites=new Set(loadStored(FAVORITES_KEY,[]));
    state.history=loadStored(HISTORY_KEY,[]).filter(id=>state.movies.some(m=>m.id===id));
    bindEvents(); render();
    if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(err=>console.warn("SW registration failed",err));
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
  // Exposed for lightweight automated validation.
  window.MovieHub = { safeUrl, validMovie, normalizeMovie, getMovies:()=>[...state.movies] };
})();