// Ponto de entrada (maestro) do Módulo Satélite Humano vs Humano Online
import { bindUIEvents, mostrarMensagemTemporaria } from './ui.js';
import { iniciarNovoJogo } from './game-state.js';

// Inicializa a conexão com o servidor central Socket.io
const socket = io(); 

// Variável global para armazenar a cor atribuída pelo servidor
let minhaCor = null;

/**
 * Controla a inicialização da partida online por pareamento automático.
 */
function iniciarPartidaOnline() {
    console.log("Iniciando conexão da partida...");
    mostrarMensagemTemporaria("Procurando oponente...", 2000);
}

// Ouve o aviso do servidor quando um oponente é encontrado e a partida começa
socket.on('inicioPartida', (dados) => {
    console.log("Partida iniciada! Cor recebida do servidor:", dados.cor);
    minhaCor = dados.cor; // 'w' para Brancas ou 'b' para Pretas

    mostrarMensagemTemporaria(dados.mensagem, 2000);

    // Inicializa a partida passando EXATAMENTE a cor que o servidor determinou para este jogador
    iniciarNovoJogo("humano-humano", minhaCor, "Você", "Oponente");
});

// Ouve as jogadas feitas pelo oponente na rede
socket.on('jogadaOponente', (dados) => {
    console.log("Jogada recebida do oponente:", dados);
    // Aqui o tabuleiro local atualiza com a jogada do adversário sem travar o turno
    import('./game-state.js').then(({ moverPeca }) => {
        moverPeca(dados.origem, dados.destino, dados.promocao || 'q');
    });
});

// Ouve o aviso do servidor se o oponente desconectar
socket.on('oponenteDesconectou', (dados) => {
    mostrarMensagemTemporaria(dados.mensagem, 2000);
});

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