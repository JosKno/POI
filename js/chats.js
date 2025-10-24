/**
 * chats.js - VERSIÓN CORREGIDA CON MANEJO DE ERRORES
 */

/* =========================
   VERIFICAR AUTENTICACIÓN
========================== */
async function checkAuth() {
  try {
    const response = await fetch('/api/auth.php?action=check');
    
    // Verificar que la respuesta sea OK
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    
    // Intentar parsear como JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Respuesta no es JSON válido:', text);
      throw new Error('El servidor no devolvió JSON válido');
    }
    
    if (!data.authenticated) {
      window.location.href = 'login.html';
      return false;
    }
    
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
let conversations = {};
const tasksByChat = {};

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
const btnVideo = document.getElementById('btnVideo');
const btnMore = document.getElementById('btnMore');
const btnLogout = document.getElementById('btnLogout');
const btnCreateGroup = document.getElementById('btnCreateGroup');
const chatMenu = document.getElementById('chatMenu');
const mEncrypt = document.getElementById('mEncrypt');
const mTasks = document.getElementById('mTasks');
const sidePanel = document.getElementById('sidePanel');
const spClose = document.getElementById('spClose');
const spTitle = document.getElementById('spTitle');
const spTasksBody = document.getElementById('spTasksBody');
const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const confirmModal = document.getElementById('confirmModal');
const confirmMsgEl = document.getElementById('confirmMsg');
const confirmOkBtn = document.getElementById('confirmOk');
const bsConfirmModal = confirmModal ? new bootstrap.Modal(confirmModal) : null;

/* =========================
   INICIALIZACIÓN
========================== */
document.addEventListener('DOMContentLoaded', async () => {
  const isAuth = await checkAuth();
  if (!isAuth) return;
  
  setupEventListeners();
  await loadChatsFromDatabase();
  
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  
  const openGroupId = localStorage.getItem('open_group_id');
  if (openGroupId) {
    localStorage.removeItem('open_group_id');
    setTimeout(() => {
      const groupItem = document.querySelector(`[data-chat="group-${openGroupId}"]`);
      if (groupItem) groupItem.click();
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
    
    if (!groupsResponse.ok) {
      throw new Error(`Error HTTP: ${groupsResponse.status}`);
    }
    
    const groupsText = await groupsResponse.text();
    let groupsData;
    
    try {
      groupsData = JSON.parse(groupsText);
    } catch (e) {
      console.error('Error parseando respuesta de grupos:', groupsText);
      throw new Error('El servidor devolvió una respuesta inválida para grupos');
    }
    
    if (groupsData.success && groupsData.groups.length > 0) {
      groupsData.groups.forEach(group => {
        createChatItem(group.id, group.name, 'group', group.avatar_url, group.member_count);
      });
    }
    
    // Cargar usuarios
    const usersResponse = await fetch('/api/users.php?action=list');
    
    if (!usersResponse.ok) {
      throw new Error(`Error HTTP: ${usersResponse.status}`);
    }
    
    const usersText = await usersResponse.text();
    let usersData;
    
    try {
      usersData = JSON.parse(usersText);
    } catch (e) {
      console.error('Error parseando respuesta de usuarios:', usersText);
      throw new Error('El servidor devolvió una respuesta inválida para usuarios');
    }
    
    if (usersData.success && usersData.users.length > 0) {
      usersData.users.forEach(user => {
        createChatItem(user.id, user.username, 'private', user.avatar_url, null, user.is_online);
      });
    }
    
    hideLoading();
    
    if ((groupsData.groups?.length || 0) === 0 && (usersData.users?.length || 0) === 0) {
      showEmptyState();
    }
    
  } catch (error) {
    console.error('Error cargando chats:', error);
    hideLoading();
    showToast('Error al cargar chats: ' + error.message, 'error');
    showEmptyState();
  }
}

function showLoading() {
  if (chatlist) {
    chatlist.innerHTML = '<div class="loading-state" style="text-align:center;padding:40px 20px;opacity:0.6;">Cargando chats...</div>';
  }
}

function hideLoading() {
  const loading = chatlist?.querySelector('.loading-state');
  if (loading) loading.remove();
}

function showEmptyState() {
  if (chatlist) {
    chatlist.innerHTML = `
      <div class="empty-state" style="text-align:center;padding:40px 20px;opacity:0.6;">
        <div style="font-size:48px;margin-bottom:16px;">💬</div>
        <h3 style="font-size:1.2rem;font-weight:700;margin-bottom:8px;">No tienes chats aún</h3>
        <p style="margin:12px 0;font-size:0.95rem;">Crea un grupo para comenzar</p>
        <button onclick="window.location.href='crear-grupo.html'" class="btn btn-success btn-sm" style="margin-top:16px;">Crear Grupo</button>
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
    '<span style="width:12px;height:12px;background:#22c55e;border-radius:50%;position:absolute;bottom:2px;right:2px;border:2px solid #fff;"></span>' : '';
  
  const preview = type === 'group' ? 
    `👥 Grupo (${memberCount || '0'} miembros)` : 
    (isOnline ? '🟢 En línea' : 'Chat privado');
  
  chatItem.innerHTML = `
    <div style="position:relative;width:50px;height:50px;">
      <img src="${avatar}" alt="${escapeHtml(name)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.src='assets/img/default-avatar.png'">
      ${onlineIndicator}
    </div>
    <div class="chatinfo" style="flex:1;min-width:0;">
      <div class="row1" style="display:flex;justify-content:space-between;align-items:center;">
        <h3 style="margin:0;font-size:0.95rem;font-weight:600;">${escapeHtml(name)}</h3>
        <span class="time" style="font-size:0.8rem;opacity:0.6;">•</span>
      </div>
      <div class="row2">
        <span class="preview" style="font-size:0.85rem;opacity:0.7;">${preview}</span>
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
  
  const convNameEl = document.getElementById('convName');
  if (convNameEl) convNameEl.textContent = name;
  
  const placeholderPromo = document.getElementById('placeholderPromo');
  if (placeholderPromo) placeholderPromo.hidden = true;
  if (chatlist) chatlist.hidden = true;
  if (conversation) conversation.hidden = false;
  
  if (btnVideo) {
    btnVideo.style.display = type === 'private' ? 'block' : 'none';
  }
  
  if (currentChatPolling) {
    realtimeChat.stopChat(currentChatPolling);
  }
  
  if (convBody) convBody.innerHTML = '';
  
  currentChatPolling = id;
  realtimeChat.startChat(id, type, handleNewMessages);
  
  if (convBody) convBody.scrollTop = convBody.scrollHeight;
  if (msgInput) msgInput.focus();
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
        ChatUtils.showNotification(
          `Mensaje de ${msg.sender.username}`,
          messageText
        );
      }
    }
  });
  
  renderMessages(conversations[chatKey]);
  
  if (convBody) {
    const isNearBottom = convBody.scrollHeight - convBody.scrollTop - convBody.clientHeight < 100;
    if (isNearBottom) {
      convBody.scrollTop = convBody.scrollHeight;
    }
  }
}

/* =========================
   RENDERIZAR MENSAJES
========================== */
function renderMessages(arr) {
  if (!convBody) return;
  
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
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <strong>${escapeHtml(name)}</strong>
          <span style="display:inline-flex;align-items:center;gap:6px;font-weight:800;">
            💎 ${gems}
          </span>
        </div>
      `;
    }
    
    if (m.type === 'image' && m.file_url) {
      inner += `<img src="${m.file_url}" alt="Imagen" style="max-width:200px;border-radius:8px;margin-bottom:5px;">`;
    }
    
    inner += `${escapeHtml(m.text)}<span class="time" style="opacity:0.6;font-size:0.8rem;margin-left:8px;">${m.time || ''}</span>`;
    wrap.innerHTML = inner;
    convBody.appendChild(wrap);
  });
  
  convBody.scrollTop = convBody.scrollHeight;
}

/* =========================
   ENVIAR MENSAJE
========================== */
async function sendMessage() {
  const text = msgInput?.value.trim();
  if (!text || !currentChatId) return;
  
  if (msgInput) msgInput.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  
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
      
      renderMessages(conversations[chatKey]);
      if (msgInput) msgInput.value = '';
    } else {
      throw new Error(result.error || 'Error enviando mensaje');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('No se pudo enviar el mensaje', 'error');
  } finally {
    if (msgInput) msgInput.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    if (msgInput) msgInput.focus();
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
  
  const placeholderPromo = document.getElementById('placeholderPromo');
  if (placeholderPromo) placeholderPromo.hidden = false;
  if (chatlist) chatlist.hidden = false;
  if (conversation) conversation.hidden = true;
  closeSidePanel();
}

/* =========================
   CERRAR SESIÓN
========================== */
async function logout() {
  try {
    await fetch('/api/auth.php?action=logout', {
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
  
  btnLogout?.addEventListener('click', () => {
    openConfirm('¿Cerrar sesión?', logout);
  });
  
  btnCreateGroup?.addEventListener('click', () => {
    window.location.href = 'crear-grupo.html';
  });
  
  btnVideo?.addEventListener('click', () => {
    showToast('Videollamadas próximamente', 'info');
  });
  
  btnMore?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (chatMenu) {
      chatMenu.hidden = !chatMenu.hasAttribute('hidden');
    }
  });
  
  document.addEventListener('click', (e) => {
    if (chatMenu && !chatMenu.hasAttribute('hidden')) {
      const inside = chatMenu.contains(e.target) || btnMore?.contains(e.target);
      if (!inside) {
        chatMenu.setAttribute('hidden', '');
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
  document.querySelector('.main-content')?.classList.add('narrow');
  if (sidePanel) sidePanel.hidden = false;
  
  if (spTasksBody) spTasksBody.hidden = mode !== 'tasks';
  
  if (mode === 'tasks') {
    if (spTitle) spTitle.textContent = 'Administrador de tareas';
    renderTasks();
    taskInput?.focus();
  }
}

function closeSidePanel() {
  if (sidePanel) sidePanel.hidden = true;
  document.querySelector('.main-content')?.classList.remove('narrow');
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
  
  if (taskInput) taskInput.value = '';
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
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;';
    row.innerHTML = `
      <input type="checkbox" ${t.done ? 'checked' : ''} data-id="${t.id}">
      <div style="${t.done ? 'text-decoration:line-through;opacity:0.6;' : ''}">${escapeHtml(t.text)}</div>
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
  
  if (confirmMsgEl) confirmMsgEl.textContent = message;
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
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6'};
    color: white;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: slideIn 0.3s ease;
    font-weight: 600;
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* =========================
   LIMPIAR AL SALIR
========================== */
window.addEventListener('beforeunload', () => {
  if (realtimeChat) {
    realtimeChat.destroy();
  }
});