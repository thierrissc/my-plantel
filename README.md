<div align="center">

<br />

<img src="https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white" />
<img src="https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white" />
<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black" />
  
<br /><br />

# Plantel — Gestão de Animais

**Sistema completo de cadastro e acompanhamento de plantel animal.**  
Fichas detalhadas, controle de vacinação e árvore genealógica — tudo em um único arquivo, sem dependências externas.

<br />

</div>

---

## Visão Geral

**Plantel** é uma aplicação web leve e intuitiva para gestão de animais domésticos, de criação ou de trabalho. Desenvolvida em HTML, CSS e JavaScript puros, roda diretamente no navegador sem necessidade de servidor, instalação ou banco de dados externo.

O sistema foi pensado para criadores, clínicas veterinárias, fazendeiros e tutores que precisam de uma ferramenta simples, bonita e funcional para organizar seu plantel.

---

## Funcionalidades

- **Cadastro de animais** com espécie, raca, sexo, data de nascimento, pelagem, peso e microchip
- **Ficha completa** com foto, status (Ativo / Em tratamento / Inativo) e tags visuais
- **Controle de vacinação** com alerta automático de vacinas vencidas ou próximas do vencimento
- **Arvore genealógica** visual com pai, mae, avo paterno e avo materno
- **Observacoes livres** para alergias, comportamento e cuidados especiais
- **Busca e filtro** por nome, raca e especie na barra lateral
- **Tema claro e escuro** com preferencia salva no navegador
- **Upload de foto** direto do dispositivo para cada animal

---

## Como Usar

Nenhuma instalacao e necessaria. Basta clonar o repositorio e abrir o arquivo `index.html` no navegador.

```bash
# 1. Clone o repositorio
git clone https://github.com/seu-usuario/plantel.git

# 2. Acesse a pasta
cd plantel

# 3. Abra no navegador
# — clique duas vezes em index.html, ou:
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

Nao e necessario `npm install`, servidor local ou configuracao adicional.

---

## Estrutura do Projeto

```
plantel/
├── index.html          # Estrutura da aplicacao (HTML)
├── css/
│   └── style.css       # Estilos, tokens de design e temas claro/escuro
├── js/
│   └── app.js          # Logica da aplicacao (vanilla JS)
└── README.md
```

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| HTML5 | Estrutura semantica da interface |
| CSS3 | Variaveis CSS (tokens), flexbox, animacoes, temas |
| JavaScript (ES6+) | Logica, renderizacao dinamica e persistencia local |
| Google Fonts | Tipografia (Inter + Lora) |

Sem frameworks. Sem dependencias. Sem build.

---

## Especies Suportadas

Cao · Gato · Cavalo · Bovino · Suino · Ave · Caprino · Ovino · Outro

---

## Status das Vacinas

O sistema calcula automaticamente a situacao de cada vacina com base na data atual:

| Status | Criterio |
|---|---|
| **Em dia** | Proxima dose ha mais de 60 dias |
| **Vencendo** | Proxima dose em menos de 60 dias |
| **Expirado** | Data da proxima dose ja passou |

---

## Personalizar Animais de Exemplo

Os animais de demonstracao estao no inicio do arquivo `js/app.js`, no array `animais`. Voce pode editar, remover ou adicionar entradas diretamente no codigo para adaptar ao seu plantel.

```js
let animais = [
  {
    id: 1,
    nome: "Thor",
    especie: "Cao",
    raca: "Labrador Retriever",
    // ...
  }
];
```

---

## Contribuindo

Contribuicoes sao bem-vindas! Para sugerir melhorias ou reportar problemas:

1. Abra uma [issue](https://github.com/seu-usuario/plantel/issues)
2. Faca um fork e crie uma branch: `git checkout -b minha-melhoria`
3. Commit suas alteracoes: `git commit -m 'feat: minha melhoria'`
4. Abra um Pull Request

---

<div align="center">

Feito com cuidado para quem cuida dos seus animais.

</div>
