"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type SearchResults = {
  customers: { id: string; name: string | null; phone: string | null }[];
  messages: { id: string; body: string | null; conversation: { customer: { name: string | null } } }[];
  orders: { id: string; orderNumber: string; totalPrice: string }[];
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const router = useRouter();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    setResults(await res.json());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  if (!open) return null;

  function goTo(path: string) {
    setOpen(false);
    setQuery("");
    router.push(path);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-24" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-black/[.08] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-black/[.06] px-4 py-3">
          <Search size={16} className="text-black/30" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, messages, orders…"
            className="flex-1 text-sm outline-none placeholder:text-black/30"
          />
          <kbd className="rounded border border-black/10 px-1.5 py-0.5 text-[10px] text-black/30">ESC</kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {!results && <p className="p-4 text-center text-sm text-black/30">Type to search…</p>}

          {results && (
            <>
              {results.customers.length > 0 && (
                <div className="mb-2">
                  <p className="px-2 py-1 text-[11px] font-medium uppercase text-black/30">Customers</p>
                  {results.customers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => goTo(`/dashboard/customers/${c.id}`)}
                      className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-black/[.04]"
                    >
                      {c.name ?? c.phone ?? "Unknown"}
                    </button>
                  ))}
                </div>
              )}

              {results.messages.length > 0 && (
                <div className="mb-2">
                  <p className="px-2 py-1 text-[11px] font-medium uppercase text-black/30">Messages</p>
                  {results.messages.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => goTo("/dashboard/inbox")}
                      className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-black/[.04]"
                    >
                      <span className="text-black/40">{m.conversation.customer.name}: </span>
                      {m.body}
                    </button>
                  ))}
                </div>
              )}

              {results.orders.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-[11px] font-medium uppercase text-black/30">Shopify orders</p>
                  {results.orders.map((o) => (
                    <div key={o.id} className="rounded-lg px-2 py-2 text-sm">
                      #{o.orderNumber} · ${o.totalPrice}
                    </div>
                  ))}
                </div>
              )}

              {results.customers.length === 0 && results.messages.length === 0 && results.orders.length === 0 && (
                <p className="p-4 text-center text-sm text-black/30">No results</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
