# TAREFA ATUAL

## Versao em prod: v1.12.93 (sessao 214 fechada — 29/05/2026)

Sessao 214 entregou **19 releases** em 8 temas. Foco principal: modelo fisico de consumo eletrico da bomba do Simulador Solar (7 iteracoes ate calibrar), thermal-demand.service unificado, PDF fixes finais, perda das baterias no MCA, fix capa/vento, fix scroll. Detalhes em [memory/sessao_214_summary.md](memory/sessao_214_summary.md).

**Modelo de consumo da bomba** (referencia completa): [memory/modelo_consumo_bomba_solar.md](memory/modelo_consumo_bomba_solar.md). Constantes em `backend/src/pool-budget/thermal-demand.service.ts`.

## Pendentes pra sessao 215

### **Principal: Aba Trocador de Calor (estilo aba Solar)**

Criar nova aba **"Trocador"** no Simulador (`HeatingSimulatorModal.tsx`), replicando o pattern visual e funcional da aba **Solar**, modificando apenas os campos especificos.

**Campos que NAO fazem sentido no Trocador (esconder/remover):**
- Coletor selecionado (modelo, area, eficiencia)
- Qtd coletores + coletores por bateria + baterias em serie/paralelo
- Orientacao + inclinacao do telhado
- Diagrama de baterias
- Cobertura piscina × coletores
- Fator instalacao (sem coletor)
- Indicador solar (HSE, radSol)

**Campos novos especificos do Trocador:**
- Modelo do trocador (capacidade kcal/h × cv da fonte)
- Vazao primaria (caldeira / bomba calor)
- Vazao secundaria (piscina)
- Pressao maxima
- Material (inox / titanio)
- Eficiencia de troca (~80-95%)
- Fonte de calor (caldeira gas / bomba de calor)

**Campos compartilhados (manter igual):**
- Dimensoes piscina + tipo
- Configuracao aquecimento (capa, vento, ΔT, tipo construcao)
- Tubulacao + perda de carga (com perda das baterias adaptada — trocador tambem tem perda interna)
- Bomba recomendada (mesma logica vazao + altura manometrica)
- Simulacao termica mensal (mesmo motor thermal-demand)
- Consumo eletrico (mesmo motor + fator vazao)
- Tarifa kWh (popover 💡)
- Print PDF (mesma estrutura)

### Outros pendentes
- **Remover painel debug violeta** apos validacao final dos numeros
- **Aguardando Solis:** confirmar comportamento com 7+ baterias (3 ramos paralelos)
- **Legado sessao 209:** SQL `update-solis-procel-sls.sql` manual, configurar regra do Coletor Solar no SLS
- **Roadmap:** Defaults de tubulacao configuraveis em Configuracoes > Piscina, autoSelectRule.followProductLine

## Sessoes anteriores
- **Sessao 213** (v1.12.74): NFS-e Reenviar + Solar Rules cadastraveis + PDF profissional 1 pagina
- **Sessao 212** (v1.12.59): Bomba auto-select + formula vazao Solis + diagrama de instalacao
- **Sessao 211** (v1.12.39): Modulo Piscina — etapas custom, Simulador Solar com calculadora hidraulica
