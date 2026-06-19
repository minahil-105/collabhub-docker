/*
|--------------------------------------------------------------------------
| CollabHub App — Student Collaboration Hub
|--------------------------------------------------------------------------
| Uses Firebase for real-time data and authentication
| All features require Firebase connection
|--------------------------------------------------------------------------
*/

// ── FIREBASE CONFIG ──
const firebaseConfig = {
  apiKey: "AIzaSyCIY0yFaUD2GfVs5RbfC__k8_15hL6nrAg",
  authDomain: "student-collaboration-hu-e990d.firebaseapp.com",
  projectId: "student-collaboration-hu-e990d",
  storageBucket: "student-collaboration-hu-e990d.firebasestorage.app",
  messagingSenderId: "104343758311",
  appId: "1:104343758311:web:6936d71f43379eae30c942",
  measurementId: "G-TMB2WQCRNM"
};

let auth, db, currentUser=null, userProfile=null;

firebase.initializeApp(firebaseConfig);
auth = firebase.auth();
db   = firebase.firestore();

// ── CONSTANTS ──
const CHANNELS=[{id:'math',name:'Mathematics',icon:'📐'},{id:'physics',name:'Physics',icon:'⚛️'},{id:'cs',name:'Computer Science',icon:'💻'},{id:'general',name:'General',icon:'💬'}];
const SUBICONS={Mathematics:'📐',Physics:'⚛️','Computer Science':'💻',Chemistry:'🧪',Biology:'🌿',Engineering:'⚙️'};
const AVCOLORS=['linear-gradient(135deg,#8B5CF6,#A855F7)','linear-gradient(135deg,#EC4899,#F472B6)','linear-gradient(135deg,#06B6D4,#3B82F6)','linear-gradient(135deg,#10B981,#34D399)','linear-gradient(135deg,#F59E0B,#F97316)'];
const NCOLS=['#8B5CF6','#EC4899','#06B6D4','#10B981','#F59E0B'];
const KSTATUS=['todo','inprogress','review','done'];
const KLABELS=['To Do','In Progress','Review','Done'];
const KDOTS=['#F59E0B','#3B82F6','#EC4899','#10B981'];
const KBG=['#F59E0B22','#3B82F622','#EC489922','#10B98122'];
const KTXT=['#F59E0B','#60A5FA','#F472B6','#34D399'];
const PRIOC={high:'#EF4444',medium:'#F59E0B',low:'#10B981'};

let activeChannel='math',draggedTask=null,roomFilter='all',chatUnsub=null;
let myConnections=[],incomingRequests=[],sentRequests=[];
let myRooms=[],activeRoomChat=null,activePrivateChat=null;

// ── UTILS ──
function toast(msg,err=false){const t=document.getElementById('toast');t.textContent=msg;t.style.background=err?'var(--red)':'var(--purple)';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function initials(n='?'){return n.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();}
function timeAgo(ts){const d=(Date.now()-(ts||Date.now()))/1000;if(d<60)return'just now';if(d<3600)return Math.floor(d/60)+'m ago';if(d<86400)return Math.floor(d/3600)+'h ago';return Math.floor(d/86400)+'d ago';}
function avC(s=''){let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))%AVCOLORS.length;return AVCOLORS[h];}
function nC(s=''){let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))%NCOLS.length;return NCOLS[h];}

// sidebar helpers
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sb-overlay').classList.toggle('show');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sb-overlay').classList.remove('show');}
function filterRooms(f){roomFilter=f;renderRooms();}
function switchChannel(id){activeRoomChat=null;activePrivateChat=null;activeChannel=id;renderChat();}
function switchRoomChat(roomId,roomName){activeRoomChat={id:roomId,name:roomName};activePrivateChat=null;activeChannel=null;renderChat();}
function dragStart(e,id){draggedTask=id;setTimeout(()=>{const el=document.getElementById('kc-'+id);if(el)el.classList.add('dragging');},0);}

// ── AUTH ──
function switchTab(t){
  document.getElementById('tab-login').classList.toggle('active',t==='login');
  document.getElementById('tab-signup').classList.toggle('active',t==='signup');
  document.getElementById('login-form').style.display=t==='login'?'block':'none';
  document.getElementById('signup-form').style.display=t==='signup'?'block':'none';
}

async function doLogin(){
  const email=document.getElementById('login-email').value.trim();
  const pass=document.getElementById('login-pass').value;
  const err=document.getElementById('login-err');
  const btn=document.getElementById('login-btn');
  err.style.display='none';
  if(!email||!pass){err.textContent='Fill in all fields.';err.style.display='block';return;}
  btn.innerHTML='<span class="spinner"></span>';
  try{
    const c=await auth.signInWithEmailAndPassword(email,pass);
    currentUser=c.user;await loadProfile();showApp();
  }catch(e){err.textContent=e.message;err.style.display='block';}
  btn.innerHTML='Sign In';
}

async function doSignup(){
  const name=document.getElementById('su-name').value.trim();
  const email=document.getElementById('su-email').value.trim();
  const pass=document.getElementById('su-pass').value;
  const dept=document.getElementById('su-dept').value;
  const year=document.getElementById('su-year').value;
  const err=document.getElementById('signup-err');
  const btn=document.getElementById('signup-btn');
  err.style.display='none';
  if(!name||!email||!pass||!dept||!year){err.textContent='Please fill all fields.';err.style.display='block';return;}
  if(pass.length<6){err.textContent='Password must be at least 6 characters.';err.style.display='block';return;}
  btn.innerHTML='<span class="spinner"></span>';
  try{
    const c=await auth.createUserWithEmailAndPassword(email,pass);
    await c.user.updateProfile({displayName:name});
    currentUser=c.user;
    userProfile={uid:c.user.uid,name,email,dept,year};
    await db.collection('users').doc(c.user.uid).set(userProfile);
    showApp();
  }catch(e){err.textContent=e.message;err.style.display='block';}
  btn.innerHTML='Create Account';
}

async function doLogout(){
  try{
    await auth.signOut();
    currentUser=null;userProfile=null;
    document.getElementById('auth-screen').style.display='flex';
    document.getElementById('app-screen').style.display='none';
    toast('Signed out successfully');
  }catch(e){
    console.error('Logout error:',e);
    toast('Error signing out',true);
  }
}

async function deleteUserAccount(){
  if(!confirm('⚠️ This will permanently delete your account, all tasks, and peer profile. Continue?')){return;}
  if(!prompt('Type your email to confirm deletion:')==currentUser.email){toast('Email did not match',true);return;}
  try{
    const uid=currentUser.uid;
    await db.collection('peers').doc(uid).delete().catch(()=>{});
    await db.collection('users').doc(uid).delete().catch(()=>{});
    const tasks=await db.collection('tasks').where('uid','==',uid).get();
    for(const doc of tasks.docs){await doc.ref.delete();}
    await currentUser.delete();
    currentUser=null;userProfile=null;
    document.getElementById('auth-screen').style.display='flex';
    document.getElementById('app-screen').style.display='none';
    toast('Account deleted');
  }catch(e){
    console.error('Deletion error:',e);
    toast('Error: '+e.message,true);
  }
}

async function loadProfile(){
  const snap=await db.collection('users').doc(currentUser.uid).get();
  userProfile=snap.exists?snap.data():{uid:currentUser.uid,name:currentUser.displayName||'Student',email:currentUser.email,dept:'—',year:'—'};
  await loadConnections();
  await loadRooms();
}

async function loadConnections(){
  try{
    const snap=await db.collection('connections').doc(currentUser.uid).get();
    const data=snap.exists?snap.data():{};
    myConnections=data.friends||[];
    incomingRequests=data.incomingRequests||[];
    sentRequests=data.sentRequests||[];
  }catch(e){
    myConnections=[];incomingRequests=[];sentRequests=[];
  }
}

async function loadRooms(){
  try{
    const snap=await db.collection('userRooms').doc(currentUser.uid).get();
    myRooms=snap.exists?snap.data().rooms||[]:[]; 
  }catch(e){
    myRooms=[];
  }
}

async function unjoinRoom(roomId, roomName){
  if(!confirm(`Are you sure you want to leave "${roomName}"?`)){return;}
  try{
    await db.collection('userRooms').doc(currentUser.uid).set({
      rooms:firebase.firestore.FieldValue.arrayRemove(roomId)
    },{merge:true});
    await loadRooms();
    await renderRooms();
    toast(`Left "${roomName}" ✓`);
  }catch(e){
    console.error('Error leaving room:',e);
    toast('Error leaving room',true);
  }
}

function showApp(){
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app-screen').style.display='block';
  document.getElementById('sb-name').textContent=userProfile?.name||'Student';
  document.getElementById('sb-dept').textContent=(userProfile?.dept||'—')+' · '+(userProfile?.year||'');
  document.getElementById('sb-avatar').textContent=initials(userProfile?.name);
  document.getElementById('dash-subtitle').textContent='Welcome back, '+(userProfile?.name?.split(' ')[0]||'Student')+'!';
  navigate('dashboard');
}

// ── DATA LAYER ──
async function getRooms(){
  const s=await db.collection('rooms').orderBy('createdAt','desc').get();
  return s.docs.map(d=>({id:d.id,...d.data()}));
}
async function getNotes(){
  const s=await db.collection('notes').orderBy('createdAt','desc').get();
  return s.docs.map(d=>({id:d.id,...d.data()}));
}
async function getTasks(){
  const s=await db.collection('tasks').where('uid','==',currentUser.uid).get();
  return s.docs.map(d=>({id:d.id,...d.data()}));
}
async function getPeers(){
  const s=await db.collection('peers').get();
  return s.docs.map(d=>({id:d.id,...d.data()}));
}

// ── DASHBOARD ──
async function renderDashboard(){
  const[rooms,notes,tasks,peers]=await Promise.all([getRooms(),getNotes(),getTasks(),getPeers()]);
  document.getElementById('d-rooms').textContent=rooms.length;
  document.getElementById('d-notes').textContent=notes.length;
  document.getElementById('d-tasks').textContent=tasks.filter(t=>t.status==='done').length+'/'+tasks.length;
  document.getElementById('d-peers').textContent=peers.length;
  document.getElementById('d-rooms-list').innerHTML=rooms.slice(0,4).map(r=>`
    <div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--border);">
      <div style="width:36px;height:36px;border-radius:10px;background:${avC(r.subject)};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${SUBICONS[r.subject]||'📚'}</div>
      <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.name}</div><div style="font-size:11px;color:var(--muted);">${r.subject} · ${r.members||1}/${r.max}</div></div>
    </div>`).join('')||'<div style="color:var(--muted);font-size:13px;">No rooms yet.</div>';
  const subs={};
  tasks.forEach(t=>{if(!subs[t.subject])subs[t.subject]={total:0,done:0};subs[t.subject].total++;if(t.status==='done')subs[t.subject].done++;});
  document.getElementById('d-progress').innerHTML=Object.entries(subs).map(([s,v])=>{
    const p=v.total?Math.round(v.done/v.total*100):0;
    return`<div style="margin-bottom:14px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;"><span>${s}</span><span style="color:var(--muted);">${v.done}/${v.total}</span></div><div class="progress-bar"><div class="progress-fill" style="width:${p}%;"></div></div></div>`;
  }).join('')||'<div style="color:var(--muted);font-size:13px;">No tasks yet.</div>';
}

// ── ROOMS ──
async function renderRooms(){
  const rooms=await getRooms();
  const f=roomFilter==='all'?rooms:rooms.filter(r=>r.subject===roomFilter);
  document.getElementById('rooms-grid').innerHTML=f.map(r=>{
    const joined=myRooms.includes(r.id);
    return`
    <div class="room-card">
      <div style="display:flex;justify-content:space-between;margin-bottom:14px;">
        <span style="font-size:32px;">${SUBICONS[r.subject]||'📚'}</span>
        <span class="badge" style="background:#10B98122;color:#34D399;height:fit-content;">● Live</span>
      </div>
      <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:700;margin-bottom:4px;">${r.name}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px;">${r.subject}</div>
      <div style="font-size:12px;color:var(--subtle);margin-bottom:14px;line-height:1.5;">${r.desc||''}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:12px;color:var(--muted);">👥 ${r.members||1}/${r.max}</div>
        <div style="display:flex;gap:6px;">
          ${r.uid===currentUser?.uid?`<button class="btn btn-ghost" style="font-size:12px;padding:6px 10px;color:#EF4444;" onclick="deleteRoom('${r.id}')">✕</button>`:''}
          ${joined?`<div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-primary" style="font-size:12px;padding:6px 14px;" onclick="switchRoomChat('${r.id}','${r.name}');navigate('chat')">💬</button>
            <button class="btn btn-ghost" style="font-size:12px;padding:6px 14px;color:#EF4444;" onclick="unjoinRoom('${r.id}','${r.name}')">Leave</button>
          </div>`:`<button class="btn btn-primary" style="font-size:12px;padding:6px 14px;" onclick="joinRoom('${r.id}','${r.name}')">Join</button>`}
        </div>
      </div>
    </div>`}).join('')||'<div style="color:var(--muted);grid-column:1/-1;padding:20px 0;">No rooms found. Create one!</div>';
}

async function addRoom(){
  const name=document.getElementById('r-name').value.trim();
  const subject=document.getElementById('r-subject').value;
  const max=parseInt(document.getElementById('r-max').value)||8;
  const desc=document.getElementById('r-desc').value.trim();
  if(!name||!subject){toast('Fill in name and subject!',true);return;}
  if(max<2||max>20){toast('Room size must be 2-20!',true);return;}
  try{
    const data={name,subject,max,desc,members:1,creatorName:userProfile.name,uid:currentUser.uid,createdAt:firebase.firestore.FieldValue.serverTimestamp()};
    const ref=await db.collection('rooms').add(data);
    await db.collection('userRooms').doc(currentUser.uid).set({rooms:firebase.firestore.FieldValue.arrayUnion(ref.id)},{merge:true});
    myRooms.push(ref.id);
    document.getElementById('r-name').value='';
    document.getElementById('r-subject').value='';
    document.getElementById('r-max').value='';
    document.getElementById('r-desc').value='';
    closeModal('roomModal');
    await renderRooms();
    toast('Study room created! 🚪');
  }catch(e){
    console.error('Error creating room:',e);
    toast('Error: '+e.message,true);
  }
}

async function joinRoom(id,name){
  try{
    if(myRooms.includes(id)){toast('Already joined this room!',true);return;}
    const room=await db.collection('rooms').doc(id).get();
    if(!room.exists){toast('Room not found',true);return;}
    const data=room.data();
    if(data.members>=data.max){toast('Room is full! 😢',true);return;}
    await db.collection('rooms').doc(id).update({members:firebase.firestore.FieldValue.increment(1)});
    await db.collection('userRooms').doc(currentUser.uid).set({rooms:firebase.firestore.FieldValue.arrayUnion(id)},{merge:true});
    myRooms.push(id);
    await renderRooms();
    toast(`Joined ${name}! Welcome 🎓`);
  }catch(e){
    console.error('Error joining room:',e);
    toast('Error joining room',true);
  }
}

async function deleteRoom(id){
  if(!confirm('Delete this room? This cannot be undone.')){return;}
  try{
    await db.collection('rooms').doc(id).delete();
    await renderRooms();
    toast('Room deleted ✓');
  }catch(e){
    console.error('Error deleting room:',e);
    toast('Error deleting room',true);
  }
}

// ── NOTES ──
async function renderNotes(){
  const notes=await getNotes();
  const search=(document.getElementById('note-search')?.value||'').toLowerCase();
  const filter=document.getElementById('note-filter')?.value||'';
  const f=notes.filter(n=>(!search||n.title.toLowerCase().includes(search)||n.content.toLowerCase().includes(search)||(n.tags||[]).some(t=>t.toLowerCase().includes(search)))&&(!filter||n.subject===filter));
  document.getElementById('notes-list').innerHTML=f.map(n=>`
    <div class="note-card" style="border-left-color:${nC(n.subject)};">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <div><div style="font-weight:700;font-size:14px;">${n.title}</div><div style="font-size:11px;color:var(--muted);margin-top:2px;">${n.subject} · ${n.authorName} · ${timeAgo(n.createdAt)}</div></div>
        ${n.uid===currentUser?.uid?`<button onclick="deleteNote('${n.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:2px 6px;">✕</button>`:''}
      </div>
      <div style="font-size:13px;color:#C0C0D8;line-height:1.6;margin-bottom:10px;">${n.content}</div>
      <div>${(n.tags||[]).map(t=>`<span class="tag">#${t}</span>`).join('')}</div>
    </div>`).join('')||'<div style="text-align:center;color:var(--muted);padding:40px 0;">No notes found.</div>';
}

async function addNote(){
  const title=document.getElementById('n-title').value.trim();
  const subject=document.getElementById('n-subject').value;
  const content=document.getElementById('n-content').value.trim();
  const tags=document.getElementById('n-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
  if(!title||!subject||!content){toast('Fill all fields!',true);return;}
  try{
    const data={title,subject,content,tags,authorName:userProfile.name,uid:currentUser.uid,createdAt:firebase.firestore.FieldValue.serverTimestamp()};
    await db.collection('notes').add(data);
    document.getElementById('n-title').value='';
    document.getElementById('n-subject').value='';
    document.getElementById('n-content').value='';
    document.getElementById('n-tags').value='';
    closeModal('noteModal');
    await renderNotes();
    toast('Note shared! 📚');
  }catch(e){
    console.error('Error adding note:',e);
    toast('Error: '+e.message,true);
  }
}

async function deleteNote(id){
  try{
    await db.collection('notes').doc(id).delete();
    await renderNotes();
    toast('Note deleted ✓');
  }catch(e){
    console.error('Error deleting note:',e);
    toast('Error deleting note',true);
  }
}

// ── TASKS ──
async function renderTasks(){
  const tasks=await getTasks();
  document.getElementById('kanban-cols').innerHTML=KSTATUS.map((s,i)=>`
    <div class="kanban-col" ondrop="dropTask(event,'${s}')" ondragover="event.preventDefault()" ondragleave="">
      <div class="kanban-header" style="background:${KBG[i]};border-left-color:${KDOTS[i]};">
        <span style="color:${KTXT[i]};">${KLABELS[i]}</span>
        <span style="background:${KDOTS[i]};color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;">${tasks.filter(t=>t.status===s).length}</span>
      </div>
      <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:10px;">
        ${tasks.filter(t=>t.status===s).map(t=>`
          <div class="task-card" id="kc-${t.id}" draggable="true" ondragstart="dragStart(event,'${t.id}')">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
              <div style="flex:1;"><div style="font-weight:600;font-size:13px;">${t.title}</div><div style="font-size:11px;color:var(--muted);margin-top:2px;">${t.subject}</div></div>
              <span class="priority-badge" style="background:${PRIOC[t.priority]||'#ccc'}90;border:1px solid ${PRIOC[t.priority]||'#ccc'};color:${PRIOC[t.priority]||'#ccc'};font-size:10px;text-transform:uppercase;padding:2px 8px;border-radius:4px;font-weight:600;">${t.priority}</span>
            </div>
            ${t.due?`<div style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px;">📅 ${new Date(t.due).toLocaleDateString()}</div>`:''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

async function addTask(){
  const title=document.getElementById('t-title').value.trim();
  const subject=document.getElementById('t-subject').value.trim();
  const priority=document.getElementById('t-priority').value;
  const due=document.getElementById('t-due').value;
  if(!title||!subject){toast('Fill in title and subject!',true);return;}
  try{
    const data={title,subject,priority,due,status:'todo',uid:currentUser.uid,createdAt:firebase.firestore.FieldValue.serverTimestamp()};
    await db.collection('tasks').add(data);
    document.getElementById('t-title').value='';
    document.getElementById('t-subject').value='';
    document.getElementById('t-due').value='';
    document.getElementById('t-priority').value='medium';
    closeModal('taskModal');
    await renderTasks();
    toast('Task added! 📝');
  }catch(e){
    console.error('Error adding task:',e);
    toast('Error adding task: '+e.message,true);
  }
}

async function deleteTask(id){
  try{
    await db.collection('tasks').doc(id).delete();
    await renderTasks();
    toast('Task deleted ✓');
  }catch(e){
    console.error('Error deleting task:',e);
    toast('Error deleting task',true);
  }
}

function dragEnd(){draggedTask=null;document.querySelectorAll('.task-card').forEach(c=>c.classList.remove('dragging'));}

async function dropTask(e,status){
  e.preventDefault();
  if(!draggedTask)return;
  try{
    await db.collection('tasks').doc(draggedTask).set({status},{merge:true});
    draggedTask=null;
    await renderTasks();
    toast('Task moved! ✨');
  }catch(err){
    console.error('Error moving task:',err);
    toast('Error moving task',true);
  }
}

// ── PEERS ──
async function renderPeers(){
  const peers=await getPeers();
  const s=(document.getElementById('peer-search')?.value||'').toLowerCase();
  const f=peers.filter(p=>!s||(p.name||'').toLowerCase().includes(s)||(p.dept||'').toLowerCase().includes(s)||(p.subjects||[]).some(x=>x.toLowerCase().includes(s))||(p.skills||[]).some(x=>x.toLowerCase().includes(s)));
  document.getElementById('peers-grid').innerHTML=f.map(p=>{
    const isFriend=myConnections.includes(p.uid);
    const hasIncoming=incomingRequests.some(r=>r.fromUid===p.uid);
    const hasSent=sentRequests.includes(p.uid);
    return`
    <div class="peer-card">
      <div class="avatar" style="background:${avC(p.name)};color:#fff;">${initials(p.name)}</div>
      <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;">${p.name}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">${p.dept} · ${p.year}</div>
      ${hasIncoming?`<div style="font-size:11px;background:#EC489922;color:#F472B6;padding:6px;border-radius:6px;margin-bottom:8px;font-weight:600;text-align:center;">📥 Sent you a request</div>`:''}
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;margin-bottom:8px;">${(p.subjects||[]).map(s=>`<span class="tag">${s}</span>`).join('')}</div>
      ${p.bio?`<div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.5;">${p.bio}</div>`:''}
      <div style="display:flex;gap:6px;flex-direction:column;">
        ${hasIncoming?`<div style="display:flex;gap:6px;"><button class="btn btn-primary" style="flex:1;font-size:11px;padding:7px;justify-content:center;" onclick="acceptConnection('${p.uid}','${p.name}')">✓ Accept</button><button class="btn btn-ghost" style="flex:1;font-size:11px;padding:7px;justify-content:center;" onclick="ignoreConnection('${p.uid}')">✕ Ignore</button></div>`:isFriend?`<div style="display:flex;gap:6px;flex-direction:column;"><button class="btn btn-primary" style="width:100%;justify-content:center;font-size:12px;padding:7px;" onclick="openPrivateChat('${p.uid}','${p.name}')">💬 Message</button><button class="btn btn-ghost" style="width:100%;justify-content:center;font-size:12px;padding:7px;" onclick="unfriend('${p.uid}')">✓ Friends</button></div>`:hasSent?`<button class="btn btn-ghost" style="width:100%;justify-content:center;font-size:12px;padding:7px;" disabled>⏳ Pending</button>`:`<button class="btn btn-primary" style="width:100%;justify-content:center;font-size:12px;padding:7px;" onclick="sendConnectionRequest('${p.uid}','${p.name}')">+ Connect</button>`}
      </div>
    </div>`}).join('')||'<div style="color:var(--muted);grid-column:1/-1;text-align:center;padding:30px;">No peers found. Create your profile first!</div>';
}

async function sendConnectionRequest(uid,name){
  if(uid===currentUser.uid){toast('That\'s you! 👋',true);return;}
  
  // Check if user has created their peer profile
  const peerProfileSnap=await db.collection('peers').doc(currentUser.uid).get();
  if(!peerProfileSnap.exists){
    toast('⚠️ Create your peer profile first to send connection requests!',true);
    return;
  }
  
  try{
    await db.collection('connections').doc(uid).set({
      incomingRequests:firebase.firestore.FieldValue.arrayUnion({fromUid:currentUser.uid,fromName:userProfile.name})
    },{merge:true});
    await db.collection('connections').doc(currentUser.uid).set({
      sentRequests:firebase.firestore.FieldValue.arrayUnion(uid)
    },{merge:true});
    await loadConnections();
    await renderPeers();
    toast(`Connection request sent to ${name}! 🤝`);
  }catch(e){
    console.error('Error:',e);
    toast('Error sending request',true);
  }
}

async function acceptConnection(uid,name){
  try{
    const reqObj=incomingRequests.find(r=>r.fromUid===uid);
    await db.collection('connections').doc(currentUser.uid).set({
      friends:firebase.firestore.FieldValue.arrayUnion(uid),
      incomingRequests:firebase.firestore.FieldValue.arrayRemove(reqObj)
    },{merge:true});
    await db.collection('connections').doc(uid).set({
      friends:firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
      sentRequests:firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
    },{merge:true});
    await loadConnections();
    await renderPeers();
    toast(`You and ${name} are now friends! 👋`);
  }catch(e){
    console.error('Error:',e);
    toast('Error accepting request',true);
  }
}

async function ignoreConnection(uid){
  try{
    const reqObj=incomingRequests.find(r=>r.fromUid===uid);
    await db.collection('connections').doc(currentUser.uid).set({
      incomingRequests:firebase.firestore.FieldValue.arrayRemove(reqObj)
    },{merge:true});
    await db.collection('connections').doc(uid).set({
      sentRequests:firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
    },{merge:true});
    await loadConnections();
    await renderPeers();
    toast('Request ignored');
  }catch(e){
    console.error('Error:',e);
    toast('Error',true);
  }
}

async function unfriend(uid){
  try{
    await db.collection('connections').doc(currentUser.uid).set({
      friends:firebase.firestore.FieldValue.arrayRemove(uid)
    },{merge:true});
    await db.collection('connections').doc(uid).set({
      friends:firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
    },{merge:true});
    await loadConnections();
    await renderPeers();
    toast('Unfriended ✓');
  }catch(e){
    console.error('Error:',e);
    toast('Error',true);
  }
}

function connectPeer(name,uid){
  if(uid===currentUser.uid){toast('That\'s you! 👋',true);return;}
  toast(`Connection request sent to ${name}! 🤝 (Check for notification)`);
}

async function savePeerProfile(){
  const subjects=document.getElementById('p-subjects').value.split(',').map(s=>s.trim()).filter(Boolean);
  const skills=document.getElementById('p-skills').value.split(',').map(s=>s.trim()).filter(Boolean);
  const bio=document.getElementById('p-bio').value.trim();
  if(!subjects.length){toast('Add at least one subject!',true);return;}
  const data={
    uid:currentUser.uid,
    name:userProfile.name,
    dept:userProfile.dept,
    year:userProfile.year,
    subjects,
    skills,
    bio,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  };
  try{
    await db.collection('peers').doc(currentUser.uid).set(data,{merge:true});
    ['p-subjects','p-skills','p-bio'].forEach(id=>document.getElementById(id).value='');
    closeModal('peerModal');
    await renderPeers();
    toast('Profile saved! Others can find you now. ✨');
  }catch(e){
    console.error('Error saving peer profile:',e);
    toast('Error saving profile',true);
  }
}

// ── CHAT ──
function openPrivateChat(friendUid,friendName){
  activePrivateChat={uid:friendUid,name:friendName};
  activeRoomChat=null;
  activeChannel=null;
  navigate('chat');
}

function renderChat(){
  // Always show group channels first
  let channelHTML=CHANNELS.map(c=>`
    <div class="channel-item ${!activePrivateChat&&!activeRoomChat&&c.id===activeChannel?'active':''}" onclick="switchChannel('${c.id}')">
      <span style="font-size:16px;">${c.icon}</span>
      <span style="font-size:13px;font-weight:500;">${c.name}</span>
    </div>`).join('');
  
  // Add private chat if active
  if(activePrivateChat){
    channelHTML+=`
    <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">
      <div class="channel-item active">
        <span style="font-size:16px;">💬</span>
        <span style="font-size:13px;font-weight:500;">${activePrivateChat.name}</span>
      </div>
    </div>`;
    document.getElementById('ch-icon').textContent='💬';
    document.getElementById('ch-name').textContent=activePrivateChat.name;
    if(chatUnsub)chatUnsub();
    const chatId=currentUser.uid<activePrivateChat.uid?currentUser.uid+'-'+activePrivateChat.uid:activePrivateChat.uid+'-'+currentUser.uid;
    chatUnsub=db.collection('privateChats').doc(chatId).collection('msgs').orderBy('createdAt')
      .onSnapshot(snap=>renderChatMsgs(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }
  // Add room chat if active
  else if(activeRoomChat){
    channelHTML+=`
    <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">
      <div class="channel-item active">
        <span style="font-size:16px;">🚪</span>
        <span style="font-size:13px;font-weight:500;">${activeRoomChat.name}</span>
      </div>
    </div>`;
    document.getElementById('ch-icon').textContent='🚪';
    document.getElementById('ch-name').textContent=activeRoomChat.name+' (Room Chat)';
    if(chatUnsub)chatUnsub();
    chatUnsub=db.collection('roomChats').doc(activeRoomChat.id).collection('msgs').orderBy('createdAt')
      .onSnapshot(snap=>renderChatMsgs(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }
  // Show default channel if no private/room chat active
  else{
    const ch=CHANNELS.find(c=>c.id===activeChannel);
    document.getElementById('ch-icon').textContent=ch.icon;
    document.getElementById('ch-name').textContent=ch.name;
    if(chatUnsub)chatUnsub();
    chatUnsub=db.collection('messages').doc(activeChannel).collection('msgs').orderBy('createdAt')
      .onSnapshot(snap=>renderChatMsgs(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }
  
  document.getElementById('channel-list').innerHTML=channelHTML;
}

function renderChatMsgs(msgs){
  document.getElementById('chat-msgs').innerHTML=msgs.map(m=>{
    const mine=m.uid===currentUser?.uid;
    return`<div style="display:flex;flex-direction:column;align-items:${mine?'flex-end':'flex-start'};margin-bottom:10px;">
      ${!mine?`<div style="font-size:11px;color:var(--muted);margin-bottom:3px;">${m.authorName}</div>`:''}
      <div class="chat-bubble ${mine?'mine':'theirs'}">${m.text}</div>
      <div style="font-size:10px;color:var(--subtle);margin-top:2px;">${timeAgo(m.createdAt)}</div>
    </div>`;
  }).join('');
  const c=document.getElementById('chat-msgs');c.scrollTop=c.scrollHeight;
}

async function sendChat(){
  const input=document.getElementById('chat-input');
  const text=input.value.trim();
  if(!text)return;
  try{
    const msg={text,authorName:userProfile.name,uid:currentUser.uid,createdAt:firebase.firestore.FieldValue.serverTimestamp()};
    if(activePrivateChat){
      const chatId=currentUser.uid<activePrivateChat.uid?currentUser.uid+'-'+activePrivateChat.uid:activePrivateChat.uid+'-'+currentUser.uid;
      await db.collection('privateChats').doc(chatId).collection('msgs').add(msg);
    }else if(activeRoomChat){
      await db.collection('roomChats').doc(activeRoomChat.id).collection('msgs').add(msg);
    }else{
      await db.collection('messages').doc(activeChannel).collection('msgs').add(msg);
    }
    input.value='';
  }catch(e){
    console.error('Chat error:',e);
    toast('Error sending message',true);
  }
}

function navigate(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  const map=['dashboard','rooms','notes','tasks','peers','chat'];
  const labels=['Dashboard','Study Rooms','Shared Notes','Task Board','Peer Match','Group Chat'];
  const idx=map.indexOf(page);
  if(idx>=0){document.querySelectorAll('.nav-item')[idx].classList.add('active');document.getElementById('topbar-title').textContent=labels[idx];}
  closeSidebar();
  if(page==='dashboard')renderDashboard();
  if(page==='rooms')renderRooms();
  if(page==='notes')renderNotes();
  if(page==='tasks')renderTasks();
  if(page==='peers')renderPeers();
  if(page==='chat')renderChat();
}

// ── INIT ──
auth.onAuthStateChanged(async user=>{
  if(user){currentUser=user;await loadProfile();showApp();}
});