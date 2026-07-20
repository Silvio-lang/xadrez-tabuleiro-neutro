// Ponto de entrada (maestro) do Módulo Satélite Humano vs Humano Online
import { bindUIEvents, mostrarMensagemTemporaria } from './ui.js';
import { iniciarNovoJogo, getGameState } from './game-state.js';

// Inicializa a conexão com o servidor central Socket.io
const socket = io(); 

// Variável global para armazenar a cor atribuída pelo servidor
let minhaCor = null;

/**
 * Controla a inicialização da partida online por pareamento automático.
 */
function iniciarPartidaOnline() {
    console.log("Iniciando conexão da partida com o servidor...");
    mostrarMensagemTemporaria("Procurando oponente...", 2000);
    
    // DISPARO CRÍTICO: Avisa o servidor central que este jogador quer entrar na fila
    socket.emit('solicitarPareamento');
}

// Ouve o aviso do servidor quando um oponente é encontrado e a partida começa
socket.on('inicioPartida', (dados) => {
    console.log("Partida iniciada! Cor recebida do servidor:", dados.cor);
    minhaCor = dados.cor; // 'w' para Brancas ou 'b' para Pretas

    mostrarMensagemTemporaria(dados.mensagem, 3000);

    // Inicializa a partida passando a cor exata definida pelo servidor
    iniciarNovoJogo("humano-humano", minhaCor, "Você", "Oponente");
});

// Ouve as jogadas feitas pelo oponente na rede e atualiza o tabuleiro local
socket.on('jogadaOponente', (dados) => {
    console.log("Jogada recebida do oponente:", dados);
    import('./game-state.js').then(({ getJogoInstance, criarTabuleiro, atualizarInfo, atualizarEstadoJogo, atualizarAvaliacao }) => {
        const jogo = getJogoInstance();
        
        // Aplica o movimento do oponente diretamente na instância do Chess.js
        const jogadaValida = jogo.move({ from: dados.origem, to: dados.destino, promotion: dados.promocao || 'q' });
        
        if (jogadaValida) {
            // Atualiza a interface gráfica do tabuleiro
            import('./ui.js').then(({ criarTabuleiro, atualizarInfo, atualizarEstadoJogo, atualizarAvaliacao }) => {
                criarTabuleiro();
                atualizarInfo();
                atualizarEstadoJogo();
                atualizarAvaliacao();
            });
        }
    });
});

// Ouve o aviso do servidor se o oponente desconectar
socket.on('oponenteDesconectou', (dados) => {
    mostrarMensagemTemporaria(dados.mensagem, 3000);
});

// Função utilitária global para transmitir a nossa jogada ao servidor
export function enviarJogadaRede(origem, destino, promocao = 'q') {
    if (socket) {
        socket.emit('fazerJogada', { origem, destino, promocao });
    }
}

/**
 * Liga os eventos de configuração específicos do início do jogo online
 */
function bindConfigEvents() {
    console.log("Ligando eventos de configuração do Tabuleiro Neutro...");
    
    const iniciarBtn = document.getElementById("btn-iniciar");
    if (iniciarBtn) {
        iniciarBtn.addEventListener('click', iniciarPartidaOnline);
    } else {
        console.error("Botão 'btn-iniciar' não encontrado no DOM!");
    }
}

// PONTO DE ENTRADA PRINCIPAL (DOM Ready)
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM pronto no Tabuleiro Neutro. Ligando fiação...");
    
    bindUIEvents(); 
    bindConfigEvents(); 

    console.log("Eventos de entrada amarrados. Aplicação pronta.");
});