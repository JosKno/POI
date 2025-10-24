/**
 * register.js - CORREGIDO
 */

document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const usernameInput = document.getElementById('registerUsername');
      const emailInput = document.getElementById('registerEmail');
      const passwordInput = document.getElementById('registerPassword');
      const confirmPasswordInput = document.getElementById('confirmPassword');
      const submitBtn = registerForm.querySelector('button[type="submit"]');
      
      const username = usernameInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const confirmPassword = confirmPasswordInput.value;
      
      if (!username || !email || !password || !confirmPassword) {
        alert('Por favor completa todos los campos');
        return;
      }
      
      if (password !== confirmPassword) {
        alert('Las contraseñas no coinciden');
        return;
      }
      
      if (password.length < 6) {
        alert('La contraseña debe tener al menos 6 caracteres');
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registrando...';
      
      try {
        // ⭐ IMPORTANTE: action en la URL
        const response = await fetch('/api/auth.php?action=register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: username,
            email: email,
            password: password
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          localStorage.setItem('user', JSON.stringify(data.user));
          alert('¡Registro exitoso! Redirigiendo...');
          window.location.href = 'chats.html';
        } else {
          alert(data.error || 'Error al registrar');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Registrarse';
        }
      } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Registrarse';
      }
    });
  }
});