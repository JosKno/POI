<?php
// VERSIÓN LIMPIA CON CREDENCIALES DIRECTAS

define('DB_HOST', 'ballast.proxy.rlwy.net');
define('DB_USER', 'root');
define('DB_PASS', 'TSNgjDKhVxhxGEGDzOEngUgWlVkvTquh'); // <-- PON TU CONTRASEÑA REAL AQUÍ
define('DB_NAME', 'railway');
define('DB_PORT', '54764');

function getDBConnection() {
    @$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
    if ($conn->connect_error) {
        die(json_encode(['success' => false, 'error' => 'Error de conexión a la BD: ' . $conn->connect_error]));
    }
    $conn->set_charset("utf8mb4");
    return $conn;
}

function closeDBConnection($conn) {
    if ($conn) {
        $conn->close();
    }
}

function sanitize($data) {
    return htmlspecialchars(stripslashes(trim($data)));
}

header('Content-Type: application/json; charset=UTF-8');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
?>