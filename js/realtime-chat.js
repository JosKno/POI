/**
 * realtime-chat.js
 * Sistema de mensajes en tiempo real usando long polling
 */

class RealtimeChat {
  constructor(apiUrl = '/api/messages.php') {
    this.apiUrl = apiUrl;
    this.activeChats = new Map(); // Map<chatId, {type, lastMessageId, polling}>
    this.messageHandlers = new Map(); // Map<chatId, callback>
    this.pollingActive = false;
    this.pollingInterval = null;
    this.unreadCount = 0;
    this.onUnreadUpdate = null;
  }

  /**
   * Iniciar el monitoreo de un chat
   * @param {string} chatId - ID del chat (user_id o group_id)
   * @param {string} type - Tipo de chat ('private' o 'group')
   * @param {function} onNewMessage - Callback cuando llegan mensajes nuevos
   */
  startChat(chatId, type, onNewMessage) {
    if (this.activeChats.has(chatId)) {
      console.warn(`Chat ${chatId} ya está activo`);
      return;
    }

    this.activeChats.set(chatId, {
      type,
      lastMessageId: 0,
      polling: false
    });

    this.messageHandlers.set(chatId, onNewMessage);

    // Cargar mensajes iniciales
    this.loadInitialMessages(chatId, type);

    // Iniciar polling si no está activo
    if (!this.pollingActive) {
      this.startPolling();
    }
  }

  /**
   * Detener el monitoreo de un chat
   */
  stopChat(chatId) {
    this.activeChats.delete(chatId);
    this.messageHandlers.delete(chatId);

    // Si no hay chats activos, detener polling
    if (this.activeChats.size === 0) {
      this.stopPolling();
    }
  }

  /**
   * Cargar mensajes iniciales
   */
  async loadInitialMessages(chatId, type) {
    try {
      const params = new URLSearchParams({
        action: 'get',
        [type === 'group' ? 'group_id' : 'receiver_id']: chatId,
        last_id: 0,
        limit: 50
      });

      const response = await fetch(`${this.apiUrl}?${params}`);
      const data = await response.json();

      if (data.success && data.messages.length > 0) {
        const chat = this.activeChats.get(chatId);
        if (chat) {
          // Actualizar último mensaje
          chat.lastMessageId = Math.max(...data.messages.map(m => m.id));
          
          // Llamar al handler con los mensajes
          const handler = this.messageHandlers.get(chatId);
          if (handler) {
            handler(data.messages);
          }
        }
      }
    } catch (error) {
      console.error('Error cargando mensajes iniciales:', error);
    }
  }

  /**
   * Iniciar polling para todos los chats activos
   */
  startPolling() {
    this.pollingActive = true;
    this.pollAllChats();
  }

  /**
   * Detener polling
   */
  stopPolling() {
    this.pollingActive = false;
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Poll para todos los chats activos
   */
  async pollAllChats() {
    if (!this.pollingActive) return;

    const promises = [];

    for (const [chatId, chat] of this.activeChats) {
      if (!chat.polling) {
        promises.push(this.pollChat(chatId, chat));
      }
    }

    await Promise.all(promises);

    // Programar siguiente poll
    if (this.pollingActive) {
      this.pollingInterval = setTimeout(() => this.pollAllChats(), 1000);
    }
  }

  /**
   * Poll para un chat específico
   */
  async pollChat(chatId, chat) {
    chat.polling = true;

    try {
      const params = new URLSearchParams({
        action: 'poll',
        [chat.type === 'group' ? 'group_id' : 'receiver_id']: chatId,
        last_id: chat.lastMessageId
      });

      const response = await fetch(`${this.apiUrl}?${params}`);
      const data = await response.json();

      if (data.success && data.messages.length > 0) {
        // Actualizar último mensaje
        chat.lastMessageId = Math.max(...data.messages.map(m => m.id));
        
        // Llamar al handler
        const handler = this.messageHandlers.get(chatId);
        if (handler) {
          handler(data.messages);
        }

        // Actualizar contador de no leídos
        this.updateUnreadCount();
      }
    } catch (error) {
      console.error(`Error polling chat ${chatId}:`, error);
    } finally {
      chat.polling = false;
    }
  }

  /**
   * Enviar un mensaje
   */
  async sendMessage(chatId, type, message, options = {}) {
    try {
      const payload = {
        action: 'send',
        [type === 'group' ? 'group_id' : 'receiver_id']: chatId,
        message: message,
        type: options.type || 'text',
        file_url: options.fileUrl || null,
        encrypted: options.encrypted || false
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        // Actualizar último mensaje del chat
        const chat = this.activeChats.get(chatId);
        if (chat) {
          chat.lastMessageId = Math.max(chat.lastMessageId, data.message_id);
        }

        return {
          success: true,
          messageId: data.message_id,
          sentAt: data.sent_at
        };
      } else {
        throw new Error(data.error || 'Error enviando mensaje');
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Marcar mensajes como leídos
   */
  async markAsRead(messageIds) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'mark_read',
          message_ids: messageIds
        })
      });

      const data = await response.json();
      
      if (data.success) {
        this.updateUnreadCount();
      }

      return data.success;
    } catch (error) {
      console.error('Error marcando mensajes como leídos:', error);
      return false;
    }
  }

  /**
   * Actualizar contador de mensajes no leídos
   */
  async updateUnreadCount() {
    try {
      const response = await fetch(`${this.apiUrl}?action=get_unread_count`);
      const data = await response.json();

      if (data.success) {
        this.unreadCount = data.total;
        
        if (this.onUnreadUpdate) {
          this.onUnreadUpdate(data);
        }
      }
    } catch (error) {
      console.error('Error obteniendo mensajes no leídos:', error);
    }
  }

  /**
   * Obtener historial de mensajes
   */
  async getHistory(chatId, type, beforeMessageId = null, limit = 50) {
    try {
      const params = new URLSearchParams({
        action: 'get',
        [type === 'group' ? 'group_id' : 'receiver_id']: chatId,
        last_id: 0,
        limit: limit
      });

      const response = await fetch(`${this.apiUrl}?${params}`);
      const data = await response.json();

      if (data.success) {
        return data.messages;
      } else {
        throw new Error(data.error || 'Error obteniendo historial');
      }
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      return [];
    }
  }

  /**
   * Limpiar todos los chats y detener polling
   */
  destroy() {
    this.stopPolling();
    this.activeChats.clear();
    this.messageHandlers.clear();
  }
}

// Utilidades para formateo de mensajes
const ChatUtils = {
  /**
   * Formatear timestamp a hora local
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-MX', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  },

  /**
   * Formatear fecha completa
   */
  formatDate(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-MX', { 
        day: '2-digit', 
        month: 'short' 
      });
    }
  },

  /**
   * Escapar HTML para prevenir XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Cifrado simple (base64)
   * NOTA: Esto NO es seguro, solo para demostración
   * En producción usa una librería de criptografía real
   */
  encrypt(text) {
    return btoa(unescape(encodeURIComponent(text)));
  },

  /**
   * Descifrado simple (base64)
   */
  decrypt(text) {
    try {
      return decodeURIComponent(escape(atob(text)));
    } catch (e) {
      return text;
    }
  },

  /**
   * Notificación de escritorio
   */
  async showNotification(title, body, icon = null) {
    if (!('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon });
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, { body, icon });
      }
    }
  },

  /**
   * Reproducir sonido de notificación
   */
  playNotificationSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRnoFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoFAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjaP1vLRfS0GK37P8tuJNwgUaLfn5p9NBAtPp+Hwtl8cBTiP1PLMeS0FJHXI8N2SQAUTY7Pm66dVFQpGnt/yvWwhBjaO1fLRfS4GKn/O8tyKNwgTaLfn5p9NBAtPp+Dwt18bBTiP1PLMeS0GI3TI8N2RQAUTY7Pm66dVFQlGnt/yvWshBjaO1fLQfi0GKn/O8dyJNggTaLfm5qBNBAtPp+Dwt18bBTeP1PLLeS0GI3TI8NyQQQQSY7Pm6aZUFQlFnt/yvWshBjaO1vLQfi0GKX/O8tyJNggSaLfm5qBNBAtPp+Dwt18bBTeP1PLLeS0GI3PI8NyQQQQSY7Pn6aZUFQlFnt/yvWshBTaO1vLQfi0GKX/O8tyJNggSaLfm5qBNBAtPp+Dwt18bBTeP1PLLeS0GI3PI8NyRQAQSY7Pn6aZUFQlFnt/yvGshBTaO1vLQfi0GKH/O8dyJNwgSaLfm5qBNBAtPp+Dwt18bBTeP1PLLeS0GI3PI8NyRQAQSY7Pn6aZUFQlFnt/yvGshBTaO1vLPfi0GKH/O8dyJNwgSZ7fm5qBNBAtPp+Dwt18aBTeP1PLLeSwGI3PI8NyRQAQSY7Pn6aZUFAlFnt/yvGshBTaO1vLPfi0GKH/O8dyJNwgSZ7fm5qBNBAtPp+Dwt18aBTeP1PLLeSwGI3PI8NyRQAQRY7Pn6aZUFAlFnt/yvGshBTaO1vLPfi0GJ3/O8dyJNwgSZ7fm5qBNBAtPp+Dwt18aBTeP1PLLeSwGI3PI8NyRQAQRY7Pn6aZUFAlFnt/yvGshBTaO1vLPfi0GJ3/O8dyJNwgSZ7fm5qBNBAtPp+Dwt18aBTeP1PLLeSwGI3PI8NyRQAQRY7Pn6aZUFAlFnt/yvGshBTaO1vLPfi0GJ3/O8dyJNwgSZ7fm5qBNAwlPp+Dwt18aBTeP1PLLeSwGI3PI8NyRQAQRY7Pn6aZUFAlFnt/yvGshBTaO1vLPfi0GJ3/O8dyJNwgSZ7fm5qBNAwlPp+Dwt18aBTeP1PLLeSwGI3PI8NyRQAQRY7Pn6aZUFAlFnt/yvGshBTaO1vLPfi0GJ3/O8dyJNwgSZ7fm5qBNAwlPp+Dwt18aBTeP1PLLeSwGI3PI8NyRQAQRY7Pn6aZUE=');
    audio.volume = 0.3;
    audio.play().catch(e => console.log('No se pudo reproducir el sonido'));
  }
};

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.RealtimeChat = RealtimeChat;
  window.ChatUtils = ChatUtils;
}