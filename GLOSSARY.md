# reading-list

Aplicativo pessoal para organizar os livros que se quer ler, que se está lendo e que já foram lidos: uma fila do que vem a seguir e um histórico do que passou.

## Linguagem

**Leitor**:
A única pessoa que usa o aplicativo e a quem a Lista de leitura pertence.
_Evitar_: Usuário, conta, cliente

**Lista de leitura**:
O conjunto de todos os Livros que o Leitor registrou, em qualquer situação.
_Evitar_: Estante, biblioteca, coleção

**Livro**:
Uma obra que o Leitor registrou na Lista de leitura.
_Evitar_: Item, entrada, título, artigo

**Título**:
O nome da obra, como o Leitor o escreveu.
_Evitar_: Nome

**Autoria**:
Quem escreveu o Livro, num único texto livre que pode citar mais de uma pessoa.
_Evitar_: Autor, autores, escritor

## Situação

**Situação**:
Em que ponto da leitura um Livro está. Todo Livro tem exatamente uma Situação.
_Evitar_: Status, estado, estágio

**Quero ler**:
Situação de um Livro que o Leitor pretende ler e ainda não começou. Juntos, esses Livros formam a **Fila**.
_Evitar_: Pendente, a ler, backlog, wishlist

**Lendo**:
Situação de um Livro cuja leitura está em andamento, inclusive se estiver parada por um tempo com intenção de retomar.
_Evitar_: Em progresso, atual, pausado

**Lido**:
Situação de um Livro cuja leitura o Leitor concluiu.
_Evitar_: Concluído, finalizado, terminado

**Abandonado**:
Situação de um Livro cuja leitura o Leitor começou e decidiu não terminar.
_Evitar_: Desistido, cancelado

**Fila**:
Os Livros em Quero ler, do cadastrado há mais tempo ao mais recente.
_Evitar_: Próximas leituras, lista de desejos
