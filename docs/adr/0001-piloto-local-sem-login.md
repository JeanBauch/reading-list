# Piloto local, de um único leitor, sem login

Esta versão é um piloto local para validar o fluxo de trabalho, sem deploy público. Por isso existe uma única **Lista de leitura**, de um único **Leitor**, sem autenticação nem noção de dono dos dados. Multiusuário, login e compartilhamento estão **fora de escopo**: não devem ser antecipados no modelo (por exemplo, com um campo de dono "para o futuro"). Se o app for publicado, essa decisão deve ser revista explicitamente, ciente de que os dados existentes precisarão ser atribuídos a um dono.
