/**
 * AUTHENTICATION MODULE
 * Handles user login, logout and session management with JWT
 */

export const Auth = {
    // Mapeamento de fotos dos usuários (configuração local)
    userPhotos: {
        'renan': 'membros/renan.jpeg',
        'chris': 'membros/chris.jpeg',
        'pedrao': 'membros/pedrao.jpeg',
        'marcus': 'membros/marcus.jpeg',
        'atila': 'membros/Atila.jpeg'
    },

    // Sessão atual
    currentSession: null,
    authToken: null,

    init() {
        this.loadSession();
        this.setupLoginForm();
        
        if (!this.isAuthenticated()) {
            this.showLoginPage();
        } else {
            this.verifyTokenAndProceed();
        }
    },

    async verifyTokenAndProceed() {
        const isValid = await this.verifyToken();
        if (isValid) {
            this.hideLoginPage();
            this.updateUserDisplay();
            
            // Verificar se deve mostrar mensagem de boas-vindas (após login)
            if (sessionStorage.getItem('showWelcome') === 'true') {
                sessionStorage.removeItem('showWelcome');
                this.showWelcomeMessage();
            }
        } else {
            this.logout();
        }
    },

    loadSession() {
        const token = localStorage.getItem('cerebroToken');
        const sessionData = localStorage.getItem('cerebroSession');
        
        if (token && sessionData) {
            try {
                this.authToken = token;
                this.currentSession = JSON.parse(sessionData);
            } catch (e) {
                this.clearSession();
            }
        }
    },

    saveSession(token, userData) {
        this.authToken = token;
        this.currentSession = {
            username: userData.username,
            name: userData.name,
            role: userData.role,
            avatar: userData.avatar,
            setor: userData.setor,
            photo: this.userPhotos[userData.username] || null,
            loginTime: new Date().toISOString()
        };
        
        localStorage.setItem('cerebroToken', token);
        localStorage.setItem('cerebroSession', JSON.stringify(this.currentSession));
        localStorage.setItem('cerebroUser', userData.name);
    },

    clearSession() {
        this.authToken = null;
        this.currentSession = null;
        localStorage.removeItem('cerebroToken');
        localStorage.removeItem('cerebroSession');
        localStorage.removeItem('cerebroUser');
    },

    getAuthToken() {
        return this.authToken;
    },

    isAuthenticated() {
        return this.currentSession !== null;
    },

    getCurrentUser() {
        return this.currentSession;
    },

    isAdmin() {
        return this.currentSession && this.currentSession.role === 'ADMIN';
    },

    async verifyToken() {
        if (!this.authToken) return false;
        
        try {
            const response = await fetch('/api/auth/verify', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (response.ok) {
                return true;
            }
            return false;
        } catch (error) {
            console.error('Erro ao verificar token:', error);
            return false;
        }
    },

    async login(username, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.saveSession(data.token, data.user);
                return { success: true, message: `Bem-vindo, ${data.user.name}!` };
            } else {
                return { success: false, message: data.error || 'Erro ao fazer login' };
            }
        } catch (error) {
            console.error('Erro no login:', error);
            return { success: false, message: 'Erro de conexão com o servidor' };
        }
    },

    logout() {
        this.clearSession();
        this.showLoginPage();
        
        // Recarregar a página para limpar o estado
        window.location.reload();
    },

    showLoginPage() {
        const loginPage = document.getElementById('loginPage');
        const mainApp = document.getElementById('mainApp');
        const sidebar = document.getElementById('sidebar');
        
        if (loginPage) loginPage.classList.add('active');
        if (mainApp) mainApp.classList.add('hidden');
        if (sidebar) sidebar.style.display = 'none';
    },

    hideLoginPage() {
        const loginPage = document.getElementById('loginPage');
        const mainApp = document.getElementById('mainApp');
        const sidebar = document.getElementById('sidebar');
        
        if (loginPage) loginPage.classList.remove('active');
        if (mainApp) mainApp.classList.remove('hidden');
        if (sidebar) sidebar.style.display = 'flex';
    },

    setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
        const loginBtn = document.getElementById('loginBtn');
        const togglePassword = document.getElementById('togglePassword');
        const passwordInput = document.getElementById('loginPassword');
        const adminAccessBtn = document.getElementById('adminAccessBtn');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        if (togglePassword && passwordInput) {
            togglePassword.addEventListener('click', () => {
                const type = passwordInput.type === 'password' ? 'text' : 'password';
                passwordInput.type = type;
                togglePassword.innerHTML = type === 'password' 
                    ? '<i class="fas fa-eye"></i>' 
                    : '<i class="fas fa-eye-slash"></i>';
            });
        }

        // Admin access button
        if (adminAccessBtn) {
            adminAccessBtn.addEventListener('click', () => {
                this.showAdminHint();
            });
        }

        // Enter key handler
        const usernameInput = document.getElementById('loginUsername');
        if (usernameInput) {
            usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (passwordInput) passwordInput.focus();
                }
            });
        }

        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleLogin();
                }
            });
        }
    },

    async handleLogin() {
        const usernameInput = document.getElementById('loginUsername');
        const passwordInput = document.getElementById('loginPassword');
        const loginBtn = document.getElementById('loginBtn');

        if (!usernameInput || !passwordInput) return;

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            this.showError('Preencha todos os campos!');
            return;
        }

        // Desabilitar botão durante o login
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
        }

        const result = await this.login(username, password);

        // Reabilitar botão
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
        }

        if (result.success) {
            // Esconder página de login e mostrar app
            this.hideLoginPage();
            this.updateUserDisplay();
            
            // Disparar evento customizado para inicializar módulos
            window.dispatchEvent(new CustomEvent('cerebroLogin', { detail: { user: this.currentSession } }));
            
            // IMPORTANTE: Forçar sincronização de níveis com servidor na autenticação
            // Isso garante que o usuário veja seu nível correto do banco de dados
            try {
                const { Levels } = await import('./levels/index.js');
                if (Levels) {
                    // Sincronizar o nível do usuário logado logo após fazer login
                    if (Levels.syncCurrentUserLevel) {
                        await Levels.syncCurrentUserLevel();
                    } else if (Levels.syncWithServer) {
                        // Fallback para sincronização completa
                        await Levels.syncWithServer();
                    }
                    console.log('✓ Níveis sincronizados após login');
                }
            } catch (e) {
                console.debug('Sincronização de níveis ainda não disponível');
            }
            
            // Mostrar mensagem de boas-vindas
            this.showWelcomeMessage();
        } else {
            this.showError(result.message);
            passwordInput.value = '';
            passwordInput.focus();
        }
    },

    showError(message) {
        const errorMsg = document.getElementById('loginError');
        if (errorMsg) {
            errorMsg.textContent = message;
            errorMsg.classList.add('show');
            
            setTimeout(() => {
                errorMsg.classList.remove('show');
            }, 3000);
        }
    },

    showWelcomeMessage() {
        const user = this.getCurrentUser();
        if (user) {
            // Pequeno delay para a animação
            setTimeout(() => {
                const welcomeToast = document.createElement('div');
                welcomeToast.className = 'welcome-toast';
                welcomeToast.innerHTML = `
                    <span class="welcome-avatar">${user.avatar}</span>
                    <span>Bem-vindo ao Cérebro, ${user.name}!</span>
                `;
                document.body.appendChild(welcomeToast);

                setTimeout(() => {
                    welcomeToast.classList.add('show');
                }, 100);

                setTimeout(() => {
                    welcomeToast.classList.remove('show');
                    setTimeout(() => welcomeToast.remove(), 300);
                }, 3000);
            }, 300);
        }
    },

    updateUserDisplay() {
        const user = this.getCurrentUser();
        if (!user) return;

        const avatar = user.avatar || '👤';
        const photo = user.photo || null;
        const setor = user.setor || '';

        // Atualizar sidebar
        const userInfo = document.querySelector('.sidebar-footer .user-info');
        if (userInfo) {
            const avatarContent = photo 
                ? `<img src="${photo}" alt="${user.name}" class="avatar-photo">` 
                : `<span>${avatar}</span>`;
            
            userInfo.innerHTML = `
                <div class="avatar ${photo ? 'has-photo' : ''}">
                    ${avatarContent}
                </div>
                <div class="user-details">
                    <span class="user-name">${user.name}</span>
                    <span class="user-role">${user.role === 'ADMIN' ? 'Administrador' : setor}</span>
                </div>
            `;
        }

        // Adicionar botão de logout
        const sidebarFooter = document.querySelector('.sidebar-footer');
        if (sidebarFooter && !document.getElementById('logoutBtn')) {
            const logoutBtn = document.createElement('button');
            logoutBtn.id = 'logoutBtn';
            logoutBtn.className = 'logout-btn';
            logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i><span>Sair</span>';
            logoutBtn.onclick = () => this.logout();
            sidebarFooter.appendChild(logoutBtn);
        }

        // Mostrar opções de admin se for administrador
        if (this.isAdmin()) {
            document.body.classList.add('is-admin');
            this.addAdminControls();
        }
    },

    addAdminControls() {
        // Adicionar badge de admin no usuário
        const userRole = document.querySelector('.sidebar-footer .user-role');
        if (userRole) {
            userRole.innerHTML = '<i class="fas fa-shield-alt"></i> Administrador';
            userRole.style.color = 'var(--primary-coffee)';
            userRole.style.fontWeight = '600';
        }

        // Adicionar seção de controles admin acima do botão de limpar dados
        const adminSection = document.querySelector('.sidebar-footer .admin-only');
        if (adminSection && !document.getElementById('adminControlsHeader')) {
            const header = document.createElement('div');
            header.id = 'adminControlsHeader';
            header.className = 'admin-controls-header';
            header.innerHTML = '<i class="fas fa-tools"></i> <span>Controles Admin</span>';
            adminSection.insertBefore(header, adminSection.firstChild);
        }
    },

    // Mostrar dica de acesso admin
    showAdminHint() {
        // Apenas mostrar tooltip informativo - não preencher dados
        const tooltip = document.createElement('div');
        tooltip.className = 'admin-tooltip';
        tooltip.innerHTML = '<i class="fas fa-info-circle"></i> Administradores têm acesso a recursos especiais após o login';
        document.body.appendChild(tooltip);
        
        setTimeout(() => {
            tooltip.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            tooltip.classList.remove('show');
            setTimeout(() => tooltip.remove(), 300);
        }, 4000);
    },

    // Limpar todos os dados (apenas admin)
    async clearAllData() {
        if (!this.isAdmin()) {
            alert('Apenas administradores podem limpar os dados!');
            return;
        }

        if (confirm('⚠️ ATENÇÃO!\n\nIsso vai apagar TODOS os dados:\n- Histórico de café\n- Mensagens do chat\n- Avaliações\n\nTem certeza?')) {
            try {
                // Importar Api dinamicamente
                const { Api } = await import('./api.js');
                await Api.clearAllData();
                alert('Dados limpos com sucesso!');
                window.location.reload();
            } catch (error) {
                console.error('Erro ao limpar dados:', error);
                alert('Erro ao limpar dados. Verifique o console.');
            }
        }
    }
};

// Exportar funções globais
window.logout = () => Auth.logout();
window.clearAllData = async () => await Auth.clearAllData();
