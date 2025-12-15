/**
 * THEME MODULE
 * Handles dark/light theme switching
 */

export const Theme = {
    currentTheme: 'light',
    
    init() {
        // Load saved theme preference
        const savedTheme = localStorage.getItem('cerebroTheme') || 'light';
        this.setTheme(savedTheme, false);
        
        // Listen for system preference changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem('cerebroTheme')) {
                    this.setTheme(e.matches ? 'dark' : 'light', false);
                }
            });
        }
    },
    
    toggle() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme, true);
    },
    
    setTheme(theme, save = true) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update meta theme-color
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.setAttribute('content', theme === 'dark' ? '#1a1a1a' : '#6F4E37');
        }
        
        if (save) {
            localStorage.setItem('cerebroTheme', theme);
        }
        
        console.log(`🎨 Tema alterado para: ${theme}`);
    },
    
    isDark() {
        return this.currentTheme === 'dark';
    }
};
