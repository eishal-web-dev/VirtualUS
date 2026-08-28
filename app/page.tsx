import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const features = [
  {
    title: "Unified Inbox",
    desc: "Phone, SMS, WhatsApp, Facebook, Instagram, TikTok, and X — every conversation in one thread view.",
  },
  {
    title: "Real US phone number",
    desc: "Pick from Chicago, New York, Miami, LA and more, then call and receive calls from the browser.",
  },
  {
    title: "One customer, one timeline",
    desc: "A call, a WhatsApp message, and an Instagram DM from the same person collapse into a single history.",
  },
  {
    title: "Lightweight CRM",
    desc: "Every customer identity — phone, handle, email — links to one record, with notes, tags, and assignment.",
  },
  {
    title: "Shopify-aware",
    desc: "See a customer's orders and lifetime spend right next to their conversation.",
  },
  {
    title: "Built for teams",
    desc: "Invite agents, assign conversations, and track response time across your whole team.",
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
    title: "Connect your channels",
    desc: "Claim a US number, then connect WhatsApp, Facebook, Instagram, and more as you need them.",
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
  },
  {
    name: "Business",
    price: "$24.99",
    features: ["Everything in Starter", "WhatsApp", "Facebook", "Instagram", "Unified inbox", "Customer CRM"],
    featured: true,
  },
  {
    name: "Commerce",
    price: "$39.99",
    features: ["Everything in Business", "Shopify integration", "Customer/order sidebar", "Commerce analytics"],
  },
  {
    name: "Team",
    price: "$79.99",
    features: ["Everything", "Multiple agents", "Assignments", "Advanced analytics", "Call recording", "Team management"],
  },
];

export default function LandingPage() {
  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-black/[.06] bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">Ashes Connect</span>
          <nav className="hidden items-center gap-8 text-sm text-black/60 md:flex">
            <a href="#how-it-works" className="hover:text-ink">How it works</a>
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-black/70 hover:text-ink">
              Log in
            </Link>
            <Link href="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-20 pt-24 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-6xl">
          Every customer conversation. <span className="text-black/40">One place.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-black/60">
          Phone, SMS, WhatsApp, and social DMs — plus a US business number and a lightweight CRM —
          in one clean dashboard your whole team can work from.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/signup">
            <Button size="lg">Get Started</Button>
          </Link>
          <a href="#how-it-works">
            <Button size="lg" variant="secondary">
              See how it works
            </Button>
          </a>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <Card key={s.step} className="p-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
                {s.step}
              </div>
              <h3 className="mt-4 font-medium">{s.title}</h3>
              <p className="mt-2 text-sm text-black/60">{s.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Features</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="p-6">
              <h3 className="font-medium">{f.title}</h3>
              <p className="mt-2 text-sm text-black/60">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Pricing</h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-sm text-black/60">
          Simple pricing to get started. Billing is not yet active in this preview — nothing will be
          charged.
        </p>
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card key={plan.name} className={plan.featured ? "border-ink p-6 ring-1 ring-ink" : "p-6"}>
              <p className="text-sm font-medium text-black/60">{plan.name}</p>
              <p className="mt-2 text-2xl font-semibold">
                {plan.price}
                <span className="text-sm font-normal text-black/40">/mo</span>
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-black/70">
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link href="/signup" className="mt-6 block">
                <Button variant={plan.featured ? "primary" : "secondary"} className="w-full" size="sm">
                  Get Started
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">FAQ</h2>
        <div className="mt-10 space-y-4">
          {faqs.map((f) => (
            <Card key={f.q} className="p-5">
              <p className="font-medium">{f.q}</p>
              <p className="mt-2 text-sm text-black/60">{f.a}</p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-black/[.06] py-10">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-black/40">
          © {new Date().getFullYear()} Ashes Connect. MVP preview.
        </div>
      </footer>
    </div>
  );
}
