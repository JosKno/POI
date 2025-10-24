<?php
/**
 * auth.php
 * Maneja el registro, login, logout y verificación de sesión
 */

require_once 'config.php';

// Configurar headers CORS si es necesario
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Manejar preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$conn = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    // Leer el cuerpo de la petición
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode(['success' => false, 'error' => 'JSON inválido']);
        closeDBConnection($conn);
        exit();
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
            echo json_encode(['success' => false, 'error' => 'Acción POST no válida']);
    }
    
} else if ($method === 'GET') {
    $action = $_GET['action'] ?? '';
    
    if ($action === 'check') {
        checkAuth($conn);
    } else {
        echo json_encode(['success' => false, 'error' => 'Acción GET no válida']);
    }
    
} else {
    echo json_encode(['success' => false, 'error' => 'Método no válido']);
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
        echo json_encode(['success' => false, 'error' => 'Todos los campos son obligatorios']);
        return;
    }
    
    if (strlen($username) < 3) {
        echo json_encode(['success' => false, 'error' => 'El nombre debe tener al menos 3 caracteres']);
        return;
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'error' => 'Correo electrónico no válido']);
        return;
    }
    
    if (strlen($password) < 6) {
        echo json_encode(['success' => false, 'error' => 'La contraseña debe tener al menos 6 caracteres']);
        return;
    }
    
    // Verificar si el email ya existe
    $stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        echo json_encode(['success' => false, 'error' => 'Este correo ya está registrado']);
        $stmt->close();
        return;
    }
    $stmt->close();
    
    // Hash de la contraseña
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);
    
    // Insertar nuevo usuario
    $stmt = $conn->prepare("INSERT INTO users (username, email, password, gems) VALUES (?, ?, ?, 100)");
    $stmt->bind_param("sss", $username, $email, $hashed_password);
    
    if ($stmt->execute()) {
        $user_id = $conn->insert_id;
        
        echo json_encode([
            'success' => true, 
            'message' => 'Registro exitoso',
            'user' => [
                'id' => $user_id,
                'username' => $username,
                'email' => $email
            ]
        ]);
    } else {
        // Error al insertar
        if ($conn->errno === 1062) {
            echo json_encode(['success' => false, 'error' => 'El correo ya está en uso']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Error al crear la cuenta. Intenta de nuevo.']);
        }
    }
    
    $stmt->close();
}

/**
 * Iniciar sesión
 */
function login($conn, $data) {
    $email = sanitize($data['email'] ?? '');
    $password = $data['password'] ?? '';
    
    // Validaciones
    if (empty($email) || empty($password)) {
        echo json_encode(['success' => false, 'error' => 'Email y contraseña son obligatorios']);
        return;
    }
    
    // Buscar usuario por email
    $stmt = $conn->prepare("SELECT id, username, email, password FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'error' => 'Credenciales incorrectas']);
        $stmt->close();
        return;
    }
    
    $user = $result->fetch_assoc();
    $stmt->close();
    
    // Verificar contraseña
    if (!password_verify($password, $user['password'])) {
        echo json_encode(['success' => false, 'error' => 'Credenciales incorrectas']);
        return;
    }
    
    // Actualizar estado a online
    $stmt_update = $conn->prepare("UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE id = ?");
    $stmt_update->bind_param("i", $user['id']);
    $stmt_update->execute();
    $stmt_update->close();
    
    // Crear sesión
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['email'] = $user['email'];
    $_SESSION['logged_in'] = true;
    $_SESSION['login_time'] = time();
    
    echo json_encode([
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
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $stmt->close();
        
        // Obtener información actualizada del usuario
        $stmt = $conn->prepare("SELECT id, username, email, gems, avatar_url FROM users WHERE id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows > 0) {
            $user = $result->fetch_assoc();
            echo json_encode([
                'authenticated' => true,
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'email' => $user['email'],
                    'gems' => $user['gems'],
                    'avatar_url' => $user['avatar_url']
                ]
            ]);
        } else {
            echo json_encode(['authenticated' => false]);
        }
        
        $stmt->close();
    } else {
        echo json_encode(['authenticated' => false]);
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
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $stmt->close();
    }
    
    // Destruir sesión
    session_unset();
    session_destroy();
    
    echo json_encode(['success' => true, 'message' => 'Sesión cerrada']);
}
?>