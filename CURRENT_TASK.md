# TAREFA ATUAL

## Versao em prod: v1.12.77 (sessao 214 — 28/05/2026)

**v1.12.76**: PDF print fix (2ª página em branco + imagem coletor pequena). Confirmado em prod.
**v1.12.77**: Limpeza — removido botao 👁️ PDF (preview interno via `simulating-print`) que era redundante com o Chrome Print Preview automatico do botao Imprimir. Limpeza completa: useState/useEffect/portal toolbar/CSS simulating-print (~100 linhas)/import createPortal. Tambem aplicado `print:h-[52mm]` fixo no `HeaderImageBlock` fallback.

**Doc completa do sistema de print:** [memory/sistema_impressao_pdf_simulador.md](memory/sistema_impressao_pdf_simulador.md) — tabela de 18 problemas, arquitetura `printViaClone()`, CSS @media print, decisoes, ferramenta `/dev/print-test`.

## Pendentes pra sessao 214
- **Aguardando Solis:** confirmar comportamento com 7+ baterias (3 ramos paralelos)
- **Roadmap:** Defaults de tubulacao configuraveis em Configuracoes > Piscina, auto-selecao "Seguir produto da linha X" (`autoSelectRule.followProductLine`)
- **Legado (sessao 209):** SQL `update-solis-procel-sls.sql` manual, configurar regra do Coletor Solar no SLS

## Sessao anterior: v1.12.59 — Sessao 212 fechada
22 releases v1.12.39 → v1.12.60: bomba auto-select, formula vazao Solis oficial, diagrama de instalacao no padrao Solis Tropicos.

## Sessao 211: v1.12.39 fechada (21 releases)
Maratona modulo Piscina: etapas custom, modal +Linha, tipos PRODUCT/SERVICE, Darcy-Weisbach, curva da bomba.
