<?php
/**
 * auth.php - VERSIÓN ORIGINAL + LOGOUT
 * Solo se agregó el caso 'logout', todo lo demás igual
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

session_start();
require_once 'config.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

if ($action === 'register') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $username = $data['username'] ?? '';
    $email = $data['email'] ?? '';
    $password = $data['password'] ?? '';
    
    if (empty($username) || empty($email) || empty($password)) {
        echo json_encode(['success' => false, 'error' => 'Todos los campos son requeridos']);
        exit;
    }
    
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    
    $stmt = $conn->prepare("INSERT INTO users (username, email, password, gems) VALUES (?, ?, ?, 100)");
    $stmt->bind_param('sss', $username, $email, $hashedPassword);
    
    if ($stmt->execute()) {
        $_SESSION['user_id'] = $conn->insert_id;
        $_SESSION['username'] = $username;
        echo json_encode(['success' => true, 'user' => ['id' => $conn->insert_id, 'username' => $username]]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Error al registrar usuario']);
    }
    exit;
}

if ($action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $email = $data['email'] ?? '';
    $password = $data['password'] ?? '';
    
    if (empty($email) || empty($password)) {
        echo json_encode(['success' => false, 'error' => 'Email y contraseña requeridos']);
        exit;
    }
    
    $stmt = $conn->prepare("SELECT id, username, password FROM users WHERE email = ?");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($row = $result->fetch_assoc()) {
        if (password_verify($password, $row['password'])) {
            $_SESSION['user_id'] = $row['id'];
            $_SESSION['username'] = $row['username'];
            
            // Actualizar estado online
            $updateStmt = $conn->prepare("UPDATE users SET is_online = 1 WHERE id = ?");
            $updateStmt->bind_param('i', $row['id']);
            $updateStmt->execute();
            
            echo json_encode(['success' => true, 'user' => ['id' => $row['id'], 'username' => $row['username']]]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Contraseña incorrecta']);
        }
    } else {
        echo json_encode(['success' => false, 'error' => 'Usuario no encontrado']);
    }
    exit;
}

if ($action === 'check') {
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
        echo json_encode(['authenticated' => false]);
    }
    exit;
}

// ⭐ NUEVO: Solo agregamos el caso logout
if ($action === 'logout') {
    // Actualizar estado offline en BD
    if (isset($_SESSION['user_id'])) {
        $stmt = $conn->prepare("UPDATE users SET is_online = 0, last_seen = NOW() WHERE id = ?");
        $stmt->bind_param('i', $_SESSION['user_id']);
        $stmt->execute();
    }
    
    // Destruir sesión
    $_SESSION = array();
    
    if (isset($_COOKIE[session_name()])) {
        setcookie(session_name(), '', time() - 3600, '/');
    }
    
    session_destroy();
    
    echo json_encode(['success' => true, 'message' => 'Sesión cerrada']);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Acción no válida']);
?>