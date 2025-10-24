/**
 * chats.js - VERSIÓN CON TIEMPO REAL INTEGRADO
 * Sistema de chat con mensajes en tiempo real
 */

/* =========================
   SISTEMA DE TIEMPO REAL
========================== */
const realtimeChat = new RealtimeChat('/api/messages.php');
let currentChatPolling = null;
let encryptionEnabled = false;

// Handler para actualizaciones de mensajes no leídos
realtimeChat.onUnreadUpdate = (data) => {
  const badge = document.querySelector('.notification-badge');
  if (badge) {
    badge.textContent = data.total;
    badge.hidden = data.total === 0;
  }
};

/* =========================
   VARIABLES GLOBALES
========================== */
let currentChatId = null;
let currentChatType = null; // 'private' o 'group'
let conversations = JSON.parse(localStorage.getItem('conversations') || '{}');

// Estructura de datos para tareas y miembros
const tasksByChat = {};
const addedMembers = [];

/* =========================
   ELEMENTOS DEL DOM
========================== */
const chatlist = document.getElementById('chatlist');
const conversation = document.getElementById('conversation');
const convHeader = document.querySelector('.conv-header');
const convBody = document.querySelector('.conv-body');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const convBack = document.getElementById('convBack');

// Botones del header
const btnHome = document.getElementById('btnHome');
const btnVideo = document.getElementById('btnVideo');
const btnMore = document.getElementById('btnMore');

// Menú contextual del chat
const chatMenu = document.getElementById('chatMenu');
const mEncrypt = document.getElementById('mEncrypt');
const mTasks = document.getElementById('mTasks');
const mAddMember = document.getElementById('mAddMember');
const mEmail = document.getElementById('mEmail');

// Side panel
const sidePanel = document.getElementById('sidePanel');
const spClose = document.getElementById('spClose');
const spTitle = document.getElementById('spTitle');
const spTasksBody = document.getElementById('spTasksBody');
const spAddBody = document.getElementById('spAddBody');
const spEmailBody = document.getElementById('spEmailBody');

// Elementos de tareas
const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');

// Elementos de agregar miembros
const addInput = document.getElementById('addInput');
const addMemberBtn = document.getElementById('addMemberBtn');
const addedList = document.getElementById('addedList');

// Elementos de email
const emailDesc = document.getElementById('emailDesc');
const sendEmailBtn = document.getElementById('sendEmailBtn');

// Modal de confirmación
const confirmModal = document.getElementById('confirmModal');
const confirmMsgEl = document.getElementById('confirmMsg');
const confirmOkBtn = document.getElementById('confirmOk');
const confirmCancelBtn = document.getElementById('confirmCancel');
const bsConfirmModal = new bootstrap.Modal(confirmModal);

/* =========================
   INICIALIZACIÓN
========================== */
document.addEventListener('DOMContentLoaded', () => {
  loadChats();
  setupEventListeners();
  
  // Solicitar permisos de notificación
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
});

/* =========================
   CARGAR LISTA DE CHATS
========================== */
async function loadChats() {
  try {
    // Cargar usuarios para chats privados
    const usersResponse = await fetch('/api/users.php?action=list');
    const usersData = await usersResponse.json();
    
    if (usersData.success) {
      usersData.users.forEach(user => {
        createChatItem(user.id, user.username, 'private', user.avatar_url);
      });
    }
    
    // Cargar grupos
    const groupsResponse = await fetch('/api/groups.php?action=my_groups');
    const groupsData = await groupsResponse.json();
    
    if (groupsData.success) {
      groupsData.groups.forEach(group => {
        createChatItem(group.id, group.name, 'group', group.avatar_url);
      });
    }
  } catch (error) {
    console.error('Error cargando chats:', error);
  }
}

function createChatItem(id, name, type, avatarUrl = null) {
  const chatItem = document.createElement('a');
  chatItem.href = '#';
  chatItem.className = 'chatitem';
  chatItem.dataset.chat = `${type}-${id}`;
  chatItem.dataset.name = name;
  chatItem.dataset.type = type;
  
  const avatar = avatarUrl || 'assets/img/default-avatar.png';
  
  chatItem.innerHTML = `
    <img src="${avatar}" alt="${name}" class="avatar" onerror="this.src='assets/img/default-avatar.png'">
    <div class="chatinfo">
      <div class="row1">
        <h3>${name}</h3>
        <span class="time">•</span>
      </div>
      <div class="row2">
        <span class="preview">${type === 'group' ? '👥 Grupo' : 'Chat privado'}</span>
      </div>
    </div>
  `;
  
  chatItem.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.chatitem.active').forEach(el => el.classList.remove('active'));
    chatItem.classList.add('active');
    openConversation(id, name, type);
  });
  
  chatlist.appendChild(chatItem);
}

/* =========================
   ABRIR CONVERSACIÓN
========================== */
function openConversation(id, name, type) {
  currentChatId = id;
  currentChatType = type;
  
  // Actualizar UI
  convHeader.querySelector('.title').textContent = name;
  chatlist.hidden = true;
  conversation.hidden = false;
  
  // Mostrar/ocultar botón de videollamada (solo privados)
  if (btnVideo) {
    btnVideo.style.display = type === 'private' ? 'block' : 'none';
  }
  
  // Detener polling del chat anterior
  if (currentChatPolling) {
    realtimeChat.stopChat(currentChatPolling);
  }
  
  // Cargar mensajes del localStorage como backup
  const localMessages = conversations[`${type}-${id}`] || [];
  renderMessages(localMessages);
  
  // Iniciar chat en tiempo real
  currentChatPolling = id;
  realtimeChat.startChat(id, type, handleNewMessages);
  
  // Scroll y focus
  convBody.scrollTop = convBody.scrollHeight;
  msgInput.focus();
}

/* =========================
   MANEJAR MENSAJES NUEVOS
========================== */
function handleNewMessages(newMessages) {
  if (!newMessages || newMessages.length === 0) return;
  
  const chatKey = `${currentChatType}-${currentChatId}`;
  conversations[chatKey] = conversations[chatKey] || [];
  
  newMessages.forEach(msg => {
    // Evitar duplicados
    const exists = conversations[chatKey].some(m => m.id === msg.id);
    if (exists) return;
    
    // Descifrar si es necesario
    let messageText = msg.message;
    if (msg.encrypted) {
      messageText = ChatUtils.decrypt(messageText);
    }
    
    // Agregar al array local
    conversations[chatKey].push({
      id: msg.id,
      me: msg.is_mine,
      text: messageText,
      time: ChatUtils.formatTime(msg.sent_at),
      user: msg.sender.username,
      gems: msg.sender.gems,
      type: msg.type,
      file_url: msg.file_url
    });
    
    // Si no es mi mensaje, notificar
    if (!msg.is_mine) {
      ChatUtils.playNotificationSound();
      
      if (document.hidden) {
        const chatName = currentChatType === 'group' 
          ? convHeader.querySelector('.title').textContent 
          : msg.sender.username;
        
        ChatUtils.showNotification(
          `Mensaje de ${msg.sender.username}`,
          messageText,
          msg.sender.avatar_url
        );
      }
    }
  });
  
  // Guardar en localStorage
  localStorage.setItem('conversations', JSON.stringify(conversations));
  
  // Re-renderizar
  renderMessages(conversations[chatKey]);
  
  // Auto-scroll si está cerca del final
  const isNearBottom = convBody.scrollHeight - convBody.scrollTop - convBody.clientHeight < 100;
  if (isNearBottom) {
    convBody.scrollTop = convBody.scrollHeight;
  }
}

/* =========================
   RENDERIZAR MENSAJES
========================== */
function renderMessages(arr) {
  const last = (arr || []).slice(-50);
  convBody.innerHTML = '';
  
  last.forEach(m => {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + (m.me ? 'msg-me' : 'msg-peer');
    
    let inner = '';
    
    // Si es grupo y NO es mío, mostrar nombre + gemas
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
    
    // Contenido del mensaje
    if (m.type === 'image' && m.file_url) {
      inner += `<img src="${m.file_url}" alt="Imagen" style="max-width:200px;border-radius:8px;margin-bottom:5px;">`;
    }
    
    inner += `${ChatUtils.escapeHtml(m.text)}<span class="time">${m.time || ''}</span>`;
    wrap.innerHTML = inner;
    convBody.appendChild(wrap);
  });
  
  convBody.scrollTop = convBody.scrollHeight;
}

/* =========================
   ENVIAR MENSAJE
========================== */
async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !currentChatId) return;
  
  msgInput.disabled = true;
  sendBtn.disabled = true;
  
  try {
    // Cifrar si está habilitado
    const messageToSend = encryptionEnabled ? ChatUtils.encrypt(text) : text;
    
    // Enviar a través de la API
    const result = await realtimeChat.sendMessage(
      currentChatId, 
      currentChatType, 
      messageToSend,
      {
        type: 'text',
        encrypted: encryptionEnabled
      }
    );
    
    if (result.success) {
      // Agregar localmente (optimistic update)
      const chatKey = `${currentChatType}-${currentChatId}`;
      const time = ChatUtils.formatTime(result.sentAt);
      conversations[chatKey] = conversations[chatKey] || [];
      conversations[chatKey].push({ 
        id: result.messageId,
        me: true, 
        text, 
        time,
        type: 'text'
      });
      
      localStorage.setItem('conversations', JSON.stringify(conversations));
      renderMessages(conversations[chatKey]);
      
      msgInput.value = '';
    } else {
      throw new Error(result.error || 'Error enviando mensaje');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('No se pudo enviar el mensaje', 'error');
  } finally {
    msgInput.disabled = false;
    sendBtn.disabled = false;
    msgInput.focus();
  }
}

/* =========================
   CERRAR CONVERSACIÓN
========================== */
function closeConversationToPromo() {
  // Detener polling
  if (currentChatPolling) {
    realtimeChat.stopChat(currentChatPolling);
    currentChatPolling = null;
  }
  
  currentChatId = null;
  currentChatType = null;
  chatlist.hidden = false;
  conversation.hidden = true;
  closeSidePanel();
}

/* =========================
   EVENT LISTENERS
========================== */
function setupEventListeners() {
  // Enviar mensaje
  sendBtn?.addEventListener('click', sendMessage);
  msgInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Volver
  convBack?.addEventListener('click', closeConversationToPromo);
  
  // Home
  btnHome?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  
  // Videollamada
  btnVideo?.addEventListener('click', () => {
    if (currentChatType !== 'private') return;
    openConfirm('¿Iniciar videollamada?', () => {
      console.log('Iniciando videollamada...');
      // TODO: Implementar videollamada
    });
  });
  
  // Menú de opciones
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
  
  // Cerrar menú al hacer click fuera
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
  
  // Cerrar menú con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chatMenu && !chatMenu.hasAttribute('hidden')) {
      chatMenu.setAttribute('hidden', '');
      btnMore?.setAttribute('aria-expanded', 'false');
    }
  });
  
  // Opciones del menú
  mEncrypt?.addEventListener('click', (e) => {
    e.stopPropagation();
    chatMenu.setAttribute('hidden', '');
    encryptionEnabled = !encryptionEnabled;
    showToast(
      encryptionEnabled ? 'Cifrado activado' : 'Cifrado desactivado',
      'success'
    );
  });
  
  mTasks?.addEventListener('click', (e) => {
    e.stopPropagation();
    chatMenu.setAttribute('hidden', '');
    if (currentChatType === 'group') {
      openSidePanel('tasks');
    } else {
      showToast('Las tareas solo están disponibles en grupos', 'info');
    }
  });
  
  mAddMember?.addEventListener('click', (e) => {
    e.stopPropagation();
    chatMenu.setAttribute('hidden', '');
    if (currentChatType === 'group') {
      openSidePanel('add');
    } else {
      showToast('Solo puedes agregar miembros en grupos', 'info');
    }
  });
  
  mEmail?.addEventListener('click', (e) => {
    e.stopPropagation();
    chatMenu.setAttribute('hidden', '');
    openSidePanel('email');
  });
  
  // Side panel
  spClose?.addEventListener('click', closeSidePanel);
  
  // Tareas
  addTaskBtn?.addEventListener('click', addTask);
  taskInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
  });
  
  taskList?.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') {
      const taskId = e.target.dataset.id;
      toggleTask(taskId);
    }
  });
  
  // Agregar miembros
  addMemberBtn?.addEventListener('click', addMember);
  addInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addMember();
  });
  
  // Email
  sendEmailBtn?.addEventListener('click', sendEmail);
}

/* =========================
   SIDE PANEL
========================== */
function openSidePanel(mode) {
  document.querySelector('.panel')?.classList.add('narrow');
  sidePanel.hidden = false;
  
  spTasksBody.hidden = true;
  spAddBody.hidden = true;
  spEmailBody.hidden = true;
  
  if (mode === 'tasks') {
    spTitle.textContent = 'Administrador de tareas';
    spTasksBody.hidden = false;
    renderTasks();
    taskInput?.focus();
  } else if (mode === 'add') {
    spTitle.textContent = 'Agregar integrante';
    spAddBody.hidden = false;
    addInput?.focus();
  } else if (mode === 'email') {
    spTitle.textContent = 'Enviar Correo';
    spEmailBody.hidden = false;
    emailDesc?.focus();
  }
}

function closeSidePanel() {
  sidePanel.hidden = true;
  document.querySelector('.panel')?.classList.remove('narrow');
}

/* =========================
   TAREAS
========================== */
function addTask() {
  const text = taskInput.value.trim();
  if (!text) return;
  
  const chatKey = `${currentChatType}-${currentChatId}`;
  tasksByChat[chatKey] = tasksByChat[chatKey] || [];
  
  const task = {
    id: Date.now(),
    text,
    done: false
  };
  
  tasksByChat[chatKey].push(task);
  taskInput.value = '';
  renderTasks();
}

function toggleTask(taskId) {
  const chatKey = `${currentChatType}-${currentChatId}`;
  const task = tasksByChat[chatKey]?.find(t => t.id == taskId);
  if (task) {
    task.done = !task.done;
    renderTasks();
  }
}

function renderTasks() {
  const chatKey = `${currentChatType}-${currentChatId}`;
  const items = tasksByChat[chatKey] || [];
  taskList.innerHTML = '';
  
  items.forEach(t => {
    const row = document.createElement('label');
    row.className = 'sp-task';
    row.innerHTML = `
      <input type="checkbox" ${t.done ? 'checked' : ''} data-id="${t.id}">
      <div style="${t.done ? 'text-decoration:line-through;opacity:0.6;' : ''}">${t.text}</div>
    `;
    taskList.appendChild(row);
  });
}

/* =========================
   MIEMBROS
========================== */
function addMember() {
  const name = addInput.value.trim();
  if (!name) return;
  
  addedMembers.push(name);
  addInput.value = '';
  renderAdded();
}

function renderAdded() {
  addedList.innerHTML = '';
  addedMembers.forEach((m, idx) => {
    const div = document.createElement('div');
    div.className = 'sp-task';
    div.innerHTML = `<div style="grid-column:1 / span 2;">${idx + 1}. ${m}</div>`;
    addedList.appendChild(div);
  });
}

/* =========================
   EMAIL
========================== */
async function sendEmail() {
  const desc = emailDesc.value.trim();
  if (!desc) {
    showToast('Escribe un mensaje', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/email.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send',
        message: desc,
        chat_id: currentChatId
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('Correo enviado correctamente', 'success');
      emailDesc.value = '';
      closeSidePanel();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    showToast('Error al enviar correo', 'error');
  }
}

/* =========================
   UTILIDADES
========================== */
function openConfirm(message, onConfirm) {
  confirmMsgEl.textContent = message;
  const handler = () => {
    try {
      onConfirm && onConfirm();
    } finally {
      confirmOkBtn.removeEventListener('click', handler);
      bsConfirmModal.hide();
    }
  };
  confirmOkBtn.addEventListener('click', handler);
  bsConfirmModal.show();
}

function showToast(message, type = 'info') {
  // Implementación simple de toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* =========================
   LIMPIAR AL SALIR
========================== */
window.addEventListener('beforeunload', () => {
  if (realtimeChat) {
    realtimeChat.destroy();
  }
});