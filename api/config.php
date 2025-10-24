<?php
/**
 * config.php
 * Configuración de base de datos
 */

// Deshabilitar warnings que puedan aparecer antes del JSON
error_reporting(E_ERROR | E_PARSE);
ini_set('display_errors', '0');

// Configuración de base de datos Railway
$host = getenv('MYSQLHOST') ?: 'ballast.proxy.rlwy.net';
$user = getenv('MYSQLUSER') ?: 'root';
$pass = getenv('MYSQLPASSWORD') ?: 'TSNgjDKhVxhxGEGDzOEngUgWlVkvTquh';
$db = getenv('MYSQL_DATABASE') ?: 'railway';
$port = getenv('MYSQLPORT') ?: '54764';

// Conectar a la base de datos
$conn = new mysqli($host, $user, $pass, $db, $port);

// Verificar conexión
if ($conn->connect_error) {
    // NO mostrar HTML, solo JSON
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => 'Error de conexión a la base de datos'
    ]);
    exit();
}

// Configurar charset
$conn->set_charset('utf8mb4');
?>