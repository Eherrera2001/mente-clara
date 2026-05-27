import { useState, useEffect } from "react";
import { supabase } from "./supabase";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CONSTANTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const ADMIN_USER       = "menteclara.admin";
const ADMIN_PASS       = "MenteClara2024";

const moods = [
  { id:"radiant", emoji:"☀️", label:"Radiante",  color:"#E8A020", bg:"#FFFBEC" },
  { id:"calm",    emoji:"🌊", label:"En calma",  color:"#3D8FAB", bg:"#EEF6FB" },
  { id:"neutral", emoji:"🌿", label:"Neutral",   color:"#5E9E5B", bg:"#F0F7EF" },
  { id:"tired",   emoji:"🌙", label:"Cansado/a", color:"#7B64BC", bg:"#F3F0FB" },
  { id:"anxious", emoji:"🌪️", label:"Ansioso/a", color:"#D4614A", bg:"#FDF2EE" },
  { id:"sad",     emoji:"🌧️", label:"Triste",    color:"#5577A8", bg:"#EEF3FB" },
];

const CRISIS_RESOURCES = [
  { country:"Colombia",      name:"Línea 106",                number:"106",           available:"24h" },
  { country:"México",        name:"SAPTEL",                   number:"55 5259-8121",  available:"24h" },
  { country:"España",        name:"Teléfono de la Esperanza", number:"717 003 717",   available:"24h" },
  { country:"Argentina",     name:"Centro de Asistencia",     number:"135",           available:"24h" },
  { country:"Internacional", name:"Befrienders Worldwide",    number:"befrienders.org",available:"Web" },
];

const prompts = [
  "¿Qué momento del día de hoy fue más tuyo?",
  "¿Qué cargaste hoy que no era tuyo cargar?",
  "¿Qué necesitaría tu cuerpo ahora mismo?",
  "¿Qué pensamiento se repitió más hoy?",
  "¿A qué le dijiste sí hoy, cuando querías decir no?",
  "¿Qué pequeña cosa te trajo paz hoy?",
  "¿Qué emoción intentaste esconder hoy?",
];

const TAG_OPTIONS   = ["Gratis","Nuevo","Popular","Recomendado","Premium","Top","Avanzado","Especial"];
const COLOR_OPTIONS = ["#D4614A","#3D8FAB","#5E9E5B","#7B64BC","#E8A020","#5577A8","#C47E2A","#3A7A6A"];

const defaultProducts = [
  { id:"p1", emoji:"🌬️", title:"Reto: 7 días sin ansiedad",   desc:"Técnicas diarias de respiración y anclaje emocional", tag:"Popular",    color:"#D4614A", moods:["anxious"], active:true },
  { id:"p2", emoji:"📘", title:"Guía: El arte de calmarse",    desc:"Manual práctico para gestionar la ansiedad",          tag:"Nuevo",      color:"#3D8FAB", moods:["anxious","sad"], active:true },
  { id:"p3", emoji:"🎧", title:"Meditaciones guiadas",         desc:"10 audios de 5 min para momentos de crisis",          tag:"Gratis",     color:"#5E9E5B", moods:["anxious","tired"], active:true },
  { id:"p4", emoji:"🌱", title:"Reto: Siembra de alegría",     desc:"21 días de pequeños actos que nutren el alma",        tag:"Recomendado",color:"#5E9E5B", moods:["sad"], active:true },
  { id:"p5", emoji:"⚡", title:"Reto: Recarga tu energía",     desc:"Hábitos de sueño y descanso activo en 14 días",       tag:"Top",        color:"#7B64BC", moods:["tired"], active:true },
  { id:"p6", emoji:"🔍", title:"Reto: Conócete a fondo",       desc:"30 preguntas poderosas para descubrirte",             tag:"Popular",    color:"#5E9E5B", moods:["neutral"], active:true },
  { id:"p7", emoji:"🧘", title:"Curso: Mindfulness básico",    desc:"Mantén y profundiza tu estado de calma",              tag:"Premium",    color:"#3D8FAB", moods:["calm"], active:true },
  { id:"p8", emoji:"🚀", title:"Reto: Lidera tu bienestar",    desc:"Conviértete en guía emocional para otros",            tag:"Avanzado",   color:"#E8A020", moods:["radiant"], active:true },
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SUPABASE — entradas y productos
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
async function loadEntries(userEmail) {
  try {
    const { data } = await supabase
      .from("entries")
      .select("*")
      .eq("user_email", userEmail)
      .order("timestamp", { ascending: false });
    return data || [];
  } catch { return []; }
}

async function saveEntry(entry, userEmail) {
  try {
    await supabase.from("entries").insert([{ ...entry, user_email: userEmail }]);
  } catch {}
}

async function loadProducts() {
  try {
    const { data } = await supabase.from("products").select("*");
    return data && data.length > 0 ? data : defaultProducts;
  } catch { return defaultProducts; }
}

async function saveProducts(products) {
  try {
    await supabase.from("products").upsert(products);
  } catch {}
}

function detectPattern(entries) {
  if (entries.length < 2) return null;
  const counts = {};
  entries.slice(0,5).forEach(e => { counts[e.mood] = (counts[e.mood]||0)+1; });
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  return top[1] >= 2 ? top[0] : null;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   IA — llama al backend seguro en /api/chat
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
async function callAI(mood, text) {
  const moodLabel = moods.find(m => m.id === mood)?.label || mood;
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood: moodLabel, text })
    });
    const data = await res.json();
    return data.reply || "Gracias por compartir esto. Tu presencia aquí ya es un acto de valentía. — Mente Clara";
  } catch {
    return "Gracias por compartir esto. Tu presencia aquí ya es un acto de valentía. — Mente Clara";
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   COMPONENTES UI — sin cambios
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function MoodPill({ mood, selected, onClick }) {
  return (
    <button onClick={() => onClick(mood.id)} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"11px 8px",borderRadius:16,border:`2px solid ${selected?mood.color:"transparent"}`,background:selected?mood.bg:"#F5F2EE",cursor:"pointer",transition:"all 0.2s",transform:selected?"scale(1.07)":"scale(1)",boxShadow:selected?`0 4px 16px ${mood.color}40`:"none",flex:1,minWidth:0 }}>
      <span style={{ fontSize:22 }}>{mood.emoji}</span>
      <span style={{ fontSize:10,color:selected?mood.color:"#A09488",fontFamily:"'DM Sans',sans-serif",fontWeight:700,textAlign:"center",lineHeight:1.2 }}>{mood.label}</span>
    </button>
  );
}

function AIBubble({ text, loading }) {
  return (
    <div style={{ marginTop:16,padding:"16px 18px",background:"linear-gradient(135deg,#F0EBE3,#EDE8F5)",borderRadius:"4px 18px 18px 18px",borderLeft:"3px solid #C4B8A8" }}>
      <div style={{ fontSize:9,color:"#B5A898",fontFamily:"'DM Sans',sans-serif",fontWeight:700,letterSpacing:1.8,marginBottom:7,textTransform:"uppercase" }}>✦ Mente Clara responde</div>
      {loading
        ? <div style={{ display:"flex",gap:6 }}>{[0,1,2].map(i=><div key={i} style={{ width:7,height:7,borderRadius:"50%",background:"#C4B8A8",animation:`bounce 1s ease ${i*0.2}s infinite` }}/>)}</div>
        : <p style={{ margin:0,fontSize:13.5,lineHeight:1.75,color:"#5C5044",fontFamily:"'Lora',serif",fontStyle:"italic",whiteSpace:"pre-line" }}>{text}</p>
      }
    </div>
  );
}

function Disclaimer({ onCrisis }) {
  return (
    <div style={{ background:"#F9F7F4",border:"1px solid #EDE9E3",borderRadius:14,padding:"11px 15px",display:"flex",alignItems:"flex-start",gap:10,marginTop:16 }}>
      <span style={{ fontSize:15,flexShrink:0,marginTop:1 }}>🌿</span>
      <div>
        <p style={{ margin:"0 0 4px",fontSize:11.5,color:"#5C5044",fontFamily:"'DM Sans',sans-serif",lineHeight:1.5 }}>
          <strong>Mente Clara</strong> es un espacio de reflexión personal. No reemplaza el acompañamiento de un profesional de salud mental.
        </p>
        <button onClick={onCrisis} style={{ background:"none",border:"none",cursor:"pointer",padding:0,fontSize:11,color:"#D4614A",fontWeight:700,fontFamily:"'DM Sans',sans-serif",textDecoration:"underline" }}>
          ¿Estás en crisis? Ver líneas de apoyo →
        </button>
      </div>
    </div>
  );
}

function CrisisModal({ onClose }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
      <div style={{ width:"100%",maxWidth:440,background:"#FDFCFA",borderRadius:"24px 24px 0 0",padding:"24px 22px 36px",maxHeight:"80vh",overflow:"auto" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
          <div>
            <div style={{ fontSize:17,fontWeight:700,color:"#2D2520",fontFamily:"'Playfair Display',serif" }}>Líneas de apoyo en crisis</div>
            <div style={{ fontSize:11,color:"#B5A898",fontFamily:"'Lora',serif",fontStyle:"italic",marginTop:2 }}>Hay personas capacitadas esperando escucharte</div>
          </div>
          <button onClick={onClose} style={{ background:"#F5F2EE",border:"none",borderRadius:10,padding:"7px 12px",fontSize:13,cursor:"pointer",fontWeight:700,color:"#8C7E72" }}>✕</button>
        </div>
        <div style={{ background:"#FDF2EE",border:"1px solid #D4614A30",borderRadius:16,padding:"13px 16px",marginBottom:18 }}>
          <p style={{ margin:0,fontSize:12.5,color:"#7A2010",fontFamily:"'DM Sans',sans-serif",lineHeight:1.6 }}>
            💛 Si estás pensando en hacerte daño o sientes que no puedes más, por favor comunícate con una línea de crisis ahora. No tienes que estar sola/o en esto.
          </p>
        </div>
        {CRISIS_RESOURCES.map((r,i) => (
          <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 15px",background:i%2===0?"#FDFCFA":"#F9F7F4",borderRadius:13,marginBottom:8,border:"1px solid #EDE9E3" }}>
            <div>
              <div style={{ fontSize:10,color:"#B5A898",fontFamily:"'DM Sans',sans-serif",fontWeight:700,letterSpacing:0.8,textTransform:"uppercase" }}>{r.country}</div>
              <div style={{ fontSize:13.5,color:"#3D3530",fontFamily:"'DM Sans',sans-serif",fontWeight:700 }}>{r.name}</div>
              <div style={{ fontSize:11,color:"#8C7E72",marginTop:1 }}>Disponible {r.available}</div>
            </div>
            <div style={{ background:"#D4614A",borderRadius:12,padding:"8px 14px",color:"white",fontSize:13,fontWeight:700,fontFamily:"'DM Sans',sans-serif",flexShrink:0,marginLeft:10 }}>{r.number}</div>
          </div>
        ))}
        <div style={{ marginTop:16,padding:"13px 16px",background:"#F0F7EF",border:"1px solid #C8DCC7",borderRadius:14 }}>
          <p style={{ margin:0,fontSize:12,color:"#3D5C3A",fontFamily:"'DM Sans',sans-serif",lineHeight:1.6 }}>
            🌿 Si tu vida o la de alguien más está en peligro inmediato, llama al número de emergencias de tu país: <strong>112</strong> (España) · <strong>911</strong> (México) · <strong>123</strong> (Colombia).
          </p>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ p }) {
  const [hov,setHov] = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ background:"#FDFCFA",border:`1.5px solid ${hov?p.color+"55":"#EDE9E3"}`,borderRadius:18,padding:"15px 17px",transition:"all 0.2s",transform:hov?"translateY(-2px)":"none",boxShadow:hov?`0 6px 20px ${p.color}18`:"none",cursor:"pointer" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:38,height:38,borderRadius:11,background:`${p.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0 }}>{p.emoji}</div>
          <div style={{ fontSize:13,fontWeight:700,color:"#3D3530",fontFamily:"'DM Sans',sans-serif",lineHeight:1.3 }}>{p.title}</div>
        </div>
        <span style={{ fontSize:8.5,fontWeight:800,color:p.color,background:`${p.color}18`,padding:"3px 7px",borderRadius:20,letterSpacing:0.7,textTransform:"uppercase",whiteSpace:"nowrap",marginLeft:8,flexShrink:0 }}>{p.tag}</span>
      </div>
      <p style={{ margin:"0 0 9px",fontSize:12,color:"#8C7E72",fontFamily:"'Lora',serif",fontStyle:"italic",lineHeight:1.5 }}>{p.desc}</p>
      <span style={{ fontSize:11,color:p.color,fontWeight:700,fontFamily:"'DM Sans',sans-serif" }}>Ver más →</span>
    </div>
  );
}

function EntryCard({ entry, onClick }) {
  const m = moods.find(x => x.id === entry.mood);
  return (
    <div onClick={()=>onClick(entry)} style={{ padding:"13px 17px",background:"#FDFCFA",border:"1px solid #EDE9E3",borderRadius:15,cursor:"pointer",transition:"transform 0.18s",marginBottom:9 }}
      onMouseEnter={e=>e.currentTarget.style.transform="translateX(4px)"}
      onMouseLeave={e=>e.currentTarget.style.transform="translateX(0)"}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5 }}>
        <div style={{ display:"flex",alignItems:"center",gap:7 }}>
          <span style={{ fontSize:16 }}>{m?.emoji}</span>
          <span style={{ fontSize:12,fontWeight:700,color:m?.color,fontFamily:"'DM Sans',sans-serif" }}>{m?.label}</span>
        </div>
        <span style={{ fontSize:10,color:"#C0B8B0" }}>{entry.date}</span>
      </div>
      <p style={{ margin:0,fontSize:12.5,color:"#8C7E72",fontFamily:"'Lora',serif",fontStyle:"italic",lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>"{entry.text}"</p>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LOGIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function LoginScreen({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setErr("");
    if (!email.trim() || !pass.trim()) { setErr("Por favor completa todos los campos."); return; }
    if (isRegister && !name.trim())    { setErr("¿Cómo te llamas?"); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    const isAdmin = email.trim() === ADMIN_USER && pass === ADMIN_PASS;
    if (isAdmin) { onLogin({ name:"Sorany Grisales", email: ADMIN_USER, role:"admin" }); return; }
    if (isRegister) {
      onLogin({ name: name.trim(), email: email.trim(), role:"user" });
    } else {
      onLogin({ name: email.split("@")[0], email: email.trim(), role:"user" });
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh",background:"linear-gradient(160deg,#1A2F24,#0D1F2D)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,600&family=Lora:ital@0;1&family=DM+Sans:wght@400;600;700&display=swap');`}</style>
      <div style={{ textAlign:"center",marginBottom:36 }}>
        <div style={{ fontSize:52,marginBottom:14 }}>🌿</div>
        <div style={{ fontFamily:"'Playfair Display',serif",fontSize:28,color:"#E8F5E4",fontWeight:700,letterSpacing:-0.5 }}>Mente Clara</div>
        <div style={{ fontFamily:"'Lora',serif",fontSize:12.5,color:"#7DAA7B",marginTop:5,fontStyle:"italic" }}>Un respiro para lo que sientes</div>
        <div style={{ fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#4A6B4A",marginTop:10,letterSpacing:1.5,textTransform:"uppercase" }}>por Sorany Grisales</div>
      </div>
      <div style={{ width:"100%",maxWidth:360,background:"rgba(255,255,255,0.06)",backdropFilter:"blur(20px)",borderRadius:24,padding:"28px 24px",border:"1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display:"flex",background:"rgba(0,0,0,0.2)",borderRadius:14,padding:4,marginBottom:24 }}>
          {[{label:"Ingresar",val:false},{label:"Registrarse",val:true}].map(t=>(
            <button key={String(t.val)} onClick={()=>{setIsRegister(t.val);setErr("");}}
              style={{ flex:1,padding:"9px 0",border:"none",borderRadius:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,transition:"all 0.2s",background:isRegister===t.val?"rgba(255,255,255,0.12)":"transparent",color:isRegister===t.val?"#E8F5E4":"#7DAA7B" }}>
              {t.label}
            </button>
          ))}
        </div>
        {isRegister && (
          <div style={{ marginBottom:13 }}>
            <label style={{ display:"block",fontSize:11,color:"#7DAA7B",fontWeight:700,marginBottom:5,fontFamily:"'DM Sans',sans-serif",letterSpacing:0.5 }}>¿Cómo te llamas?</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre"
              style={{ width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.07)",fontSize:13.5,fontFamily:"'DM Sans',sans-serif",color:"#E8F5E4",outline:"none" }}/>
          </div>
        )}
        <div style={{ marginBottom:13 }}>
          <label style={{ display:"block",fontSize:11,color:"#7DAA7B",fontWeight:700,marginBottom:5,fontFamily:"'DM Sans',sans-serif",letterSpacing:0.5 }}>Correo electrónico</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com"
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            style={{ width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.07)",fontSize:13.5,fontFamily:"'DM Sans',sans-serif",color:"#E8F5E4",outline:"none" }}/>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ display:"block",fontSize:11,color:"#7DAA7B",fontWeight:700,marginBottom:5,fontFamily:"'DM Sans',sans-serif",letterSpacing:0.5 }}>Contraseña</label>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            style={{ width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.07)",fontSize:13.5,fontFamily:"'DM Sans',sans-serif",color:"#E8F5E4",outline:"none" }}/>
        </div>
        {err && <div style={{ marginBottom:14,padding:"9px 13px",borderRadius:11,background:"rgba(212,97,74,0.2)",border:"1px solid rgba(212,97,74,0.3)",fontSize:12,color:"#F4A896",fontFamily:"'DM Sans',sans-serif" }}>{err}</div>}
        <button onClick={handleSubmit} disabled={loading}
          style={{ width:"100%",padding:"15px",background:"linear-gradient(135deg,#3D8FAB,#5E9E5B)",border:"none",borderRadius:15,color:"white",fontSize:14,fontWeight:700,cursor:loading?"wait":"pointer",fontFamily:"'DM Sans',sans-serif",boxShadow:"0 6px 24px rgba(61,143,171,0.4)",opacity:loading?0.8:1,transition:"all 0.2s" }}>
          {loading ? "Verificando..." : isRegister ? "Crear mi cuenta" : "Entrar a Mente Clara"}
        </button>
        <div style={{ marginTop:18,padding:"12px 15px",background:"rgba(93,155,91,0.1)",border:"1px solid rgba(93,155,91,0.2)",borderRadius:13 }}>
          <p style={{ margin:0,fontSize:11,color:"#7DAA7B",fontFamily:"'DM Sans',sans-serif",lineHeight:1.6,textAlign:"center" }}>
            🔒 Tu información es privada y está protegida.<br/>Mente Clara no comparte tus datos con nadie.
          </p>
        </div>
      </div>
      <div style={{ marginTop:20,textAlign:"center" }}>
        <p style={{ fontSize:10.5,color:"#4A6B4A",fontFamily:"'Lora',serif",fontStyle:"italic" }}>
          Mente Clara no reemplaza el apoyo de un profesional de salud mental.
        </p>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PANEL ADMIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function AdminPanel({ products, onSave, onClose }) {
  const [view, setView]             = useState("list");
  const [editItem, setEditItem]     = useState(null);
  const [localProds, setLocalProds] = useState(products);
  const [saved, setSaved]           = useState(false);

  const emptyProduct = { id:`p${Date.now()}`, emoji:"🌟", title:"", desc:"", tag:"Nuevo", color:"#3D8FAB", moods:[], active:true };
  const saveAll = async () => { await onSave(localProds); setSaved(true); setTimeout(()=>setSaved(false),2000); };
  const toggleActive  = id => setLocalProds(p=>p.map(x=>x.id===id?{...x,active:!x.active}:x));
  const deleteProduct = id => setLocalProds(p=>p.filter(x=>x.id!==id));
  const upsertProduct = prod => { setLocalProds(p=>p.find(x=>x.id===prod.id)?p.map(x=>x.id===prod.id?prod:x):[...p,prod]); setView("list"); setEditItem(null); };

  const FL = ({label}) => <label style={{ display:"block",fontSize:11,color:"#8C7E72",fontWeight:700,marginBottom:5,fontFamily:"'DM Sans',sans-serif",letterSpacing:0.5 }}>{label}</label>;
  const FI = ({label,value,onChange,placeholder}) => (
    <div style={{ marginBottom:13 }}>
      <FL label={label}/>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{ width:"100%",padding:"11px 13px",borderRadius:12,border:"1.5px solid #DDD8D0",background:"#FAFAF8",fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#3D3530",outline:"none" }}/>
    </div>
  );

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
      <div style={{ width:"100%",maxWidth:440,background:"#FDFCFA",borderRadius:"24px 24px 0 0",maxHeight:"91vh",overflow:"hidden",display:"flex",flexDirection:"column" }}>
        <div style={{ padding:"17px 22px 11px",background:"linear-gradient(135deg,#1A2F24,#0D1F2D)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div>
            <div style={{ fontSize:15,fontWeight:700,color:"white",fontFamily:"'Playfair Display',serif" }}>Panel de control</div>
            <div style={{ fontSize:10,color:"#7DAA7B",fontFamily:"'DM Sans',sans-serif" }}>Sorany Grisales · Mente Clara</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.15)",border:"none",borderRadius:10,color:"white",fontSize:12,fontWeight:700,cursor:"pointer",padding:"6px 12px",fontFamily:"'DM Sans',sans-serif" }}>Cerrar ✕</button>
        </div>
        <div style={{ display:"flex",borderBottom:"1px solid #EDE9E3",background:"#F9F7F4" }}>
          {[{id:"list",label:"📦 Productos"},{id:"stats",label:"📊 Resumen"}].map(t=>(
            <button key={t.id} onClick={()=>{setView(t.id);setEditItem(null);}}
              style={{ flex:1,padding:"11px 0",background:"none",border:"none",borderBottom:`2.5px solid ${view===t.id?"#3D8FAB":"transparent"}`,color:view===t.id?"#3D8FAB":"#A09488",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ flex:1,overflow:"auto",padding:"18px 20px 30px" }}>
          {view==="list" && !editItem && (
            <>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                <span style={{ fontSize:10,color:"#B5A898",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase" }}>{localProds.length} productos</span>
                <button onClick={()=>setEditItem({...emptyProduct,id:`p${Date.now()}`})} style={{ padding:"8px 14px",background:"linear-gradient(135deg,#3D8FAB,#5E9E5B)",border:"none",borderRadius:12,color:"white",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>+ Agregar</button>
              </div>
              {localProds.map(p=>(
                <div key={p.id} style={{ display:"flex",alignItems:"center",gap:9,padding:"11px 13px",background:p.active?"#FDFCFA":"#F5F2EE",border:`1px solid ${p.active?"#EDE9E3":"#DDD8D0"}`,borderRadius:13,marginBottom:7,opacity:p.active?1:0.6 }}>
                  <span style={{ fontSize:20,flexShrink:0 }}>{p.emoji}</span>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:"#3D3530",fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{p.title}</div>
                    <div style={{ display:"flex",gap:3,marginTop:3,flexWrap:"wrap" }}>
                      {p.moods.map(mid=>{const m=moods.find(x=>x.id===mid);return m?<span key={mid} style={{ fontSize:9,background:`${m.color}18`,color:m.color,padding:"2px 6px",borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontWeight:700 }}>{m.emoji}{m.label}</span>:null;})}
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:4,flexShrink:0 }}>
                    <button onClick={()=>setEditItem(p)} style={{ background:"#EEF6FB",border:"none",borderRadius:8,padding:"5px 9px",cursor:"pointer",fontSize:12 }}>✏️</button>
                    <button onClick={()=>toggleActive(p.id)} style={{ background:p.active?"#F0F7EF":"#FDF2EE",border:"none",borderRadius:8,padding:"5px 9px",cursor:"pointer",fontSize:12 }}>{p.active?"✓":"○"}</button>
                    <button onClick={()=>deleteProduct(p.id)} style={{ background:"#FDF2EE",border:"none",borderRadius:8,padding:"5px 9px",cursor:"pointer",fontSize:12 }}>🗑️</button>
                  </div>
                </div>
              ))}
              <button onClick={saveAll} style={{ width:"100%",marginTop:6,padding:"14px",background:saved?"#F0F7EF":"linear-gradient(135deg,#3D8FAB,#5E9E5B)",border:"none",borderRadius:15,color:saved?"#5E9E5B":"white",fontSize:13.5,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.3s" }}>
                {saved?"✓ Guardado":"Guardar cambios"}
              </button>
            </>
          )}
          {view==="list" && editItem && (
            <>
              <div style={{ display:"flex",alignItems:"center",gap:9,marginBottom:18 }}>
                <button onClick={()=>setEditItem(null)} style={{ background:"none",border:"none",cursor:"pointer",color:"#B5A898",fontSize:12,fontWeight:600,padding:0 }}>← Volver</button>
                <span style={{ fontSize:14,fontWeight:700,color:"#3D3530",fontFamily:"'Playfair Display',serif" }}>{editItem.title?"Editar":"Nuevo producto"}</span>
              </div>
              <FI label="Emoji" value={editItem.emoji} onChange={v=>setEditItem(p=>({...p,emoji:v}))} placeholder="🌟"/>
              <FI label="Nombre del producto" value={editItem.title} onChange={v=>setEditItem(p=>({...p,title:v}))} placeholder="Ej: Reto 7 días de calma"/>
              <div style={{ marginBottom:13 }}>
                <FL label="Descripción"/>
                <textarea value={editItem.desc} onChange={e=>setEditItem(p=>({...p,desc:e.target.value}))} placeholder="Una frase que describa el producto..."
                  style={{ width:"100%",padding:"11px 13px",borderRadius:12,border:"1.5px solid #DDD8D0",background:"#FAFAF8",fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#3D3530",outline:"none",resize:"none",minHeight:65,lineHeight:1.6 }}/>
              </div>
              <div style={{ marginBottom:13 }}>
                <FL label="Etiqueta"/>
                <div style={{ display:"flex",flexWrap:"wrap",gap:5 }}>
                  {TAG_OPTIONS.map(t=><button key={t} onClick={()=>setEditItem(p=>({...p,tag:t}))} style={{ padding:"5px 11px",borderRadius:20,border:`1.5px solid ${editItem.tag===t?"#3D8FAB":"#DDD8D0"}`,background:editItem.tag===t?"#EEF6FB":"#F9F7F4",color:editItem.tag===t?"#3D8FAB":"#8C7E72",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>{t}</button>)}
                </div>
              </div>
              <div style={{ marginBottom:13 }}>
                <FL label="Color"/>
                <div style={{ display:"flex",gap:7,flexWrap:"wrap" }}>
                  {COLOR_OPTIONS.map(c=><button key={c} onClick={()=>setEditItem(p=>({...p,color:c}))} style={{ width:28,height:28,borderRadius:"50%",background:c,border:`3px solid ${editItem.color===c?"#2D2520":"transparent"}`,cursor:"pointer",transform:editItem.color===c?"scale(1.2)":"scale(1)",transition:"transform 0.15s" }}/>)}
                </div>
              </div>
              <div style={{ marginBottom:18 }}>
                <FL label="¿Para qué estados emocionales?"/>
                <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                  {moods.map(m=>{const sel=editItem.moods.includes(m.id);return<button key={m.id} onClick={()=>setEditItem(p=>({...p,moods:sel?p.moods.filter(x=>x!==m.id):[...p.moods,m.id]}))} style={{ padding:"5px 11px",borderRadius:20,border:`1.5px solid ${sel?m.color:"#DDD8D0"}`,background:sel?m.bg:"#F9F7F4",color:sel?m.color:"#8C7E72",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>{m.emoji} {m.label}</button>;})}
                </div>
              </div>
              <div style={{ display:"flex",gap:9 }}>
                <button onClick={()=>setEditItem(null)} style={{ flex:1,padding:"13px",background:"transparent",border:"1.5px solid #DDD8D0",borderRadius:14,color:"#8C7E72",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>Cancelar</button>
                <button onClick={()=>upsertProduct(editItem)} disabled={!editItem.title||!editItem.desc||editItem.moods.length===0}
                  style={{ flex:1,padding:"13px",background:(!editItem.title||!editItem.desc||editItem.moods.length===0)?"#EDE9E3":"linear-gradient(135deg,#3D8FAB,#5E9E5B)",border:"none",borderRadius:14,color:(!editItem.title||!editItem.desc||editItem.moods.length===0)?"#C0B8B0":"white",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
                  Guardar producto
                </button>
              </div>
            </>
          )}
          {view==="stats" && (
            <>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18 }}>
                {[{l:"Total",v:localProds.length,e:"📦",c:"#3D8FAB"},{l:"Activos",v:localProds.filter(p=>p.active).length,e:"✅",c:"#5E9E5B"},{l:"Inactivos",v:localProds.filter(p=>!p.active).length,e:"⏸️",c:"#E8A020"},{l:"Estados cubiertos",v:new Set(localProds.flatMap(p=>p.moods)).size,e:"🎯",c:"#7B64BC"}].map(s=>(
                  <div key={s.l} style={{ background:`${s.c}10`,border:`1px solid ${s.c}30`,borderRadius:14,padding:"13px 15px",textAlign:"center" }}>
                    <div style={{ fontSize:20,marginBottom:3 }}>{s.e}</div>
                    <div style={{ fontSize:22,fontWeight:700,color:s.c,fontFamily:"'Playfair Display',serif" }}>{s.v}</div>
                    <div style={{ fontSize:10,color:"#8C7E72",fontFamily:"'DM Sans',sans-serif",fontWeight:600 }}>{s.l}</div>
                  </div>
                ))}
              </div>
              {moods.map(m=>{const c=localProds.filter(p=>p.moods.includes(m.id)&&p.active).length;return(
                <div key={m.id} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                  <span style={{ fontSize:17,width:22,textAlign:"center" }}>{m.emoji}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                      <span style={{ fontSize:11.5,fontWeight:600,color:"#5C5044",fontFamily:"'DM Sans',sans-serif" }}>{m.label}</span>
                      <span style={{ fontSize:10.5,color:m.color,fontWeight:700 }}>{c} producto{c!==1?"s":""}</span>
                    </div>
                    <div style={{ height:5,borderRadius:4,background:"#EDE9E3" }}><div style={{ height:"100%",width:`${Math.min(c/3*100,100)}%`,background:m.color,borderRadius:4,transition:"width 0.5s" }}/></div>
                  </div>
                </div>
              );})}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SPLASH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Splash({ onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,2400); return()=>clearTimeout(t); },[]);
  return (
    <div style={{ position:"fixed",inset:0,background:"linear-gradient(160deg,#1A2F24,#0D1F2D)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:300 }}>
      <style>{`@keyframes sL{from{opacity:0;transform:scale(0.4) rotate(-20deg)}to{opacity:1;transform:scale(1) rotate(0)}} @keyframes sT{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}} @keyframes sF{0%,65%{opacity:1}100%{opacity:0}}`}</style>
      <div style={{ animation:"sL 0.8s cubic-bezier(.34,1.56,.64,1) forwards,sF 2.4s forwards",fontSize:60,marginBottom:17 }}>🌿</div>
      <div style={{ animation:"sT 0.6s ease 0.35s both,sF 2.4s forwards",textAlign:"center" }}>
        <div style={{ fontFamily:"'Playfair Display',serif",fontSize:29,color:"#E8F5E4",fontWeight:700 }}>Mente Clara</div>
        <div style={{ fontFamily:"'Lora',serif",fontSize:12,color:"#7DAA7B",marginTop:5,fontStyle:"italic" }}>Un respiro para lo que sientes</div>
      </div>
      <div style={{ position:"absolute",bottom:28,animation:"sT 0.5s ease 0.7s both,sF 2.4s forwards",textAlign:"center" }}>
        <div style={{ fontSize:9,color:"#4A6B4A",letterSpacing:2,textTransform:"uppercase",fontFamily:"'DM Sans',sans-serif" }}>creado por</div>
        <div style={{ fontSize:12.5,color:"#7DAA7B",fontWeight:700,marginTop:2,fontFamily:"'DM Sans',sans-serif" }}>Sorany Grisales</div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   APP PRINCIPAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function App() {
  const [splash, setSplash]   = useState(true);
  const [user, setUser]       = useState(null);
  const [tab, setTab]         = useState("home");
  const [screen, setScreen]   = useState("home");
  const [entries, setEntries] = useState([]);
  const [products, setProducts] = useState([]);
  const [pattern, setPattern] = useState(null);
  const [selEntry, setSelEntry] = useState(null);
  const [detailFrom, setDetailFrom] = useState("home");
  const [selMood, setSelMood] = useState(null);
  const [text, setText]       = useState("");
  const [aiResp, setAiResp]   = useState("");
  const [aiLoad, setAiLoad]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showAdmin, setShowAdmin]   = useState(false);
  const [showCrisis, setShowCrisis] = useState(false);
  const [prodNotif, setProdNotif]   = useState(false);

  const todayPrompt = prompts[new Date().getDay() % prompts.length];

  useEffect(()=>{
    if (!user) return;
    Promise.all([loadEntries(user.email), loadProducts()])
      .then(([e,p])=>{ setEntries(e); setProducts(p); setPattern(detectPattern(e)); });
  },[user]);

  const activeMood = moods.find(m => m.id === selMood);
  const recs = (pattern
    ? products.filter(p => p.active && p.moods.includes(pattern))
    : products.filter(p => p.active)
  ).slice(0, 6);

  const doCheckin = async () => {
    if (!selMood || !text.trim()) return;
    setAiLoad(true); setSubmitted(true);
    const resp = await callAI(selMood, text);
    setAiResp(resp); setAiLoad(false);
    const entry = { id:Date.now(), mood:selMood, text, aiResponse:resp,
      date:new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"}), timestamp:Date.now() };
    const updated = [entry,...entries];
    setEntries(updated);
    await saveEntry(entry, user.email);
    const p = detectPattern(updated); setPattern(p);
    if (p) setProdNotif(true);
  };

  const resetCheckin = () => { setSelMood(null); setText(""); setAiResp(""); setSubmitted(false); };
  const goTab = t => { setTab(t); setScreen("home"); resetCheckin(); if(t==="recursos") setProdNotif(false); };

  if (!user) return (
    <>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}} *{box-sizing:border-box} input:focus{outline:none}`}</style>
      {splash && <Splash onDone={()=>setSplash(false)}/>}
      {!splash && <LoginScreen onLogin={u => { setUser(u); if(u.role==="admin") setShowAdmin(true); }}/>}
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Lora:ital,wght@0,400;1,400&family=DM+Sans:wght@400;600;700&display=swap');
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(13px)}to{opacity:1;transform:translateY(0)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
        *{box-sizing:border-box} textarea:focus,input:focus{outline:none}
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#DDD8D0;border-radius:2px}
      `}</style>

      {showAdmin && <AdminPanel products={products} onSave={async p=>{setProducts(p);await saveProducts(p);}} onClose={()=>setShowAdmin(false)}/>}
      {showCrisis && <CrisisModal onClose={()=>setShowCrisis(false)}/>}

      <div style={{ minHeight:"100vh",background:"linear-gradient(160deg,#FBF8F4 0%,#F4EFE8 55%,#EDE9F0 100%)",fontFamily:"'DM Sans',sans-serif",paddingBottom:82 }}>
        <div style={{ position:"fixed",top:-70,right:-50,width:250,height:250,borderRadius:"50%",background:"radial-gradient(circle,#E8A02010,transparent 70%)",pointerEvents:"none",zIndex:0 }}/>
        <div style={{ position:"fixed",bottom:-50,left:-50,width:200,height:200,borderRadius:"50%",background:"radial-gradient(circle,#7B64BC10,transparent 70%)",pointerEvents:"none",zIndex:0 }}/>

        <div style={{ maxWidth:440,margin:"0 auto",padding:"0 20px",position:"relative",zIndex:1 }}>
          <div style={{ paddingTop:44,paddingBottom:16,animation:"fadeUp 0.5s ease" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div style={{ display:"flex",alignItems:"center",gap:9 }}>
                <div style={{ width:32,height:32,borderRadius:"50% 0 50% 0",background:"linear-gradient(135deg,#5E9E5B,#3D8FAB)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>🌿</div>
                <div>
                  <div style={{ fontSize:18,fontWeight:700,color:"#2D2520",fontFamily:"'Playfair Display',serif",letterSpacing:-0.4,lineHeight:1 }}>Mente Clara</div>
                  <div style={{ fontSize:9.5,color:"#B5A898",fontStyle:"italic",fontFamily:"'Lora',serif" }}>Un respiro para lo que sientes</div>
                </div>
              </div>
              <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2 }}>
                <div style={{ fontSize:11,color:"#8C7E72",fontWeight:600,fontFamily:"'DM Sans',sans-serif" }}>Hola, {user.name.split(" ")[0]} 👋</div>
                {user.role==="admin" && (
                  <button onClick={()=>setShowAdmin(true)} style={{ fontSize:9.5,color:"#C0B8B0",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"'DM Sans',sans-serif",opacity:0.6 }}>⚙️</button>
                )}
                <button onClick={()=>setUser(null)} style={{ fontSize:9,color:"#C0B8B0",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"'DM Sans',sans-serif" }}>Salir</button>
              </div>
            </div>
          </div>

          {tab==="home" && screen==="home" && (
            <div style={{ animation:"fadeUp 0.4s ease" }}>
              {pattern && (()=>{ const m=moods.find(x=>x.id===pattern); return(
                <div style={{ background:`linear-gradient(135deg,${m.color}15,${m.color}05)`,border:`1.5px solid ${m.color}35`,borderRadius:20,padding:"15px 17px",marginBottom:14 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:7 }}>
                    <span style={{ fontSize:19 }}>{m.emoji}</span>
                    <div style={{ fontSize:9.5,color:m.color,fontWeight:700,letterSpacing:1.2,textTransform:"uppercase" }}>Mente Clara notó</div>
                  </div>
                  <div style={{ fontSize:13,color:"#3D3530",fontFamily:"'Lora',serif",fontStyle:"italic",lineHeight:1.5,marginBottom:9 }}>
                    Has registrado <strong>{m.label.toLowerCase()}</strong> varias veces. Tenemos algo para ti.
                  </div>
                  <button onClick={()=>goTab("recursos")} style={{ width:"100%",padding:"9px",background:m.color,border:"none",borderRadius:12,color:"white",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>Ver recursos personalizados ✦</button>
                </div>
              );})()}
              <div style={{ background:"linear-gradient(135deg,#5E9E5B10,#3D8FAB15)",border:"1px solid #C8DCC7",borderRadius:20,padding:"19px 17px",marginBottom:13 }}>
                <div style={{ fontSize:9,color:"#7DAA7B",fontWeight:700,letterSpacing:1.8,textTransform:"uppercase",marginBottom:6 }}>✦ Para reflexionar hoy</div>
                <p style={{ margin:0,fontSize:16,color:"#2D2520",fontFamily:"'Playfair Display',serif",lineHeight:1.65,fontStyle:"italic" }}>"{todayPrompt}"</p>
              </div>
              <button onClick={()=>setScreen("checkin")} style={{ width:"100%",padding:"16px",background:"linear-gradient(135deg,#3D8FAB,#5E9E5B)",border:"none",borderRadius:18,color:"white",fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:10,boxShadow:"0 7px 22px #3D8FAB35",fontFamily:"'DM Sans',sans-serif",transition:"transform 0.2s" }}
                onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e=>e.currentTarget.style.transform="none"}>
                ✦ Hacer mi check-in de hoy
              </button>
              <Disclaimer onCrisis={()=>setShowCrisis(true)}/>
              {entries.length>0 && (
                <div style={{ marginTop:22 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11 }}>
                    <span style={{ fontSize:9.5,color:"#B5A898",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase" }}>Recientes</span>
                    <button onClick={()=>goTab("journal")} style={{ background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#3D8FAB",fontWeight:700,fontFamily:"'DM Sans',sans-serif" }}>Ver todo →</button>
                  </div>
                  {entries.slice(0,3).map(e=><EntryCard key={e.id} entry={e} onClick={e=>{setSelEntry(e);setDetailFrom("home");setScreen("detail");}}/>)}
                </div>
              )}
            </div>
          )}

          {tab==="home" && screen==="checkin" && !submitted && (
            <div style={{ animation:"fadeUp 0.35s ease" }}>
              <button onClick={()=>setScreen("home")} style={{ background:"none",border:"none",cursor:"pointer",color:"#B5A898",fontSize:12,fontWeight:600,padding:0,marginBottom:18 }}>← Volver</button>
              <h2 style={{ fontSize:18,color:"#2D2520",fontFamily:"'Playfair Display',serif",margin:"0 0 3px",fontWeight:600 }}>¿Cómo llega tu energía hoy?</h2>
              <p style={{ fontSize:11.5,color:"#B5A898",margin:"0 0 17px" }}>Elige lo que más resuena contigo</p>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:20 }}>
                {moods.map(m=><MoodPill key={m.id} mood={m} selected={selMood===m.id} onClick={setSelMood}/>)}
              </div>
              {selMood && (
                <div style={{ animation:"fadeUp 0.3s ease" }}>
                  <div style={{ background:activeMood?.bg,border:`1.5px solid ${activeMood?.color}35`,borderRadius:18,padding:16,marginBottom:11 }}>
                    <p style={{ margin:"0 0 8px",fontSize:12.5,color:activeMood?.color,fontWeight:600 }}>{todayPrompt}</p>
                    <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Escribe libremente, sin filtros ni perfección..."
                      style={{ width:"100%",minHeight:105,background:"transparent",border:"none",resize:"none",fontSize:13.5,fontFamily:"'Lora',serif",color:"#4A3E36",lineHeight:1.8,fontStyle:"italic" }}/>
                  </div>
                  <button onClick={doCheckin} disabled={!text.trim()} style={{ width:"100%",padding:"15px",background:text.trim()?`linear-gradient(135deg,${activeMood?.color},${activeMood?.color}BB)`:"#EDE9E3",border:"none",borderRadius:17,color:text.trim()?"white":"#C0B8B0",fontSize:14,fontWeight:700,cursor:text.trim()?"pointer":"not-allowed",fontFamily:"'DM Sans',sans-serif",transition:"all 0.3s" }}>
                    Compartir con Mente Clara ✦
                  </button>
                  <Disclaimer onCrisis={()=>setShowCrisis(true)}/>
                </div>
              )}
            </div>
          )}

          {tab==="home" && screen==="checkin" && submitted && (
            <div style={{ animation:"fadeUp 0.35s ease" }}>
              <div style={{ background:activeMood?.bg,border:`1.5px solid ${activeMood?.color}40`,borderRadius:18,padding:16,marginBottom:5 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
                  <span style={{ fontSize:20 }}>{activeMood?.emoji}</span>
                  <span style={{ fontSize:13,fontWeight:700,color:activeMood?.color,fontFamily:"'DM Sans',sans-serif" }}>{activeMood?.label}</span>
                </div>
                <p style={{ margin:0,fontSize:13.5,fontFamily:"'Lora',serif",fontStyle:"italic",color:"#5C5044",lineHeight:1.75 }}>"{text}"</p>
              </div>
              <AIBubble text={aiResp} loading={aiLoad}/>
              {pattern && !aiLoad && (
                <div style={{ marginTop:13,padding:"12px 15px",background:"#F9F7F4",border:"1px solid #EDE9E3",borderRadius:13,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                  <div style={{ fontSize:12,color:"#5C5044",fontFamily:"'Lora',serif",fontStyle:"italic" }}>Tenemos recursos para ti ✨</div>
                  <button onClick={()=>goTab("recursos")} style={{ padding:"7px 12px",background:"linear-gradient(135deg,#3D8FAB,#5E9E5B)",border:"none",borderRadius:10,color:"white",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>Ver →</button>
                </div>
              )}
              <Disclaimer onCrisis={()=>setShowCrisis(true)}/>
              <div style={{ display:"flex",gap:9,marginTop:13 }}>
                <button onClick={()=>{resetCheckin();setScreen("home");}} style={{ flex:1,padding:"12px",background:"transparent",border:"1.5px solid #DDD8D0",borderRadius:14,color:"#8C7E72",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>Inicio</button>
                <button onClick={()=>goTab("journal")} style={{ flex:1,padding:"12px",background:"#2D2520",border:"none",borderRadius:14,color:"white",fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>Mi diario</button>
              </div>
            </div>
          )}

          {screen==="detail" && selEntry && (
            <div style={{ animation:"fadeUp 0.35s ease" }}>
              <button onClick={()=>{setSelEntry(null);setScreen("home");setTab(detailFrom==="home"?"home":"journal");}} style={{ background:"none",border:"none",cursor:"pointer",color:"#B5A898",fontSize:12,fontWeight:600,padding:0,marginBottom:18 }}>← Volver</button>
              {(()=>{const m=moods.find(x=>x.id===selEntry.mood);return(<>
                <div style={{ display:"flex",alignItems:"center",gap:9,marginBottom:15 }}>
                  <span style={{ fontSize:25 }}>{m?.emoji}</span>
                  <div><div style={{ fontSize:14,fontWeight:700,color:m?.color,fontFamily:"'DM Sans',sans-serif" }}>{m?.label}</div><div style={{ fontSize:10.5,color:"#C0B8B0" }}>{selEntry.date}</div></div>
                </div>
                <div style={{ background:m?.bg,border:`1.5px solid ${m?.color}40`,borderRadius:18,padding:17 }}>
                  <p style={{ margin:0,fontSize:14,fontFamily:"'Lora',serif",fontStyle:"italic",color:"#4A3E36",lineHeight:1.8 }}>"{selEntry.text}"</p>
                </div>
                {selEntry.aiResponse && <AIBubble text={selEntry.aiResponse} loading={false}/>}
              </>)})()}
            </div>
          )}

          {tab==="journal" && screen!=="detail" && (
            <div style={{ animation:"fadeUp 0.35s ease" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:19 }}>
                <h2 style={{ margin:0,fontSize:18,color:"#2D2520",fontFamily:"'Playfair Display',serif",fontWeight:600 }}>Mi diario</h2>
                <span style={{ fontSize:10.5,color:"#C0B8B0" }}>{entries.length} {entries.length===1?"entrada":"entradas"}</span>
              </div>
              {entries.length===0
                ? <div style={{ textAlign:"center",paddingTop:46 }}>
                    <div style={{ fontSize:48,marginBottom:12,animation:"float 3s ease-in-out infinite" }}>🌱</div>
                    <p style={{ color:"#C0B8B0",fontSize:13.5,fontFamily:"'Lora',serif",fontStyle:"italic",lineHeight:1.7 }}>Tu diario está vacío.<br/>Cada check-in es una semilla.</p>
                    <button onClick={()=>{setTab("home");setScreen("checkin");}} style={{ marginTop:15,padding:"12px 24px",background:"linear-gradient(135deg,#3D8FAB,#5E9E5B)",border:"none",borderRadius:15,color:"white",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>Hacer mi primer check-in</button>
                  </div>
                : entries.map(e=><EntryCard key={e.id} entry={e} onClick={e=>{setSelEntry(e);setDetailFrom("journal");setScreen("detail");}}/>)
              }
            </div>
          )}

          {tab==="recursos" && screen!=="detail" && (
            <div style={{ animation:"fadeUp 0.35s ease" }}>
              <div style={{ marginBottom:19 }}>
                <h2 style={{ margin:"0 0 3px",fontSize:18,color:"#2D2520",fontFamily:"'Playfair Display',serif",fontWeight:600 }}>Recursos para ti</h2>
                <p style={{ margin:0,fontSize:11,color:"#B5A898",fontFamily:"'Lora',serif",fontStyle:"italic" }}>
                  {pattern?`Basado en tu patrón emocional reciente ${moods.find(m=>m.id===pattern)?.emoji}`:"Todos los recursos disponibles"}
                </p>
              </div>
              {recs.length===0
                ? <div style={{ textAlign:"center",padding:"38px 0" }}>
                    <div style={{ fontSize:38,marginBottom:11 }}>🌿</div>
                    <p style={{ color:"#C0B8B0",fontSize:13,fontFamily:"'Lora',serif",fontStyle:"italic" }}>Sorany está preparando recursos con cuidado.<br/>Vuelve pronto.</p>
                  </div>
                : <div style={{ display:"flex",flexDirection:"column",gap:10 }}>{recs.map(p=><ProductCard key={p.id} p={p}/>)}</div>
              }
              <div style={{ marginTop:24,padding:"15px 17px",background:"linear-gradient(135deg,#1A2F2410,#0D1F2D08)",border:"1px solid #DDD8D0",borderRadius:17,textAlign:"center" }}>
                <p style={{ margin:"0 0 5px",fontSize:12,color:"#5C5044",fontFamily:"'Lora',serif",fontStyle:"italic",lineHeight:1.6 }}>"Cada recurso es creado con cuidado para acompañarte en tu camino de bienestar."</p>
                <div style={{ fontSize:10.5,color:"#B5A898",fontFamily:"'DM Sans',sans-serif",fontWeight:700 }}>— Sorany Grisales · Mente Clara</div>
              </div>
              <Disclaimer onCrisis={()=>setShowCrisis(true)}/>
            </div>
          )}
        </div>

        <div style={{ position:"fixed",bottom:0,left:0,right:0,background:"rgba(251,248,244,0.96)",backdropFilter:"blur(16px)",borderTop:"1px solid #EDE9E3",padding:"9px 0 14px",zIndex:50 }}>
          <div style={{ maxWidth:440,margin:"0 auto",display:"flex",justifyContent:"space-around" }}>
            {[{id:"home",emoji:"🏠",label:"Inicio"},{id:"journal",emoji:"📓",label:"Diario"},{id:"recursos",emoji:"✨",label:"Recursos",notif:prodNotif}].map(item=>(
              <button key={item.id} onClick={()=>goTab(item.id)} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",padding:"5px 20px",position:"relative" }}>
                {item.notif && <div style={{ position:"absolute",top:3,right:13,width:8,height:8,background:"#D4614A",borderRadius:"50%",animation:"pulse 1.5s ease-in-out infinite" }}/>}
                <span style={{ fontSize:20,filter:tab===item.id?"none":"grayscale(0.5) opacity(0.55)",transition:"filter 0.2s" }}>{item.emoji}</span>
                <span style={{ fontSize:9.5,fontWeight:700,color:tab===item.id?"#3D8FAB":"#C0B8B0",fontFamily:"'DM Sans',sans-serif",letterSpacing:0.4 }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
