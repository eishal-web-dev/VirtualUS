"use client";

import { useEffect, useState, FormEvent } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Profile = {
  name: string | null;
  email: string;
  businessName: string | null;
  country: string;
  timezone: string;
};

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Kolkata",
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    fetch("/api/settings/profile")
      .then((r) => r.json())
      .then((data) => setProfile(data.profile))
      .catch(() => setProfile(null));
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          businessName: profile.businessName,
          country: profile.country,
          timezone: profile.timezone,
        }),
      });
      if (!res.ok) throw new Error("Could not save settings");
      setMessage("Saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return <p className="text-sm text-black/40">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-black/60">Manage your profile and account.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/dashboard/settings/integrations">
          <Card className="p-4 transition-colors hover:border-black/20">
            <p className="text-sm font-medium">Integrations</p>
            <p className="mt-1 text-xs text-black/50">WhatsApp, Facebook, Instagram, TikTok, X, Shopify →</p>
          </Card>
        </Link>
        <Link href="/dashboard/numbers">
          <Card className="p-4 transition-colors hover:border-black/20">
            <p className="text-sm font-medium">Phone Number</p>
            <p className="mt-1 text-xs text-black/50">Manage your US business number →</p>
          </Card>
        </Link>
        <Link href="/dashboard/team">
          <Card className="p-4 transition-colors hover:border-black/20">
            <p className="text-sm font-medium">Team</p>
            <p className="mt-1 text-xs text-black/50">Invite agents, manage roles →</p>
          </Card>
        </Link>
      </div>

      <Card className="p-6">
        <h2 className="font-medium">Profile</h2>
        <form onSubmit={handleSave} className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-black/70">Full name</label>
            <Input
              value={profile.name ?? ""}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-black/70">Email</label>
            <Input value={profile.email} disabled />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-black/70">Business name</label>
            <Input
              value={profile.businessName ?? ""}
              onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-black/70">Country</label>
            <Input
              value={profile.country}
              onChange={(e) => setProfile({ ...profile, country: e.target.value.toUpperCase() })}
              maxLength={2}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-black/70">Time zone</label>
            <select
              value={profile.timezone}
              onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
              className="w-full rounded-lg border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {message && <span className="text-sm text-black/50">{message}</span>}
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">Session</h2>
        <p className="mt-1 text-sm text-black/60">Sign out of VirtualUS on this device.</p>
        <Button variant="secondary" className="mt-4" onClick={() => signOut({ callbackUrl: "/" })}>
          Sign out
        </Button>
      </Card>

      <Card className="border-red-100 p-6">
        <h2 className="font-medium text-red-700">Danger zone</h2>
        <p className="mt-1 text-sm text-black/60">
          Deleting your account is permanent and releases your phone number. This is a placeholder in the MVP —
          no data is deleted yet.
        </p>
        {!deleteConfirm ? (
          <Button variant="danger" className="mt-4" onClick={() => setDeleteConfirm(true)}>
            Delete account
          </Button>
        ) : (
          <div className="mt-4 flex items-center gap-3">
            <Button variant="danger" disabled title="Not implemented in MVP">
              Confirm delete (disabled in MVP)
            </Button>
            <Button variant="ghost" onClick={() => setDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
