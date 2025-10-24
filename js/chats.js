// js/chats.js — Parte 1/5
document.addEventListener('DOMContentLoaded', () => {
  /* =========================
     Datos de ejemplo
  ========================== */
  const conversations = {
    ana: [
      { me:false, text:"¿Listos para mañana?", time:"10:10 p.m." },
      { me:true,  text:"¡Sí! Paso por ti a las 7", time:"10:11 p.m." },
      { me:false, text:"Perfecto ✌️", time:"10:12 p.m." },
    ],
    grupo: [
      // En grupos, para mensajes de otros: user y gems
      { me:false, user:"Alex",  gems: 123, text:"Nos juntamos hoy o qué?", time:"9:40 p.m." },
      { me:true,                       text:"Yo llego tipo 8:30",       time:"9:41 p.m." },
      { me:false, user:"Diego", gems: 345, text:"Va, llevo snacks 🥤",    time:"9:42 p.m." },
    ],
    diego: [
      { me:false, text:"Bro, el parley está listo", time:"9:10 p.m." },
      { me:true,  text:"Buenísimo. Pásalo al grupo", time:"9:11 p.m." },
    ],
  };

  /* =========================
     Selectores comunes
  ========================== */
  const listItems   = document.querySelectorAll('.chatitem');
  const promo       = document.getElementById('placeholderPromo');
  const convo       = document.getElementById('conversation');
  const convName    = document.getElementById('convName');
  const convAvatar  = document.getElementById('convAvatar');
  const convBody    = document.getElementById('convBody');
  const msgInput    = document.getElementById('msgInput');
  const sendBtn     = document.getElementById('sendBtn');
  const convBack    = document.getElementById('convBack');
  const btnHome     = document.getElementById('btnHome');

  // Acciones de cabecera conversación
  const btnVideo    = document.getElementById('btnVideo');
  const btnMore     = document.getElementById('btnMore');
  const chatMenu    = document.getElementById('chatMenu');
  const mEncrypt    = document.getElementById('mEncrypt');
  const mTasks      = document.getElementById('mTasks');
  const mAdd        = document.getElementById('mAdd');
  const mEmail      = document.getElementById('mEmail');

  // Menú usuario
  const btnUserMenu   = document.getElementById('btnUserMenu');
  const dropdown      = document.getElementById('userDropdown');
  const btnEncrypt    = document.getElementById('btnEncrypt');
  const btnLogoutMenu = document.getElementById('btnLogoutMenu');

  // Modal de confirmación (Bootstrap)
  const confirmModalEl = document.getElementById('confirmModal');
  const bsConfirmModal = new bootstrap.Modal(confirmModalEl);
  const confirmMsgEl   = document.getElementById('confirmMessage');
  const confirmOkBtn   = document.getElementById('confirmOk');

  // Adjuntos (+)
  const btnAttach   = document.getElementById('btnAttach');
  const attachMenu  = document.getElementById('attachMenu');
  const attachImage = document.getElementById('attachImage');
  const attachFile  = document.getElementById('attachFile');
  const attachLocation = document.getElementById('attachLocation');
  const fileImage   = document.getElementById('fileImage');
  const fileAny     = document.getElementById('fileAny');

  // Sidepanel (drawer derecho)
  const sidePanel   = document.getElementById('sidePanel');
  const spTitle     = document.getElementById('spTitle');
  const spClose     = document.getElementById('spClose');
  const spTasksBody = document.getElementById('spTasks');
  const spAddBody   = document.getElementById('spAdd');
  const spEmailBody = document.getElementById('spEmail');

  // Tareas
  const taskCreateForm = document.getElementById('taskCreateForm');
  const taskInput      = document.getElementById('taskInput');
  const taskList       = document.getElementById('taskList');
  const taskConfirmBtn = document.getElementById('taskConfirmBtn');

  // Agregar miembro
  const addForm   = document.getElementById('addForm');
  const addInput  = document.getElementById('addInput');
  const addedList = document.getElementById('addedList');

  // Email
  const emailForm   = document.getElementById('emailForm');
  const emailDesc   = document.getElementById('emailDesc');
  const sendEmailBtn = document.getElementById('sendEmailBtn');

  // Estado
  let currentChatId   = null;
  let currentChatType = 'private';

  // Estado demo por chat (tareas por grupo)
  const tasksByChat = {
    grupo: [
      { id: 1, text: "Definir ranking de poder (48 equipos)", done:false },
      { id: 2, text: "Diseñar pantallas en Figma", done:false },
      { id: 3, text: "Documentar reglas del simulador", done:false },
      { id: 4, text: "Subir maquetado al repositorio", done:false },
    ]
  };
  const addedMembers = []; // pila de añadidos (demo)

  /* =========================
     Cargar grupos creados (localStorage)
  ========================== */
  (function loadUserCreatedData(){
    try {
      const extraGroups = JSON.parse(localStorage.getItem('created_groups') || '[]');
      const extraConvs  = JSON.parse(localStorage.getItem('created_conversations') || '{}');
      const chatlist    = document.querySelector('.chatlist');

      // Mergear conversaciones
      Object.keys(extraConvs).forEach(k => {
        if (!conversations[k]) conversations[k] = extraConvs[k];
      });

      // Pinta grupos nuevos en sidebar
      extraGroups.forEach(g => {
        if (chatlist.querySelector(`[data-chat="${g.id}"]`)) return;
        const a = document.createElement('a');
        a.className = 'chatitem';
        a.href = '#';
        a.dataset.chat = g.id;
        a.dataset.name = g.name;
        a.dataset.type = 'group';
        a.innerHTML = `
          <div class="avatar grp">👥</div>
          <div class="meta">
            <div class="row1"><span class="name">${g.name}</span><time></time></div>
            <div class="row2"><span class="preview">Nuevo grupo creado</span></div>
          </div>`;
        chatlist.appendChild(a);
        a.addEventListener('click', (e) => {
          e.preventDefault();
          document.querySelectorAll('.chatitem.active').forEach(el => el.classList.remove('active'));
          a.classList.add('active');
          openConversation(g.id, g.name, 'group');
        });
      });

      // Abrir automáticamente el último creado
      const openId = localStorage.getItem('open_group_id');
      if (openId) {
        const item = chatlist.querySelector(`[data-chat="${openId}"]`);
        if (item) {
          item.classList.add('active');
          openConversation(openId, item.dataset.name, 'group');
        }
        localStorage.removeItem('open_group_id');
      }
    } catch(e){
      console.warn('No pude cargar grupos creados:', e);
    }
  })();

    /* =========================
     Helpers de UI
  ========================== */
  function openConfirm(message, onConfirm){
    confirmMsgEl.textContent = message;
    const handler = () => {
      try { onConfirm && onConfirm(); }
      finally {
        confirmOkBtn.removeEventListener('click', handler);
        bsConfirmModal.hide();
      }
    };
    confirmOkBtn.addEventListener('click', handler);
    bsConfirmModal.show();
  }

  // Render con soporte de "cabecera" en grupos (nombre + gemas)
  function renderMessages(arr){
    const last = (arr || []).slice(-30);
    convBody.innerHTML = '';

    last.forEach(m => {
      const wrap = document.createElement('div');
      wrap.className = 'msg ' + (m.me ? 'msg-me' : 'msg-peer');

      let inner = '';

      // Si es grupo y el mensaje NO es mío: mostrar nombre + gemas
      if (currentChatType === 'group' && !m.me) {
        const gems = (typeof m.gems === 'number') ? m.gems : 0;
        const name = m.user || 'Miembro';
        inner += `
          <div class="msg-head" style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <strong>${name}</strong>
            <span class="gems" style="display:inline-flex;align-items:center;gap:6px;font-weight:800;">
              <img src="assets/img/gema.png" alt="Gema" style="width:18px;height:18px;object-fit:contain;">
              ${gems}
            </span>
          </div>
        `;
      }

      inner += `${m.text}<span class="time">${m.time || ''}</span>`;
      wrap.innerHTML = inner;
      convBody.appendChild(wrap);
    });

    convBody.scrollTop = convBody.scrollHeight;
  }

  // Sidepanel helpers
  function openSidePanel(mode){
    // mode: "tasks" | "add" | "email"
    document.querySelector('.panel')?.classList.add('narrow');
    sidePanel.hidden = false;

    spTasksBody.hidden = true;
    spAddBody.hidden = true;
    spEmailBody.hidden = true;

    if (mode === 'tasks'){
      spTitle.textContent = 'Administrador de tareas';
      spTasksBody.hidden = false;
      renderTasks();
      taskInput?.focus();
    } else if (mode === 'add'){
      spTitle.textContent = 'Agregar integrante';
      spAddBody.hidden = false;
      addInput?.focus();
      renderAdded();
    } else if (mode === 'email'){
      spTitle.textContent = 'Enviar Correo';
      spEmailBody.hidden = false;
      emailDesc?.focus();
    }
  }

  function closeSidePanel(){
    sidePanel.hidden = true;
    document.querySelector('.panel')?.classList.remove('narrow');
  }

  // Render tareas del chat actual (si es grupo)
  function renderTasks(){
    const items = tasksByChat[currentChatId] || [];
    taskList.innerHTML = '';
    items.forEach(t => {
      const row = document.createElement('label');
      row.className = 'sp-task';
      row.innerHTML = `
        <input type="checkbox" ${t.done ? 'checked' : ''} data-id="${t.id}">
        <div>${t.text}</div>
      `;
      taskList.appendChild(row);
    });
  }

  function renderAdded(){
    addedList.innerHTML = '';
    addedMembers.forEach((m, idx) => {
      const div = document.createElement('div');
      div.className = 'sp-task';
      div.innerHTML = `<div style="grid-column:1 / span 2;">${idx+1}. ${m}</div>`;
      addedList.appendChild(div);
    });
  }

  function openConversation(chatId, name, type){
    currentChatId   = chatId;
    currentChatType = type || 'private';

    convName.textContent   = name || 'Chat';
    convAvatar.textContent = (name || 'C').charAt(0).toUpperCase();

    // Subtítulo debajo del nombre
    const convSub = document.querySelector('.conv-sub');
    if (currentChatType === 'private') {
      convSub.textContent = 'en línea';
    } else {
      // Demo: muestra “Diego está activo”
      convSub.textContent = 'Diego está activo';
    }

    // Mostrar/ocultar acciones según tipo
    btnVideo.hidden = currentChatType !== 'private';
    mAdd.hidden     = currentChatType !== 'group';
    mEmail.hidden   = currentChatType !== 'private';


    // Cerrar menú de acciones si estaba abierto
    if (!chatMenu.hasAttribute('hidden')) {
      chatMenu.setAttribute('hidden', '');
      btnMore.setAttribute('aria-expanded', 'false');
    }

    promo.hidden = true;
    convo.hidden = false;

    // si el panel está abierto y era de tareas, refrescar/cerrar según tipo
    if (!sidePanel.hidden){
      if (currentChatType === 'group' && !spTasksBody.hidden) {
        renderTasks();
      } else if (currentChatType !== 'group' && !spTasksBody.hidden) {
        closeSidePanel();
      }
    }

    renderMessages(conversations[chatId] || []);
    msgInput.focus();
  }

  function closeConversationToPromo(){
    convo.hidden = true;
    promo.hidden = false;
    document.querySelectorAll('.chatitem.active').forEach(el => el.classList.remove('active'));
    currentChatId = null;
  }

    /* =========================
     Listeners: lista de chats
  ========================== */
  listItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.chatitem.active').forEach(el => el.classList.remove('active'));
      item.classList.add('active');

      const id   = item.dataset.chat;
      const name = item.dataset.name || 'Chat';
      const type = item.dataset.type || 'private';
      openConversation(id, name, type);
    });
  });

  /* =========================
     Composer
  ========================== */
  function sendMessage(){
    const text = msgInput.value.trim();
    if (!text || !currentChatId) return;

    const time = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    conversations[currentChatId] = conversations[currentChatId] || [];
    conversations[currentChatId].push({ me:true, text, time });
    renderMessages(conversations[currentChatId]);

    msgInput.value = '';
    msgInput.focus();
  }

  sendBtn?.addEventListener('click', sendMessage);
  msgInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  convBack?.addEventListener('click', closeConversationToPromo);

  /* =========================
     Header actions
  ========================== */
  btnHome?.addEventListener('click', () => location.reload());

  btnVideo?.addEventListener('click', () => {
    if (currentChatType !== 'private') return;
    openConfirm('¿Iniciar videollamada?', () => {
      console.log('Iniciando videollamada (demo)…');
    });
  });

  /* =========================
     Menú de acciones del chat (tres líneas)
     -> listeners globales
  ========================== */
  btnMore?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !chatMenu.hasAttribute('hidden');
    if (isOpen) {
      chatMenu.setAttribute('hidden', '');
      btnMore.setAttribute('aria-expanded', 'false');
    } else {
      chatMenu.removeAttribute('hidden');
      btnMore.setAttribute('aria-expanded', 'true');
    }
  });

  // Cerrar al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!chatMenu) return;
    if (!chatMenu.hasAttribute('hidden')) {
      const inside = chatMenu.contains(e.target) || btnMore?.contains(e.target);
      if (!inside) {
        chatMenu.setAttribute('hidden', '');
        btnMore?.setAttribute('aria-expanded', 'false');
      }
    }
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chatMenu && !chatMenu.hasAttribute('hidden')) {
      chatMenu.setAttribute('hidden', '');
      btnMore?.setAttribute('aria-expanded', 'false');
    }
  });

  // Acciones del menú → abrir sidepanel sin que el click global lo cierre
  mEncrypt?.addEventListener('click', (e) => {
    e.stopPropagation();
    chatMenu.setAttribute('hidden','');
    btnMore?.setAttribute('aria-expanded','false');
    openConfirm('¿Cifrar este chat?', () => console.log('🔒 Chat cifrado (demo)'));
  });

  mTasks?.addEventListener('click', (e) => {
    e.stopPropagation();                         // evita cierre inmediato
    chatMenu.setAttribute('hidden','');
    btnMore?.setAttribute('aria-expanded','false');
    setTimeout(() => openSidePanel('tasks'), 0); // abre en el siguiente tick
  });

  mAdd?.addEventListener('click', (e) => {
    e.stopPropagation();                         // evita cierre inmediato
    chatMenu.setAttribute('hidden','');
    btnMore?.setAttribute('aria-expanded','false');
    setTimeout(() => openSidePanel('add'), 0);   // abre en el siguiente tick
  });

  mEmail?.addEventListener('click', (e) => {
    e.stopPropagation();                         // evita cierre inmediato
    chatMenu.setAttribute('hidden','');
    btnMore?.setAttribute('aria-expanded','false');
    setTimeout(() => openSidePanel('email'), 0);   // abre en el siguiente tick
  });

    /* =========================
     Menú usuario (avatar)
  ========================== */
  function closeUserMenu(){
    if (!dropdown) return;
    if (!dropdown.hasAttribute('hidden')) {
      dropdown.setAttribute('hidden', '');
      btnUserMenu?.setAttribute('aria-expanded', 'false');
    }
  }
  function toggleUserMenu(e){
    e?.stopPropagation();
    if (!dropdown) return;
    const open = !dropdown.hasAttribute('hidden');
    if (open) closeUserMenu();
    else {
      dropdown.removeAttribute('hidden');
      btnUserMenu?.setAttribute('aria-expanded', 'true');
    }
  }

  btnUserMenu?.addEventListener('click', toggleUserMenu);

  document.addEventListener('click', (e) => {
    if (!dropdown) return;
    const inside = dropdown.contains(e.target) || btnUserMenu?.contains(e.target);
    if (!inside) closeUserMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeUserMenu();
  });

  btnEncrypt?.addEventListener('click', () => {
    closeUserMenu();
    openConfirm('¿Seguro que quieres cifrar los chats? Ocultará todos los mensajes.', () => {
      console.log('✅ Chats cifrados (demo)');
    });
  });

  btnLogoutMenu?.addEventListener('click', () => {
    closeUserMenu();
    openConfirm('¿Deseas cerrar sesión?', () => {
      window.location.href = 'index.html';
    });
  });

  /* =========================
     Adjuntos (+): menú Documento / Foto
  ========================== */
  btnAttach?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !attachMenu.hasAttribute('hidden');
    if (open) attachMenu.setAttribute('hidden','');
    else attachMenu.removeAttribute('hidden');
  });

  // Cerrar menú de adjuntos al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!attachMenu) return;
    if (!attachMenu.hasAttribute('hidden')) {
      const inside = attachMenu.contains(e.target) || btnAttach?.contains(e.target);
      if (!inside) attachMenu.setAttribute('hidden','');
    }
  });

  // Opciones del menú
  attachImage?.addEventListener('click', () => {
    attachMenu.setAttribute('hidden','');
    fileImage?.click();
  });
  attachFile?.addEventListener('click', () => {
    attachMenu.setAttribute('hidden','');
    fileAny?.click();
  });

  // Nueva opción: Ubicación
  attachLocation?.addEventListener('click', () => {
    attachMenu.setAttribute('hidden','');
    const time = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const locationUrl = 'https://www.google.com/maps/place/Apodaca,+N.L./@25.7959952,-100.2709194,12z';
    const messageText = `📍 Ubicación: [Apodaca, N.L.](${locationUrl})`;
    conversations[currentChatId] = conversations[currentChatId] || [];
    conversations[currentChatId].push({ me:true, text: messageText, time });
    renderMessages(conversations[currentChatId]);
  });


  // Al seleccionar archivo/imagen, simula un mensaje en el chat
  fileImage?.addEventListener('change', (e) => {
    if (!e.target.files?.length || !currentChatId) return;
    const f = e.target.files[0];
    const time = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    conversations[currentChatId] = conversations[currentChatId] || [];
    conversations[currentChatId].push({ me:true, text:`📷 Imagen: ${f.name}`, time });
    renderMessages(conversations[currentChatId]);
    e.target.value = '';
  });

  fileAny?.addEventListener('change', (e) => {
    if (!e.target.files?.length || !currentChatId) return;
    const f = e.target.files[0];
    const time = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    conversations[currentChatId] = conversations[currentChatId] || [];
    conversations[currentChatId].push({ me:true, text:`📎 Archivo: ${f.name}`, time });
    renderMessages(conversations[currentChatId]);
    e.target.value = '';
  });

  // Tooltip demo (si lo usas)
  const btnCreateGroup = document.getElementById('btnCreateGroup');
  if (btnCreateGroup && typeof bootstrap?.Tooltip === 'function') {
    try { new bootstrap.Tooltip(btnCreateGroup, { placement:'right' }); } catch {}
  }

    /* =========================
     Sidepanel: cerrar, click-fuera, Escape
  ========================== */
  spClose?.addEventListener('click', closeSidePanel);

  document.addEventListener('click', (e) => {
    if (sidePanel.hidden) return;
    // si el click fue en el menú del chat, no cierres el panel
    if (chatMenu && chatMenu.contains(e.target)) return;
    const inside = sidePanel.contains(e.target) || btnMore?.contains(e.target);
    if (!inside) closeSidePanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sidePanel.hidden) closeSidePanel();
  });

  /* =========================
     Lógica de tareas (crear, marcar, confirmar)
  ========================== */
  taskCreateForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const txt = taskInput.value.trim();
    if (!txt) return;
    const arr = tasksByChat[currentChatId] || (tasksByChat[currentChatId] = []);
    const nextId = (arr.at(-1)?.id || 0) + 1;
    arr.push({ id: nextId, text: txt, done:false });
    taskInput.value = '';
    renderTasks();
  });

  taskList?.addEventListener('change', (e) => {
    const id = Number(e.target.getAttribute('data-id'));
    if (!id) return;
    const arr = tasksByChat[currentChatId] || [];
    const item = arr.find(x => x.id === id);
    if (item) item.done = e.target.checked;
  });

  taskConfirmBtn?.addEventListener('click', () => {
    const arr = tasksByChat[currentChatId] || [];
    const doneCount = arr.filter(x => x.done).length;
    // Borra las realizadas (demo)
    tasksByChat[currentChatId] = arr.filter(x => !x.done);
    renderTasks();
    openConfirm(`Se confirmaron ${doneCount} tareas realizadas.`, () => {});
  });

  /* =========================
     Lógica “Agregar a alguien”
  ========================== */
  addForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = addInput.value.trim();
    if (!val) return;
    addedMembers.push(val);
    addInput.value = '';
    renderAdded();
    openConfirm('Se envió invitación para unirse al chat.', () => {});
  });

  /* =========================
     Lógica de "Enviar Correo"
  ========================== */
  emailForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('emailInput').value;
    const desc = emailDesc.value.trim();

    if (!desc) {
      alert('Por favor, escribe una descripción.');
      return;
    }

    // Simular envío
    const message = `📧 Correo enviado a ${email}: "${desc}"`;
    const time = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    conversations[currentChatId] = conversations[currentChatId] || [];
    conversations[currentChatId].push({ me:true, text: message, time });
    renderMessages(conversations[currentChatId]);

    // Limpiar y cerrar
    emailDesc.value = '';
    closeSidePanel();
    openConfirm(`Correo enviado a ${email}`, () => {});
  });

});