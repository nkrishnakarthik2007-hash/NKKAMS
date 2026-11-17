// Privileged user management. The service-role key stays in Supabase secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsPolicy(request: Request, methods = "POST, OPTIONS") {
  const configured = (Deno.env.get("AMS_ALLOWED_ORIGINS") || "").split(",");
  const allowed = new Set([...configured, "https://nkrishnakarthik2007-hash.github.io", "http://localhost:8000"].map(origin => origin.trim()).filter(Boolean));
  const origin = request.headers.get("Origin");
  const accepted = !origin || allowed.has(origin);
  const headers = new Headers({"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":methods,"Vary":"Origin"});
  if (origin && accepted) headers.set("Access-Control-Allow-Origin", origin);
  return {accepted, headers};
}
function jsonResponse(request: Request, body: unknown, status = 200, methods = "POST, OPTIONS") {
  const {accepted, headers} = corsPolicy(request, methods);
  headers.set("Content-Type","application/json; charset=utf-8");
  if (!accepted) return new Response(JSON.stringify({error:"Origin is not allowed."}),{status:403,headers});
  return new Response(JSON.stringify(body),{status,headers});
}


const loginEmail=(employeeId:string)=>`${employeeId.toUpperCase()}@login.nkkams.invalid`;
const passwordIsStrong=(value:string)=>value.length>=12&&/[A-Z]/.test(value)&&/[a-z]/.test(value)&&/\d/.test(value)&&/[^A-Za-z0-9]/.test(value);

async function applyPublicRateLimit(db,request,action,limit,windowSeconds){
  const ip=request.headers.get("cf-connecting-ip")||request.headers.get("x-real-ip")||(request.headers.get("x-forwarded-for")||"").split(",")[0].trim();
  if(!ip)return null;
  const pepper=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"nkkams";
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(pepper+":"+ip));
  const hash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
  const {data,error}=await db.rpc("consume_public_rate_limit",{p_bucket_key:action+":"+hash,p_limit:limit,p_window_seconds:windowSeconds});
  if(error)throw new Error("Security rate limit could not be checked.");
  const result=Array.isArray(data)?data[0]:data;
  return result?.allowed===false?Number(result.retry_after_seconds||60):null;
}

const duplicateIdMessage="An account already uses this Employee ID. Enter a unique Employee ID.";

Deno.serve(async req=>{
  const policy=corsPolicy(req);
  if(req.method==="OPTIONS")return new Response(null,{status:policy.accepted?204:403,headers:policy.headers});
  const json=(value:unknown,status=200)=>jsonResponse(req,value,status);
  if(!policy.accepted)return json({error:"Origin is not allowed."},403);
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  let body:{action?:string;role?:string;employee_id?:string;name?:string;email?:string;phone?:string;password?:string;active?:boolean;enabled?:boolean;message?:string;request_id?:string;status?:string;organization_id?:string;batch_id?:string;proposed_employee_id?:string;organization_name?:string;contact_name?:string;organization_type?:string;location?:string;description?:string};
  try{body=await req.json()}catch{return json({error:"Request body must be valid JSON."},400)}
  const employeeId=String(body.employee_id||"").trim().toUpperCase();
  const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if(body.action==="create_organization_request"){
    const {data:registrationSetting,error:registrationSettingError}=await db.from("platform_settings").select("setting_value").eq("setting_key","organization_creation_enabled").single();
    if(registrationSettingError)return json({error:"Organisation registration settings are unavailable. Please try again later."},503);
    if(registrationSetting?.setting_value===true)return json({error:"Self-service organisation creation is enabled. Refresh the page and complete the Organisation Head account details."},409);
    const orgName=String(body.organization_name||"").trim(),contactName=String(body.contact_name||"").trim();
    const email=String(body.email||"").trim(),phone=String(body.phone||"").trim(),message=String(body.message||"").trim().slice(0,500);
    if(!orgName||orgName.length>120||!contactName||contactName.length>100)return json({error:"Enter a valid organisation and contact name."},400);
    if(!email&&!phone)return json({error:"Provide a phone number or email address."},400);
    if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))return json({error:"Enter a valid email address."},400);
    if(phone&&!/^[+0-9().\-\s]{7,25}$/.test(phone))return json({error:"Enter a valid phone number."},400);
    const {data:existingOrg}=await db.from("organizations").select("id").ilike("name",orgName).maybeSingle();
    if(existingOrg)return json({error:"An organisation with this name is already registered."},409);
    const {data:existingRequest}=await db.from("organization_requests").select("id").ilike("organization_name",orgName).eq("status","pending").maybeSingle();
    if(existingRequest)return json({error:"A request for this organisation is already awaiting review."},409);
    const {error}=await db.from("organization_requests").insert({organization_name:orgName,contact_name:contactName,email:email||null,phone:phone||null,message:message||null,status:"pending"});
    if(error)return json({error:"Could not submit the organisation request. Please try again."},400);
    return json({ok:true,message:"Your organisation request has been sent. The NKKAMS Super Admin will review it."},201);
  }
  if(body.action==="submit_organization_request"){
    const retry=await applyPublicRateLimit(db,req,"organisation_signup",3,3600);
    if(retry!==null)return json({error:"Too many organisation registration attempts from this network. Please try again in about "+Math.ceil(retry/60)+" minute(s)."},429);
    const orgName=String(body.organization_name||"").trim(),contactName=String(body.contact_name||"").trim();
    const email=String(body.email||"").trim(),phone=String(body.phone||"").trim(),message=String(body.message||"").trim().slice(0,500);
    const organizationType=String(body.organization_type||"").trim(),location=String(body.location||"").trim(),description=String(body.description||"").trim().slice(0,500);
    const password=String(body.password||"");
    if(!orgName||orgName.length>120||!contactName||contactName.length>100)return json({error:"Enter a valid organisation and contact name."},400);
    if(!email&&!phone)return json({error:"Provide a phone number or email address."},400);
    if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))return json({error:"Enter a valid email address."},400);
    if(phone&&!/^[+0-9().\-\s]{7,25}$/.test(phone))return json({error:"Enter a valid phone number."},400);
    if(!passwordIsStrong(password))return json({error:"Password must be at least 12 characters and include uppercase, lowercase, number and special character."},400);
    if(!/^[A-Z0-9]{2,30}$/.test(employeeId))return json({error:"Choose an Employee ID with 2 to 30 letters or numbers."},400);
    // Public self-service registration is intentionally always enabled.
    // New organisations must not depend on the platform owner's availability.
    const creationEnabled=true;
    const {data:exists}=await db.from("profiles").select("id").eq("employee_id",employeeId).maybeSingle();
    if(exists)return json({error:duplicateIdMessage},409);
    const {data:existingOrg}=await db.from("organizations").select("id").ilike("name",orgName).maybeSingle();
    if(existingOrg)return json({error:"An organisation with this name is already registered."},409);
    const {data:created,error:createError}=await db.auth.admin.createUser({email:loginEmail(employeeId),password,email_confirm:true,user_metadata:{employee_id:employeeId,name:contactName}});
    if(createError)return json({error:/already registered|already exists|duplicate/i.test(createError.message)?duplicateIdMessage:"Could not create your account. Check your details and try again."},400);
    if(creationEnabled){
      const slug=orgName.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)+"-"+crypto.randomUUID().slice(0,8);
      const {data:org,error:orgError}=await db.from("organizations").insert({name:orgName,slug,status:"active",organization_type:organizationType||null,location:location||null,contact_email:email||null,contact_phone:phone||null,description:description||null}).select("id").single();
      if(orgError){await db.auth.admin.deleteUser(created.user.id);return json({error:"Could not create the organisation. No account was retained."},400);}
      const {error:batchError}=await db.from("batches").insert({organization_id:org.id,name:"SMT-01"});
      if(batchError){await db.from("organizations").delete().eq("id",org.id);await db.auth.admin.deleteUser(created.user.id);return json({error:"Could not create the first batch. No account was retained."},500);}
      const {error:profileError}=await db.from("profiles").insert({id:created.user.id,employee_id:employeeId,name:contactName,role:"organization_head",is_active:true,organization_id:org.id,email:email||null,phone:phone||null});
      if(profileError){await db.from("batches").delete().eq("organization_id",org.id);await db.from("organizations").delete().eq("id",org.id);await db.auth.admin.deleteUser(created.user.id);return json({error:"Could not activate your Organisation Head account. No account was retained."},500);}
      const {error:headError}=await db.from("organizations").update({created_by:created.user.id,head_user_id:created.user.id}).eq("id",org.id);
      if(headError){await db.from("profiles").delete().eq("id",created.user.id);await db.from("batches").delete().eq("organization_id",org.id);await db.from("organizations").delete().eq("id",org.id);await db.auth.admin.deleteUser(created.user.id);return json({error:"Could not assign you as Organisation Head. No account was retained."},500);}
      return json({ok:true,created:true,organization_id:org.id,message:"Your organisation has been created successfully. You are its Organisation Head. Sign in using your Employee ID and password."},201);
    }
    const {error:profileInsertError}=await db.from("profiles").insert({id:created.user.id,employee_id:employeeId,name:contactName,role:"organization_head",is_active:false,email:email||null,phone:phone||null});
    if(profileInsertError){await db.auth.admin.deleteUser(created.user.id);return json({error:"Could not create your pending account."},500);}
    const {error:requestError}=await db.from("organization_requests").insert({organization_name:orgName,contact_name:contactName,email:email||null,phone:phone||null,message:message||null,requested_by:created.user.id,status:"pending",organization_type:organizationType||null,location:location||null,description:description||null});
    if(requestError){await db.from("profiles").delete().eq("id",created.user.id);await db.auth.admin.deleteUser(created.user.id);return json({error:"Could not submit the organisation request."},500);}
    return json({ok:true,created:false,message:"Your organisation request and account were submitted. You can sign in after the Super Admin approves the request."},201);
  }
  if(body.action==="bootstrap_status"){
    const {count,error}=await db.from("profiles").select("id",{count:"exact",head:true});
    if(error)return json({error:"Could not check setup status."},503);
    return json({bootstrap_available:(count||0)===0});
  }
  if(body.action==="get_organization_creation_setting")return json({enabled:true});
  if(body.action==="public_admin_contacts"){
    const {data,error}=await db.from("admin_contacts").select("name,whatsapp,email").eq("is_active",true).order("name");
    if(error)return json({error:"Could not load administrator contacts."},503);
    return json({contacts:data||[]});
  }
  if(body.action==="submit_reset_request"){
    const retry=await applyPublicRateLimit(db,req,"password_reset_request",5,3600);
    if(retry!==null)return json({error:"Too many reset requests. Please try again later."},429);
    const id=String(body.employee_id||"").trim().toUpperCase();
    const message=String(body.message||"").trim().slice(0,500);
    if(!/^[A-Z0-9]{2,30}$/.test(id))return json({error:"Enter a valid Employee ID."},400);
    const {data:person}=await db.from("profiles").select("id,employee_id").eq("employee_id",id).maybeSingle();
    if(person){
      const {error}=await db.from("password_reset_requests").insert({requester_user_id:person.id,employee_id:person.employee_id,message});
      if(error && !/duplicate|unique/i.test(error.message))return json({error:"Could not submit the request. Please contact an administrator."},503);
    }
    return json({ok:true,message:"If the Employee ID is registered, the administrator has received your request."},202);
  }
  // One-time bootstrap: allowed only while the new project has no profiles.
  if(body.action==="bootstrap_super_admin"){
    const {count,error:countError}=await db.from("profiles").select("id",{count:"exact",head:true});
    if(countError)return json({error:"Could not verify first-time setup status."},503);
    if((count||0)>0)return json({error:"Initial administrator setup has already been completed. Sign in instead."},409);
    const name=String(body.name||"").trim(),password=String(body.password||"");
    if(!/^[A-Z0-9]{2,30}$/.test(employeeId))return json({error:"Employee ID must contain 2 to 30 letters or numbers."},400);
    if(!name||name.length>100)return json({error:"Enter a valid administrator name."},400);
    if(password.length<12||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!/[^A-Za-z0-9]/.test(password))return json({error:"Password must be at least 12 characters and include uppercase, lowercase, number, and special character."},400);
    const {data:created,error:createError}=await db.auth.admin.createUser({email:loginEmail(employeeId),password,email_confirm:true,user_metadata:{employee_id:employeeId,name}});
    if(createError)return json({error:/already registered|already exists|duplicate/i.test(createError.message)?"This Employee ID already has a login. Contact support.":"Could not create the administrator account. Try again."},400);
    const {error:profileInsertError}=await db.from("profiles").insert({id:created.user.id,employee_id:employeeId,name,role:"super_admin",is_active:true});
    if(profileInsertError){await db.auth.admin.deleteUser(created.user.id);return json({error:"Could not save administrator profile. No account was retained."},500);}
    return json({ok:true},201);
  }

  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const{data:{user},error:authError}=await db.auth.getUser(token);
  if(authError||!user)return json({error:"Sign in to continue."},401);
  const{data:me,error:profileError}=await db.from("profiles").select("role,is_active,organization_id,batch_id").eq("id",user.id).single();
  if(profileError||!me?.is_active||!["admin","teacher","organization_head","platform_admin","super_admin"].includes(me.role))return json({error:"You do not have permission to manage accounts."},403);
  const isSuper=me.role==="super_admin";
  if(body.action==="get_organization_creation_setting")return json({enabled:true});
  if(body.action==="set_organization_creation_setting")return json({error:"Public organisation registration is always enabled on this platform."},409);
  const isPlatformAdmin=me.role==="platform_admin";
  const isGlobalAdmin=isSuper||isPlatformAdmin;
  const isOrgHead=me.role==="organization_head";
  const isOrgAdmin=me.role==="admin";
  const canManageUsers=isGlobalAdmin||isOrgHead||isOrgAdmin;
  if(!isGlobalAdmin&&me.organization_id){const {data:org,error:orgError}=await db.from("organizations").select("status").eq("id",me.organization_id).maybeSingle();if(orgError||!org||org.status!=="active")return json({error:"Your organisation is currently suspended. Contact a Website Admin or Super Admin."},403);}
  
  if(body.action==="list_organization_requests"){
    if(!isGlobalAdmin)return json({error:"Only a website administrator can review organisation requests."},403);
    const {data,error}=await db.from("organization_requests").select("id,organization_name,contact_name,email,phone,status,created_at").eq("status","pending").order("created_at",{ascending:false});
    if(error)return json({error:"Could not load organisation requests."},503);
    return json({requests:data||[]});
  }
  if(body.action==="review_organization_request"){
    if(!isGlobalAdmin)return json({error:"Only a website administrator can approve organisations."},403);
    const requestId=String(body.request_id||""),decision=String(body.status||"");
    if(!/^[0-9a-f-]{36}$/i.test(requestId)||!["approved","rejected"].includes(decision))return json({error:"Invalid organisation request."},400);
    const {data:reqRow,error:reqError}=await db.from("organization_requests").select("*").eq("id",requestId).eq("status","pending").single();
    if(reqError||!reqRow)return json({error:"Request not found or already reviewed."},404);
    if(decision==="rejected"){
      const {error}=await db.from("organization_requests").update({status:"rejected",reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",requestId);
      if(error)return json({error:"Could not reject request."},400);
      return json({ok:true});
    }
    const slug=reqRow.organization_name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)+"-"+crypto.randomUUID().slice(0,8);
    const {data:org,error:orgError}=await db.from("organizations").insert({name:reqRow.organization_name.trim(),slug,status:"active",created_by:reqRow.requested_by||user.id}).select("id").single();
    if(orgError)return json({error:"Could not create organisation."},400);
    const {error:batchError}=await db.from("batches").insert({organization_id:org.id,name:"SMT-01"});
    if(batchError){await db.from("organizations").delete().eq("id",org.id);return json({error:"Could not create the first batch."},500);}
    if(reqRow.requested_by){
      const {error:ownerError}=await db.from("profiles").update({organization_id:org.id,is_active:true,role:"organization_head"}).eq("id",reqRow.requested_by).eq("role","organization_head");
      if(ownerError){await db.from("organizations").delete().eq("id",org.id);return json({error:"Could not activate the organisation head account."},500);}
      const {error:headError}=await db.from("organizations").update({head_user_id:reqRow.requested_by}).eq("id",org.id);
      if(headError){await db.from("profiles").update({organization_id:null,is_active:false}).eq("id",reqRow.requested_by);await db.from("organizations").delete().eq("id",org.id);return json({error:"Could not assign the organisation head."},500);}
    }
    const {error:updateError}=await db.from("organization_requests").update({status:"approved",reviewed_by:user.id,reviewed_at:new Date().toISOString(),organization_id:org.id}).eq("id",requestId);
    if(updateError)return json({error:"Organisation created, but request status update failed."},500);
    return json({ok:true,organization_id:org.id},201);
  }
  if(body.action==="list_organizations"){
    if(!isGlobalAdmin)return json({error:"Only website administrators can view all organisations."},403);
    const {data:orgs,error}=await db.from("organizations").select("id,name,slug,status,created_at,head_user_id").order("name");
    if(error)return json({error:"Could not load organisations."},503);
    const ids=(orgs||[]).map(o=>o.head_user_id).filter(Boolean);
    const orgIds=(orgs||[]).map(o=>o.id);
    const {data:heads}=ids.length?await db.from("profiles").select("id,employee_id,name,email,phone,is_active").in("id",ids):{data:[]};
    const {data:candidateRows}=orgIds.length?await db.from("profiles").select("id,employee_id,name,role,organization_id,is_active").in("organization_id",orgIds).in("role",["admin","organization_head"]).eq("is_active",true):{data:[]};
    const headMap=new Map((heads||[]).map(h=>[h.id,h]));
    const candidateMap=new Map<string,unknown[]>();
    for(const c of candidateRows||[]){const list=candidateMap.get(c.organization_id)||[];list.push({id:c.id,employee_id:c.employee_id,name:c.name,role:c.role});candidateMap.set(c.organization_id,list);}
    const result=await Promise.all((orgs||[]).map(async o=>{
      const [students,batches,users,attendance,present,absent]=await Promise.all([
        db.from("students").select("id",{count:"exact",head:true}).eq("organization_id",o.id),
        db.from("batches").select("id",{count:"exact",head:true}).eq("organization_id",o.id),
        db.from("profiles").select("id",{count:"exact",head:true}).eq("organization_id",o.id),
        db.from("attendance").select("id",{count:"exact",head:true}).eq("organization_id",o.id),
        db.from("attendance").select("id",{count:"exact",head:true}).eq("organization_id",o.id).eq("status","present"),
        db.from("attendance").select("id",{count:"exact",head:true}).eq("organization_id",o.id).eq("status","absent")
      ]);
      return {...o,head:headMap.get(o.head_user_id)||null,candidates:candidateMap.get(o.id)||[],student_count:students.count||0,batch_count:batches.count||0,user_count:users.count||0,attendance_count:attendance.count||0,present_count:present.count||0,absent_count:absent.count||0};
    }));
    return json({organizations:result});
  }
  if(body.action==="set_organization_status"){
    if(!isGlobalAdmin)return json({error:"Only a website administrator can change organisation status."},403);
    const orgId=String(body.organization_id||""),status=String(body.status||"");
    if(!/^[0-9a-f-]{36}$/i.test(orgId)||!["active","suspended"].includes(status))return json({error:"Choose a valid organisation status."},400);
    const {error}=await db.from("organizations").update({status}).eq("id",orgId);
    if(error)return json({error:"Could not update organisation status."},400);
    return json({ok:true});
  }
  if(body.action==="set_organization_head"){
    if(!isGlobalAdmin)return json({error:"Only a website administrator can change an organisation head."},403);
    const orgId=String(body.organization_id||"");
    const targetEmployee=String(body.employee_id||"").trim().toUpperCase();
    if(!/^[0-9a-f-]{36}$/i.test(orgId)||!targetEmployee)return json({error:"Choose an organisation and an employee."},400);
    const {data:target,error}=await db.from("profiles").select("id,role,organization_id,is_active").eq("employee_id",targetEmployee).maybeSingle();
    if(error||!target)return json({error:"The selected account was not found."},404);
    if(!target.is_active||target.organization_id!==orgId||!["admin","organization_head"].includes(target.role))return json({error:"Choose an active Admin from this organisation."},400);
    const {error:assignError}=await db.rpc("admin_set_organization_head",{p_actor_id:user.id,p_organization_id:orgId,p_new_head_id:target.id});
    if(assignError)return json({error:assignError.message||"Could not change organisation head."},400);
    return json({ok:true});
  }
  if(body.action==="request_head_transfer"){
    if(!isOrgHead||!me.organization_id)return json({error:"Only the current organisation head can request a transfer."},403);
    const proposedEmployee=String(body.proposed_employee_id||"").trim().toUpperCase();
    const {data:candidate,error}=await db.from("profiles").select("id,role,organization_id,is_active").eq("employee_id",proposedEmployee).maybeSingle();
    if(error||!candidate||!candidate.is_active||candidate.organization_id!==me.organization_id||candidate.role!=="admin")return json({error:"Choose an active Organisation Admin from your organisation."},400);
    const {data:existing}=await db.from("organization_head_transfer_requests").select("id").eq("organization_id",me.organization_id).in("status",["pending","accepted"]).maybeSingle();
    if(existing)return json({error:"There is already a pending leadership transfer request."},409);
    const {error:insertError}=await db.from("organization_head_transfer_requests").insert({organization_id:me.organization_id,current_head_id:user.id,proposed_head_id:candidate.id,requested_by:user.id});
    if(insertError)return json({error:"Could not submit the leadership transfer request."},400);
    return json({ok:true,message:"Transfer request sent. The selected Admin must accept it."},201);
  }
  if(body.action==="list_head_transfer_requests"){
    if(!isGlobalAdmin&&!isOrgHead&&me.role!=="admin")return json({error:"You cannot view leadership transfer requests."},403);
    let query=db.from("organization_head_transfer_requests").select("id,organization_id,current_head_id,proposed_head_id,requested_by,status,created_at").order("created_at",{ascending:false});
    if(isOrgHead)query=query.eq("organization_id",me.organization_id).in("status",["pending","accepted"]);
    else if(!isGlobalAdmin)query=query.eq("proposed_head_id",user.id).eq("status","pending");
    else query=query.in("status",["pending","accepted"]);
    const {data,error}=await query;
    if(error)return json({error:"Could not load leadership transfer requests."},503);
    const ids=[...new Set((data||[]).flatMap(r=>[r.current_head_id,r.proposed_head_id]))];
    const {data:people}=ids.length?await db.from("profiles").select("id,employee_id,name").in("id",ids):{data:[]};
    const map=new Map((people||[]).map(p=>[p.id,p]));
    const orgIds=[...new Set((data||[]).map(r=>r.organization_id))];
    const {data:orgs}=orgIds.length?await db.from("organizations").select("id,name").in("id",orgIds):{data:[]};
    const orgMap=new Map((orgs||[]).map(o=>[o.id,o.name]));
    return json({requests:(data||[]).map(r=>({...r,organization_name:orgMap.get(r.organization_id)||"Organisation",current_head:map.get(r.current_head_id)||null,proposed_head:map.get(r.proposed_head_id)||null}))});
  }
  if(body.action==="accept_head_transfer"||body.action==="review_head_transfer"){
    const requestId=String(body.request_id||"");
    if(!/^[0-9a-f-]{36}$/i.test(requestId))return json({error:"Invalid transfer request."},400);
    const {data:request,error:requestError}=await db.from("organization_head_transfer_requests").select("id,organization_id,proposed_head_id,status").eq("id",requestId).in("status",["pending","accepted"]).maybeSingle();
    if(requestError||!request)return json({error:"This transfer request is no longer pending."},404);
    if(body.action==="accept_head_transfer"){
      if(!isOrgAdmin||request.proposed_head_id!==user.id||request.organization_id!==me.organization_id)return json({error:"Only the invited Organisation Admin can accept this transfer."},403);
      if(request.status!=="pending")return json({error:"This invitation has already been accepted."},409);
      const {error}=await db.from("organization_head_transfer_requests").update({status:"accepted",accepted_at:new Date().toISOString()}).eq("id",requestId).eq("status","pending");
      if(error)return json({error:"Could not record your acceptance."},400);
      return json({ok:true,message:"Your acceptance has been recorded. The Super Admin or Website Admin must approve the transfer."});
    }
    if(!isGlobalAdmin)return json({error:"Only a website administrator can review this transfer."},403);
    if(body.status==="rejected"){
      const {error}=await db.from("organization_head_transfer_requests").update({status:"rejected",reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",requestId);
      if(error)return json({error:"Could not reject this transfer."},400);
      return json({ok:true});
    }
    if(body.status!=="approved")return json({error:"Choose approve or reject."},400);
    if(request.status!=="accepted")return json({error:"The proposed Organisation Admin must accept before you can approve the transfer."},409);
    const {error}=await db.rpc("complete_organization_head_transfer",{p_request_id:requestId,p_actor_id:user.id});
    if(error)return json({error:error.message||"Could not complete this transfer."},400);
    return json({ok:true});
  }
  if(body.action==="list_batches"){
    const orgId=String(body.organization_id||"");
    if(!/^[0-9a-f-]{36}$/i.test(orgId))return json({error:"Choose a valid organisation."},400);
    if(!isGlobalAdmin&&me.organization_id!==orgId)return json({error:"You cannot view another organisation's batches."},403);
    let batchQuery=db.from("batches").select("id,name,is_active").eq("organization_id",orgId).order("name");
    if(me.role==="teacher"){if(!me.batch_id)return json({batches:[]});batchQuery=batchQuery.eq("id",me.batch_id);}
    const {data,error}=await batchQuery;
    if(error)return json({error:"Could not load batches."},503);
    return json({batches:data||[]});
  }
  if(body.action==="create_batch"){
    const orgId=String(body.organization_id||""),name=String(body.name||"").trim();
    if(!/^[0-9a-f-]{36}$/i.test(orgId)||!name||name.length>80)return json({error:"Enter a valid batch name."},400);
    if(!canManageUsers)return json({error:"You do not have permission to create batches."},403);
    if(!isGlobalAdmin&&me.organization_id!==orgId)return json({error:"You cannot create batches for another organisation."},403);
    const {data,error}=await db.from("batches").insert({organization_id:orgId,name}).select("id,name").single();
    if(error)return json({error:/duplicate/i.test(error.message)?"That batch already exists.":"Could not create batch."},400);
    return json({ok:true,batch:data},201);
  }
  if(body.action==="list_users"){
    let query=db.from("profiles").select("employee_id,name,role,is_active,email,phone,created_at").order("created_at");
    if(!isGlobalAdmin){query=query.eq("organization_id",me.organization_id);if(isOrgAdmin)query=query.eq("role","teacher");else query=query.in("role",["admin","teacher"]);}
    const {data,error}=await query;
    if(error)return json({error:"Could not load user accounts."},503);
    return json({users:data||[]});
  }
  if(body.action==="list_reset_requests"){
    const {data,error}=await db.from("password_reset_requests").select("id,employee_id,message,status,created_at").order("created_at",{ascending:false});
    if(error)return json({error:"Could not load reset requests."},503);
    if(isGlobalAdmin)return json({requests:data||[]});
    const ids=(data||[]).map(x=>x.employee_id);
    const {data:people}=await db.from("profiles").select("employee_id,organization_id,role").in("employee_id",ids.length?ids:["__none__"]);
    const allowed=new Set((people||[]).filter(x=>x.organization_id===me.organization_id&&(isOrgHead||x.role==="teacher")).map(x=>x.employee_id));
    return json({requests:(data||[]).filter(x=>allowed.has(x.employee_id))});
  }
  if(body.action==="update_reset_request"){
    const requestId=String(body.request_id||"");
    const status=String(body.status||"");
    if(!/^[0-9a-f-]{36}$/i.test(requestId)||!["pending","reviewed","resolved","rejected"].includes(status))return json({error:"Invalid reset request update."},400);
    const {data:request,error:requestError}=await db.from("password_reset_requests").select("requester_user_id").eq("id",requestId).maybeSingle();
    if(requestError||!request)return json({error:"Reset request not found."},404);
    if(!isGlobalAdmin){const {data:target}=await db.from("profiles").select("organization_id,role").eq("id",request.requester_user_id).maybeSingle();if(!target||target.organization_id!==me.organization_id||(isOrgAdmin&&target.role!=="teacher")||(!isOrgHead&&!isOrgAdmin))return json({error:"You cannot update a reset request outside your organisation or role scope."},403);}
    const {error}=await db.from("password_reset_requests").update({status,reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",requestId);
    if(error)return json({error:"Could not update the request."},400);
    return json({ok:true});
  }
  if(body.action==="reset_user_password"){
    const targetId=String(body.employee_id||"").trim().toUpperCase();
    const password=String(body.password||"");
    if(password.length<12||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!/[^A-Za-z0-9]/.test(password))return json({error:"Password must be at least 12 characters and include uppercase, lowercase, number and symbol."},400);
    const {data:target,error}=await db.from("profiles").select("id,role").eq("employee_id",targetId).maybeSingle();
    if(error||!target)return json({error:"User not found."},404);
    if(!isGlobalAdmin&&target.role!=="teacher"&&!(isOrgHead&&target.role==="admin"))return json({error:"You cannot reset this account."},403);
    if(!isGlobalAdmin){const {data:targetOrg}=await db.from("profiles").select("organization_id").eq("id",target.id).single();if(targetOrg?.organization_id!==me.organization_id)return json({error:"You cannot manage accounts outside your organisation."},403);}
    if(target.role==="super_admin")return json({error:"The Super Admin password cannot be reset from this screen."},403);
    if(target.role==="platform_admin"&&!isSuper)return json({error:"Only the Super Admin can reset a website administrator account."},403);
    const {error:updateError}=await db.auth.admin.updateUserById(target.id,{password,ban_duration:"none"});
    if(updateError)return json({error:"Could not reset the account password."},400);
    return json({ok:true});
  }
  if(body.action==="create_user"){
    const role=body.role;
    if(!["admin","teacher","platform_admin"].includes(role||""))return json({error:"Choose Teacher, Organisation Admin or Website Admin."},400);
    if(role==="platform_admin"&&!isSuper)return json({error:"Only the Super Admin can create website administrators."},403);
    if(role==="admin"&&!isGlobalAdmin&&!isOrgHead)return json({error:"Only the organisation head or a website administrator can create Admin accounts."},403);
    const targetOrgId=String(body.organization_id||me.organization_id||"");
    if(role!=="platform_admin"){
      if(!/^[0-9a-f-]{36}$/i.test(targetOrgId))return json({error:"Choose an organisation for this account."},400);
      if(!isGlobalAdmin&&targetOrgId!==me.organization_id)return json({error:"You cannot create accounts for another organisation."},403);
      const {data:org}=await db.from("organizations").select("id").eq("id",targetOrgId).eq("status","active").maybeSingle();
      if(!org)return json({error:"The selected organisation is not active."},400);
    }
    const name=String(body.name||"").trim(),password=String(body.password||"");
    let assignedBatchId:string|null=null;
    if(role==="teacher"){
      const requestedBatch=String(body.batch_id||"");
      if(!/^[0-9a-f-]{36}$/i.test(requestedBatch))return json({error:"Choose the batch this Teacher / Batch Admin is responsible for."},400);
      const {data:assignedBatch,error:batchLookupError}=await db.from("batches").select("id").eq("id",requestedBatch).eq("organization_id",targetOrgId).maybeSingle();
      if(batchLookupError||!assignedBatch)return json({error:"The selected batch does not belong to the chosen organisation."},400);
      assignedBatchId=assignedBatch.id;
    }
    if(!/^[A-Z0-9]{1,30}$/.test(employeeId))return json({error:"Employee ID must contain 1 to 30 letters or numbers."},400);
    if(!name||name.length>100)return json({error:"Enter a name of 1 to 100 characters."},400);
    if(!passwordIsStrong(password))return json({error:"Password must be at least 8 characters and include uppercase, lowercase, number, and special character."},400);
    const email=String(body.email||"").trim(),phone=String(body.phone||"").trim();
    if(role==="admin"){
      if(!email&&!phone)return json({error:"Provide at least one Admin contact method: phone/WhatsApp or email. Phone is preferred."},400);
      if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))return json({error:"Enter a valid Admin contact email or leave it blank."},400);
      if(phone&&!/^[+0-9().\-\s]{7,25}$/.test(phone))return json({error:"Enter a valid Admin phone or WhatsApp number, or leave it blank."},400);
    }

    const{data:existing,error:lookupError}=await db.from("profiles").select("id").ilike("employee_id",employeeId).limit(1).maybeSingle();
    if(lookupError)return json({error:"Could not verify whether this Employee ID is already in use."},503);
    if(existing)return json({error:duplicateIdMessage},409);

    const{data:created,error:createError}=await db.auth.admin.createUser({email:loginEmail(employeeId),password,email_confirm:true});
    if(createError){
      if(/already registered|already exists|duplicate/i.test(createError.message))return json({error:duplicateIdMessage},409);
      return json({error:"The account could not be created. Check the details and try again."},400);
    }
    const authUserId=created.user.id;
    const{error:insertError}=await db.from("profiles").insert({id:authUserId,employee_id:employeeId,name,email:role==="admin"?(email||null):null,phone:role==="admin"?(phone||null):null,role,organization_id:role==="platform_admin"?null:targetOrgId,batch_id:assignedBatchId,created_by:user.id});
    if(insertError){
      await db.auth.admin.deleteUser(authUserId);
      if(/duplicate|unique/i.test(insertError.message))return json({error:duplicateIdMessage},409);
      return json({error:"The account profile could not be saved. No account was retained."},400);
    }
    if(role==="admin"){
      const{error:contactError}=await db.from("admin_contacts").insert({employee_id:employeeId,name,whatsapp:phone||null,email:email||null,created_by:user.id});
      if(contactError){
        await db.from("profiles").delete().eq("id",authUserId);
        await db.auth.admin.deleteUser(authUserId);
        return json({error:"Administrator contact details could not be saved. No account was retained."},400);
      }
    }
    return json({ok:true},201);
  }

  const{data:target,error:targetError}=await db.from("profiles").select("id,role").eq("employee_id",employeeId).single();
  if(targetError||!target)return json({error:"User not found."},404);
  if(target.role==="super_admin"||(target.role==="platform_admin"&&!isSuper))return json({error:"This website administrator account is protected from your role."},403);
  if(!isGlobalAdmin&&target.role!=="teacher"&&!(isOrgHead&&target.role==="admin"))return json({error:"You cannot manage this account."},403);
  if(!isGlobalAdmin){const {data:targetOrg}=await db.from("profiles").select("organization_id").eq("id",target.id).single();if(targetOrg?.organization_id!==me.organization_id)return json({error:"You cannot manage accounts outside your organisation."},403);}
  if(body.action==="update_profile"){
    const name=String(body.name||"").trim(),email=String(body.email||"").trim(),phone=String(body.phone||"").trim();
    if(!name||name.length>100)return json({error:"Enter a name of 1 to 100 characters."},400);
    if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))return json({error:"Enter a valid contact email or leave it blank."},400);
    if(phone&&!/^[+0-9().\-\s]{7,25}$/.test(phone))return json({error:"Enter a valid contact phone or leave it blank."},400);
    const{error:updateError}=await db.rpc("update_managed_profile",{p_actor_id:user.id,p_employee_id:employeeId,p_name:name,p_email:email||null,p_phone:phone||null});
    if(updateError)return json({error:"Account details could not be saved. Check the details and try again."},400);
    return json({ok:true});
  }
  if(body.action==="set_active"){
    if(target.role==="super_admin"||(target.role==="platform_admin"&&!isSuper))return json({error:"This website administrator account is protected from your role."},403);
    const active=!!body.active;
    const{error:updateError}=await db.from("profiles").update({is_active:active,updated_by:user.id}).eq("id",target.id);
    if(updateError)return json({error:"Account status could not be updated."},400);
    const{error:contactError}=await db.from("admin_contacts").update({is_active:active,updated_by:user.id}).eq("employee_id",employeeId);
    const{error:authUpdateError}=await db.auth.admin.updateUserById(target.id,{ban_duration:active?"none":"876000h"});
    if(contactError||authUpdateError)return json({error:"The account status changed, but a related contact or sign-in update failed. Ask a Super Admin to review it."},500);
    return json({ok:true});
  }
  return json({error:"Unknown action."},400);
});
