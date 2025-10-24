<?php
require_once 'config.php';

$conn = getDBConnection();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
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
} else if ($method === 'GET' && $action === 'check') {
    checkAuth($conn);
} else {
    echo json_encode(['success' => false, 'error' => 'Método no válido']);
}

closeDBConnection($conn);

function register($conn, $data) {
    $username = sanitize($data['username'] ?? '');
    $email = sanitize($data['email'] ?? '');
    $password = $data['password'] ?? '';
    
    if (empty($username) || empty($email) || empty($password)) {
        echo json_encode(['success' => false, 'error' => 'Todos los campos son obligatorios']);
        return;
    }
    
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $username, $email, $hashed_password);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Registro exitoso']);
    } else {
        echo json_encode(['success' => false, 'error' => 'El email ya está en uso.']);
    }
    $stmt->close();
}

function login($conn, $data) {
    $email = sanitize($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $stmt = $conn->prepare("SELECT id, username, email, password FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'error' => 'Credenciales incorrectas']);
        return;
    }
    
    $user = $result->fetch_assoc();
    if (!password_verify($password, $user['password'])) {
        echo json_encode(['success' => false, 'error' => 'Credenciales incorrectas']);
        return;
    }
    
    $stmt_update = $conn->prepare("UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE id = ?");
    $stmt_update->bind_param("i", $user['id']);
    $stmt_update->execute();
    
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['email'] = $user['email'];
    
    echo json_encode(['success' => true, 'user' => ['id' => $user['id'], 'username' => $user['username'], 'email' => $user['email']]]);
}

function checkAuth($conn) {
    if (isset($_SESSION['user_id'])) {
        $user_id = $_SESSION['user_id'];
        $stmt = $conn->prepare("UPDATE users SET last_seen = NOW(), is_online = TRUE WHERE id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        echo json_encode(['authenticated' => true, 'user' => ['id' => $_SESSION['user_id'], 'username' => $_SESSION['username'], 'email' => $_SESSION['email']]]);
    } else {
        echo json_encode(['authenticated' => false]);
    }
}

function logout($conn) {
    if (isset($_SESSION['user_id'])) {
        $user_id = $_SESSION['user_id'];
        $stmt = $conn->prepare("UPDATE users SET is_online = FALSE WHERE id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
    }
    session_destroy();
    echo json_encode(['success' => true]);
}
?>