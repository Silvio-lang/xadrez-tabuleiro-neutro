// Ponto de entrada (maestro) do Módulo Satélite Humano vs Humano Online
import { bindUIEvents, mostrarMensagemTemporaria } from './ui.js';
import { iniciarNovoJogo } from './game-state.js';

// Inicializa a conexão com o servidor central Socket.io no localhost
const socket = io(); 

/**
 * Controla a inicialização da partida online e a entrada na sala de rede.
 */
function iniciarPartidaOnline() {
    console.log("Iniciando conexão da partida...");

    // 1. Obter os novos valores da UI (Nome e Código da Sala)
    const seuNome = document.getElementById("nome-jogador1").value.trim();
    const codigoSala = document.getElementById("codigo-sala").value.trim();

    // Validação de bancada: impede iniciar sem preencher os dados do circuito
    if (!seuNome || !codigoSala) {
        mostrarMensagemTemporaria("Por favor, preencha seu nome e o código da sala!", 2000);
        return;
    }

    console.log(`Conectando à sala: ${codigoSala} como: ${seuNome}`);

    // 2. Avisa o servidor central (via Socket.io) para nos colocar na sala certa
    socket.emit('entrar-sala', { sala: codigoSala, nome: seuNome });

    // 3. Inicializa a lógica local do tabuleiro (reaproveitando o game-state.js)
    // Passamos "humano-humano" fixo para o motor local saber que não há IA envolvida
    iniciarNovoJogo("humano-humano", "w", seuNome, "Aguardando Oponente...");
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
    
    // 1. Diz ao ui.js para ligar seus botões de navegação (Voltar, Avançar, etc.)
    bindUIEvents(); 
    
    // 2. Liga o botão de conexão e início da sala online
    bindConfigEvents(); 

    console.log("Eventos de entrada amarrados. Aplicação pronta.");
});