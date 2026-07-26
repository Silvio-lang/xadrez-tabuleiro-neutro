// Ponto de entrada (maestro) do Módulo Satélite Humano vs Humano Online
import { bindUIEvents, mostrarMensagemTemporaria } from './ui.js';
import { iniciarNovoJogo, getGameState } from './game-state.js';
console.log("Status do criarTabuleiro:", typeof criarTabuleiro);

// Inicializa a conexão com o servidor central Socket.io
const socket = io(); 
window.socket = socket; // <--- ADICIONE ESTA LINHA AQUI!

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
    window.socket = socket; // Garantia extra no momento em que a partida inicia!
    console.log("Partida iniciada! Cor recebida do servidor:", dados.cor);
    minhaCor = dados.cor; // 'w' para Brancas ou 'b' para Pretas

    mostrarMensagemTemporaria(dados.mensagem, 3000);

    // Inicializa a partida passando a cor exata definida pelo servidor
    iniciarNovoJogo("humano-humano", minhaCor, "Você", "Oponente");
});

// Ouve as jogadas feitas pelo oponente na rede e atualiza o tabuleiro local
socket.on('jogadaOponente', (dados) => {
    console.log("DEBUG [3 - Cliente Receptor]: Aplicando jogada do oponente no tabuleiro...", dados);
    
    import('./game-state.js').then(({ getJogoInstance, criarTabuleiro, atualizarInfo, atualizarEstadoJogo }) => {
        const jogo = getJogoInstance();
        
        // Executa o lance vindo da rede na instância do Chess.js local
        const jogadaValida = jogo.move({
            from: dados.from,
            to: dados.to,
            promotion: dados.promotion || 'q'
        });

        if (jogadaValida) {
            // Redesenha as peças no tabuleiro e atualiza os textos de status
             window.criarTabuleiro();
            atualizarInfo();
            atualizarEstadoJogo();
        } else {
            console.log("Erro ao aplicar jogada recebida do oponente:", dados);
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