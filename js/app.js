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
        isAdmin: localStorage.getItem('mayabay_is_admin') === 'true' // Persistência do Admin
    },

    init: async () => {
        console.log("💎 Maya Bay Engine: Iniciando...");
        app.checkAuth();
        await app.fetchProducts();
        app.setupEventListeners();
    },

    // --- AUTENTICAÇÃO E SEGURANÇA ---

    checkAuth: () => {
        if (app.state.token) {
            try {
                // Decodifica token (Payload base64)
                const payload = JSON.parse(atob(app.state.token.split('.')[1]));
                const userEmail = payload.sub;
                
                // Se o token expirou (opcional, validação simples)
                if (Date.now() >= payload.exp * 1000) throw new Error("Token expirado");

                app.state.user = { email: userEmail, name: userEmail.split('@')[0] };
                app.updateUserUI(true);
            } catch (e) {
                console.error("Sessão inválida:", e);
                app.logout();
            }
        }
    },

    toggleAuth: (forceState = null) => {
        const modal = document.getElementById('auth-modal-wrap');
        const isLogged = !!app.state.user;

        if (isLogged && forceState !== false) {
            if(confirm(`Deseja sair da conta de ${app.state.user.name}?`)) app.logout();
            return;
        }

        if (forceState === true) modal.style.display = 'flex';
        else if (forceState === false) modal.style.display = 'none';
        else modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
        
        if(modal.style.display === 'flex') app.switchAuth('login');
    },

    switchAuth: (screen) => {
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.getElementById(`form-${screen}`).classList.add('active');
    },

    handleLogin: async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-pass').value;
        const btn = e.target.querySelector('button');

        btn.innerText = "Verificando..."; btn.disabled = true;

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Erro ao entrar");

            // Salva Token e Status Admin
            localStorage.setItem('mayabay_token', data.access_token);
            localStorage.setItem('mayabay_is_admin', data.is_admin);
            
            app.state.token = data.access_token;
            app.state.isAdmin = data.is_admin;
            
            app.checkAuth();
            app.toggleAuth(false);
            alert(`Bem-vindo de volta!`);
            
            // Recarrega para aplicar UI de Admin se necessário
            if(app.state.isAdmin) window.location.reload();

        } catch (error) {
            alert(error.message);
        } finally {
            btn.innerText = "ENTRAR"; btn.disabled = false;
        }
    },

    handleRegister: async (e) => {
        e.preventDefault();
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-pass').value;
        const confirmPass = document.getElementById('reg-pass-conf').value;
        const adminKey = document.getElementById('reg-admin-key').value; // Chave secreta

        if (password !== confirmPass) return alert("As senhas não coincidem.");

        try {
            const res = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, admin_key: adminKey })
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail);

            alert("Conta criada! " + (data.is_admin ? "Você é um Administrador." : ""));
            app.switchAuth('login');

        } catch (error) {
            alert(error.message);
        }
    },

    handleForgot: (e) => {
        e.preventDefault();
        alert("Link de recuperação enviado (simulação).");
        app.switchAuth('login');
    },

    logout: () => {
        localStorage.clear();
        app.state.user = null;
        app.state.token = null;
        app.state.isAdmin = false;
        window.location.reload();
    },

    updateUserUI: (isLogged) => {
        const userBtn = document.getElementById('user-btn');
        const greeting = document.getElementById('user-greeting');
        const icon = userBtn.querySelector('i');
        const adminBtn = document.getElementById('btn-open-admin');

        if (isLogged) {
            icon.classList.remove('fa-user'); icon.classList.add('fa-user-check');
            greeting.style.display = 'inline';
            greeting.innerText = `Olá, ${app.state.user.name}`;
            userBtn.title = "Sair";
            
            // Mostra botão de admin APENAS se for admin
            if (adminBtn) adminBtn.style.display = app.state.isAdmin ? 'flex' : 'none';
        } else {
            icon.classList.add('fa-user'); icon.classList.remove('fa-user-check');
            greeting.style.display = 'none';
            userBtn.title = "Entrar";
            if (adminBtn) adminBtn.style.display = 'none';
        }
    },

    // --- GESTÃO DE PRODUTOS (ADMINISTRAÇÃO) ---

    toggleAdmin: (state) => {
        const modal = document.getElementById('admin-modal-wrap');
        modal.style.display = state ? 'flex' : 'none';
        if(state) app.renderAdminList();
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
        document.getElementById('page-title').innerText = title;
        
        if (list.length === 0) {
            grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;">Nenhum item encontrado.</p>';
            return;
        }

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
        window.onclick = (e) => {
            if (e.target == document.getElementById('modal-wrap')) app.closeModal();
            if (e.target == document.getElementById('auth-modal-wrap')) app.toggleAuth(false);
            if (e.target == document.getElementById('admin-modal-wrap')) app.toggleAdmin(false);
        };
        app.initScrollReveal();
    },

    initScrollReveal: () => {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('active'); });
        });
        document.querySelectorAll('.reveal-element').forEach(el => observer.observe(el));
    },

    toggleSearch: () => document.getElementById('search-popup').classList.toggle('active'),
    
    performSearch: () => {
        const term = document.getElementById('search-input').value.toLowerCase();
        const filtered = app.state.allProducts.filter(p => p.name.toLowerCase().includes(term));
        app.render(filtered, `Busca: "${term}"`);
        app.toggleSearch();
    },
    
    filter: (cat) => {
        app.render(app.state.allProducts.filter(p => p.category === cat), cat.toUpperCase());
        document.getElementById('loja').scrollIntoView({behavior:'smooth'});
    },

    resetAll: () => app.render(app.state.allProducts, "Curadoria Exclusiva")
};

window.onload = app.init;