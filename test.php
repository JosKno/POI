<?php
/**
 * test.php
 * Archivo de prueba para verificar que PHP y la BD funcionan
 */

// Headers CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

// Manejar OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$response = [
    'success' => true,
    'message' => 'PHP está funcionando correctamente',
    'php_version' => phpversion(),
    'server' => $_SERVER['SERVER_SOFTWARE'] ?? 'desconocido',
    'request_method' => $_SERVER['REQUEST_METHOD'],
    'request_uri' => $_SERVER['REQUEST_URI'],
    'extensions' => [
        'mysqli' => extension_loaded('mysqli'),
        'pdo' => extension_loaded('pdo'),
        'pdo_mysql' => extension_loaded('pdo_mysql'),
        'json' => extension_loaded('json'),
        'session' => extension_loaded('session')
    ],
    'session_status' => [
        'started' => session_status() === PHP_SESSION_ACTIVE,
        'status_code' => session_status()
    ]
];

// Intentar conexión a la base de datos
try {
    $host = 'ballast.proxy.rlwy.net';
    $user = 'root';
    $pass = 'TSNgjDKhVxhxGEGDzOEngUgWlVkvTquh';
    $dbname = 'railway';
    $port = 54764;
    
    $conn = new mysqli($host, $user, $pass, $dbname, $port);
    
    if ($conn->connect_error) {
        throw new Exception('Error de conexión: ' . $conn->connect_error);
    }
    
    $response['database'] = [
        'connected' => true,
        'host' => $host,
        'port' => $port,
        'database' => $dbname
    ];
    
    // Verificar tablas
    $result = $conn->query("SHOW TABLES");
    $tables = [];
    while ($row = $result->fetch_array()) {
        $tables[] = $row[0];
    }
    $response['database']['tables'] = $tables;
    
    $conn->close();
    
} catch (Exception $e) {
    $response['database'] = [
        'connected' => false,
        'error' => $e->getMessage()
    ];
}

echo json_encode($response, JSON_PRETTY_PRINT);
?>