# Criar material durante o cadastro da nota fiscal

O botão **+ Criar material** aparece junto ao seletor de cada item para ADMIN,
inclusive quando não existem materiais cadastrados. O cadastro abre em um modal
no desktop e ocupa a tela em dispositivos pequenos. Nome e descrição podem ser
revisados antes de salvar.

## Reuso e estado

`MaterialForm` é usado tanto pela página normal de cadastro/edição de material
quanto pelo modal da NF. Ele mantém as validações dos campos, o tratamento de
erros com `ErrorMessage`, a autenticação de `apiRequest` e as chamadas existentes
de `materialService.create` / `materialService.update`.

O formulário da NF continua montado em `NotaFiscalFormPage`, com seu `form` no
estado React. O modal é um irmão do formulário, evitando formulários HTML
aninhados. Abrir, cancelar ou receber um erro no cadastro do material não
reescreve a NF nem muda a rota. Não há armazenamento de rascunho no navegador.

Cada item recebe um `localId` estável durante a vida do formulário, inclusive
itens manuais, importados e carregados para edição. O estado
`materialCreationItem` guarda o item que abriu o modal. Após a criação:

1. A resposta do endpoint é adicionada/atualizada na lista local pelo ID.
2. O item de origem é localizado pelo `localId`, sem depender de sua posição.
3. `associateImportedMaterial` atualiza somente o `materialId` desse item,
   preservando seus demais campos e os dados de origem do XML.
4. O modal fecha e aparece **Material criado e associado ao item.**

Os identificadores locais não fazem parte do payload da NF. Produtos XML passam
do status existente **Aguardando associação** para **Material associado**.
Cancelar não modifica associações anteriores. Enquanto a requisição de criação
está em andamento, os controles de envio e cancelamento ficam desabilitados.

O modal usa `dialog.showModal()`, restringe interação com o formulário ao fundo,
mantém o ciclo de foco por Tab e devolve o foco ao botão de origem ao fechar.
Os campos rolam separadamente das ações. A altura acompanha `visualViewport`
para acomodar a área disponível quando o teclado aparece.

## XML, estoque e permissões

A descrição do produto XML sugere nome e descrição do material, limitada a
100 e 500 caracteres, respectivamente. O modelo de Material possui somente
esses campos de cadastro; código do fornecedor e unidade continuam nos dados
de origem do item, sem novos campos ou mapeamentos.

**Estoque inicial zero:** o DTO existente `MaterialRequest` aceita somente
`nome` e `descricao`. Por isso o frontend envia exatamente esses campos; ele
não envia `quantidadeEstoque`, quantidade comercial, unidade ou valores do XML.
O `MaterialMapper.paraEntidade` existente força `quantidadeEstoque = 0` no
backend. Não foi introduzido um campo de estoque fora do contrato do endpoint.

Criar o material e salvar a NF como rascunho mantêm o estoque em zero.
A confirmação explícita da NF realiza a entrada pelo fluxo já existente.
Não houve alteração de endpoint, DTO, regra de negócio, autenticação, migration
ou confirmação automática.

O backend permite cadastrar material apenas para ADMIN. O novo botão segue
essa regra; OPERADOR mantém o cadastro de NF e a seleção de materiais existentes.
CONSULTA continua sem acesso às rotas de cadastro e edição da NF. Duplicidades
seguem a validação atual do backend, cuja mensagem permanece visível no modal.

## Arquivos desta implementação

Arquivos criados:

- `src/components/MaterialForm.jsx`
- `src/components/NotaFiscalMaterialDialog.jsx`
- `e2e/notaFiscalMaterial.spec.js`
- `playwright.config.js`
- `docs/cadastro-material-na-nota-fiscal.md`

Arquivos alterados no frontend:

- `src/pages/MaterialFormPage.jsx`
- `src/pages/NotaFiscalFormPage.jsx`
- `src/App.css`
- `package.json`
- `package-lock.json`
- `.gitignore`

Arquivo alterado no backend, somente para adicionar um teste:

- `Projeto1/src/test/java/com/Lucca/Projeto1/NotaFiscalEntradaIntegrationTests.java`

As alterações de XML e leitura de código de barras que já existiam na área de
trabalho foram preservadas e não estão listadas como trabalho desta implementação.

## Validação automatizada

Validação em 11/09/2026:

| Verificação | Resultado |
| --- | --- |
| `npm test` | 57 testes aprovados |
| `npm run lint` | Aprovado |
| `npm run build` | Aprovado |
| `npm run test:e2e`, usando Chrome instalado | 26 testes aprovados: 13 cenários em desktop e mobile |
| Maven `test` | 86 testes aprovados, sem falhas, erros ou testes ignorados |

Os testes de navegador usam a aplicação real com respostas HTTP simuladas e
conferem os payloads e a autenticação enviados. Cobrem preservação do nó DOM e
dos dados da NF, cancelamento, Escape, criação, lista vazia, dois itens em ordem
invertida, remoção de item, pré-preenchimento XML editável, ausência de estoque e
quantidades no payload do material, duplicidade, nova tentativa, bloqueio durante
envio, permissões, edição de NF, cadastro manual, importação e o formulário normal
de materiais. Também exercitam foco e botões numa área de 390 × 360 pixels.

O novo teste Java usa os endpoints reais com autenticação e banco H2: cria o
material, verifica estoque zero e ausência de movimentos, salva NF com 120
unidades, verifica novamente zero, confirma e verifica estoque 120 com uma única
ENTRADA. Uma segunda confirmação é recusada sem alterar estoque ou movimentos.
Os testes existentes de XML, permissões, duplicidade e proteção do estoque
também passam.

Para reproduzir os testes de interface com o Chromium do Playwright:

```powershell
npm ci
npx playwright install chromium
npm run test:e2e
```

Ou, com Google Chrome instalado:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
```

O Playwright inicia um Vite isolado na porta 4174 e usa uma URL de API simulada,
sem alterar o `.env` do projeto. Para o backend, execute `./mvnw.cmd test` em
`Projeto1`. Nesta máquina foi utilizado o Maven 3.9.16 já instalado no cache,
em modo offline e com o repositório local explicitado.

## Roteiro de teste manual completo

Execute em ambiente de desenvolvimento com backend e frontend iniciados.

1. Entre como ADMIN, abra **Nova nota fiscal** e preencha chave válida, número,
   série, fornecedor, CNPJ e data. Associe um material existente e informe
   quantidade e valor. Adicione outro item.
2. No segundo item, abra **+ Criar material**. Digite nome/descrição e cancele.
   Confira todos os valores e a associação do primeiro item. Repita fechando com
   Escape em desktop. A rota da NF deve continuar igual.
3. Reabra, preencha os campos e salve. Confira o material selecionado somente
   no segundo item, a presença dele nas opções dos demais itens, estoque **0**
   e a mensagem **Material criado e associado ao item.**
4. Salve a NF como rascunho. Confira estoque zero e ausência de ENTRADA para
   esse material. Abra a edição do rascunho, altere um campo, crie um material
   para outro item e salve novamente. Confira a preservação das alterações.
5. Em uma nova NF, importe XML válido com dois produtos sem material interno.
   Confira dados do fornecedor, chave, quantidades, valores e informações do
   produto. Abra o cadastro do segundo produto: nome/descrição devem vir
   sugeridos. Altere-os, salve e confirme que só esse item ficou associado.
6. Crie o material do primeiro produto e confira os dois IDs distintos. As
   quantidades e os valores da NF devem continuar iguais aos importados.
   Salve como rascunho e confirme estoque zero para ambos os materiais novos.
7. Confirme explicitamente a NF. Confira uma ENTRADA por item e aumento de
   estoque pelas quantidades da NF, uma única vez. Uma NF confirmada deve
   permanecer bloqueada para edição.
8. Em outro rascunho, tente criar material com nome já existente. Confira a
   mensagem de duplicidade, os campos preenchidos no modal e a NF intacta.
   Corrija o nome e reenvie; em outra tentativa, cancele e selecione o material
   existente. Simule falha de rede para conferir que o cadastro pode ser tentado
   novamente sem apagar o rascunho.
9. Em base sem materiais, abra a NF, adicione um item e crie o primeiro material
   pelo botão. Confira que a lista vazia não impede mostrar o item ou o cadastro.
10. Entre como OPERADOR: a NF manual e a importação devem continuar disponíveis,
    com seleção de materiais existentes e sem **+ Criar material**. Entre como
    CONSULTA: confira que não há acesso às rotas de cadastro/edição de NF.
11. Repita criação, cancelamento e erro em celular real. Abra o teclado, role os
    campos e confira que **Cadastrar material** e **Cancelar** ficam acessíveis.
    No desktop, percorra o modal com Tab/Shift+Tab e confira o retorno do foco.
12. Abra a página normal de materiais, cadastre e edite um material. Confira
    validações, mensagens e navegação habituais.

A emulação automatizada de celular não substitui a conferência do teclado em
um dispositivo físico. O roteiro acima documenta a validação manual a realizar;
não representa uma execução manual com banco de produção.
