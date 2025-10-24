<?php
/**
 * config.php - CORREGIDO
 * Configuración de base de datos y funciones auxiliares
 */

// Evitar que PHP muestre errores como HTML
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);

// Log de errores a archivo en lugar de mostrarlos
ini_set('log_errors', 1);
ini_set('error_log', '/tmp/php-error.log');

// Iniciar sesión si no está iniciada
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// CONFIGURACIÓN DE BASE DE DATOS
define('DB_HOST', 'ballast.proxy.rlwy.net');
define('DB_USER', 'root');
define('DB_PASS', 'TSNgjDKhVxhxGEGDzOEngUgWlVkvTquh');
define('DB_NAME', 'railway');
define('DB_PORT', 54764);

/**
 * Obtener conexión a la base de datos
 */
function getDBConnection() {
    try {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
        
        if ($conn->connect_error) {
            error_log('Error de conexión MySQL: ' . $conn->connect_error);
            throw new Exception('Error de conexión a la base de datos');
        }
        
        $conn->set_charset("utf8mb4");
        return $conn;
        
    } catch (Exception $e) {
        error_log('Excepción en getDBConnection: ' . $e->getMessage());
        
        // Asegurar que solo se devuelve JSON
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false, 
            'error' => 'No se pudo conectar a la base de datos'
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
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($data);
    exit();
}
?>