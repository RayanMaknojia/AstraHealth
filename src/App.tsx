import { useEffect, useMemo, useState } from "react";
import {
  getCurrentSession,
  getProfileForSession,
  logout,
  authenticate,
  DEMO_LOGINS,
} from "@/services/accountService";
import type { AstronautProfile, AuthSession } from "@/types/astronaut";
import { loadProfileFromDb } from "@/services/healthDb";
import { Toaster } from "@/components/ui/toast";
import { Login, Admin } from "@/components/medic/accounts";
import { Workspace } from "@/components/medic/workspace";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(getCurrentSession);
  const leave = () => {
    logout();
    setSession(null);
  };
  const baseProfile = useMemo(
    () => (session ? getProfileForSession(session) : null),
    [session],
  );
  // Seed (first run) and load the astronaut's history from the health database.
  // Keyed on the profile object, so every new login re-reads the latest records.
  const [loaded, setLoaded] = useState<{
    base: AstronautProfile;
    profile: AstronautProfile;
  } | null>(null);
  useEffect(() => {
    if (!baseProfile) return;
    let live = true;
    void loadProfileFromDb(baseProfile).then((profile) => {
      if (live) setLoaded({ base: baseProfile, profile });
    });
    return () => {
      live = false;
    };
  }, [baseProfile]);
  const profile = loaded && loaded.base === baseProfile ? loaded.profile : null;
  return (
    <div className="medic-app dark">
      <Toaster>
        {!session ? (
          <Login onLogin={setSession} />
        ) : session.account.userRole === "admin" ? (
          <Admin onLogout={leave} />
        ) : baseProfile && !profile ? (
          <div className="login-screen" role="status">
            <p>Loading health records…</p>
          </div>
        ) : profile ? (
          <Workspace
            key={`${profile.id}:${profile.mission.launchDate}`}
            initialProfile={profile}
            onLogout={leave}
            onSwitchCrew={(login) => {
              const demo = DEMO_LOGINS.find((d) => d.login === login);
              if (demo) {
                const next = authenticate(demo.login, demo.pin);
                if (next) setSession(next);
              }
            }}
          />
        ) : (
          <div className="login-screen">
            <p>Profile unavailable.</p>
            <button onClick={leave}>Return to login</button>
          </div>
        )}
      </Toaster>
    </div>
  );
}
