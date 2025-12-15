/**
 * LOTTERY MODULE
 * Random coffee maker selection
 */

import { Auth } from './auth.js';
import { Utils } from './utils.js';

export const Lottery = {
    isSpinning: false,
    
    // Get all team members
    getMembers() {
        const users = Auth.users;
        return Object.values(users).map(u => ({
            name: u.name,
            avatar: u.avatar
        }));
    },
    
    // Spin the wheel and select a random person
    async spin() {
        if (this.isSpinning) return null;
        
        this.isSpinning = true;
        const members = this.getMembers();
        
        if (members.length === 0) {
            this.isSpinning = false;
            return null;
        }
        
        // Visual spinning animation
        const resultEl = document.getElementById('lotteryResult');
        const spinBtn = document.getElementById('lotterySpinBtn');
        
        if (spinBtn) {
            spinBtn.disabled = true;
            spinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sorteando...';
        }
        
        // Simulate spinning through names
        let spins = 0;
        const totalSpins = 20;
        const spinInterval = 100;
        
        await new Promise((resolve) => {
            const interval = setInterval(() => {
                const randomMember = members[Math.floor(Math.random() * members.length)];
                
                if (resultEl) {
                    resultEl.innerHTML = `
                        <div class="lottery-spinning">
                            <span class="lottery-avatar">${randomMember.avatar}</span>
                            <span class="lottery-name">${randomMember.name}</span>
                        </div>
                    `;
                }
                
                spins++;
                
                if (spins >= totalSpins) {
                    clearInterval(interval);
                    resolve();
                }
            }, spinInterval);
        });
        
        // Final selection
        const winner = members[Math.floor(Math.random() * members.length)];
        
        if (resultEl) {
            resultEl.innerHTML = `
                <div class="lottery-winner">
                    <div class="lottery-winner-crown">👑</div>
                    <span class="lottery-avatar-big">${winner.avatar}</span>
                    <span class="lottery-name-big">${winner.name}</span>
                    <p class="lottery-message">Vai fazer o café! ☕</p>
                </div>
            `;
            resultEl.classList.add('winner-animation');
        }
        
        if (spinBtn) {
            spinBtn.disabled = false;
            spinBtn.innerHTML = '<i class="fas fa-dice"></i> Sortear Novamente';
        }
        
        // Play celebration
        this.celebrate();
        
        this.isSpinning = false;
        
        Utils.showToast(`🎲 ${winner.name} foi sorteado para fazer o café!`);
        
        return winner;
    },
    
    celebrate() {
        // Create confetti effect
        const colors = ['#6F4E37', '#A1887F', '#D7CCC8', '#BCAAA4', '#8D6E63'];
        const confettiCount = 50;
        
        for (let i = 0; i < confettiCount; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.cssText = `
                    position: fixed;
                    width: 10px;
                    height: 10px;
                    background: ${colors[Math.floor(Math.random() * colors.length)]};
                    left: ${Math.random() * 100}vw;
                    top: -10px;
                    border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                    animation: confettiFall ${2 + Math.random() * 2}s linear forwards;
                    z-index: 9999;
                    pointer-events: none;
                `;
                document.body.appendChild(confetti);
                
                setTimeout(() => confetti.remove(), 4000);
            }, i * 30);
        }
    },
    
    // Open lottery modal
    openModal() {
        const modal = document.getElementById('lotteryModal');
        const resultEl = document.getElementById('lotteryResult');
        const spinBtn = document.getElementById('lotterySpinBtn');
        
        if (resultEl) {
            resultEl.innerHTML = `
                <div class="lottery-ready">
                    <i class="fas fa-dice fa-3x"></i>
                    <p>Clique para sortear quem vai fazer o café!</p>
                </div>
            `;
            resultEl.classList.remove('winner-animation');
        }
        
        if (spinBtn) {
            spinBtn.disabled = false;
            spinBtn.innerHTML = '<i class="fas fa-dice"></i> Sortear';
        }
        
        if (modal) {
            modal.classList.add('active');
        }
    },
    
    closeModal() {
        const modal = document.getElementById('lotteryModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }
};

// Add confetti animation to CSS dynamically
const style = document.createElement('style');
style.textContent = `
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
    
    .lottery-ready {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-secondary);
    }
    
    .lottery-ready i {
        color: var(--primary-coffee);
        margin-bottom: 20px;
    }
    
    .lottery-spinning {
        text-align: center;
        padding: 30px;
        animation: pulse 0.2s ease-in-out;
    }
    
    .lottery-avatar {
        font-size: 3rem;
        display: block;
        margin-bottom: 10px;
    }
    
    .lottery-name {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--text-primary);
    }
    
    .lottery-winner {
        text-align: center;
        padding: 30px;
    }
    
    .lottery-winner-crown {
        font-size: 2rem;
        animation: bounce 0.5s ease infinite;
    }
    
    .lottery-avatar-big {
        font-size: 4rem;
        display: block;
        margin: 15px 0;
    }
    
    .lottery-name-big {
        font-size: 2rem;
        font-weight: 700;
        color: var(--primary-coffee);
        display: block;
    }
    
    .lottery-message {
        margin-top: 15px;
        font-size: 1.2rem;
        color: var(--text-secondary);
    }
    
    .winner-animation {
        animation: celebrateWinner 0.5s ease;
    }
    
    @keyframes celebrateWinner {
        0% { transform: scale(0.8); opacity: 0; }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); opacity: 1; }
    }
    
    @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
    }
    
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
`;
document.head.appendChild(style);
