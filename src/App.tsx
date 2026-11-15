import { useState } from "react";
import {
  getCurrentSession,
  getProfileForSession,
  logout,
  authenticate,
  DEMO_LOGINS,
} from "@/services/accountService";
import type { AuthSession } from "@/types/astronaut";
import { Toaster } from "@/components/ui/toast";
import { Login, Admin } from "@/components/medic/accounts";
import { Workspace } from "@/components/medic/workspace";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(getCurrentSession);
  const leave = () => {
    logout();
    setSession(null);
  };
  const profile = session ? getProfileForSession(session) : null;
  return (
    <div className="medic-app dark">
      <Toaster>
        {!session ? (
          <Login onLogin={setSession} />
        ) : session.account.userRole === "admin" ? (
          <Admin onLogout={leave} />
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
