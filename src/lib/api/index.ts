/**
 * Ponto único de acesso à API. Todas as telas chamam `api.*` daqui.
 *
 * Cada função tem duas implementações:
 *  - HTTP: chama o back-end em NEXT_PUBLIC_API_URL (rotas documentadas em docs/API_CONTRACT.md)
 *  - Mock: src/lib/api/mock.ts, usado no modo demonstração
 *
 * Para integrar com o back-end real basta configurar NEXT_PUBLIC_API_URL; nenhuma tela muda.
 */
import { config } from "@/lib/config";
import { http, isDemoSession, SLOW_TIMEOUT_MS } from "./client";
import { mockApi } from "./mock";
import type {
  AddWalletRequest,
  AgentReply,
  AgentRequest,
  Dashboard,
  DownloadLink,
  EmailStartResponse,
  ManualCostRequest,
  ManualPriceRequest,
  ManualPriceReviewRequest,
  NonceResponse,
  OAuthProvider,
  OAuthStartResponse,
  Providers,
  PublicVerification,
  ReportDetail,
  ReportSummary,
  Session,
  SyncStatus,
  TaxEvent,
  User,
  VerifyRequest,
  Wallet,
} from "./types";

const enc = encodeURIComponent;

const httpApi = {
  // Autenticação — carteira, e-mail, Google, GitHub
  providers: () => http<Providers>("GET", "/api/auth/providers"),
  getNonce: (address: string) => http<NonceResponse>("GET", `/api/auth/nonce?address=${enc(address)}`),
  verify: (req: VerifyRequest) => http<Session>("POST", "/api/auth/verify", req),
  emailStart: (email: string) => http<EmailStartResponse>("POST", "/api/auth/email/start", { email }),
  emailVerify: (email: string, code: string) => http<Session>("POST", "/api/auth/email/verify", { email, code }),
  oauthStart: (provider: OAuthProvider, next?: string) =>
    http<OAuthStartResponse>("GET", `/api/auth/oauth/${provider}/start${next ? `?next=${enc(next)}` : ""}`),
  exchange: (code: string) => http<Session>("POST", "/api/auth/exchange", { code }),
  me: () => http<User>("GET", "/api/me"),
  logout: () => http<void>("POST", "/api/auth/logout"),

  // Carteiras
  listWallets: () => http<Wallet[]>("GET", "/api/wallets"),
  addWallet: (req: AddWalletRequest) => http<Wallet>("POST", "/api/wallets", req),
  removeWallet: (id: string) => http<void>("DELETE", `/api/wallets/${enc(id)}`),
  syncWallet: (id: string) => http<Wallet>("POST", `/api/wallets/${enc(id)}/sync`, undefined, { timeoutMs: SLOW_TIMEOUT_MS }),

  // Ingestão (o back-end dispara /api/ingest/solana e /api/ingest/hyperliquid internamente)
  startSync: () => http<SyncStatus>("POST", "/api/ingest"),
  syncStatus: () => http<SyncStatus>("GET", "/api/ingest/status"),

  // Painel e eventos
  dashboard: (month?: string) => http<Dashboard>("GET", `/api/dashboard${month ? `?month=${enc(month)}` : ""}`),
  events: (month: string) => http<TaxEvent[]>("GET", `/api/events?month=${enc(month)}`),
  setManualPrice: (eventId: string, unitPriceBrl: number) =>
    http<TaxEvent>("PUT", `/api/events/${enc(eventId)}/price`, { unitPriceBrl } satisfies ManualPriceRequest),
  reviewManualPrice: (eventId: string, request: ManualPriceReviewRequest) =>
    http<TaxEvent>("PUT", `/api/events/${enc(eventId)}/price`, request),
  reviewAcquisitionCost: (eventId: string, request: ManualCostRequest) =>
    http<TaxEvent>("PUT", `/api/events/${enc(eventId)}/cost`, request),

  // Relatórios
  reports: () => http<ReportSummary[]>("GET", "/api/reports"),
  report: (month: string) => http<ReportDetail>("GET", `/api/report/${enc(month)}`),
  reportCsv: (month: string) => http<DownloadLink>("GET", `/api/report/${enc(month)}/csv`),
  finalizeReport: (month: string) =>
    http<ReportDetail>("POST", `/api/report/${enc(month)}/finalize`, undefined, { timeoutMs: SLOW_TIMEOUT_MS }),
  reissueReport: (month: string) =>
    http<ReportDetail>("POST", `/api/report/${enc(month)}/reissue`, undefined, { timeoutMs: SLOW_TIMEOUT_MS }),
  generateDecripto: (month: string) => http<DownloadLink>("POST", `/api/report/${enc(month)}/decripto`, undefined, { timeoutMs: SLOW_TIMEOUT_MS }),

  // Verificação pública (sem login)
  verifyPublic: (publicId: string) => http<PublicVerification>("GET", `/api/verify/${enc(publicId)}`, undefined, { auth: false }),

  // Agente IA (o back-end chama o Claude; a chave nunca fica no front)
  agent: (req: AgentRequest) => http<AgentReply>("POST", "/api/agent", req, { timeoutMs: SLOW_TIMEOUT_MS }),

  // LGPD — exclusão definitiva
  deleteAccount: () => http<void>("DELETE", "/api/me"),
};

export type Api = typeof httpApi;

/**
 * Qual implementação atende cada chamada. Fora do modo demonstração a API real responde
 * normalmente; a exceção é uma sessão aberta pelo botão "Entrar no modo demonstração"
 * (isDemoSession()), que continua inteira no mockApi mesmo com o back-end real configurado —
 * é o que deixa esse botão disponível para quem for avaliar o projeto sem conectar nada.
 */
const impl = (): Api => (config.useMocks || isDemoSession() ? mockApi : httpApi);

/**
 * A verificação pública consulta sempre a API real. Só numa sessão de demonstração, quando o
 * código não existe de verdade, cai no relatório fictício: é o link que a própria tela do
 * relatório de demonstração mostra, e antes ele abria em "Relatório não encontrado".
 */
const verifyPublic: Api["verifyPublic"] = async (publicId) => {
  if (config.useMocks) return mockApi.verifyPublic(publicId);
  try {
    return await httpApi.verifyPublic(publicId);
  } catch (error) {
    if (!isDemoSession()) throw error;
    return mockApi.verifyPublic(publicId);
  }
};

export const api: Api = new Proxy({} as Api, {
  get: (_target, prop: keyof Api) =>
    prop === "verifyPublic" ? verifyPublic : impl()[prop],
}) as Api;

/** Login de demonstração (sempre via mockApi, mesmo com a API real configurada). */
export const demoLogin = () => mockApi.verify({ demo: true });

export * from "./types";
export { ApiError, errorMessage, isDemoSession } from "./client";
