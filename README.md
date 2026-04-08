# EPES Challenge – Sistema Web de Simulação Empresarial

## 📌 Sobre o projeto
Este projeto foi desenvolvido para o EPES, um workshop prático de empreendedorismo onde alunos foram desafiados a criar e gerenciar suas próprias empresas em um ambiente simulado.

A aplicação foi utilizada por mais de 100 participantes durante o evento, permitindo a criação de equipes, definição de estratégias, envio de decisões por rodada e acompanhamento de desempenho em tempo real.

🔗 link do sistema:  
https://epes-challenge-2025.web.app/login

---

## 🚀 Tecnologias utilizadas
- React  
- TypeScript  
- Firebase (Authentication, Firestore e Hosting)  
- Vite  

---

## 💡 Funcionalidades

### 🔐 Autenticação e acesso
- Login com Firebase Authentication  
- Controle de acesso por tipo de usuário (capitão, integrante e administrador)  

### 👥 Gestão de equipes
- Criação de equipes com código único  
- Solicitação de entrada  
- Painel de controle sob supervisão do administrador  

### 🎮 Sistema de rodadas
- Abertura e encerramento de rodadas  
- Controle de tempo (cronômetro)  
- Bloqueio de ações após encerramento  

### 📊 Decisões estratégicas
- Escolhas por categorias (Marketing, Produção, Investimentos e P&D)  
- Validação de orçamento e recursos  
- Cálculo automático de indicadores (receita, custo, lucro, etc.)  

### 🏆 Ranking e desempenho
- Ranking global e por rodada  
- Atualização com base nos dados do Firebase  

### 📈 Simulação empresarial
- Sistema com regras de negócio para cálculo de desempenho das equipes  
- Indicadores como demanda, participação de mercado, lucro e satisfação  

### 🧾 Relatórios
- Registro das decisões no banco de dados  
- Visualização de desempenho das equipes  

---

## 🧩 Arquitetura (visão geral)

A aplicação segue uma arquitetura baseada em frontend integrado ao Firebase:

- **Frontend:** React + TypeScript  
- **Autenticação:** Firebase Authentication  
- **Banco de dados:** Firestore (tempo real)  
- **Deploy:** Firebase Hosting  

Fluxo principal:

Usuário → Interface (React) → Firebase → Firestore → Atualização em tempo real na interface  

---

## 🎯 Contexto real de uso

Este sistema foi utilizado no Startup Challenge EPES, onde alunos e professores participaram de um desafio de empreendedorismo.

Durante o evento, os participantes utilizaram o sistema para:
- Criar empresas  
- Definir estratégias para a rodada
- Escolher decisões/categorias por rodada  
- Competir entre equipes  

O sistema foi essencial para a dinâmica do desafio, simulando um ambiente real de negócios.

---

## 🧠 Minha atuação no projeto

Atuei no desenvolvimento do sistema com foco em:

- Estruturação do front-end (React + TypeScript)  
- Criação e adaptação das telas (login, dashboard, decisões, ranking, etc.)  
- Integração com Firebase (Authentication e Firestore)  
- Implementação de funcionalidades e fluxos principais da aplicação  
- Padronização visual e consistência entre as telas  
- Correção de bugs e melhorias com base no uso real  


---

## 🤝 Colaboração
O projeto foi desenvolvido em equipe.

O líder técnico teve papel importante na definição do layout e no desenvolvimento da lógica principal do sistema.

A partir dessa base, atuei na continuidade do desenvolvimento, implementando funcionalidades, integrando com o Firebase e garantindo o funcionamento geral da aplicação.

---

## 🧠 Desafios e aprendizados

- Trabalhar com sistema em uso real por múltiplos usuários  
- Garantir consistência entre interface e dados no Firestore  
- Implementar controle de permissões por tipo de usuário  
- Lidar com fluxos complexos de decisões e rodadas  
- Identificar e corrigir falhas com base no comportamento dos usuários  

---

## 📊 Resultados

- Sistema utilizado em ambiente real  
- Mais de 100 usuários participantes  
- Aplicação estável durante todo o evento  
- Apoio direto à organização e execução do Challenge  

---

## 💬 Considerações finais

Esse projeto foi fundamental para meu crescimento como desenvolvedora em formação, permitindo não apenas aplicar conceitos de front-end e integração com banco de dados, mas também desenvolver uma visão mais completa de sistemas, considerando fluxo de dados, comportamento do usuário e confiabilidade da aplicação em uso real.

📌 Projeto desenvolvido em contexto educacional (EPES Challenge)
