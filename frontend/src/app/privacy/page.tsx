export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Politica de Privacidade
        </h1>
        <p className="text-sm text-slate-500 mb-8">
          Ultima atualizacao: 07 de marco de 2026
        </p>

        <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              1. Informacoes que coletamos
            </h2>
            <p className="text-slate-600">
              O Tecnikos coleta informacoes necessarias para a prestacao dos
              servicos de gestao de servicos tecnicos, incluindo: nome, email,
              telefone, CNPJ/CPF, endereco e dados financeiros relacionados a
              ordens de servico e faturamento. Tambem coletamos dados de uso do
              sistema para melhoria continua da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              2. Uso das informacoes
            </h2>
            <p className="text-slate-600">
              As informacoes coletadas sao utilizadas para: gerenciar ordens de
              servico e cadastros de parceiros; processar lancamentos financeiros;
              enviar notificacoes operacionais via WhatsApp e email; emitir notas
              fiscais de servico (NFS-e); gerar relatorios gerenciais e fiscais;
              e manter a seguranca da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              3. WhatsApp Business API
            </h2>
            <p className="text-slate-600">
              O Tecnikos utiliza a API do WhatsApp Business (Meta) para
              comunicacao operacional com clientes e tecnicos. As mensagens
              enviadas e recebidas sao armazenadas de forma segura em nossos
              servidores para historico de atendimento. Nao compartilhamos o
              conteudo das mensagens com terceiros. O uso da API segue as
              politicas da Meta para WhatsApp Business Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              4. Protecao de dados
            </h2>
            <p className="text-slate-600">
              Utilizamos criptografia AES-256-GCM para armazenamento de tokens e
              credenciais sensiveis. As comunicacoes sao protegidas por SSL/TLS.
              O acesso ao sistema e controlado por autenticacao JWT com controle
              de papeis (RBAC). Backups automaticos sao realizados diariamente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              5. Compartilhamento de dados
            </h2>
            <p className="text-slate-600">
              Nao vendemos, alugamos ou compartilhamos dados pessoais com
              terceiros para fins comerciais. Dados podem ser compartilhados
              apenas com: provedores de infraestrutura necessarios para operacao
              do servico; autoridades fiscais conforme exigido por lei (SPED,
              NFS-e); e mediante ordem judicial.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              6. Retencao de dados
            </h2>
            <p className="text-slate-600">
              Os dados sao mantidos enquanto a conta da empresa estiver ativa e
              pelo periodo exigido por obrigacoes fiscais e legais brasileiras.
              Dados financeiros e fiscais sao mantidos por no minimo 5 anos
              conforme legislacao vigente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              7. Direitos do usuario
            </h2>
            <p className="text-slate-600">
              Em conformidade com a LGPD (Lei Geral de Protecao de Dados), voce
              tem direito a: acessar seus dados pessoais; solicitar correcao de
              dados incorretos; solicitar exclusao de dados (respeitando
              obrigacoes legais de retencao); e revogar consentimento para
              comunicacoes nao essenciais.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              8. Contato
            </h2>
            <p className="text-slate-600">
              Para questoes sobre privacidade ou exercicio de seus direitos,
              entre em contato pelo email:{" "}
              <a
                href="mailto:contato@tecnikos.com.br"
                className="text-blue-600 hover:underline"
              >
                contato@tecnikos.com.br
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              9. Alteracoes nesta politica
            </h2>
            <p className="text-slate-600">
              Esta politica pode ser atualizada periodicamente. Alteracoes
              significativas serao comunicadas aos usuarios do sistema.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400">
            Tecnikos &mdash; Gestao de Servicos Tecnicos
          </p>
          <p className="text-xs text-slate-400 mt-1">
            SLS Obras LTDA &mdash; CNPJ: 47.226.599/0001-40
          </p>
        </div>
      </div>
    </div>
  );
}
