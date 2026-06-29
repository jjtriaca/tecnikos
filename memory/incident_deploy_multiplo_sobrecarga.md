---
name: incident-deploy-multiplo-sobrecarga
description: "Incidente 29/06 — disparar/parar vários deploy-remote.sh sobrecarregou o servidor (load 64) e deixou prod sem responder. Lições: ssh server-side continua após matar o script local; nunca lançar deploys em paralelo; tar excluir .claude. LER antes de mexer em deploy."
metadata:
  type: feedback
---

# Incidente — deploys múltiplos sobrecarregaram o servidor (29/06/2026)

## O que aconteceu
Tentando deployar um lote, eu disparei `bash scripts/deploy-remote.sh` **várias vezes** achando que falhavam por
"diretório errado" (li `pwd` como `frontend` e os exit 127 "No such file" me confundiram). Cada execução que ACHAVA o
script rodava o **passo 6 (build) via SSH NO SERVIDOR**. Eu matava o script local com TaskStop — mas **o comando ssh de
build/`up -d` continua rodando no servidor mesmo depois de matar o processo local**. Resultado: **vários `docker compose
build` concorrentes** no Hetzner CPX21 (3 vCPU/4GB) → **load average 64** → prod parou de responder (queries de 60s,
blips no Postgres, HTTP 000/502) por alguns minutos. Containers ficaram de pé e healthy o tempo todo — foi **afogamento
de recurso**, não queda. Um dos deploys completou server-side e subiu prod pra **1.14.84** (meu lote) sem commit git; o
container do backend ficou com nome conflitado `<hash>_tecnikos_backend`. version.json local bumpou órfão até 1.14.85.

## Causa raiz dos erros de leitura
1. **cwd entre chamadas do Bash é INCONSISTENTE** (às vezes raiz, às vezes `frontend` após um `cd ... && npx tsc`). Não
   confiar. **Chamar o script pelo CAMINHO ABSOLUTO** (`bash /c/Users/Juliano/sistema-terceirizacao/scripts/deploy-remote.sh`)
   — o script se auto-corrige pra raiz (`cd ROOT_DIR` via BASH_SOURCE). Exit 127 = script não encontrado (path), não falha real.
2. **tar do deploy não excluía `.claude`** → worktrees (cópias do repo) duplicavam caminhos → `tar: Cannot open: File exists`
   → BUILD FALHOU antes de tocar prod. CORRIGIDO: `--exclude=.claude` no passo 3 (v1.14.85).

## REGRAS (nunca repetir)
1. **NUNCA disparar mais de um deploy ao mesmo tempo.** Um por vez, esperar terminar (notificação). Deploys concorrentes
   afogam o servidor e quebram prod.
2. **NUNCA matar (TaskStop) um deploy no meio** — o lado servidor (build/`up -d`/migrate via ssh) continua e pode deixar
   estado inconsistente (containers meio-recriados, versão sem commit). Se precisar abortar, deixar o próprio script (tem
   health-check + rollback no passo 8) decidir.
3. **Chamar o deploy SEMPRE pelo caminho absoluto** do script. Exit 127 ⇒ path, não falha de deploy.
4. **Diagnóstico de "prod lento/fora"**: `ssh root@178.156.240.163 'cat /proc/loadavg; docker ps'` — load >> nº de cores
   = sobrecarga (esperar baixar); container "healthy" + 502 externo = afogamento, recupera ao baixar a carga.
5. **Reconciliação quando prod avança sem git** (ex.: deploy completou server-side): alinhar `version.json` local à versão
   do `/health`, então UM deploy limpo reconstrói o working tree → normaliza containers + commita + tagueia (git=prod=local).

## Servidor (referência)
`root@178.156.240.163` · APP_DIR `/opt/tecnikos/app` · compose `docker-compose.production.yml` · containers
`tecnikos_{backend,frontend,postgres,nginx,certbot}`. Ver [[feedback_worktree_prod_alignment]] e [[feedback_deploy_build_silent]].
