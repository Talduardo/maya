/**
 * MAYA BAY ENGINE v6.0 (Secure Admin & Commerce)
 * Backend: FastAPI (SQLite + JWT + RBAC)
 */

const API_URL = "http://127.0.0.1:8000";

const app = {
    state: {
        allProducts: [],
        cart: [],
        selectedProduct: null,
        selectedSize: null,
        user: null, 
        token: localStorage.getItem('mayabay_token'),
        isAdmin: false // Será definido pelo checkAuth
    },

    init: async () => {
        console.log("💎 Maya Bay Engine: Iniciando...");
        app.checkAuth();
        await app.fetchProducts();
        app.setupEventListeners();
    },

    // --- 1. FUNÇÃO DE DECISÃO DO ÍCONE ---
    handleUserIconClick: () => {
        // Se o usuário está logado (tem token)
        if (app.state.token) {
            const dropdown = document.getElementById('user-dropdown');
            if (dropdown) {
                dropdown.classList.toggle('active');
            }
        } else {
            // Se não está logado, abre o modal de login
            app.toggleAuth(true);
        }
    },

    // --- 2. CONTROLE DO MODAL DE LOGIN ---
    toggleAuth: (forceState = null) => {
        const modal = document.getElementById('auth-modal-wrap');
        if (!modal) return;

        if (forceState === true) modal.style.display = 'flex';
        else if (forceState === false) modal.style.display = 'none';
        else modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
        
        if (modal.style.display === 'flex') app.switchAuth('login');
    },

    // -- 2.1 Função para ver a senha (toggle)
    togglePasswordVisibility: (inputId, iconElement) => {
        const input = document.getElementById(inputId);

        if (input.type === "password") {
            input.type = "text";
            iconElement.classList.remove("fa-eye");
            iconElement.classList.add("fa-eye-slash");
        } else {
            input.type = "password";
            iconElement.classList.remove("fa-eye-slash");
            iconElement.classList.add("fa-eye");
        }
    },
    
    // --- 3. VERIFICAÇÃO DE SESSÃO (JWT) ---
    checkAuth: () => {
        const token = localStorage.getItem('mayabay_token');

        if (!token) {
            app.resetAuthState();
            return;
        }

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            
            // Verifica expiração
            if (Date.now() >= payload.exp * 1000) {
                app.logout();
                return;
            }

            app.state.token = token;
            app.state.isAdmin = payload.is_admin === true;
            app.state.user = payload.sub; 

            // Atualiza Interface: Ícone
            const icon = document.querySelector('#user-btn i');
            if (icon) icon.className = 'fa-solid fa-user-check';

            // Atualiza Interface: Nome no Dropdown
            const greeting = document.getElementById('user-greeting');
            if (greeting) {
                const name = payload.sub.split('@')[0];
                greeting.innerText = `Olá, ${name.charAt(0).toUpperCase() + name.slice(1)}`;
            }

            // Atualiza Interface: Botão Admin
            const adminBtn = document.getElementById('admin-btn');
            if (adminBtn) adminBtn.style.display = app.state.isAdmin ? 'flex' : 'none';

        } catch (error) {
            console.error("Token inválido:", error);
            app.logout();
        }
    },

    // --- 4. SAIR DA CONTA ---
    logout: () => {
        localStorage.removeItem('mayabay_token');
        localStorage.removeItem('mayabay_is_admin');
        app.resetAuthState();
        alert("Sessão encerrada.");
        location.reload(); 
    },

    resetAuthState: () => {
        app.state.token = null;
        app.state.isAdmin = false;
        app.state.user = null;
        const icon = document.querySelector('#user-btn i');
        if (icon) icon.className = 'fa-regular fa-user';
    },

    switchAuth: (screen) => {
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        const targetForm = document.getElementById(`form-${screen}`);
        if (targetForm) targetForm.classList.add('active');
    },
    
    // ... restante do código (fetchProducts, render, etc)

    handleLogin: async (e) => {
        e.preventDefault();

        // 1. Pega os dados e limpa
        const emailField = document.getElementById('login-email');
        const passwordField = document.getElementById('login-pass');
        const btn = e.target.querySelector('button');

        const email = emailField.value;
        const password = passwordField.value;

        btn.innerText = "VERIFICANDO..."; 
        btn.disabled = true;

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }) // Envia como JSON
            });

            const data = await res.json();
            
            if (!res.ok) throw new Error(data.detail || "Erro no login");

            // 1. Salva no navegador
            localStorage.setItem('mayabay_token', data.access_token);
            localStorage.setItem('mayabay_is_admin', data.is_admin);
            
            // 2. Atualiza o estado da aplicação
            app.state.token = data.access_token;
            app.state.isAdmin = data.is_admin === true;
            
           // 3. Limpeza de segurança: Remove os dados dos campos de texto
            emailField.value = "";
            passwordField.value = "";

            // 4. Fecha o modal de login
            app.toggleAuth(false);

            // 5. Atualiza a interface do usuário
            app.checkAuth();
            
            alert("Login realizado com sucesso!");

        } catch (error) {
            alert(error.message);
        } finally {
            btn.innerText = "ENTRAR";
            btn.disabled = false;
        }
    },

    handleRegister: async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-pass').value;
        const confirmPass = document.getElementById('reg-pass-conf').value;
        const adminKey = document.getElementById('reg-admin-key').value;

        // Validações básicas antes de enviar
        if (password !== confirmPass) return alert("As senhas não coincidem.");
        if (!email || !password) return alert("Preencha todos os campos obrigatórios.");
        if (password !== confirmPass) return alert("As senhas não coincidem.");
        if (password.length < 6) return alert("A senha deve ter no mínimo 6 caracteres.");

        try {
            console.log("Enviando dados para o servidor...", { email, admin_key: adminKey });

            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    email: email, 
                    password: password, 
                    admin_key: adminKey || null 
                })
            });

            const data = await res.json();
            
            if (!res.ok) {
                // Se o erro for 422, o Pydantic do Python rejeitou os dados
                console.error("Erro do Servidor (Detalhes):", data);
                throw new Error(data.detail || "Erro ao criar conta.");
            }

            alert(data.is_admin ? "Conta STAFF criada!" : "Conta criada com sucesso!");
            app.switchAuth('login');

        } catch (error) {
            console.error("Erro na requisição:", error);
            alert("Não foi possível registrar: " + error.message);
        }
    },

    handleForgot: (e) => {
        e.preventDefault();
        alert("Um link de recuperação foi enviado para o seu e-mail.");
        app.switchAuth('login');
    },

    logout: () => {
        localStorage.removeItem('mayabay_token');
        localStorage.removeItem('mayabay_is_admin');
        app.state.user = null;
        app.state.token = null;
        app.state.isAdmin = false;
        window.location.reload();
    },

    updateUserUI: (isLogged) => {
    const userBtn = document.getElementById('user-btn');
    const greeting = document.getElementById('user-greeting');
    // Busca o botão pelo ID correto
    const adminBtn = document.getElementById('admin-btn'); 
    
    if (isLogged && app.state.user) {
        // Lógica do Usuário
        if (userBtn) {
            const icon = userBtn.querySelector('i');
            if(icon) {
                icon.classList.remove('fa-user');
                icon.classList.add('fa-user-check');
            }
            userBtn.title = "Sair (Logout)";
        }
        
        if (greeting) {
            greeting.style.display = 'inline';
            greeting.innerText = `Olá, ${app.state.user.name}`;
        }

        // Lógica do Admin (O Pulo do Gato)
        if (adminBtn) {
            if (app.state.isAdmin === true) {
                adminBtn.style.display = 'flex'; // Mostra o botão
            } else {
                adminBtn.style.display = 'none'; // Esconde
            }
        }

    } else {
        // Estado Deslogado
        if (userBtn) {
            const icon = userBtn.querySelector('i');
            if(icon) {
                icon.classList.add('fa-user');
                icon.classList.remove('fa-user-check');
            }
            userBtn.title = "Entrar";
        }
        if (greeting) greeting.style.display = 'none';
        
        // Garante que o botão admin suma ao deslogar
        if (adminBtn) adminBtn.style.display = 'none';
    }
},

    // --- GESTÃO DE PRODUTOS (ADMINISTRAÇÃO) ---

    // --- PAINEL DE ADMINISTRAÇÃO ---

    toggleAdmin: (show) => {
        const modal = document.getElementById('admin-modal-wrap');
        // Pegamos o body para adicionar a classe de controle
        const body = document.body;

        if (show) {
            // ABRIR
            modal.style.display = 'flex';
            // Adiciona a classe que desfoca o fundo
            body.classList.add('admin-active'); 
        } else {
            // FECHAR
            modal.style.display = 'none';
            // Remove a classe, voltando o site ao normal
            body.classList.remove('admin-active');
        }
    },

    renderAdminList: () => {
        const list = document.getElementById('admin-product-list');
        list.innerHTML = app.state.allProducts.map(p => `
            <div class="admin-item-row">
                <span><strong>${p.name}</strong> (R$ ${p.price.toFixed(2)})</span>
                <i class="fa-solid fa-trash-can btn-del" onclick="app.handleDeleteProduct(${p.id})"></i>
            </div>
        `).join('');
    },

    handleSaveProduct: async (e) => {
        e.preventDefault();
        const product = {
            name: document.getElementById('p-name').value,
            price: parseFloat(document.getElementById('p-price').value),
            category: document.getElementById('p-category').value,
            sub_category: document.getElementById('p-sub').value,
            image_url: document.getElementById('p-img-url').value
        };

        try {
            const res = await fetch(`${API_URL}/products`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${app.state.token}` // TOKEN DE SEGURANÇA
                },
                body: JSON.stringify(product)
            });

            if (res.status === 401) throw new Error("Sessão expirada.");
            if (res.status === 403) throw new Error("Apenas Administradores podem fazer isso.");
            if (!res.ok) throw new Error("Erro ao salvar.");

            alert("Produto adicionado com sucesso!");
            e.target.reset();
            app.toggleAdmin(false);
            await app.fetchProducts(); // Atualiza vitrine
        } catch (err) { alert(err.message); }
    },

    handleDeleteProduct: async (id) => {
        if(!confirm("Remover este item permanentemente?")) return;

        try {
            const res = await fetch(`${API_URL}/products/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${app.state.token}` } // TOKEN DE SEGURANÇA
            });

            if (res.status === 403) throw new Error("Sem permissão.");
            if (!res.ok) throw new Error("Erro ao deletar.");

            await app.fetchProducts();
            app.renderAdminList();
        } catch (err) { alert(err.message); }
    },

    // --- VITRINE E PRODUTOS (CLIENTE) ---

    fetchProducts: async () => {
        try {
            const res = await fetch(`${API_URL}/products`);
            if (!res.ok) throw new Error("API Offline");
            app.state.allProducts = await res.json();
            app.render(app.state.allProducts, "Curadoria Exclusiva");
        } catch (error) {
            console.error(error);
            document.getElementById('product-grid').innerHTML = 
                `<p style="grid-column:1/-1;text-align:center;">Conectando ao catálogo...</p>`;
        }
    },

    render: (list, title) => {
        const grid = document.getElementById('product-grid');
        const pageTitle = document.getElementById('page-title');

        if (pageTitle) pageTitle.innerText = title;


        // Se a liste estiver vazia, mostramos o "Empty Sate" elegante
        if (list.length === 0) {
            grid.innerHTML = `
                <div class="empty-results reveal-element">
                    <div class="empty-icon">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </div>
                    <h3>Busca sem resultados</h3>
                    <p>Não encontramos itens correspondentes à sua procura. <br> Que tal explorar nossa curadoria completa?</p>
                    <button class="btn-black" onclick="app.resetAll()" style="margin-top: 25px; min-width: 200px;">
                        Veja Toda a Curadoria
                    </button>
                </div>
            `;
            app.initScrollReveal(); // Para animar a mensagem de "Busca sem resultados"
            return;
        }

        // Se houver produtos, mostramos a vitrine
        grid.innerHTML = list.map(p => `
            <div class="card reveal-element" onclick="app.openModal(${p.id})">
                <div class="card-img">
                    <img src="${p.image_url}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/300?text=Maya+Bay'">
                    <div class="card-overlay"><div class="btn-quick-view">Ver Detalhes</div></div>
                </div>
                <div class="card-info">
                    <h4>${p.name}</h4>
                    <p class="card-price">R$ ${p.price.toFixed(2)}</p>
                </div>
            </div>
        `).join('');
        
        app.initScrollReveal();
    },

    // --- MODAL DE PRODUTO ---

    openModal: (id) => {
        const p = app.state.allProducts.find(x => x.id === id);
        app.state.selectedProduct = p;
        app.state.selectedSize = null;

        document.getElementById('m-img').src = p.image_url;
        document.getElementById('m-title').innerText = p.name;
        document.getElementById('m-price').innerText = `R$ ${p.price.toFixed(2)}`;
        
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('modal-wrap').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    closeModal: () => {
        document.getElementById('modal-wrap').style.display = 'none';
        document.body.style.overflow = 'auto';
    },

    setSize: (btn, size) => {
        app.state.selectedSize = size;
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    },

    // --- CARRINHO ---

    addToCart: () => {
        if (!app.state.selectedSize) return alert("Selecione um tamanho.");
        
        app.state.cart.push({
            ...app.state.selectedProduct,
            size: app.state.selectedSize,
            cartId: Date.now()
        });
        
        app.updateCartUI();
        app.closeModal();
        app.toggleCart(true);
    },

    removeFromCart: (id) => {
        app.state.cart = app.state.cart.filter(x => x.cartId !== id);
        app.updateCartUI();
    },

    toggleCart: (force = null) => {
        const bar = document.getElementById('cart-sidebar');
        if (force === true) bar.classList.add('active');
        else if (force === false) bar.classList.remove('active');
        else bar.classList.toggle('active');
    },

    updateCartUI: () => {
        const list = document.getElementById('cart-items');
        let total = 0;
        
        list.innerHTML = app.state.cart.map(i => {
            total += i.price;
            return `
            <div class="cart-item-row">
                <img src="${i.image_url}" class="cart-item-img">
                <div class="cart-item-info">
                    <p class="cart-item-name">${i.name}</p>
                    <p class="cart-item-size">TAM: ${i.size}</p>
                    <p class="cart-item-price">R$ ${i.price.toFixed(2)}</p>
                </div>
                <i class="fa-solid fa-trash-can cart-trash-icon" onclick="app.removeFromCart(${i.cartId})"></i>
            </div>`;
        }).join('');

        document.getElementById('cart-total').innerText = `R$ ${total.toFixed(2)}`;
        document.getElementById('cart-count').innerText = app.state.cart.length;
    },

    finishOrder: async () => {
        if (!app.state.user) {
            alert("Por favor, faça login para finalizar sua compra.");
            app.toggleCart(false);
            app.toggleAuth(true);
            return;
        }
        if (app.state.cart.length === 0) return alert("Sacola vazia.");

        const btn = document.querySelector('.btn-checkout');
        btn.innerText = "Processando...";
        
        try {
            const res = await fetch(`${API_URL}/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(app.state.cart)
            });
            const data = await res.json();
            if(data.init_point) window.location.href = data.init_point;
        } catch (e) {
            alert("Erro no checkout.");
            btn.innerText = "Finalizar Compra";
        }
    },

    // --- UTILITÁRIOS ---

    setupEventListeners: () => {
        // Usamos addEventListener para não sobrescrever outros eventos globais
        window.addEventListener('click', (e) => {
            
            // 1. FECHAR MODAIS (Click fora da caixa branca)
            if (e.target === document.getElementById('modal-wrap')) app.closeModal();
            if (e.target === document.getElementById('auth-modal-wrap')) app.toggleAuth(false);
            if (e.target === document.getElementById('admin-modal-wrap')) app.toggleAdmin(false);

            // 2. FECHAR MENU DE USUÁRIO (Click fora do menu ou do ícone)
            const dropdown = document.getElementById('user-dropdown');
            const userBtn = document.getElementById('user-btn');

            // Se o menu estiver aberto...
            if (dropdown && dropdown.classList.contains('active')) {
                // ...e o clique NÃO foi dentro do botão nem dentro do próprio menu:
                if (!userBtn.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.remove('active');
                }
            }

            // --- NOVO: Capturar o ENTER na busca ---
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    app.performSearch();
                }
            });
        }   
        });

        // Inicializa as animações de entrada
        if (app.initScrollReveal) app.initScrollReveal();
    },

    initScrollReveal: () => {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('active'); });
        });
        document.querySelectorAll('.reveal-element').forEach(el => observer.observe(el));
    },

    toggleSearch: () =>{
        const popup = document.getElementById('search-popup');
        popup.classList.toggle('active');
        if (popup.classList.contains('active')) {
            document.getElementById('search-input').focus();
        }
    },
    
    performSearch: () => {
        const input = document.getElementById('search-input');
        const term = input.value.toLowerCase().trim();

        if (term !== "") {
            const filtered = app.state.allProducts.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.category.toLowerCase().includes(term)
            );
            app.render(filtered, `Resultados para "${term}"`);

            // Direciona para a seção de rola a página até a seção da loja
            const lojaSection = document.getElementById('loja');
            if (lojaSection) {
                setTimeout(() => {
                    lojaSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
            app.toggleSearch();
            input.value = ''; // Limpa o campo de busca para a próxima vez
        }
    },
    
    filter: (cat) => {
        const filtered = app.state.allProducts.filter(p => p.category === cat);
        app.render(filtered, cat.toUpperCase()); 
        document.getElementById('loja').scrollIntoView({behavior:'smooth'});
    },

    resetAll: () => app.render(app.state.allProducts, "Curadoria Exclusiva")
};

window.onload = app.init;
