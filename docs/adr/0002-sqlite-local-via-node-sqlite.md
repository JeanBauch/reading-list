# Persistência em SQLite local via `node:sqlite`

A Lista de leitura é guardada em um arquivo SQLite local, acessado pelo módulo `node:sqlite` embutido no Node. Assim o piloto (ver ADR-0001) não precisa de servidor de banco nem de nenhuma dependência nova. Preferimos isso ao `localStorage`, que empurraria a leitura de dados para Client Components e prenderia os dados a um navegador, e a um arquivo JSON, que exigiria tratar escrita concorrente e consultas à mão.

## Consequências

- **Aviso aceito:** `node:sqlite` ainda é experimental no Node 24 e emite um aviso em tempo de execução. Aceitamos o aviso e o risco de mudanças na API em troca de não ter dependência nativa.
- **Arquivo fora do git:** o arquivo do banco nunca é versionado. Seu caminho é configurável por variável de ambiente, com um padrão local quando ela não está definida.
- **Só o servidor acessa o banco:** apenas código de servidor toca o banco, e sempre através do módulo de dados. Componentes, Server Actions e rotas não abrem conexão nem escrevem SQL diretamente.
- **Testes:** os testes do módulo de dados usam um banco em memória e rodam no ambiente `node` do Vitest, não no `jsdom` (que é o ambiente padrão do projeto).
