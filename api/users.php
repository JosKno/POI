<?php
/**
 * users.php - CORREGIDO
 * API para gestión de usuarios SIN ERROR 500
 */

// Evitar cualquier salida antes de headers
ob_start();

// Configurar headers ANTES de cualquier salida
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

// Limpiar buffer
ob_end_clean();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

session_start();

require_once __DIR__ . '/config.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'No autenticado']);
    exit();
}

// Obtener conexión a la base de datos
$conn = getDBConnection();

$action = $_GET['action'] ?? '';
$userId = $_SESSION['user_id'];

try {
    switch ($action) {
        case 'list':
            listUsers($conn, $userId);
            break;
            
        case 'search':
            searchUsers($conn, $userId);
            break;
            
        case 'profile':
            getUserProfile($conn, $userId);
            break;
            
        default:
            throw new Exception('Acción no válida: ' . $action);
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

closeDBConnection($conn);

function listUsers($conn, $userId) {
    $stmt = $conn->prepare("
        SELECT id, username, email, avatar_url, is_online, gems 
        FROM users 
        WHERE id != ?
        ORDER BY username ASC
    ");
    
    if (!$stmt) {
        throw new Exception('Error en la consulta: ' . $conn->error);
    }
    
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = [
            'id' => intval($row['id']),
            'username' => $row['username'],
            'email' => $row['email'],
            'avatar_url' => $row['avatar_url'] ?: null,
            'is_online' => (bool)$row['is_online'],
            'gems' => intval($row['gems'])
        ];
    }
    
    $stmt->close();
    
    echo json_encode([
        'success' => true,
        'users' => $users
    ]);
}

function searchUsers($conn, $userId) {
    $query = trim($_GET['q'] ?? '');
    
    if (empty($query)) {
        echo json_encode(['success' => true, 'users' => []]);
        return;
    }
    
    $searchTerm = "%{$query}%";
    
    $stmt = $conn->prepare("
        SELECT id, username, email, avatar_url, is_online, gems 
        FROM users 
        WHERE id != ? 
        AND (username LIKE ? OR email LIKE ?)
        LIMIT 20
    ");
    
    if (!$stmt) {
        throw new Exception('Error en la consulta: ' . $conn->error);
    }
    
    $stmt->bind_param('iss', $userId, $searchTerm, $searchTerm);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = [
            'id' => intval($row['id']),
            'username' => $row['username'],
            'email' => $row['email'],
            'avatar_url' => $row['avatar_url'] ?: null,
            'is_online' => (bool)$row['is_online'],
            'gems' => intval($row['gems'])
        ];
    }
    
    $stmt->close();
    
    echo json_encode([
        'success' => true,
        'users' => $users
    ]);
}

function getUserProfile($conn, $userId) {
    $requestedUserId = $_GET['user_id'] ?? $userId;
    
    $stmt = $conn->prepare("
        SELECT id, username, email, avatar_url, is_online, gems, created_at
        FROM users 
        WHERE id = ?
    ");
    
    if (!$stmt) {
        throw new Exception('Error en la consulta: ' . $conn->error);
    }
    
    $stmt->bind_param('i', $requestedUserId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $stmt->close();
        throw new Exception('Usuario no encontrado');
    }
    
    $user = $result->fetch_assoc();
    $stmt->close();
    
    echo json_encode([
        'success' => true,
        'user' => [
            'id' => intval($user['id']),
            'username' => $user['username'],
            'email' => $user['email'],
            'avatar_url' => $user['avatar_url'] ?: null,
            'is_online' => (bool)$user['is_online'],
            'gems' => intval($user['gems']),
            'created_at' => $user['created_at']
        ]
    ]);
}
?>