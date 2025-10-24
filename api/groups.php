<?php
/**
 * groups.php
 * API para gestión de grupos
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

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$userId = $_SESSION['user_id'];

try {
    switch ($action) {
        case 'my_groups':
            getMyGroups($conn, $userId);
            break;
            
        case 'create':
            createGroup($conn, $userId);
            break;
            
        case 'details':
            getGroupDetails($conn, $userId);
            break;
            
        case 'add_member':
            addMember($conn, $userId);
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

function getMyGroups($conn, $userId) {
    $stmt = $conn->prepare("
        SELECT 
            g.id, 
            g.name, 
            g.description, 
            g.avatar_url,
            g.created_at,
            COUNT(gm.user_id) as member_count
        FROM grupo g
        INNER JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = ?
        GROUP BY g.id, g.name, g.description, g.avatar_url, g.created_at
        ORDER BY g.updated_at DESC
    ");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $groups = [];
    while ($row = $result->fetch_assoc()) {
        $groups[] = [
            'id' => intval($row['id']),
            'name' => $row['name'],
            'description' => $row['description'],
            'avatar_url' => $row['avatar_url'],
            'member_count' => intval($row['member_count']),
            'created_at' => $row['created_at']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'groups' => $groups
    ]);
}

function createGroup($conn, $userId) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $name = trim($data['name'] ?? '');
    $description = trim($data['description'] ?? '');
    $members = $data['members'] ?? [];
    
    if (empty($name)) {
        throw new Exception('El nombre del grupo es requerido');
    }
    
    // Crear grupo
    $stmt = $conn->prepare("
        INSERT INTO grupo (name, description, created_by) 
        VALUES (?, ?, ?)
    ");
    $stmt->bind_param('ssi', $name, $description, $userId);
    
    if (!$stmt->execute()) {
        throw new Exception('Error al crear grupo');
    }
    
    $groupId = $conn->insert_id;
    
    // Agregar creador como admin
    $stmt = $conn->prepare("
        INSERT INTO group_members (group_id, user_id, role) 
        VALUES (?, ?, 'admin')
    ");
    $stmt->bind_param('ii', $groupId, $userId);
    $stmt->execute();
    
    // Agregar miembros
    if (!empty($members)) {
        $stmt = $conn->prepare("
            INSERT INTO group_members (group_id, user_id, role) 
            VALUES (?, ?, 'member')
        ");
        
        foreach ($members as $memberId) {
            if ($memberId != $userId) {
                $stmt->bind_param('ii', $groupId, $memberId);
                $stmt->execute();
            }
        }
    }
    
    echo json_encode([
        'success' => true,
        'group_id' => $groupId,
        'message' => 'Grupo creado exitosamente'
    ]);
}

function getGroupDetails($conn, $userId) {
    $groupId = $_GET['id'] ?? null;
    
    if (!$groupId) {
        throw new Exception('ID de grupo requerido');
    }
    
    // Verificar que el usuario es miembro
    $stmt = $conn->prepare("
        SELECT 1 FROM group_members 
        WHERE group_id = ? AND user_id = ?
    ");
    $stmt->bind_param('ii', $groupId, $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('No eres miembro de este grupo');
    }
    
    // Obtener detalles del grupo
    $stmt = $conn->prepare("
        SELECT 
            g.id, 
            g.name, 
            g.description, 
            g.avatar_url,
            g.created_by,
            g.created_at,
            u.username as creator_name
        FROM grupo g
        JOIN users u ON g.created_by = u.id
        WHERE g.id = ?
    ");
    $stmt->bind_param('i', $groupId);
    $stmt->execute();
    $result = $stmt->get_result();
    $group = $result->fetch_assoc();
    
    // Obtener miembros
    $stmt = $conn->prepare("
        SELECT 
            u.id,
            u.username,
            u.avatar_url,
            u.is_online,
            gm.role,
            gm.joined_at
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ?
        ORDER BY gm.role DESC, u.username ASC
    ");
    $stmt->bind_param('i', $groupId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $members = [];
    while ($row = $result->fetch_assoc()) {
        $members[] = [
            'id' => intval($row['id']),
            'username' => $row['username'],
            'avatar_url' => $row['avatar_url'],
            'is_online' => (bool)$row['is_online'],
            'role' => $row['role'],
            'joined_at' => $row['joined_at']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'group' => [
            'id' => intval($group['id']),
            'name' => $group['name'],
            'description' => $group['description'],
            'avatar_url' => $group['avatar_url'],
            'created_by' => intval($group['created_by']),
            'creator_name' => $group['creator_name'],
            'created_at' => $group['created_at']
        ],
        'members' => $members
    ]);
}

function addMember($conn, $userId) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $groupId = $data['group_id'] ?? null;
    $memberId = $data['user_id'] ?? null;
    
    if (!$groupId || !$memberId) {
        throw new Exception('Datos incompletos');
    }
    
    // Verificar que el usuario es admin del grupo
    $stmt = $conn->prepare("
        SELECT role FROM group_members 
        WHERE group_id = ? AND user_id = ?
    ");
    $stmt->bind_param('ii', $groupId, $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    
    if (!$row || $row['role'] !== 'admin') {
        throw new Exception('No tienes permisos para agregar miembros');
    }
    
    // Agregar miembro
    $stmt = $conn->prepare("
        INSERT INTO group_members (group_id, user_id, role) 
        VALUES (?, ?, 'member')
    ");
    $stmt->bind_param('ii', $groupId, $memberId);
    
    if (!$stmt->execute()) {
        if ($conn->errno === 1062) {
            throw new Exception('El usuario ya es miembro del grupo');
        }
        throw new Exception('Error al agregar miembro');
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Miembro agregado exitosamente'
    ]);
}

$conn->close();
?>