// js/auth-check.js
/**
 * Script para verificar autenticación en páginas protegidas
 * Incluir este script en chats.html y otras páginas que requieran login
 */

(async function() {
  try {
    const response = await fetch('api/auth.php?action=check');
    const data = await response.json();

    if (!data.authenticated) {
      // Usuario no autenticado, redirigir al login
      window.location.href = 'login.html';
      return;
    }

    // Usuario autenticado, guardar info en localStorage
    if (data.user) {
      localStorage.setItem('user_id', data.user.id);
      localStorage.setItem('username', data.user.username);
      localStorage.setItem('user_email', data.user.email);
      localStorage.setItem('user_gems', data.user.gems);
      
      // Actualizar UI con información del usuario
      updateUserInfo(data.user);
    }

  } catch (error) {
    console.error('Error verificando autenticación:', error);
    // En caso de error, redirigir al login
    window.location.href = 'login.html';
  }
})();

/**
 * Actualizar información del usuario en la UI
 */
function updateUserInfo(user) {
  // Actualizar nombre de usuario
  const usernameElements = document.querySelectorAll('.user-name, .menu-name');
  usernameElements.forEach(el => {
    el.textContent = user.username;
  });

  // Actualizar gemas
  const gemElements = document.querySelectorAll('.gem-count');
  gemElements.forEach(el => {
    el.textContent = user.gems || 0;
  });

  // Actualizar email
  const emailElements = document.querySelectorAll('.user-email');
  emailElements.forEach(el => {
    el.textContent = user.email;
  });

  // Si hay avatar
  if (user.avatar_url) {
    const avatarElements = document.querySelectorAll('.user-avatar');
    avatarElements.forEach(el => {
      el.src = user.avatar_url;
    });
  }
}

/**
 * Función para cerrar sesión
 */
async function logout() {
  try {
    const response = await fetch('api/auth.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'logout'
      })
    });

    const data = await response.json();

    if (data.success) {
      // Limpiar localStorage
      localStorage.removeItem('user_id');
      localStorage.removeItem('username');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_gems');
      
      // Redirigir al login
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    // Forzar redirección
    window.location.href = 'index.html';
  }
}

// Hacer la función logout global
window.logout = logout;