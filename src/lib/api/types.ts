/**
 * Contrato de dados entre o front-end e a API do back-end.
 *
 * Este arquivo é a PROPOSTA de contrato. O back-end deve devolver exatamente estes formatos
 * (JSON). Valores monetários são números em reais (BRL), datas são ISO 8601 em UTC e a chave
 * de mês é sempre "AAAA-MM". Veja docs/API_CONTRACT.md para a lista de rotas.
 */

export type Network = "solana" | "hyperliquid";
export type EventType = "swap" | "perp" | "funding" | "transfer";
export type ReportStatus = "draft" | "final";
export type Plan = "free" | "pro" | "accountant";
export type LoginMethod = "wallet" | "email" | "google" | "github";
export type OAuthProvider = "google" | "github";

/* ---------- Autenticação (Sign-In With Solana, e-mail, Google, GitHub) ---------- */

export interface NonceResponse {
  /** Mensagem exata que a carteira deve assinar (o back-end monta e guarda o nonce). */
  message: string;
  nonce: string;
  expiresAt: string;
}

export interface VerifyRequest {
  address: string;
  message: string;
  /** Assinatura ed25519 da mensagem, em base58. */
  signature: string;
}

export interface Session {
  /** Token de acesso enviado em Authorization: Bearer <token>. */
  token: string;
  expiresAt: string;
  user: User;
}

export interface User {
  id: string;
  /** Endereço Solana usado no login. null para quem entrou por e-mail, Google ou GitHub. */
  address: string | null;
  email: string | null;
  /** Nome vindo do Google/GitHub, quando existe. */
  displayName: string | null;
  loginMethods: LoginMethod[];
  /** false = nenhuma carteira cadastrada ainda (quem entrou sem carteira). */
  hasWallets: boolean;
  plan: Plan;
  /** Quantas perguntas ao agente restam no mês (plano grátis: 20). */
  agentQuestionsLeft: number;
  /** true quando a primeira sincronização completa já terminou. */
  onboarded: boolean;
}

/** GET /api/auth/providers — quais formas de login estão ligadas no servidor. */
export type Providers = Record<LoginMethod, boolean>;

export interface EmailStartResponse {
  sent: boolean;
  expiresAt: string;
  /** Segundos até poder pedir outro código. */
  resendAfter: number;
}

/** POST /api/auth/oauth/:provider/start */
export interface OAuthStartResponse {
  url: string;
}

/* ---------- Carteiras ---------- */

export type WalletStatus = "synced" | "syncing" | "error" | "empty" | "pending";

export interface Wallet {
  id: string;
  network: Network;
  address: string;
  label: string;
  /** true para a carteira Solana usada no login (não pode ser removida). */
  isLogin: boolean;
  verifiedAt: string | null;
  lastSyncAt: string | null;
  status: WalletStatus;
  /** Mensagem de erro amigável quando status === "error". */
  error?: string | null;
}

export interface AddWalletRequest {
  network: Network;
  address: string;
  label?: string;
}

/* ---------- Sincronização (ingestão) ---------- */

export type StepState = "done" | "running" | "pending" | "error";

export interface SyncWalletProgress {
  walletId: string;
  network: Network;
  address: string;
  read: number;
  /** Total estimado; null enquanto desconhecido. */
  total: number | null;
  state: StepState;
  /** Ex.: "fills e funding" */
  detail?: string;
  error?: string | null;
}

export interface SyncStatus {
  state: "idle" | "running" | "done" | "error";
  /** Início do período efetivamente lido (AAAA-MM-DD). */
  since: string;
  read: number;
  estimated: number | null;
  wallets: SyncWalletProgress[];
  steps: { key: string; label: string; state: StepState }[];
}

/* ---------- Painel e eventos ---------- */

export interface Dashboard {
  month: string;
  updatedAt: string;
  volumeBrl: number;
  disposals: number;
  capitalGainBrl: number;
  /** Variação do ganho em relação ao mês anterior, em %. null se não houver base. */
  gainChangePct: number | null;
  estimatedTaxBrl: number;
  /** Limite mensal de isenção (R$ 35.000,00 hoje). Vem do back-end para não fixar regra no front. */
  exemptionLimitBrl: number;
  /**
   * Situação de isenção do mês decidida pelo motor fiscal, com a regra validada aplicada.
   * null ou ausente enquanto o motor não concluiu: o front nunca deduz isenção só comparando volume e limite.
   */
  exemptionStatus?: "exempt" | "taxable" | null;
  missingPrices: number;
}

export interface TaxEvent {
  id: string;
  date: string;
  network: Network;
  type: EventType;
  /** Ex.: "SOL → USDC", "HYPE-PERP" */
  asset: string;
  quantity: number;
  /** Símbolo da quantidade. Ex.: "SOL" */
  quantityAsset: string;
  /** null quando nenhuma fonte de preço foi encontrada. */
  valueBrl: number | null;
  priceSource: "auto" | "manual" | null;
  txHash: string;
  explorerUrl: string;

  /*
   * Detalhes para revisar o evento (opcionais: o back-end pode omitir ou mandar null;
   * o front mostra "Indisponível" no lugar).
   */
  /** Carteira de origem do evento. */
  wallet?: { address: string; label: string | null } | null;
  /** Protocolo ou corretora. Ex.: "Jupiter", "Hyperliquid". */
  protocol?: string | null;
  /** Preço unitário usado, em R$. null quando não há preço. */
  unitPriceBrl?: number | null;
  /** Fonte da cotação automática. Ex.: "CoinGecko", "Hyperliquid". null se manual ou sem preço. */
  priceProvider?: string | null;
  /** PTAX de venda (USD→BRL) usada na conversão e a data de referência (AAAA-MM-DD). */
  ptax?: number | null;
  ptaxDate?: string | null;
  /** Instante da cotação e versão da regra aplicada, quando fornecidos pelo motor. */
  priceObservedAt?: string | null;
  ruleVersion?: string | null;
  /** Taxas totais do evento em reais. */
  feesBrl?: number | null;
  /** Custo de aquisição e ganho de capital do evento, em R$. */
  costBrl?: number | null;
  gainBrl?: number | null;
  /** Indicadores do motor; back-ends anteriores podem omitir (usar ReportRow pelo id). */
  costUnknown?: boolean | null;
  costManual?: boolean | null;
  /**
   * Origem dos números (opcionais: o back-end pode omitir ou mandar null).
   * quantityIn/quantityInAsset são null fora de swap ou em rota com mais de um ativo de entrada:
   * não mostrar a linha dos dois lados quando ausentes ou null.
   * positionBeforeQty/avgCostUnitBrl são null quando a venda tem mais de um ativo de saída:
   * não mostrar a conta do custo quando ausentes ou null.
   * Com costUnknown = true, o custo médio é ZERO: mostrar aviso de custo desconhecido em vez da conta.
   * Com costManual = true, informar que o custo foi informado pelo usuário.
   */
  /** Quantidade que entrou no swap. */
  quantityIn?: number | null;
  /** Símbolo do ativo que entrou no swap. */
  quantityInAsset?: string | null;
  /** Posição antes da venda, em quantidade do ativo. */
  positionBeforeQty?: number | null;
  /** Custo médio por unidade usado, em R$. */
  avgCostUnitBrl?: number | null;
  /** Quantos fills compuseram o evento. */
  fillCount?: number | null;
  /** Transferência: entrada ("in") ou saída ("out") e o endereço do outro lado, quando há um só. */
  direction?: "in" | "out" | null;
  counterparty?: string | null;
  /** Motivos reportados pelo motor para manter o evento pendente. */
  pendingReasons?: string[];
  /** Revisões auditáveis persistidas pelo back-end. */
  reviewHistory?: EventReview[];
}

export interface ManualPriceRequest {
  unitPriceBrl: number;
}

export interface ManualPriceReviewRequest extends ManualPriceRequest {
  reason: string;
  evidence: string;
  confirmed: true;
}

/** PUT /api/events/:id/cost — custo de aquisição informado para uma venda sem compra no histórico lido. */
export interface ManualCostRequest {
  /** Custo total da quantidade vendida, em reais. */
  costBrl: number;
  reason: string;
  evidence: string;
  confirmed: true;
}

export interface EventReview {
  /** "price": preço corrigido. "cost": custo de aquisição informado. */
  kind: "price" | "cost";
  reason: string;
  evidence: string;
  previousPriceBrl: number | null;
  newPriceBrl: number;
  previousCostBrl?: number | null;
  newCostBrl?: number | null;
  createdAt: string;
}

/* ---------- Relatórios ---------- */

export interface ReportSummary {
  month: string;
  status: ReportStatus;
  events: number;
  totalBrl: number;
  updatedAt: string;
}

export interface ReportRow {
  id: string;
  date: string;
  type: EventType;
  asset: string;
  quantity: number;
  ptax: number;
  valueBrl: number;
  costBrl: number;
  gainBrl: number;
  manualPrice?: boolean;
  /** true quando o ativo vendido entrou antes do histórico lido: o custo foi tratado como zero. */
  costUnknown?: boolean;
  /** true quando o custo de aquisição desta venda foi informado pelo usuário. */
  costManual?: boolean;
}

export interface Attestation {
  /** SHA-256 (hex) do CSV final do relatório. */
  hash: string;
  txSignature: string;
  slot: number;
  registeredAt: string;
  /** Identificador curto do link público: /v/{publicId} */
  publicId: string;
}

export interface ReportDetail {
  month: string;
  status: ReportStatus;
  totals: { disposedBrl: number; costBrl: number; gainBrl: number; taxBrl: number };
  rows: ReportRow[];
  attestation: Attestation | null;
  /** Metadados de cobertura e validação do motor; ausente em APIs ainda não integradas. */
  review?: ReportReview;
  /** Versão congelada pelo back-end; ausente em APIs anteriores. */
  version?: number;
  /** Os dados atuais diferem da versão final, que continua imutável. */
  outdated?: boolean;
  currentTotals?: ReportDetail["totals"] | null;
  previousVersions?: {
    version: number;
    hash: string;
    publicId: string;
    txSignature: string | null;
    slot: number | null;
    registeredAt: string | null;
    finalizedAt: string | null;
  }[];
}

export interface ReportReview {
  engineVersion: string | null;
  coverage: {
    state: "complete" | "partial" | "unknown";
    importedFrom: string | null;
    importedThrough: string | null;
    importedEvents: number | null;
  };
  limitations: string[];
  pendingReasons: string[];
  unsupportedOperations: string[];
  reviewItems?: ReportReviewItem[];
  /** true somente após validação explícita pelo motor e gerador DeCripto. */
  decriptoReady: boolean;
}

export interface ReportReviewItem {
  id: string;
  kind: "acquisition_cost" | "classification";
  label: string;
}

/** URL temporária (presigned) para baixar um arquivo gerado pelo back-end. */
export interface DownloadLink {
  url: string;
  filename: string;
  expiresAt: string;
}

/* ---------- Verificação pública ---------- */

export interface PublicVerification {
  publicId: string;
  /** "Relatório mensal · Setembro/2026 · titular ocultado" */
  description: string;
  month: string;
  hash: string;
  txSignature: string;
  slot: number;
  registeredAt: string;
  /** true quando o hash do registro on-chain bate com o hash guardado. */
  valid: boolean;
}

/* ---------- Agente IA ---------- */

export type AgentBlock =
  | { type: "text"; text: string }
  | { type: "breakdown"; rows: { label: string; value: string; emphasis?: "total" | "gain" }[] }
  | { type: "citations"; items: { kind: "ptax" | "tx" | "report"; label: string; url?: string }[] };

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  /** Mensagens do usuário usam só text; as do agente usam blocks. */
  text?: string;
  blocks?: AgentBlock[];
  createdAt: string;
  /** "rules": texto montado pelas regras de cálculo no back-end, sem IA (IA fora do ar ou cota esgotada). */
  source?: "ai" | "rules";
}

export interface AgentContext {
  month: string;
  status: ReportStatus;
  volumeBrl: number;
  gainBrl: number;
  taxBrl: number;
  taxRatePct: number;
  sourceTx: {
    title: string;
    signature: string;
    date: string;
    slot: number;
  } | null;
}

export interface AgentRequest {
  message: string;
  /** Mês em foco ("AAAA-MM"); o back-end pode inferir se omitido. */
  month?: string;
  conversationId?: string;
}

export interface AgentReply {
  conversationId: string;
  message: AgentMessage;
  context: AgentContext | null;
  suggestions: string[];
  questionsLeft: number;
  /** Por que a resposta veio por regras; null quando veio da IA. */
  rulesReason?: "unavailable" | "quota" | null;
}
