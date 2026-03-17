export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Termos de Uso — Tecnikos</h1>
      <p className="text-xs text-slate-400 mb-8">Ultima atualizacao: 17 de marco de 2026</p>

      <div className="prose prose-slate prose-sm max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-slate-700">1. Aceitacao dos Termos</h2>
          <p className="text-sm text-slate-600">
            Ao acessar e utilizar a plataforma Tecnikos (&quot;Plataforma&quot;), operada pela SLS Obras LTDA
            (CNPJ: 47.226.599/0001-40), voce concorda com estes Termos de Uso. Caso nao concorde,
            nao utilize a Plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700">2. Descricao do Servico</h2>
          <p className="text-sm text-slate-600">
            O Tecnikos e uma plataforma SaaS (Software as a Service) de gestao de servicos de campo
            (Field Service Management), que permite o gerenciamento de ordens de servico, tecnicos,
            clientes, financeiro e demais operacoes relacionadas.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700">3. Cadastro e Conta</h2>
          <p className="text-sm text-slate-600">
            Para utilizar a Plataforma, e necessario criar uma conta com dados verdadeiros e completos.
            Voce e responsavel por manter a confidencialidade de suas credenciais de acesso e por
            todas as atividades realizadas em sua conta.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700">4. Planos e Pagamento</h2>
          <p className="text-sm text-slate-600">
            A Plataforma oferece diferentes planos de assinatura. O acesso as funcionalidades esta
            condicionado ao plano contratado e ao pagamento em dia. Em caso de inadimplencia,
            o acesso podera ser suspenso apos notificacao previa.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700">5. Dados e Privacidade</h2>
          <p className="text-sm text-slate-600">
            Os dados inseridos na Plataforma sao de propriedade do cliente. A SLS Obras LTDA se
            compromete a proteger esses dados conforme a Lei Geral de Protecao de Dados (LGPD -
            Lei 13.709/2018). Consulte nossa Politica de Privacidade para mais detalhes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700">6. Uso Aceitavel</h2>
          <p className="text-sm text-slate-600">
            O cliente se compromete a utilizar a Plataforma de forma licita, nao realizando atividades
            que possam prejudicar seu funcionamento, seguranca ou a experiencia de outros usuarios.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700">7. Disponibilidade</h2>
          <p className="text-sm text-slate-600">
            A SLS Obras LTDA emprega esforcos razoaveis para manter a Plataforma disponivel,
            mas nao garante disponibilidade ininterrupta. Manutencoes programadas serao comunicadas
            com antecedencia quando possivel.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700">8. Cancelamento</h2>
          <p className="text-sm text-slate-600">
            O cliente pode cancelar sua assinatura a qualquer momento. Apos o cancelamento,
            os dados serao mantidos por 90 dias para eventual reativacao, apos os quais poderao
            ser permanentemente excluidos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700">9. Alteracoes nos Termos</h2>
          <p className="text-sm text-slate-600">
            Estes termos podem ser atualizados periodicamente. O uso continuado da Plataforma apos
            alteracoes constitui aceitacao dos novos termos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-700">10. Contato</h2>
          <p className="text-sm text-slate-600">
            Em caso de duvidas sobre estes Termos, entre em contato pelo e-mail:{" "}
            <a href="mailto:contato@tecnikos.com.br" className="text-blue-600 hover:text-blue-700">
              contato@tecnikos.com.br
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
