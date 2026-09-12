# Front-end — Controle de Materiais

Primeira versão funcional do front-end React integrada à API Spring Boot
existente em `../Projeto1`.

## Requisitos

- Node.js compatível com Vite 8
- back-end em execução na porta `8080`
- origem `http://localhost:5173` incluída em
  `APP_CORS_ALLOWED_ORIGINS` no back-end


## Execução

```bash
npm install
npm run dev
```

No Windows com política de execução restrita, use `npm.cmd` no lugar de `npm`.

Para diagnosticar a leitura de CODE-128 no celular, veja o
[guia do scanner de NF-e](docs/nfe-barcode-scanner.md), com teste de imagem conhecida,
logs de resolução/foco e passos para iPhone/Safari e Android/Chrome.

Testes, build e lint:

```bash
npm test
npm run build
npm run lint
```

## Acesso

O login usa `POST /auth/login`. As credenciais do administrador inicial são
configuradas no back-end por:

- `APP_ADMIN_USERNAME`
- `APP_ADMIN_PASSWORD`

Nenhuma senha fica salva pelo front-end. O navegador armazena somente o JWT,
role, nome de usuário e horário calculado de expiração.

## Funcionalidades

- autenticação JWT, logout, expiração e tratamento de 401/403;
- permissões visuais para `ADMIN`, `OPERADOR` e `CONSULTA`;
- dashboard com indicadores, movimentações recentes e usuário responsável;
- materiais: listagem, pesquisa, cadastro e edição;
- funcionários: listagem, pesquisa, filtro por status, cadastro, edição e
  ativação/inativação;
- contratos: listagem, pesquisa, filtro por status, cadastro, edição e
  ativação/inativação;
- entrada, retirada e devolução com resumo de confirmação;
- histórico responsivo com filtro por tipo e identificação do usuário que
  registrou cada movimentação;
- gestão de usuários para administradores: listagem, pesquisa, filtro por
  status, cadastro, edição, ativação e inativação;
- layout mobile-first com navegação inferior e sidebar no desktop.

## Observações da API atual

- `FuncionarioResponse` não contém CPF, mas o `PUT /funcionarios/{id}` exige o
  CPF. Por isso, a edição solicita que o administrador informe o CPF novamente.
- a API não possui paginação; as pesquisas e os filtros são locais.
- movimentações anteriores à migration de autoria são exibidas como
  “Não informado”.
