# Projeto: Workflow Engine V3

## Regras Absolutas (definidas pelo Juliano em 19/03/2026)

### 1. Status ABERTA — Blocos controlam a partir dai
- Quando uma OS e criada, nasce com status ABERTA (nao pode ser NULL no banco)
- O engine executa blocos do START e o primeiro bloco Status muda para o que o gestor definiu
- Exemplo: se primeiro bloco e Status(OFERTADA), a OS vai de ABERTA → OFERTADA automaticamente
- O status inicial e ABERTA, mas os blocos controlam tudo a partir dai

### 2. Blocos como controladores absolutos
- A partir do gatilho "QUANDO", TUDO e controlado pelos blocos
- O engine executa bloco por bloco do START ao FIM, sem pular, sem assumir nada
- NENHUMA logica pre-fixada no codigo (sem auto-assign DIRECTED, sem fallback de status)
- Se o gestor quer status ABERTA, coloca bloco Status(ABERTA)
- Se quer OFERTADA, coloca bloco Status(OFERTADA)
- O engine so faz o que os blocos mandam

### 3. Blocos de Status — Modo manual
- Bloco Status pode ser "Automatico (sistema muda)" ou "Aguardar tecnico clicar"
- Se manual: tecnico ve botao customizado (ex: "Aceitar", "A caminho", "Cheguei", "Concluir")
- Engine PARA e aguarda o tecnico clicar antes de continuar pro proximo bloco

### 4. Bloco SE/Condicao — Branches
- Cria dois caminhos: SIM e NAO
- Cada caminho tem seus proprios blocos encadeados
- Ambos convergem no Fim ou podem ter Fins independentes
- Exemplo: "Aceita?" -> SIM: Status(ATRIBUIDA) -> GPS -> ... | NAO: Status(RECUSADA) -> Nota(Motivo) -> Notificar(Gestor)

### 5. Reatribuicao
- Quando tecnico recusa (caminho NAO), o flutuante mostra ao gestor
- Gestor pode reatribuir a outro tecnico SEM criar nova OS
- Ao reatribuir, o engine reinicia do ponto adequado (re-executa o fluxo para o novo tecnico)

### 6. Nenhum problema transicional resolve com hard-code
- Se houver problema de transicao entre blocos, cria-se um NOVO BLOCO com configuracoes para resolver
- NUNCA adicionar logica especial no engine para contornar

## Fluxo de Referencia — Avaliacao para Orcamento
```
Inicio
  -> Status (OFERTADA, automatico)
  -> Notificar (TECNICO, WhatsApp, link de aceite)
  -> SE / Condicao ("Aceita?")
      -> SIM:
          Status (A_CAMINHO, manual "A caminho")
          GPS (continuo, alta precisao, 8s)
          Status (EM_EXECUCAO, manual "Cheguei no local")
          GPS (pontual, baixa precisao)
          Foto (min 3)
          Formulario (2 campos)
          Status (CONCLUIDA, manual "Concluir avaliacao")
      -> NAO:
          Status (RECUSADA, automatico)
          Nota ("Motivo?")
          Notificar (GESTOR, Push, "{tecnico} recusou!")
  -> Fim
```
