// ─── State ────────────────────────────────────────────────────────────────────
let diseases = [], medications = [];
let currentPatient = null;
let chatHistories = { diagnose: [], analyse: [], chat: [] };
let uploadedReportPath = null, uploadedReportText = '';
let diagnosisSummary = '';
// FIX 5: analysisSummary is NEVER injected back into the analyse system prompt
// It is only stored for the final report generator
let analysisSummary = '';

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('navDate')) {
    document.getElementById('navDate').textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    loadPatientHistory();
  }
  if (document.getElementById('sidebarName')) {
    loadPatientFromSession();
    initDashboard();
  }
});

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 3500);
}

function setLoading(on) {
  document.getElementById('loading').classList.toggle('show', on);
}

// ─── Tags Input ───────────────────────────────────────────────────────────────
function addTag(e, containerId, inputId, arr) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const input = document.getElementById(inputId);
    const val = input.value.trim().replace(/,$/, '');
    if (!val) return;
    if (arr === 'diseases') diseases.push(val);
    else medications.push(val);
    renderTags(containerId, inputId, arr === 'diseases' ? diseases : medications, arr);
    input.value = '';
  }
}

function renderTags(containerId, inputId, arr, type) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  container.innerHTML = '';
  arr.forEach((tag, i) => {
    const el = document.createElement('span');
    el.className = 'tag';
    el.innerHTML = `${tag} <span class="remove" onclick="removeTag(${i},'${containerId}','${inputId}','${type}')">×</span>`;
    container.appendChild(el);
  });
  container.appendChild(input);
}

function removeTag(i, containerId, inputId, type) {
  if (type === 'diseases') diseases.splice(i, 1);
  else medications.splice(i, 1);
  renderTags(containerId, inputId, type === 'diseases' ? diseases : medications, type);
}

// ─── Patient Registration ─────────────────────────────────────────────────────
async function registerPatient(e) {
  e.preventDefault();
  setLoading(true);
  const data = {
    name: document.getElementById('name').value,
    age: parseInt(document.getElementById('age').value),
    gender: document.getElementById('gender').value,
    bloodGroup: document.getElementById('bloodGroup').value,
    location: document.getElementById('location').value,
    weight: parseFloat(document.getElementById('weight').value) || null,
    height: parseFloat(document.getElementById('height').value) || null,
    allergies: document.getElementById('allergies').value,
    smoking: document.getElementById('smoking').value,
    alcohol: document.getElementById('alcohol').value,
    emergencyContact: document.getElementById('emergencyContact').value,
    underlyingDiseases: [...diseases],
    medications: [...medications]
  };
  try {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.success) {
      sessionStorage.setItem('currentPatient', JSON.stringify(result.patient));
      showToast('✅ Patient registered successfully!');
      setTimeout(() => window.location.href = 'dashboard.html', 800);
    }
  } catch (err) {
    showToast('❌ Error saving patient', 'error');
  }
  setLoading(false);
}

function clearForm() {
  document.getElementById('patientForm').reset();
  diseases = [];
  medications = [];
  document.getElementById('diseaseTags').innerHTML = '<input type="text" id="diseaseInput" placeholder="e.g. Diabetes..." onkeydown="addTag(event,\'diseaseTags\',\'diseaseInput\',\'diseases\')">';
  document.getElementById('medicationTags').innerHTML = '<input type="text" id="medicationInput" placeholder="e.g. Metformin 500mg..." onkeydown="addTag(event,\'medicationTags\',\'medicationInput\',\'medications\')">';
}

// ─── Patient History ──────────────────────────────────────────────────────────
async function loadPatientHistory() {
  try {
    const res = await fetch('/api/patients');
    const patients = await res.json();
    renderPatientList(patients);
  } catch (err) {
    document.getElementById('patientList').innerHTML =
      '<div style="text-align:center;color:var(--text2);padding:1rem;font-size:0.85rem;">Could not load history</div>';
  }
}

function renderPatientList(patients) {
  const list = document.getElementById('patientList');
  if (!patients.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--text2);padding:2rem;font-size:0.85rem;">No patients yet</div>';
    return;
  }
  list.innerHTML = patients.map(p => `
    <div class="patient-card" onclick="loadPatient('${p._id}')">
      <div class="pc-name">${p.name}</div>
      <div class="pc-meta">${p.age} yrs • ${p.gender} • ${p.location}</div>
      ${p.underlyingDiseases?.length
        ? `<div class="pc-meta" style="margin-top:3px;">${p.underlyingDiseases.slice(0, 2).join(', ')}${p.underlyingDiseases.length > 2 ? '...' : ''}</div>`
        : ''}
      <div class="pc-date">${new Date(p.createdAt).toLocaleDateString('en-IN')}</div>
    </div>`).join('');
}

async function searchPatients() {
  const q = document.getElementById('searchInput').value;
  const res = await fetch(`/api/patients?search=${encodeURIComponent(q)}`);
  const patients = await res.json();
  renderPatientList(patients);
}

async function loadPatient(id) {
  setLoading(true);
  const res = await fetch(`/api/patients/${id}`);
  const patient = await res.json();
  sessionStorage.setItem('currentPatient', JSON.stringify(patient));
  showToast(`✅ Loaded: ${patient.name}`);
  setTimeout(() => window.location.href = 'dashboard.html', 600);
  setLoading(false);
}

// ─── Dashboard Init ───────────────────────────────────────────────────────────
function loadPatientFromSession() {
  const data = sessionStorage.getItem('currentPatient');
  if (!data) { window.location.href = 'index.html'; return; }
  currentPatient = JSON.parse(data);

  // FIX 1: Guarantee arrays are always real arrays, never undefined/null
  if (!Array.isArray(currentPatient.underlyingDiseases)) currentPatient.underlyingDiseases = [];
  if (!Array.isArray(currentPatient.medications)) currentPatient.medications = [];

  document.getElementById('sidebarName').textContent = currentPatient.name;
  const bmi = (currentPatient.weight && currentPatient.height)
    ? (currentPatient.weight / ((currentPatient.height / 100) ** 2)).toFixed(1)
    : null;
  document.getElementById('sidebarMeta').innerHTML = `
    ${currentPatient.age} yrs • ${currentPatient.gender} • ${currentPatient.bloodGroup || 'Blood: N/A'}<br>
    📍 ${currentPatient.location}<br>
    ${currentPatient.weight ? `⚖️ ${currentPatient.weight}kg` : ''} ${currentPatient.height ? `📏 ${currentPatient.height}cm` : ''}${bmi ? ` | BMI: ${bmi}` : ''}<br>
    ${currentPatient.allergies ? `⚠️ Allergy: ${currentPatient.allergies}` : ''}`;

  const tagsDiv = document.getElementById('sidebarTags');
  tagsDiv.innerHTML = '';
  currentPatient.underlyingDiseases.forEach(d => {
    tagsDiv.innerHTML += `<span class="pi-tag">${d}</span>`;
  });
  renderSessionLog();
}

function initDashboard() {
  const dp = [
    'Fever + headache + body pain',
    'Chest pain + shortness of breath',
    'Frequent urination + excessive thirst',
    'Persistent cough for 2 weeks',
    'Severe abdominal pain + nausea'
  ];
  document.getElementById('diagnosePrompts').innerHTML =
    dp.map(p => `<div class="quick-prompt" onclick="setPrompt('diagnoseInput','${p}')">${p}</div>`).join('');

  const cp = [
    'Any drug interactions with my medications?',
    'What diet should I follow?',
    'When should I see a doctor immediately?',
    'Explain my condition in simple terms'
  ];
  document.getElementById('chatPrompts').innerHTML =
    cp.map(p => `<div class="quick-prompt" onclick="setPrompt('chatInput','${p}')">${p}</div>`).join('');

  // FIX 1: Safe array access in welcome message
  appendMessage('diagnose', 'ai',
    `Hello! I'm your AI medical assistant. I have your patient profile loaded:\n\n**Patient:** ${currentPatient.name}, ${currentPatient.age} yrs, ${currentPatient.gender}\n**Location:** ${currentPatient.location}\n**Known conditions:** ${currentPatient.underlyingDiseases.join(', ') || 'None'}\n**Current medications:** ${currentPatient.medications.join(', ') || 'None'}\n**Allergies:** ${currentPatient.allergies || 'None'}\n\nPlease describe your symptoms in detail. I will provide a differential diagnosis with probability percentages, suggest confirmatory tests, and recommend safe medications based on your complete profile.`);

  appendMessage('chat', 'ai',
    `Hi ${currentPatient.name}! 👋 I'm your AI health companion. I have your complete medical profile loaded. Ask me anything — symptoms, medications, diet advice, drug interactions, or a second opinion.`);

  checkPendingTests();
}

function setPrompt(inputId, text) {
  document.getElementById(inputId).value = text;
  document.getElementById(inputId).focus();
}

// ─── FIX 2: Session Log — clickable, restores full chat ──────────────────────
function renderSessionLog() {
  const log = document.getElementById('sessionLog');
  const sessions = currentPatient.sessions || [];
  if (!sessions.length) {
    log.innerHTML = '<div style="color:var(--text2);font-size:0.78rem;">No sessions yet</div>';
    return;
  }
  log.innerHTML = sessions.slice(-8).reverse().map((s, i) => {
    const icon = s.type === 'diagnosis' ? '🔬' : s.type === 'analysis' ? '📊' : '📄';
    const label = s.type.charAt(0).toUpperCase() + s.type.slice(1);
    const date = new Date(s.createdAt).toLocaleDateString('en-IN');
    const preview = (s.data?.symptoms || s.data?.report || s.data?.aiResponse || '').substring(0, 55).replace(/\n/g, ' ');
    const actualIndex = sessions.length - 1 - i;
    return `
      <div class="session-item" onclick="restoreSession(${actualIndex})" title="Click to restore this session in chat">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span>${icon} <strong>${label}</strong></span>
          <span style="font-size:0.68rem;color:var(--text2);">${date}</span>
        </div>
        ${preview ? `<div style="font-size:0.72rem;color:var(--text2);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${preview}...</div>` : ''}
      </div>`;
  }).join('');
}

function restoreSession(index) {
  const session = currentPatient.sessions?.[index];
  if (!session) return;

  // Navigate to the correct tab
  const tabMap = { diagnosis: 'diagnose', analysis: 'analyse', report: 'report' };
  const tabName = tabMap[session.type] || 'chat';
  const navEl = document.getElementById(`tab-${tabName}`);
  if (navEl) switchTab(tabName, navEl);

  const chatType = session.type === 'diagnosis' ? 'diagnose'
    : session.type === 'analysis' ? 'analyse'
    : 'chat';

  // Replay the stored user input and AI response in the chat
  if (session.data?.symptoms) {
    appendMessage(chatType, 'user', `📂 [Restored from ${new Date(session.createdAt).toLocaleDateString('en-IN')}] ${session.data.symptoms}`);
  } else if (session.data?.report) {
    appendMessage(chatType, 'user', `📂 [Restored from ${new Date(session.createdAt).toLocaleDateString('en-IN')}] ${session.data.report}`);
  }

  if (session.data?.aiResponse) {
    appendMessage(chatType, 'ai', `📂 **Restored Session — ${new Date(session.createdAt).toLocaleDateString('en-IN')}:**\n\n${session.data.aiResponse}`);
  }

  showToast(`✅ Session restored: ${session.type}`);
}

function checkPendingTests() {
  const pending = sessionStorage.getItem('pendingTests');
  const el = document.getElementById('pendingTestsAlert');
  if (!el) return;
  if (pending) {
    el.innerHTML = `
      <div class="alert alert-warning">
        🧪 <strong>Tests suggested in Diagnosis:</strong> ${pending}<br>
        <small>Upload the report above. The AI will analyse it objectively and compare with previously suspected conditions.</small>
      </div>`;
  }
}

// ─── Tab Switching ────────────────────────────────────────────────────────────
function switchTab(name, el) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');
  el.classList.add('active');
  if (name === 'report') generateReport();
}

function switchAnalyseTab(name, el) {
  document.querySelectorAll('#page-analyse .tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('#page-analyse .tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`analyse-${name}`).classList.add('active');
  el.classList.add('active');
}

// ─── FIX 1: Build Patient Context — always safe arrays ───────────────────────
function buildPatientContext() {
  const p = currentPatient;
  const pdiseases = Array.isArray(p.underlyingDiseases) ? p.underlyingDiseases : [];
  const pmeds = Array.isArray(p.medications) ? p.medications : [];
  let bmi = '';
  if (p.weight && p.height) {
    const b = (p.weight / ((p.height / 100) ** 2)).toFixed(1);
    bmi = ` | BMI: ${b}`;
  }
  return `PATIENT PROFILE:
Name: ${p.name} | Age: ${p.age} | Gender: ${p.gender} | Blood Group: ${p.bloodGroup || 'Unknown'}
Location: ${p.location}
Weight: ${p.weight || 'N/A'} kg | Height: ${p.height || 'N/A'} cm${bmi}
Smoking: ${p.smoking || 'N/A'} | Alcohol: ${p.alcohol || 'N/A'}
Known Underlying Diseases: ${pdiseases.length > 0 ? pdiseases.join(', ') : 'None reported'}
Current Medications: ${pmeds.length > 0 ? pmeds.join(', ') : 'None reported'}
Known Allergies: ${p.allergies || 'None reported'}
Emergency Contact: ${p.emergencyContact || 'N/A'}`;
}

// ─── FIX 3 & 4: System Prompts ───────────────────────────────────────────────
function getSystemPrompt(type) {
  const ctx = buildPatientContext();
  const p = currentPatient;
  const pdiseases = Array.isArray(p.underlyingDiseases) ? p.underlyingDiseases : [];
  const pmeds = Array.isArray(p.medications) ? p.medications : [];

  // FIX 4: Contraindication safety block used in ALL prompts
  const contraindicationBlock = `
CRITICAL SAFETY RULES — NON-NEGOTIABLE:
- Before recommending ANY medication, verify it is NOT contraindicated with patient's diseases: [${pdiseases.length ? pdiseases.join(', ') : 'none'}].
- Before recommending ANY medication, verify it does NOT interact dangerously with current medications: [${pmeds.length ? pmeds.join(', ') : 'none'}].
- Before recommending ANY medication, verify patient is NOT allergic to it: [${p.allergies || 'no known allergies'}].
- If a medication IS contraindicated, interacting, or allergenic — DO NOT recommend it. Instead provide a safe alternative and clearly explain: "⛔ [Drug] avoided because: [reason specific to this patient]".
- Add "⚠️ SAFETY NOTE:" for any drug with even a moderate interaction risk.
- If no safe medication exists given this patient's profile, say so explicitly and recommend specialist referral.`;

  // ── DIAGNOSE ──
  if (type === 'diagnose') {
    return `You are an expert AI physician and diagnostician. You think and respond exactly like a senior doctor with 20+ years of clinical experience.

${ctx}

${contraindicationBlock}

${diagnosisSummary ? `CURRENT SESSION CONTEXT (earlier in this conversation):\n${diagnosisSummary}` : ''}

YOUR TASK — For every symptom description, respond with ALL of the following sections:

---
🔬 DIFFERENTIAL DIAGNOSIS
For each suspected condition:
• — Probability: XX%
• Symptoms supporting this diagnosis
• How this patient's profile (age, gender, existing diseases) affects this probability

---
🧪 RECOMMENDED CONFIRMATORY TESTS
Specific tests needed (e.g., CBC, CRP, LFT, KFT, TSH, X-Ray, Ultrasound, Culture, etc.)
State which suspected disease each test is meant to confirm or rule out.

---
💊 MEDICATION PLAN (Verified safe for this specific patient)
For EACH medication you recommend:
• Drug Name (Generic) | Dose | Frequency | Duration | Purpose
• Safety status for THIS patient
If a commonly used drug is avoided: ⛔ [Drug] — Reason: [specific to this patient's diseases/meds/allergies]

---
🥗 DIETARY & LIFESTYLE RECOMMENDATIONS
Tailored to suspected condition AND patient's existing diseases.

---
🚨 RED FLAGS — GO TO EMERGENCY IF:
List specific warning signs this patient must watch for.

---
Be clinically precise. A licensed physician will review and act on this response.`;
  }

  // ── ANALYSE ──
  // FIX 5: Report analysis is fully independent — prior diagnosis is background reference, NOT a lens
  if (type === 'analyse') {
    const pending = sessionStorage.getItem('pendingTests') || null;
    return `You are an expert AI clinical pathologist and radiologist. You interpret medical reports with complete objectivity and without bias.

${ctx}

${contraindicationBlock}

${pending ? `BACKGROUND REFERENCE ONLY (previously suggested tests — do NOT let this influence your interpretation of the actual test values):\n${pending}\n` : ''}

CRITICAL INSTRUCTION ON OBJECTIVITY:
- Treat the test report/values as the SOLE and PRIMARY source of truth.
- Do NOT assume any pre-existing suspected diagnosis is correct. Test results may confirm, partially confirm, or COMPLETELY CONTRADICT prior suspicion.
- If results point to a DIFFERENT condition: clearly state "⚠️ TEST RESULTS INDICATE A DIFFERENT CONDITION THAN PREVIOUSLY SUSPECTED — [new finding]"
- A test that RULES OUT a feared condition is equally important as one that confirms it. State it clearly.

YOUR TASK — respond with ALL sections:

---
📋 TEST VALUE INTERPRETATION
For each parameter/value in the report:
Parameter | Result | Normal Range | Status (Normal / Mildly Abnormal / High / Low / Critical)
Brief clinical meaning of each abnormal value.

---
🔍 CONDITION ASSESSMENT (Based solely on test results)
For each condition the tests indicate:
• Condition: CONFIRMED / RULED OUT / INCONCLUSIVE
• Evidence: specific test values supporting this conclusion
• If different from prior suspicion — clearly flag with ⚠️

---
💊 MEDICATION PLAN (Based on confirmed test findings + patient safety profile)
For EACH recommended medication:
• Drug Name (Generic) | Dose | Frequency | Duration | Purpose
• Safety verified against this patient's diseases, current meds, allergies
• ⛔ Drugs avoided and specific reason for this patient

---
🥗 DIETARY RECOMMENDATIONS
Specific to confirmed condition + patient's pre-existing diseases.

---
🔄 ADDITIONAL TESTS RECOMMENDED (if results are inconclusive or partial)

---
🚨 URGENT VALUES
Flag any critical readings requiring immediate medical attention.

Be precise and objective. Do not let presumptions override what the data actually shows.`;
  }

  // ── REPORT ──
  if (type === 'report') {
    return `You are generating a formal clinical medical report for physician review and permanent medical records.

${ctx}

${contraindicationBlock}

${diagnosisSummary ? `DIAGNOSIS SESSION SUMMARY:\n${diagnosisSummary}\n` : ''}
${analysisSummary ? `TEST ANALYSIS SESSION SUMMARY:\n${analysisSummary}\n` : ''}

Generate a complete, professionally structured medical report. A real doctor must read this, understand ALL AI reasoning, and be able to use it for clinical decisions.

Include ALL sections:

1. PATIENT SUMMARY
   Demographics, vitals, BMI, lifestyle habits, comorbidities, current medications, allergies

2. PRESENTING COMPLAINTS
   Symptoms reported, onset, severity, duration

3. CLINICAL REASONING
   Step-by-step explanation of how AI arrived at its conclusions (visible to doctor)

4. DIFFERENTIAL DIAGNOSIS
   Each suspected condition with probability % and supporting evidence

5. TEST RESULTS SUMMARY
   Key findings, abnormal values highlighted, what was confirmed vs ruled out

6. FINAL WORKING DIAGNOSIS
   Primary diagnosis + secondary diagnoses (if any)

7. COMPLETE MEDICATION PLAN
   For each drug: Name | Dose | Frequency | Duration | Purpose
   Safety verification per this patient's profile
   "⛔ DRUGS AVOIDED" section — list all excluded drugs with reasons specific to this patient

8. DIETARY & LIFESTYLE PLAN
   Specific to confirmed diagnosis + patient's pre-existing conditions

9. FOLLOW-UP PLAN
   Repeat tests, next appointment, specialist referrals

10. AI CONFIDENCE LEVEL
    Overall confidence % and honest statement of limitations

11. IMPORTANT NOTES FOR TREATING PHYSICIAN
    Anything critical the doctor must know before proceeding with treatment

Write in formal medical language. The report must be print-ready and clinically useful.`;
  }

  // ── GENERAL CHAT ──
  return `You are a knowledgeable, empathetic AI medical assistant who responds like a senior physician.

${ctx}

${contraindicationBlock}

${diagnosisSummary ? `SESSION CONTEXT:\n${diagnosisSummary}` : ''}

Guidelines:
- Answer clearly and precisely like a doctor speaking to a patient.
- When recommending medications, ALWAYS include: drug name, dose, frequency, duration, purpose.
- ALWAYS verify medications against this patient's diseases, current medications, and allergies before recommending.
- If a common drug is unsafe for this patient, name a safe alternative and explain why.
- Be warm, clear, and accurate. Avoid vague answers.`;
}

// ─── Chat Functions ───────────────────────────────────────────────────────────
async function sendMessage(type) {
  const inputId = type === 'diagnose' ? 'diagnoseInput' : type === 'analyse' ? 'analyseInput' : 'chatInput';
  const chatId = type === 'diagnose' ? 'diagnoseChat' : type === 'analyse' ? 'analyseChat' : 'generalChat';
  const input = document.getElementById(inputId);
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  appendMessage(type, 'user', text);
  chatHistories[type].push({ role: 'user', content: text });
  showTyping(chatId);

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: chatHistories[type],
        systemPrompt: getSystemPrompt(type)
      })
    });
    const data = await res.json();
    hideTyping(chatId);
    const reply = data.reply || 'Sorry, I could not get a response.';
    appendMessage(type, 'ai', reply);
    chatHistories[type].push({ role: 'assistant', content: reply });

    if (type === 'diagnose') {
      diagnosisSummary = reply.substring(0, 800);
      // Extract test names from response
      const testMatch = reply.match(/\b(?:CBC|Complete Blood Count|LFT|KFT|RFT|CRP|ESR|TSH|HbA1c|X-?[Rr]ay|MRI|CT scan|Ultrasound|Culture|Biopsy|Urine|Stool|Blood culture|ECG|Echo|Endoscopy|SGOT|SGPT|Serum|Platelet)[^\n]*/gi);
      if (testMatch) {
        sessionStorage.setItem('pendingTests', [...new Set(testMatch)].join('; ').substring(0, 400));
        checkPendingTests();
      }
      saveSession('diagnosis', { symptoms: text, aiResponse: reply });
    }

    if (type === 'analyse') {
      // FIX 5: Store independently, never re-inject into the analyse system prompt
      analysisSummary = reply.substring(0, 800);
      saveSession('analysis', { report: text, aiResponse: reply });
    }

  } catch (err) {
    hideTyping(chatId);
    appendMessage(type, 'ai', '❌ Connection error. Please check that your server is running.');
  }
}

function appendMessage(type, role, text) {
  const chatId = type === 'diagnose' ? 'diagnoseChat' : type === 'analyse' ? 'analyseChat' : 'generalChat';
  const chat = document.getElementById(chatId);
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = `
    <div class="msg-avatar">${role === 'ai' ? 'AI' : '👤'}</div>
    <div class="msg-content">${formatMessage(text)}</div>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function formatMessage(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/⛔/g, '<span style="color:var(--danger)">⛔</span>')
    .replace(/⚠️/g, '<span style="color:var(--warning)">⚠️</span>')
    .replace(/✅/g, '<span style="color:var(--success)">✅</span>')
    .replace(/(\d{1,3}%)/g, (m, pct) => {
      const n = parseInt(pct);
      return `<span class="${n >= 70 ? 'percent-high' : n >= 40 ? 'percent-mid' : 'percent-low'}">${pct}</span>`;
    })
    .replace(/\n/g, '<br>');
}

function showTyping(chatId) {
  const chat = document.getElementById(chatId);
  const div = document.createElement('div');
  div.id = chatId + '-typing';
  div.className = 'chat-msg ai';
  div.innerHTML = `<div class="msg-avatar">AI</div><div class="msg-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function hideTyping(chatId) {
  const t = document.getElementById(chatId + '-typing');
  if (t) t.remove();
}

function handleKey(e, type) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(type); }
}

// ─── File Upload & Analysis ───────────────────────────────────────────────────
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  setLoading(true);
  const formData = new FormData();
  formData.append('report', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    uploadedReportPath = data.path;
    document.getElementById('uploadedFileInfo').style.display = 'flex';
    document.getElementById('uploadedFileInfo').innerHTML =
      `✅ Uploaded: <strong>${file.name}</strong> — Edit the prompt below if needed, then click Send`;

    const pending = sessionStorage.getItem('pendingTests');
    // FIX 5: Present the report file first, pending tests as reference context only
    document.getElementById('analyseInput').value =
      `I have uploaded a medical test report: "${file.name}". Please analyse this report objectively based on the actual values it contains.${pending ? `\n\n(For reference: AI previously suggested tests for: ${pending} — but please let the report values speak for themselves.)` : ''}`;

    showToast('✅ File uploaded! Click Send to analyse.');
  } catch (err) {
    showToast('❌ Upload failed', 'error');
  }
  setLoading(false);
}

function analyseManual() {
  const name = document.getElementById('testName').value;
  const values = document.getElementById('testValues').value;
  if (!values.trim()) { showToast('Please enter test values', 'error'); return; }
  const pending = sessionStorage.getItem('pendingTests');
  // FIX 5: Test values are primary, pending tests are background only
  const prompt = `REPORT TYPE: ${name || 'Medical Test Report'}\n\nTEST VALUES (primary data):\n${values}\n\n${pending ? `(Background reference only — previously suggested tests: ${pending} — interpret the values above independently first)` : 'Please interpret these results objectively.'}`;
  document.getElementById('analyseInput').value = prompt;
  switchAnalyseTab('upload', document.querySelector('#page-analyse .tab'));
  sendMessage('analyse');
}

// ─── Save Session ─────────────────────────────────────────────────────────────
async function saveSession(type, data) {
  if (!currentPatient?._id) return;
  try {
    await fetch(`/api/patients/${currentPatient._id}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data })
    });
    if (!currentPatient.sessions) currentPatient.sessions = [];
    currentPatient.sessions.push({ type, data, createdAt: new Date() });
    sessionStorage.setItem('currentPatient', JSON.stringify(currentPatient));
    renderSessionLog();
  } catch (err) {
    // Silent fail — session save is non-critical
  }
}

// ─── FIX 1 + 3 + 4: Generate Report ─────────────────────────────────────────
async function generateReport() {
  setLoading(true);
  const container = document.getElementById('reportContainer');
  container.innerHTML = '<div style="text-align:center;color:var(--text2);padding:2rem;">⏳ Generating comprehensive clinical report...</div>';

  const p = currentPatient;
  // FIX 1: Always safe-read arrays for report table
  const pdiseases = Array.isArray(p.underlyingDiseases) ? p.underlyingDiseases : [];
  const pmeds = Array.isArray(p.medications) ? p.medications : [];
  const bmi = (p.weight && p.height)
    ? (p.weight / ((p.height / 100) ** 2)).toFixed(1)
    : 'N/A';

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: 'Generate the complete formal clinical medical report for this patient. Include a full medication plan with doses, frequencies, durations, contraindication notes, and a dedicated section listing all drugs avoided for this patient and why.'
        }],
        systemPrompt: getSystemPrompt('report')
      })
    });
    const data = await res.json();

    container.innerHTML = `
      <div class="report-container" id="printableReport">
        <div class="report-header">
          <h1>🏥 MediAI Clinical Report</h1>
          <p>AI-Generated Medical Assessment — For Physician Review Only</p>
          <p>Generated: ${new Date().toLocaleString('en-IN')} &nbsp;|&nbsp; Report ID: RPT-${Date.now().toString(36).toUpperCase()}</p>
        </div>

        <div class="report-section">
          <h3>Patient Information</h3>
          <table class="report-table">
            <tr>
              <td class="label">Full Name</td><td>${p.name}</td>
              <td class="label">Age / Gender</td><td>${p.age} yrs / ${p.gender}</td>
            </tr>
            <tr>
              <td class="label">Blood Group</td><td>${p.bloodGroup || 'N/A'}</td>
              <td class="label">Location</td><td>${p.location}</td>
            </tr>
            <tr>
              <td class="label">Weight / Height</td><td>${p.weight || 'N/A'} kg / ${p.height || 'N/A'} cm</td>
              <td class="label">BMI</td><td>${bmi}</td>
            </tr>
            <tr>
              <td class="label">Smoking / Alcohol</td>
              <td colspan="3">${p.smoking || 'N/A'} / ${p.alcohol || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Underlying Diseases</td>
              <td colspan="3" style="color:${pdiseases.length ? '#c0392b' : 'inherit'};font-weight:${pdiseases.length ? '600' : 'normal'}">
                ${pdiseases.length > 0 ? pdiseases.join(', ') : 'None reported'}
              </td>
            </tr>
            <tr>
              <td class="label">Current Medications</td>
              <td colspan="3">${pmeds.length > 0 ? pmeds.join(', ') : 'None reported'}</td>
            </tr>
            <tr>
              <td class="label">Known Allergies</td>
              <td colspan="3" style="color:${p.allergies ? '#c0392b' : 'inherit'};font-weight:${p.allergies ? '600' : 'normal'}">
                ${p.allergies || 'None reported'}
              </td>
            </tr>
            <tr>
              <td class="label">Emergency Contact</td>
              <td colspan="3">${p.emergencyContact || 'N/A'}</td>
            </tr>
          </table>
        </div>

        <div class="report-section">
          <h3>AI Clinical Assessment & Recommendations</h3>
          <div style="font-size:0.9rem;line-height:1.9;white-space:pre-wrap;">${formatReportText(data.reply)}</div>
        </div>

        <div class="report-section" style="margin-top:2rem;padding-top:1rem;border-top:2px solid #0a6ef5;font-size:0.78rem;color:#666;">
          <strong>⚠️ IMPORTANT DISCLAIMER:</strong> This report is AI-generated and is intended solely to assist qualified medical professionals. It does NOT replace clinical examination, professional judgment, or laboratory confirmation. All diagnoses, medication recommendations, and treatment plans MUST be verified and approved by a licensed physician before implementation. Emergency symptoms require immediate in-person medical attention.
        </div>
      </div>`;

    saveSession('report', { aiResponse: data.reply });
  } catch (err) {
    container.innerHTML = '<div class="alert alert-warning">❌ Failed to generate report. Please try again.</div>';
  }
  setLoading(false);
}

function formatReportText(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/⛔/g, '<span style="color:#c0392b;font-weight:bold">⛔</span>')
    .replace(/⚠️/g, '<span style="color:#d97706;font-weight:bold">⚠️</span>')
    .replace(/✅/g, '<span style="color:#16a34a;font-weight:bold">✅</span>')
    .replace(/(\d{1,3}%)/g, (m, pct) => {
      const n = parseInt(pct);
      const color = n >= 70 ? '#c0392b' : n >= 40 ? '#d97706' : '#16a34a';
      return `<span style="font-weight:bold;color:${color}">${pct}</span>`;
    })
    .replace(/\n/g, '<br>');
}

function printReport() {
  const content = document.getElementById('printableReport');
  if (!content) { showToast('Generate report first!', 'error'); return; }
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>MediAI Clinical Report</title>
  <style>
    body { font-family: 'Times New Roman', serif; padding: 2.5rem; color: #111; }
    h1 { color: #0a6ef5; font-size: 1.6rem; }
    h3 { color: #0a6ef5; border-bottom: 1px solid #ccc; padding-bottom: 5px; text-transform: uppercase; font-size: 0.92rem; letter-spacing: 0.5px; margin-top: 1.5rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; margin-bottom: 1rem; }
    td { padding: 7px 10px; border: 1px solid #ddd; vertical-align: top; }
    .label { font-weight: bold; background: #f0f4ff; width: 22%; }
    .report-header { text-align: center; border-bottom: 2px solid #0a6ef5; padding-bottom: 1rem; margin-bottom: 1.5rem; }
    .report-header p { color: #555; font-size: 0.85rem; margin: 2px 0; }
    .report-section { margin-bottom: 1.5rem; }
  </style></head><body>${content.innerHTML}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

function clearSession() {
  if (confirm('End this patient session and return to home?')) {
    sessionStorage.clear();
    window.location.href = 'index.html';
  }
}