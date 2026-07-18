/* ui.js */
// Handles all user interface interactions and updates the DOM.

// Import necessary functions from game-state.js and stockfish-manager.js
import { getJogoInstance, moverPeca, getGameState, voltarJogada as goBackMove, avancarJogada as goForwardMove, continuarAPartirDaqui as resumeGame, getCapturedPieces, fazerJogadaIA, iniciarNovoJogo } from './game-state.js';
import {
    sugerirJogadas,
    getCurrentScore,
    getAvaliacaoEmoji,
    setAvaliacaoTimeout,
    clearAvaliacaoTimeout,
    getLevelName,
    getSugestoesIA,
    getCurrentLevel,
    setCurrentLevel 
} from './stockfish-manager.js';
// Importação crítica para o funcionamento da lista de treinos
import { atualizarListaProblemas, salvarPosicaoAtual, carregarProblema } from './pos_salvas.js'; 

// DOM elements 
let mainTitleEl = null; 
let tabuleiroEl = null; 
let infoEl = null; 
let estadoJogoEl = null; 
let avaliacaoEl = null; 
let sugestoesEl = null; 
let sugestoesLinhaEl = null; 
let xequeLabel = null; 
let tempMessageAreaEl = null; 
let manualEl = null; 
let gerenciarTreinosEl = null; 
let capturasEl = null; 
let topControlsContainerEl = null; 
let boardContainerEl = null; 
let btnConfirmarEl = null; 
let configContainerEl = null;
// Variable to store the currently selected square for making a move (UI state)
let casaSelecionada = null;

// Variável de controle para pausar a interface enquanto aguarda confirmação
let aguardandoConfirmacao = false;

// --- VARIÁVEIS DE PERFORMANCE (Arremesso de Peso) ---
let performanceBrancas = 0; // Total acumulado Brancas (em centi-peões)
let performancePretas = 0;  // Total acumulado Pretas (em centi-peões)
let notaUltimaBrancas = 0;  // Nota definitiva da última jogada
let notaUltimaPretas = 0;   // Nota definitiva da última jogada

let scoreEstavelAnterior = 30; // O "ponto de queda" do arremesso anterior (Base). Começa com ~0.3 (vantagem branca inicial padrão)
let timerEstabilizacao = null; // O cronômetro para o Debounce
let ultimoScoreRecebido = null; // Armazena o valor bruto mais recente

// Constante para o tempo de espera (em milissegundos)
const TEMPO_ESTABILIZACAO = 2500; 


/**
 * Initializes UI elements by getting references from the DOM.
 */
function initializeUIElements() {
    mainTitleEl = document.getElementById("main-title"); 
    tabuleiroEl = document.getElementById("tabuleiro");
    infoEl = document.getElementById("info");
    estadoJogoEl = document.getElementById("estado-jogo");
    avaliacaoEl = document.getElementById("avaliacao");
    sugestoesEl = document.getElementById("sugestoes");
    sugestoesLinhaEl = document.getElementById("sugestoes-linha");
    tempMessageAreaEl = document.getElementById("temp-message-area");
    manualEl = document.getElementById("manual");
    gerenciarTreinosEl = document.getElementById("gerenciar-treinos");
    capturasEl = document.getElementById("capturas");
    topControlsContainerEl = document.querySelector(".top-controls-container"); 
    boardContainerEl = document.querySelector(".board-container"); 
    btnConfirmarEl = document.getElementById("btn-confirmar"); 
    configContainerEl = document.querySelector(".config-container");

// Versão incluindo o boardContainerEl, caso ele esteja mapeado e exista na tela
    if (!mainTitleEl || !tabuleiroEl || !infoEl || !estadoJogoEl || !tempMessageAreaEl || !manualEl || !capturasEl || !topControlsContainerEl || !boardContainerEl || !btnConfirmarEl) {
        console.error("Erro: Um ou mais elementos da UI não foram encontrados. Verifique o jogo.html.");
    } 
}


/**
 * Creates or updates the visual representation of the chessboard in the DOM.
 */
function criarTabuleiro() {
    if (!tabuleiroEl) {
        console.error("Elemento #tabuleiro não encontrado para criar o tabuleiro.");
        return;
    }

    const jogo = getJogoInstance(); 

    if (!jogo) {
        console.warn("Instância de jogo não disponível ao tentar criar tabuleiro.");
        return;
    }

    const gameState = getGameState(); 

    // Reset de variáveis se for um jogo novo (histórico vazio ou reiniciado)
    // Isso garante que as pontuações totalizadas sejam zeradas no início da partida.
    if (gameState.historicoJogadas.length === 0) {
        performanceBrancas = 0;
        performancePretas = 0;
        notaUltimaBrancas = 0;
        notaUltimaPretas = 0;
        scoreEstavelAnterior = 30; // Volta para o valor base inicial do xadrez (~0.3 vantagem branca inicial)
        if (timerEstabilizacao) clearTimeout(timerEstabilizacao);
    }

    tabuleiroEl.innerHTML = ''; 

    // Adicionar/Remover classe de bloqueio visual
    if (aguardandoConfirmacao) {
        tabuleiroEl.classList.add("bloqueado");
    } else {
        tabuleiroEl.classList.remove("bloqueado");
    }
    
    // Controla a visibilidade do botão 'Jogue'
    if (btnConfirmarEl) {
        btnConfirmarEl.style.display = aguardandoConfirmacao ? "inline-block" : "none";
    }

    const perspective = gameState.corUsuario === 'w' ? 'white' : 'black';
    const files = perspective === 'white' ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
    const ranks = perspective === 'white' ? ['8', '7', '6', '5', '4', '3', '2', '1'] : ['1', '2', '3', '4', '5', '6', '7', '8'];

    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const posicao = files[j] + ranks[i]; 
            const casa = document.createElement("div"); 
            casa.className = `casa ${(i + j) % 2 === 0 ? 'branca' : 'preta'}`; 
            casa.dataset.posicao = posicao; 
            casa.title = posicao;

            const peça = jogo.get(posicao); 
            if (peça) {
                casa.innerHTML = peçaUnicode(peça); 
                casa.dataset.pecaColor = peça.color;
                casa.dataset.pecaType = peça.type;
            }

            if (getCasaSelecionada() === posicao) {
                casa.classList.add("selecionada");
            }

            if (gameState.ultimaCasaIA === posicao) {
                const indicador = document.createElement("div");
                indicador.className = "indicador-mov"; 
                casa.appendChild(indicador);
            }

            if (gameState.origemCasaIA === posicao) {
                const indicador = document.createElement("div");
                indicador.className = "indicador-origem"; 
                casa.appendChild(indicador);
            }

            if (!aguardandoConfirmacao && !jogo.game_over() && (gameState.modoJogo === "humano-humano" || (gameState.modoJogo === "humano-ia" && jogo.turn() === gameState.corUsuario))) {
                const peçaAtual = jogo.get(posicao);
                
                if (peçaAtual && peçaAtual.color === jogo.turn()) {
                    casa.classList.add("clicavel");
                    casa.onclick = () => handleSquareClick(posicao); 
                }

                const movimentosPossiveis = getCasaSelecionada() ? jogo.moves({ square: getCasaSelecionada(), verbose: true }) : [];
                const movimentoParaCasa = movimentosPossiveis.find(m => m.to === posicao);
                if (movimentoParaCasa) {
                    casa.classList.add("clicavel"); 
                    const indicador = document.createElement("div");
                    indicador.className = "indicador-mov"; 
                    casa.appendChild(indicador);
                    casa.onclick = () => handleSquareClick(posicao); 
                }
            }

            tabuleiroEl.appendChild(casa); 
        }
    }
    updateCapturesDisplay(); 
}

/**
 * Handles a click event on a square of the chessboard.
 */
function handleSquareClick(posicao) {
    if (aguardandoConfirmacao) return;

    const jogo = getJogoInstance(); 
    const casaSelecionada = getCasaSelecionada(); 
    const gameState = getGameState();

    if (casaSelecionada === null) {
        const peça = jogo.get(posicao);
        if (peça && peça.color === jogo.turn()) {
            setCasaSelecionada(posicao); 
        }
    } else {
        const movimentosPossiveis = jogo.moves({ square: casaSelecionada, verbose: true });
        const movimentoParaCasa = movimentosPossiveis.find(m => m.to === posicao);

        if (movimentoParaCasa) {
            moverPeca(casaSelecionada, posicao, movimentoParaCasa.promotion); 
            setCasaSelecionada(null); 
            
            if (gameState.modoJogo === "humano-ia" && jogo.turn() !== gameState.corUsuario && !jogo.game_over()) {
                pausarParaConfirmacao();
            }

        } else {
            const peça = jogo.get(posicao);
             if (peça && peça.color === jogo.turn()) {
                setCasaSelecionada(posicao); 
             } else {
                setCasaSelecionada(null); 
             }
        }
    }
    criarTabuleiro();
}

/**
 * Pausa o fluxo do jogo e exibe o botão de confirmação.
 */
function pausarParaConfirmacao() {
    aguardandoConfirmacao = true; 
    if (btnConfirmarEl) {
        mostrarMensagemTemporaria("Confirme sua jogada! Clique em 'Jogue'.", 2000);
    }
    criarTabuleiro(); 
}

/**
 * Executa a ação de confirmar a jogada.
 */
function processarConfirmacao() {
    if (!aguardandoConfirmacao) return;
    
    let iaChamada = false;
    try {
        if (typeof fazerJogadaIA === 'function') {
            fazerJogadaIA(); 
            iaChamada = true;
        } else {
            console.error("Função fazerJogadaIA não encontrada ou não importada corretamente.");
            mostrarMensagemTemporaria("Erro: IA não respondeu.", 3000);
        }
    } catch (e) {
        console.error("Erro ao chamar fazerJogadaIA:", e);
        mostrarMensagemTemporaria("Erro interno ao processar jogada da IA.", 3000);
    }

    aguardandoConfirmacao = false; 
    criarTabuleiro();
}


/**
 * Gets the currently selected square.
 */
function getCasaSelecionada() {
    return casaSelecionada;
}

/**
 * Sets the currently selected square.
 */
function setCasaSelecionada(posicao) {
    casaSelecionada = posicao;
}


/**
 * Returns the Unicode character for a given chess piece object.
 */
function peçaUnicode(peça) {
    const unicodePeças = {
        'p': { 'w': '♙', 'b': '♟' }, 
        'r': { 'w': '♖', 'b': '♜' }, 
        'n': { 'w': '♘', 'b': '♞' }, 
        'b': { 'w': '♗', 'b': '♝' }, 
        'q': { 'w': '♕', 'b': '♛' }, 
        'k': { 'w': '♔', 'b': '♚' }  
    };
    return unicodePeças[peça.type][peça.color];
}

/**
 * Updates the display of captured pieces.
 * USA SOMENTE O MÉTODO DE DIFERENÇA MATERIAL para garantir precisão.
 */
function updateCapturesDisplay() {
    if (!capturasEl) return;

    const jogo = getJogoInstance();
    const captured = { w: {}, b: {} }; 
    const board = jogo.board();
    const currentCounts = { w: { p:0, n:0, b:0, r:0, q:0 }, b: { p:0, n:0, b:0, r:0, q:0 } };
    
    board.forEach(row => {
        row.forEach(piece => {
            if (piece && piece.type !== 'k') { 
                currentCounts[piece.color][piece.type]++;
            }
        });
    });

    const startCounts = { p:8, n:2, b:2, r:2, q:1 };

    ['p', 'n', 'b', 'r', 'q'].forEach(type => {
        let missingW = startCounts[type] - currentCounts.w[type];
        if (missingW > 0) captured.w[type] = missingW;

        let missingB = startCounts[type] - currentCounts.b[type];
        if (missingB > 0) captured.b[type] = missingB;
    });

    let whiteCapturesHTML = 'Brancas capturaram: ';
    const piecesCapturedByWhite = Object.keys(captured.b).sort(); 
    
    if (piecesCapturedByWhite.length > 0) {
        whiteCapturesHTML += piecesCapturedByWhite.map(pieceType => {
            const piece = { type: pieceType, color: 'b' }; 
            const count = captured.b[pieceType]; 
            return `${peçaUnicode(piece)} x${count}`; 
        }).join(', ');
    } else {
        whiteCapturesHTML += 'Nenhuma';
    }
    
    let blackCapturesHTML = 'Pretas capturaram: ';
    const piecesCapturedByBlack = Object.keys(captured.w).sort(); 
     if (piecesCapturedByBlack.length > 0) {
        blackCapturesHTML += piecesCapturedByBlack.map(pieceType => {
            const piece = { type: pieceType, color: 'w' }; 
            const count = captured.w[pieceType];
            return `${peçaUnicode(piece)} x${count}`;
        }).join(', ');
    } else {
        blackCapturesHTML += 'Nenhuma';
    }

    capturasEl.innerHTML = `${whiteCapturesHTML}<br>${blackCapturesHTML}`;
}


/**
 * Returns the display name for a given color ('w' for white, 'b' for black).
 */
function mostrarCor(letra) {
    return letra === 'w' ? 'Brancas' : 'Pretas';
}

/**
 * Displays a temporary message to the user in a designated area.
 */
function mostrarMensagemTemporaria(mensagem, duracao = 2000) {
    if (!tempMessageAreaEl) return;

    const tempSpan = document.createElement("span");
    tempSpan.innerHTML = `<strong style="color: red;">${mensagem}</strong>`;

    tempMessageAreaEl.innerHTML = '';
    tempMessageAreaEl.appendChild(tempSpan);

    setTimeout(() => {
        if (tempSpan && tempSpan.parentElement) {
            tempSpan.parentElement.removeChild(tempSpan);
        }
    }, duracao);
}

/**
 * Helper para formatar pontuação de centi-peões para peões (dividir por 100).
 * Ex: 35 -> +0.35, -120 -> -1.20
 */
function formatarParaPeoes(valorCentipeoes) {
    if (valorCentipeoes === null || valorCentipeoes === undefined) return "0.00";
    const valor = valorCentipeoes / 100;
    const sinal = valor > 0 ? '+' : ''; // Adiciona + para positivos; negativos já têm o sinal
    return `${sinal}${valor.toFixed(2)}`;
}

/**
 * Updates the evaluation display area based on the current score from Stockfish.
 * ATUALIZADO: Implementa a lógica de ESTABILIZAÇÃO (Debounce) antes de calcular performance.
 */
function atualizarAvaliacao() {
    const gameState = getGameState();
    const jogo = getJogoInstance();

    if (gameState.modoJogo !== "humano-ia") {
        if (avaliacaoEl) avaliacaoEl.innerHTML = "Nota do lance: -.";
        return;
    }

    if (!avaliacaoEl) return;

    // 1. Obtém o score bruto que acabou de chegar (instável)
    const score = getCurrentScore();
    if (score === null) return;

    // 2. Atualiza a interface VISUAL imediatamente (para você ver que está "pensando")
    // mas ainda NÃO conta para o score oficial.
    renderizarPlacar(score, false); // false = ainda não estável

    // 3. Lógica de Estabilização (O Árbitro espera o peso parar)
    if (timerEstabilizacao) {
        clearTimeout(timerEstabilizacao); // Zera se chegou nova mensagem (instabilidade)
    }

    // Inicia contagem de 2.5s de silêncio
    timerEstabilizacao = setTimeout(() => {
        // --- O CÓDIGO AQUI DENTRO SÓ RODA SE FICAR 2.5s SEM MUDANÇA ---
        
        const scoreDefinitivo = score;
        
        // Calcula o "Arremesso" (Diferença entre onde parou e de onde saiu)
        const delta = scoreDefinitivo - scoreEstavelAnterior;

        // Quem jogou por último? (Quem arremessou o peso?)
        // Se a vez é das Pretas ('b'), quem jogou foi Brancas.
        // Se a vez é das Brancas ('w'), quem jogou foi Pretas.
        if (jogo && jogo.turn() === 'b') {
            // Turno das Pretas = Brancas jogaram e agora estabilizou
            notaUltimaBrancas = delta;
            performanceBrancas += delta;
        } else if (jogo && jogo.turn() === 'w') {
            // Turno das Brancas = Pretas jogaram e agora estabilizou
            // Para pretas, delta NEGATIVO é bom (ex: ir de 30 para -50 é ótimo)
            // Multiplicamos por -1 para mostrar pontos positivos quando elas jogam bem
            const pontosPretas = delta * -1;
            notaUltimaPretas = pontosPretas;
            performancePretas += pontosPretas;
        }

        // Atualiza a base para o próximo lance
        scoreEstavelAnterior = scoreDefinitivo;

        // Atualiza o placar visualmente, agora com os novos totais confirmados
        renderizarPlacar(scoreDefinitivo, true);

    }, TEMPO_ESTABILIZACAO);
}

/**
 * Função auxiliar para desenhar o HTML do placar.
 * @param {number} currentScore - O score atual (estável ou não)
 * @param {boolean} estavel - Se o valor é definitivo ou ainda está calculando
 */
function renderizarPlacar(currentScore, estavel) {
    if (!avaliacaoEl) return;

    // Converte o score principal para peões se for numérico
    let textoAvaliacao;
    if (Math.abs(currentScore) >= 10000) {
        const movesToMate = Math.floor((10001 - Math.abs(currentScore)) / 2) + 1;
        textoAvaliacao = `Mate em ${movesToMate}`;
    } else {
        textoAvaliacao = `${formatarParaPeoes(currentScore)}`; // Exibe como 0.35, -1.20, etc.
    }

    let indicadorEstabilidade = estavel ? "" : " (Calculando...)";

    // Formatação visual
    const estiloCalculando = estavel ? "" : "color: #888; font-style: italic;";

    // Formata os valores de performance dividindo por 100
    const strUltB = formatarParaPeoes(notaUltimaBrancas);
    const strPerfB = formatarParaPeoes(performanceBrancas);
    const strUltP = formatarParaPeoes(notaUltimaPretas);
    const strPerfP = formatarParaPeoes(performancePretas);

    avaliacaoEl.innerHTML = `
        <div style="${estiloCalculando}">
            <strong>Avaliação:</strong> ${textoAvaliacao}${indicadorEstabilidade}
        </div>
        <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #ccc; font-size: 0.9em;">
            <strong>Performance (Definitiva):</strong><br>
            ⚪ Brancas: Última ${strUltB} | Total ${strPerfB}<br>
            ⚫ Pretas: Última ${strUltP} | Total ${strPerfP}
        </div>
    `;
}

/**
 * Displays an emoji evaluation on the board near the human's last move based on the score.
 */
function mostrarEmojiAvaliacao(score) {
    const gameState = getGameState();

    if (gameState.modoJogo !== "humano-ia") return;

    document.querySelectorAll(".emoji-avaliacao").forEach(el => el.remove());
    clearAvaliacaoTimeout();

    if (score !== null && gameState.ultimaCasaHumano && gameState.indiceAtual === gameState.historicoJogadas.length) {
        let emoji;
        if (score >= 300) emoji = '🤩'; 
        else if (score >= 100) emoji = '👍'; 
        else if (score <= -300) emoji = '😭'; 
        else if (score <= -100) emoji = '👎'; 
        else if (score >= -50 && score <= 50) emoji = '🤔'; 
        else emoji = '😐'; 

        const casaAlvo = document.querySelector(`[data-posicao="${gameState.ultimaCasaHumano}"]`);
        let bolha = null;
        if (casaAlvo) {
            bolha = document.createElement("div");
            bolha.className = "emoji-avaliacao";
            bolha.innerText = emoji;
            bolha.style.position = "absolute";
            bolha.style.top = "50%";
            bolha.style.left = "50%";
            bolha.style.transform = "translate(-50%, -50%)";
            bolha.style.fontSize = "2rem";
            bolha.style.zIndex = "10";
            bolha.style.pointerEvents = "none";
            casaAlvo.appendChild(bolha);

            const timeoutId = setTimeout(() => {
                if (bolha && bolha.parentElement) {
                    bolha.parentElement.removeChild(bolha);
                }
            }, 3000);
            setAvaliacaoTimeout(timeoutId);
        }
    } else {
        document.querySelectorAll(".emoji-avaliacao").forEach(el => el.remove());
        clearAvaliacaoTimeout();
    }
}

/**
 * Checks if the current position is in check and displays a "XEQUE!" label if so.
 */
function verificarXeque() {
    if (!infoEl) return;

    const jogo = getJogoInstance();

    if (!jogo) {
        if (xequeLabel) {
            xequeLabel.remove();
            xequeLabel = null;
        }
        return;
    }

    if (xequeLabel) {
        xequeLabel.remove();
        xequeLabel = null;
    }

    if (jogo && jogo.in_check()) {
        xequeLabel = document.createElement("div");
        xequeLabel.id = "xeque-label";
        xequeLabel.innerText = "XEQUE!";
        xequeLabel.style.backgroundColor = "red";
        xequeLabel.style.color = "white";
        xequeLabel.style.padding = "5px 10px";
        xequeLabel.style.fontWeight = "bold";
        xequeLabel.style.borderRadius = "5px";
        xequeLabel.style.marginLeft = "10px";
        xequeLabel.style.display = "inline-block";

        const sugestoesContainer = document.querySelector("#sugestoes .sugestoes-container") || infoEl;
        if (sugestoesContainer) {
            sugestoesContainer.appendChild(xequeLabel);
        }
    }
}


/**
 * Shows the manual/instructions screen and hides all game-related elements.
 */
function mostrarManual() {
    if (mainTitleEl) mainTitleEl.style.display = "none";
    if (configContainerEl) configContainerEl.style.display = "none";
    if (topControlsContainerEl) topControlsContainerEl.style.display = "none";
    if (estadoJogoEl) estadoJogoEl.style.display = "none";
    if (boardContainerEl) boardContainerEl.style.display = "none";
    if (capturasEl) capturasEl.style.display = "none";
    if (sugestoesEl) sugestoesEl.style.display = "none";
    if (infoEl) infoEl.style.display = "none";
    if (avaliacaoEl) avaliacaoEl.style.display = "none";
    if (gerenciarTreinosEl) gerenciarTreinosEl.style.display = "none";

    if (manualEl) manualEl.style.display = "block";
}

/**
 * Shows the training problems management screen and hides all game-related elements.
 */
function mostrarGerenciarTreinos() {
    console.log("DEBUG: Iniciando mostrarGerenciarTreinos...");
    if (mainTitleEl) mainTitleEl.style.display = "none";
    if (configContainerEl) configContainerEl.style.display = "none";
    if (topControlsContainerEl) topControlsContainerEl.style.display = "none";
    if (estadoJogoEl) estadoJogoEl.style.display = "none";
    if (boardContainerEl) boardContainerEl.style.display = "none";
    if (capturasEl) capturasEl.style.display = "none";
    if (sugestoesEl) sugestoesEl.style.display = "none";
    if (infoEl) infoEl.style.display = "none";
    if (avaliacaoEl) avaliacaoEl.style.display = "none";
    if (manualEl) manualEl.style.display = "none";


    if (gerenciarTreinosEl) {
        console.log("DEBUG: Elemento #gerenciar-treinos encontrado. Exibindo...");
        gerenciarTreinosEl.style.display = "block";
        
        // Verificação segura antes de chamar a função importada
        if (typeof atualizarListaProblemas === 'function') {
            console.log("DEBUG: Chamando atualizarListaProblemas()...");
            try {
                atualizarListaProblemas();
                console.log("DEBUG: atualizarListaProblemas() executada.");
            } catch (error) {
                console.error("DEBUG: Erro ao executar atualizarListaProblemas:", error);
                mostrarMensagemTemporaria("Erro ao carregar lista. Verifique o console.");
            }
        } else {
            console.error("DEBUG: ERRO CRÍTICO - atualizarListaProblemas não é uma função válida!");
            mostrarMensagemTemporaria("Erro interno: Função de lista não encontrada.");
        }
    } else {
        console.error("DEBUG: Elemento #gerenciar-treinos NÃO ENCONTRADO no DOM.");
    }
}

/**
 * Returns to the main game screen from the manual or training screens.
 */
function voltarAoJogo() {
    const gameState = getGameState();

    if (mainTitleEl) mainTitleEl.style.display = "block";
    if (configContainerEl) configContainerEl.style.display = "flex"; 
    if (topControlsContainerEl) topControlsContainerEl.style.display = "flex";
    if (estadoJogoEl) estadoJogoEl.style.display = "block";
    if (boardContainerEl) {
        boardContainerEl.style.display = "block";
        if (tabuleiroEl) {
            tabuleiroEl.style.display = "grid";
            tabuleiroEl.style.visibility = "visible";
            criarTabuleiro();
        } 
    }

    if (capturasEl) capturasEl.style.display = "block";

    if (sugestoesEl && gameState.modoJogo === "humano-ia") {
         sugestoesEl.style.display = "block";
         mostrarSugestoes(getSugestoesIA());
    } else if (sugestoesEl) {
         sugestoesEl.style.display = "none";
    }

    if (infoEl) infoEl.style.display = "block";


    if (avaliacaoEl && gameState.modoJogo === "humano-ia") {
         avaliacaoEl.style.display = "block";
         atualizarAvaliacao();
    } else if (avaliacaoEl) {
         avaliacaoEl.style.display = "none";
    }


    if (manualEl) manualEl.style.display = "none";
    if (gerenciarTreinosEl) gerenciarTreinosEl.style.display = "none";

    atualizarInfo();
    atualizarEstadoJogo();
}

/**
 * Updates the main info area (turn, player names, move count).
 */
function atualizarInfo() {
    if (!infoEl) return;
    const jogo = getJogoInstance();

    if (!jogo) {
        infoEl.innerHTML = '<strong>Aguardando Iniciar Partida...</strong>';
        return;
    }

    const gameState = getGameState();
    const totalHalfMoves = jogo ? jogo.history().length : 0;
    const jogadasCompletas = Math.floor(totalHalfMoves / 2);

    let texto;
    if (gameState.modoJogo === "humano-humano") {
        texto = `Suas peças: ${mostrarCor(gameState.corUsuario)} | A jogar: ${mostrarCor(jogo.turn())}`;
        infoEl.innerHTML = `<strong>${texto} | Jogadas: ${jogadasCompletas}</strong>`;
    } else {
        const jogadorAtual = jogo && jogo.turn() === 'w' ? gameState.nomeJogador1 || "Jogador 1" : gameState.nomeJogador2 || "Jogador 2";
        const corAtual = jogo && jogo.turn() === 'w' ? 'Br' : 'Pr';
        texto = `A jogar: ${jogadorAtual} (${corAtual})`;
        infoEl.innerHTML = `<strong>${texto} | Jogadas: ${jogadasCompletas}</strong>`;
        if (sugestoesLinhaEl) sugestoesLinhaEl.innerHTML = "<span>Sugestões apenas no modo IA</span>";
        if (avaliacaoEl) avaliacaoEl.innerHTML = "Nota do lance: -.";
    }
    verificarXeque();
}

/**
 * Updates the game state display (mode, players, AI level).
 */
function atualizarEstadoJogo(modeFromConfig) {
    if (!estadoJogoEl) return;
    const jogo = getJogoInstance();
    const gameState = getGameState();
    const currentLevel = getCurrentLevel();

    const currentMode = modeFromConfig || gameState.modoJogo;


    if (gameState.partidaIniciada && jogo && !jogo.game_over()) {
        if (currentMode === "humano-humano") {
            estadoJogoEl.innerHTML = `Partida Humano vs Humano: ${gameState.nomeJogador1 || "Jogador 1"} (Br) vs ${gameState.nomeJogador2 || "Jogador 2"} (Pr).`;
        } else {
            const nivelEl = document.getElementById("profundidade");
            const nivelTexto = nivelEl ? nivelEl.options[nivelEl.selectedIndex].text : getLevelName(currentLevel);
            estadoJogoEl.innerHTML = `Partida Humano vs IA (${nivelTexto}): Você (${mostrarCor(gameState.corUsuario)}) vs IA (${mostrarCor(gameState.corUsuario === 'w' ? 'b' : 'w')}).`;
        }
    } else if (gameState.partidaIniciada && jogo && jogo.game_over()) {
        let resultado = "Fim de Jogo";
        if (jogo.in_checkmate()) resultado = "Xeque-mate";
        else if (jogo.in_draw()) resultado = "Empate";

        if (currentMode === "humano-humano") {
            estadoJogoEl.innerHTML = `${resultado}! Partida entre ${gameState.nomeJogador1 || "Jogador 1"} e ${gameState.nomeJogador2 || "Jogador 2"}.`;
        } else {
             const nivelEl = document.getElementById("profundidade");
            const nivelTexto = nivelEl ? nivelEl.options[nivelEl.selectedIndex].text : getLevelName(currentLevel);
            estadoJogoEl.innerHTML = `${resultado}! Partida entre Você (${mostrarCor(gameState.corUsuario)}) e IA (${mostrarCor(gameState.corUsuario === 'w' ? 'b' : 'w')}).`;
        }
    } else {
          if (currentMode === "humano-humano") {
              estadoJogoEl.innerHTML = "Pronto para Humano vs Humano. Preencha os nomes e clique em Iniciar.";
          } else {
              const nivelEl = document.getElementById("profundidade");
              const nivelTexto = nivelEl ? nivelEl.options[nivelEl.selectedIndex].text : getLevelName(currentLevel);
              estadoJogoEl.innerHTML = `Pronto para Humano vs IA (${nivelTexto}). Escolha a cor e clique em Iniciar.`;
          }
    }
}

/**
 * Displays the AI's move suggestions in the designated UI area.
 */
function mostrarSugestoes(suggestions) {
     if (!sugestoesLinhaEl) return;
    if (suggestions && suggestions.length > 0) {
        const sugestoesTexto = suggestions.slice(0, 3).map(s => `${s.slice(0, 2)} → ${s.slice(2, 4)}`).join(", ");
        sugestoesLinhaEl.innerHTML = `<span>Sugestões: ${sugestoesTexto}</span>`;
    } else {
        sugestoesLinhaEl.innerHTML = "<span>Sem sugestões disponíveis.</span>";
    }
}

/**
 * Sends a temporary absence message. (Placeholder)
 */
function enviarMensagemAusencia() {
    mostrarMensagemTemporaria("Função de Ausência não implementada.");
}


// --- Funções de Configuração e Início ---

/**
 * Lida com o início do jogo, lendo as configurações da UI.
 */
function handleStartGame() {
    const modoJogoEl = document.getElementById("modo-jogo");
    const corEl = document.getElementById("cor");
    const profundidadeEl = document.getElementById("profundidade");
    const nomeJogador1El = document.getElementById("nome-jogador1");
    const nomeJogador2El = document.getElementById("nome-jogador2");

    const modo = modoJogoEl.value;
    const cor = corEl.value;
    const nome1 = nomeJogador1El.value;
    const nome2 = nomeJogador2El.value;
    
// Configura o Stockfish com base na profundidade/tempo escolhida na UI
    if (profundidadeEl) {
        const nivelEscolhido = profundidadeEl.value;
        if (nivelEscolhido) {
            setCurrentLevel(nivelEscolhido);
        }
    }


    if (modo === "humano-humano") {
        if (!nome1 || !nome2) {
            mostrarMensagemTemporaria("Por favor, insira o nome de ambos os jogadores.", 3000);
            return;
        }
    }
    
    // Zera as variáveis de performance explicitamente ao clicar em Iniciar
    performanceBrancas = 0;
    performancePretas = 0;
    notaUltimaBrancas = 0;
    notaUltimaPretas = 0;
    scoreEstavelAnterior = 30; 
    if (timerEstabilizacao) clearTimeout(timerEstabilizacao);

    // Chama a função de início no game-state
    iniciarNovoJogo(modo, cor, nome1, nome2);
}

/**
 * Lida com a mudança de modo (IA vs Humano) para mostrar/esconder as configurações de nome.
 */
function handleModeChange() {
    const modo = document.getElementById("modo-jogo").value;
    const configIA = document.getElementById("config-humano-ia");
    const configHumano = document.getElementById("config-humano-humano");
    const sugestoesSection = document.getElementById("sugestoes");
    const avaliacaoSection = document.getElementById("avaliacao");

    if (modo === "humano-ia") {
        configIA.style.display = 'flex';
        configHumano.style.display = 'none';
        if (sugestoesSection) sugestoesSection.style.display = 'block';
        if (avaliacaoSection) avaliacaoSection.style.display = 'block';
    } else {
        configIA.style.display = 'none';
        configHumano.style.display = 'flex';
        if (sugestoesSection) sugestoesSection.style.display = 'none';
        if (avaliacaoSection) avaliacaoSection.style.display = 'none';
    }
    
    // Atualiza o texto do estado do jogo imediatamente após a mudança de modo
    atualizarEstadoJogo(modo);
}


/**
 * Binds event listeners to various UI elements after the DOM is loaded.
 */
function bindUIEvents() {
    initializeUIElements();

    // --- EVENTOS DE CONTROLE ---
    const voltarBtn = document.getElementById("btn-voltar");
    if (voltarBtn) voltarBtn.addEventListener('click', goBackMove);

    const avancarBtn = document.getElementById("btn-avancar");
    if (avancarBtn) avancarBtn.addEventListener('click', goForwardMove);

    const retomarBtn = document.getElementById("btn-retomar");
    if (retomarBtn) retomarBtn.addEventListener('click', resumeGame);

    const manualBtn = document.getElementById("btn-manual");
    if (manualBtn) manualBtn.addEventListener('click', mostrarManual);

    // Adiciona log para verificar se o botão de treinos é encontrado
    // const treinosBtn = document.getElementById("botao-problema-mate");
    //if (treinosBtn) {
    //    treinosBtn.addEventListener('click', mostrarGerenciarTreinos);
    //} else {
     //   console.error("DEBUG: Botão #botao-problema-mate NÃO ENCONTRADO no DOM.");
    }
    
    // LIGAÇÃO DO NOVO BOTÃO DE CONFIRMAÇÃO
    const btnConfirmar = document.getElementById("btn-confirmar");
    if (btnConfirmar) btnConfirmar.addEventListener('click', processarConfirmacao);


    // --- EVENTOS DE CONFIGURAÇÃO ---
    const iniciarBtn = document.getElementById("btn-iniciar"); 
    if (iniciarBtn) iniciarBtn.addEventListener('click', handleStartGame);
    
    const modoJogoEl = document.getElementById("modo-jogo");
    if (modoJogoEl) {
        modoJogoEl.addEventListener('change', handleModeChange);
        handleModeChange(); // Chama na inicialização para configurar o display inicial
    }


    // --- LIGAÇÃO DOS BOTÕES SECUNDÁRIOS ---
    
    const dicasBtn = document.getElementById("botao-dicas");
    if (dicasBtn) dicasBtn.addEventListener('click', sugerirJogadas);

    const voltarDoManualBtn = manualEl ? manualEl.querySelector("button") : null;
    if (voltarDoManualBtn) voltarDoManualBtn.addEventListener('click', voltarAoJogo);

    const voltarDosTreinosBtn = gerenciarTreinosEl ? gerenciarTreinosEl.querySelector("button:last-child") : null;
    if (voltarDosTreinosBtn) voltarDosTreinosBtn.addEventListener('click', voltarAoJogo);

    const salvarPosicaoBtn = gerenciarTreinosEl ? gerenciarTreinosEl.querySelector("button:nth-of-type(1)") : null;
    if (salvarPosicaoBtn) salvarPosicaoBtn.addEventListener('click', salvarPosicaoAtual);

// }

// Garante que os eventos sejam ligados após o DOM ser carregado
document.addEventListener('DOMContentLoaded', bindUIEvents);

// ========================================================
// EXPORTAÇÕES DE MÓDULO (Refatorado para bloco único)
// ========================================================
export {
    criarTabuleiro,
    getCasaSelecionada,
    setCasaSelecionada,
    updateCapturesDisplay,
    mostrarCor,
    mostrarMensagemTemporaria,
    atualizarAvaliacao,
    mostrarEmojiAvaliacao,
    verificarXeque,
    mostrarManual,
    mostrarGerenciarTreinos,
    voltarAoJogo,
    atualizarInfo,
    atualizarEstadoJogo,
    mostrarSugestoes, // AGORA EXPORTADO CORRETAMENTE NO BLOCO FINAL
    bindUIEvents
};

function carregarEstadoDeJogo(fen) {
    console.log("DEBUG: Carregando nova posição FEN...", fen);
    
    // 1. Pega a instância do jogo (o cérebro)
    const jogo = getJogoInstance(); 
    
    // 2. Verifica se o cérebro está pronto e injeta a nova posição
    if (jogo && typeof jogo.load === 'function') {
        jogo.load(fen);
    } else {
        console.error("Erro: O motor do jogo não aceitou o comando load().");
        mostrarMensagemTemporaria("Erro ao carregar a posição.");
        return;
    }
    
    // 3. Atualiza o visual do tabuleiro com as peças no novo lugar
    if (typeof criarTabuleiro === 'function') {
        criarTabuleiro();
    }
    
    // 4. Retorna para a tela principal
    voltarAoJogo();
}

// ========================================================
// EXPOSIÇÃO GLOBAL (FIX para Dependência Circular e Sync)
// ========================================================
// Funções que pos_salvas.js precisa acessar globalmente
if (typeof window !== 'undefined') {
    window.voltarAoJogo = voltarAoJogo;
    window.mostrarMensagemTemporaria = mostrarMensagemTemporaria;
    window.criarTabuleiro = criarTabuleiro;
    window.carregarEstadoDeJogo = carregarEstadoDeJogo;
    window.getJogoInstance = getJogoInstance; 
}