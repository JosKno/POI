<?php
// ws_server.php

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;

require __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/api/config.php'; 

// Definimos el puerto donde correrá el servidor WS (interno a Railway)
define('WS_PORT', 8080); 

/**
 * Componente principal del servidor de chat de Ratchet
 */
class ChatServer implements MessageComponentInterface {
    protected $clients;
    protected $users; 

    public function __construct() {
        $this->clients = new \SplObjectStorage;
        $this->users = new \ArrayObject();
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        echo "Nuevo cliente conectado ({$conn->resourceId})\n";
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        $data = json_decode($msg, true);
        $action = $data['action'] ?? null;
        
        // 1. Registro de Usuario (Para mapear conexión a ID de usuario)
        if ($action === 'register' && isset($data['user_id'])) {
            $from->user_id = $data['user_id'];
            $this->users[$data['user_id']] = $from;
            echo "Cliente {$from->resourceId} registrado como User ID: {$data['user_id']}\n";
            return;
        }

        // 2. Recepción de Notificación de Mensaje Guardado
        if ($action === 'new_message_saved' && isset($data['message'])) {
            $message = $data['message'];
            $senderId = $message['sender']['id'];

            $notification = [
                'type' => 'new_message',
                'message' => $message,
            ];
            
            // Enviar notificación a todos los clientes excepto al remitente (Self-Push lo maneja el cliente)
            foreach ($this->clients as $client) {
                // Notificar si está autenticado y no es el remitente
                if (isset($client->user_id) && $client->user_id != $senderId) {
                    $client->send(json_encode($notification));
                }
            }
        }
    }
    
    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);
        
        if (isset($conn->user_id)) {
            unset($this->users[$conn->user_id]);
        }
        
        echo "Cliente desconectado ({$conn->resourceId})\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "Un error ha ocurrido: {$e->getMessage()}\n";
        $conn->close();
    }
}

$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new ChatServer()
        )
    ),
    WS_PORT 
);

echo "Servidor WebSocket iniciado en el puerto " . WS_PORT . "\n";
$server->run();