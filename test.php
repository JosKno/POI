<?php
/**
 * test_php.php
 * Archivo simple para verificar que PHP está funcionando
 */

header('Content-Type: application/json; charset=UTF-8');

echo json_encode([
    'success' => true,
    'message' => 'PHP está funcionando correctamente',
    'php_version' => phpversion(),
    'server' => $_SERVER['SERVER_SOFTWARE'] ?? 'desconocido'
]);
?>