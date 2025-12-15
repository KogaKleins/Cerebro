/**
 * EASTER EGGS MODULE
 * Fun hidden features and shortcuts
 */

import { Utils } from './utils.js';

export const EasterEggs = {
    // Estado dos easter eggs
    activated: {
        konami: false,
        coffee: false,
        matrix: false
    },
    
    // Controle de cooldown para evitar spam
    cooldowns: {},
    
    init() {
        this.setupKonamiCode();
        this.setupCoffeeShortcut();
        this.setupSecretCombos();
        this.injectStyles();
    },
    
    /**
     * Verifica e gerencia cooldowns
     */
    isOnCooldown(name, cooldownMs = 5000) {
        const now = Date.now();
        if (this.cooldowns[name] && now - this.cooldowns[name] < cooldownMs) {
            return true;
        }
        this.cooldowns[name] = now;
        return false;
    },
    
    /**
     * Código Konami clássico: ↑↑↓↓←→←→BA
     */
    setupKonamiCode() {
        let konamiBuffer = [];
        const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
        
        document.addEventListener('keydown', (e) => {
            // Ignorar se estiver digitando em input/textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            konamiBuffer.push(e.key);
            konamiBuffer = konamiBuffer.slice(-10);
            
            if (konamiBuffer.join(',') === konamiSequence.join(',')) {
                if (!this.isOnCooldown('konami', 10000)) {
                    this.activateRainbowMode();
                }
            }
        });
    },
    
    /**
     * Modo arco-íris com efeitos visuais melhorados
     */
    activateRainbowMode() {
        this.activated.konami = true;
        
        // Adicionar classe ao body para animação
        document.body.classList.add('easter-rainbow-mode');
        
        // Criar partículas de confete
        this.createConfetti();
        
        // Toast especial
        Utils.showToast('🎮 KONAMI CODE! +30 anos de jogos desbloqueados!', 'success');
        
        // Reproduzir som se disponível
        this.playSound('powerup');
        
        // Remover efeito após 6 segundos
        setTimeout(() => {
            document.body.classList.remove('easter-rainbow-mode');
        }, 6000);
    },
    
    /**
     * Atalho do café: duplo clique em 'C'
     */
    setupCoffeeShortcut() {
        let lastCPress = 0;
        let cPressCount = 0;
        
        document.addEventListener('keydown', (e) => {
            if (!e || !e.key) return;
            // Ignorar se estiver digitando
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            if (e.key.toLowerCase() === 'c') {
                const now = Date.now();
                
                if (now - lastCPress < 400) {
                    cPressCount++;
                    
                    if (cPressCount === 2 && !this.isOnCooldown('coffee', 3000)) {
                        this.showCoffeeTip();
                    } else if (cPressCount >= 5 && !this.isOnCooldown('coffeeCrazy', 10000)) {
                        this.activateCoffeeMania();
                    }
                } else {
                    cPressCount = 1;
                }
                
                lastCPress = now;
            }
        });
    },
    
    /**
     * Dica de café normal
     */
    showCoffeeTip() {
        const tips = [
            '☕ Precisa de café? Vá fazer um para o setor!',
            '☕ O café está chamando... será que é hora?',
            '☕ Café: combustível de desenvolvedor!',
            '☕ Uma xícara de café resolve qualquer bug!',
            '☕ Ctrl+C Ctrl+Coffee!'
        ];
        Utils.showToast(tips[Math.floor(Math.random() * tips.length)]);
    },
    
    /**
     * Easter egg de café maluco (5+ vezes 'C')
     */
    activateCoffeeMania() {
        this.activated.coffee = true;
        
        // Chuva de cafés!
        this.createCoffeeRain();
        
        Utils.showToast('☕☕☕ COFFEE OVERLOAD! ☕☕☕', 'warning');
    },
    
    /**
     * Combos secretos adicionais
     */
    setupSecretCombos() {
        let buffer = [];
        
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            buffer.push(e.key.toLowerCase());
            buffer = buffer.slice(-10);
            const sequence = buffer.join('');
            
            // "matrix" - Efeito Matrix
            if (sequence.endsWith('matrix') && !this.isOnCooldown('matrix', 15000)) {
                this.activateMatrixMode();
            }
            
            // "cafe" ou "coffee" - Menu rápido de café
            if ((sequence.endsWith('cafe') || sequence.endsWith('coffee')) && !this.isOnCooldown('cafequick', 3000)) {
                this.quickCoffeeAction();
            }
            
            // "gg" - GG!
            if (sequence.endsWith('gg') && !this.isOnCooldown('gg', 5000)) {
                Utils.showToast('🎮 GG! Bom jogo!');
            }
        });
    },
    
    /**
     * Efeito Matrix (caracteres caindo)
     */
    activateMatrixMode() {
        this.activated.matrix = true;
        
        const canvas = document.createElement('canvas');
        canvas.id = 'matrixCanvas';
        canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 9999;
            opacity: 0.8;
        `;
        document.body.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const chars = '01アイウエオカキクケコ☕🔥⚡';
        const fontSize = 14;
        const columns = canvas.width / fontSize;
        const drops = Array(Math.floor(columns)).fill(1);
        
        Utils.showToast('🟢 Você está na Matrix do Café...', 'success');
        
        const draw = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#0F0';
            ctx.font = `${fontSize}px monospace`;
            
            for (let i = 0; i < drops.length; i++) {
                const char = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillText(char, i * fontSize, drops[i] * fontSize);
                
                if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        };
        
        const interval = setInterval(draw, 33);
        
        // Parar após 8 segundos
        setTimeout(() => {
            clearInterval(interval);
            canvas.remove();
            this.activated.matrix = false;
        }, 8000);
    },
    
    /**
     * Ação rápida de café - navegar para página de café
     */
    quickCoffeeAction() {
        const coffeeLink = document.querySelector('a[href="#coffee"], [data-page="coffee"]');
        if (coffeeLink) {
            coffeeLink.click();
            Utils.showToast('☕ Navegando para o café...');
        } else {
            Utils.showToast('☕ Atalho de café detectado!');
        }
    },
    
    /**
     * Criar confete para celebrações
     */
    createConfetti() {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500'];
        const container = document.createElement('div');
        container.className = 'easter-confetti-container';
        container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999; overflow: hidden;';
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'easter-confetti';
            confetti.style.cssText = `
                position: absolute;
                width: ${Math.random() * 10 + 5}px;
                height: ${Math.random() * 10 + 5}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}%;
                top: -20px;
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                animation: confettiFall ${Math.random() * 2 + 2}s linear forwards;
                animation-delay: ${Math.random() * 0.5}s;
            `;
            container.appendChild(confetti);
        }
        
        document.body.appendChild(container);
        
        setTimeout(() => container.remove(), 4000);
    },
    
    /**
     * Criar chuva de cafés
     */
    createCoffeeRain() {
        const container = document.createElement('div');
        container.className = 'easter-coffee-rain';
        container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999; overflow: hidden;';
        
        for (let i = 0; i < 30; i++) {
            const coffee = document.createElement('div');
            coffee.textContent = '☕';
            coffee.style.cssText = `
                position: absolute;
                font-size: ${Math.random() * 20 + 15}px;
                left: ${Math.random() * 100}%;
                top: -30px;
                animation: confettiFall ${Math.random() * 2 + 1.5}s linear forwards;
                animation-delay: ${Math.random() * 1}s;
            `;
            container.appendChild(coffee);
        }
        
        document.body.appendChild(container);
        
        setTimeout(() => container.remove(), 4000);
    },
    
    /**
     * Reproduzir sons (se disponível)
     */
    playSound(type) {
        // Sons podem ser adicionados futuramente
        // Por enquanto é silencioso para não incomodar
    },
    
    /**
     * Injetar estilos necessários para os easter eggs
     */
    injectStyles() {
        if (document.getElementById('easter-egg-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'easter-egg-styles';
        style.textContent = `
            /* Rainbow Mode */
            .easter-rainbow-mode {
                animation: rainbowBg 2s ease infinite !important;
            }
            
            @keyframes rainbowBg {
                0% { filter: hue-rotate(0deg); }
                50% { filter: hue-rotate(180deg); }
                100% { filter: hue-rotate(360deg); }
            }
            
            /* Confetti Fall */
            @keyframes confettiFall {
                0% {
                    transform: translateY(0) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translateY(100vh) rotate(720deg);
                    opacity: 0;
                }
            }
            
            /* Easter egg discovered indicator */
            .easter-egg-discovered {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 10px 20px;
                border-radius: 30px;
                font-weight: bold;
                z-index: 10000;
                animation: bounceIn 0.5s ease;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            }
            
            @keyframes bounceIn {
                0% { transform: scale(0); }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
};
