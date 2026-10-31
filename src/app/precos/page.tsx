import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr";
import { Badge, Brand, Button, ButtonLink, Card, Kicker } from "@/components/ui";
import { getMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.meta.pricing, description: t.meta.pricingDescription };
}

/**
 * Página pública e estática. O plano Grátis é real (mesmos limites de Configurações);
 * Pro e Contador ainda não têm cobrança nem canal de contato aberto, então o botão fica
 * desabilitado com "Em breve" — ver FAQ "Por que Pro e Contador ainda não têm botão".
 * Preços são de lançamento, sujeitos a mudar (status interno BIZ-02: tratar preço como
 * hipótese, não como receita).
 */
export default async function PricingPage() {
  const messages = await getMessages();
  const t = messages.pricing;
  const soon = messages.settings.soon;

  return (
    <div className="flex min-h-dvh flex-col bg-bg px-5 py-10 text-ink sm:px-12">
      <Link href="/" aria-label="Orbix Declare" className="no-underline">
        <Brand />
      </Link>
      <div className="page-enter m-auto flex w-full max-w-[1040px] flex-col gap-10 py-14">
        <div className="flex max-w-[640px] flex-col gap-2">
          <Kicker>{t.kicker}</Kicker>
          <h1 className="type-h1 m-0">{t.title}</h1>
          <p className="m-0 text-[15px] leading-relaxed text-muted">{t.intro}</p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {t.plans.map((plan) => (
            <Card
              key={plan.id}
              className={`flex flex-col gap-5 p-7 ${plan.highlighted ? "border-2 border-accent" : "border border-line"}`}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-xl font-semibold">{plan.name}</span>
                  {"badge" in plan && plan.badge && <Badge tone="accent">{plan.badge}</Badge>}
                </div>
                <p className="m-0 text-sm text-muted">{plan.tagline}</p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-[34px] font-bold tracking-[-0.02em]">{plan.price}</span>
                  {plan.period && <span className="text-sm text-muted">{plan.period}</span>}
                </div>
                {"regularPrice" in plan && plan.regularPrice && (
                  <span className="text-sm text-muted">
                    <s>{plan.regularPrice}</s> {t.afterBeta}
                  </span>
                )}
              </div>
              <ul className="m-0 flex flex-1 list-none flex-col gap-2.5 p-0">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm leading-[1.5] text-pretty">
                    <CheckIcon size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              {typeof plan.cta.href === "string" && typeof plan.cta.label === "string" ? (
                <ButtonLink
                  href={plan.cta.href}
                  variant={plan.highlighted ? "primary" : "secondary"}
                  size="lg"
                  className="w-full justify-center"
                >
                  {plan.cta.label}
                </ButtonLink>
              ) : (
                <Button variant="secondary" size="lg" className="w-full justify-center" disabled title={soon}>
                  {soon}
                </Button>
              )}
            </Card>
          ))}
        </div>

        <p className="m-0 max-w-[720px] text-sm leading-relaxed text-pretty text-muted">{t.marketNote}</p>

        <div className="flex flex-col gap-5 border-t border-line pt-8">
          <h2 className="type-h2 m-0">{t.faq.title}</h2>
          <div className="flex flex-col gap-5">
            {t.faq.items.map((item) => (
              <div key={item.q} className="flex flex-col gap-1">
                <h3 className="m-0 text-[15px] font-medium">{item.q}</h3>
                <p className="m-0 text-sm leading-[1.6] text-pretty text-muted">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        <Link
          href="/painel"
          className="inline-flex h-11 w-fit items-center rounded-xl border border-line px-5 text-[15px] font-medium text-ink no-underline hover:border-accent"
        >
          {t.back}
        </Link>
      </div>
    </div>
  );
}
