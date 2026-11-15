/* NKKAMS starter client. Data access stays behind Supabase RLS. */
(() => {
 const $=id=>document.getElementById(id), today=()=>new Date().toLocaleDateString('en-CA');
 const cfg=window.NKKAMS_CONFIG||{};
 let sb=null, user=null, students=[], attendance={}, pending=[];
 const say=(id,msg)=>{const el=$(id);if(el)el.textContent=msg};
 const localKey='nkkams-offline-queue-v1';
 const readQueue=()=>{try{return JSON.parse(localStorage.getItem(localKey)||'[]')}catch{return []}};
 const saveQueue=q=>{pending=q;localStorage.setItem(localKey,JSON.stringify(q))};
 const offline=()=>!navigator.onLine;
 function connection(){ $('connection').innerHTML='<i></i>'+(offline()?'Offline · changes saved locally':'Online'); }
 function tick(){const d=new Date();$('clock').textContent=d.toLocaleTimeString();$('today').textContent=d.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
 function theme(){document.documentElement.dataset.theme=localStorage.getItem('nkkams-theme')||'light'}
 $('themeToggle').onclick=()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('nkkams-theme',t);theme()};
 theme();tick();setInterval(tick,1000);connection();addEventListener('online',()=>{connection();syncQueue()});addEventListener('offline',connection);
 $('loginForm').onsubmit=async e=>{e.preventDefault();if(!sb){say('loginMessage','Admin setup is not complete. Add Supabase settings in config.js first.');return}
  const id=$('loginEmployeeId').value.trim(),password=$('loginPassword').value;
  $('loginSubmit').disabled=true;say('loginMessage','Signing in…');
  try{const response=await fetch(cfg.url+'/functions/v1/nkkams-login',{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.publishableKey},body:JSON.stringify({employee_id:id,password})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Sign-in failed.');
   if(!data?.access_token||!data?.refresh_token)throw new Error('Sign-in response was incomplete.');
   const {data:sessionData,error:setError}=await sb.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});if(setError)throw setError;
   user=sessionData.user;$('loginGate').classList.add('hidden');$('appMain').classList.remove('hidden');$('logoutBtn').classList.remove('hidden');await load();
  }catch(err){say('loginMessage',err.message||'Sign-in failed.');}finally{$('loginSubmit').disabled=false}
 };
 $('logoutBtn').onclick=async()=>{await sb?.auth.signOut();user=null;$('appMain').classList.add('hidden');$('loginGate').classList.remove('hidden');$('logoutBtn').classList.add('hidden')};
 $('addStudent').onclick=()=>$('studentForm').classList.toggle('hidden');$('cancelAdd').onclick=()=>$('studentForm').classList.add('hidden');
 $('studentForm').onsubmit=async e=>{e.preventDefault();const row={name:$('studentName').value.trim(),employee_id:$('employeeId').value.trim(),joining_date:$('joiningDate').value||null};try{const {error}=await sb.from('students').insert(row);if(error)throw error;$('studentForm').reset();$('studentForm').classList.add('hidden');await load()}catch(err){alert(err.message)}};
 $('search').oninput=render;
 $('attendanceDate').value=today();$('attendanceDate').onchange=load;
 $('exportCsv').onclick=()=>downloadDay();
 $('exportMonthly').onclick=()=>exportReport(false);$('exportIndividual').onclick=()=>exportReport(true);
 async function load(){if(!sb)return;say('saveStatus','Loading…');
  const {data,error}=await sb.from('students').select('id,name,employee_id,joining_date,left_date,is_active').eq('is_active',true).order('name');
  if(error){say('saveStatus',error.message);return}students=data||[];
  const d=$('attendanceDate').value;const {data:a,error:ae}=await sb.from('attendance').select('student_id,status').eq('attendance_date',d);
  if(ae){say('saveStatus',ae.message);return}attendance=Object.fromEntries((a||[]).map(x=>[x.student_id,x.status]));
  fillReports();render();say('saveStatus',offline()?'Offline mode':'Synced');
 }
 function render(){const q=$('search').value.toLowerCase();const rows=students.filter(s=>(s.name+' '+s.employee_id).toLowerCase().includes(q));
  $('studentRows').innerHTML=rows.map(s=>{const eligible=(!s.joining_date||s.joining_date<=$('attendanceDate').value)&&(!s.left_date||s.left_date>=$('attendanceDate').value);const st=attendance[s.id]||'';
   return '<tr><td><strong>'+esc(s.name)+'</strong>'+(eligible?'':' <span title="Outside joining/working dates">⚠</span>')+'</td><td>'+esc(s.employee_id)+'</td><td><div class="attendance-buttons"><button data-id="'+s.id+'" data-status="present" class="'+(st==='present'?'selected-present':'')+'">Present</button><button data-id="'+s.id+'" data-status="absent" class="'+(st==='absent'?'selected-absent':'')+'">Absent</button></div></td></tr>'}).join('')||'<tr><td colspan="3" class="empty">No students found.</td></tr>';
  $('studentRows').querySelectorAll('button[data-id]').forEach(b=>b.onclick=()=>mark(b.dataset.id,b.dataset.status));
  $('totalCount').textContent=students.length;$('presentCount').textContent=Object.values(attendance).filter(x=>x==='present').length;$('absentCount').textContent=Object.values(attendance).filter(x=>x==='absent').length;
 }
 function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 async function mark(id,status){const date=$('attendanceDate').value;attendance[id]=status;render();
  if(offline()){const q=readQueue();q.push({student_id:id,attendance_date:date,status});saveQueue(q);say('saveStatus','Saved on this device · will sync online');return}
  const {error}=await sb.from('attendance').upsert({student_id:id,attendance_date:date,status},{onConflict:'student_id,attendance_date'});if(error){const q=readQueue();q.push({student_id:id,attendance_date:date,status});saveQueue(q);say('saveStatus','Saved locally; server sync needs attention')}else say('saveStatus','Saved');
 }
 async function syncQueue(){if(!sb||!user||offline())return;const q=readQueue();if(!q.length)return;const latest=new Map();q.forEach(x=>latest.set(x.student_id+'|'+x.attendance_date,x));const items=[...latest.values()];const {error}=await sb.from('attendance').upsert(items,{onConflict:'student_id,attendance_date'});if(!error){saveQueue([]);say('saveStatus','Offline changes synced')}else say('saveStatus','Sync pending: '+error.message)}
 function fillReports(){const y=$('reportYear'),m=$('reportMonth'),s=$('reportStudent'),yr=new Date().getFullYear();y.innerHTML=Array.from({length:9},(_,i)=>'<option>'+(yr-4+i)+'</option>').join('');y.value=String(yr);m.innerHTML=Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'">'+new Date(2000,i,1).toLocaleString(undefined,{month:'long'})+'</option>').join('');m.value=String(new Date().getMonth()+1);s.innerHTML='<option value="">Choose a student</option>'+students.map(x=>'<option value="'+x.id+'">'+esc(x.name)+' · '+esc(x.employee_id)+'</option>').join('')}
 async function records(year,month){const start=year+'-'+String(month).padStart(2,'0')+'-01',end=new Date(year,month,0).toLocaleDateString('en-CA');let all=[],from=0;while(true){const {data,error}=await sb.from('attendance').select('student_id,attendance_date,status').gte('attendance_date',start).lte('attendance_date',end).order('attendance_date').range(from,from+999);if(error)throw error;all=all.concat(data||[]);if(!data||data.length<1000)break;from+=1000;}return all}
 async function exportReport(individual){try{const y=Number($('reportYear').value),m=Number($('reportMonth').value),all=await records(y,m);let list=students;if(individual){const id=$('reportStudent').value;if(!id){say('reportMessage','Choose a student first.');return}list=students.filter(s=>s.id===id)}
 const wb=XLSX.utils.book_new(),days=new Date(y,m,0).getDate(),monthName=new Date(y,m-1,1).toLocaleString(undefined,{month:'long'});
 const rows=individual?[[ 'NKKAMS · INDIVIDUAL ATTENDANCE' ],['Student',list[0].name],['Employee ID',list[0].employee_id],['Month',monthName+' '+y],[],['Date','Day','Status']]:[['NKKAMS · MONTHLY ATTENDANCE SUMMARY'],['Year',y],['Month',monthName],[],['Employee ID','Student name','Present','Absent','Attendance %']];
 if(individual){for(let d=1;d<=days;d++){const date=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'),entry=all.find(a=>a.student_id===list[0].id&&a.attendance_date===date);rows.push([date,new Date(y,m-1,d).toLocaleDateString(undefined,{weekday:'short'}),entry?.status||'Not marked'])}}
 else list.forEach(s=>{const mine=all.filter(a=>a.student_id===s.id),p=mine.filter(a=>a.status==='present').length,a=mine.filter(a=>a.status==='absent').length;rows.push([s.employee_id,s.name,p,a,p+a?Math.round(p/(p+a)*100)+'%':'—'])});
 const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=individual?[{wch:16},{wch:18},{wch:20}]:[{wch:18},{wch:28},{wch:12},{wch:12},{wch:16}];ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:individual?2:4}}];XLSX.utils.book_append_sheet(wb,ws,individual?'Student report':'Monthly summary');XLSX.writeFile(wb,individual?'NKKAMS_'+list[0].employee_id+'_'+y+'_'+m+'.xlsx':'NKKAMS_monthly_'+y+'_'+m+'.xlsx');say('reportMessage','Excel report downloaded.')}
 catch(e){say('reportMessage',e.message||'Could not create report')}}
 function downloadDay(){const rows=[['Employee ID','Name','Date','Status'],...students.map(s=>[s.employee_id,s.name,$('attendanceDate').value,attendance[s.id]||'Not marked'])];const csv=rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='NKKAMS_attendance_'+$('attendanceDate').value+'.csv';a.click();URL.revokeObjectURL(a.href)}
 async function start(){if(!cfg.url||!cfg.publishableKey||!window.supabase){say('loginMessage','Supabase connection is not configured. Follow README setup steps.');return}sb=window.supabase.createClient(cfg.url,cfg.publishableKey);const {data}=await sb.auth.getSession();if(data.session){user=data.session.user;$('loginGate').classList.add('hidden');$('appMain').classList.remove('hidden');$('logoutBtn').classList.remove('hidden');await load()}}
 start();
})();