/**
 * chats.js - VERSIÓN CON OPTIMIZACIÓN DE ECHOING
 * Con validación de JSON y apertura de conversaciones funcionando
 */

/* =========================
   VERIFICAR AUTENTICACIÓN
========================== */
async function checkAuth() {
  try {
    const response = await fetch('/api/auth.php?action=check');
    const text = await response.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Error parseando auth JSON:', e);
      console.error('Respuesta recibida:', text);
      window.location.href = 'login.html';
      return false;
    }
    
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
// Se mantienen las referencias por ID para compatibilidad y uso de querySelector para elementos sin ID
const sendBtn = document.getElementById('sendBtn');
const convBack = document.getElementById('convBack');

// Botones del header
const btnHome = document.getElementById('btnHome');
const btnVideo = document.getElementById('btnVideo');
const btnMore = document.getElementById('btnMore');
const btnLogout = document.getElementById('btnLogout');
const btnCreateGroup = document.getElementById('btnCreateGroup');

// Menú y demás elementos
const chatMenu = document.getElementById('chatMenu');
const mEncrypt = document.getElementById('mEncrypt');
const mTasks = document.getElementById('mTasks');
const mAddMember = document.getElementById('mAdd');
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
    console.log('Cargando grupos...');
    const groupsResponse = await fetch('/api/groups.php?action=my_groups');
    const groupsText = await groupsResponse.text();
    
    console.log('Respuesta grupos (raw):', groupsText);
    
    let groupsData;
    try {
      groupsData = JSON.parse(groupsText);
    } catch (e) {
      console.error('Error parseando JSON de grupos:', e);
      console.error('Texto recibido:', groupsText);
      showToast('Error al cargar grupos', 'error');
      groupsData = { success: false, groups: [] };
    }
    
    if (groupsData.success && groupsData.groups && groupsData.groups.length > 0) {
      console.log('Grupos encontrados:', groupsData.groups.length);
      groupsData.groups.forEach(group => {
        console.log('Creando item para grupo:', group.name, 'miembros:', group.member_count);
        createChatItem(group.id, group.name, 'group', group.avatar_url, group.member_count);
      });
    } else {
      console.log('No hay grupos o hubo error:', groupsData);
    }
    
    // Cargar usuarios para chats privados
    console.log('Cargando usuarios...');
    const usersResponse = await fetch('/api/users.php?action=list');
    const usersText = await usersResponse.text();
    
    console.log('Respuesta usuarios (raw):', usersText);
    
    let usersData;
    try {
      usersData = JSON.parse(usersText);
    } catch (e) {
      console.error('Error parseando JSON de usuarios:', e);
      console.error('Texto recibido:', usersText);
      showToast('Error al cargar usuarios', 'error');
      usersData = { success: false, users: [] };
    }
    
    if (usersData.success && usersData.users && usersData.users.length > 0) {
      console.log('Usuarios encontrados:', usersData.users.length);
      usersData.users.forEach(user => {
        createChatItem(user.id, user.username, 'private', user.avatar_url, null, user.is_online);
      });
    } else {
      console.log('No hay usuarios o hubo error:', usersData);
    }
    
    hideLoading();
    
    // Mostrar mensaje si no hay chats
    const hasGroups = groupsData.success && groupsData.groups && groupsData.groups.length > 0;
    const hasUsers = usersData.success && usersData.users && usersData.users.length > 0;
    
    if (!hasGroups && !hasUsers) {
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
    chatlist.innerHTML = '<div class="loading-state" style="padding:20px;text-align:center;color:rgba(255,255,255,0.6);">Cargando chats...</div>';
  }
}

function hideLoading() {
  const loading = chatlist ? chatlist.querySelector('.loading-state') : null;
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
  
  const avatar = avatarUrl || 'assets/img/icon_iniciarsesion.png';
  const onlineIndicator = isOnline && type === 'private' ? 
    '<span class="online-indicator" style="width:12px;height:12px;background:#22c55e;border-radius:50%;position:absolute;bottom:2px;right:2px;border:2px solid #fff;"></span>' : '';
  
  const preview = type === 'group' ? 
    `👥 Grupo (${memberCount || '0'} miembros)` : 
    (isOnline ? '🟢 En línea' : 'Chat privado');
  
  // CORRECCIÓN: Usar la primera letra del nombre como contenido del avatar si no hay URL
  const avatarContent = avatarUrl 
    ? `<img src="${avatar}" alt="${name}" class="avatar" onerror="this.src='assets/img/icon_iniciarsesion.png'" style="width:50px;height:50px;border-radius:50%;object-fit:cover;">`
    : `<div class="avatar ${type === 'group' ? 'grp' : ''}">${ChatUtils.escapeHtml(name.charAt(0).toUpperCase())}</div>`;


  chatItem.innerHTML = `
    <div style="position:relative;">
      ${avatarContent}
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
    console.log('Click en chat:', type, id, name);
    document.querySelectorAll('.chatitem.active').forEach(el => el.classList.remove('active'));
    chatItem.classList.add('active');
    openConversation(id, name, type);
  });
  
  if (chatlist) {
    chatlist.appendChild(chatItem);
  }
}

/* =========================
   ABRIR CONVERSACIÓN
========================== */
function openConversation(id, name, type) {
  console.log('Abriendo conversación:', type, id, name);
  
  currentChatId = id;
  currentChatType = type;
  
  // Actualizar header
  const titleEl = convHeader ? convHeader.querySelector('.conv-name') : null;
  if (titleEl) {
    titleEl.textContent = name;
  }
  
  // CORRECCIÓN: Actualizar avatar con la inicial del nombre
  const convAvatar = document.getElementById('convAvatar');
  if (convAvatar) {
      convAvatar.textContent = name.charAt(0).toUpperCase();
  }

  // 1. Mostrar conversación
  if (conversation) conversation.hidden = false;
  
  // 2. Ocultar el placeholder de bienvenida
  const placeholderPromo = document.getElementById('placeholderPromo');
  if (placeholderPromo) placeholderPromo.hidden = true;
  
  // 3. NO ocultar la lista, se mantiene visible
  
  // Mostrar/ocultar botón de videollamada
  if (btnVideo) {
    btnVideo.style.display = type === 'private' ? 'block' : 'none';
  }
  
  // Detener polling anterior
  if (currentChatPolling) {
    realtimeChat.stopChat(currentChatPolling);
  }
  
  // Cargar mensajes locales
  const chatKey = `${type}-${id}`;
  const localMessages = conversations[chatKey] || [];
  renderMessages(localMessages);
  
  // Iniciar polling de nuevos mensajes
  currentChatPolling = id;
  realtimeChat.startChat(id, type, handleNewMessages);
  
  // Scroll al final
  if (convBody) {
    convBody.scrollTop = convBody.scrollHeight;
  }
  
  // Focus en input y LIMPIAR TEXTO PERSISTENTE (✅ CORRECCIÓN: Limpiar input)
  const inputElement = document.getElementById('msgInput'); // Usar ID del HTML
  if (inputElement) {
    inputElement.value = ''; // Limpiar el input
    inputElement.focus();
  }
  
  console.log('Conversación abierta exitosamente');
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
          ? document.querySelector(`[data-chat="group-${currentChatId}"]`)?.dataset.name
          : document.querySelector(`[data-chat="private-${currentChatId}"]`)?.dataset.name;
        
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Nuevo mensaje de ${chatName}`, {
            body: messageText.substring(0, 100),
            icon: '/assets/img/logo.png'
          });
        }
      }
    }
  });
  
  localStorage.setItem('conversations', JSON.stringify(conversations));
  renderMessages(conversations[chatKey]);
  
  if (convBody) {
    convBody.scrollTop = convBody.scrollHeight;
  }
}

/* =========================
   RENDERIZAR MENSAJES
========================== */
function renderMessages(messages) {
  if (!convBody) return;
  
  convBody.innerHTML = '';
  
  if (!messages || messages.length === 0) {
    convBody.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.5;">No hay mensajes aún. ¡Envía el primero!</div>';
    return;
  }
  
  messages.forEach(msg => {
    const msgEl = document.createElement('div');
    msgEl.className = `message ${msg.me ? 'me' : 'other'}`;
    
    const content = msg.type === 'file' && msg.file_url
      ? `<a href="${msg.file_url}" target="_blank">📎 ${msg.text}</a>`
      : ChatUtils.escapeHtml(msg.text);
    
    // NOTA: El nombre de usuario solo se muestra en grupos para mensajes de otros
    msgEl.innerHTML = `
      <div class="msg-content">
        ${!msg.me && currentChatType === 'group' ? `<div class="msg-user">${ChatUtils.escapeHtml(msg.user || 'Usuario')}</div>` : ''}
        <div class="msg-text">${content}</div>
        <div class="msg-time">${msg.time || ''}</div>
      </div>
    `;
    
    convBody.appendChild(msgEl);
  });
}

/* =========================
   ENVIAR MENSAJE (✅ OPTIMIZACIÓN DE ECHOING)
========================== */
async function sendMessage() {
  const inputElement = document.getElementById('msgInput');
  const text = inputElement ? inputElement.value.trim() : '';

  if (!text || !currentChatId || !currentChatType) return;
  
  // 1. DESHABILITAR INPUT
  inputElement.disabled = true;
  sendBtn.disabled = true;

  // --- START ECHOING (RENDERIZADO INMEDIATO) ---
  const chatKey = `${currentChatType}-${currentChatId}`;
  const now = new Date().toISOString(); 
  
  // 2. Crear estructura de mensaje temporal
  const tempMessage = { 
    id: Date.now(), // ID temporal para rastrear el mensaje
    me: true, 
    text: text, 
    time: ChatUtils.formatTime(now),
    type: 'text',
    status: 'sending' // Puedes usar esto en CSS para un icono de reloj
  };

  // 3. Agregar a cache local y renderizar inmediatamente
  conversations[chatKey] = conversations[chatKey] || [];
  conversations[chatKey].push(tempMessage);
  localStorage.setItem('conversations', JSON.stringify(conversations));
  renderMessages(conversations[chatKey]);

  // 4. Limpiar input y hacer scroll
  inputElement.value = '';
  if (convBody) convBody.scrollTop = convBody.scrollHeight;

  try {
    const messageToSend = encryptionEnabled 
      ? ChatUtils.encrypt(text) 
      : text;
    
    // 5. Enviar mensaje (Punto de Latencia)
    const result = await realtimeChat.sendMessage(
      currentChatId, 
      currentChatType, 
      messageToSend,
      {
        type: 'text',
        encrypted: encryptionEnabled
      }
    );
    
    // 6. Manejar la respuesta del servidor
    if (result.success) {
      // Encontrar el mensaje temporal y actualizar sus datos
      const index = conversations[chatKey].findIndex(m => m.id === tempMessage.id);
      if (index !== -1) {
        conversations[chatKey][index].id = result.messageId;
        conversations[chatKey][index].time = ChatUtils.formatTime(result.sent_at);
        delete conversations[chatKey][index].status;
      }
      localStorage.setItem('conversations', JSON.stringify(conversations));
      // No se necesita re-renderizar si no hay un indicador visual de 'enviando'
    } else {
      // Si falló, mostrar error y eliminar el mensaje temporal
      showToast(result.error || 'Error enviando mensaje', 'error');
      conversations[chatKey] = conversations[chatKey].filter(m => m.id !== tempMessage.id);
      localStorage.setItem('conversations', JSON.stringify(conversations));
      renderMessages(conversations[chatKey]); // Re-renderizar para eliminar el mensaje fallido
    }
  } catch (error) {
    // Si falló la red, eliminar el mensaje temporal
    console.error('Error:', error);
    showToast('Error de conexión. Intenta de nuevo.', 'error');
    conversations[chatKey] = conversations[chatKey].filter(m => m.id !== tempMessage.id);
    localStorage.setItem('conversations', JSON.stringify(conversations));
    renderMessages(conversations[chatKey]);
  } finally {
    // 7. Habilitar input y botón
    inputElement.disabled = false;
    sendBtn.disabled = false;
    if (inputElement) inputElement.focus();
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
  
  // Ocultar conversación
  if (conversation) conversation.hidden = true;
  
  // Mostrar placeholder de bienvenida
  const placeholderPromo = document.getElementById('placeholderPromo');
  if (placeholderPromo) placeholderPromo.hidden = false;
  
  // Mostrar la lista de chats si se había ocultado (para móvil/responsive)
  if (chatlist) chatlist.hidden = false; 
  
  closeSidePanel();
}

/* =========================
   CERRAR SESIÓN
========================== */
async function logout() {
  try {
    const response = await fetch('/api/auth.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' })
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
   UTILIDADES
========================== */

// NOTA: ChatUtils se define en js/realtime-chat.js.

function showToast(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  // Implementar toast visual si se desea
}

function closeSidePanel() { 
  if (sidePanel) {
    sidePanel.hidden = true;
  }
}

function openConfirm(message, callback) {
  if (confirmMsgEl) confirmMsgEl.textContent = message;
  if (bsConfirmModal) bsConfirmModal.show();
  
  if (confirmOkBtn) {
    confirmOkBtn.onclick = () => {
      if (bsConfirmModal) bsConfirmModal.hide();
      if (callback) callback();
    };
  }
}

/* =========================
   EVENT LISTENERS
========================== */
function setupEventListeners() {
  const msgInputFinal = document.getElementById('msgInput');
  const sendBtnFinal = document.getElementById('sendBtn');


  if (sendBtnFinal) {
    sendBtnFinal.addEventListener('click', sendMessage);
  }
  
  if (msgInputFinal) {
    msgInputFinal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  if (convBack) {
    convBack.addEventListener('click', closeConversationToPromo);
  }
  
  if (btnHome) {
    btnHome.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }
  
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      openConfirm('¿Cerrar sesión?', logout);
    });
  }
  
  if (btnCreateGroup) {
    btnCreateGroup.addEventListener('click', () => {
      window.location.href = 'crear-grupo.html';
    });
  }
  
  if (btnVideo) {
    btnVideo.addEventListener('click', () => {
      if (currentChatType !== 'private') return;
      showToast('Videollamadas próximamente', 'info');
    });
  }
  
  if (btnMore) {
    btnMore.addEventListener('click', (e) => {
      e.stopPropagation();
      if (chatMenu) {
        const isOpen = !chatMenu.hasAttribute('hidden');
        chatMenu.hidden = isOpen;
        btnMore.setAttribute('aria-expanded', !isOpen);
      }
    });
  }
  
  document.addEventListener('click', (e) => {
    if (chatMenu && !chatMenu.hasAttribute('hidden')) {
      const inside = chatMenu.contains(e.target) || (btnMore && btnMore.contains(e.target));
      if (!inside) {
        chatMenu.setAttribute('hidden', '');
        if (btnMore) btnMore.setAttribute('aria-expanded', 'false');
      }
    }
  });
  
  if (mEncrypt) {
    mEncrypt.addEventListener('click', (e) => {
      e.stopPropagation();
      if (chatMenu) chatMenu.setAttribute('hidden', '');
      encryptionEnabled = !encryptionEnabled;
      showToast(
        encryptionEnabled ? 'Cifrado activado 🔒' : 'Cifrado desactivado 🔓',
        'info'
      );
    });
  }
  
  if (spClose) {
    spClose.addEventListener('click', closeSidePanel);
  }
}