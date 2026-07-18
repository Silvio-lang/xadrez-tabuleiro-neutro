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

// Serve os arquivos estáticos de dentro da sua pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal: entrega o jogo.html que está dentro de 'public'
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'jogo.html'));
});

// Gerenciador de conexões do barramento Socket.io (Central Telefônica)
io.on('connection', (socket) => {
    let salaAtual = null;
    let nomeUsuario = null;

    console.log(`Dispositivo conectado: ${socket.id}`);

    // Acoplamento: Organiza os jogadores em suas respectivas salas exclusivas
    socket.on('entrar-sala', (dados) => {
        salaAtual = dados.sala;
        nomeUsuario = dados.nome;

        socket.join(salaAtual);
        console.log(`[Rede] ${nomeUsuario} sintonizou na sala: ${salaAtual}`);

        // Avisa apenas a sala específica que o oponente chegou
        socket.to(salaAtual).emit('jogador-conectado', { nome: nomeUsuario });
    });

    // Transmissão: Envia a jogada confirmada apenas para o oponente na mesma sala
    socket.on('enviar-jogada', (dados) => {
        if (salaAtual) {
            socket.to(salaAtual).emit('receber-jogada', dados);
        }
    });

    // Gerencia a desconexão do usuário isolando seu circuito
    socket.on('disconnect', () => {
        console.log(`Dispositivo desconectado: ${socket.id}`);
        if (salaAtual && nomeUsuario) {
            socket.to(salaAtual).emit('jogador-desconectado', { nome: nomeUsuario });
        }
    });
});

// Definição da porta do servidor (ajustável pelo ambiente de hospedagem Render)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de Xadrez rodando na porta ${PORT}`);
});