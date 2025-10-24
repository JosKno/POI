/**
 * login.js - CORREGIDO
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const emailInput = document.getElementById('loginEmail');
      const passwordInput = document.getElementById('loginPassword');
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      
      if (!email || !password) {
        alert('Por favor completa todos los campos');
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Iniciando sesión...';
      
      try {
        // ⭐ IMPORTANTE: action en la URL
        const response = await fetch('/api/auth.php?action=login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: email,
            password: password
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          localStorage.setItem('user', JSON.stringify(data.user));
          window.location.href = 'chats.html';
        } else {
          alert(data.error || 'Error al iniciar sesión');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Iniciar sesión';
        }
      } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Iniciar sesión';
      }
    });
  }
});