/**
 * PREFERENCES MODULE
 * User coffee preferences management
 */

import { State } from './state.js';
import { Utils } from './utils.js';

export const Preferences = {
    defaults: {
        coffeeStrength: 'medium', // light, medium, strong
        sugar: 'none', // none, little, medium, lots
        milk: false,
        temperature: 'hot', // hot, warm, cold
        notes: ''
    },
    
    userPreferences: {},
    
    init() {
        this.loadPreferences();
    },
    
    loadPreferences() {
        const saved = localStorage.getItem('cerebroPreferences');
        if (saved) {
            try {
                this.userPreferences = JSON.parse(saved);
            } catch (e) {
                this.userPreferences = {};
            }
        }
    },
    
    savePreferences() {
        localStorage.setItem('cerebroPreferences', JSON.stringify(this.userPreferences));
    },
    
    get(userName) {
        return this.userPreferences[userName] || { ...this.defaults };
    },
    
    set(userName, preferences) {
        this.userPreferences[userName] = {
            ...this.defaults,
            ...preferences,
            updatedAt: new Date().toISOString()
        };
        this.savePreferences();
    },
    
    getCurrentUserPreferences() {
        const user = State.getUser();
        return user ? this.get(user) : { ...this.defaults };
    },
    
    saveCurrentUserPreferences(preferences) {
        const user = State.getUser();
        if (user) {
            this.set(user, preferences);
            Utils.showToast('☕ Preferências salvas!');
        }
    },
    
    // Open preferences modal
    openModal() {
        const modal = document.getElementById('preferencesModal');
        if (!modal) return;
        
        const prefs = this.getCurrentUserPreferences();
        
        // Set form values
        const strengthEl = document.querySelector(`input[name="coffeeStrength"][value="${prefs.coffeeStrength}"]`);
        if (strengthEl) strengthEl.checked = true;
        
        const sugarEl = document.querySelector(`input[name="sugar"][value="${prefs.sugar}"]`);
        if (sugarEl) sugarEl.checked = true;
        
        const milkEl = document.getElementById('prefMilk');
        if (milkEl) milkEl.checked = prefs.milk;
        
        const tempEl = document.querySelector(`input[name="temperature"][value="${prefs.temperature}"]`);
        if (tempEl) tempEl.checked = true;
        
        const notesEl = document.getElementById('prefNotes');
        if (notesEl) notesEl.value = prefs.notes || '';
        
        modal.classList.add('active');
    },
    
    closeModal() {
        const modal = document.getElementById('preferencesModal');
        if (modal) modal.classList.remove('active');
    },
    
    saveFromForm() {
        const strength = document.querySelector('input[name="coffeeStrength"]:checked')?.value || 'medium';
        const sugar = document.querySelector('input[name="sugar"]:checked')?.value || 'none';
        const milk = document.getElementById('prefMilk')?.checked || false;
        const temperature = document.querySelector('input[name="temperature"]:checked')?.value || 'hot';
        const notes = document.getElementById('prefNotes')?.value || '';
        
        this.saveCurrentUserPreferences({
            coffeeStrength: strength,
            sugar: sugar,
            milk: milk,
            temperature: temperature,
            notes: notes
        });
        
        this.closeModal();
    },
    
    // Get preference as display text
    getDisplayText(userName) {
        const prefs = this.get(userName);
        const parts = [];
        
        const strengthMap = {
            'light': 'Fraco',
            'medium': 'Médio',
            'strong': 'Forte'
        };
        parts.push(`☕ ${strengthMap[prefs.coffeeStrength] || 'Médio'}`);
        
        const sugarMap = {
            'none': 'Sem açúcar',
            'little': 'Pouco açúcar',
            'medium': 'Açúcar normal',
            'lots': 'Muito açúcar'
        };
        parts.push(sugarMap[prefs.sugar] || 'Sem açúcar');
        
        if (prefs.milk) {
            parts.push('🥛 Com leite');
        }
        
        const tempMap = {
            'hot': '🔥 Quente',
            'warm': '☀️ Morno',
            'cold': '❄️ Gelado'
        };
        parts.push(tempMap[prefs.temperature] || '🔥 Quente');
        
        return parts.join(' • ');
    },
    
    // Display all team preferences
    displayTeamPreferences() {
        const container = document.getElementById('teamPreferences');
        if (!container) return;
        
        const allPrefs = Object.entries(this.userPreferences);
        
        if (allPrefs.length === 0) {
            container.innerHTML = `
                <div class="no-preferences">
                    <i class="fas fa-coffee"></i>
                    <p>Ninguém configurou suas preferências ainda!</p>
                    <small>Clique em "Minhas Preferências" para começar</small>
                </div>
            `;
            return;
        }
        
        container.innerHTML = allPrefs.map(([name, prefs]) => `
            <div class="preference-card glass-card">
                <div class="preference-header">
                    <span class="preference-name">${Utils.escapeHtml(name)}</span>
                </div>
                <div class="preference-details">
                    ${this.getDisplayText(name)}
                </div>
                ${prefs.notes ? `<div class="preference-notes">"${Utils.escapeHtml(prefs.notes)}"</div>` : ''}
            </div>
        `).join('');
    }
};

// Add preferences styles dynamically
const style = document.createElement('style');
style.textContent = `
    .preference-card {
        padding: var(--spacing-md);
        margin-bottom: var(--spacing-sm);
    }
    
    .preference-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }
    
    .preference-name {
        font-weight: 600;
        color: var(--primary-coffee);
        font-size: 1.1rem;
    }
    
    .preference-details {
        color: var(--text-secondary);
        font-size: 0.9rem;
    }
    
    .preference-notes {
        margin-top: 8px;
        font-style: italic;
        color: var(--text-secondary);
        font-size: 0.85rem;
        padding-left: 10px;
        border-left: 2px solid var(--primary-coffee);
    }
    
    .no-preferences {
        text-align: center;
        padding: 30px;
        color: var(--text-secondary);
    }
    
    .no-preferences i {
        font-size: 2rem;
        margin-bottom: 10px;
        color: var(--primary-coffee);
    }
    
    /* Preferences Form Styles */
    .preference-group {
        margin-bottom: var(--spacing-md);
    }
    
    .preference-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: var(--text-primary);
    }
    
    .preference-options {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }
    
    .preference-option {
        display: flex;
        align-items: center;
        gap: 5px;
    }
    
    .preference-option input[type="radio"],
    .preference-option input[type="checkbox"] {
        accent-color: var(--primary-coffee);
    }
    
    .preference-option span {
        font-size: 0.9rem;
        color: var(--text-secondary);
    }
    
    .toggle-switch {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .toggle-switch input[type="checkbox"] {
        width: 40px;
        height: 22px;
        appearance: none;
        background: var(--glass-bg);
        border-radius: 11px;
        position: relative;
        cursor: pointer;
        transition: all 0.3s ease;
        border: 1px solid var(--glass-border);
    }
    
    .toggle-switch input[type="checkbox"]::before {
        content: '';
        position: absolute;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: white;
        top: 1px;
        left: 1px;
        transition: all 0.3s ease;
        box-shadow: var(--shadow-sm);
    }
    
    .toggle-switch input[type="checkbox"]:checked {
        background: var(--primary-coffee);
    }
    
    .toggle-switch input[type="checkbox"]:checked::before {
        left: 19px;
    }
`;
document.head.appendChild(style);
