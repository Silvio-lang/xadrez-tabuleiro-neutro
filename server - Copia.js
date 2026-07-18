// Importação das bibliotecas necessárias
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Inicialização do aplicativo Express e do servidor HTTP
const app = express();
const server = http.createServer(app);

// Configuração do Socket.io permitindo conexões de qualquer origem (CORS)
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Servir os arquivos estáticos da interface do xadrez (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Gerenciador de conexões do barramento Socket.io
io.on('connection', (socket) => {
    console.log(`Dispositivo conectado: ${socket.id}`);

    // Escuta o evento de movimento enviado por um jogador
    socket.on('enviar-movimento', (dadosMovimento) => {
        // Retransmite o movimento para o outro jogador conectado
        socket.broadcast.emit('receber-movimento', dadosMovimento);
    });

    // Gerencia a desconexão do usuário
    socket.on('disconnect', () => {
        console.log(`Dispositivo desconectado: ${socket.id}`);
    });
});

// Definição da porta do servidor (ajustável pelo ambiente de hospedagem)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de Xadrez rodando na porta ${PORT}`);
});