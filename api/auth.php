<?php
/**
 * auth.php - CORREGIDO
 * Sistema de autenticación completo
 */

// Headers para JSON y CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

// Responder a OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Iniciar sesión
session_start();

require_once 'config.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    switch ($action) {
        case 'login':
            login($conn);
            break;
            
        case 'register':
            register($conn);
            break;
            
        case 'check':
            checkAuth();
            break;
            
        case 'logout':
            logout();
            break;
            
        default:
            throw new Exception('Acción no válida');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Login
 */
function login($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    
    if (empty($email) || empty($password)) {
        throw new Exception('Email y contraseña son requeridos');
    }
    
    $stmt = $conn->prepare("SELECT id, username, email, password, avatar_url, gems FROM users WHERE email = ?");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($row = $result->fetch_assoc()) {
        // Verificar contraseña
        if (password_verify($password, $row['password'])) {
            // Actualizar estado online
            $updateStmt = $conn->prepare("UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE id = ?");
            $updateStmt->bind_param('i', $row['id']);
            $updateStmt->execute();
            
            // Guardar en sesión
            $_SESSION['user_id'] = $row['id'];
            $_SESSION['username'] = $row['username'];
            $_SESSION['email'] = $row['email'];
            
            echo json_encode([
                'success' => true,
                'user' => [
                    'id' => intval($row['id']),
                    'username' => $row['username'],
                    'email' => $row['email'],
                    'avatar_url' => $row['avatar_url'],
                    'gems' => intval($row['gems'])
                ]
            ]);
        } else {
            throw new Exception('Contraseña incorrecta');
        }
    } else {
        throw new Exception('Usuario no encontrado');
    }
    
    $conn->close();
}

/**
 * Registro
 */
function register($conn) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $username = trim($data['username'] ?? '');
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    
    if (empty($username) || empty($email) || empty($password)) {
        throw new Exception('Todos los campos son requeridos');
    }
    
    // Verificar si el email ya existe
    $stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        throw new Exception('El email ya está registrado');
    }
    
    // Hash de la contraseña
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    
    // Insertar usuario
    $stmt = $conn->prepare("INSERT INTO users (username, email, password, gems) VALUES (?, ?, ?, 100)");
    $stmt->bind_param('sss', $username, $email, $hashedPassword);
    
    if ($stmt->execute()) {
        $userId = $conn->insert_id;
        
        // Iniciar sesión automáticamente
        $_SESSION['user_id'] = $userId;
        $_SESSION['username'] = $username;
        $_SESSION['email'] = $email;
        
        echo json_encode([
            'success' => true,
            'user' => [
                'id' => $userId,
                'username' => $username,
                'email' => $email,
                'gems' => 100
            ]
        ]);
    } else {
        throw new Exception('Error al crear usuario');
    }
    
    $conn->close();
}

/**
 * Verificar autenticación
 */
function checkAuth() {
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'authenticated' => true,
            'user' => [
                'id' => $_SESSION['user_id'],
                'username' => $_SESSION['username'] ?? '',
                'email' => $_SESSION['email'] ?? ''
            ]
        ]);
    } else {
        echo json_encode([
            'authenticated' => false
        ]);
    }
}

/**
 * Cerrar sesión
 */
function logout() {
    // Actualizar estado offline en BD
    if (isset($_SESSION['user_id'])) {
        require_once 'config.php';
        $stmt = $conn->prepare("UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE id = ?");
        $stmt->bind_param('i', $_SESSION['user_id']);
        $stmt->execute();
        $conn->close();
    }
    
    // Destruir sesión
    $_SESSION = array();
    
    if (isset($_COOKIE[session_name()])) {
        setcookie(session_name(), '', time() - 3600, '/');
    }
    
    session_destroy();
    
    echo json_encode([
        'success' => true,
        'message' => 'Sesión cerrada correctamente'
    ]);
}
?>