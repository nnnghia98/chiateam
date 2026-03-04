import { AppShell } from "../_components/AppShell";
import { fetchSettings } from "../../lib/api";
import { SettingsForm } from "../_components/SettingsForm";

export default async function SettingsPage() {
  const settings = await fetchSettings();

  return (
    <AppShell
      title="Settings"
      subtitle="Configure bot behavior."
    >
      <SettingsForm initial={settings} />
    </AppShell>
  );
}

