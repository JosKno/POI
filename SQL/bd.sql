use railway;

-- ============================================
-- TABLA: users
-- Almacena información de los usuarios
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255) DEFAULT NULL,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen DATETIME DEFAULT NULL,
    gems INT DEFAULT 0,
    encryption_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_username (username),
    INDEX idx_online (is_online)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ============================================
-- TABLA: grupo
-- Almacena los grupos/chats grupales
-- ============================================
CREATE TABLE IF NOT EXISTS grupo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    created_by INT NOT NULL,
    avatar_url VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: group_members
-- Relación entre usuarios y grupos
-- ============================================
CREATE TABLE IF NOT EXISTS group_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('admin', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES grupo(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_group_member (group_id, user_id),
    INDEX idx_group_id (group_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: conversations
-- Conversaciones privadas 1 a 1
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user1_id INT NOT NULL,
    user2_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_conversation (user1_id, user2_id),
    INDEX idx_user1 (user1_id),
    INDEX idx_user2 (user2_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: messages
-- Mensajes de chats privados y grupales
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    conversation_id INT DEFAULT NULL,
    group_id INT DEFAULT NULL,
    content TEXT NOT NULL,
    message_type ENUM('text', 'image', 'file', 'location', 'system') DEFAULT 'text',
    file_url VARCHAR(500) DEFAULT NULL,
    is_encrypted BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES grupo(id) ON DELETE CASCADE,
    INDEX idx_sender (sender_id),
    INDEX idx_conversation (conversation_id),
    INDEX idx_group (group_id),
    INDEX idx_created_at (created_at),
    CHECK (
        (conversation_id IS NOT NULL AND group_id IS NULL) OR 
        (conversation_id IS NULL AND group_id IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: tasks
-- Tareas de los grupos
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    created_by INT NOT NULL,
    assigned_to INT DEFAULT NULL,
    status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
    due_date DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME DEFAULT NULL,
    FOREIGN KEY (group_id) REFERENCES grupo(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_group_id (group_id),
    INDEX idx_status (status),
    INDEX idx_assigned_to (assigned_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: rewards
-- Sistema de recompensas
-- ============================================
CREATE TABLE IF NOT EXISTS rewards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    icon_url VARCHAR(255) DEFAULT NULL,
    gems_required INT NOT NULL DEFAULT 0,
    reward_type ENUM('badge', 'title', 'avatar', 'special') DEFAULT 'badge',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: user_rewards
-- Recompensas obtenidas por usuarios
-- ============================================
CREATE TABLE IF NOT EXISTS user_rewards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    reward_id INT NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_reward (user_id, reward_id),
    INDEX idx_user_id (user_id),
    INDEX idx_reward_id (reward_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: teams
-- Equipos de la Copa Mundial
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    flag_url VARCHAR(255) DEFAULT NULL,
    group_letter CHAR(1) DEFAULT NULL,
    ranking INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: matches
-- Partidos del simulador
-- ============================================
CREATE TABLE IF NOT EXISTS matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team1_id INT NOT NULL,
    team2_id INT NOT NULL,
    team1_score INT DEFAULT NULL,
    team2_score INT DEFAULT NULL,
    match_type ENUM('group', 'round_32', 'round_16', 'quarter', 'semi', 'final') NOT NULL,
    match_date DATETIME DEFAULT NULL,
    status ENUM('scheduled', 'in_progress', 'completed') DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team1_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (team2_id) REFERENCES teams(id) ON DELETE CASCADE,
    INDEX idx_match_type (match_type),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: user_predictions
-- Predicciones de usuarios en el simulador
-- ============================================
CREATE TABLE IF NOT EXISTS user_predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    match_id INT NOT NULL,
    predicted_winner INT NOT NULL,
    gems_bet INT DEFAULT 0,
    is_correct BOOLEAN DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (predicted_winner) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_match (user_id, match_id),
    INDEX idx_user_id (user_id),
    INDEX idx_match_id (match_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: video_calls
-- Registro de videollamadas
-- ============================================
CREATE TABLE IF NOT EXISTS video_calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    caller_id INT NOT NULL,
    receiver_id INT NOT NULL,
    status ENUM('calling', 'active', 'ended', 'missed') DEFAULT 'calling',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME DEFAULT NULL,
    duration INT DEFAULT 0,
    FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_caller (caller_id),
    INDEX idx_receiver (receiver_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLA: notifications
-- Notificaciones para usuarios
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('message', 'group_invite', 'task', 'video_call', 'reward', 'system') NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT DEFAULT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    related_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_read (is_read),
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- DATOS DE PRUEBA
-- ============================================

-- Insertar usuarios de prueba
INSERT INTO users (username, email, password, gems, is_online) VALUES
('Ana Martínez', 'ana@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 150, TRUE),
('Diego', 'diego@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 345, TRUE),
('Alex', 'alex@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 123, FALSE),
('Pepe Aguilar', 'pepe@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 324, TRUE);

-- Insertar recompensas de ejemplo
INSERT INTO rewards (name, description, gems_required, reward_type) VALUES
('Predictor Novato', 'Primera predicción correcta', 50, 'badge'),
('Maestro del Torneo', '10 predicciones correctas', 200, 'badge'),
('Experto en Grupos', 'Predijo todos los clasificados de un grupo', 150, 'badge'),
('Visionario', 'Predijo al campeón', 500, 'special');

-- Insertar equipos de ejemplo (algunos para la Copa Mundial 2026)
INSERT INTO teams (name, country_code, group_letter, ranking) VALUES
('México', 'MEX', 'A', 15),
('Argentina', 'ARG', 'A', 1),
('Brasil', 'BRA', 'B', 3),
('Alemania', 'GER', 'B', 12),
('España', 'ESP', 'C', 8),
('Francia', 'FRA', 'C', 4),
('Inglaterra', 'ENG', 'D', 5),
('Portugal', 'POR', 'D', 9);

-- ============================================
-- VISTAS ÚTILES
-- ============================================

-- Vista de mensajes recientes con información del remitente
CREATE OR REPLACE VIEW recent_messages AS
SELECT 
    m.id,
    m.sender_id,
    u.username AS sender_name,
    u.avatar_url AS sender_avatar,
    m.conversation_id,
    m.group_id,
    m.content,
    m.message_type,
    m.file_url,
    m.is_read,
    m.created_at
FROM messages m
INNER JOIN users u ON m.sender_id = u.id
ORDER BY m.created_at DESC;

-- Vista de grupos con conteo de miembros
CREATE OR REPLACE VIEW group_details AS
SELECT 
    g.id,
    g.name,
    g.description,
    g.created_by,
    u.username AS creator_name,
    COUNT(gm.user_id) AS member_count,
    g.created_at
FROM grupo g
INNER JOIN users u ON g.created_by = u.id
LEFT JOIN group_members gm ON g.id = gm.group_id
GROUP BY g.id, g.name, g.description, g.created_by, u.username, g.created_at;

-- Vista de tareas pendientes por grupo
CREATE OR REPLACE VIEW pending_tasks AS
SELECT 
    t.id,
    t.group_id,
    g.name AS group_name,
    t.title,
    t.description,
    t.status,
    u1.username AS created_by_name,
    u2.username AS assigned_to_name,
    t.due_date,
    t.created_at
FROM tasks t
INNER JOIN grupo g ON t.group_id = g.id
INNER JOIN users u1 ON t.created_by = u1.id
LEFT JOIN users u2 ON t.assigned_to = u2.id
WHERE t.status != 'completed'
ORDER BY t.due_date ASC;

-- ============================================
-- PROCEDIMIENTOS ALMACENADOS
-- ============================================

-- Procedimiento para crear una conversación privada
DELIMITER //
CREATE PROCEDURE create_conversation(
    IN p_user1_id INT,
    IN p_user2_id INT,
    OUT p_conversation_id INT
)
BEGIN
    -- Verificar si ya existe la conversación
    SELECT id INTO p_conversation_id
    FROM conversations
    WHERE (user1_id = p_user1_id AND user2_id = p_user2_id)
       OR (user1_id = p_user2_id AND user2_id = p_user1_id)
    LIMIT 1;
    
    -- Si no existe, crearla
    IF p_conversation_id IS NULL THEN
        INSERT INTO conversations (user1_id, user2_id)
        VALUES (p_user1_id, p_user2_id);
        SET p_conversation_id = LAST_INSERT_ID();
    END IF;
END //
DELIMITER ;

-- Procedimiento para enviar mensaje
DELIMITER //
CREATE PROCEDURE send_message(
    IN p_sender_id INT,
    IN p_conversation_id INT,
    IN p_group_id INT,
    IN p_content TEXT,
    IN p_message_type VARCHAR(20),
    IN p_file_url VARCHAR(500)
)
BEGIN
    INSERT INTO messages (
        sender_id,
        conversation_id,
        group_id,
        content,
        message_type,
        file_url
    ) VALUES (
        p_sender_id,
        p_conversation_id,
        p_group_id,
        p_content,
        p_message_type,
        p_file_url
    );
    
    -- Actualizar timestamp de conversación o grupo
    IF p_conversation_id IS NOT NULL THEN
        UPDATE conversations 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = p_conversation_id;
    END IF;
    
    IF p_group_id IS NOT NULL THEN
        UPDATE grupo 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = p_group_id;
    END IF;
END //
DELIMITER ;

-- Procedimiento para agregar gemas
DELIMITER //
CREATE PROCEDURE add_gems(
    IN p_user_id INT,
    IN p_gems INT
)
BEGIN
    UPDATE users 
    SET gems = gems + p_gems 
    WHERE id = p_user_id;
END //
DELIMITER ;

-- Procedimiento para completar tarea
DELIMITER //
CREATE PROCEDURE complete_task(
    IN p_task_id INT,
    IN p_gems_reward INT
)
BEGIN
    DECLARE v_assigned_to INT;
    
    -- Obtener el usuario asignado
    SELECT assigned_to INTO v_assigned_to
    FROM tasks
    WHERE id = p_task_id;
    
    -- Actualizar estado de la tarea
    UPDATE tasks 
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP
    WHERE id = p_task_id;
    
    -- Dar recompensa de gemas si hay usuario asignado
    IF v_assigned_to IS NOT NULL THEN
        CALL add_gems(v_assigned_to, p_gems_reward);
    END IF;
END //
DELIMITER ;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger para notificar nuevo mensaje
DELIMITER //
CREATE TRIGGER after_message_insert
AFTER INSERT ON messages
FOR EACH ROW
BEGIN
    DECLARE v_receiver_id INT;
    DECLARE v_group_members CURSOR FOR
        SELECT user_id FROM group_members WHERE group_id = NEW.group_id AND user_id != NEW.sender_id;
    
    -- Si es mensaje privado
    IF NEW.conversation_id IS NOT NULL THEN
        -- Obtener el receptor
        SELECT IF(user1_id = NEW.sender_id, user2_id, user1_id)
        INTO v_receiver_id
        FROM conversations
        WHERE id = NEW.conversation_id;
        
        -- Crear notificación
        INSERT INTO notifications (user_id, type, title, content, related_id)
        VALUES (v_receiver_id, 'message', 'Nuevo mensaje', SUBSTRING(NEW.content, 1, 100), NEW.id);
    END IF;
    
    -- Si es mensaje grupal
    IF NEW.group_id IS NOT NULL THEN
        -- Notificar a todos los miembros excepto el emisor
        INSERT INTO notifications (user_id, type, title, content, related_id)
        SELECT 
            gm.user_id,
            'message',
            'Nuevo mensaje grupal',
            SUBSTRING(NEW.content, 1, 100),
            NEW.id
        FROM group_members gm
        WHERE gm.group_id = NEW.group_id AND gm.user_id != NEW.sender_id;
    END IF;
END //
DELIMITER ;

-- ============================================
-- ÍNDICES ADICIONALES PARA OPTIMIZACIÓN
-- ============================================

CREATE INDEX idx_messages_composite ON messages(conversation_id, group_id, created_at);
CREATE INDEX idx_tasks_group_status ON tasks(group_id, status);
CREATE INDEX idx_user_rewards_composite ON user_rewards(user_id, earned_at);

-- ============================================
-- SCRIPT COMPLETADO
-- ============================================