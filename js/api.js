const API_URL = "http://127.0.0.1:8000"; // Endereço do FastAPI

const api = {
    // Busca produtos do banco de dados
    getProducts: async () => {
        try {
            const response = await fetch(`${API_URL}/products`);
            if (!response.ok) throw new Error("Erro ao carregar produtos");
            return await response.json();
        } catch (error) {
            console.error("Erro de API:", error);
            return []; // Retorna lista vazia se falhar
        }
    },

    // Envia dados de login
    login: async (email, password) => {
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            
            if (!response.ok) throw new Error("Credenciais inválidas");
            return await response.json(); // Retorna o token e dados do usuário
        } catch (error) {
            alert(error.message);
            return null;
        }
    }
};