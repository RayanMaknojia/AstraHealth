import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  Radio,
  LogOut,
  ShieldCheck,
  Users,
  ShieldAlert,
} from "lucide-react";
import {
  authenticate,
  DEMO_LOGINS,
  listAccounts,
  listProfiles,
  createAstronaut,
  updateMissionDates,
} from "@/services/accountService";
import type { NewAstronautInput } from "@/services/accountService";
import { evaluateProfile, STATUS_LABELS } from "@/services/healthEvaluator";
import type { AuthSession, AstronautProfile } from "@/types/astronaut";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Brand, Panel, PageTitle, Status } from "./primitives";
import { notify } from "./use-mission";
export function Login({ onLogin }: { onLogin: (s: AuthSession) => void }) {
  useEffect(() => {
    document.title = "Space Medic · Crew access";
  }, []);
  const [login, setLogin] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      const session = authenticate(login, pin);
      if (session) onLogin(session);
      else setError("Crew ID or PIN is incorrect. Please try again.");
    } catch {
      setError("Login could not be completed. Please try again.");
    }
  };
  return (
    <main className="login-screen">
      <div className="login-orbit" aria-hidden="true" />
      <div className="login-copy">
        <Brand />
        <h1>
          A little closer
          <br />
          to home.
        </h1>
        <p>
          Your health companion, wherever
          <br />
          the mission takes you.
        </p>
        <span className="offline-note">
          <Radio size={16} /> Onboard intelligence. Works offline.
        </span>
      </div>
      <section className="login-card">
        <div className="login-lock">
          <ShieldCheck />
        </div>
        <h2>Welcome aboard.</h2>
        <p>Sign in to your personal mission dashboard.</p>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="crew-login">Name or crew ID</FieldLabel>
              <Input
                id="crew-login"
                autoComplete="username"
                placeholder="e.g. mars_crew"
                value={login}
                onChange={(e) => {
                  setLogin(e.target.value);
                  setError("");
                }}
                required
                aria-invalid={!!error}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="crew-pin">Access PIN</FieldLabel>
              <Input
                id="crew-pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                placeholder="Enter your PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
              />
            </Field>
          </FieldGroup>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="login-submit">
            Log in <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
        <div className="demo-accounts">
          <h3>Explore a demo mission</h3>
          {DEMO_LOGINS.map((d) => (
            <button
              key={d.login}
              onClick={() => {
                setLogin(d.login);
                setPin(d.pin);
                setError("");
              }}
            >
              <span>
                {d.login}
                <small>{d.shows}</small>
              </span>
              <code>{d.pin}</code>
              <ArrowRight size={14} />
            </button>
          ))}
        </div>
        <p className="fine-print">
          Demo accounts · Device-local access · Decision support, not diagnosis
        </p>
      </section>
      <footer className="login-footer">
        SPACE MEDIC <span>NASA SPACE APPS 2026</span>
      </footer>
    </main>
  );
}
function MissionDates({
  profile,
  onUpdate,
}: {
  profile: AstronautProfile;
  onUpdate: () => void;
}) {
  const [date, setDate] = useState(profile.mission.launchDate.slice(0, 10));
  const [days, setDays] = useState(profile.mission.totalDays);
  return (
    <form
      className="mission-edit"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          updateMissionDates(profile.id, { launchDate: date, totalDays: days });
          onUpdate();
          notify("Mission dates saved");
        } catch (e) {
          notify(
            "Could not update mission",
            e instanceof Error ? e.message : "Try again.",
          );
        }
      }}
    >
      <strong>
        {profile.name}
        <small>{profile.mission.name}</small>
      </strong>
      <label>
        Launch date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </label>
      <label>
        Mission days
        <input
          type="number"
          min="1"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          required
        />
      </label>
      <Button variant="outline" type="submit">
        Save dates
      </Button>
    </form>
  );
}
export function Admin({ onLogout }: { onLogout: () => void }) {
  useEffect(() => {
    document.title = "Space Medic · Mission control";
  }, []);
  const [sos, setSos] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const profiles = listProfiles();
  const accounts = listAccounts();
  const refresh = () => setRevision((r) => r + 1);
  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      createAstronaut({
        name: String(data.get("name")),
        login: String(data.get("login")),
        pin: String(data.get("pin")),
        crewRole: String(data.get("role")) as NewAstronautInput["crewRole"],
        destination: String(
          data.get("destination"),
        ) as NewAstronautInput["destination"],
        launchDate: String(data.get("date")),
        notes: String(data.get("notes")).split("\n").filter(Boolean),
      });
      refresh();
      setError("");
      form.reset();
      notify("Astronaut account created");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to create account.",
      );
    }
  };
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Brand />
        <span>
          <Radio size={16} /> Mission control · Local accounts
        </span>
        <Button variant="destructive" onClick={() => setSos(true)}>
          <ShieldAlert data-icon="inline-start" />
          SOS
        </Button>
        <Button variant="outline" onClick={onLogout}>
          <LogOut data-icon="inline-start" />
          Log out
        </Button>
      </header>
      <PageTitle
        title="Mission control."
        description="Prepare the crew. Keep the mission in view."
      />
      <div className="admin-grid">
        <Panel title="Crew overview" accessory={<Users size={18} />}>
          <div className="crew-table">
            {profiles.map((p) => {
              const e = evaluateProfile(p);
              const hasData = e.indicators.some(
                (i) => i.dataState === "fresh" && i.value !== null,
              );
              return (
                <div key={p.id}>
                  <span className="crew-avatar">{p.agency}</span>
                  <strong>
                    {p.name}
                    <small>
                      {p.role} · {p.login}
                    </small>
                  </strong>
                  <Status
                    status={hasData ? e.report.overallStatus : "no_data"}
                  />
                  <small>Day {e.missionState.missionDay}</small>
                </div>
              );
            })}
          </div>
          <p className="fine-print">
            {accounts.length} local accounts · {profiles.length} astronauts ·
            Status: {STATUS_LABELS.nominal} / Watch / Alert / No data
          </p>
        </Panel>
        <Panel title="Create astronaut">
          <form onSubmit={add}>
            <FieldGroup>
              {[
                ["name", "Full name", "text"],
                ["login", "Crew login", "text"],
                ["pin", "PIN (4-8 digits)", "password"],
              ].map(([name, label, type]) => (
                <Field key={name}>
                  <FieldLabel htmlFor={`new-${name}`}>{label}</FieldLabel>
                  <Input
                    id={`new-${name}`}
                    name={name}
                    type={type}
                    required
                    minLength={name === "pin" ? 4 : 1}
                    maxLength={name === "pin" ? 8 : undefined}
                    pattern={name === "pin" ? "[0-9]{4,8}" : undefined}
                  />
                </Field>
              ))}
              <Field>
                <FieldLabel htmlFor="new-role">Crew role</FieldLabel>
                <select id="new-role" name="role">
                  <option value="specialist">Mission specialist</option>
                  <option value="commander">Commander</option>
                  <option value="pilot">Pilot</option>
                  <option value="flight_engineer">Flight engineer</option>
                  <option value="medical_officer">Medical officer</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-destination">Destination</FieldLabel>
                <select id="new-destination" name="destination">
                  <option value="ISS">ISS</option>
                  <option value="MOON">Moon</option>
                  <option value="MARS">Mars</option>
                  <option value="EARTH_TRAINING">Earth training</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-date">Launch date</FieldLabel>
                <Input id="new-date" name="date" type="date" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-notes">Medical notes</FieldLabel>
                <textarea
                  id="new-notes"
                  name="notes"
                  placeholder="One note per line"
                />
              </Field>
            </FieldGroup>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <Button type="submit">
              Create account <ArrowRight data-icon="inline-end" />
            </Button>
          </form>
        </Panel>
        <Panel title="Mission schedules" className="mission-schedules">
          <div key={revision}>
            {profiles.map((p) => (
              <MissionDates
                key={`${p.id}:${p.mission.launchDate}:${p.mission.totalDays}`}
                profile={p}
                onUpdate={refresh}
              />
            ))}
          </div>
          <p className="fine-print">
            Launch dates and mission length apply when the astronaut next opens
            their dashboard. Streak exceptions and sync arrive in Phase 3.
          </p>
        </Panel>
      </div>
      <Dialog open={sos} onOpenChange={setSos}>
        <DialogContent className="sos-dialog">
          <DialogTitle>Medical emergency · SOS</DialogTitle>
          <DialogDescription>
            Emergency support flows are coming in Phase 3.
          </DialogDescription>
          <p>
            Contact the crew directly using the onboard emergency protocol. No
            dispatch or ground message is sent from this demo.
          </p>
          <Button variant="outline" onClick={() => setSos(false)}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
