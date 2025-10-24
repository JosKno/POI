/**
 * chats.js - VERSIÓN COMPLETA CON BD REAL
 * Carga grupos y conversaciones desde la base de datos
 */

/* =========================
   VERIFICAR AUTENTICACIÓN
========================== */
async function checkAuth() {
  try {
    const response = await fetch('/api/auth.php?action=check');
    const data = await response.json();
    
    if (!data.authenticated) {
      window.location.href = 'login.html';
      return false;
    }
    
    // Guardar info del usuario
    localStorage.setItem('current_user', JSON.stringify(data.user));
    return true;
  } catch (error) {
    console.error('Error verificando auth:', error);
    window.location.href = 'login.html';
    return false;
  }
}

/* =========================
   SISTEMA DE TIEMPO REAL
========================== */
const realtimeChat = new RealtimeChat('/api/messages.php');
let currentChatPolling = null;
let encryptionEnabled = false;

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
let currentChatType = null;
let conversations = JSON.parse(localStorage.getItem('conversations') || '{}');
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
const btnLogout = document.getElementById('btnLogout');
const btnCreateGroup = document.getElementById('btnCreateGroup');

// Menú y demás elementos...
const chatMenu = document.getElementById('chatMenu');
const mEncrypt = document.getElementById('mEncrypt');
const mTasks = document.getElementById('mTasks');
const mAddMember = document.getElementById('mAddMember');
const mEmail = document.getElementById('mEmail');

const sidePanel = document.getElementById('sidePanel');
const spClose = document.getElementById('spClose');
const spTitle = document.getElementById('spTitle');
const spTasksBody = document.getElementById('spTasksBody');
const spAddBody = document.getElementById('spAddBody');
const spEmailBody = document.getElementById('spEmailBody');

const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');

const addInput = document.getElementById('addInput');
const addMemberBtn = document.getElementById('addMemberBtn');
const addedList = document.getElementById('addedList');

const emailDesc = document.getElementById('emailDesc');
const sendEmailBtn = document.getElementById('sendEmailBtn');

const confirmModal = document.getElementById('confirmModal');
const confirmMsgEl = document.getElementById('confirmMsg');
const confirmOkBtn = document.getElementById('confirmOk');
const confirmCancelBtn = document.getElementById('confirmCancel');
const bsConfirmModal = confirmModal ? new bootstrap.Modal(confirmModal) : null;

/* =========================
   INICIALIZACIÓN
========================== */
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticación primero
  const isAuth = await checkAuth();
  if (!isAuth) return;
  
  setupEventListeners();
  await loadChatsFromDatabase();
  
  // Solicitar permisos de notificación
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  
  // Si hay un grupo que abrir (viene de crear-grupo)
  const openGroupId = localStorage.getItem('open_group_id');
  if (openGroupId) {
    localStorage.removeItem('open_group_id');
    setTimeout(() => {
      const groupItem = document.querySelector(`[data-chat="group-${openGroupId}"]`);
      if (groupItem) {
        groupItem.click();
      }
    }, 500);
  }
});

/* =========================
   CARGAR CHATS DESDE BD
========================== */
async function loadChatsFromDatabase() {
  try {
    showLoading();
    
    // Cargar grupos
    const groupsResponse = await fetch('/api/groups.php?action=my_groups');
    const groupsData = await groupsResponse.json();
    
    if (groupsData.success && groupsData.groups.length > 0) {
      groupsData.groups.forEach(group => {
        createChatItem(group.id, group.name, 'group', group.avatar_url, group.member_count);
      });
    }
    
    // Cargar usuarios para chats privados
    const usersResponse = await fetch('/api/users.php?action=list');
    const usersData = await usersResponse.json();
    
    if (usersData.success && usersData.users.length > 0) {
      usersData.users.forEach(user => {
        createChatItem(user.id, user.username, 'private', user.avatar_url, null, user.is_online);
      });
    }
    
    hideLoading();
    
    // Mostrar mensaje si no hay chats
    if (groupsData.groups.length === 0 && usersData.users.length === 0) {
      showEmptyState();
    }
    
  } catch (error) {
    console.error('Error cargando chats:', error);
    hideLoading();
    showToast('Error al cargar chats', 'error');
  }
}

function showLoading() {
  if (chatlist) {
    chatlist.innerHTML = '<div class="loading-state">Cargando chats...</div>';
  }
}

function hideLoading() {
  const loading = chatlist.querySelector('.loading-state');
  if (loading) loading.remove();
}

function showEmptyState() {
  if (chatlist) {
    chatlist.innerHTML = `
      <div class="empty-state">
        <div style="text-align:center; padding:40px 20px; opacity:0.6;">
          <div style="font-size:48px; margin-bottom:16px;">💬</div>
          <h3>No tienes chats aún</h3>
          <p style="margin:12px 0;">Crea un grupo para comenzar</p>
          <a href="crear-grupo.html" class="btn btn-success btn-sm">Crear Grupo</a>
        </div>
      </div>
    `;
  }
}

function createChatItem(id, name, type, avatarUrl = null, memberCount = null, isOnline = false) {
  const chatItem = document.createElement('a');
  chatItem.href = '#';
  chatItem.className = 'chatitem';
  chatItem.dataset.chat = `${type}-${id}`;
  chatItem.dataset.name = name;
  chatItem.dataset.type = type;
  chatItem.dataset.id = id;
  
  const avatar = avatarUrl || 'assets/img/default-avatar.png';
  const onlineIndicator = isOnline && type === 'private' ? 
    '<span class="online-indicator" style="width:12px;height:12px;background:#22c55e;border-radius:50%;position:absolute;bottom:2px;right:2px;border:2px solid #fff;"></span>' : '';
  
  const preview = type === 'group' ? 
    `👥 Grupo (${memberCount || '0'} miembros)` : 
    (isOnline ? '🟢 En línea' : 'Chat privado');
  
  chatItem.innerHTML = `
    <div style="position:relative;">
      <img src="${avatar}" alt="${name}" class="avatar" onerror="this.src='assets/img/default-avatar.png'" style="width:50px;height:50px;border-radius:50%;object-fit:cover;">
      ${onlineIndicator}
    </div>
    <div class="chatinfo">
      <div class="row1">
        <h3>${ChatUtils.escapeHtml(name)}</h3>
        <span class="time">•</span>
      </div>
      <div class="row2">
        <span class="preview">${preview}</span>
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
  
  convHeader.querySelector('.title').textContent = name;
  chatlist.hidden = true;
  conversation.hidden = false;
  
  if (btnVideo) {
    btnVideo.style.display = type === 'private' ? 'block' : 'none';
  }
  
  if (currentChatPolling) {
    realtimeChat.stopChat(currentChatPolling);
  }
  
  const chatKey = `${type}-${id}`;
  const localMessages = conversations[chatKey] || [];
  renderMessages(localMessages);
  
  currentChatPolling = id;
  realtimeChat.startChat(id, type, handleNewMessages);
  
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
    const exists = conversations[chatKey].some(m => m.id === msg.id);
    if (exists) return;
    
    let messageText = msg.message;
    if (msg.encrypted) {
      messageText = ChatUtils.decrypt(messageText);
    }
    
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
  
  localStorage.setItem('conversations', JSON.stringify(conversations));
  renderMessages(conversations[chatKey]);
  
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
  
  if (last.length === 0) {
    convBody.innerHTML = '<div style="text-align:center;padding:20px;opacity:0.5;">No hay mensajes aún. ¡Escribe el primero!</div>';
    return;
  }
  
  last.forEach(m => {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + (m.me ? 'msg-me' : 'msg-peer');
    
    let inner = '';
    
    if (currentChatType === 'group' && !m.me) {
      const gems = (typeof m.gems === 'number') ? m.gems : 0;
      const name = m.user || 'Miembro';
      inner += `
        <div class="msg-head" style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <strong>${ChatUtils.escapeHtml(name)}</strong>
          <span class="gems" style="display:inline-flex;align-items:center;gap:6px;font-weight:800;">
            <img src="assets/img/gema.png" alt="Gema" style="width:18px;height:18px;object-fit:contain;" onerror="this.style.display='none'">
            ${gems}
          </span>
        </div>
      `;
    }
    
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
    const messageToSend = encryptionEnabled ? ChatUtils.encrypt(text) : text;
    
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
   CERRAR SESIÓN
========================== */
async function logout() {
  try {
    const response = await fetch('/api/auth.php?action=logout', {
      method: 'POST'
    });
    
    localStorage.clear();
    
    if (realtimeChat) {
      realtimeChat.destroy();
    }
    
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    window.location.href = 'login.html';
  }
}

/* =========================
   EVENT LISTENERS
========================== */
function setupEventListeners() {
  sendBtn?.addEventListener('click', sendMessage);
  msgInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  convBack?.addEventListener('click', closeConversationToPromo);
  
  btnHome?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  
  btnLogout?.addEventListener('click', () => {
    openConfirm('¿Cerrar sesión?', logout);
  });
  
  btnCreateGroup?.addEventListener('click', () => {
    window.location.href = 'crear-grupo.html';
  });
  
  btnVideo?.addEventListener('click', () => {
    if (currentChatType !== 'private') return;
    showToast('Videollamadas próximamente', 'info');
  });
  
  btnMore?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (chatMenu) {
      const isOpen = !chatMenu.hasAttribute('hidden');
      chatMenu.hidden = isOpen;
      btnMore.setAttribute('aria-expanded', !isOpen);
    }
  });
  
  document.addEventListener('click', (e) => {
    if (chatMenu && !chatMenu.hasAttribute('hidden')) {
      const inside = chatMenu.contains(e.target) || btnMore?.contains(e.target);
      if (!inside) {
        chatMenu.setAttribute('hidden', '');
        btnMore?.setAttribute('aria-expanded', 'false');
      }
    }
  });
  
  mEncrypt?.addEventListener('click', (e) => {
    e.stopPropagation();
    chatMenu?.setAttribute('hidden', '');
    encryptionEnabled = !encryptionEnabled;
    showToast(
      encryptionEnabled ? '🔒 Cifrado activado' : '🔓 Cifrado desactivado',
      'success'
    );
  });
  
  mTasks?.addEventListener('click', (e) => {
    e.stopPropagation();
    chatMenu?.setAttribute('hidden', '');
    if (currentChatType === 'group') {
      openSidePanel('tasks');
    } else {
      showToast('Las tareas solo están disponibles en grupos', 'info');
    }
  });
  
  spClose?.addEventListener('click', closeSidePanel);
  
  addTaskBtn?.addEventListener('click', addTask);
  taskInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
  });
  
  taskList?.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') {
      toggleTask(e.target.dataset.id);
    }
  });
}

/* =========================
   SIDE PANEL Y TAREAS
========================== */
function openSidePanel(mode) {
  document.querySelector('.panel')?.classList.add('narrow');
  if (sidePanel) sidePanel.hidden = false;
  
  if (spTasksBody) spTasksBody.hidden = true;
  if (spAddBody) spAddBody.hidden = true;
  if (spEmailBody) spEmailBody.hidden = true;
  
  if (mode === 'tasks' && spTasksBody) {
    if (spTitle) spTitle.textContent = 'Administrador de tareas';
    spTasksBody.hidden = false;
    renderTasks();
    taskInput?.focus();
  }
}

function closeSidePanel() {
  if (sidePanel) sidePanel.hidden = true;
  document.querySelector('.panel')?.classList.remove('narrow');
}

function addTask() {
  const text = taskInput?.value.trim();
  if (!text) return;
  
  const chatKey = `${currentChatType}-${currentChatId}`;
  tasksByChat[chatKey] = tasksByChat[chatKey] || [];
  
  tasksByChat[chatKey].push({
    id: Date.now(),
    text,
    done: false
  });
  
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
  
  if (!taskList) return;
  
  taskList.innerHTML = '';
  
  items.forEach(t => {
    const row = document.createElement('label');
    row.className = 'sp-task';
    row.innerHTML = `
      <input type="checkbox" ${t.done ? 'checked' : ''} data-id="${t.id}">
      <div style="${t.done ? 'text-decoration:line-through;opacity:0.6;' : ''}">${ChatUtils.escapeHtml(t.text)}</div>
    `;
    taskList.appendChild(row);
  });
}

/* =========================
   UTILIDADES
========================== */
function openConfirm(message, onConfirm) {
  if (!bsConfirmModal) {
    if (confirm(message)) {
      onConfirm && onConfirm();
    }
    return;
  }
  
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