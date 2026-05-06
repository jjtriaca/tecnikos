/**
 * Seeder: importa Products + Services + PoolCatalogConfig da planilha
 * Juliano Piscinas (aba "Dados").
 *
 * Origem: ANDREIA SANTANA - Orçamento 120614042026.xlsm (Dados sheet, 220 rows)
 *
 * Uso (local):
 *   npx ts-node backend/scripts/pool-seed/seed-from-excel.ts <companyId>
 *
 * Uso (prod via SSH):
 *   ssh root@... 'cd /opt/tecnikos/app && docker exec -i tecnikos_backend node \
 *     /app/scripts/pool-seed/seed-from-excel.js <companyId>'
 */
import { PrismaClient, PoolSection } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Conexao public (busca Tenant + Company) e conexao tenant (escreve Pool*)
const publicPrisma = new PrismaClient();

interface ExcelRow {
  Cod?: string | null;
  Tipo?: string | null; // "Produto" | "Serviço"
  Grupo?: string | null;
  Categoria?: string | null;
  Ativo?: string | null; // "Sim" | "Não"
  Descrição?: string | null;
  Complemento?: string | null;
  Unid?: string | null;
  Marca?: string | null;
  'Peso Kg'?: string | null;
  'Comprimento (cm)'?: string | null;
  'Largura (cm)'?: string | null;
  'Expessura (cm)'?: string | null;
  'Potencia (cv)'?: string | null;
  Voltagem?: string | null;
  'Bif/Trif'?: string | null;
  'Bif / Trif conta'?: string | null;
  'Potencia watts'?: string | null;
  Amperagem?: string | null;
  'w/h Max'?: string | null;
  'w/h Med'?: string | null;
  'Vazão m³/h'?: string | null;
  'Carga de areia kg'?: string | null;
  'Tubo de entrada (mm)'?: string | null;
  'Bomba Recomendada'?: string | null;
  'Eficiência '?: string | null;
  Multiplicador?: string | null;
  'Range de Kcal/h Min'?: string | null;
  'Range de Kcal/h Max'?: string | null;
  'Cod Kit'?: string | null;
  Rendimento?: string | null;
  'Consumo Kg X m²'?: string | null;
  'R$ Custo'?: string | null;
  'Margem de lucro'?: string | null;
  Markup?: string | null;
  'Preço de venda'?: string | null;
  'Link da Imagem'?: string | null;
}

// Mapeia "Grupo" da planilha → PoolSection enum do schema
const SECTION_MAP: Record<string, PoolSection> = {
  // CONSTRUCAO (estrutura, paredes, fundo)
  'Paredes': 'CONSTRUCAO',
  'Concretos': 'CONSTRUCAO',
  'Impermeabilizantes': 'CONSTRUCAO',
  'Básicos': 'CONSTRUCAO',
  'Construção': 'CONSTRUCAO',
  'Preparação': 'CONSTRUCAO',
  'Rejuntes': 'CONSTRUCAO',
  // BORDA_CALCADA (revestimento + acabamento)
  'Revestimento': 'BORDA_CALCADA',
  // FILTRO (tratamento de agua)
  'Filtros': 'FILTRO',
  'Bombas': 'FILTRO',
  // AQUECIMENTO
  'Aquecedores': 'AQUECIMENTO',
  'Módulos': 'AQUECIMENTO', // modulos solares geralmente
  'Exaustores': 'AQUECIMENTO', // exaustor de gas geralmente vinculado ao aquecedor
  // CASCATA, SPA
  'Cascata': 'CASCATA',
  'SPA': 'SPA',
  // ILUMINACAO
  'Iluminação': 'ILUMINACAO',
  // CASA_MAQUINAS (eletrica + comando)
  'Casa de Maquinas': 'CASA_MAQUINAS',
  'Quadros': 'CASA_MAQUINAS',
  'Disjuntores': 'CASA_MAQUINAS',
  'Contactores': 'CASA_MAQUINAS',
  'Terra': 'CASA_MAQUINAS',
  // DISPOSITIVOS
  'Dispositivos': 'DISPOSITIVOS',
  'Ralos': 'DISPOSITIVOS',
  'Tampas': 'DISPOSITIVOS',
  'Grelhas': 'DISPOSITIVOS',
  // EXECUCAO (mao de obra, instalacao, deslocamento)
  'Instalação': 'EXECUCAO',
  'Obra fora': 'EXECUCAO',
  'Administrativos': 'EXECUCAO',
  // OUTROS
  'Opcionais': 'OUTROS',
};

function num(v: string | null | undefined): number | null {
  if (v == null || v === '' || v === '0' || v === '0.0') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function reais(v: string | null | undefined): number | null {
  const n = num(v);
  return n == null ? null : Math.round(n * 100); // converte pra centavos
}

function isSkipRow(row: ExcelRow): boolean {
  // Linhas vazias
  if (!row.Cod || !row.Descrição) return true;
  // "Sem Produto"/"Sem Serviço" agora SAO criados como placeholders oficiais
  // pra linhas de orcamento sem item real definido (mantem unit/preco em zero).
  if (row.Ativo && /^N(ã|a)o$/i.test(row.Ativo)) return true;
  return false;
}

/**
 * Coleta apenas os campos tecnicos nao-nulos pra armazenar em
 * PoolCatalogConfig.technicalSpecs (JSONB livre).
 */
function buildTechnicalSpecs(row: ExcelRow): Record<string, unknown> | null {
  const specs: Record<string, unknown> = {};

  const map: Array<[keyof ExcelRow, string]> = [
    ['Peso Kg', 'pesoKg'],
    ['Comprimento (cm)', 'comprimentoCm'],
    ['Largura (cm)', 'larguraCm'],
    ['Expessura (cm)', 'espessuraCm'],
    ['Potencia (cv)', 'potenciaCv'],
    ['Voltagem', 'voltagem'],
    ['Bif/Trif', 'bifTrif'],
    ['Bif / Trif conta', 'bifTrifConta'],
    ['Potencia watts', 'potenciaWatts'],
    ['Amperagem', 'amperagem'],
    ['w/h Max', 'whMax'],
    ['w/h Med', 'whMed'],
    ['Vazão m³/h', 'vazaoM3h'],
    ['Carga de areia kg', 'cargaAreiaKg'],
    ['Tubo de entrada (mm)', 'tuboEntradaMm'],
    ['Bomba Recomendada', 'bombaRecomendada'],
    ['Eficiência ', 'eficiencia'],
    ['Multiplicador', 'multiplicador'],
    ['Range de Kcal/h Min', 'kcalHMin'],
    ['Range de Kcal/h Max', 'kcalHMax'],
    ['Cod Kit', 'codKit'],
    ['Rendimento', 'rendimento'],
    ['Consumo Kg X m²', 'consumoKgM2'],
  ];

  for (const [excelKey, jsonKey] of map) {
    const v = row[excelKey];
    if (v == null || v === '' || v === '0' || v === '0.0') continue;
    const n = parseFloat(String(v));
    specs[jsonKey] = Number.isFinite(n) && String(n) === String(v).trim() ? n : v;
  }

  // Categoria livre da planilha (Obras, Casa de Máquinas, etc.)
  if (row.Categoria) specs.categoriaPlanilha = row.Categoria;
  // Complemento (texto livre adicional)
  if (row.Complemento) specs.complemento = row.Complemento;

  return Object.keys(specs).length > 0 ? specs : null;
}

async function main() {
  const companyId = process.argv[2];
  if (!companyId) {
    console.error('USO: ts-node seed-from-excel.ts <companyId>');
    process.exit(1);
  }

  // Resolve company (no public schema) e descobre o schema do tenant pra
  // escrever Pool* no lugar certo (TENANT_MODEL_DELEGATES roteia tudo isso
  // pro schema tenant_<slug> em runtime do app, mas scripts standalone
  // precisam fazer manualmente).
  const company = await publicPrisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    console.error(`Company ${companyId} nao encontrada`);
    process.exit(1);
  }
  if (!company.poolModuleActive) {
    console.error(`Company ${company.name} esta com Pool Module inativo. Ative em Configuracoes antes.`);
    process.exit(1);
  }

  // Resolve tenant schema. Em prod cada tenant tem um schema (`tenant_<slug>`)
  // resolvido via CNPJ. Em local dev (sem tenants em public) cai pra `public`.
  // Pra forcar schema especifico, passe POOL_SEED_SCHEMA no env.
  let schemaName = process.env.POOL_SEED_SCHEMA;
  if (!schemaName && company.cnpj) {
    const tenant = await publicPrisma.tenant.findFirst({ where: { cnpj: company.cnpj } });
    schemaName = tenant?.schemaName;
  }
  if (!schemaName) schemaName = 'public';
  console.log(`Schema alvo: ${schemaName}`);

  const baseUrl = process.env.DATABASE_URL || '';
  const tenantUrl = baseUrl.includes('?schema=')
    ? baseUrl.replace(/\?schema=[^&]+/, `?schema=${schemaName}`)
    : `${baseUrl}?schema=${schemaName}`;
  const prisma = schemaName === 'public'
    ? publicPrisma
    : new PrismaClient({ datasources: { db: { url: tenantUrl } } });

  const dataPath = path.join(__dirname, 'dados.json');
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const rows = JSON.parse(raw) as ExcelRow[];

  console.log(`Iniciando seed pra company ${company.name} (${rows.length} rows lidas)`);
  let createdProducts = 0;
  let createdServices = 0;
  let createdConfigs = 0;
  let skipped = 0;
  const unmapped = new Set<string>();

  for (const row of rows) {
    if (isSkipRow(row)) { skipped++; continue; }

    const tipo = (row.Tipo || '').trim();
    const isProduto = /^Produto$/i.test(tipo);
    const isServico = /^Servi(ç|c)o$/i.test(tipo);
    if (!isProduto && !isServico) { skipped++; continue; }

    const grupo = (row.Grupo || '').trim();
    let section = SECTION_MAP[grupo] as PoolSection | undefined;
    // "Sem Produto"/"Sem Serviço" caem em OUTROS por default
    if (!section && /^Sem (Produto|Serviço|Servico)$/i.test(row.Descrição || '')) {
      section = 'OUTROS' as PoolSection;
    }
    if (!section) {
      unmapped.add(grupo || '(vazio)');
    }

    const description = (row.Descrição || '').trim();
    const code = `XLS-${row.Cod}`.replace(/\.0$/, '');
    const unit = (row.Unid || 'UN').trim().toUpperCase();
    const brand = row.Marca?.trim() || null;
    const cost = reais(row['R$ Custo']);
    const sale = reais(row['Preço de venda']);
    const margin = num(row['Margem de lucro']);
    const imageUrl = row['Link da Imagem']?.trim() || null;
    const specs = buildTechnicalSpecs(row);

    if (isProduto) {
      // Cria Product (skip se ja existe pelo code) — atualiza technicalSpecs/imageUrl em ambos casos
      const existing = await prisma.product.findFirst({ where: { companyId, code } });
      const product = existing
        ? await prisma.product.update({
            where: { id: existing.id },
            data: {
              technicalSpecs: specs as any,
              ...(imageUrl && !existing.imageUrl ? { imageUrl } : {}),
              ...(brand && !existing.brand ? { brand } : {}),
            },
          })
        : await prisma.product.create({
            data: {
              companyId,
              code,
              description,
              brand,
              unit,
              category: row.Categoria || grupo || null,
              costCents: cost ?? undefined,
              salePriceCents: sale ?? undefined,
              profitMarginPercent: margin ? margin * 100 : undefined,
              imageUrl,
              technicalSpecs: specs as any,
            },
          });
      if (!existing) createdProducts++;

      if (section) {
        const cfgExisting = await prisma.poolCatalogConfig.findUnique({
          where: { productId: product.id },
        });
        if (!cfgExisting) {
          await prisma.poolCatalogConfig.create({
            data: {
              companyId,
              productId: product.id,
              poolSection: section,
              displayOrder: parseInt(String(row.Cod || '0').replace(/\.0$/, ''), 10) || 0,
              technicalSpecs: specs as any,
              isActive: true,
            },
          });
          createdConfigs++;
        }
      }
    } else {
      // Cria Service — atualiza technicalSpecs/imageUrl mesmo se ja existir
      const existing = await prisma.service.findFirst({ where: { companyId, code } });
      const service = existing
        ? await prisma.service.update({
            where: { id: existing.id },
            data: {
              technicalSpecs: specs as any,
              ...(imageUrl && !existing.imageUrl ? { imageUrl } : {}),
            },
          })
        : await prisma.service.create({
            data: {
              companyId,
              code,
              name: description,
              description: row.Complemento?.trim() || null,
              unit: unit === 'UN' ? 'SV' : unit,
              priceCents: sale ?? undefined,
              category: row.Categoria || grupo || null,
              imageUrl,
              technicalSpecs: specs as any,
            },
          });
      if (!existing) createdServices++;

      if (section) {
        const cfgExisting = await prisma.poolCatalogConfig.findUnique({
          where: { serviceId: service.id },
        });
        if (!cfgExisting) {
          await prisma.poolCatalogConfig.create({
            data: {
              companyId,
              serviceId: service.id,
              poolSection: section,
              displayOrder: parseInt(String(row.Cod || '0').replace(/\.0$/, ''), 10) || 0,
              technicalSpecs: specs as any,
              isActive: true,
            },
          });
          createdConfigs++;
        }
      }
    }
  }

  console.log(`\n✓ Concluido`);
  console.log(`  Products novos:        ${createdProducts}`);
  console.log(`  Services novos:        ${createdServices}`);
  console.log(`  PoolCatalogConfig:     ${createdConfigs}`);
  console.log(`  Skipped:               ${skipped}`);
  if (unmapped.size > 0) {
    console.log(`  Grupos sem mapeamento (sem PoolSection): ${[...unmapped].join(', ')}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => publicPrisma.$disconnect());
