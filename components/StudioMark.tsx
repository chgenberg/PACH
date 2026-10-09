import type { Profile } from "@/lib/profile";

export function StudioMark({ profile, light }: { profile: Profile | null; light?: boolean }) {
  if (!profile) return <span className="ghost-mark" aria-hidden="true" />;
  return (
    <span className={light ? "live-mark light" : "live-mark"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={profile.logo} alt="" />
    </span>
  );
}
