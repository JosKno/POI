<?php
/**
 * config.php
 * Configuración de base de datos y funciones auxiliares
 */

// Iniciar sesión si no está iniciada
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Configurar PHP para mostrar errores (solo en desarrollo)
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Configurar headers JSON
header('Content-Type: application/json; charset=UTF-8');

// CONFIGURACIÓN DE BASE DE DATOS
define('DB_HOST', 'ballast.proxy.rlwy.net');
define('DB_USER', 'root');
define('DB_PASS', 'TSNgjDKhVxhxGEGDzOEngUgWlVkvTquh');
define('DB_NAME', 'railway');
define('DB_PORT', '54764');

/**
 * Obtener conexión a la base de datos
 */
function getDBConnection() {
    try {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
        
        if ($conn->connect_error) {
            throw new Exception('Error de conexión: ' . $conn->connect_error);
        }
        
        $conn->set_charset("utf8mb4");
        return $conn;
        
    } catch (Exception $e) {
        // Devolver error en formato JSON
        echo json_encode([
            'success' => false, 
            'error' => 'No se pudo conectar a la base de datos',
            'details' => $e->getMessage()
        ]);
        exit();
    }
}

/**
 * Cerrar conexión a la base de datos
 */
function closeDBConnection($conn) {
    if ($conn) {
        $conn->close();
    }
}

/**
 * Sanitizar datos de entrada
 */
function sanitize($data) {
    return htmlspecialchars(stripslashes(trim($data)));
}

/**
 * Responder con JSON y terminar ejecución
 */
function jsonResponse($data) {
    echo json_encode($data);
    exit();
}
?>