
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
initializeApp();
const db=getFirestore();
function requireOwnerOrAdmin(request,ownerUid){
  if(!request.auth)throw new HttpsError('unauthenticated','Sign in first.');
  const token=request.auth.token||{};
  if(request.auth.uid!==ownerUid && !(token.ownerUid===ownerUid && ['owner','admin'].includes(token.role)))throw new HttpsError('permission-denied','Only the owner or an admin can manage staff.');
}
exports.inviteStaff=onCall({region:'us-central1'},async request=>{
 const caller=request.auth;if(!caller)throw new HttpsError('unauthenticated','Sign in first.');
 const ownerUid=caller.token.ownerUid||caller.uid;if(caller.uid!==ownerUid && caller.token.role!=='admin')throw new HttpsError('permission-denied','Only owner/admin can invite staff.');
 const email=String(request.data?.email||'').trim().toLowerCase();const role=String(request.data?.role||'cashier');const branchIds=Array.isArray(request.data?.branchIds)?request.data.branchIds.slice(0,30):['main'];
 if(!email||!email.includes('@'))throw new HttpsError('invalid-argument','Enter a valid staff email.');
 if(!['admin','manager','cashier','viewer'].includes(role))throw new HttpsError('invalid-argument','Unsupported staff role.');
 if(caller.uid!==ownerUid && role==='admin')throw new HttpsError('permission-denied','Only the owner can assign the admin role.');
 if(caller.uid!==ownerUid && branchIds.some(id=>!(caller.token.branchIds||[]).includes(id)))throw new HttpsError('permission-denied','You can assign staff only to branches you can access.');
 for(const branchId of branchIds){if(branchId!=='main'){const branch=await db.doc(`users/${ownerUid}/branches/${branchId}`).get();if(!branch.exists||branch.data().active===false)throw new HttpsError('invalid-argument',`Branch ${branchId} is unavailable.`);}}
 const ownerSnap=await db.doc(`users/${ownerUid}`).get();if(!ownerSnap.exists)throw new HttpsError('failed-precondition','Business profile not found.');
 const user=await getAuth().getUserByEmail(email).catch(()=>null);if(!user)throw new HttpsError('not-found','Create the staff member Firebase Auth account first, then invite the same email.');
 const old=user.customClaims||{};await getAuth().setCustomUserClaims(user.uid,{...old,ownerUid,role,branchIds,active:true});
 await db.doc(`users/${ownerUid}/members/${user.uid}`).set({uid:user.uid,email,role,branchIds,active:true,invitedBy:ownerUid,updatedAt:FieldValue.serverTimestamp(),createdAt:FieldValue.serverTimestamp()},{merge:true});
 await db.collection(`users/${ownerUid}/auditLogs`).add({action:'staff.invited',targetUid:user.uid,email,role,actorUid:ownerUid,createdAt:FieldValue.serverTimestamp()});
 return {ok:true,uid:user.uid,email,role};
});
exports.removeStaff=onCall({region:'us-central1'},async request=>{
 const caller=request.auth;if(!caller)throw new HttpsError('unauthenticated','Sign in first.');
 const ownerUid=caller.token.ownerUid||caller.uid;if(caller.uid!==ownerUid && caller.token.role!=='admin')throw new HttpsError('permission-denied','Only owner/admin can revoke staff.');
 const targetUid=String(request.data?.targetUid||'');if(!targetUid||targetUid===ownerUid)throw new HttpsError('invalid-argument','Invalid staff member.');
 const memberRef=db.doc(`users/${ownerUid}/members/${targetUid}`);const snap=await memberRef.get();if(!snap.exists)throw new HttpsError('not-found','Staff member not found.');
 const user=await getAuth().getUser(targetUid).catch(()=>null);if(user){const claims={...(user.customClaims||{})};if(claims.ownerUid===ownerUid){delete claims.ownerUid;delete claims.role;delete claims.branchIds;claims.active=false;await getAuth().setCustomUserClaims(targetUid,claims);}}
 await memberRef.set({active:false,revokedAt:FieldValue.serverTimestamp(),revokedBy:ownerUid},{merge:true});
 await db.collection(`users/${ownerUid}/auditLogs`).add({action:'staff.revoked',targetUid,actorUid:ownerUid,createdAt:FieldValue.serverTimestamp()});return {ok:true};
});
exports.updateStaffRole=onCall({region:'us-central1'},async request=>{
 const caller=request.auth;if(!caller)throw new HttpsError('unauthenticated','Sign in first.');
 const ownerUid=caller.token.ownerUid||caller.uid;if(caller.uid!==ownerUid && caller.token.role!=='admin')throw new HttpsError('permission-denied','Only owner/admin can update staff roles.');
 const targetUid=String(request.data?.targetUid||''),role=String(request.data?.role||'');const branchIds=Array.isArray(request.data?.branchIds)?request.data.branchIds.slice(0,30):['main'];
 if(!targetUid||!['admin','manager','cashier','viewer'].includes(role))throw new HttpsError('invalid-argument','Invalid member or role.');
 if(caller.uid!==ownerUid && role==='admin')throw new HttpsError('permission-denied','Only the owner can assign the admin role.');
 if(caller.uid!==ownerUid && branchIds.some(id=>!(caller.token.branchIds||[]).includes(id)))throw new HttpsError('permission-denied','You can assign staff only to branches you can access.');
 for(const branchId of branchIds){if(branchId!=='main'){const branch=await db.doc(`users/${ownerUid}/branches/${branchId}`).get();if(!branch.exists||branch.data().active===false)throw new HttpsError('invalid-argument',`Branch ${branchId} is unavailable.`);}}
 const ref=db.doc(`users/${ownerUid}/members/${targetUid}`);const snap=await ref.get();if(!snap.exists||snap.data().active===false)throw new HttpsError('not-found','Active staff member not found.');
 const user=await getAuth().getUser(targetUid);const old=user.customClaims||{};await getAuth().setCustomUserClaims(targetUid,{...old,ownerUid,role,branchIds,active:true});
 await ref.set({role,branchIds,updatedAt:FieldValue.serverTimestamp()},{merge:true});return {ok:true};
});

exports.initializeMainBranch=onCall({region:'us-central1',timeoutSeconds:540,memory:'512MiB'},async request=>{
 const caller=request.auth;if(!caller)throw new HttpsError('unauthenticated','Sign in first.');
 const ownerUid=caller.token.ownerUid||caller.uid;if(caller.uid!==ownerUid)throw new HttpsError('permission-denied','Only the business owner can initialize legacy branch tags.');
 const names=['inventory','sales','purchases','customers','suppliers','expenses','deliveries','returns','ledger','batches','stockMovements','auditLogs','journal'];let updated=0;
 for(const name of names){const ref=db.collection(`users/${ownerUid}/${name}`);let page=await ref.orderBy(FieldPath.documentId()).limit(400).get();while(!page.empty){const batch=db.batch();let changed=0;for(const d of page.docs){if(!d.get('branchId')){batch.update(d.ref,{branchId:'main'});changed++;}}if(changed){await batch.commit();updated+=changed;}const last=page.docs[page.docs.length-1];page=await ref.orderBy(FieldPath.documentId()).startAfter(last).limit(400).get();}}
 await db.collection(`users/${ownerUid}/auditLogs`).add({action:'branches.initialize-main',updated,actorUid:caller.uid,branchId:'main',createdAt:FieldValue.serverTimestamp()});return {ok:true,updated};
});
