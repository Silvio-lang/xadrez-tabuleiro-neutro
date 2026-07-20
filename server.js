// Importação das bibliotecas necessárias
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const fs = require('fs');

// Inicialização do aplicativo Express e do servidor HTTP
const app = express();
const server = http.createServer(app);

// Adicione este bloco antes de configurar o servidor
console.log("--- DEBUG DE ESTRUTURA DE ARQUIVOS ---");
console.log("Diretório atual (__dirname):", __dirname);
try {
    const files = fs.readdirSync(__dirname);
    console.log("Conteúdo da raiz:", files);
    
    const publicPath = path.join(__dirname, 'public');
    if (fs.existsSync(publicPath)) {
        console.log("Conteúdo da pasta public:", fs.readdirSync(publicPath));
    } else {
        console.log("ERRO: Pasta 'public' não encontrada em:", publicPath);
    }
} catch (err) {
    console.log("Erro ao listar diretórios:", err.message);
}
console.log("---------------------------------------");

// Configuração do Socket.io permitindo conexões de qualquer origem (CORS)
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve os arquivos estáticos de dentro da sua pasta 'public'
//app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.resolve(__dirname, 'public')));

// Rota principal: entrega o jogo.html que está dentro de 'public'
//app.get('/', (req, res) => {
//    res.sendFile(path.join(__dirname, 'public', 'jogo.html'));
console.log("DEBUG: Tentando servir arquivo de:", path.resolve(__dirname, 'public', 'jogo.html'));
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'public', 'jogo.html'));
});

// Gerenciador de conexões do barramento Socket.io (Central Telefônica)
let jogadorEsperando = null;

io.on('connection', (socket) => {
    console.log('Novo jogador conectado:', socket.id);

    // Sistema de Pareamento Automático
    if (!jogadorEsperando) {
        // Primeiro jogador a chegar fica na espera
        jogadorEsperando = socket;
        socket.cor = 'w'; // Brancas
        socket.emit('statusPareamento', { mensagem: 'Aguardando um oponente entrar...', cor: 'w' });
    } else {
        // Segundo jogador chegou: fecha o par e cria a sala
        const salaId = `sala_${jogadorEsperando.id}_${socket.id}`;
        const jogador1 = jogadorEsperando;
        const jogador2 = socket;

        jogadorEsperando = null; // Limpa a fila

        jogador2.cor = 'b'; // Pretas

        // Coloca ambos na mesma sala do Socket.io
        jogador1.join(salaId);
        jogador2.join(salaId);

        jogador1.sala = salaId;
        jogador2.sala = salaId;

        // Avisa os dois que o jogo começou
        jogador1.emit('inicioPartida', { cor: 'w', sala: salaId, mensagem: 'Oponente conectado! Você joga com as Brancas.' });
        jogador2.emit('inicioPartida', { cor: 'b', sala: salaId, mensagem: 'Oponente conectado! Você joga com as Pretas.' });
    }

    // Recebe a jogada de um jogador e envia para o oponente na mesma sala
    socket.on('fazerJogada', (dadosJogada) => {
        if (socket.sala) {
            socket.to(socket.sala).emit('jogadaOponente', dadosJogada);
        }
    });

    // Tratamento de desconexão
    socket.on('disconnect', () => {
        console.log('Jogador desconectou:', socket.id);
        if (jogadorEsperando === socket) {
            jogadorEsperando = null;
        } else if (socket.sala) {
            socket.to(socket.sala).emit('oponenteDesconectou', { mensagem: 'O seu oponente se desconectou.' });
        }
    });
});

// Definição da porta do servidor (ajustável pelo ambiente de hospedagem Render)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de Xadrez rodando na porta ${PORT}`);
});