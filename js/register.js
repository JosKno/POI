// js/register.js
document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('pass');
  const pass2Input = document.getElementById('pass2');
  const submitBtn = document.querySelector('.auth__submit');

  // Verificar si ya hay sesión activa
  checkExistingSession();

  // Manejar envío del formulario
  submitBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const username = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passInput.value;
    const password2 = pass2Input.value;

    // Validaciones
    if (!username || !email || !password || !password2) {
      showNotification('Por favor, completa todos los campos', 'error');
      return;
    }

    if (username.length < 3) {
      showNotification('El nombre debe tener al menos 3 caracteres', 'error');
      return;
    }

    if (!isValidEmail(email)) {
      showNotification('Por favor, ingresa un correo válido', 'error');
      return;
    }

    if (password.length < 6) {
      showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }

    if (password !== password2) {
      showNotification('Las contraseñas no coinciden', 'error');
      return;
    }

    // Deshabilitar botón mientras se procesa
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creando cuenta...';

    try {
      const response = await fetch('api/auth.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'register',
          username: username,
          email: email,
          password: password
        })
      });

      const data = await response.json();

      if (data.success) {
        showNotification('¡Cuenta creada exitosamente!', 'success');
        
        // Limpiar formulario
        nameInput.value = '';
        emailInput.value = '';
        passInput.value = '';
        pass2Input.value = '';
        
        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 2000);
      } else {
        showNotification(data.error || 'Error al crear la cuenta', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear cuenta';
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('Error de conexión. Intenta de nuevo.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear cuenta';
    }
  });

  // Permitir enter para enviar
  pass2Input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitBtn.click();
    }
  });

  // Validar contraseñas en tiempo real
  pass2Input.addEventListener('input', () => {
    if (pass2Input.value && passInput.value !== pass2Input.value) {
      pass2Input.style.borderColor = '#ef4444';
    } else {
      pass2Input.style.borderColor = '';
    }
  });

  // Verificar si ya existe una sesión activa
  async function checkExistingSession() {
    try {
      const response = await fetch('api/auth.php?action=check');
      const data = await response.json();

      if (data.authenticated) {
        // Ya hay sesión activa, redirigir a chats
        window.location.href = 'chats.html';
      }
    } catch (error) {
      console.error('Error verificando sesión:', error);
    }
  }

  // Validar formato de email
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Mostrar notificaciones
  function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.textContent = message;
    
    // Estilos inline para la notificación
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      border-radius: 12px;
      font-weight: 600;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      max-width: 400px;
    `;

    // Colores según el tipo
    if (type === 'success') {
      notification.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
      notification.style.color = '#fff';
    } else if (type === 'error') {
      notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      notification.style.color = '#fff';
    } else {
      notification.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
      notification.style.color = '#fff';
    }

    document.body.appendChild(notification);

    // Remover después de 3 segundos
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }

  // Agregar estilos de animación
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
});