<?php
/**
 * groups.php - CORREGIDO COMPLETAMENTE
 * API para gestión de grupos con búsqueda por email
 */

// Configurar headers ANTES de cualquier salida
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

// Manejar preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Iniciar sesión
session_start();

// Incluir configuración
require_once __DIR__ . '/config.php';

// Verificar autenticación
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'No autenticado']);
    exit();
}

// Obtener conexión a la base de datos
$conn = getDBConnection();

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
            
        case 'search_users':
            searchUsersByEmail($conn, $userId);
            break;
            
        case 'details':
            getGroupDetails($conn, $userId);
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

/**
 * Obtener grupos del usuario
 */
function getMyGroups($conn, $userId) {
    $stmt = $conn->prepare("
        SELECT 
            g.id, 
            g.name, 
            g.description, 
            g.avatar_url,
            g.created_at,
            g.updated_at,
            COUNT(gm.user_id) as member_count
        FROM grupo g
        INNER JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = ?
        GROUP BY g.id, g.name, g.description, g.avatar_url, g.created_at, g.updated_at
        ORDER BY g.updated_at DESC
    ");
    
    if (!$stmt) {
        throw new Exception('Error en la consulta: ' . $conn->error);
    }
    
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
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'groups' => $groups
    ]);
    
    $stmt->close();
}

/**
 * Crear grupo con miembros por email
 */
function createGroup($conn, $userId) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('JSON inválido: ' . json_last_error_msg());
    }
    
    $name = trim($data['name'] ?? '');
    $description = trim($data['description'] ?? '');
    $memberEmails = $data['member_emails'] ?? [];
    
    if (empty($name)) {
        throw new Exception('El nombre del grupo es requerido');
    }
    
    // Iniciar transacción
    $conn->begin_transaction();
    
    try {
        // Crear grupo
        $stmt = $conn->prepare("
            INSERT INTO grupo (name, description, created_by) 
            VALUES (?, ?, ?)
        ");
        
        if (!$stmt) {
            throw new Exception('Error al preparar consulta: ' . $conn->error);
        }
        
        $stmt->bind_param('ssi', $name, $description, $userId);
        
        if (!$stmt->execute()) {
            throw new Exception('Error al crear grupo: ' . $stmt->error);
        }
        
        $groupId = $conn->insert_id;
        $stmt->close();
        
        // Agregar creador como admin
        $stmt = $conn->prepare("
            INSERT INTO group_members (group_id, user_id, role) 
            VALUES (?, ?, 'admin')
        ");
        
        if (!$stmt) {
            throw new Exception('Error al preparar consulta de miembro: ' . $conn->error);
        }
        
        $stmt->bind_param('ii', $groupId, $userId);
        
        if (!$stmt->execute()) {
            throw new Exception('Error al agregar creador: ' . $stmt->error);
        }
        
        $stmt->close();
        
        // Agregar miembros por email
        $addedCount = 0;
        if (!empty($memberEmails) && is_array($memberEmails)) {
            $stmt = $conn->prepare("
                SELECT id FROM users WHERE email = ? AND id != ?
            ");
            
            if (!$stmt) {
                throw new Exception('Error al preparar búsqueda de usuarios: ' . $conn->error);
            }
            
            $insertStmt = $conn->prepare("
                INSERT IGNORE INTO group_members (group_id, user_id, role) 
                VALUES (?, ?, 'member')
            ");
            
            if (!$insertStmt) {
                throw new Exception('Error al preparar inserción de miembros: ' . $conn->error);
            }
            
            foreach ($memberEmails as $email) {
                $email = trim($email);
                if (empty($email)) continue;
                
                $stmt->bind_param('si', $email, $userId);
                $stmt->execute();
                $result = $stmt->get_result();
                
                if ($row = $result->fetch_assoc()) {
                    $memberId = $row['id'];
                    $insertStmt->bind_param('ii', $groupId, $memberId);
                    
                    if ($insertStmt->execute() && $insertStmt->affected_rows > 0) {
                        $addedCount++;
                    }
                }
            }
            
            $stmt->close();
            $insertStmt->close();
        }
        
        // Confirmar transacción
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'group_id' => $groupId,
            'members_added' => $addedCount,
            'message' => 'Grupo creado exitosamente'
        ]);
        
    } catch (Exception $e) {
        // Revertir transacción en caso de error
        $conn->rollback();
        throw $e;
    }
}

/**
 * Buscar usuarios por email
 */
function searchUsersByEmail($conn, $userId) {
    $email = trim($_GET['email'] ?? '');
    
    if (empty($email)) {
        echo json_encode(['success' => true, 'users' => []]);
        return;
    }
    
    $searchTerm = "%{$email}%";
    
    $stmt = $conn->prepare("
        SELECT id, username, email, avatar_url, gems, is_online
        FROM users 
        WHERE id != ? AND email LIKE ?
        LIMIT 10
    ");
    
    if (!$stmt) {
        throw new Exception('Error en la consulta: ' . $conn->error);
    }
    
    $stmt->bind_param('is', $userId, $searchTerm);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = [
            'id' => intval($row['id']),
            'username' => $row['username'],
            'email' => $row['email'],
            'avatar_url' => $row['avatar_url'],
            'gems' => intval($row['gems']),
            'is_online' => (bool)$row['is_online']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'users' => $users
    ]);
    
    $stmt->close();
}

/**
 * Obtener detalles del grupo
 */
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
    
    if (!$stmt) {
        throw new Exception('Error en la consulta: ' . $conn->error);
    }
    
    $stmt->bind_param('ii', $groupId, $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $stmt->close();
        throw new Exception('No eres miembro de este grupo');
    }
    
    $stmt->close();
    
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
    
    if (!$stmt) {
        throw new Exception('Error en la consulta: ' . $conn->error);
    }
    
    $stmt->bind_param('i', $groupId);
    $stmt->execute();
    $result = $stmt->get_result();
    $group = $result->fetch_assoc();
    $stmt->close();
    
    if (!$group) {
        throw new Exception('Grupo no encontrado');
    }
    
    // Obtener miembros
    $stmt = $conn->prepare("
        SELECT 
            u.id,
            u.username,
            u.email,
            u.avatar_url,
            u.is_online,
            u.gems,
            gm.role,
            gm.joined_at
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ?
        ORDER BY gm.role DESC, u.username ASC
    ");
    
    if (!$stmt) {
        throw new Exception('Error en la consulta: ' . $conn->error);
    }
    
    $stmt->bind_param('i', $groupId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $members = [];
    while ($row = $result->fetch_assoc()) {
        $members[] = [
            'id' => intval($row['id']),
            'username' => $row['username'],
            'email' => $row['email'],
            'avatar_url' => $row['avatar_url'],
            'is_online' => (bool)$row['is_online'],
            'gems' => intval($row['gems']),
            'role' => $row['role'],
            'joined_at' => $row['joined_at']
        ];
    }
    
    $stmt->close();
    
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
?>