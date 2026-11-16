import { PageHeader } from '../components/ui';
import {
  AboutSection,
  AppearanceSection,
  FoodDatabaseSection,
  TargetsSection,
} from '../components/settings/SettingsSections';
import { AccountSection } from '../components/settings/AccountSection';
import { DataSection } from '../components/settings/DataSection';
import { useSettings } from '../hooks/useSettings';

export default function Settings() {
  const settings = useSettings();
  return (
    <>
      <PageHeader title="Settings" />
      {settings ? (
        <div className="flex flex-col gap-6 pb-6">
          <TargetsSection />
          <AppearanceSection settings={settings} />
          <FoodDatabaseSection settings={settings} />
          <DataSection />
          <AccountSection />
          <AboutSection />
        </div>
      ) : null}
    </>
  );
}
