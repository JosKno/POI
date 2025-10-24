<?php
/**
 * users.php
 * API para gestión de usuarios
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

session_start();

require_once 'config.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'No autenticado']);
    exit();
}

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
            throw new Exception('Acción no válida');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function listUsers($conn, $userId) {
    $stmt = $conn->prepare("
        SELECT id, username, email, avatar_url, is_online, gems 
        FROM users 
        WHERE id != ?
        ORDER BY username ASC
    ");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = [
            'id' => intval($row['id']),
            'username' => $row['username'],
            'email' => $row['email'],
            'avatar_url' => $row['avatar_url'],
            'is_online' => (bool)$row['is_online'],
            'gems' => intval($row['gems'])
        ];
    }
    
    echo json_encode([
        'success' => true,
        'users' => $users
    ]);
}

function searchUsers($conn, $userId) {
    $query = $_GET['q'] ?? '';
    
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
        ORDER BY username ASC
        LIMIT 20
    ");
    $stmt->bind_param('iss', $userId, $searchTerm, $searchTerm);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = [
            'id' => intval($row['id']),
            'username' => $row['username'],
            'email' => $row['email'],
            'avatar_url' => $row['avatar_url'],
            'is_online' => (bool)$row['is_online'],
            'gems' => intval($row['gems'])
        ];
    }
    
    echo json_encode([
        'success' => true,
        'users' => $users
    ]);
}

function getUserProfile($conn, $userId) {
    $profileId = $_GET['id'] ?? $userId;
    
    $stmt = $conn->prepare("
        SELECT id, username, email, avatar_url, is_online, last_seen, gems, created_at 
        FROM users 
        WHERE id = ?
    ");
    $stmt->bind_param('i', $profileId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($row = $result->fetch_assoc()) {
        echo json_encode([
            'success' => true,
            'user' => [
                'id' => intval($row['id']),
                'username' => $row['username'],
                'email' => $row['email'],
                'avatar_url' => $row['avatar_url'],
                'is_online' => (bool)$row['is_online'],
                'last_seen' => $row['last_seen'],
                'gems' => intval($row['gems']),
                'created_at' => $row['created_at']
            ]
        ]);
    } else {
        throw new Exception('Usuario no encontrado');
    }
}

$conn->close();
?>