<?php
/**
 * messages.php
 * API para mensajes en tiempo real - ADAPTADA A TU BASE DE DATOS
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

session_start();

require_once 'config.php';

// Verificar autenticación
if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        'success' => false,
        'error' => 'No autenticado'
    ]);
    exit();
}

// Obtener conexión a la base de datos (✅ FIX 1: Inicialización de $conn)
try {
    $conn = getDBConnection();
} catch (Exception $e) {
    // getDBConnection ya maneja la salida si falla
    exit(); 
}

// Parsear cuerpo JSON para acciones POST (✅ FIX 2: Pre-procesamiento de JSON para obtener 'action')
$data = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    // Si no es JSON válido, $data será array vacío.
    $data = json_decode($input, true) ?? [];
}

// Obtener acción: GET param > POST body
$action = $_GET['action'] ?? $data['action'] ?? '';

$userId = $_SESSION['user_id'];

try {
    switch ($action) {
        case 'send':
            // ✅ FIX 3: Pasar el cuerpo JSON ya parseado a la función
            sendMessage($conn, $userId, $data); 
            break;
            
        case 'get':
            getMessages($conn, $userId);
            break;
            
        case 'poll':
            pollMessages($conn, $userId);
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

// Cerrar conexión
closeDBConnection($conn);

/**
 * Enviar un mensaje
 * (✅ MODIFICACIÓN: Acepta $data como tercer parámetro)
 */
function sendMessage($conn, $userId, $data) { 
    // ❌ CÓDIGO ELIMINADO: ya no lee el input aquí.
    
    $receiverId = $data['receiver_id'] ?? null;
    $groupId = $data['group_id'] ?? null;
    $messageText = trim($data['message'] ?? '');
    $messageType = $data['type'] ?? 'text';
    $fileUrl = $data['file_url'] ?? null;
    $isEncrypted = ($data['encrypted'] ?? false) ? 1 : 0;
    
    // Validar que hay un destinatario
    if (!$receiverId && !$groupId) {
        throw new Exception('Debes especificar un destinatario o grupo');
    }
    
    // Validar que hay mensaje
    if (empty($messageText) && empty($fileUrl)) {
        throw new Exception('El mensaje no puede estar vacío');
    }
    
    $conversationId = null;
    
    // Si es chat privado, obtener o crear conversación
    if ($receiverId) {
        // Buscar conversación existente
        $stmt = $conn->prepare("
            SELECT id FROM conversations 
            WHERE (user1_id = ? AND user2_id = ?) 
               OR (user1_id = ? AND user2_id = ?)
            LIMIT 1
        ");
        $stmt->bind_param('iiii', $userId, $receiverId, $receiverId, $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($row = $result->fetch_assoc()) {
            $conversationId = $row['id'];
        } else {
            // Crear nueva conversación
            $stmt = $conn->prepare("
                INSERT INTO conversations (user1_id, user2_id) 
                VALUES (?, ?)
            ");
            $stmt->bind_param('ii', $userId, $receiverId);
            $stmt->execute();
            $conversationId = $conn->insert_id;
        }
    }
    
    // Insertar mensaje
    $stmt = $conn->prepare("
        INSERT INTO messages 
        (sender_id, conversation_id, group_id, content, message_type, file_url, is_encrypted) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    
    $stmt->bind_param(
        'iiisssi',
        $userId,
        $conversationId,
        $groupId,
        $messageText,
        $messageType,
        $fileUrl,
        $isEncrypted
    );
    
    if (!$stmt->execute()) {
        throw new Exception('Error al enviar mensaje: ' . $stmt->error);
    }
    
    $messageId = $conn->insert_id;
    
    // Obtener información del remitente
    $stmt = $conn->prepare("
        SELECT username, avatar_url, gems 
        FROM users 
        WHERE id = ?
    ");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $sender = $result->fetch_assoc();
    
    echo json_encode([
        'success' => true,
        'message_id' => $messageId,
        'sender' => [
            'id' => $userId,
            'username' => $sender['username'],
            'avatar_url' => $sender['avatar_url'],
            'gems' => $sender['gems']
        ],
        'sent_at' => date('Y-m-d H:i:s')
    ]);
}

/**
 * Obtener mensajes de un chat (privado o grupal)
 */
function getMessages($conn, $userId) {
    $receiverId = $_GET['receiver_id'] ?? null;
    $groupId = $_GET['group_id'] ?? null;
    $lastMessageId = $_GET['last_id'] ?? 0;
    $limit = min(intval($_GET['limit'] ?? 50), 100);
    
    if ($groupId) {
        // Mensajes grupales
        $stmt = $conn->prepare("
            SELECT 
                m.id,
                m.sender_id,
                m.content,
                m.message_type,
                m.file_url,
                m.is_encrypted,
                m.created_at,
                u.username,
                u.avatar_url,
                u.gems
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.group_id = ? AND m.id > ?
            ORDER BY m.created_at ASC
            LIMIT ?
        ");
        $stmt->bind_param('iii', $groupId, $lastMessageId, $limit);
        
    } else if ($receiverId) {
        // Mensajes privados - primero obtener/crear conversación
        $stmt = $conn->prepare("
            SELECT id FROM conversations 
            WHERE (user1_id = ? AND user2_id = ?) 
               OR (user1_id = ? AND user2_id = ?)
            LIMIT 1
        ");
        $stmt->bind_param('iiii', $userId, $receiverId, $receiverId, $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $conversationId = null;
        if ($row = $result->fetch_assoc()) {
            $conversationId = $row['id'];
        }
        
        if ($conversationId) {
            $stmt = $conn->prepare("
                SELECT 
                    m.id,
                    m.sender_id,
                    m.content,
                    m.message_type,
                    m.file_url,
                    m.is_encrypted,
                    m.created_at,
                    u.username,
                    u.avatar_url,
                    u.gems
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.conversation_id = ? AND m.id > ?
                ORDER BY m.created_at ASC
                LIMIT ?
            ");
            $stmt->bind_param('iii', $conversationId, $lastMessageId, $limit);
        } else {
            // No hay conversación todavía
            echo json_encode([
                'success' => true,
                'messages' => [],
                'count' => 0
            ]);
            return;
        }
        
    } else {
        throw new Exception('Debes especificar receiver_id o group_id');
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    $messages = [];
    while ($row = $result->fetch_assoc()) {
        $messages[] = [
            'id' => intval($row['id']),
            'sender_id' => intval($row['sender_id']),
            'message' => $row['content'],
            'type' => $row['message_type'],
            'file_url' => $row['file_url'],
            'encrypted' => (bool)$row['is_encrypted'],
            'sent_at' => $row['created_at'],
            'sender' => [
                'username' => $row['username'],
                'avatar_url' => $row['avatar_url'],
                'gems' => intval($row['gems'])
            ],
            'is_mine' => intval($row['sender_id']) === $userId
        ];
    }
    
    echo json_encode([
        'success' => true,
        'messages' => $messages,
        'count' => count($messages)
    ]);
}

/**
 * Long polling: espera hasta que haya mensajes nuevos
 */
function pollMessages($conn, $userId) {
    $receiverId = $_GET['receiver_id'] ?? null;
    $groupId = $_GET['group_id'] ?? null;
    $lastMessageId = intval($_GET['last_id'] ?? 0);
    
    // Timeout de 30 segundos
    $timeout = 30;
    $startTime = time();
    
    while (time() - $startTime < $timeout) {
        if ($groupId) {
            $stmt = $conn->prepare("
                SELECT COUNT(*) as count 
                FROM messages 
                WHERE group_id = ? AND id > ?
            ");
            $stmt->bind_param('ii', $groupId, $lastMessageId);
            
        } else if ($receiverId) {
            // Obtener conversationId
            $stmt = $conn->prepare("
                SELECT id FROM conversations 
                WHERE (user1_id = ? AND user2_id = ?) 
                   OR (user1_id = ? AND user2_id = ?)
                LIMIT 1
            ");
            $stmt->bind_param('iiii', $userId, $receiverId, $receiverId, $userId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            $conversationId = null;
            if ($row = $result->fetch_assoc()) {
                $conversationId = $row['id'];
            }
            
            if ($conversationId) {
                $stmt = $conn->prepare("
                    SELECT COUNT(*) as count 
                    FROM messages 
                    WHERE conversation_id = ? AND id > ?
                ");
                $stmt->bind_param('ii', $conversationId, $lastMessageId);
            } else {
                // No hay conversación, devolver vacío
                echo json_encode([
                    'success' => true,
                    'messages' => [],
                    'count' => 0,
                    'timeout' => true
                ]);
                return;
            }
            
        } else {
            throw new Exception('Debes especificar receiver_id o group_id');
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        
        if ($row['count'] > 0) {
            // Hay mensajes nuevos, obtenerlos
            getMessages($conn, $userId);
            return;
        }
        
        // Esperar 1 segundo antes de volver a verificar
        sleep(1);
    }
    
    // Timeout alcanzado, devolver array vacío
    echo json_encode([
        'success' => true,
        'messages' => [],
        'count' => 0,
        'timeout' => true
    ]);
}
?>