<?php
/**
 * router.php
 * Router simple para el servidor PHP built-in
 * Este archivo maneja las peticiones y rutea correctamente
 */

// Log de la petición para debugging
error_log("REQUEST_URI: " . $_SERVER['REQUEST_URI']);
error_log("REQUEST_METHOD: " . $_SERVER['REQUEST_METHOD']);

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = urldecode($uri);

// Permitir CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Manejar preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Si es una petición a la API
if (preg_match('/^\/api\//', $uri)) {
    // Remover /api/ del path
    $file = '.' . $uri;
    
    if (file_exists($file) && is_file($file)) {
        // Incluir el archivo PHP
        require $file;
        exit();
    } else {
        header('Content-Type: application/json');
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Endpoint no encontrado',
            'requested' => $uri,
            'file' => $file
        ]);
        exit();
    }
}

// Para archivos estáticos (HTML, CSS, JS, imágenes)
$filePath = '.' . $uri;

// Si es un directorio, buscar index.html
if (is_dir($filePath)) {
    $filePath .= '/index.html';
}

// Si el archivo existe, servirlo
if (file_exists($filePath) && is_file($filePath)) {
    // Determinar el content-type
    $ext = pathinfo($filePath, PATHINFO_EXTENSION);
    $mimeTypes = [
        'html' => 'text/html',
        'htm' => 'text/html',
        'css' => 'text/css',
        'js' => 'application/javascript',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'pdf' => 'application/pdf',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
    ];
    
    $contentType = $mimeTypes[$ext] ?? 'application/octet-stream';
    header('Content-Type: ' . $contentType);
    readfile($filePath);
    exit();
}

// Si llegamos aquí, el archivo no existe
// Servir index.html para SPA routing
if (file_exists('./index.html')) {
    header('Content-Type: text/html');
    readfile('./index.html');
    exit();
}

// 404 final
http_response_code(404);
echo '404 - Not Found';