<?php
/**
 * auth.php
 * Maneja el registro, login, logout y verificación de sesión
 * VERSIÓN MEJORADA con mejor manejo de errores
 */

// Asegurarse de que no haya salida antes de los headers
ob_start();

require_once __DIR__ . '/config.php';

// Limpiar cualquier salida previa
ob_end_clean();

// Configurar headers CORS y JSON
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Función auxiliar para responder con JSON
function respond($data) {
    echo json_encode($data);
    exit();
}

// Obtener conexión a BD
try {
    $conn = getDBConnection();
} catch (Exception $e) {
    respond(['success' => false, 'error' => 'Error de conexión a la base de datos']);
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    // Leer el cuerpo de la petición
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        respond(['success' => false, 'error' => 'JSON inválido']);
    }
    
    $action = $data['action'] ?? '';
    
    switch ($action) {
        case 'register':
            register($conn, $data);
            break;
        case 'login':
            login($conn, $data);
            break;
        case 'logout':
            logout($conn);
            break;
        default:
            respond(['success' => false, 'error' => 'Acción POST no válida: ' . $action]);
    }
    
} else if ($method === 'GET') {
    $action = $_GET['action'] ?? '';
    
    if ($action === 'check') {
        checkAuth($conn);
    } else {
        respond(['success' => false, 'error' => 'Acción GET no válida']);
    }
    
} else {
    respond(['success' => false, 'error' => 'Método HTTP no válido']);
}

closeDBConnection($conn);

/**
 * Registrar nuevo usuario
 */
function register($conn, $data) {
    $username = sanitize($data['username'] ?? '');
    $email = sanitize($data['email'] ?? '');
    $password = $data['password'] ?? '';
    
    // Validaciones
    if (empty($username) || empty($email) || empty($password)) {
        respond(['success' => false, 'error' => 'Todos los campos son obligatorios']);
    }
    
    if (strlen($username) < 3) {
        respond(['success' => false, 'error' => 'El nombre debe tener al menos 3 caracteres']);
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(['success' => false, 'error' => 'Correo electrónico no válido']);
    }
    
    if (strlen($password) < 6) {
        respond(['success' => false, 'error' => 'La contraseña debe tener al menos 6 caracteres']);
    }
    
    // Verificar si el email ya existe
    $stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
    if (!$stmt) {
        respond(['success' => false, 'error' => 'Error en la base de datos']);
    }
    
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        $stmt->close();
        respond(['success' => false, 'error' => 'Este correo ya está registrado']);
    }
    $stmt->close();
    
    // Hash de la contraseña
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);
    
    // Insertar nuevo usuario
    $stmt = $conn->prepare("INSERT INTO users (username, email, password, gems) VALUES (?, ?, ?, 100)");
    if (!$stmt) {
        respond(['success' => false, 'error' => 'Error al preparar la consulta']);
    }
    
    $stmt->bind_param("sss", $username, $email, $hashed_password);
    
    if ($stmt->execute()) {
        $user_id = $conn->insert_id;
        $stmt->close();
        
        respond([
            'success' => true, 
            'message' => 'Registro exitoso',
            'user' => [
                'id' => $user_id,
                'username' => $username,
                'email' => $email
            ]
        ]);
    } else {
        $error = $stmt->error;
        $stmt->close();
        
        if (strpos($error, 'Duplicate entry') !== false) {
            respond(['success' => false, 'error' => 'El correo ya está en uso']);
        } else {
            respond(['success' => false, 'error' => 'Error al crear la cuenta']);
        }
    }
}

/**
 * Iniciar sesión
 */
function login($conn, $data) {
    $email = sanitize($data['email'] ?? '');
    $password = $data['password'] ?? '';
    
    // Validaciones
    if (empty($email) || empty($password)) {
        respond(['success' => false, 'error' => 'Email y contraseña son obligatorios']);
    }
    
    // Buscar usuario por email
    $stmt = $conn->prepare("SELECT id, username, email, password FROM users WHERE email = ?");
    if (!$stmt) {
        respond(['success' => false, 'error' => 'Error en la base de datos']);
    }
    
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $stmt->close();
        respond(['success' => false, 'error' => 'Credenciales incorrectas']);
    }
    
    $user = $result->fetch_assoc();
    $stmt->close();
    
    // Verificar contraseña
    if (!password_verify($password, $user['password'])) {
        respond(['success' => false, 'error' => 'Credenciales incorrectas']);
    }
    
    // Actualizar estado a online
    $stmt_update = $conn->prepare("UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE id = ?");
    if ($stmt_update) {
        $stmt_update->bind_param("i", $user['id']);
        $stmt_update->execute();
        $stmt_update->close();
    }
    
    // Crear sesión
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['email'] = $user['email'];
    $_SESSION['logged_in'] = true;
    $_SESSION['login_time'] = time();
    
    respond([
        'success' => true,
        'message' => 'Inicio de sesión exitoso',
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email']
        ]
    ]);
}

/**
 * Verificar autenticación
 */
function checkAuth($conn) {
    if (isset($_SESSION['user_id']) && isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) {
        $user_id = $_SESSION['user_id'];
        
        // Actualizar last_seen
        $stmt = $conn->prepare("UPDATE users SET last_seen = NOW(), is_online = TRUE WHERE id = ?");
        if ($stmt) {
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $stmt->close();
        }
        
        // Obtener información actualizada del usuario
        $stmt = $conn->prepare("SELECT id, username, email, gems, avatar_url FROM users WHERE id = ?");
        if (!$stmt) {
            respond(['authenticated' => false, 'error' => 'Error de base de datos']);
        }
        
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows > 0) {
            $user = $result->fetch_assoc();
            $stmt->close();
            
            respond([
                'authenticated' => true,
                'user' => [
                    'id' => (int)$user['id'],
                    'username' => $user['username'],
                    'email' => $user['email'],
                    'gems' => (int)$user['gems'],
                    'avatar_url' => $user['avatar_url']
                ]
            ]);
        } else {
            $stmt->close();
            respond(['authenticated' => false]);
        }
    } else {
        respond(['authenticated' => false]);
    }
}

/**
 * Cerrar sesión
 */
function logout($conn) {
    if (isset($_SESSION['user_id'])) {
        $user_id = $_SESSION['user_id'];
        
        // Actualizar estado a offline
        $stmt = $conn->prepare("UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE id = ?");
        if ($stmt) {
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $stmt->close();
        }
    }
    
    // Destruir sesión
    session_unset();
    session_destroy();
    
    respond(['success' => true, 'message' => 'Sesión cerrada']);
}
?>