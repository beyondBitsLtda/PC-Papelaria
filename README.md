# PC Papelaria · Gestão

Protótipo navegável de um sistema de gestão para a **PC Papelaria Contacto**. Ele funciona no celular e no computador, direto no navegador, sem instalação.

> Ambiente de demonstração: todos os dados são fictícios e ficam salvos apenas no navegador de quem acessa (localStorage).

## O que dá para fazer

| Módulo | Destaques |
|---|---|
| **Início** | Vendas do dia, ticket médio, gráfico de faturamento (7/30 dias), mais vendidos, alertas de estoque e atalhos |
| **Vender (PDV)** | Busca por nome ou código de barras (Enter adiciona), categorias, carrinho, desconto, Pix com QR Code, cartão, dinheiro com troco e cupom para imprimir |
| **Lista escolar** | Escolhe a lista da escola, confere o estoque e monta o carrinho automaticamente |
| **Estoque** | Margem por produto, nível de estoque, alerta de mínimo, entrada de mercadoria, cadastro e edição |
| **Serviços** | Kanban de ordens de serviço (impressão, encadernação, plastificação...), com arrastar e soltar e prazos |
| **Clientes** | Escolas, empresas e varejo, com histórico de compras e serviços em andamento |
| **Financeiro** | Contas a pagar, formas de pagamento, vendas por categoria e resultado do período |
| **Ajustes** | Tema claro/escuro/automático, exportação dos dados (JSON) e restauração da demonstração |

## Publicar no GitHub Pages

1. Crie um repositório no GitHub (ex.: `pc-papelaria`) e envie **o conteúdo desta pasta** para a branch `main`:
   ```bash
   git init
   git add .
   git commit -m "Protótipo PC Papelaria"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/pc-papelaria.git
   git push -u origin main
   ```
2. No repositório, abra **Settings → Pages**.
3. Em *Build and deployment*, escolha **Deploy from a branch**, depois `main` e `/ (root)`, e clique em **Save**.
4. Em cerca de um minuto o site fica disponível em `https://SEU-USUARIO.github.io/pc-papelaria/`.

**Dica:** para o cliente abrir direto no painel, sem passar pela tela de login, envie o link com `?entrar` no final:
`https://SEU-USUARIO.github.io/pc-papelaria/?entrar`

## Testar localmente

Abra o `index.html` no navegador ou, para simular o GitHub Pages, rode um servidor simples na pasta:

```bash
python -m http.server 8000
# e acesse http://localhost:8000
```

## Personalizar

- **Crédito do desenvolvedor:** edite `AUTHOR` no início de `js/app.js` (nome e link do portfólio/LinkedIn).
- **Produtos, clientes, listas escolares:** em `js/data.js`.
- **Cores e fontes:** variáveis no topo de `css/styles.css` (paleta tirada da logo).

## Estrutura

```
index.html              página única (login + aplicação)
css/styles.css          identidade visual, layout responsivo, tema escuro
js/icons.js             ícones SVG em linha
js/data.js              dados de demonstração
js/app.js               rotas, telas e regras de negócio
assets/                 logo, marca "PC" e ícones do app
manifest.webmanifest    permite "Adicionar à tela inicial" no celular
```

Tecnologia: HTML, CSS e JavaScript puro, sem frameworks e sem etapa de build.
