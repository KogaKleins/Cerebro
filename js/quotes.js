/**
 * QUOTES MODULE
 * Manages daily quotes and fun messages
 */

import { State } from './state.js';

export const Quotes = {
    // Quotes with authors
    quotesWithAuthors: [
        { text: "Café é o combustível do cérebro!", author: "Anônimo Cafeínado" },
        { text: "Primeiro café, depois trabalho!", author: "Filosofia do Cérebro" },
        { text: "Sem café, sem código.", author: "Desenvolvedor Sábio" },
        { text: "O café de hoje paga o bug de ontem.", author: "Lei de Murphy" },
        { text: "Debugar é como ser detetive num crime onde você é o assassino.", author: "Filipe Deschamps" },
        { text: "Funciona na minha máquina!", author: "Todo Dev" },
        { text: "99 little bugs in the code... take one down, patch it around... 127 little bugs in the code.", author: "Tradição Dev" },
        { text: "É só adicionar café e tudo se resolve.", author: "Otimista Cafeínado" },
        { text: "O código funciona e ninguém sabe por quê.", author: "Realidade" },
        { text: "Café: porque adultar é difícil.", author: "Verdade Universal" },
        { text: "Não há problema que café e chocolate não resolvam.", author: "Terapia do Cérebro" },
        { text: "Keep calm and drink coffee.", author: "Filosofia Britânica" },
        { text: "A vida começa depois do café.", author: "Bom Senso" },
        { text: "Café: a pausa que o cérebro merece.", author: "Marketing Interno" },
        { text: "Ideias geniais surgem entre um café e outro.", author: "Eureka Cafeínado" },
        { text: "Errar é humano. Culpar o estagiário é empresarial.", author: "RH não aprova" },
        { text: "Em caso de dúvida, tome mais café.", author: "Protocolo do Setor" },
        { text: "Café forte, equipe mais forte!", author: "Liderança" },
        { text: "Aqui pensamos antes de agir... depois do café.", author: "PCP" },
        { text: "Qualidade começa com Q de Quero Café.", author: "Setor Qualidade" }
    ],

    init() {
        this.displayQuote();
    },
    
    displayQuote() {
        const quoteElement = document.getElementById('dailyQuote');
        const authorElement = document.getElementById('quoteAuthor');
        
        if (quoteElement && !quoteElement.textContent) {
            const quote = this.getRandomQuote();
            quoteElement.textContent = `"${quote.text}"`;
            if (authorElement) {
                authorElement.textContent = `- ${quote.author}`;
            }
        }
    },
    
    getRandomQuote() {
        const stateQuote = State.getRandomQuote();
        // Try to find matching quote with author
        const match = this.quotesWithAuthors.find(q => 
            stateQuote.includes(q.text.substring(0, 20))
        );
        
        if (match) return match;
        
        // Return random from our list
        return this.quotesWithAuthors[Math.floor(Math.random() * this.quotesWithAuthors.length)];
    },
    
    change() {
        const quoteElement = document.getElementById('dailyQuote');
        const authorElement = document.getElementById('quoteAuthor');
        if (!quoteElement) return;
        
        const quote = this.getRandomQuote();
        
        // Add animation
        quoteElement.style.opacity = '0';
        if (authorElement) authorElement.style.opacity = '0';
        
        setTimeout(() => {
            quoteElement.textContent = `"${quote.text}"`;
            if (authorElement) {
                authorElement.textContent = `- ${quote.author}`;
                authorElement.style.opacity = '1';
            }
            quoteElement.style.opacity = '1';
        }, 200);
    }
};

// Export function for global access
window.changeQuote = () => Quotes.change();
