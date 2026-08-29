import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/reveal";
import { HeroIllustration } from "@/components/illustrations/hero";
import {
  Inbox,
  Phone,
  Users2,
  Sparkles,
  MessageSquareText,
  MessageCircle,
} from "lucide-react";

const features = [
  {
    title: "Real US phone number",
    desc: "Pick from Chicago, New York, Miami, LA and more, then call and receive calls from the browser.",
    icon: Phone,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    title: "SMS, live",
    desc: "Send and receive text messages from your US number — delivered instantly, logged automatically.",
    icon: MessageSquareText,
    gradient: "from-sky-500 to-blue-500",
  },
  {
    title: "WhatsApp, live",
    desc: "Connect WhatsApp Business and message customers where they already are — no separate app needed.",
    icon: MessageCircle,
    gradient: "from-green-500 to-emerald-500",
  },
  {
    title: "Unified Inbox",
    desc: "Phone, SMS, WhatsApp, Facebook, Instagram, TikTok, and X — every conversation in one thread view.",
    icon: Inbox,
    gradient: "from-brand-500 to-indigo-500",
  },
  {
    title: "One customer, one timeline",
    desc: "A call, a WhatsApp message, and an Instagram DM from the same person collapse into a single history.",
    icon: Sparkles,
    gradient: "from-pink-500 to-orange-400",
  },
  {
    title: "Lightweight CRM",
    desc: "Every customer identity — phone, handle, email — links to one record, with notes, tags, and assignment.",
    icon: Users2,
    gradient: "from-violet-500 to-purple-500",
  },
];

const steps = [
  {
    step: "1",
    title: "Create your account",
    desc: "Sign up with your email in under a minute — no credit card required for the trial.",
  },
  {
    step: "2",
    title: "Claim your number",
    desc: "Pick a US area code — calls, SMS, and WhatsApp all work from it immediately.",
  },
  {
    step: "3",
    title: "Work from one inbox",
    desc: "Every call, text, and DM lands in one place, tied to one customer record.",
  },
];

const faqs = [
  {
    q: "Do I need to be based in the US to get a US number?",
    a: "No. You can sign up and get a US virtual number from anywhere in the world, then call and receive calls entirely through your browser.",
  },
  {
    q: "Do calls, SMS, and WhatsApp actually work?",
    a: "Yes — all three are live, not a demo. Your US number makes and receives real calls from the browser, sends and receives real SMS, and you can connect a real WhatsApp Business account to message from the same dashboard.",
  },
  {
    q: "Do I need to connect every channel to get started?",
    a: "No. Phone, SMS, and the Unified Inbox work immediately. WhatsApp, Facebook, Instagram, TikTok, and X are optional integrations you connect when you're ready.",
  },
  {
    q: "Is TikTok and X messaging fully live?",
    a: "Those channels require platform approval that varies by account. The integration architecture is fully built; live sending activates as soon as approved API access is connected.",
  },
  {
    q: "How many numbers can I have?",
    a: "The MVP plan includes one US number per account.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "$9.99",
    features: ["US business number", "Browser calling", "SMS", "Call history"],
    accent: "from-black to-black/80",
  },
  {
    name: "Business",
    price: "$24.99",
    features: ["Everything in Starter", "WhatsApp", "Facebook", "Instagram", "Unified inbox", "Customer CRM"],
    featured: true,
    accent: "from-brand-500 to-purple-500",
  },
  {
    name: "Commerce",
    price: "$39.99",
    features: ["Everything in Business", "Shopify integration", "Customer/order sidebar", "Commerce analytics"],
    accent: "from-emerald-500 to-teal-500",
  },
  {
    name: "Team",
    price: "$79.99",
    features: ["Everything", "Multiple agents", "Assignments", "Advanced analytics", "Call recording", "Team management"],
    accent: "from-pink-500 to-orange-400",
  },
];

export default function LandingPage() {
  return (
    <div className="overflow-x-hidden">
      <header className="sticky top-0 z-20 border-b border-black/[.06] bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="bg-brand-gradient bg-clip-text text-lg font-semibold tracking-tight text-transparent">
            Ashes Connect
          </span>
          <nav className="hidden items-center gap-8 text-sm text-black/60 md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-ink">How it works</a>
            <a href="#features" className="transition-colors hover:text-ink">Features</a>
            <a href="#pricing" className="transition-colors hover:text-ink">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-ink">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-black/70 transition-colors hover:text-ink">
              Log in
            </Link>
            <Link href="/signup">
              <Button size="sm" variant="gradient">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0 -z-10 bg-mesh-radial" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-20 lg:grid-cols-2 lg:pt-28">
          <div className="animate-fade-in-up text-center lg:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              <Sparkles size={12} /> Calls · SMS · WhatsApp — all working today
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink sm:text-6xl">
              Get a real US phone number.{" "}
              <span className="bg-brand-gradient bg-clip-text text-transparent">Call, text, and WhatsApp.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-black/60 lg:mx-0">
              Sign up from anywhere in the world and get a real US number in minutes. Make and
              receive calls from your browser, send and receive SMS, and connect WhatsApp — all
              live, all from one dashboard.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Link href="/signup">
                <Button size="lg" variant="gradient">Get your US number</Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="secondary">See how it works</Button>
              </a>
            </div>
            <div className="mx-auto mt-8 flex max-w-md flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-black/50 lg:mx-0 lg:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Browser calling
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> SMS
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> WhatsApp
              </span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md animate-scale-in lg:max-w-none">
            <HeroIllustration />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20">
        <Reveal className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.step} delay={i * 100}>
              <Card className="card-interactive h-full p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-white shadow-glow">
                  {s.step}
                </div>
                <h3 className="mt-4 font-medium">{s.title}</h3>
                <p className="mt-2 text-sm text-black/60">{s.desc}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative py-20">
        <div className="absolute inset-0 -z-10 bg-brand-gradient-soft" />
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Features</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 100}>
                <Card className="card-interactive h-full p-6">
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${f.gradient} text-white shadow-sm`}
                  >
                    <f.icon size={18} />
                  </span>
                  <h3 className="mt-4 font-medium">{f.title}</h3>
                  <p className="mt-2 text-sm text-black/60">{f.desc}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <Reveal className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pricing</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-black/60">
            Simple pricing to get started. Billing is not yet active in this preview — nothing
            will be charged.
          </p>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 80}>
              <Card
                className={
                  plan.featured
                    ? "card-interactive relative h-full overflow-hidden border-transparent p-6 shadow-glow ring-1 ring-brand-300"
                    : "card-interactive h-full p-6"
                }
              >
                {plan.featured && (
                  <span className="absolute right-4 top-4 rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-semibold text-white">
                    Popular
                  </span>
                )}
                <span className={`inline-block h-1.5 w-10 rounded-full bg-gradient-to-r ${plan.accent}`} />
                <p className="mt-3 text-sm font-medium text-black/60">{plan.name}</p>
                <p className="mt-2 text-2xl font-semibold">
                  {plan.price}
                  <span className="text-sm font-normal text-black/40">/mo</span>
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-black/70">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-black/30" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="mt-6 block">
                  <Button variant={plan.featured ? "gradient" : "secondary"} className="w-full" size="sm">
                    Get Started
                  </Button>
                </Link>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 py-20">
        <Reveal className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">FAQ</h2>
        </Reveal>
        <div className="mt-10 space-y-4">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 60}>
              <Card className="card-interactive p-5">
                <p className="font-medium">{f.q}</p>
                <p className="mt-2 text-sm text-black/60">{f.a}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <Reveal>
          <Card className="relative overflow-hidden border-transparent bg-brand-gradient p-10 text-center text-white shadow-glow">
            <div className="absolute inset-0 bg-mesh-radial opacity-40" />
            <div className="relative">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Bring every conversation into one inbox.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-white/80">
                Get your US number, connect your channels, and start replying from one dashboard.
              </p>
              <Link href="/signup" className="mt-6 inline-block">
                <Button size="lg" className="bg-white text-ink hover:bg-white/90">
                  Get Started free
                </Button>
              </Link>
            </div>
          </Card>
        </Reveal>
      </section>

      <footer className="border-t border-black/[.06] py-10">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-black/40">
          © {new Date().getFullYear()} Ashes Connect. MVP preview.
        </div>
      </footer>
    </div>
  );
}
