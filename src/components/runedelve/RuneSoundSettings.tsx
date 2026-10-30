import { useSoundSettings, type SoundCategory } from "@/hooks/useSoundSettings";
import { useMusicPref } from "@/hooks/useAmbientMusic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Check,
  Music,
  RotateCcw,
  Swords,
  Trophy,
  Vibrate,
  Volume2,
  Waves,
  MousePointerClick,
} from "lucide-react";

const categories: {
  key: SoundCategory;
  title: string;
  Icon: typeof Volume2;
}[] = [
  { key: "ui", title: "UI & Menus", Icon: MousePointerClick },
  { key: "combat", title: "Combat", Icon: Swords },
  { key: "rewards", title: "Rewards", Icon: Trophy },
  { key: "ambient", title: "Ambient & Boot", Icon: Waves },
];

/** The same persisted app preferences, arranged as two compact game panels. */
export function RuneSoundSettings() {
  const { settings, setMaster, setHaptics, setCategory, reset } =
    useSoundSettings();
  const { enabled: music, setEnabled: setMusic } = useMusicPref();
  return (
    <div className="rd-audio-settings">
      <Tabs defaultValue="general">
        <TabsList className="rd-audio-tabs">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="effects">Effects</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="rd-audio-panel">
          <AudioToggle
            title="Master Sound"
            Icon={Volume2}
            checked={settings.master}
            onChange={setMaster}
          />
          <AudioToggle
            title="Haptics (Vibration)"
            Icon={Vibrate}
            checked={settings.haptics}
            disabled={!settings.master}
            onChange={setHaptics}
          />
          <AudioToggle
            title="Background Music"
            Icon={Music}
            checked={music}
            disabled={!settings.master || !settings.categories.ambient}
            onChange={setMusic}
          />
        </TabsContent>
        <TabsContent value="effects" className="rd-audio-panel">
          {categories.map(({ key, title, Icon }) => (
            <AudioToggle
              key={key}
              title={title}
              Icon={Icon}
              checked={settings.categories[key]}
              disabled={!settings.master}
              onChange={(on) => setCategory(key, on)}
            />
          ))}
        </TabsContent>
      </Tabs>
      <button
        type="button"
        onClick={() => {
          reset();
          setMusic(false);
        }}
        className="rd-audio-reset"
        aria-label="Reset sound settings to defaults"
      >
        <RotateCcw size={15} aria-hidden />
        Reset to defaults
      </button>
    </div>
  );
}

function AudioToggle({
  title,
  Icon,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  Icon: typeof Volume2;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={title}
      aria-checked={checked && !disabled}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="rd-audio-toggle"
    >
      <Icon size={18} aria-hidden />
      <span>{title}</span>
      <i aria-hidden="true" data-checked={checked && !disabled}>
        {checked && !disabled ? <Check size={13} /> : null}
      </i>
    </button>
  );
}
